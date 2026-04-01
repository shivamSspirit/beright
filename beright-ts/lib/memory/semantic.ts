/**
 * Semantic Search for Memory & Conversations
 *
 * Uses pgvector for vector similarity search with OpenAI embeddings.
 * Falls back to keyword-based similarity when embeddings unavailable.
 *
 * Enables queries like:
 * - "find conversations where I discussed arbitrage"
 * - "what did I decide about Trump markets?"
 * - "search for anything related to risk tolerance"
 */

import { supabaseAdmin } from '../supabase/client';
import {
  generateEmbedding,
  isEmbeddingsConfigured,
  textSimilarity,
} from '../embeddings/client';
import type { MemoryEntry, MessageSearchResult, MemorySearchResult } from '../supabase/types';

// Vector dimensions (Mistral: 1024, OpenAI: 1536)
// Using 1024 for Mistral compatibility
const EMBEDDING_DIMENSIONS = 1024;

// ============================================
// EMBEDDING GENERATION
// ============================================

/**
 * Generate embedding for text content
 * Returns null if embeddings not configured
 */
export async function generateContentEmbedding(text: string): Promise<number[] | null> {
  const result = await generateEmbedding(text);
  return result?.embedding || null;
}

/**
 * Generate and store embedding for a memory entry
 */
