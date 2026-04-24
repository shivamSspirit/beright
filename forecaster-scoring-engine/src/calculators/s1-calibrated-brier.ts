/**
 * S1: Dual-Path Calibrated Brier Score Calculator (28% weight)
 *
 * Path A: Trade-Implied (for CLOB platforms like Polymarket, Kalshi)
 * Path B: Calibration-Binned (for forecast platforms like Metaculus, Manifold)
 */

import { Prediction, CALIBRATION_BINS, BrierDecomposition } from '../types';

export interface S1Result {
  tradeImplied: number | null;
  calibrationBinned: number | null;
  composite: number;
  metadata: {
    avgBrier: number;
    calibrationCurve: Array<{ bin: number; accuracy: number; count: number }>;
    murphyDecomposition: BrierDecomposition | null;
  };
}

/**
 * Calculate S1 score using dual-path approach
 */
export function calculateS1(predictions: Prediction[]): S1Result {
  const resolved = predictions.filter(p => p.outcome !== undefined);

  if (resolved.length === 0) {
    return {
      tradeImplied: null,
      calibrationBinned: null,
      composite: 500,  // Prior mean
      metadata: {
        avgBrier: 0,
        calibrationCurve: [],
        murphyDecomposition: null,
      },
    };
  }

  // Separate predictions by platform type
  const clobPredictions = resolved.filter(p =>
    (p.platform === 'polymarket' || p.platform === 'kalshi') && p.entryPrice !== undefined
  );

  const forecastPredictions = resolved.filter(p =>
    (p.platform === 'metaculus' || p.platform === 'manifold')
  );

  // Path A: Trade-Implied (CLOB platforms)
  const tradeImplied = clobPredictions.length > 0
    ? calculateTradeImplied(clobPredictions)
    : null;

  // Path B: Calibration-Binned (forecast platforms)
  const calibrationBinned = forecastPredictions.length > 0
    ? calculateCalibrationBinned(forecastPredictions)
    : null;

  // Composite: weighted by sample size
  const clobWeight = clobPredictions.length;
  const forecastWeight = forecastPredictions.length;
  const totalWeight = clobWeight + forecastWeight;

  const composite = totalWeight > 0
    ? Math.round(
        ((tradeImplied ?? 500) * clobWeight + (calibrationBinned ?? 500) * forecastWeight) /
        totalWeight
      )
    : 500;

  // Calculate overall Brier score
  const allBrier = resolved.map(p => calculateBrierScore(p));
  const avgBrier = allBrier.reduce((sum, b) => sum + b, 0) / allBrier.length;

  // Calculate calibration curve
  const calibrationCurve = calculateCalibrationCurve(resolved);

  // Murphy-Yates decomposition (only for forecast platforms)
  const murphyDecomposition = forecastPredictions.length > 0
    ? calculateMurphyDecomposition(forecastPredictions)
    : null;

  return {
    tradeImplied,
    calibrationBinned,
    composite,
    metadata: {
      avgBrier,
      calibrationCurve,
      murphyDecomposition,
    },
  };
}

/**
 * Path A: Trade-Implied Score
 * For CLOB platforms where entry price is the implied probability
 */
function calculateTradeImplied(predictions: Prediction[]): number {
  const brierScores = predictions.map(p => calculateBrierScore(p));
  const avgBrier = brierScores.reduce((sum, b) => sum + b, 0) / brierScores.length;

  // Calibration curve quality (how well-calibrated are the bins?)
  const calibrationCurve = calculateCalibrationCurve(predictions);
  const calibrationError = calibrationCurve.reduce((sum, bin) => {
    const expectedAccuracy = bin.bin;  // e.g., 0.7 for 0.7 bin
    const actualAccuracy = bin.accuracy;
    return sum + Math.abs(expectedAccuracy - actualAccuracy) * bin.count;
  }, 0) / predictions.length;

  // Score: (1 - avgBrier) * (1 - calibrationError) * 1000
  // Perfect score = 1000 (Brier = 0, calibration error = 0)
  const score = (1 - avgBrier) * (1 - calibrationError) * 1000;

  return Math.max(0, Math.min(1000, Math.round(score)));
}

/**
 * Path B: Calibration-Binned Score
 * For forecast platforms using Murphy-Yates decomposition
 */
