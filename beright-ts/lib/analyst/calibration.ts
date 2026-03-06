/**
 * Calibration & Accuracy Tracking
 *
 * Track prediction accuracy over time.
 * "The best forecasters are constantly calibrated."
 *
 * @author BeRight Protocol
 */

import { CalibrationRecord, ConfidenceLevel, calculateBrierScore } from './types';

// =============================================================================
// IN-MEMORY STORE (TODO: Move to DB/Redis)
// =============================================================================

const calibrationStore: Map<string, CalibrationRecord> = new Map();

// =============================================================================
// RECORDING
// =============================================================================

/**
 * Record a new prediction for later calibration
 */
export function recordPrediction(record: Omit<CalibrationRecord, 'resolved' | 'resolvedAt' | 'actualOutcome' | 'brierScore' | 'logScore'>): void {
  calibrationStore.set(record.analysisId, {
    ...record,
    resolved: false,
  });
}

/**
 * Record the resolution of a prediction
 */
export function recordResolution(
  analysisId: string,
  outcome: boolean
): CalibrationRecord | null {
  const record = calibrationStore.get(analysisId);
  if (!record) return null;

  // Calculate scores
  const brierScore = calculateBrierScore(record.predictedProbability, outcome);
  const logScore = calculateLogScore(record.predictedProbability, outcome);

  const updated: CalibrationRecord = {
    ...record,
    resolved: true,
    resolvedAt: new Date(),
    actualOutcome: outcome,
    brierScore,
    logScore,
  };

  calibrationStore.set(analysisId, updated);
  return updated;
}

/**
 * Calculate log scoring rule
 */
function calculateLogScore(prediction: number, outcome: boolean): number {
  const p = outcome ? prediction : 1 - prediction;
  // Clamp to avoid log(0)
  const clamped = Math.max(0.01, Math.min(0.99, p));
  return Math.log(clamped);
}

// =============================================================================
// RETRIEVAL
// =============================================================================

/**
 * Get all predictions for a market
 */
export function getPredictionsForMarket(marketId: string): CalibrationRecord[] {
  return Array.from(calibrationStore.values())
    .filter(r => r.marketId === marketId);
}

/**
 * Get unresolved predictions
 */
export function getUnresolvedPredictions(): CalibrationRecord[] {
  return Array.from(calibrationStore.values())
    .filter(r => !r.resolved);
}

/**
 * Get resolved predictions
 */
export function getResolvedPredictions(): CalibrationRecord[] {
  return Array.from(calibrationStore.values())
    .filter(r => r.resolved);
}

// =============================================================================
// CALIBRATION ANALYSIS
// =============================================================================

/**
 * Calibration bucket for analysis
 */
export interface CalibrationBucket {
  range: string;           // "60-70%"
  minProb: number;
  maxProb: number;
  predictions: number;
  correctYes: number;
  actualRate: number;
  expectedRate: number;
  calibrationError: number;
}

/**
 * Generate calibration analysis
 */
export function analyzeCalibration(): {
  buckets: CalibrationBucket[];
  overallBrier: number;
  overallLogScore: number;
  totalPredictions: number;
  totalResolved: number;
  isOverconfident: boolean;
  isUnderconfident: boolean;
  calibrationSummary: string;
} {
  const resolved = getResolvedPredictions();

  if (resolved.length === 0) {
    return {
      buckets: [],
      overallBrier: 0,
      overallLogScore: 0,
      totalPredictions: calibrationStore.size,
      totalResolved: 0,
      isOverconfident: false,
      isUnderconfident: false,
      calibrationSummary: 'No resolved predictions yet.',
    };
  }

  // Create calibration buckets (0-10%, 10-20%, ..., 90-100%)
  const buckets: CalibrationBucket[] = [];

  for (let i = 0; i < 10; i++) {
    const minProb = i / 10;
    const maxProb = (i + 1) / 10;

    const inBucket = resolved.filter(r =>
      r.predictedProbability >= minProb && r.predictedProbability < maxProb
    );

    if (inBucket.length > 0) {
      const correctYes = inBucket.filter(r => r.actualOutcome === true).length;
      const actualRate = correctYes / inBucket.length;
      const expectedRate = (minProb + maxProb) / 2;

      buckets.push({
        range: `${(minProb * 100).toFixed(0)}-${(maxProb * 100).toFixed(0)}%`,
        minProb,
        maxProb,
        predictions: inBucket.length,
        correctYes,
        actualRate,
        expectedRate,
        calibrationError: Math.abs(actualRate - expectedRate),
      });
    }
  }

  // Overall metrics
  const overallBrier = resolved.reduce((sum, r) => sum + (r.brierScore || 0), 0) / resolved.length;
  const overallLogScore = resolved.reduce((sum, r) => sum + (r.logScore || 0), 0) / resolved.length;

  // Check for systematic bias
  const highConfPreds = resolved.filter(r =>
    r.predictedProbability >= 0.7 || r.predictedProbability <= 0.3
  );

  let isOverconfident = false;
  let isUnderconfident = false;

  if (highConfPreds.length >= 10) {
    // Check if extreme predictions are calibrated
    const extremeCorrect = highConfPreds.filter(r => {
      if (r.predictedProbability >= 0.7) return r.actualOutcome === true;
      return r.actualOutcome === false;
    }).length;

    const extremeRate = extremeCorrect / highConfPreds.length;

    if (extremeRate < 0.65) isOverconfident = true;
    if (extremeRate > 0.85) isUnderconfident = true;
  }

  // Summary
  let calibrationSummary: string;
  if (overallBrier < 0.2) {
    calibrationSummary = `Excellent calibration (Brier: ${overallBrier.toFixed(3)})`;
  } else if (overallBrier < 0.25) {
    calibrationSummary = `Good calibration (Brier: ${overallBrier.toFixed(3)})`;
  } else if (overallBrier < 0.33) {
    calibrationSummary = `Fair calibration (Brier: ${overallBrier.toFixed(3)}), room for improvement`;
  } else {
    calibrationSummary = `Poor calibration (Brier: ${overallBrier.toFixed(3)}), needs significant adjustment`;
  }

  if (isOverconfident) {
    calibrationSummary += '. Tendency toward overconfidence detected.';
  }
  if (isUnderconfident) {
    calibrationSummary += '. Tendency toward underconfidence detected.';
  }

  return {
    buckets,
    overallBrier,
    overallLogScore,
    totalPredictions: calibrationStore.size,
    totalResolved: resolved.length,
    isOverconfident,
    isUnderconfident,
    calibrationSummary,
  };
}

