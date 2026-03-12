/**
 * BeRight Scoring Engine
 *
 * Advanced scoring metrics for forecaster reputation:
 * - Brier Score (standard)
 * - Volume-Weighted Brier (big bets count more)
 * - Sharpe Ratio (risk-adjusted returns)
 * - Kelly Compliance (position sizing discipline)
 * - Skill Rating (Elo-style composite)
 * - Composite Score (weighted blend for ranking)
 *
 * @author BeRight Protocol
 */

// =============================================================================
// TYPES
// =============================================================================

export interface ResolvedPrediction {
  id: string;
  probability: number;      // 0-1, forecasted probability of YES
  direction: 'YES' | 'NO';
  outcome: boolean;         // true = YES won
  stakeUsd: number;         // Amount wagered (0 if paper trade)
  entryPrice: number;       // Price paid per contract (0-1)
  exitPrice: number;        // Resolution price (0 or 1)
  pnlUsd: number;           // Profit/loss in USD
  resolvedAt: Date;
  domain: string;
}

export interface ScoringResult {
  // Standard Brier
  brierScore: number;                   // 0-1, lower = better
  brierScorePercentile: number;         // 0-100, higher = better

  // Volume-Weighted Brier
  volumeWeightedBrier: number;          // 0-1, lower = better
  totalVolume: number;                  // Total USD wagered

  // Accuracy
  accuracy: number;                     // 0-1, % correct direction
  correctPredictions: number;
  totalPredictions: number;

  // Risk-Adjusted
  roi: number;                          // Total return on investment
  sharpeRatio: number;                  // Risk-adjusted returns
  maxDrawdown: number;                  // Worst peak-to-trough

  // Discipline
  kellyCompliance: number;              // 0-1, how well they size positions
  avgKellyDeviation: number;            // Average deviation from optimal

  // Composite
  skillRating: number;                  // Elo-style rating (baseline 1000)
  compositeScore: number;               // 0-10000 (higher = better)
  percentile: number;                   // 0-100 global percentile
}

export interface ScoringWeights {
  brierOverall: number;
  volumeWeightedBrier: number;
  roi: number;
  sharpeRatio: number;
  kellyCompliance: number;
  predictionCount: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default scoring weights for composite score
 * Total should equal 1.0
 */
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  brierOverall: 0.25,           // Primary accuracy measure
  volumeWeightedBrier: 0.20,    // Conviction-adjusted accuracy
  roi: 0.20,                    // Profit generation
  sharpeRatio: 0.15,            // Risk-adjusted returns
  kellyCompliance: 0.10,        // Position sizing discipline
  predictionCount: 0.10,        // Activity (min threshold)
};

/**
 * Skill rating constants (Elo-style)
 */
const SKILL_RATING = {
  BASELINE: 1000,
  K_FACTOR: 32,                 // How much a single prediction moves rating
  MIN_RATING: 100,
  MAX_RATING: 3000,
};

/**
 * Pool eligibility thresholds
 */
export const POOL_ELIGIBILITY = {
  MIN_PREDICTIONS: 20,
  MIN_RESOLVED: 10,
  MAX_BRIER: 0.35,              // Must be below this
  MIN_PERCENTILE: 90,           // Top 10%
  MIN_COMPOSITE_SCORE: 6000,    // Out of 10000
  MIN_ACCOUNT_AGE_DAYS: 7,
};

// =============================================================================
// BRIER SCORE CALCULATIONS
// =============================================================================

/**
 * Calculate standard Brier score for a single prediction
 * Formula: (forecast - actual)²
 * Range: 0 (perfect) to 1 (maximally wrong)
 */
export function calculateBrierScore(
  probability: number,
  direction: 'YES' | 'NO',
  outcome: boolean
): number {
  // Convert to probability of YES
  const forecastYes = direction === 'YES' ? probability : 1 - probability;
  const actual = outcome ? 1 : 0;
  return Math.pow(forecastYes - actual, 2);
}

/**
 * Calculate average Brier score across predictions
 */
export function calculateAverageBrier(predictions: ResolvedPrediction[]): number {
  if (predictions.length === 0) return 0.5;

  const total = predictions.reduce((sum, p) => {
    return sum + calculateBrierScore(p.probability, p.direction, p.outcome);
  }, 0);

  return total / predictions.length;
}

