/**
 * Bayesian Platform Weighting
 *
 * Aggregates probabilities from multiple prediction market platforms
 * using Bayesian updating with platform calibration as priors.
 *
 * Key insight: Not all platforms are equally accurate.
 * We weight by historical calibration (Brier score) and sample size.
 *
 * @author BeRight Protocol
 */

import { DataPlatform } from '../data/types';
import { PLATFORM_CALIBRATION, getPlatformAccuracy } from './lmsr';

// =============================================================================
// TYPES
// =============================================================================

export interface PlatformPrior {
  platform: DataPlatform;
  weight: number;        // Prior weight (0-1)
  confidence: number;    // How confident we are in this prior
}

export interface BayesianInput {
  platform: DataPlatform;
  probability: number;
  volume?: number;
  liquidity?: number;
  sampleSize?: number;   // Number of historical predictions
}

export interface BayesianResult {
  posterior: number;                // Final probability estimate
  confidence: number;               // Overall confidence
  contributions: {
    platform: DataPlatform;
    weight: number;
    contribution: number;           // How much this platform contributed
  }[];
  entropy: number;                  // Uncertainty measure
}

// =============================================================================
// PLATFORM PRIORS
// =============================================================================

/**
 * Default platform priors based on historical performance
 */
export const DEFAULT_PLATFORM_PRIORS: Record<DataPlatform, PlatformPrior> = {
  kalshi: { platform: 'kalshi', weight: 0.25, confidence: 0.9 },
  polymarket: { platform: 'polymarket', weight: 0.25, confidence: 0.85 },
  metaculus: { platform: 'metaculus', weight: 0.20, confidence: 0.85 },
  manifold: { platform: 'manifold', weight: 0.15, confidence: 0.7 },
  limitless: { platform: 'limitless', weight: 0.10, confidence: 0.75 },
  jupiter: { platform: 'jupiter', weight: 0.20, confidence: 0.8 },
  prophetx: { platform: 'prophetx', weight: 0.08, confidence: 0.65 },
  novig: { platform: 'novig', weight: 0.07, confidence: 0.6 },
  sxbet: { platform: 'sxbet', weight: 0.08, confidence: 0.65 },
  myriad: { platform: 'myriad', weight: 0.05, confidence: 0.5 },
  baozi: { platform: 'baozi', weight: 0.03, confidence: 0.4 },
  probable: { platform: 'probable', weight: 0.05, confidence: 0.5 },
};

// =============================================================================
// BAYESIAN AGGREGATION
// =============================================================================

/**
 * Bayesian probability aggregation
 *
 * Uses a pseudo-Bayesian approach:
 * 1. Start with platform priors (based on historical calibration)
 * 2. Weight each platform by: prior * accuracy * sqrt(sample_size)
 * 3. Compute weighted average as posterior
 * 4. Calculate confidence based on agreement
 */
export function bayesianAggregate(
  inputs: BayesianInput[],
  priors: Record<DataPlatform, PlatformPrior> = DEFAULT_PLATFORM_PRIORS
): BayesianResult {
  if (inputs.length === 0) {
    return {
      posterior: 0.5,
      confidence: 0,
      contributions: [],
      entropy: 1,
    };
  }

  const contributions: BayesianResult['contributions'] = [];
  let weightedSum = 0;
  let totalWeight = 0;

  for (const input of inputs) {
    const prior = priors[input.platform] || {
      platform: input.platform,
      weight: 0.1,
      confidence: 0.5,
    };

    // Calculate weight components
    const accuracy = getPlatformAccuracy(input.platform);
    const sampleWeight = Math.sqrt(input.sampleSize || 100);
    const volumeWeight = Math.sqrt(input.volume || 1);
    const liquidityWeight = Math.sqrt(input.liquidity || 1);

    // Combined weight
    const weight = prior.weight * accuracy * sampleWeight *
      Math.sqrt(volumeWeight) * Math.sqrt(liquidityWeight) *
      prior.confidence;

    const contribution = input.probability * weight;

    contributions.push({
      platform: input.platform,
      weight,
      contribution,
    });

    weightedSum += contribution;
    totalWeight += weight;
  }

  // Calculate posterior
  const posterior = totalWeight > 0 ? weightedSum / totalWeight : 0.5;

  // Normalize contributions
  if (totalWeight > 0) {
    for (const c of contributions) {
      c.weight /= totalWeight;
      c.contribution /= totalWeight;
    }
  }

  // Calculate confidence based on agreement
  const probabilities = inputs.map(i => i.probability);
  const variance = calculateVariance(probabilities);
  const agreement = Math.max(0, 1 - Math.sqrt(variance) * 4);

  // Calculate entropy (uncertainty measure)
  const entropy = calculateEntropy([posterior, 1 - posterior]);

  // Final confidence is combination of agreement and average platform confidence
  const avgPlatformConfidence = contributions.reduce((sum, c) => sum + c.weight, 0) /
    contributions.length;

  const confidence = Math.min(agreement, avgPlatformConfidence, 1 - entropy / 2);

  return {
    posterior,
    confidence,
    contributions,
    entropy,
  };
}