// =============================================================================
// PERFORMANCE BY CATEGORY
// =============================================================================

/**
 * Analyze performance by market category
 */
export function analyzeByCategory(): Record<string, {
  predictions: number;
  resolved: number;
  brierScore: number;
  accuracy: number;
}> {
  const resolved = getResolvedPredictions();
  const byCategory: Record<string, CalibrationRecord[]> = {};

  // Group by category (extract from question or assume "general")
  for (const record of resolved) {
    // Simple category extraction from marketId or default
    const category = 'general'; // Would need to store category in record
    if (!byCategory[category]) byCategory[category] = [];
    byCategory[category].push(record);
  }

  const results: Record<string, { predictions: number; resolved: number; brierScore: number; accuracy: number }> = {};

  for (const [category, records] of Object.entries(byCategory)) {
    const avgBrier = records.reduce((sum, r) => sum + (r.brierScore || 0), 0) / records.length;

    // Accuracy: correct if predicted > 50% and outcome true, or predicted < 50% and outcome false
    const correct = records.filter(r => {
      if (r.predictedProbability >= 0.5) return r.actualOutcome === true;
      return r.actualOutcome === false;
    }).length;

    results[category] = {
      predictions: calibrationStore.size, // Total in store
      resolved: records.length,
      brierScore: avgBrier,
      accuracy: records.length > 0 ? correct / records.length : 0,
    };
  }

  return results;
}

// =============================================================================
// CALIBRATION ADJUSTMENT
// =============================================================================

/**
 * Suggest probability adjustment based on historical calibration
 */
export function suggestAdjustment(rawProbability: number): {
  adjustedProbability: number;
  adjustmentReason: string;
} {
  const calibration = analyzeCalibration();

  if (calibration.totalResolved < 20) {
    return {
      adjustedProbability: rawProbability,
      adjustmentReason: 'Insufficient data for calibration adjustment',
    };
  }

  let adjusted = rawProbability;
  let reason = 'No adjustment needed';

  // Find relevant bucket
  const bucketIndex = Math.min(9, Math.floor(rawProbability * 10));
  const bucket = calibration.buckets.find(b =>
    rawProbability >= b.minProb && rawProbability < b.maxProb
  );

  if (bucket && bucket.predictions >= 5) {
    // Adjust toward actual rate
    const diff = bucket.actualRate - bucket.expectedRate;

    if (Math.abs(diff) > 0.1) {
      adjusted = rawProbability + diff * 0.5; // Partial adjustment
      adjusted = Math.max(0.01, Math.min(0.99, adjusted));
      reason = `Historical calibration in ${bucket.range} bucket suggests ${diff > 0 ? 'higher' : 'lower'} probability`;
    }
  }

  // Global overconfidence/underconfidence adjustment
  if (calibration.isOverconfident && (rawProbability > 0.7 || rawProbability < 0.3)) {
    // Move toward 50%
    adjusted = adjusted * 0.9 + 0.5 * 0.1;
    reason = 'Adjusting for historical overconfidence';
  } else if (calibration.isUnderconfident && (rawProbability > 0.6 || rawProbability < 0.4)) {
    // Move away from 50%
    const direction = rawProbability > 0.5 ? 1 : -1;
    adjusted = adjusted + direction * 0.05;
    adjusted = Math.max(0.01, Math.min(0.99, adjusted));
    reason = 'Adjusting for historical underconfidence';
  }

  return {
    adjustedProbability: adjusted,
    adjustmentReason: reason,
  };
}

// =============================================================================
// EXPORT
// =============================================================================

export default {
  recordPrediction,
  recordResolution,
  getPredictionsForMarket,
  getUnresolvedPredictions,
  getResolvedPredictions,
  analyzeCalibration,
  analyzeByCategory,
  suggestAdjustment,
};
