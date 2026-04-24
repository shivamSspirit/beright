/**
 * Composite Score Calculator
 *
 * Combines S1-S6 component scores with confidence weighting (Bayesian shrinkage)
 */

import {
  ComponentScores,
  ScoreWeights,
  DEFAULT_WEIGHTS,
  ForecasterScore,
  Prediction,
  ForecasterIdentity,
  PlatformStats,
  AntiGamingSignals,
} from '../types';

export interface CompositeResult {
  rawCompositeScore: number;  // 0-1000 before confidence weighting
  confidenceWeight: number;  // 0.0-1.0 (Bayesian shrinkage factor)
  finalCompositeScore: number;  // 0-1000 after confidence weighting
  tier: 1 | 2 | 3 | 4 | 5;
}

/**
 * Calculate confidence weight using Bayesian shrinkage
 *
 * Formula: N / (N + ANCHOR)
 * where N = total resolved events, ANCHOR = 100
 *
 * - 0 predictions: confidence = 0.0 (full shrinkage to prior of 500)
 * - 10 predictions: confidence = 0.091
 * - 100 predictions: confidence = 0.5
 * - 1000 predictions: confidence = 0.909
 */
export function calculateConfidenceWeight(totalResolved: number): number {
  const ANCHOR = 100;  // Empirically validated from Metaculus data
  return totalResolved / (totalResolved + ANCHOR);
}

/**
 * Apply confidence weighting to raw composite score
 *
 * Formula: confidence × raw + (1 - confidence) × PRIOR_MEAN
 * where PRIOR_MEAN = 500 (median of 0-1000 scale)
 */
export function applyConfidenceWeighting(
  rawScore: number,
  confidenceWeight: number
): number {
  const PRIOR_MEAN = 500;
  const finalScore = confidenceWeight * rawScore + (1 - confidenceWeight) * PRIOR_MEAN;
  return Math.round(finalScore);
}

/**
 * Calculate tier from final composite score
 */
export function calculateTier(finalScore: number): 1 | 2 | 3 | 4 | 5 {
  if (finalScore >= 700) return 1;  // Elite - can create vaults
  if (finalScore >= 600) return 2;  // Expert - can co-manage vaults
  if (finalScore >= 500) return 3;  // Verified skill
  if (finalScore >= 300) return 4;  // Average
  return 5;  // Unproven
}

/**
 * Calculate raw composite score from component scores
 */
export function calculateRawComposite(
  components: ComponentScores,
  weights: ScoreWeights = DEFAULT_WEIGHTS
): number {
  const rawScore =
    weights.s1 * components.s1Composite +
    weights.s2 * components.s2Resolution +
    weights.s3 * components.s3Composite +
    weights.s4 * components.s4DifficultyWeighted +
    weights.s5 * components.s5VolumeConsistency +
    weights.s6 * components.s6CrossPlatform;

  // Clamp to 0-1000
  return Math.max(0, Math.min(1000, Math.round(rawScore)));
}

/**
 * Calculate full composite score with confidence weighting
 */
export function calculateComposite(
  components: ComponentScores,
  totalResolved: number,
  weights: ScoreWeights = DEFAULT_WEIGHTS
): CompositeResult {
  const rawCompositeScore = calculateRawComposite(components, weights);
  const confidenceWeight = calculateConfidenceWeight(totalResolved);
  const finalCompositeScore = applyConfidenceWeighting(rawCompositeScore, confidenceWeight);
  const tier = calculateTier(finalCompositeScore);

  return {
    rawCompositeScore,
    confidenceWeight,
    finalCompositeScore,
    tier,
  };
}

/**
 * Main orchestrator: calculate complete ForecasterScore
 */
export function calculateForecasterScore(
  forecasterId: string,
  identity: ForecasterIdentity,
  predictions: Prediction[],
  components: ComponentScores,
  platformStats: PlatformStats,
  antiGaming: AntiGamingSignals
): ForecasterScore {
  const totalPredictions = predictions.length;
  const resolved = predictions.filter(p => p.outcome !== undefined);
  const totalResolved = resolved.length;

  // Calculate composite
  const {
    rawCompositeScore,
    confidenceWeight,
    finalCompositeScore,
    tier,
  } = calculateComposite(components, totalResolved);

  // Calculate overall Brier score
  const brierScores = resolved.map(p => {
    const forecast = p.entryPrice ?? p.predictedProbability;
    const outcome = p.outcome ? 1.0 : 0.0;
    return Math.pow(forecast - outcome, 2);
  });
  const avgBrierScore = brierScores.length > 0
    ? brierScores.reduce((sum, b) => sum + b, 0) / brierScores.length
    : 0;

  // Calculate accuracy
  const correct = resolved.filter(p => {
    const forecast = p.entryPrice ?? p.predictedProbability;
    return p.outcome === (forecast >= 0.5);
  }).length;
  const accuracy = totalResolved > 0 ? correct / totalResolved : 0;

  return {
    forecasterId,
    identity,
    components,
    platformStats,
    rawCompositeScore,
    confidenceWeight,
    finalCompositeScore,
    tier,
    antiGaming,
    totalPredictions,
    totalResolved,
    avgBrierScore,
    accuracy,
    lastScoreUpdate: new Date(),
    calculatedAt: new Date(),
  };
}
