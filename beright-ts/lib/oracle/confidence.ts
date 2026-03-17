/**
 * BeRight Oracle: Confidence Scoring
 *
 * The confidence score is what makes this oracle valuable.
 * It answers: "How much should I trust this probability?"
 *
 * High confidence = multiple platforms agree, high volume, fresh data
 * Low confidence = single source, thin liquidity, stale data
 *
 * This is a PURE function module—no side effects, easy to test.
 */

import type { UnifiedMarket, PlatformMarketData } from '../dataFabric/types';
import type {
  ConfidenceBreakdown,
  ConfidenceLevel,
  OracleConfig,
  DEFAULT_ORACLE_CONFIG,
} from './types';

// ============================================================================
// Component Scorers (0-1 scale)
// ============================================================================

/**
 * Score based on 24h trading volume
 *
 * Higher volume = more people putting money where their mouth is
 */
export function scoreVolume(
  volume24h: number,
  thresholds: OracleConfig['volumeThresholds']
): number {
  if (volume24h >= thresholds.high) return 1.0;
  if (volume24h >= thresholds.medium) {
    // Linear interpolation between medium and high
    return 0.6 + 0.4 * ((volume24h - thresholds.medium) / (thresholds.high - thresholds.medium));
  }
  if (volume24h >= thresholds.low) {
    // Linear interpolation between low and medium
    return 0.3 + 0.3 * ((volume24h - thresholds.low) / (thresholds.medium - thresholds.low));
  }
  // Below low threshold
  return Math.max(0.1, 0.3 * (volume24h / thresholds.low));
}

/**
 * Score based on available liquidity
 *
 * Higher liquidity = harder to manipulate, better price discovery
 */
export function scoreLiquidity(
  liquidity: number,
  thresholds: OracleConfig['liquidityThresholds']
): number {
  if (liquidity >= thresholds.high) return 1.0;
  if (liquidity >= thresholds.medium) {
    return 0.6 + 0.4 * ((liquidity - thresholds.medium) / (thresholds.high - thresholds.medium));
  }
  if (liquidity >= thresholds.low) {
    return 0.3 + 0.3 * ((liquidity - thresholds.low) / (thresholds.medium - thresholds.low));
  }
  return Math.max(0.1, 0.3 * (liquidity / thresholds.low));
}

/**
 * Score based on number of platforms
 *
 * Multiple platforms agreeing = more reliable signal
 */
export function scorePlatforms(
  platformCount: number,
  thresholds: OracleConfig['platformThresholds']
): number {
  if (platformCount >= thresholds.high) return 1.0;
  if (platformCount >= thresholds.medium) return 0.7;
  if (platformCount === 1) return 0.4;
  return 0.2; // No platforms (shouldn't happen)
}

/**
 * Score based on price spread across platforms
 *
 * Low spread = platforms agree on probability
 * High spread = disagreement or manipulation risk
 */
export function scoreSpread(
  spread: number,
  thresholds: OracleConfig['spreadThresholds']
): number {
  if (spread <= thresholds.high) return 1.0;
  if (spread <= thresholds.medium) {
    // Inverse linear: lower spread = higher score
    return 0.6 + 0.4 * ((thresholds.medium - spread) / (thresholds.medium - thresholds.high));
  }
  // High spread = low confidence
  const excessSpread = spread - thresholds.medium;
  return Math.max(0.1, 0.6 - excessSpread * 2);
}

/**
 * Score based on data freshness
 *
 * Fresh data = more relevant
 * Stale data = might be outdated
 */
export function scoreFreshness(
  stalenessSeconds: number,
  thresholds: OracleConfig['stalenessThresholds']
): number {
  if (stalenessSeconds <= thresholds.fresh) return 1.0;
  if (stalenessSeconds <= thresholds.stale) {
    // Linear decay
    return 0.5 + 0.5 * ((thresholds.stale - stalenessSeconds) / (thresholds.stale - thresholds.fresh));
  }
  // Very stale
  return Math.max(0, 0.5 - (stalenessSeconds - thresholds.stale) / 600);
}

// ============================================================================
// Composite Confidence
// ============================================================================

/**
 * Default weights for confidence components
 *
 * Volume and liquidity weighted highest—they're hardest to fake.
 */
const DEFAULT_WEIGHTS = {
  volume: 0.30,
  liquidity: 0.25,
  platforms: 0.20,
  spread: 0.15,
  freshness: 0.10,
};

/**
 * Calculate full confidence breakdown
 */