export async function embedMemoryEntry(entryId: string, content: string): Promise<boolean> {
  const embedding = await generateContentEmbedding(content);
  if (!embedding) return false;

  try {
    const { error } = await supabaseAdmin.rpc('update_memory_embedding', {
      p_entry_id: entryId,
      p_embedding: embedding,
    });

    if (error) {
      console.error('[Semantic] Failed to store memory embedding:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Semantic] Exception storing memory embedding:', err);
    return false;
  }
}

/**
 * Generate and store embedding for a message
 */
export async function embedMessage(messageId: string, content: string): Promise<boolean> {
  const embedding = await generateContentEmbedding(content);
  if (!embedding) return false;

  try {
    const { error } = await supabaseAdmin.rpc('update_message_embedding', {
      p_message_id: messageId,
      p_embedding: embedding,
    });

    if (error) {
      console.error('[Semantic] Failed to store message embedding:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Semantic] Exception storing message embedding:', err);
    return false;
  }
}

// ============================================
// SEMANTIC SEARCH FUNCTIONS
// ============================================

export interface SemanticSearchOptions {
  limit?: number;
  threshold?: number; // Minimum similarity score (0-1)
  entryType?: string;
}

/**
 * Semantic search through memory entries
 * Uses pgvector cosine similarity when available, falls back to keyword matching
 */
export async function semanticSearchMemory(
  walletAddress: string,
  query: string,
  options: SemanticSearchOptions = {}
): Promise<MemorySearchResult[]> {
  const { limit = 10, threshold = 0.5, entryType } = options;

  // Try vector search first if embeddings configured
  if (isEmbeddingsConfigured()) {
    const queryEmbedding = await generateContentEmbedding(query);

    if (queryEmbedding) {
      try {
        const { data, error } = await supabaseAdmin.rpc('semantic_search_memory', {
          p_wallet_address: walletAddress,
          p_query_embedding: queryEmbedding,
          p_match_threshold: threshold,
          p_match_count: limit,
          p_entry_type: entryType || null,
        });

        if (!error && data && data.length > 0) {
          return data as MemorySearchResult[];
        }

        // If RPC fails (function not created yet), fall through to keyword search
        if (error && !error.message.includes('does not exist')) {
          console.warn('[Semantic] Vector search error:', error.message);
        }
      } catch (err) {
        console.warn('[Semantic] Vector search exception, using keyword fallback');
      }
    }
  }

  // Fallback: keyword-based search
  return keywordSearchMemory(walletAddress, query, options);
}

/**
 * Keyword-based memory search (fallback)
 */
async function keywordSearchMemory(
  walletAddress: string,
  query: string,
  options: SemanticSearchOptions = {}
): Promise<MemorySearchResult[]> {
  const { limit = 10, entryType } = options;

  // Get all memory entries for wallet
  let dbQuery = supabaseAdmin
    .from('memory_entries')
    .select('id, content, entry_type, agent_source, created_at')
    .eq('wallet_address', walletAddress)
    .order('importance', { ascending: false })
    .limit(limit * 3); // Get more for filtering

  if (entryType) {
    dbQuery = dbQuery.eq('entry_type', entryType);
  }

  const { data, error } = await dbQuery;
  if (error || !data) return [];

  // Calculate text similarity and rank
  const scored = data
    .map((entry: any) => ({
      ...entry,
      similarity: textSimilarity(query, entry.content),
    }))
    .filter((entry: any) => entry.similarity > 0.1)
    .sort((a: any, b: any) => b.similarity - a.similarity)
    .slice(0, limit);

  return scored as MemorySearchResult[];
}

/**
 * Semantic search through past conversations
 * Searches message content with vector similarity
 */
export async function semanticSearchConversations(
  walletAddress: string,
  query: string,
  options: SemanticSearchOptions = {}
): Promise<Array<{
  conversation_id: string;
  title: string | null;
  matched_content: string;
  similarity: number;
  message_count: number;
}>> {
  const { limit = 10, threshold = 0.4 } = options;

  // Try vector search first
  if (isEmbeddingsConfigured()) {
    const queryEmbedding = await generateContentEmbedding(query);

    if (queryEmbedding) {
      try {
        const { data, error } = await supabaseAdmin.rpc('semantic_search_conversations', {
          p_wallet_address: walletAddress,
          p_query_embedding: queryEmbedding,
          p_match_threshold: threshold,
          p_match_count: limit,
        });

        if (!error && data && data.length > 0) {
          return data;
        }

        if (error && !error.message.includes('does not exist')) {
          console.warn('[Semantic] Conversation vector search error:', error.message);
        }
      } catch (err) {
        console.warn('[Semantic] Conversation vector search exception, using keyword fallback');
      }
    }
  }

  // Fallback: keyword search via full-text
  return keywordSearchConversations(walletAddress, query, options);
}

/**
 * Keyword-based conversation search (fallback)
 */
async function keywordSearchConversations(
  walletAddress: string,
  query: string,
  options: SemanticSearchOptions = {}
): Promise<Array<{
  conversation_id: string;
  title: string | null;
  matched_content: string;
  similarity: number;
  message_count: number;
}>> {
  const { limit = 10 } = options;

  try {
    // Get messages matching the query via text search
    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select(`
        conversation_id,
        content,
        conversations!inner(wallet_address, title)
      `)
      .eq('conversations.wallet_address', walletAddress)
      .textSearch('content', query, { type: 'websearch' })
      .limit(limit * 3);

    if (error || !messages) return [];

    // Group by conversation and calculate relevance
    const conversationMap = new Map<string, {
      conversation_id: string;
      title: string | null;
      matched_content: string;
      similarity: number;
      message_count: number;
    }>();

    for (const msg of messages) {
      const convId = msg.conversation_id;
      const convData = msg.conversations as any;
      const similarity = textSimilarity(query, msg.content);

      if (!conversationMap.has(convId)) {
        conversationMap.set(convId, {
          conversation_id: convId,
          title: convData?.title || null,
          matched_content: msg.content.slice(0, 200),
          similarity,
          message_count: 1,
        });
      } else {
        const existing = conversationMap.get(convId)!;
        existing.message_count++;
        if (similarity > existing.similarity) {
          existing.similarity = similarity;
          existing.matched_content = msg.content.slice(0, 200);
        }
      }
    }

    // Sort by similarity and return top results
    return Array.from(conversationMap.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  } catch (err) {
    console.error('[Semantic] Keyword conversation search error:', err);
    return [];
  }
}

/**
 * Find similar memory entries to a given entry
 */
export async function findSimilarMemories(
  walletAddress: string,
  referenceContent: string,
  options: SemanticSearchOptions = {}
): Promise<MemorySearchResult[]> {
  return semanticSearchMemory(walletAddress, referenceContent, {
    ...options,
    threshold: options.threshold || 0.6,
  });
}

// ============================================
// BATCH EMBEDDING GENERATION
// ============================================

/**
 * Batch embed all memory entries without embeddings
 * Call this during maintenance or initialization
 */
export async function batchEmbedMemoryEntries(
  walletAddress?: string,
  batchSize: number = 50
): Promise<{ processed: number; succeeded: number; failed: number }> {
  if (!isEmbeddingsConfigured()) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let query = supabaseAdmin
    .from('memory_entries')
    .select('id, content')
    .is('embedding', null)
    .limit(batchSize);

  if (walletAddress) {
    query = query.eq('wallet_address', walletAddress);
  }

  const { data: entries, error } = await query;
  if (error || !entries) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (const entry of entries) {
    const success = await embedMemoryEntry(entry.id, entry.content);
    if (success) {
      succeeded++;
    } else {
      failed++;
    }

    // Rate limit protection
    await new Promise((r) => setTimeout(r, 100));
  }

  return { processed: entries.length, succeeded, failed };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if semantic search is available
 */
export function isSemanticSearchAvailable(): boolean {
  return isEmbeddingsConfigured();
}

/**
 * Get embedding configuration status
 */
export function getSemanticStatus(): {
  embeddingsConfigured: boolean;
  model: string;
  dimensions: number;
} {
  return {
    embeddingsConfigured: isEmbeddingsConfigured(),
    model: 'text-embedding-3-small',
    dimensions: EMBEDDING_DIMENSIONS,
  };
}

export default {
  generateContentEmbedding,
  embedMemoryEntry,
  embedMessage,
  semanticSearchMemory,
  semanticSearchConversations,
  findSimilarMemories,
  batchEmbedMemoryEntries,
  isSemanticSearchAvailable,
  getSemanticStatus,
};
