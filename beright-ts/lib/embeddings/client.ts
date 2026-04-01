/**
 * Embedding Client
 *
 * Provides text similarity using:
 *   1. Mistral embeddings (if MISTRAL_API_KEY is set) - 1024 dimensions
 *   2. OpenAI embeddings (if OPENAI_API_KEY is set) - 1536 dimensions
 *   3. Keyword-based similarity (always available, fast fallback)
 */

import { EmbeddingResult, EmbeddingConfig, DEFAULT_EMBEDDING_CONFIG } from './types';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/embeddings';
const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';

// Track if we've already logged warnings (avoid log spam)
let embeddingKeyWarningLogged = false;

// Detect which provider is available
type EmbeddingProvider = 'mistral' | 'openai' | 'none';

function getEmbeddingProvider(): EmbeddingProvider {
  if (process.env.MISTRAL_API_KEY) return 'mistral';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'none';
}

// =============================================================================
// KEYWORD-BASED SIMILARITY (Always available)
// =============================================================================

/**
 * Extract keywords from text for similarity matching
 */
export function extractKeywords(text: string): Set<string> {
  const stopWords = new Set([
    'will', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'by',
    'be', 'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'done', 'can', 'could', 'would', 'should', 'may', 'might',
    'this', 'that', 'these', 'those', 'and', 'or', 'but', 'if', 'then', 'else',
    'before', 'after', 'during', 'above', 'below', 'between', 'under', 'over',
    'with', 'without', 'about', 'into', 'through', 'from', 'up', 'down',
    'what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why', 'how',
    'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
    'very', 'just', 'also', 'now', 'here', 'there', 'any', 'many', 'much',
  ]);

  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
  );
}

/**
 * Calculate Jaccard similarity between two texts
 */
export function jaccardSimilarity(textA: string, textB: string): number {
  const keywordsA = extractKeywords(textA);
  const keywordsB = extractKeywords(textB);

  if (keywordsA.size === 0 || keywordsB.size === 0) return 0;

  const intersection = [...keywordsA].filter(k => keywordsB.has(k)).length;
  const union = new Set([...keywordsA, ...keywordsB]).size;

  return union === 0 ? 0 : intersection / union;
}

/**
 * Calculate TF-IDF style weighted similarity
 */
export function weightedSimilarity(textA: string, textB: string): number {
  const keywordsA = extractKeywords(textA);
  const keywordsB = extractKeywords(textB);

  if (keywordsA.size === 0 || keywordsB.size === 0) return 0;

  let score = 0;
  let maxScore = 0;

  for (const keyword of keywordsA) {
    const weight = Math.log(keyword.length + 1);
    maxScore += weight;
    if (keywordsB.has(keyword)) {
      score += weight;
    }
  }

  return maxScore === 0 ? 0 : score / maxScore;
}

/**
 * Combined similarity score (Jaccard + weighted)
 */
export function textSimilarity(textA: string, textB: string): number {
  const jaccard = jaccardSimilarity(textA, textB);
  const weighted = weightedSimilarity(textA, textB);
  return (jaccard + weighted) / 2;
}

// =============================================================================
// MISTRAL EMBEDDINGS
// =============================================================================

interface MistralEmbeddingResponse {
  id: string;
  object: string;
  data: {
    object: string;
    embedding: number[];
    index: number;
  }[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

async function generateMistralEmbedding(
  text: string,
  config: Partial<EmbeddingConfig> = {}
): Promise<EmbeddingResult | null> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-embed',
        input: [text.slice(0, 8000)], // Mistral supports up to 8k tokens
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.warn('[Embeddings] Mistral API error:', error);
      return null;
    }

    const data: MistralEmbeddingResponse = await response.json();

    if (!data.data || data.data.length === 0) {
      return null;
    }

    return {
      embedding: data.data[0].embedding,
      model: data.model,
      tokensUsed: data.usage.total_tokens,
    };
  } catch (err) {
    console.warn('[Embeddings] Mistral failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

async function generateMistralEmbeddings(
  texts: string[],
  config: Partial<EmbeddingConfig> = {}
): Promise<EmbeddingResult[]> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) return [];

  const results: EmbeddingResult[] = [];
  const batchSize = config.batchSize || 10;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    try {
      const response = await fetch(MISTRAL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'mistral-embed',
          input: batch.map(t => t.slice(0, 8000)),
        }),
      });

      if (!response.ok) {
        console.warn('[Embeddings] Mistral batch error, skipping batch');
        continue;
      }

      const data: MistralEmbeddingResponse = await response.json();

      for (const item of data.data) {
        results.push({
          embedding: item.embedding,
          model: data.model,
          tokensUsed: Math.ceil(data.usage.total_tokens / batch.length),
        });
      }
    } catch (err) {
      console.warn('[Embeddings] Mistral batch failed:', err instanceof Error ? err.message : err);
    }

    // Rate limit protection
    if (i + batchSize < texts.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return results;
}

