/**
 * BeRight ML Module
 *
 * ML-powered market aggregation and matching with tiered embedding fallback.
 *
 * Features:
 * - Embedding-based semantic similarity (SBERT → OpenAI → keyword)
 * - Entity extraction and validation
 * - Cross-platform market clustering
 * - Arbitrage detection
 * - Unified feed generation
 * - Type adapters for Data Fabric integration
 *
 * @author BeRight Protocol
 */

// =============================================================================
// TYPES
// =============================================================================

export * from './types';

// =============================================================================
// CORE MATCHING
// =============================================================================

export {
  matchMarkets,
  extractEntities,
  calculateSimilarity,
  clusterMarkets,
  filterByFeedType,
  DEFAULT_ML_CONFIG,
} from './marketMatcher';

// =============================================================================
// CONFIGURATION
// =============================================================================

export {
  getMLConfig,
  isMLMatchingEnabled,
  isLMSRAggregationEnabled,
  isMLDebugEnabled,
  mlDebugLog,
  getMLConfigSummary,
  getPreferredEmbeddingProvider,
  ML_ENV_VARS,
} from './config';

// =============================================================================
// TYPE ADAPTERS
// =============================================================================

export {
  mlResultToUnifiedMarket,
  mlResultsToUnifiedMarkets,
  calculateOverallTrust,
  mergeTrustLevels,
} from './adapters';

// =============================================================================
// EMBEDDINGS
// =============================================================================

export {
  // Unified client
  getEmbeddingWithFallback,
  canGenerateEmbeddings,
  cosineSimilarity,
  textSimilarity,

  // Status
  initEmbeddings,
  getEmbeddingStatus,

  // Direct access (if needed)
  embedText,
  embedTexts,
  rerank,
  scorePair,
  twoStageRetrieval,
} from './embedding';

// Types need separate export for isolatedModules
export type { EmbeddingProvider, UnifiedEmbeddingResult } from './embedding';