/**
 * Calculate Volume-Weighted Brier score
 * Formula: Σ(stake_i × brier_i) / Σ(stake_i)
 *
 * This rewards conviction - predictions with larger stakes
 * count more toward the score.
 */
export function calculateVolumeWeightedBrier(predictions: ResolvedPrediction[]): {
  score: number;
  totalVolume: number;
} {
  const withStake = predictions.filter(p => p.stakeUsd > 0);

  if (withStake.length === 0) {
    // Fall back to equal-weighted if no stakes
    return {
      score: calculateAverageBrier(predictions),
      totalVolume: 0,
    };
  }

  const totalVolume = withStake.reduce((sum, p) => sum + p.stakeUsd, 0);

  const weightedSum = withStake.reduce((sum, p) => {
    const brier = calculateBrierScore(p.probability, p.direction, p.outcome);
    return sum + (p.stakeUsd * brier);
  }, 0);

  return {
    score: weightedSum / totalVolume,
    totalVolume,
  };
}

/**
 * Calculate Brier score percentile (0-100, higher = better)
 * Based on typical distribution of forecaster scores
 */
export function brierToPercentile(brier: number): number {
  // Empirical mapping based on superforecaster benchmarks
  if (brier <= 0.05) return 99;
  if (brier <= 0.08) return 95;
  if (brier <= 0.12) return 90;
  if (brier <= 0.15) return 85;
  if (brier <= 0.18) return 80;
  if (brier <= 0.20) return 75;
  if (brier <= 0.22) return 70;
  if (brier <= 0.25) return 60;
  if (brier <= 0.30) return 50;
  if (brier <= 0.35) return 40;
  if (brier <= 0.40) return 30;
  if (brier <= 0.50) return 20;
  return Math.max(0, 10 - (brier - 0.50) * 20);
}

// =============================================================================
// ACCURACY & DIRECTION
// =============================================================================

/**
 * Calculate directional accuracy (% of correct YES/NO calls)
 */
export function calculateAccuracy(predictions: ResolvedPrediction[]): {
  accuracy: number;
  correct: number;
  total: number;
} {
  if (predictions.length === 0) {
    return { accuracy: 0.5, correct: 0, total: 0 };
  }

  let correct = 0;
  for (const p of predictions) {
    const predictedYes = p.direction === 'YES';
    const actualYes = p.outcome;
    if (predictedYes === actualYes) correct++;
  }

  return {
    accuracy: correct / predictions.length,
    correct,
    total: predictions.length,
  };
}

// =============================================================================
// RISK-ADJUSTED RETURNS
// =============================================================================

/**
 * Calculate Return on Investment (ROI)
 * Formula: (total_profit - total_staked) / total_staked
 */
export function calculateROI(predictions: ResolvedPrediction[]): number {
  const withStake = predictions.filter(p => p.stakeUsd > 0);
  if (withStake.length === 0) return 0;

  const totalStaked = withStake.reduce((sum, p) => sum + p.stakeUsd, 0);
  const totalPnL = withStake.reduce((sum, p) => sum + p.pnlUsd, 0);

  if (totalStaked === 0) return 0;
  return totalPnL / totalStaked;
}

/**
 * Calculate Sharpe Ratio
 * Formula: (avg_return - risk_free_rate) / std_deviation
 *
 * For prediction markets, we use:
 * - avg_return = average per-prediction ROI
 * - risk_free_rate = 0 (opportunity cost of not predicting)
 * - std_deviation = standard deviation of returns
 */