export function calculateConfidence(
  market: UnifiedMarket,
  config: OracleConfig,
  weights = DEFAULT_WEIGHTS
): ConfidenceBreakdown {
  const warnings: string[] = [];

  // Calculate staleness
  const stalenessSeconds = (Date.now() - market.lastUpdate.getTime()) / 1000;
  const isStale = stalenessSeconds > config.stalenessThresholds.stale;

  if (isStale) {
    warnings.push(`Data is stale (${Math.round(stalenessSeconds)}s old)`);
  }

  // Calculate spread
  const spread = market.priceRange.max - market.priceRange.min;
  if (spread > config.spreadThresholds.medium) {
    warnings.push(`High price spread (${(spread * 100).toFixed(1)}%)`);
  }

  // Score each component
  const volumeScore = scoreVolume(market.totalVolume24h, config.volumeThresholds);
  const liquidityScore = scoreLiquidity(market.totalLiquidity, config.liquidityThresholds);
  const platformScore = scorePlatforms(market.platformCount, config.platformThresholds);
  const spreadScore = scoreSpread(spread, config.spreadThresholds);
  const freshnessScore = scoreFreshness(stalenessSeconds, config.stalenessThresholds);

  // Add warnings for low component scores
  if (volumeScore < 0.4) {
    warnings.push(`Low volume ($${market.totalVolume24h.toLocaleString()})`);
  }
  if (liquidityScore < 0.4) {
    warnings.push(`Low liquidity ($${market.totalLiquidity.toLocaleString()})`);
  }
  if (platformScore < 0.5) {
    warnings.push(`Single platform source`);
  }

  // Calculate composite score
  const compositeScore =
    volumeScore * weights.volume +
    liquidityScore * weights.liquidity +
    platformScore * weights.platforms +
    spreadScore * weights.spread +
    freshnessScore * weights.freshness;

  // Determine confidence level
  const level = getConfidenceLevel(compositeScore, isStale);

  return {
    volumeScore,
    liquidityScore,
    platformScore,
    spreadScore,
    freshnessScore,
    weights,
    compositeScore,
    level,
    warnings,
  };
}

/**
 * Map composite score to confidence level
 */
export function getConfidenceLevel(
  score: number,
  isStale: boolean
): ConfidenceLevel {
  // Stale data is never high confidence
  if (isStale) {
    return score > 0.5 ? 'low' : 'unreliable';
  }

  if (score >= 0.75) return 'high';
  if (score >= 0.5) return 'medium';
  if (score >= 0.25) return 'low';
  return 'unreliable';
}

/**
 * Quick confidence check (without full breakdown)
 *
 * Use this for filtering large sets of markets.
 */
export function quickConfidenceScore(
  market: UnifiedMarket,
  config: OracleConfig
): number {
  // Simplified scoring for performance
  const stalenessSeconds = (Date.now() - market.lastUpdate.getTime()) / 1000;

  if (stalenessSeconds > config.stalenessThresholds.stale) {
    return 0.1; // Stale = very low confidence
  }

  // Quick heuristic based on volume and platforms
  let score = 0.3; // Base score

  // Volume bonus (up to +0.35)
  if (market.totalVolume24h >= config.volumeThresholds.high) {
    score += 0.35;
  } else if (market.totalVolume24h >= config.volumeThresholds.medium) {
    score += 0.20;
  } else if (market.totalVolume24h >= config.volumeThresholds.low) {
    score += 0.10;
  }

  // Platform bonus (up to +0.25)
  if (market.platformCount >= 3) {
    score += 0.25;
  } else if (market.platformCount >= 2) {
    score += 0.15;
  }

  // Liquidity bonus (up to +0.10)
  if (market.totalLiquidity >= config.liquidityThresholds.medium) {
    score += 0.10;
  }

  return Math.min(1.0, score);
}

// ============================================================================
// Manipulation Detection
// ============================================================================

/**
 * Detect potential manipulation signals
 *
 * Returns warnings if market shows manipulation risk.
 */
export function detectManipulationRisk(
  market: UnifiedMarket,
  config: OracleConfig
): string[] {
  const risks: string[] = [];

  // High spread with low liquidity = easy to manipulate
  const spread = market.priceRange.max - market.priceRange.min;
  if (spread > 0.10 && market.totalLiquidity < config.liquidityThresholds.medium) {
    risks.push('High spread with low liquidity - manipulation risk');
  }

  // Single platform with low volume = easy to move
  if (market.platformCount === 1 && market.totalVolume24h < config.volumeThresholds.medium) {
    risks.push('Single source with low volume - unverified');
  }

  // Price at extreme (>95% or <5%) with low liquidity
  if (
    (market.consensusPrice > 0.95 || market.consensusPrice < 0.05) &&
    market.totalLiquidity < config.liquidityThresholds.high
  ) {
    risks.push('Extreme probability with insufficient liquidity');
  }

  // Arbitrage opportunity suggests price disagreement
  if (market.arbitrageSpread && market.arbitrageSpread > 0.05) {
    risks.push(`Platform disagreement (${(market.arbitrageSpread * 100).toFixed(1)}% arb)`);
  }

  return risks;
}
