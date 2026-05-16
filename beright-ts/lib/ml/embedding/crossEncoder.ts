/**
 * Cross-Encoder Reranking
 *
 * Provides deeper pairwise similarity scoring using a cross-encoder model.
 * While bi-encoders (SBERT) are fast for candidate retrieval, cross-encoders
 * provide more accurate similarity by processing both texts together.
 *
 * Pipeline:
 * 1. SBERT bi-encoder: Fast candidate retrieval (top 50)
 * 2. Cross-encoder: Accurate reranking (top 10)
 *
 * Based on MS MARCO trained models for document reranking.
 *
 * @author BeRight Protocol
 */

// =============================================================================
// CROSS-ENCODER
// =============================================================================

type Pipeline = any;
type TextClassificationPipeline = any;

let crossEncoderPipeline: TextClassificationPipeline | null = null;
let isInitializing = false;
let initPromise: Promise<void> | null = null;

/**
 * Cross-encoder configuration
 */
export interface CrossEncoderConfig {
  model: string;
  quantized: boolean;
  maxLength: number;
}

export const DEFAULT_CROSS_ENCODER_CONFIG: CrossEncoderConfig = {
  model: 'Xenova/ms-marco-MiniLM-L-6-v2',
  quantized: true,
  maxLength: 512,
};

/**
 * Reranking result
 */
export interface RerankResult {
  text: string;
  score: number;
  originalIndex: number;
}

/**
 * Check if cross-encoder is available
 */