export function calculateSharpeRatio(predictions: ResolvedPrediction[]): number {
  const withStake = predictions.filter(p => p.stakeUsd > 0);
  if (withStake.length < 2) return 0;

  // Calculate per-prediction returns
  const returns = withStake.map(p => {
    if (p.stakeUsd === 0) return 0;
    return p.pnlUsd / p.stakeUsd;
  });

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Standard deviation
  const squaredDiffs = returns.map(r => Math.pow(r - avgReturn, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return avgReturn > 0 ? 3 : avgReturn < 0 ? -3 : 0;

  // Annualized (assuming ~50 predictions/year equivalent)
  const sharpe = (avgReturn / stdDev) * Math.sqrt(50);

  // Clamp to reasonable range
  return Math.max(-5, Math.min(5, sharpe));
}

/**
 * Calculate maximum drawdown
 * The worst peak-to-trough decline in cumulative P&L
 */
export function calculateMaxDrawdown(predictions: ResolvedPrediction[]): number {
  if (predictions.length === 0) return 0;

  // Sort by resolution date
  const sorted = [...predictions].sort(
    (a, b) => a.resolvedAt.getTime() - b.resolvedAt.getTime()
  );

  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const p of sorted) {
    cumulative += p.pnlUsd;
    if (cumulative > peak) {
      peak = cumulative;
    }
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  // Return as percentage of peak (or 0 if no peak)
  return peak > 0 ? maxDrawdown / peak : 0;
}

// =============================================================================
// KELLY CRITERION COMPLIANCE
// =============================================================================

/**
 * Calculate optimal Kelly bet size
 * Formula: f* = (p × b - q) / b
 * Where:
 *   p = probability of winning
 *   q = 1 - p (probability of losing)
 *   b = odds (net return if win)
 *
 * For binary prediction markets at price `price`:
 *   Win returns (1 - price) per contract
 *   Lose returns -price per contract
 */
export function calculateKellyFraction(
  probability: number,
  entryPrice: number
): number {
  // probability = forecaster's belief that YES wins
  // entryPrice = cost to buy YES (0-1)

  // Expected edge
  const p = probability;
  const q = 1 - p;

  // Odds: if YES wins, you get (1 - entryPrice) profit on entryPrice investment
  const b = (1 - entryPrice) / entryPrice;

  // Kelly formula
  const kelly = (p * b - q) / b;

  // Clamp to 0-1 range (can't bet negative or more than 100%)
  return Math.max(0, Math.min(1, kelly));
}

/**
 * Calculate Kelly Compliance score
 * Measures how well the forecaster sizes positions relative to optimal
 *
 * Score = 1 - avg(|actual_fraction - kelly_fraction|)
 */
export function calculateKellyCompliance(
  predictions: ResolvedPrediction[],
  bankroll: number
): {
  compliance: number;
  avgDeviation: number;
} {
  const withStake = predictions.filter(p => p.stakeUsd > 0 && p.entryPrice > 0);
  if (withStake.length === 0 || bankroll <= 0) {
    return { compliance: 0.5, avgDeviation: 0.5 };
  }

  let totalDeviation = 0;

  for (const p of withStake) {
    // Actual bet fraction
    const actualFraction = p.stakeUsd / bankroll;

    // Optimal Kelly fraction
    const kellyFraction = calculateKellyFraction(p.probability, p.entryPrice);

    // Deviation (capped at 1)
    const deviation = Math.min(1, Math.abs(actualFraction - kellyFraction));
    totalDeviation += deviation;
  }

  const avgDeviation = totalDeviation / withStake.length;
  const compliance = 1 - avgDeviation;

  return { compliance, avgDeviation };
}

// =============================================================================
// SKILL RATING (ELO-STYLE)
// =============================================================================

/**
 * Calculate expected outcome based on skill difference
 * Standard Elo formula
 */
function expectedOutcome(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Update skill rating after a prediction resolves
 *
 * We treat each prediction as a "game" against the market:
 * - Win: Your prediction was correct
 * - Loss: Your prediction was wrong
 *
 * The "opponent" rating is derived from market difficulty
 * (based on how far the market price was from 50%)
 */
export function updateSkillRating(
  currentRating: number,
  prediction: ResolvedPrediction
): number {
  // Was the prediction correct?
  const predictedYes = prediction.direction === 'YES';
  const actualYes = prediction.outcome;
  const correct = predictedYes === actualYes;

  // Market difficulty: markets near 50% are harder to predict
  // Convert entry price to implied probability
  const impliedProb = prediction.entryPrice;
  const uncertainty = 4 * impliedProb * (1 - impliedProb); // 0-1, max at 50%

  // Opponent rating based on difficulty (harder = higher rating)
  // Base opponent is 1000, modified by uncertainty
  const opponentRating = 800 + (uncertainty * 400);

  // Expected outcome
  const expected = expectedOutcome(currentRating, opponentRating);

  // Actual outcome (1 for win, 0 for loss)
  const actual = correct ? 1 : 0;

  // K-factor adjusted by confidence
  // High-confidence wrong predictions hurt more
  const confidenceFactor = Math.abs(prediction.probability - 0.5) * 2;
  const adjustedK = SKILL_RATING.K_FACTOR * (1 + confidenceFactor * 0.5);

  // New rating
  const newRating = currentRating + adjustedK * (actual - expected);

  // Clamp to valid range
  return Math.max(
    SKILL_RATING.MIN_RATING,
    Math.min(SKILL_RATING.MAX_RATING, newRating)
  );
}

/**
 * Calculate skill rating from prediction history
 */
export function calculateSkillRating(predictions: ResolvedPrediction[]): number {
  if (predictions.length === 0) return SKILL_RATING.BASELINE;

  // Sort by resolution date
  const sorted = [...predictions].sort(
    (a, b) => a.resolvedAt.getTime() - b.resolvedAt.getTime()
  );

  let rating = SKILL_RATING.BASELINE;
  for (const p of sorted) {
    rating = updateSkillRating(rating, p);
  }

  return Math.round(rating);
}

// =============================================================================
// COMPOSITE SCORE
// =============================================================================

/**
 * Normalize a value to 0-1 range
 */
function normalize(value: number, min: number, max: number, invert = false): number {
  const clamped = Math.max(min, Math.min(max, value));
  const normalized = (clamped - min) / (max - min);
  return invert ? 1 - normalized : normalized;
}

/**
 * Calculate composite score (0-10000, higher = better)
 *
 * Weighted blend of all metrics optimized for ranking forecasters
 */
export function calculateCompositeScore(
  predictions: ResolvedPrediction[],
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
  bankroll: number = 10000 // Default bankroll for Kelly calculation
): number {
  if (predictions.length === 0) return 0;

  // Calculate all metrics
  const brier = calculateAverageBrier(predictions);
  const { score: vwBrier } = calculateVolumeWeightedBrier(predictions);
  const roi = calculateROI(predictions);
  const sharpe = calculateSharpeRatio(predictions);
  const { compliance: kelly } = calculateKellyCompliance(predictions, bankroll);
  const count = predictions.length;

  // Normalize each component to 0-1 (higher = better)
  const components = {
    brier: normalize(brier, 0, 0.5, true),           // 0.5 = worst, 0 = best
    vwBrier: normalize(vwBrier, 0, 0.5, true),       // same
    roi: normalize(roi, -1, 2, false),               // -100% to +200%
    sharpe: normalize(sharpe, -2, 3, false),         // -2 to +3
    kelly: kelly,                                     // already 0-1
    count: normalize(count, 0, 100, false),          // 0-100 predictions
  };

  // Calculate weighted sum
  const score =
    components.brier * weights.brierOverall +
    components.vwBrier * weights.volumeWeightedBrier +
    components.roi * weights.roi +
    components.sharpe * weights.sharpeRatio +
    components.kelly * weights.kellyCompliance +
    components.count * weights.predictionCount;

  // Scale to 0-10000
  return Math.round(score * 10000);
}

// =============================================================================
// FULL SCORING RESULT
// =============================================================================

/**
 * Calculate all scoring metrics for a forecaster
 */
export function calculateFullScoring(
  predictions: ResolvedPrediction[],
  bankroll: number = 10000
): ScoringResult {
  const brier = calculateAverageBrier(predictions);
  const { score: vwBrier, totalVolume } = calculateVolumeWeightedBrier(predictions);
  const { accuracy, correct, total } = calculateAccuracy(predictions);
  const roi = calculateROI(predictions);
  const sharpe = calculateSharpeRatio(predictions);
  const maxDrawdown = calculateMaxDrawdown(predictions);
  const { compliance: kelly, avgDeviation: kellyDev } = calculateKellyCompliance(predictions, bankroll);
  const skill = calculateSkillRating(predictions);
  const composite = calculateCompositeScore(predictions, DEFAULT_SCORING_WEIGHTS, bankroll);
  const percentile = brierToPercentile(brier);

  return {
    brierScore: brier,
    brierScorePercentile: percentile,
    volumeWeightedBrier: vwBrier,
    totalVolume,
    accuracy,
    correctPredictions: correct,
    totalPredictions: total,
    roi,
    sharpeRatio: sharpe,
    maxDrawdown,
    kellyCompliance: kelly,
    avgKellyDeviation: kellyDev,
    skillRating: skill,
    compositeScore: composite,
    percentile,
  };
}

// =============================================================================
// POOL ELIGIBILITY
// =============================================================================

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  unlocksAt?: Date;
  requirements: {
    predictions: { current: number; required: number; met: boolean };
    resolved: { current: number; required: number; met: boolean };
    brier: { current: number; required: number; met: boolean };
    percentile: { current: number; required: number; met: boolean };
    composite: { current: number; required: number; met: boolean };
    accountAge: { current: number; required: number; met: boolean };
  };
}

/**
 * Check if a forecaster is eligible to create pools
 */
export function checkPoolEligibility(
  predictions: ResolvedPrediction[],
  accountCreatedAt: Date,
  allForecasterScores?: { compositeScore: number }[]
): EligibilityResult {
  const scoring = calculateFullScoring(predictions);
  const accountAgeDays = Math.floor(
    (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Calculate percentile if we have all forecaster scores
  let percentile = scoring.percentile;
  if (allForecasterScores && allForecasterScores.length > 0) {
    const betterCount = allForecasterScores.filter(
      f => f.compositeScore > scoring.compositeScore
    ).length;
    percentile = 100 - (betterCount / allForecasterScores.length) * 100;
  }

  const requirements = {
    predictions: {
      current: predictions.length,
      required: POOL_ELIGIBILITY.MIN_PREDICTIONS,
      met: predictions.length >= POOL_ELIGIBILITY.MIN_PREDICTIONS,
    },
    resolved: {
      current: scoring.totalPredictions,
      required: POOL_ELIGIBILITY.MIN_RESOLVED,
      met: scoring.totalPredictions >= POOL_ELIGIBILITY.MIN_RESOLVED,
    },
    brier: {
      current: scoring.brierScore,
      required: POOL_ELIGIBILITY.MAX_BRIER,
      met: scoring.brierScore <= POOL_ELIGIBILITY.MAX_BRIER,
    },
    percentile: {
      current: percentile,
      required: POOL_ELIGIBILITY.MIN_PERCENTILE,
      met: percentile >= POOL_ELIGIBILITY.MIN_PERCENTILE,
    },
    composite: {
      current: scoring.compositeScore,
      required: POOL_ELIGIBILITY.MIN_COMPOSITE_SCORE,
      met: scoring.compositeScore >= POOL_ELIGIBILITY.MIN_COMPOSITE_SCORE,
    },
    accountAge: {
      current: accountAgeDays,
      required: POOL_ELIGIBILITY.MIN_ACCOUNT_AGE_DAYS,
      met: accountAgeDays >= POOL_ELIGIBILITY.MIN_ACCOUNT_AGE_DAYS,
    },
  };

  const reasons: string[] = [];
  if (!requirements.predictions.met) {
    reasons.push(
      `Need ${POOL_ELIGIBILITY.MIN_PREDICTIONS - predictions.length} more predictions`
    );
  }
  if (!requirements.resolved.met) {
    reasons.push(
      `Need ${POOL_ELIGIBILITY.MIN_RESOLVED - scoring.totalPredictions} more resolved predictions`
    );
  }
  if (!requirements.brier.met) {
    reasons.push(
      `Brier score too high (${scoring.brierScore.toFixed(3)} > ${POOL_ELIGIBILITY.MAX_BRIER})`
    );
  }
  if (!requirements.percentile.met) {
    reasons.push(
      `Need top ${100 - POOL_ELIGIBILITY.MIN_PERCENTILE}% (currently ${percentile.toFixed(0)}th percentile)`
    );
  }
  if (!requirements.composite.met) {
    reasons.push(
      `Composite score too low (${scoring.compositeScore} < ${POOL_ELIGIBILITY.MIN_COMPOSITE_SCORE})`
    );
  }
  if (!requirements.accountAge.met) {
    reasons.push(
      `Account too new (${accountAgeDays} < ${POOL_ELIGIBILITY.MIN_ACCOUNT_AGE_DAYS} days)`
    );
  }

  const eligible = Object.values(requirements).every(r => r.met);

  return {
    eligible,
    reasons,
    requirements,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  SKILL_RATING,
};