function calculateCalibrationBinned(predictions: Prediction[]): number {
  const decomposition = calculateMurphyDecomposition(predictions);

  if (decomposition.uncertainty === 0) {
    // All markets were certain (100% or 0%) - no skill demonstrated
    return 500;
  }

  // Score formula: 1000 * (resolution - reliability) / uncertainty
  // This rewards informativeness (resolution) and penalizes miscalibration (reliability)
  const skill = (decomposition.resolution - decomposition.reliability) / decomposition.uncertainty;

  // Normalize to 0-1000 scale
  // skill ranges from -1 (worst) to +1 (best)
  const normalizedScore = 500 + skill * 500;

  return Math.max(0, Math.min(1000, Math.round(normalizedScore)));
}

/**
 * Calculate Brier score for a single prediction
 */
function calculateBrierScore(prediction: Prediction): number {
  if (prediction.outcome === undefined) {
    throw new Error('Cannot calculate Brier score for unresolved prediction');
  }

  const forecast = prediction.entryPrice ?? prediction.predictedProbability;
  const outcome = prediction.outcome ? 1.0 : 0.0;

  return Math.pow(forecast - outcome, 2);
}

/**
 * Calculate calibration curve (binned accuracy)
 */
function calculateCalibrationCurve(
  predictions: Prediction[]
): Array<{ bin: number; accuracy: number; count: number }> {
  const bins = CALIBRATION_BINS;
  const binCounts: number[] = new Array(bins.length - 1).fill(0);
  const binCorrect: number[] = new Array(bins.length - 1).fill(0);

  predictions.forEach(p => {
    const forecast = p.entryPrice ?? p.predictedProbability;
    const binIndex = findBinIndex(forecast, bins);

    binCounts[binIndex]++;
    if (p.outcome === (forecast >= 0.5)) {
      binCorrect[binIndex]++;
    }
  });

  return bins.slice(0, -1).map((binStart, i) => ({
    bin: (binStart + bins[i + 1]) / 2,  // Midpoint
    accuracy: binCounts[i] > 0 ? binCorrect[i] / binCounts[i] : 0,
    count: binCounts[i],
  }));
}

/**
 * Find which calibration bin a forecast belongs to
 */
function findBinIndex(forecast: number, bins: number[]): number {
  for (let i = 0; i < bins.length - 1; i++) {
    if (forecast >= bins[i] && forecast < bins[i + 1]) {
      return i;
    }
  }
  // Handle edge case: forecast = 1.0
  return bins.length - 2;
}

/**
 * Murphy-Yates decomposition of Brier score
 *
 * Brier = Uncertainty - Resolution + Reliability
 *
 * - Uncertainty: inherent difficulty of the questions
 * - Resolution: informativeness (distance from base rate)
 * - Reliability: calibration error
 */
function calculateMurphyDecomposition(predictions: Prediction[]): BrierDecomposition {
  const outcomes = predictions.map(p => (p.outcome ? 1.0 : 0.0));
  const forecasts = predictions.map(p => p.entryPrice ?? p.predictedProbability);

  const n = predictions.length;

  // Base rate (mean outcome)
  const baseRate = outcomes.reduce((sum, o) => sum + o, 0) / n;

  // Uncertainty: mean(outcome * (1 - outcome))
  const uncertainty = outcomes.reduce((sum, o) => sum + o * (1 - o), 0) / n;

  // Resolution: mean((forecast - baseRate)^2)
  const resolution = forecasts.reduce((sum, f) => sum + Math.pow(f - baseRate, 2), 0) / n;

  // Reliability: mean((forecast - outcome)^2) = mean Brier
  const reliability = predictions.reduce((sum, p, i) => {
    const forecast = forecasts[i];
    const outcome = outcomes[i];
    return sum + Math.pow(forecast - outcome, 2);
  }, 0) / n;

  return {
    uncertainty,
    resolution,
    reliability,
  };
}

/**
 * Calculate log score for a single prediction
 * (Used for alternative scoring, not primary metric)
 */
export function calculateLogScore(prediction: Prediction): number {
  if (prediction.outcome === undefined) {
    throw new Error('Cannot calculate log score for unresolved prediction');
  }

  const forecast = prediction.entryPrice ?? prediction.predictedProbability;

  // Clamp forecast to [0.001, 0.999] to avoid log(0)
  const clampedForecast = Math.max(0.001, Math.min(0.999, forecast));

  const outcome = prediction.outcome ? 1.0 : 0.0;

  // Log score: -log(P(outcome))
  const prob = outcome === 1.0 ? clampedForecast : (1 - clampedForecast);
  return -Math.log2(prob);
}