export function isCrossEncoderAvailable(): boolean {
  try {
    require.resolve('@xenova/transformers');
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize the cross-encoder pipeline
 */
export async function initCrossEncoder(config: Partial<CrossEncoderConfig> = {}): Promise<void> {
  if (crossEncoderPipeline) return;

  if (isInitializing && initPromise) {
    return initPromise;
  }

  isInitializing = true;

  initPromise = (async () => {
    const finalConfig = { ...DEFAULT_CROSS_ENCODER_CONFIG, ...config };

    try {
      const { pipeline, env } = await import('@xenova/transformers');

      env.useBrowserCache = false;
      env.allowLocalModels = true;

      console.log('[CrossEncoder] Loading model:', finalConfig.model);
      const start = Date.now();

      // Use text-classification for cross-encoder scoring
      crossEncoderPipeline = await pipeline('text-classification', finalConfig.model, {
        quantized: finalConfig.quantized,
      });

      console.log(`[CrossEncoder] Model loaded in ${Date.now() - start}ms`);
    } catch (error) {
      console.error('[CrossEncoder] Failed to initialize:', error);
      throw error;
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
}

/**
 * Score a single query-candidate pair
 */
export async function scorePair(
  query: string,
  candidate: string,
  config: Partial<CrossEncoderConfig> = {}
): Promise<number> {
  if (!crossEncoderPipeline) {
    await initCrossEncoder(config);
  }

  if (!crossEncoderPipeline) {
    console.warn('[CrossEncoder] Pipeline not available');
    return 0;
  }

  try {
    // Cross-encoder expects query and candidate separated by [SEP]
    const input = `${query} [SEP] ${candidate}`;
    const result = await crossEncoderPipeline(input);

    // Extract score (model outputs logits, we want the relevance score)
    if (result && result.length > 0) {
      // Normalize score to 0-1 range using sigmoid
      const logit = result[0].score || 0;
      return 1 / (1 + Math.exp(-logit));
    }

    return 0;
  } catch (error) {
    console.error('[CrossEncoder] Scoring failed:', error);
    return 0;
  }
}

/**
 * Rerank candidates by relevance to query
 *
 * @param query - The query text
 * @param candidates - Array of candidate texts to rerank
 * @param topK - Number of top results to return
 * @returns Sorted array of candidates with scores
 */
export async function rerank(
  query: string,
  candidates: string[],
  topK: number = 10,
  config: Partial<CrossEncoderConfig> = {}
): Promise<RerankResult[]> {
  if (!crossEncoderPipeline) {
    await initCrossEncoder(config);
  }

  if (!crossEncoderPipeline || candidates.length === 0) {
    return [];
  }

  const results: RerankResult[] = [];

  // Score each candidate
  for (let i = 0; i < candidates.length; i++) {
    const score = await scorePair(query, candidates[i], config);
    results.push({
      text: candidates[i],
      score,
      originalIndex: i,
    });
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, topK);
}

/**
 * Rerank with objects (preserves original data)
 */
export async function rerankObjects<T extends { text: string }>(
  query: string,
  candidates: T[],
  topK: number = 10,
  config: Partial<CrossEncoderConfig> = {}
): Promise<(T & { score: number })[]> {
  if (!crossEncoderPipeline) {
    await initCrossEncoder(config);
  }

  if (!crossEncoderPipeline || candidates.length === 0) {
    return [];
  }

  const results: (T & { score: number })[] = [];

  for (const candidate of candidates) {
    const score = await scorePair(query, candidate.text, config);
    results.push({ ...candidate, score });
  }

  results.sort((a, b) => b.score - a.score);

  return results.slice(0, topK);
}

/**
 * Batch rerank with concurrent scoring (faster for many candidates)
 */
export async function rerankBatch(
  query: string,
  candidates: string[],
  topK: number = 10,
  batchSize: number = 10,
  config: Partial<CrossEncoderConfig> = {}
): Promise<RerankResult[]> {
  if (!crossEncoderPipeline) {
    await initCrossEncoder(config);
  }

  if (!crossEncoderPipeline || candidates.length === 0) {
    return [];
  }

  const results: RerankResult[] = [];

  // Process in batches for better throughput
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const batchPromises = batch.map((candidate, j) =>
      scorePair(query, candidate, config).then(score => ({
        text: candidate,
        score,
        originalIndex: i + j,
      }))
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  results.sort((a, b) => b.score - a.score);

  return results.slice(0, topK);
}

// =============================================================================
// TWO-STAGE PIPELINE
// =============================================================================

import { embedText, cosineSimilarity } from './sbert';

/**
 * Two-stage retrieval: SBERT for candidates, cross-encoder for reranking
 *
 * This is the optimal pipeline for prediction market matching:
 * 1. SBERT retrieves top candidates (fast, ~5ms each)
 * 2. Cross-encoder reranks top candidates (accurate, ~50ms each)
 */
export async function twoStageRetrieval(
  query: string,
  candidates: { id: string; text: string; embedding?: Float32Array | number[] }[],
  options: {
    sbertTopK?: number;       // How many candidates from SBERT
    crossEncoderTopK?: number; // Final top results
    sbertThreshold?: number;   // Minimum SBERT similarity
    crossEncoderThreshold?: number; // Minimum cross-encoder score
  } = {}
): Promise<{
  id: string;
  text: string;
  sbertScore: number;
  crossEncoderScore: number;
}[]> {
  const {
    sbertTopK = 20,
    crossEncoderTopK = 10,
    sbertThreshold = 0.5,
    crossEncoderThreshold = 0.3,
  } = options;

  // Stage 1: SBERT retrieval
  const queryEmbedding = await embedText(query);
  if (!queryEmbedding) {
    console.warn('[TwoStage] SBERT embedding failed, using cross-encoder only');
    // Fallback to cross-encoder only (slower)
    const reranked = await rerank(query, candidates.map(c => c.text), crossEncoderTopK);
    return reranked
      .filter(r => r.score >= crossEncoderThreshold)
      .map(r => ({
        id: candidates[r.originalIndex].id,
        text: r.text,
        sbertScore: 0,
        crossEncoderScore: r.score,
      }));
  }

  // Compute SBERT similarities
  const sbertScores: { id: string; text: string; score: number }[] = [];

  for (const candidate of candidates) {
    let candidateEmbedding = candidate.embedding;

    // Generate embedding if not provided
    if (!candidateEmbedding) {
      const result = await embedText(candidate.text);
      if (result) {
        candidateEmbedding = result.embedding;
      }
    }

    if (candidateEmbedding) {
      const score = cosineSimilarity(queryEmbedding.embedding, candidateEmbedding);
      if (score >= sbertThreshold) {
        sbertScores.push({ id: candidate.id, text: candidate.text, score });
      }
    }
  }

  // Sort and take top K
  sbertScores.sort((a, b) => b.score - a.score);
  const sbertTopCandidates = sbertScores.slice(0, sbertTopK);

  if (sbertTopCandidates.length === 0) {
    return [];
  }

  // Stage 2: Cross-encoder reranking
  const reranked = await rerank(
    query,
    sbertTopCandidates.map(c => c.text),
    crossEncoderTopK
  );

  // Combine scores
  return reranked
    .filter(r => r.score >= crossEncoderThreshold)
    .map(r => {
      const original = sbertTopCandidates[r.originalIndex];
      return {
        id: original.id,
        text: r.text,
        sbertScore: original.score,
        crossEncoderScore: r.score,
      };
    });
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  initCrossEncoder,
  scorePair,
  rerank,
  rerankObjects,
  rerankBatch,
  twoStageRetrieval,
  isCrossEncoderAvailable,
};
