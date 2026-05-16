/**
 * Signal Embeddings System
 *
 * Provides semantic search capabilities for markets and signals:
 *   - Market similarity: Find semantically similar markets
 *   - Signal similarity: Find similar historical signals
 *   - Knowledge retrieval: RAG context for Scout evaluation
 *
 * Uses keyword-based similarity (always available) with optional
 * OpenAI embeddings when OPENAI_API_KEY is set.
 *
 * Usage:
 *   const similar = await findSimilarMarkets("Will Trump win?");
 *   const similar = await findSimilarMarketsKeyword("Trump election");
 */

import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import {
  generateEmbedding,
  generateEmbeddings,
  isEmbeddingsConfigured,
  textSimilarity,
  extractKeywords,
} from './client';
import {
  MarketEmbedding,
  SignalEmbedding,
  SimilarityResult,
  DEFAULT_EMBEDDING_CONFIG,
} from './types';

// Re-export types and utilities
export * from './types';
export * from './client';

// =============================================================================
// KEYWORD-BASED SIMILARITY (Always available - no OpenAI needed)
// =============================================================================

/**
 * Find similar markets using keyword matching (no embeddings required)
 * This works even without OpenAI API key
 */
export async function findSimilarMarketsKeyword(
  query: string,
  options?: {
    limit?: number;
    threshold?: number;
    platform?: string;
  }
): Promise<SimilarityResult[]> {
  if (!isSupabaseConfigured) return [];

  const limit = options?.limit || 5;
  const threshold = options?.threshold || 0.3; // Lower threshold for keyword matching

  try {
    // Get markets from cache
    let dbQuery = supabaseAdmin
      .from('market_cache')
      .select('market_id, title, platform, category')
      .order('volume', { ascending: false })
      .limit(500);

    if (options?.platform) {
      dbQuery = dbQuery.eq('platform', options.platform);
    }

    const { data, error } = await dbQuery;
    if (error || !data) return [];

    // Calculate keyword similarity
    const results: SimilarityResult[] = [];

    for (const market of data) {
      const marketText = `${market.title} ${market.category || ''}`;
      const similarity = textSimilarity(query, marketText);

      if (similarity >= threshold) {
        results.push({
          id: market.market_id,
          title: market.title,
          similarity,
          metadata: { platform: market.platform, category: market.category },
        });
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  } catch (err) {
    console.warn('[Embeddings] Keyword search failed:', err);
    return [];
  }
}

/**
 * Find similar signals using keyword matching (no embeddings required)
 */
export async function findSimilarSignalsKeyword(
  contextText: string,
  options?: {
    limit?: number;
    threshold?: number;
    signalType?: string;
  }
): Promise<SimilarityResult[]> {
  if (!isSupabaseConfigured) return [];

  const limit = options?.limit || 5;
  const threshold = options?.threshold || 0.3;

  try {
    let query = supabaseAdmin
      .from('signals')
      .select('id, type, market_title, llm_verdict')
      .order('created_at', { ascending: false })
      .limit(200);

    if (options?.signalType) {
      query = query.eq('type', options.signalType);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    const results: SimilarityResult[] = [];

    for (const signal of data) {
      const signalText = `${signal.market_title} ${signal.llm_verdict?.reasoning || ''}`;
      const similarity = textSimilarity(contextText, signalText);

      if (similarity >= threshold) {
        results.push({
          id: signal.id,
          content: signal.market_title,
          similarity,
          metadata: { signalType: signal.type },
        });
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  } catch (err) {
    console.warn('[Embeddings] Keyword signal search failed:', err);
    return [];
  }
}

// =============================================================================
// UNIFIED SEARCH (Uses embeddings if available, falls back to keywords)
// =============================================================================

/**
 * Embed a market and store in database
 */
export async function embedMarket(market: {
  marketId: string;
  platform: string;
  title: string;
  description?: string;
  category?: string;
}): Promise<boolean> {
  if (!isSupabaseConfigured || !isEmbeddingsConfigured()) return false;

  try {
    // Create embedding text
    const text = [
      market.title,
      market.description || '',
      market.category ? `Category: ${market.category}` : '',
    ].join(' ').trim();

    const result = await generateEmbedding(text);
    if (!result) return false;

    // Store in database
    const { error } = await supabaseAdmin
      .from('market_embeddings')
      .upsert({
        market_id: market.marketId,
        platform: market.platform,
        market_title: market.title,
        description: market.description,
        category: market.category,
        embedding: JSON.stringify(result.embedding),
        model_id: result.model,
        tokens_used: result.tokensUsed,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'market_id,platform',
      });

    if (error) {
      console.warn('[Embeddings] Failed to store market:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[Embeddings] embedMarket failed:', err);
    return false;
  }
}

/**
 * Embed a signal context and store
 */
export async function embedSignal(
  signalId: string,
  signalType: string,
  contextText: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !isEmbeddingsConfigured()) return false;

  try {
    const result = await generateEmbedding(contextText);
    if (!result) return false;

    const { error } = await supabaseAdmin
      .from('signal_embeddings')
      .insert({
        signal_id: signalId,
        signal_type: signalType,
        context_text: contextText,
        embedding: JSON.stringify(result.embedding),
        model_id: result.model,
      });

    if (error) {
      console.warn('[Embeddings] Failed to store signal:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[Embeddings] embedSignal failed:', err);
    return false;
  }
}

/**
 * Find semantically similar markets
 * Uses OpenAI embeddings if available, otherwise falls back to keyword search
 */
export async function findSimilarMarkets(
  query: string,
  options?: {
    limit?: number;
    threshold?: number;
    platform?: string;
  }
): Promise<SimilarityResult[]> {
  if (!isSupabaseConfigured) return [];

  // If OpenAI is not configured, use keyword-based search
  if (!isEmbeddingsConfigured()) {
    return findSimilarMarketsKeyword(query, options);
  }

  try {
    const result = await generateEmbedding(query);
    if (!result) {
      // Fallback to keyword search if embedding fails
      return findSimilarMarketsKeyword(query, options);
    }

    const limit = options?.limit || 5;
    const threshold = options?.threshold || 0.7;

    // Use RPC function for vector similarity search
    const { data, error } = await supabaseAdmin.rpc('find_similar_markets', {
      query_embedding: JSON.stringify(result.embedding),
      match_count: limit,
      match_threshold: threshold,
    });

    if (error) {
      // Fallback to manual search if RPC not available
      console.warn('[Embeddings] RPC failed, falling back to manual search');
      return await manualMarketSearch(result.embedding, limit, threshold, options?.platform);
    }

    return (data || []).map((row: any) => ({
      id: row.market_id,
      title: row.market_title,
      similarity: row.similarity,
      metadata: { platform: row.platform },
    }));
  } catch (err) {
    console.warn('[Embeddings] findSimilarMarkets failed, using keyword fallback:', err);
    return findSimilarMarketsKeyword(query, options);
  }
}

/**
 * Find similar historical signals
 * Uses OpenAI embeddings if available, otherwise falls back to keyword search
 */
export async function findSimilarSignals(
  contextText: string,
  options?: {
    limit?: number;
    threshold?: number;
    signalType?: string;
  }
): Promise<SimilarityResult[]> {
  if (!isSupabaseConfigured) return [];

  // If OpenAI is not configured, use keyword-based search
  if (!isEmbeddingsConfigured()) {
    return findSimilarSignalsKeyword(contextText, options);
  }

  try {
    const result = await generateEmbedding(contextText);
    if (!result) {
      return findSimilarSignalsKeyword(contextText, options);
    }

    const limit = options?.limit || 5;
    const threshold = options?.threshold || 0.7;

    const { data, error } = await supabaseAdmin.rpc('find_similar_signals', {
      query_embedding: JSON.stringify(result.embedding),
      match_count: limit,
      match_threshold: threshold,
    });

    if (error) {
      console.warn('[Embeddings] Signal search RPC failed:', error.message);
      return findSimilarSignalsKeyword(contextText, options);
    }

    return (data || []).map((row: any) => ({
      id: row.signal_id,
      content: row.context_text,
      similarity: row.similarity,
      metadata: { signalType: row.signal_type },
    }));
  } catch (err) {
    console.warn('[Embeddings] findSimilarSignals failed, using keyword fallback:', err);
    return findSimilarSignalsKeyword(contextText, options);
  }
}

/**
 * Manual market search fallback (when RPC not available)
 */
async function manualMarketSearch(
  embedding: number[],
  limit: number,
  threshold: number,
  platform?: string
): Promise<SimilarityResult[]> {
  try {
    let query = supabaseAdmin
      .from('market_embeddings')
      .select('market_id, market_title, platform, embedding')
      .limit(500); // Fetch more for manual filtering

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    // Calculate similarities manually
    const { cosineSimilarity } = await import('./client');

    const results: SimilarityResult[] = [];
    for (const row of data) {
      const storedEmbedding = typeof row.embedding === 'string'
        ? JSON.parse(row.embedding)
        : row.embedding;

      const similarity = cosineSimilarity(embedding, storedEmbedding);
      if (similarity >= threshold) {
        results.push({
          id: row.market_id,
          title: row.market_title,
          similarity,
          metadata: { platform: row.platform },
        });
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  } catch (err) {
    console.warn('[Embeddings] Manual search failed:', err);
    return [];
  }
}

/**
 * Batch embed multiple markets
 */
export async function embedMarkets(
  markets: Array<{
    marketId: string;
    platform: string;
    title: string;
    description?: string;
    category?: string;
  }>
): Promise<number> {
  if (!isSupabaseConfigured || !isEmbeddingsConfigured()) return 0;

  // Create texts for embedding
  const texts = markets.map(m => [
    m.title,
    m.description || '',
    m.category ? `Category: ${m.category}` : '',
  ].join(' ').trim());

  const embeddings = await generateEmbeddings(texts);
  if (embeddings.length === 0) return 0;

  let embedded = 0;

  for (let i = 0; i < Math.min(markets.length, embeddings.length); i++) {
    const market = markets[i];
    const result = embeddings[i];

    try {
      const { error } = await supabaseAdmin
        .from('market_embeddings')
        .upsert({
          market_id: market.marketId,
          platform: market.platform,
          market_title: market.title,
          description: market.description,
          category: market.category,
          embedding: JSON.stringify(result.embedding),
          model_id: result.model,
          tokens_used: result.tokensUsed,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'market_id,platform',
        });

      if (!error) embedded++;
    } catch (err) {
      // Continue with next
    }
  }

  return embedded;
}

/**
 * Get embedding stats
 */
export async function getEmbeddingStats(): Promise<{
  marketEmbeddings: number;
  signalEmbeddings: number;
  knowledgeChunks: number;
}> {
  if (!isSupabaseConfigured) {
    return { marketEmbeddings: 0, signalEmbeddings: 0, knowledgeChunks: 0 };
  }

  try {
    const [markets, signals, knowledge] = await Promise.all([
      supabaseAdmin.from('market_embeddings').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('signal_embeddings').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('knowledge_chunks').select('id', { count: 'exact', head: true }),
    ]);

    return {
      marketEmbeddings: markets.count || 0,
      signalEmbeddings: signals.count || 0,
      knowledgeChunks: knowledge.count || 0,
    };
  } catch {
    return { marketEmbeddings: 0, signalEmbeddings: 0, knowledgeChunks: 0 };
  }
}
