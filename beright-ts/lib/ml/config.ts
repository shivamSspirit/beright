/**
 * ML Configuration Module
 *
 * Centralizes ML configuration with environment variable overrides.
 * All ML-related settings should be accessed through this module.
 *
 * @author BeRight Protocol
 */

import { MLMatchConfig, DEFAULT_ML_CONFIG } from './types';
import { EmbeddingProvider } from './embedding';

// =============================================================================
// ENVIRONMENT VARIABLES
// =============================================================================

/**
 * Environment variable names for ML configuration
 */
export const ML_ENV_VARS = {
  ML_MATCHING_DISABLED: 'ML_MATCHING_DISABLED',
  EMBEDDING_MODEL: 'EMBEDDING_MODEL',
  ML_MIN_SIMILARITY: 'ML_MIN_SIMILARITY',
  ML_MIN_SCORE: 'ML_MIN_SCORE',
  LMSR_AGGREGATION_ENABLED: 'LMSR_AGGREGATION_ENABLED',
  ML_DEBUG: 'ML_DEBUG',
} as const;

// =============================================================================
// CONFIGURATION FUNCTIONS
// =============================================================================

/**
 * Check if ML matching is enabled
 *
 * ML is enabled by default. Set ML_MATCHING_DISABLED=true to disable.
 */
export function isMLMatchingEnabled(): boolean {
  return process.env[ML_ENV_VARS.ML_MATCHING_DISABLED] !== 'true';
}

/**
 * Check if LMSR probability aggregation is enabled
 */
export function isLMSRAggregationEnabled(): boolean {
  return process.env[ML_ENV_VARS.LMSR_AGGREGATION_ENABLED] === 'true';
}

/**
 * Check if ML debug logging is enabled
 */
export function isMLDebugEnabled(): boolean {
  return process.env[ML_ENV_VARS.ML_DEBUG] === 'true';
}

/**
 * Get the preferred embedding provider
 */
export function getPreferredEmbeddingProvider(): EmbeddingProvider | 'auto' {
  const value = process.env[ML_ENV_VARS.EMBEDDING_MODEL]?.toLowerCase();

  switch (value) {
    case 'sbert':
    case 'local':
      return 'sbert';
    case 'openai':
      return 'openai';
    case 'keyword':
      return 'keyword';
    default:
      return 'auto'; // Let the system decide based on availability
  }
}

/**
 * Get the full ML configuration with environment overrides
 */
export function getMLConfig(): MLMatchConfig {
  const envMinSimilarity = process.env[ML_ENV_VARS.ML_MIN_SIMILARITY];
  const envMinScore = process.env[ML_ENV_VARS.ML_MIN_SCORE];

  const minEmbeddingSimilarity = envMinSimilarity
    ? parseFloat(envMinSimilarity)
    : DEFAULT_ML_CONFIG.minEmbeddingSimilarity;

  const minOverallScore = envMinScore
    ? parseFloat(envMinScore)
    : DEFAULT_ML_CONFIG.minOverallScore;

  // Validate parsed values
  const finalMinSimilarity = isNaN(minEmbeddingSimilarity) || minEmbeddingSimilarity < 0 || minEmbeddingSimilarity > 1
    ? DEFAULT_ML_CONFIG.minEmbeddingSimilarity
    : minEmbeddingSimilarity;

  const finalMinScore = isNaN(minOverallScore) || minOverallScore < 0 || minOverallScore > 1
    ? DEFAULT_ML_CONFIG.minOverallScore
    : minOverallScore;

  // Determine embedding model based on preference
  const preferredProvider = getPreferredEmbeddingProvider();
  let embeddingModel: 'openai' | 'huggingface' | 'local';

  switch (preferredProvider) {
    case 'sbert':
      embeddingModel = 'local';
      break;
    case 'openai':
      embeddingModel = 'openai';
      break;
    case 'keyword':
      embeddingModel = 'local'; // Will fall through to keyword in actual use
      break;
    default:
      embeddingModel = 'local'; // Default to local for auto
  }

  return {
    ...DEFAULT_ML_CONFIG,
    embeddingModel,
    minEmbeddingSimilarity: finalMinSimilarity,
    minOverallScore: finalMinScore,
  };
}

// =============================================================================
// DEBUG LOGGING
// =============================================================================

/**
 * Log ML debug information if debug mode is enabled
 */
export function mlDebugLog(message: string, data?: unknown): void {
  if (isMLDebugEnabled()) {
    if (data !== undefined) {
      console.log(`[ML Debug] ${message}`, data);
    } else {
      console.log(`[ML Debug] ${message}`);
    }
  }
}

// =============================================================================
// CONFIGURATION SUMMARY
// =============================================================================

/**
 * Get a summary of the current ML configuration
 */
export function getMLConfigSummary(): {
  enabled: boolean;
  embeddingProvider: string;
  lmsrEnabled: boolean;
  minSimilarity: number;
  minScore: number;
  debugEnabled: boolean;
} {
  const config = getMLConfig();

  return {
    enabled: isMLMatchingEnabled(),
    embeddingProvider: getPreferredEmbeddingProvider(),
    lmsrEnabled: isLMSRAggregationEnabled(),
    minSimilarity: config.minEmbeddingSimilarity,
    minScore: config.minOverallScore,
    debugEnabled: isMLDebugEnabled(),
  };
}