/**
 * Update Bayesian estimate with new evidence
 *
 * Uses log-odds updating for numerical stability:
 * log_odds_posterior = log_odds_prior + sum(log_likelihood_ratios)
 */
export function bayesianUpdate(
  prior: number,
  evidenceProbabilities: { platform: DataPlatform; probability: number }[],
  priors: Record<DataPlatform, PlatformPrior> = DEFAULT_PLATFORM_PRIORS
): number {
  if (evidenceProbabilities.length === 0) return prior;

  // Convert to log-odds
  const clampedPrior = Math.max(0.01, Math.min(0.99, prior));
  let logOdds = Math.log(clampedPrior / (1 - clampedPrior));

  for (const evidence of evidenceProbabilities) {
    const platformPrior = priors[evidence.platform] || { weight: 0.1, confidence: 0.5 };
    const clampedProb = Math.max(0.01, Math.min(0.99, evidence.probability));

    // Weight the evidence by platform confidence
    const weight = platformPrior.confidence * getPlatformAccuracy(evidence.platform);

    // Log-likelihood ratio
    const evidenceLogOdds = Math.log(clampedProb / (1 - clampedProb));

    // Weighted update
    logOdds += weight * (evidenceLogOdds - logOdds) * 0.5;
  }

  // Convert back to probability
  const posterior = 1 / (1 + Math.exp(-logOdds));

  return Math.max(0.01, Math.min(0.99, posterior));
}

/**
 * Hierarchical Bayesian aggregation
 *
 * Groups platforms by tier, aggregates within tier, then across tiers.
 */
export function hierarchicalBayesianAggregate(
  inputs: BayesianInput[]
): BayesianResult {
  // Define tiers
  const tier1: DataPlatform[] = ['kalshi', 'polymarket', 'jupiter'];
  const tier2: DataPlatform[] = ['metaculus', 'manifold', 'limitless'];
  const tier3: DataPlatform[] = ['prophetx', 'novig', 'sxbet', 'myriad', 'baozi', 'probable'];

  // Aggregate within tiers
  const t1Inputs = inputs.filter(i => tier1.includes(i.platform));
  const t2Inputs = inputs.filter(i => tier2.includes(i.platform));
  const t3Inputs = inputs.filter(i => tier3.includes(i.platform));

  const tierResults: { probability: number; weight: number }[] = [];

  if (t1Inputs.length > 0) {
    const result = bayesianAggregate(t1Inputs);
    tierResults.push({ probability: result.posterior, weight: 0.6 });
  }

  if (t2Inputs.length > 0) {
    const result = bayesianAggregate(t2Inputs);
    tierResults.push({ probability: result.posterior, weight: 0.3 });
  }

  if (t3Inputs.length > 0) {
    const result = bayesianAggregate(t3Inputs);
    tierResults.push({ probability: result.posterior, weight: 0.1 });
  }

  if (tierResults.length === 0) {
    return {
      posterior: 0.5,
      confidence: 0,
      contributions: [],
      entropy: 1,
    };
  }

  // Normalize tier weights
  const totalTierWeight = tierResults.reduce((sum, t) => sum + t.weight, 0);

  // Aggregate across tiers
  const posterior = tierResults.reduce(
    (sum, t) => sum + t.probability * (t.weight / totalTierWeight),
    0
  );

  // Confidence based on tier agreement
  const tierProbs = tierResults.map(t => t.probability);
  const variance = calculateVariance(tierProbs);
  const confidence = Math.max(0, 1 - Math.sqrt(variance) * 4);

  return {
    posterior,
    confidence,
    contributions: inputs.map(i => ({
      platform: i.platform,
      weight: 1 / inputs.length,
      contribution: i.probability / inputs.length,
    })),
    entropy: calculateEntropy([posterior, 1 - posterior]),
  };
}