// =============================================================================
// OPENAI EMBEDDINGS (Fallback)
// =============================================================================

interface OpenAIEmbeddingResponse {
  data: {
    embedding: number[];
    index: number;
  }[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

async function generateOpenAIEmbedding(
  text: string,
  config: Partial<EmbeddingConfig> = {}
): Promise<EmbeddingResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const finalConfig = { ...DEFAULT_EMBEDDING_CONFIG, ...config };

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: finalConfig.model,
        input: text.slice(0, finalConfig.maxTokens * 4),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.warn('[Embeddings] OpenAI API error:', error);
      return null;
    }

    const data: OpenAIEmbeddingResponse = await response.json();

    if (!data.data || data.data.length === 0) {
      return null;
    }

    return {
      embedding: data.data[0].embedding,
      model: data.model,
      tokensUsed: data.usage.total_tokens,
    };
  } catch (err) {
    console.warn('[Embeddings] OpenAI failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

async function generateOpenAIEmbeddings(
  texts: string[],
  config: Partial<EmbeddingConfig> = {}
): Promise<EmbeddingResult[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const finalConfig = { ...DEFAULT_EMBEDDING_CONFIG, ...config };
  const results: EmbeddingResult[] = [];

  for (let i = 0; i < texts.length; i += finalConfig.batchSize) {
    const batch = texts.slice(i, i + finalConfig.batchSize);

    try {
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: finalConfig.model,
          input: batch.map(t => t.slice(0, finalConfig.maxTokens * 4)),
        }),
      });

      if (!response.ok) {
        console.warn('[Embeddings] OpenAI batch error, skipping batch');
        continue;
      }

      const data: OpenAIEmbeddingResponse = await response.json();

      for (const item of data.data) {
        results.push({
          embedding: item.embedding,
          model: data.model,
          tokensUsed: Math.ceil(data.usage.total_tokens / batch.length),
        });
      }
    } catch (err) {
      console.warn('[Embeddings] OpenAI batch failed:', err instanceof Error ? err.message : err);
    }

    if (i + finalConfig.batchSize < texts.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return results;
}

// =============================================================================
// PUBLIC API (Auto-selects provider)
// =============================================================================

/**
 * Generate embedding for a single text
 * Uses Mistral if available, falls back to OpenAI, then keyword-based
 */
export async function generateEmbedding(
  text: string,
  config: Partial<EmbeddingConfig> = {}
): Promise<EmbeddingResult | null> {
  const provider = getEmbeddingProvider();

  if (provider === 'mistral') {
    return generateMistralEmbedding(text, config);
  }

  if (provider === 'openai') {
    return generateOpenAIEmbedding(text, config);
  }

  if (!embeddingKeyWarningLogged) {
    console.warn('[Embeddings] No API key set (MISTRAL_API_KEY or OPENAI_API_KEY) - using keyword-based similarity');
    embeddingKeyWarningLogged = true;
  }
  return null;
}

/**
 * Generate embeddings for multiple texts (batched)
 */
export async function generateEmbeddings(
  texts: string[],
  config: Partial<EmbeddingConfig> = {}
): Promise<EmbeddingResult[]> {
  const provider = getEmbeddingProvider();

  if (provider === 'mistral') {
    return generateMistralEmbeddings(texts, config);
  }

  if (provider === 'openai') {
    return generateOpenAIEmbeddings(texts, config);
  }

  if (!embeddingKeyWarningLogged) {
    console.warn('[Embeddings] No API key set - using keyword-based similarity');
    embeddingKeyWarningLogged = true;
  }
  return [];
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Check if embeddings are available
 */
export function isEmbeddingsConfigured(): boolean {
  return getEmbeddingProvider() !== 'none';
}

/**
 * Get current embedding provider info
 */
export function getEmbeddingInfo(): {
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
} {
  const provider = getEmbeddingProvider();

  if (provider === 'mistral') {
    return { provider, model: 'mistral-embed', dimensions: 1024 };
  }
  if (provider === 'openai') {
    return { provider, model: 'text-embedding-3-small', dimensions: 1536 };
  }
  return { provider: 'none', model: 'keyword-based', dimensions: 0 };
}
