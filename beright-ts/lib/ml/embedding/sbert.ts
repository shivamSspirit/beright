/**
 * SBERT (Sentence-BERT) Local Embeddings
 *
 * Provides fast, local semantic embeddings using the all-MiniLM-L6-v2 model.
 * Runs entirely in Node.js using ONNX Runtime - no Python required.
 *
 * Performance:
 * - 384-dimensional embeddings
 * - ~5ms inference per text on CPU
 * - No API calls, no rate limits
 *
 * Based on arXiv:2601.01706 methodology for prediction market matching.
 *
 * @author BeRight Protocol
 */

// Type-only import to avoid runtime issues if package not installed
type Pipeline = any;
type FeatureExtractionPipeline = any;

// =============================================================================
// SBERT EMBEDDING ENGINE
// =============================================================================

let embeddingPipeline: FeatureExtractionPipeline | null = null;
let isInitializing = false;
let initPromise: Promise<void> | null = null;

/**
 * SBERT configuration
 */
export interface SBERTConfig {
  model: string;
  quantized: boolean;
  cacheDir?: string;
}

export const DEFAULT_SBERT_CONFIG: SBERTConfig = {
  model: 'Xenova/all-MiniLM-L6-v2',
  quantized: true,
};

/**
 * SBERT embedding result
 */
export interface SBERTEmbeddingResult {
  embedding: Float32Array;
  model: string;
  latencyMs: number;
}

/**
 * Check if @xenova/transformers is available
 */
export function isSBERTAvailable(): boolean {
  try {
    require.resolve('@xenova/transformers');
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize the SBERT pipeline
 * Must be called before generating embeddings
 */
export async function initSBERT(config: Partial<SBERTConfig> = {}): Promise<void> {
  if (embeddingPipeline) return;

  if (isInitializing && initPromise) {
    return initPromise;
  }

  isInitializing = true;

  initPromise = (async () => {
    const finalConfig = { ...DEFAULT_SBERT_CONFIG, ...config };

    try {
      // Dynamic import to avoid crashes if package not installed
      const { pipeline, env } = await import('@xenova/transformers');

      // Configure transformers.js
      env.useBrowserCache = false;
      env.allowLocalModels = true;

      if (finalConfig.cacheDir) {
        env.cacheDir = finalConfig.cacheDir;
      }

      console.log('[SBERT] Loading model:', finalConfig.model);
      const start = Date.now();

      embeddingPipeline = await pipeline('feature-extraction', finalConfig.model, {
        quantized: finalConfig.quantized,
      });

      console.log(`[SBERT] Model loaded in ${Date.now() - start}ms`);
    } catch (error) {
      console.error('[SBERT] Failed to initialize:', error);
      throw error;
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
}

/**
 * Generate embedding for a single text
 */
export async function embedText(
  text: string,
  config: Partial<SBERTConfig> = {}
): Promise<SBERTEmbeddingResult | null> {
  const start = Date.now();

  // Initialize if needed
  if (!embeddingPipeline) {
    await initSBERT(config);
  }

  if (!embeddingPipeline) {
    console.warn('[SBERT] Pipeline not available');
    return null;
  }

  try {
    // Generate embedding with mean pooling and normalization
    const output = await embeddingPipeline(text, {
      pooling: 'mean',
      normalize: true,
    });

    // Extract the embedding data
    const embedding = output.data as Float32Array;

    return {
      embedding,
      model: DEFAULT_SBERT_CONFIG.model,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    console.error('[SBERT] Embedding generation failed:', error);
    return null;
  }
}

/**
 * Generate embeddings for multiple texts (batched)
 */
export async function embedTexts(
  texts: string[],
  config: Partial<SBERTConfig> = {}
): Promise<SBERTEmbeddingResult[]> {
  const results: SBERTEmbeddingResult[] = [];

  // Initialize if needed
  if (!embeddingPipeline) {
    await initSBERT(config);
  }

  if (!embeddingPipeline) {
    console.warn('[SBERT] Pipeline not available');
    return results;
  }

  for (const text of texts) {
    const result = await embedText(text, config);
    if (result) {
      results.push(result);
    }
  }

  return results;
}

/**
 * Calculate cosine similarity between two embeddings
 * Optimized for normalized vectors (dot product = cosine similarity)
 */
export function cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
  if (a.length !== b.length) {
    console.warn('[SBERT] Embedding dimension mismatch:', a.length, 'vs', b.length);
    return 0;
  }

  // For normalized vectors, cosine similarity = dot product
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }

  return dot;
}

/**
 * Calculate Euclidean distance between two embeddings
 */
export function euclideanDistance(a: Float32Array | number[], b: Float32Array | number[]): number {
  if (a.length !== b.length) return Infinity;

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Find top-k most similar embeddings
 */
export function findTopK(
  query: Float32Array | number[],
  candidates: { id: string; embedding: Float32Array | number[] }[],
  k: number = 10,
  threshold: number = 0
): { id: string; similarity: number }[] {
  const results: { id: string; similarity: number }[] = [];

  for (const candidate of candidates) {
    const similarity = cosineSimilarity(query, candidate.embedding);
    if (similarity >= threshold) {
      results.push({ id: candidate.id, similarity });
    }
  }

  // Sort by similarity (descending) and take top k
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, k);
}

/**
 * Calculate centroid of multiple embeddings
 */
export function calculateCentroid(embeddings: (Float32Array | number[])[]): Float32Array {
  if (embeddings.length === 0) return new Float32Array(0);
  if (embeddings.length === 1) {
    return embeddings[0] instanceof Float32Array
      ? embeddings[0]
      : new Float32Array(embeddings[0]);
  }

  const dim = embeddings[0].length;
  const centroid = new Float32Array(dim);

  for (const embedding of embeddings) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += embedding[i];
    }
  }

  // Normalize
  for (let i = 0; i < dim; i++) {
    centroid[i] /= embeddings.length;
  }

  // Renormalize to unit length
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    norm += centroid[i] * centroid[i];
  }
  norm = Math.sqrt(norm);

  if (norm > 0) {
    for (let i = 0; i < dim; i++) {
      centroid[i] /= norm;
    }
  }

  return centroid;
}

// =============================================================================
// EMBEDDING CACHE
// =============================================================================

interface CachedEmbedding {
  embedding: Float32Array;
  timestamp: number;
}

const embeddingCache = new Map<string, CachedEmbedding>();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

/**
 * Get or compute embedding with caching
 */
export async function getEmbeddingCached(
  text: string,
  cacheKey?: string
): Promise<Float32Array | null> {
  const key = cacheKey || text;
  const cached = embeddingCache.get(key);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.embedding;
  }

  const result = await embedText(text);
  if (result) {
    embeddingCache.set(key, {
      embedding: result.embedding,
      timestamp: Date.now(),
    });
    return result.embedding;
  }

  return null;
}

/**
 * Clear the embedding cache
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}

/**
 * Get cache stats
 */
export function getEmbeddingCacheStats(): { size: number; maxSize: number } {
  return {
    size: embeddingCache.size,
    maxSize: 10000, // Approximate
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  initSBERT,
  embedText,
  embedTexts,
  cosineSimilarity,
  euclideanDistance,
  findTopK,
  calculateCentroid,
  getEmbeddingCached,
  clearEmbeddingCache,
  isSBERTAvailable,
};
