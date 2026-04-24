/**
 * Anti-Gaming Detection
 *
 * Detects suspicious patterns:
 * 1. Market Maker / Arbitrageur wallets
 * 2. Late-entry gaming (sniping resolved markets)
 * 3. Easy-question farming
 */

import { Prediction, AntiGamingSignals, AntiGamingFlag } from '../types';
import { differenceInMilliseconds } from 'date-fns';

/**
 * Calculate all anti-gaming signals for a forecaster
 */
export function calculateAntiGamingSignals(predictions: Prediction[]): AntiGamingSignals {
  const mmArbRatio = calculateMMArbRatio(predictions);
  const lateEntryRatio = calculateLateEntryRatio(predictions);
  const questionDifficultyAvg = calculateAvgDifficulty(predictions);

  const flags: AntiGamingFlag[] = [];

  // Flag: Market Maker / Arbitrageur
  if (mmArbRatio > 0.7 && predictions.length > 20) {
    flags.push('LIKELY_MM_WALLET');
  }

  // Flag: Late Entry Gamer
  if (lateEntryRatio > 0.5) {
    flags.push('LATE_ENTRY_GAMER');
  }

  // Flag: Easy Question Farmer
  if (questionDifficultyAvg < 0.2 && predictions.length > 100) {
    flags.push('EASY_QUESTION_FARMER');
  }

  return {
    mmArbRatio,
    lateEntryRatio,
    questionDifficultyAvg,
    flags,
  };
}

/**
 * Calculate MM/Arb ratio
 * % of trades at extreme prices (<0.2 or >0.8)
 *
 * MMs and arb bots trade at extremes to capture spread or arbitrage cross-platform
 */
function calculateMMArbRatio(predictions: Prediction[]): number {
  const clobPredictions = predictions.filter(p =>
    (p.platform === 'polymarket' || p.platform === 'kalshi') && p.entryPrice !== undefined
  );

  if (clobPredictions.length === 0) {
    return 0;
  }

  const extremeTrades = clobPredictions.filter(p => {
    const price = p.entryPrice!;
    return price < 0.2 || price > 0.8;
  }).length;

  return extremeTrades / clobPredictions.length;
}

/**
 * Calculate late-entry ratio
 * % of predictions made in last 10% of market duration
 *
 * Late-entry gamers wait until outcome is nearly certain
 */
function calculateLateEntryRatio(predictions: Prediction[]): number {
  const predictionsWithTiming = predictions.filter(p =>
    p.marketOpenTime && p.marketCloseTime && p.predictedAt
  );

  if (predictionsWithTiming.length === 0) {
    return 0;
  }

  const latePredictions = predictionsWithTiming.filter(p => {
    const marketDuration = differenceInMilliseconds(
      p.marketCloseTime!,
      p.marketOpenTime!
    );
    const timeUntilClose = differenceInMilliseconds(
      p.marketCloseTime!,
      p.predictedAt
    );

    // Late = predicted in last 10% of duration
    return timeUntilClose < 0.1 * marketDuration;
  }).length;

  return latePredictions / predictionsWithTiming.length;
}

/**
 * Calculate average question difficulty
 * Difficulty = community spread (stddev of community predictions)
 *
 * Low average difficulty suggests cherry-picking easy questions
 */
function calculateAvgDifficulty(predictions: Prediction[]): number {
  const predictionsWithDifficulty = predictions.filter(p => p.difficulty !== undefined);

  if (predictionsWithDifficulty.length === 0) {
    return 0.5;  // Neutral default
  }

  const totalDifficulty = predictionsWithDifficulty.reduce(
    (sum, p) => sum + p.difficulty!,
    0
  );

  return totalDifficulty / predictionsWithDifficulty.length;
}

/**
 * Check if forecaster has any anti-gaming flags
 */
export function hasAntiGamingFlags(signals: AntiGamingSignals): boolean {
  return signals.flags.length > 0;
}

/**
 * Get anti-gaming flag descriptions (for UI display)
 */
export function getAntiGamingFlagDescriptions(flags: AntiGamingFlag[]): string[] {
  const descriptions: Record<AntiGamingFlag, string> = {
    LIKELY_MM_WALLET:
      'Likely market maker or arbitrageur (>70% trades at extreme prices)',
    LATE_ENTRY_GAMER:
      'Late-entry gamer (>50% predictions in last 10% of market duration)',
    EASY_QUESTION_FARMER:
      'Easy question farmer (avg difficulty <0.2, >100 questions)',
  };

  return flags.map(flag => descriptions[flag]);
}

/**
 * Calculate anti-gaming penalty (optional feature for Phase 4)
 *
 * Penalize final score based on severity of gaming signals
 */
export function calculateAntiGamingPenalty(signals: AntiGamingSignals): number {
  let penalty = 0;

  // MM/Arb penalty: -50 points per 10% over threshold
  if (signals.mmArbRatio > 0.7) {
    penalty += Math.round((signals.mmArbRatio - 0.7) * 500);
  }

  // Late-entry penalty: -30 points per 10% over threshold
  if (signals.lateEntryRatio > 0.5) {
    penalty += Math.round((signals.lateEntryRatio - 0.5) * 300);
  }

  // Easy-question penalty: -20 points per 0.05 below threshold
  if (signals.questionDifficultyAvg < 0.2) {
    penalty += Math.round((0.2 - signals.questionDifficultyAvg) * 400);
  }

  // Cap penalty at -200 points (don't completely destroy score)
  return Math.min(200, penalty);
}
