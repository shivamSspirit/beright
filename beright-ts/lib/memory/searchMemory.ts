/**
 * Semantic Memory Search
 *
 * Provides semantic search capabilities for memory entries using embeddings.
 * Uses Mistral embeddings with pgvector for similarity search.
 *
 * Features:
 * - Generate embeddings for new memory entries
 * - Semantic similarity search
 * - Hybrid search (text + semantic)
 * - Automatic embedding on store
 */

import { supabaseAdmin } from '../supabase/client';
import { secrets } from '../secrets';
import type { MemoryEntry, MemoryEntryType } from '../supabase/types';

// ============================================
// CONSTANTS
// ============================================

// Mistral embed produces 1024-dimensional embeddings
export const EMBEDDING_DIMENSIONS = 1024;

// ============================================
// TYPES
// ============================================

export interface MemorySearchResult {
  entry: MemoryEntry;
  score: number;
  source: 'text' | 'semantic';
}

export interface SemanticSearchOptions {
  limit?: number;
  entryTypes?: MemoryEntryType[];
  threshold?: number;
  includeExpired?: boolean;
}

// ============================================
// EMBEDDING GENERATION
// ============================================

/**
 * Generate embedding using Mistral's embedding model
 * Falls back to null if API unavailable
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const mistralKey = secrets.getMistralApiKey();

  if (!mistralKey) {
    console.warn('[SemanticSearch] Mistral API key not configured, skipping embedding');
    return null;
  }

  try {
    const response = await fetch('https://api.mistral.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mistralKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-embed',
        input: [text.slice(0, 8000)], // Limit input length, Mistral expects array
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[SemanticSearch] Mistral embedding API error:', error);
      return null;
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('[SemanticSearch] Failed to generate embedding:', error);
    return null;
  }
}

/**
 * Store embedding for a memory entry
 */
export async function storeEmbedding(memoryId: string, embedding: number[]): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('memory_entries')
      .update({ embedding })
      .eq('id', memoryId);

    if (error) {
      console.error('[SemanticSearch] Failed to store embedding:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SemanticSearch] Store embedding error:', error);
    return false;
  }
}

/**
 * Generate and store embedding for new memory entry
 */
export async function embedMemoryEntry(memoryId: string, content: string): Promise<boolean> {
  const embedding = await generateEmbedding(content);

  if (!embedding) {
    return false;
  }

  return storeEmbedding(memoryId, embedding);
}

// ============================================
// SEMANTIC SEARCH
// ============================================

/**
 * Search memories using semantic similarity
 */
export async function semanticSearch(
  walletAddress: string,
  query: string,
  options?: SemanticSearchOptions
): Promise<MemorySearchResult[]> {
  const {
    limit = 10,
    entryTypes,
    threshold = 0.5,
    includeExpired = false,
  } = options || {};

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  if (!queryEmbedding) {
    console.warn('[SemanticSearch] Could not generate query embedding, falling back to text search');
    return textFallbackSearch(walletAddress, query, limit);
  }

  try {
    // Use pgvector similarity search via RPC function
    const { data, error } = await supabaseAdmin.rpc('match_memories', {
      query_embedding: queryEmbedding,
      match_wallet: walletAddress,
      match_threshold: threshold,
      match_count: limit,
      filter_types: entryTypes || null,
      include_expired: includeExpired,
    });

    if (error) {
      // If RPC function doesn't exist, fall back to text search
      if (error.message.includes('does not exist')) {
        console.warn('[SemanticSearch] match_memories RPC not found, using text fallback');
        return textFallbackSearch(walletAddress, query, limit);
      }
      throw error;
    }

    return (data || []).map((row: any) => ({
      entry: {
        id: row.id,
        wallet_address: row.wallet_address,
        entry_type: row.entry_type,
        content: row.content,
        agent_source: row.agent_source,
        conversation_id: row.conversation_id,
        entry_date: row.entry_date,
        importance: row.importance,
        last_accessed_at: row.last_accessed_at,
        access_count: row.access_count,
        created_at: row.created_at,
        expires_at: row.expires_at,
      } as MemoryEntry,
      score: row.similarity,
      source: 'semantic' as const,
    }));
  } catch (error) {
    console.error('[SemanticSearch] Search failed:', error);
    return textFallbackSearch(walletAddress, query, limit);
  }
}

/**
 * Text-based fallback search when semantic search unavailable
 */
async function textFallbackSearch(
  walletAddress: string,
  query: string,
  limit: number
): Promise<MemorySearchResult[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('memory_entries')
      .select('*')
      .eq('wallet_address', walletAddress)
      .textSearch('search_vector', query)
      .order('importance', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[SemanticSearch] Text fallback failed:', error);
      return [];
    }

    return (data || []).map((entry: MemoryEntry) => ({
      entry,
      score: 0.7, // Default score for text matches
      source: 'text' as const,
    }));
  } catch (error) {
    console.error('[SemanticSearch] Text fallback error:', error);
    return [];
  }
}

/**
 * Hybrid search combining semantic and text search
 */
export async function hybridSearch(
  walletAddress: string,
  query: string,
  options?: SemanticSearchOptions & { textWeight?: number }
): Promise<MemorySearchResult[]> {
  const { textWeight = 0.3, limit = 10, ...searchOptions } = options || {};
  const semanticWeight = 1 - textWeight;

  // Run both searches in parallel
  const [semanticResults, textResults] = await Promise.all([
    semanticSearch(walletAddress, query, { ...searchOptions, limit }),
    textFallbackSearch(walletAddress, query, limit),
  ]);

  // Combine and deduplicate results
  const resultMap = new Map<string, MemorySearchResult>();

  // Add semantic results with weighted score
  for (const result of semanticResults) {
    resultMap.set(result.entry.id, {
      ...result,
      score: result.score * semanticWeight,
    });
  }

  // Add text results, combining scores if duplicate
  for (const result of textResults) {
    const existing = resultMap.get(result.entry.id);
    if (existing) {
      existing.score += result.score * textWeight;
    } else {
      resultMap.set(result.entry.id, {
        ...result,
        score: result.score * textWeight,
      });
    }
  }

  // Sort by combined score and limit
  return Array.from(resultMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Find similar memories to a given entry
 */
export async function findSimilarMemories(
  memoryId: string,
  walletAddress: string,
  limit: number = 5
): Promise<MemorySearchResult[]> {
  try {
    // Get the source memory
    const { data: memory, error } = await supabaseAdmin
      .from('memory_entries')
      .select('content, embedding')
      .eq('id', memoryId)
      .single();

    if (error || !memory) {
      console.error('[SemanticSearch] Source memory not found:', error);
      return [];
    }

    // Use embedding if available, otherwise use content for text search
    if (memory.embedding) {
      const { data, error: searchError } = await supabaseAdmin.rpc('match_memories', {
        query_embedding: memory.embedding,
        match_wallet: walletAddress,
        match_threshold: 0.7,
        match_count: limit + 1, // +1 to exclude self
        filter_types: null,
        include_expired: false,
      });

      if (searchError) {
        console.error('[SemanticSearch] Similar search failed:', searchError);
        return [];
      }

      return (data || [])
        .filter((row: any) => row.id !== memoryId)
        .slice(0, limit)
        .map((row: any) => ({
          entry: row as MemoryEntry,
          score: row.similarity,
          source: 'semantic' as const,
        }));
    }

    // Fallback to text search
    return textFallbackSearch(walletAddress, memory.content, limit);
  } catch (error) {
    console.error('[SemanticSearch] Find similar error:', error);
    return [];
  }
}

export default { semanticSearch, hybridSearch, generateEmbedding, embedMemoryEntry };
