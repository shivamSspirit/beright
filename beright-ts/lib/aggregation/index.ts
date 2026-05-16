/**
 * Probability Aggregation Module
 *
 * Advanced probability aggregation for prediction markets:
 * - LMSR: Logarithmic Market Scoring Rule normalization
 * - Bayesian: Platform-weighted Bayesian aggregation
 * - Frank-Wolfe: Probability simplex projection
 * - Extremized Log-Odds: State-of-the-art aggregation (Satopää et al. 2014)
 *
 * @author BeRight Protocol
 * @version 4.0.0
 */

export * from './lmsr';
export * from './bayesian';
export * from './extremizedLogOdds';

import {
  calculateLMSRProbability,
  aggregateProbabilities as lmsrAggregate,
  volumeWeightedAverage,
  getPlatformAccuracy,
  PLATFORM_CALIBRATION,
  DEFAULT_LMSR_CONFIG,
  type PlatformPriceData,
  type AggregatedProbability,
} from './lmsr';

import {
  bayesianAggregate,
  hierarchicalBayesianAggregate,
  monteCarloDropoutUncertainty,
  extremize,
  DEFAULT_PLATFORM_PRIORS,
  type BayesianInput,
  type BayesianResult,
} from './bayesian';

import {
  extremizedLogOddsAggregate,
  adaptiveExtremizedAggregate,
  calculateExtremizedConsensus,
  calculateEdge,
  DEFAULT_EXTREMIZING_CONFIG,
  type LogOddsInput,
  type ExtremizedResult,
  type EdgeCalculation,
} from './extremizedLogOdds';

// =============================================================================
// UNIFIED AGGREGATION
// =============================================================================

/**
 * Available aggregation methods (extremized_log_odds is recommended)
 */
export type AggregationMethod =
  | 'extremized_log_odds'  // State-of-the-art (Satopää et al. 2014) - RECOMMENDED
  | 'adaptive_extremized'  // Auto-adjusts extremizing factor based on diversity
  | 'lmsr'                 // LMSR normalization
  | 'bayesian'             // Bayesian weighting
  | 'hierarchical'         // Hierarchical Bayesian
  | 'volume_weighted';     // Simple volume-weighted (legacy)

export interface AggregationOptions {
  /** Aggregation method (default: 'extremized_log_odds') */
  method?: AggregationMethod;
  /** Extremizing factor for log-odds methods (default: 1.5) */
  extremizeFactor?: number;
  /** Run Monte Carlo uncertainty check */
  uncertaintyCheck?: boolean;
}

/**
 * Aggregate probabilities with the best method
 *
 * Default is now 'extremized_log_odds' based on Satopää et al. (2014)
 * research showing ~20% Brier score improvement over linear averaging.
 */
