/**
 * ML Embedding Module
 *
 * Unified interface for semantic embeddings with tiered fallback:
 * 1. SBERT: Local, fast, no API required (384-dim)
 * 2. OpenAI: Cloud API, high quality (1536-dim)
 * 3. Keyword: Always available fallback
 *
 * Also includes:
 * - Cross-encoder: Accurate pairwise reranking
 * - Two-stage pipeline: Retrieval + reranking
 *
 * @author BeRight Protocol
 */

export * from './sbert';
export * from './crossEncoder';

import {
  initSBERT,
  embedText as sbertEmbedText,
  embedTexts as sbertEmbedTexts,
  cosineSimilarity as sbertCosineSimilarity,
  isSBERTAvailable,
  getEmbeddingCached,
  SBERTEmbeddingResult,
} from './sbert';

import {
  initCrossEncoder,
  rerank,
  scorePair,
  twoStageRetrieval,
  isCrossEncoderAvailable,
} from './crossEncoder';

import {
  generateEmbedding as openaiGenerateEmbedding,
  textSimilarity,
  cosineSimilarity as openaiCosineSimilarity,
  isEmbeddingsConfigured as isOpenAIConfigured,
} from '../../embeddings/client';

// =============================================================================
// UNIFIED EMBEDDING RESULT
// =============================================================================

export type EmbeddingProvider = 'sbert' | 'openai' | 'keyword';

export interface UnifiedEmbeddingResult {
  embedding: number[];
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
  latencyMs: number;
}

// =============================================================================
// TIERED EMBEDDING CLIENT
// =============================================================================

/**
 * Get embedding with automatic fallback:
 * 1. SBERT (local, fast, 384-dim)
 * 2. OpenAI (API, 1536-dim)
 * 3. null (caller should use keyword similarity)
 */
export async function getEmbeddingWithFallback(
  text: string,
  options: {
    preferLocal?: boolean;
    forceProvider?: EmbeddingProvider;
  } = {}
): Promise<UnifiedEmbeddingResult | null> {
  const { preferLocal = true, forceProvider } = options;
  const start = Date.now();

  // Force specific provider
  if (forceProvider === 'sbert') {
    return tryGetSBERTEmbedding(text, start);
  }
  if (forceProvider === 'openai') {
    return tryGetOpenAIEmbedding(text, start);
  }
  if (forceProvider === 'keyword') {
    return null; // Let caller use textSimilarity
  }

  // Tiered fallback
  if (preferLocal && isSBERTAvailable()) {
    const result = await tryGetSBERTEmbedding(text, start);
    if (result) return result;
  }

  if (isOpenAIConfigured()) {
    const result = await tryGetOpenAIEmbedding(text, start);
    if (result) return result;
  }

  // Try SBERT even if not preferred (if OpenAI failed)
  if (!preferLocal && isSBERTAvailable()) {
    const result = await tryGetSBERTEmbedding(text, start);
    if (result) return result;
  }

  // No embeddings available - caller should use keyword similarity
  return null;
}

async function tryGetSBERTEmbedding(text: string, startTime: number): Promise<UnifiedEmbeddingResult | null> {
  try {
    const result = await sbertEmbedText(text);
    if (result) {
      return {
        embedding: Array.from(result.embedding),
        provider: 'sbert',
        model: result.model,
        dimensions: result.embedding.length,
        latencyMs: Date.now() - startTime,
      };
    }
  } catch (error) {
    console.warn('[Embeddings] SBERT failed:', error);
  }
  return null;
}

async function tryGetOpenAIEmbedding(text: string, startTime: number): Promise<UnifiedEmbeddingResult | null> {
  try {
    const result = await openaiGenerateEmbedding(text);
    if (result) {
      return {
        embedding: result.embedding,
        provider: 'openai',
        model: result.model,
        dimensions: result.embedding.length,
        latencyMs: Date.now() - startTime,
      };
    }
  } catch (error) {
    console.warn('[Embeddings] OpenAI failed:', error);
  }
  return null;
}

/**
 * Check what embedding capabilities are available
 */
export async function canGenerateEmbeddings(): Promise<{
  available: boolean;
  provider: EmbeddingProvider | null;
  capabilities: {
    sbert: boolean;
    openai: boolean;
    keyword: boolean;
  };
}> {
  const sbert = isSBERTAvailable();
  const openai = isOpenAIConfigured();

  return {
    available: sbert || openai,
    provider: sbert ? 'sbert' : openai ? 'openai' : null,
    capabilities: {
      sbert,
      openai,
      keyword: true, // Always available
    },
  };
}

/**
 * Unified cosine similarity that works with any embedding arrays
 */
export function cosineSimilarity(a: number[] | Float32Array, b: number[] | Float32Array): number {
  // Convert Float32Array to number[] if needed
  const arrA = a instanceof Float32Array ? Array.from(a) : a;
  const arrB = b instanceof Float32Array ? Array.from(b) : b;
  return openaiCosineSimilarity(arrA, arrB);
}

/**
 * Get text similarity using keyword matching (always available fallback)
 */
export { textSimilarity } from '../../embeddings/client';

// =============================================================================
// UNIFIED INTERFACE
// =============================================================================

/**
 * Initialize all embedding models
 */
export async function initEmbeddings(): Promise<{
  sbert: boolean;
  crossEncoder: boolean;
}> {
  const results = {
    sbert: false,
    crossEncoder: false,
  };

  if (isSBERTAvailable()) {
    try {
      await initSBERT();
      results.sbert = true;
    } catch (error) {
      console.warn('[Embeddings] SBERT init failed:', error);
    }
  }

  if (isCrossEncoderAvailable()) {
    try {
      await initCrossEncoder();
      results.crossEncoder = true;
    } catch (error) {
      console.warn('[Embeddings] Cross-encoder init failed:', error);
    }
  }

  console.log(`[Embeddings] Initialized: SBERT=${results.sbert}, CrossEncoder=${results.crossEncoder}`);

  return results;
}

/**
 * Get embedding status
 */
export function getEmbeddingStatus(): {
  sbertAvailable: boolean;
  crossEncoderAvailable: boolean;
  recommendations: string[];
} {
  const recommendations: string[] = [];

  if (!isSBERTAvailable()) {
    recommendations.push('Install @xenova/transformers for local embeddings: npm install @xenova/transformers');
  }

  return {
    sbertAvailable: isSBERTAvailable(),
    crossEncoderAvailable: isCrossEncoderAvailable(),
    recommendations,
  };
}

// Re-export key functions (cosineSimilarity already exported above with unified signature)
export {
  sbertEmbedText as embedText,
  sbertEmbedTexts as embedTexts,
  getEmbeddingCached,
  rerank,
  scorePair,
  twoStageRetrieval,
};