// =============================================================================
// EXTREMIZING FUNCTION
// =============================================================================

/**
 * Apply extremizing transformation to aggregated probability
 *
 * Research shows aggregated forecasts are often underconfident.
 * Extremizing pushes probabilities away from 50% based on forecast quality.
 *
 * Formula: p_extreme = p^d / (p^d + (1-p)^d) where d > 1
 */
export function extremize(probability: number, factor: number = 1.5): number {
  if (factor <= 0) return probability;

  const p = Math.max(0.01, Math.min(0.99, probability));
  const pPower = Math.pow(p, factor);
  const qPower = Math.pow(1 - p, factor);

  return pPower / (pPower + qPower);
}

/**
 * Anti-extremize (for overconfident platforms)
 */
export function antiExtremize(probability: number, factor: number = 1.5): number {
  return extremize(probability, 1 / factor);
}

/**
 * Determine optimal extremizing factor based on calibration analysis
 */
export function calculateOptimalExtremizingFactor(
  historicalData: { predicted: number; actual: boolean }[]
): number {
  if (historicalData.length < 20) return 1; // Not enough data

  // Calculate Brier score for various extremizing factors
  const factors = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.5, 1.7, 2.0];
  let bestFactor = 1;
  let bestBrier = Infinity;

  for (const factor of factors) {
    let brierSum = 0;
    for (const point of historicalData) {
      const extremized = extremize(point.predicted, factor);
      const outcome = point.actual ? 1 : 0;
      brierSum += Math.pow(extremized - outcome, 2);
    }
    const avgBrier = brierSum / historicalData.length;

    if (avgBrier < bestBrier) {
      bestBrier = avgBrier;
      bestFactor = factor;
    }
  }

  return bestFactor;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map(v => (v - mean) ** 2);
  return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateEntropy(probabilities: number[]): number {
  let entropy = 0;
  for (const p of probabilities) {
    if (p > 0 && p < 1) {
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

// =============================================================================
// MONTE CARLO DROPOUT UNCERTAINTY
// =============================================================================

/**
 * Monte Carlo Dropout for uncertainty quantification
 *
 * Runs the aggregation N times with random dropout of platforms
 * to estimate uncertainty in the aggregated probability.
 */
export function monteCarloDropoutUncertainty(
  inputs: BayesianInput[],
  samples: number = 50,
  dropoutRate: number = 0.2
): {
  mean: number;
  std: number;
  ci95: [number, number];
  shouldAct: boolean;
} {
  const results: number[] = [];

  for (let i = 0; i < samples; i++) {
    // Random dropout
    const sampledInputs = inputs.filter(() => Math.random() > dropoutRate);

    if (sampledInputs.length === 0) {
      results.push(0.5);
      continue;
    }

    const result = bayesianAggregate(sampledInputs);
    results.push(result.posterior);
  }

  // Calculate statistics
  const mean = results.reduce((sum, v) => sum + v, 0) / results.length;
  const variance = calculateVariance(results);
  const std = Math.sqrt(variance);

  // 95% confidence interval
  const sorted = [...results].sort((a, b) => a - b);
  const ci95: [number, number] = [
    sorted[Math.floor(samples * 0.025)],
    sorted[Math.floor(samples * 0.975)],
  ];

  // Only act if uncertainty is low (std < 15%)
  const shouldAct = std < 0.15;

  return { mean, std, ci95, shouldAct };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  bayesianAggregate,
  bayesianUpdate,
  hierarchicalBayesianAggregate,
  extremize,
  antiExtremize,
  calculateOptimalExtremizingFactor,
  monteCarloDropoutUncertainty,
  DEFAULT_PLATFORM_PRIORS,
};
