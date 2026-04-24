/**
 * Main calculator orchestrator
 * Calculates complete ForecasterScore from raw prediction data
 */

import { Prediction, ForecasterIdentity, ForecasterScore, ComponentScores, PlatformStats } from '../types';
import { calculateS1 } from './s1-calibrated-brier';
import {
  calculateS2,
  calculateS3,
  calculateS4,
  calculateS5,
  calculateS6,
  calculatePlatformComposite,
} from './component-scores';
import { calculateForecasterScore as buildForecasterScore } from './composite';
import { calculateAntiGamingSignals } from './anti-gaming';

/**
 * Main entry point: calculate complete forecaster score from predictions
 */
export async function calculateCompleteScore(
  forecasterId: string,
  identity: ForecasterIdentity,
  predictions: Prediction[]
): Promise<ForecasterScore> {
  // Calculate platform statistics
  const platformStats: PlatformStats = {
    polymarketResolvedTrades: predictions.filter(p =>
      p.platform === 'polymarket' && p.outcome !== undefined
    ).length,
    metaculusResolvedQuestions: predictions.filter(p =>
      p.platform === 'metaculus' && p.outcome !== undefined
    ).length,
    kalshiResolvedTrades: predictions.filter(p =>
      p.platform === 'kalshi' && p.outcome !== undefined
    ).length,
    manifoldResolvedQuestions: predictions.filter(p =>
      p.platform === 'manifold' && p.outcome !== undefined
    ).length,

    // Calculate platform-specific composite scores (for S6)
    polymarketComposite: calculatePlatformComposite(predictions, 'polymarket'),
    metaculusComposite: calculatePlatformComposite(predictions, 'metaculus'),
    kalshiComposite: calculatePlatformComposite(predictions, 'kalshi'),
    manifoldComposite: calculatePlatformComposite(predictions, 'manifold'),
  };

  // Calculate component scores
  const s1Result = calculateS1(predictions);
  const s2 = calculateS2(predictions);
  const s3Result = calculateS3(predictions);
  const s4 = calculateS4(predictions);
  const s5 = calculateS5(predictions);
  const s6 = calculateS6(platformStats);

  const components: ComponentScores = {
    s1TradeImplied: s1Result.tradeImplied,
    s1CalibrationBinned: s1Result.calibrationBinned,
    s1Composite: s1Result.composite,
    s2Resolution: s2,
    s3EconomicEdge: s3Result.economicEdge,
    s3InformationalEdge: s3Result.informationalEdge,
    s3Composite: s3Result.composite,
    s4DifficultyWeighted: s4,
    s5VolumeConsistency: s5,
    s6CrossPlatform: s6,
  };

  // Calculate anti-gaming signals
  const antiGaming = calculateAntiGamingSignals(predictions);

  // Build final forecaster score
  const score = buildForecasterScore(
    forecasterId,
    identity,
    predictions,
    components,
    platformStats,
    antiGaming
  );

  return score;
}

// Re-export all calculators for direct use
export * from './s1-calibrated-brier';
export * from './component-scores';
export * from './composite';
export * from './anti-gaming';
