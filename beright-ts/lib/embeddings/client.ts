/**
 * Embedding Client
 *
 * Provides text similarity using:
 *   1. Keyword-based similarity (always available, fast)
 *   2. OpenAI embeddings (optional, if OPENAI_API_KEY is set)
 *
 * For BeRight, we primarily use keyword-based similarity since we're
 * using Groq for LLM (which doesn't have embeddings API).
 */

import { EmbeddingResult, EmbeddingConfig, DEFAULT_EMBEDDING_CONFIG } from './types';

const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';

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

  // Give more weight to longer matching words (more specific)
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
// OPENAI EMBEDDINGS (Optional)
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

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(
  text: string,
  config: Partial<EmbeddingConfig> = {}
): Promise<EmbeddingResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[Embeddings] OPENAI_API_KEY not set');
    return null;
  }

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
        input: text.slice(0, finalConfig.maxTokens * 4), // Rough token estimate
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.warn('[Embeddings] API error:', error);
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
    console.warn('[Embeddings] Failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Generate embeddings for multiple texts (batched)
 */
export async function generateEmbeddings(
  texts: string[],
  config: Partial<EmbeddingConfig> = {}
): Promise<EmbeddingResult[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[Embeddings] OPENAI_API_KEY not set');
    return [];
  }

  const finalConfig = { ...DEFAULT_EMBEDDING_CONFIG, ...config };
  const results: EmbeddingResult[] = [];

  // Process in batches
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
        console.warn('[Embeddings] Batch error, skipping batch');
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
      console.warn('[Embeddings] Batch failed:', err instanceof Error ? err.message : err);
    }

    // Rate limit protection
    if (i + finalConfig.batchSize < texts.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return results;
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
  return !!process.env.OPENAI_API_KEY;
}
