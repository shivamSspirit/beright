/**
 * Component Score Calculators (S2-S6)
 *
 * S2: Resolution Score (22% weight) - Informativeness
 * S3: Edge Score (18% weight) - Economic & Informational Edge
 * S4: Difficulty-Weighted Score (13% weight) - Harder questions weighted more
 * S5: Volume & Consistency (8% weight) - Sustained activity
 * S6: Cross-Platform Consistency (11% weight) - Skill transferability
 */

import { Prediction, PlatformStats } from '../types';
import { differenceInWeeks, getWeek, getYear } from 'date-fns';

/**
 * S2: Resolution Score
 * Measures informativeness (how far forecasts are from base rate)
 */
export function calculateS2(predictions: Prediction[]): number {
  const resolved = predictions.filter(p => p.outcome !== undefined);

  if (resolved.length === 0) {
    return 500;  // Prior mean
  }

  // Base rate: overall frequency of YES outcomes
  const outcomes = resolved.map(p => (p.outcome ? 1.0 : 0.0));
  const baseRate = outcomes.reduce((sum, o) => sum + o, 0) / outcomes.length;

  // Resolution: mean squared distance from base rate
  const forecasts = resolved.map(p => p.entryPrice ?? p.predictedProbability);
  const resolution = forecasts.reduce((sum, f) =>
    sum + Math.pow(f - baseRate, 2), 0
  ) / forecasts.length;

  // Normalize to 0-1000 scale
  // resolution ranges from 0 (always predict base rate) to 0.25 (max for binary)
  const normalizedScore = 1000 * Math.sqrt(resolution) / 0.5;  // Max sqrt(0.25) = 0.5

  return Math.max(0, Math.min(1000, Math.round(normalizedScore)));
}

/**
 * S3: Edge Score (Dual Path)
 *
 * Economic Edge: Profit over random trading (CLOB platforms)
 * Informational Edge: Beat community consensus (forecast platforms)
 */
export interface S3Result {
  economicEdge: number | null;
  informationalEdge: number | null;
  composite: number;
}

export function calculateS3(predictions: Prediction[]): S3Result {
  const resolved = predictions.filter(p => p.outcome !== undefined);

  if (resolved.length === 0) {
    return {
      economicEdge: null,
      informationalEdge: null,
      composite: 500,
    };
  }

  // Separate by platform type
  const clobPredictions = resolved.filter(p =>
    (p.platform === 'polymarket' || p.platform === 'kalshi') &&
    p.entryPrice !== undefined &&
    p.positionSize !== undefined
  );

  const forecastPredictions = resolved.filter(p =>
    (p.platform === 'metaculus' || p.platform === 'manifold') &&
    p.communityMedian !== undefined
  );

  // Economic edge
  const economicEdge = clobPredictions.length > 0
    ? calculateEconomicEdge(clobPredictions)
    : null;

  // Informational edge
  const informationalEdge = forecastPredictions.length > 0
    ? calculateInformationalEdge(forecastPredictions)
    : null;

  // Composite (weighted by activity)
  const clobWeight = clobPredictions.length;
  const forecastWeight = forecastPredictions.length;
  const totalWeight = clobWeight + forecastWeight;

  const composite = totalWeight > 0
    ? Math.round(
        ((economicEdge ?? 500) * clobWeight + (informationalEdge ?? 500) * forecastWeight) /
        totalWeight
      )
    : 500;

  return {
    economicEdge,
    informationalEdge,
    composite,
  };
}

/**
 * Economic edge: actual P&L vs random trading baseline
 */
function calculateEconomicEdge(predictions: Prediction[]): number {
  let actualPnL = 0;
  let randomPnL = 0;
  let totalVolume = 0;

  predictions.forEach(p => {
    const entryPrice = p.entryPrice!;
    const size = p.positionSize!;
    const outcome = p.outcome ? 1.0 : 0.0;

    // Actual P&L
    const payout = outcome * size / entryPrice;  // If YES wins, get $1/share
    const cost = size;
    actualPnL += payout - cost;

    // Random baseline: 50/50 bet
    randomPnL += (0.5 - entryPrice) * size;

    totalVolume += size;
  });

  if (totalVolume === 0) {
    return 500;
  }

  // Edge = (actual - random) / volume
  const edge = (actualPnL - randomPnL) / totalVolume;

  // Normalize using tanh to 0-1000 scale
  // edge ranges from -1 (terrible) to +1 (amazing)
  const normalizedScore = 500 + 500 * Math.tanh(edge);

  return Math.round(normalizedScore);
}

/**
 * Informational edge: beat community consensus
 */