export function aggregateProbability(
  platforms: PlatformPriceData[],
  options: AggregationOptions = {}
): AggregatedProbability {
  const {
    method = 'extremized_log_odds', // Changed default to state-of-the-art method
    extremizeFactor = 1.5,
    uncertaintyCheck = false,
  } = options;

  let result: AggregatedProbability;

  switch (method) {
    case 'extremized_log_odds': {
      // State-of-the-art: Extremized Log-Odds Aggregation
      const logOddsInputs: LogOddsInput[] = platforms.map(p => ({
        platform: p.platform,
        probability: p.yesPrice,
        volume: p.volume24h,
        liquidity: p.liquidity,
        calibrationScore: p.calibrationScore,
      }));

      const extremizedResult = extremizedLogOddsAggregate(logOddsInputs, {
        ...DEFAULT_EXTREMIZING_CONFIG,
        extremizingFactor: extremizeFactor,
      });

      result = {
        probability: extremizedResult.probability,
        confidence: extremizedResult.confidence,
        platformProbabilities: extremizedResult.platformContributions.map(c => ({
          platform: c.platform,
          rawPrice: c.probability,
          normalizedProbability: c.probability,
          confidence: c.normalizedWeight,
          adjustmentApplied: extremizedResult.probability - c.probability,
        })),
        method: 'extremized_log_odds' as any,
      };
      break;
    }

    case 'adaptive_extremized': {
      // Adaptive: Auto-adjusts extremizing factor based on source diversity
      const adaptiveInputs: LogOddsInput[] = platforms.map(p => ({
        platform: p.platform,
        probability: p.yesPrice,
        volume: p.volume24h,
        liquidity: p.liquidity,
        calibrationScore: p.calibrationScore,
      }));

      const adaptiveResult = adaptiveExtremizedAggregate(adaptiveInputs);

      result = {
        probability: adaptiveResult.probability,
        confidence: adaptiveResult.confidence,
        platformProbabilities: adaptiveResult.platformContributions.map(c => ({
          platform: c.platform,
          rawPrice: c.probability,
          normalizedProbability: c.probability,
          confidence: c.normalizedWeight,
          adjustmentApplied: adaptiveResult.probability - c.probability,
        })),
        method: 'bayesian', // Compatible with existing type
      };
      break;
    }

    case 'lmsr':
      result = lmsrAggregate(platforms);
      break;

    case 'bayesian':
      const bayesianInputs: BayesianInput[] = platforms.map(p => ({
        platform: p.platform,
        probability: p.yesPrice,
        volume: p.volume24h,
        liquidity: p.liquidity,
      }));
      const bayesianResult = bayesianAggregate(bayesianInputs);
      result = {
        probability: bayesianResult.posterior,
        confidence: bayesianResult.confidence,
        platformProbabilities: platforms.map(p => ({
          platform: p.platform,
          rawPrice: p.yesPrice,
          normalizedProbability: p.yesPrice,
          confidence: getPlatformAccuracy(p.platform),
          adjustmentApplied: 0,
        })),
        method: 'bayesian',
      };
      break;

    case 'hierarchical':
      const hierInputs: BayesianInput[] = platforms.map(p => ({
        platform: p.platform,
        probability: p.yesPrice,
        volume: p.volume24h,
        liquidity: p.liquidity,
      }));
      const hierResult = hierarchicalBayesianAggregate(hierInputs);
      result = {
        probability: hierResult.posterior,
        confidence: hierResult.confidence,
        platformProbabilities: platforms.map(p => ({
          platform: p.platform,
          rawPrice: p.yesPrice,
          normalizedProbability: p.yesPrice,
          confidence: getPlatformAccuracy(p.platform),
          adjustmentApplied: 0,
        })),
        method: 'bayesian',
      };
      break;

    case 'volume_weighted':
    default:
      result = volumeWeightedAverage(platforms);
      break;
  }

  // Apply extremizing if requested (skip for methods that already extremize)
  const alreadyExtremized = method === 'extremized_log_odds' || method === 'adaptive_extremized';
  if (extremizeFactor > 0 && !alreadyExtremized) {
    result.probability = extremize(result.probability, extremizeFactor);
  }

  // Run uncertainty check if requested
  if (uncertaintyCheck && platforms.length > 2) {
    const bayesianInputs: BayesianInput[] = platforms.map(p => ({
      platform: p.platform,
      probability: p.yesPrice,
      volume: p.volume24h,
      liquidity: p.liquidity,
    }));

    const uncertainty = monteCarloDropoutUncertainty(bayesianInputs);

    // Adjust confidence based on uncertainty
    if (!uncertainty.shouldAct) {
      result.confidence *= 0.5; // Halve confidence if high uncertainty
    }
  }

  return result;
}

/**
 * Quick consensus price using Extremized Log-Odds Aggregation
 *
 * This is the primary consensus calculation, now using state-of-the-art
 * aggregation based on Satopää et al. (2014) research.
 *
 * Formula (in log-odds space):
 * 1. x_i = log(p_i / (1 - p_i))           -- Convert to log-odds
 * 2. x̄ = Σ(w_i × x_i) / Σ(w_i)           -- Weighted mean (logarithmic pooling)
 * 3. x̂ = d × x̄                           -- Extremize (d = 1.5 default)
 * 4. P_consensus = 1 / (1 + exp(-x̂))     -- Convert back to probability
 */
export function calculateConsensusPrice(
  platforms: { platform: string; yesPrice: number; volume: number; liquidity: number }[]
): number {
  if (platforms.length === 0) return 0.5;

  // Use Extremized Log-Odds for state-of-the-art accuracy
  const priceData: PlatformPriceData[] = platforms.map(p => ({
    platform: p.platform as any,
    yesPrice: p.yesPrice,
    liquidity: p.liquidity,
    volume24h: p.volume,
  }));

  const result = aggregateProbability(priceData, { method: 'extremized_log_odds' });
  return result.probability;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  // Legacy methods
  calculateLMSRProbability,
  getPlatformAccuracy,
  bayesianAggregate,
  monteCarloDropoutUncertainty,
  extremize,
  PLATFORM_CALIBRATION,
  DEFAULT_LMSR_CONFIG,
  DEFAULT_PLATFORM_PRIORS,

  // Extremized Log-Odds (State-of-the-Art)
  extremizedLogOddsAggregate,
  adaptiveExtremizedAggregate,
  calculateExtremizedConsensus,
  calculateEdge,
  DEFAULT_EXTREMIZING_CONFIG,
};
