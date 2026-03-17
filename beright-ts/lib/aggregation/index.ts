/**
 * Probability Aggregation Module
 *
 * Advanced probability aggregation for prediction markets:
 * - LMSR: Logarithmic Market Scoring Rule normalization
 * - Bayesian: Platform-weighted Bayesian aggregation
 * - Frank-Wolfe: Probability simplex projection
 *
 * @author BeRight Protocol
 */

export * from './lmsr';
export * from './bayesian';

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

// =============================================================================
// UNIFIED AGGREGATION
// =============================================================================

export type AggregationMethod = 'lmsr' | 'bayesian' | 'hierarchical' | 'volume_weighted';

export interface AggregationOptions {
  method?: AggregationMethod;
  extremizeFactor?: number;
  uncertaintyCheck?: boolean;
}

/**
 * Aggregate probabilities with the best method
 */
export function aggregateProbability(
  platforms: PlatformPriceData[],
  options: AggregationOptions = {}
): AggregatedProbability {
  const {
    method = 'lmsr',
    extremizeFactor = 0,
    uncertaintyCheck = false,
  } = options;

  let result: AggregatedProbability;

  switch (method) {
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

  // Apply extremizing if requested
  if (extremizeFactor > 0) {
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
 * Quick consensus price for compatibility
 */
export function calculateConsensusPrice(
  platforms: { platform: string; yesPrice: number; volume: number; liquidity: number }[]
): number {
  if (platforms.length === 0) return 0.5;

  // Use LMSR for best accuracy
  const priceData: PlatformPriceData[] = platforms.map(p => ({
    platform: p.platform as any,
    yesPrice: p.yesPrice,
    liquidity: p.liquidity,
    volume24h: p.volume,
  }));

  const result = aggregateProbability(priceData, { method: 'lmsr' });
  return result.probability;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  calculateLMSRProbability,
  getPlatformAccuracy,
  bayesianAggregate,
  monteCarloDropoutUncertainty,
  extremize,
  PLATFORM_CALIBRATION,
  DEFAULT_LMSR_CONFIG,
  DEFAULT_PLATFORM_PRIORS,
};