function calculateInformationalEdge(predictions: Prediction[]): number {
  let beatCommunity = 0;

  predictions.forEach(p => {
    const userForecast = p.predictedProbability;
    const communityForecast = p.communityMedian!;
    const outcome = p.outcome ? 1.0 : 0.0;

    // Who was closer to the truth?
    const userError = Math.abs(userForecast - outcome);
    const communityError = Math.abs(communityForecast - outcome);

    if (userError < communityError) {
      beatCommunity++;
    }
  });

  // Score: % of times beat community
  const beatRate = beatCommunity / predictions.length;

  // Normalize to 0-1000 scale
  return Math.round(beatRate * 1000);
}

/**
 * S4: Difficulty-Weighted Score
 * Harder questions (high community spread) get more weight
 */
export function calculateS4(predictions: Prediction[]): number {
  const resolved = predictions.filter(p =>
    p.outcome !== undefined && p.difficulty !== undefined
  );

  if (resolved.length === 0) {
    return 500;
  }

  // Weighted Brier score (lower is better)
  let weightedSum = 0;
  let weightSum = 0;

  resolved.forEach(p => {
    const forecast = p.entryPrice ?? p.predictedProbability;
    const outcome = p.outcome ? 1.0 : 0.0;
    const brierScore = Math.pow(forecast - outcome, 2);
    const weight = p.difficulty!;  // Higher difficulty = more weight

    weightedSum += (1 - brierScore) * weight;
    weightSum += weight;
  });

  if (weightSum === 0) {
    return 500;
  }

  const weightedAccuracy = weightedSum / weightSum;

  // Normalize to 0-1000 scale
  return Math.round(weightedAccuracy * 1000);
}

/**
 * S5: Volume & Consistency
 * Rewards sustained activity over time
 */
export function calculateS5(predictions: Prediction[]): number {
  if (predictions.length === 0) {
    return 0;  // No activity
  }

  // Volume score: logarithmic scaling up to 1000 predictions
  // 10 predictions = 500, 100 = 750, 1000 = 1000
  const volumeScore = Math.min(1000, Math.round(500 * Math.log10(predictions.length + 1)));

  // Consistency score: active weeks / total weeks
  const timestamps = predictions.map(p => p.predictedAt).sort((a, b) => a.getTime() - b.getTime());
  const firstPrediction = timestamps[0];
  const lastPrediction = timestamps[timestamps.length - 1];

  const totalWeeks = Math.max(1, differenceInWeeks(lastPrediction, firstPrediction));

  // Count unique weeks with activity
  const activeWeeks = new Set(predictions.map(p => {
    const year = getYear(p.predictedAt);
    const week = getWeek(p.predictedAt);
    return `${year}-W${week}`;
  })).size;

  const consistencyScore = Math.round(1000 * (activeWeeks / totalWeeks));

  // Composite: 60% volume, 40% consistency
  const s5 = Math.round(0.6 * volumeScore + 0.4 * consistencyScore);

  return Math.max(0, Math.min(1000, s5));
}

/**
 * S6: Cross-Platform Consistency
 * This is the MOAT - measures skill transferability
 *
 * Formula: min(platform_scores) / max(platform_scores)
 * - Requires 2+ platforms with activity
 * - Penalizes one-trick ponies
 * - Rewards consistent excellence
 */
export function calculateS6(platformStats: PlatformStats): number {
  const scores = [
    platformStats.polymarketComposite,
    platformStats.metaculusComposite,
    platformStats.kalshiComposite,
    platformStats.manifoldComposite,
  ].filter(s => s !== null) as number[];

  if (scores.length < 2) {
    return 0;  // Need 2+ platforms
  }

  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  if (maxScore === 0) {
    return 0;
  }

  // Ratio: 1.0 = perfectly consistent, 0.0 = one platform is trash
  const ratio = minScore / maxScore;

  // Scale to 0-1000
  return Math.round(ratio * 1000);
}

/**
 * Calculate platform-specific composite scores
 * Used for S6 cross-platform consistency
 */
export function calculatePlatformComposite(
  predictions: Prediction[],
  platform: 'polymarket' | 'metaculus' | 'kalshi' | 'manifold'
): number | null {
  const platformPredictions = predictions.filter(p => p.platform === platform);

  if (platformPredictions.length < 10) {
    return null;  // Need minimum sample size
  }

  // For now, use simple Brier-based score
  // In Phase 4, this will use full S1-S6 calculation per platform
  const resolved = platformPredictions.filter(p => p.outcome !== undefined);

  if (resolved.length === 0) {
    return null;
  }

  const brierScores = resolved.map(p => {
    const forecast = p.entryPrice ?? p.predictedProbability;
    const outcome = p.outcome ? 1.0 : 0.0;
    return Math.pow(forecast - outcome, 2);
  });

  const avgBrier = brierScores.reduce((sum, b) => sum + b, 0) / brierScores.length;

  // Simple score: 1000 * (1 - avgBrier)
  return Math.round(1000 * (1 - avgBrier));
}
