/**
 * LLM Classification Module
 *
 * Exports the LLM-powered market classification system.
 *
 * Usage:
 * ```typescript
 * import { getClassifier, classifyMarketPair } from './classification';
 *
 * // Using singleton
 * const classifier = getClassifier();
 * const result = await classifier.classify(input);
 *
 * // Or using convenience function
 * const result = await classifyMarketPair(input);
 * ```
 *
 * @author BeRight Protocol
 */

// Types
export type {
  MatchRelationType,
  ClassificationResult,
  ClassificationInput,
  ClassificationConfig,
  ClassificationMetrics,
  ClassificationResponse,
} from './types';

export {
  ClassificationResponseSchema,
  DEFAULT_CLASSIFICATION_CONFIG,
  createEmptyMetrics,
} from './types';

// Classifier
export {
  LLMClassifier,
  getClassifier,
  resetClassifier,
  classifyMarketPair,
  classifyMarketPairs,
  isClassificationAvailable,
} from './llmClassifier';

// Cache
export {
  ClassificationCache,
  getClassificationCache,
  resetClassificationCache,
} from './cache';

// Fallback
export {
  classifyWithRules,
  shouldClassify,
} from './fallback';

// Prompts
export {
  CLASSIFICATION_SYSTEM_PROMPT,
  generateClassificationPrompt,
  generateCacheKey,
  generateShortHash,
} from './prompt';
