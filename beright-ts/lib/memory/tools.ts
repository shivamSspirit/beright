/**
 * Memory Tools for Gateway Agents
 *
 * BeRight-compatible memory system that enables agents to:
 * - Store persistent facts about users (preferences, strategies, decisions)
 * - Save daily notes with insights and observations
 * - Search through memory semantically (pgvector + OpenAI embeddings)
 * - Retrieve conversation context
 * - Find related conversations via semantic similarity
 *
 * Usage: Import MEMORY_TOOLS and add to your agent's tool array
 */

import { supabaseAdmin as supabase } from '../supabase/client';
import {
  semanticSearchMemory,
  semanticSearchConversations,
  isSemanticSearchAvailable,
  embedMemoryEntry,
} from './semantic';

// ============ TYPES ============

export type MemoryEntryType = 'fact' | 'preference' | 'decision' | 'insight' | 'strategy' | 'daily_note';

export interface MemoryEntry {
  id: string;
  wallet_address: string;
  entry_type: MemoryEntryType;
  content: string;
  agent_source?: string;
  conversation_id?: string;
  entry_date?: string;
  importance?: number;
  expires_at?: string;
  created_at: string;
}

export interface MemoryToolParams {
  wallet_address: string;
  conversation_id?: string;
}

// ============ MEMORY OPERATIONS ============

/**
 * Save a memory entry to persistent storage
 */
export async function saveMemory(params: {
  wallet_address: string;
  entry_type: MemoryEntryType;
  content: string;
  agent_source?: string;
  conversation_id?: string;
  importance?: number;
  expires_at?: string;
}): Promise<MemoryEntry | null> {
  try {
    const { data, error } = await supabase
      .from('memory_entries')
      .insert({
        wallet_address: params.wallet_address,
        entry_type: params.entry_type,
        content: params.content,
        agent_source: params.agent_source,
        conversation_id: params.conversation_id,
        importance: params.importance || 5,
        expires_at: params.expires_at,
      })
      .select()
      .single();

    if (error) {
      console.error('[Memory] Save error:', error);
      return null;
    }

    // Async embed the memory entry (non-blocking)
    if (data && isSemanticSearchAvailable()) {
      embedMemoryEntry(data.id, params.content).catch((err) => {
        console.warn('[Memory] Embedding generation failed:', err);
      });
    }

    return data;
  } catch (error) {
    console.error('[Memory] Save exception:', error);
    return null;
  }
}

/**
 * Get persistent memory for a wallet
 */
export async function getMemory(params: {
  wallet_address: string;
  entry_type?: MemoryEntryType;
  limit?: number;
}): Promise<MemoryEntry[]> {
  try {
    let query = supabase
      .from('memory_entries')
      .select('*')
      .eq('wallet_address', params.wallet_address)
      .order('importance', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(params.limit || 20);

    if (params.entry_type) {
      query = query.eq('entry_type', params.entry_type);
    }

    // Exclude expired entries
    query = query.or('expires_at.is.null,expires_at.gt.now()');

    const { data, error } = await query;

    if (error) {
      console.error('[Memory] Get error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[Memory] Get exception:', error);
    return [];
  }
}

/**
 * Search memory using full-text search
 */
export async function searchMemory(params: {
  wallet_address: string;
  query: string;
  limit?: number;
  entry_type?: MemoryEntryType;
}): Promise<MemoryEntry[]> {
  try {
    // Use PostgreSQL full-text search
    let query = supabase
      .from('memory_entries')
      .select('*')
      .eq('wallet_address', params.wallet_address)
      .textSearch('content', params.query, { type: 'websearch' })
      .order('importance', { ascending: false })
      .limit(params.limit || 10);

    if (params.entry_type) {
      query = query.eq('entry_type', params.entry_type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Memory] Search error:', error);
      // Fallback to ILIKE if full-text search fails
      const fallbackQuery = supabase
        .from('memory_entries')
        .select('*')
        .eq('wallet_address', params.wallet_address)
        .ilike('content', `%${params.query}%`)
        .order('importance', { ascending: false })
        .limit(params.limit || 10);

      const fallbackResult = await fallbackQuery;
      return fallbackResult.data || [];
    }

    return data || [];
  } catch (error) {
    console.error('[Memory] Search exception:', error);
    return [];
  }
}

/**
 * Save a daily note (BeRight pattern)
 */
export async function saveDailyNote(params: {
  wallet_address: string;
  content: string;
  agent_source?: string;
  conversation_id?: string;
  date?: string;
}): Promise<MemoryEntry | null> {
  const entryDate = params.date || new Date().toISOString().split('T')[0];

  return saveMemory({
    wallet_address: params.wallet_address,
    entry_type: 'daily_note',
    content: `[${entryDate}] ${params.content}`,
    agent_source: params.agent_source,
    conversation_id: params.conversation_id,
    importance: 3, // Daily notes have medium importance
  });
}

/**
 * Get daily notes for a wallet
 */
export async function getDailyNotes(params: {
  wallet_address: string;
  date?: string;
  limit?: number;
}): Promise<MemoryEntry[]> {
  try {
    let query = supabase
      .from('memory_entries')
      .select('*')
      .eq('wallet_address', params.wallet_address)
      .eq('entry_type', 'daily_note')
      .order('created_at', { ascending: false })
      .limit(params.limit || 10);

    if (params.date) {
      // Filter by date prefix in content
      query = query.ilike('content', `[${params.date}]%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Memory] Get daily notes error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[Memory] Get daily notes exception:', error);
    return [];
  }
}

/**
 * Get conversation context (recent messages)
 */
export async function getConversationContext(params: {
  conversation_id: string;
  limit?: number;
}): Promise<Array<{ role: string; content: string; agent_type?: string }>> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('role, content, agent_type')
      .eq('conversation_id', params.conversation_id)
      .order('created_at', { ascending: false })
      .limit(params.limit || 20);

    if (error) {
      console.error('[Memory] Get context error:', error);
      return [];
    }

    // Return in chronological order
    return (data || []).reverse();
  } catch (error) {
    console.error('[Memory] Get context exception:', error);
    return [];
  }
}

/**
 * Search past conversations
 */
export async function searchConversations(params: {
  wallet_address: string;
  query: string;
  limit?: number;
}): Promise<Array<{ conversation_id: string; title: string; matched_content: string }>> {
  try {
    // Search messages for content
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        conversation_id,
        content,
        conversations!inner(wallet_address, title)
      `)
      .eq('conversations.wallet_address', params.wallet_address)
      .textSearch('content', params.query, { type: 'websearch' })
      .limit(params.limit || 10);

    if (error) {
      console.error('[Memory] Search conversations error:', error);
      return [];
    }

    // Deduplicate by conversation
    const conversationMap = new Map<string, { conversation_id: string; title: string; matched_content: string }>();
    for (const msg of messages || []) {
      if (!conversationMap.has(msg.conversation_id)) {
        conversationMap.set(msg.conversation_id, {
          conversation_id: msg.conversation_id,
          title: (msg.conversations as any)?.title || 'Untitled',
          matched_content: msg.content.slice(0, 200),
        });
      }
    }

    return Array.from(conversationMap.values());
  } catch (error) {
    console.error('[Memory] Search conversations exception:', error);
    return [];
  }
}

// ============ TOOL DEFINITIONS ============

export interface MemoryTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
  // Two signatures: with context (for direct use) or without (wallet_address in params)
  execute: (params: Record<string, any>, context?: MemoryToolParams) => Promise<any>;
}

/**
 * Memory tools for agent integration
 * Import and spread into your agent's TOOLS array
 *
 * These tools accept wallet_address as a parameter OR via context.
 * This allows them to work with the current agent architecture where
 * userId/wallet is passed in the request.
 */
export const MEMORY_TOOLS: MemoryTool[] = [
  {
    name: 'save_memory',
    description: `Save an important fact, preference, decision, insight, or strategy about the user to persistent memory.
Use this when the user shares:
- Trading preferences (e.g., "I prefer high-volume markets")
- Strategies (e.g., "I usually buy YES when probability < 30%")
- Decisions (e.g., "User decided to exit all positions in crypto markets")
- Facts (e.g., "User's risk tolerance is conservative")
- Insights (e.g., "User tends to be bullish on tech events")

The memory will persist across conversations and help provide personalized responses.`,
    parameters: {
      type: 'object',
      properties: {
        wallet_address: {
          type: 'string',
          description: 'The user wallet address (required if not in context)',
        },
        entry_type: {
          type: 'string',
          description: 'Type of memory entry',
          enum: ['fact', 'preference', 'decision', 'insight', 'strategy'],
        },
        content: {
          type: 'string',
          description: 'The information to remember. Be specific and include context.',
        },
        importance: {
          type: 'number',
          description: 'Importance level 1-10. Higher = more important. Default: 5',
        },
      },
      required: ['entry_type', 'content'],
    },
    execute: async (params, context) => {
      const walletAddress = params.wallet_address || context?.wallet_address;
      if (!walletAddress) {
        return { success: false, error: 'wallet_address required' };
      }

      const entry = await saveMemory({
        wallet_address: walletAddress,
        entry_type: params.entry_type,
        content: params.content,
        agent_source: 'AGENT',
        conversation_id: context?.conversation_id,
        importance: params.importance || 5,
      });

      return {
        success: !!entry,
        message: entry ? 'Memory saved successfully' : 'Failed to save memory',
        entry,
      };
    },
  },

  {
    name: 'get_user_memory',
    description: `Retrieve persistent memory about the user including their preferences, past decisions, strategies, and insights.
Use this at the start of complex tasks to personalize your response based on what you know about the user.
Also useful when the user asks questions like "what do you know about me?" or references past conversations.`,
    parameters: {
      type: 'object',
      properties: {
        wallet_address: {
          type: 'string',
          description: 'The user wallet address (required if not in context)',
        },
        entry_type: {
          type: 'string',
          description: 'Filter by type of memory (optional)',
          enum: ['fact', 'preference', 'decision', 'insight', 'strategy'],
        },
        limit: {
          type: 'number',
          description: 'Maximum entries to retrieve. Default: 20',
        },
      },
    },
    execute: async (params, context) => {
      const walletAddress = params.wallet_address || context?.wallet_address;
      if (!walletAddress) {
        return { success: false, error: 'wallet_address required', entries: [] };
      }

      const entries = await getMemory({
        wallet_address: walletAddress,
        entry_type: params.entry_type,
        limit: params.limit,
      });

      return {
        success: true,
        count: entries.length,
        entries: entries.map((e) => ({
          type: e.entry_type,
          content: e.content,
          importance: e.importance,
          created: e.created_at,
        })),
      };
    },
  },

  {
    name: 'search_memory',
    description: `Search through the user's persistent memory for specific topics, markets, or concepts.
Use this when the user asks about something they might have discussed before, or when you need to find
relevant past decisions/strategies for the current query.

Example queries: "Trump", "crypto markets", "risk tolerance", "arbitrage strategy"`,
    parameters: {
      type: 'object',
      properties: {
        wallet_address: {
          type: 'string',
          description: 'The user wallet address (required if not in context)',
        },
        query: {
          type: 'string',
          description: 'Search query - keywords or phrases to find in memory',
        },
        entry_type: {
          type: 'string',
          description: 'Filter by type of memory (optional)',
          enum: ['fact', 'preference', 'decision', 'insight', 'strategy'],
        },
        limit: {
          type: 'number',
          description: 'Maximum results. Default: 10',
        },
      },
      required: ['query'],
    },
    execute: async (params, context) => {
      const walletAddress = params.wallet_address || context?.wallet_address;
      if (!walletAddress) {
        return { success: false, error: 'wallet_address required', entries: [] };
      }

      const entries = await searchMemory({
        wallet_address: walletAddress,
        query: params.query,
        entry_type: params.entry_type,
        limit: params.limit,
      });

      return {
        success: true,
        query: params.query,
        count: entries.length,
        entries: entries.map((e) => ({
          type: e.entry_type,
          content: e.content,
          importance: e.importance,
        })),
      };
    },
  },

  {
    name: 'save_daily_note',
    description: `Save a daily observation or note about the user's activity.
This follows the BeRight daily notes pattern - ideal for tracking:
- Session summaries
- Important market events discussed
- Changes in user sentiment or strategy
- Notable predictions or research conducted

Daily notes help build a timeline of user activity and evolution.`,
    parameters: {
      type: 'object',
      properties: {
        wallet_address: {
          type: 'string',
          description: 'The user wallet address (required if not in context)',
        },
        content: {
          type: 'string',
          description: 'The note content. Will be prefixed with the date automatically.',
        },
      },
      required: ['content'],
    },
    execute: async (params, context) => {
      const walletAddress = params.wallet_address || context?.wallet_address;
      if (!walletAddress) {
        return { success: false, error: 'wallet_address required' };
      }

      const entry = await saveDailyNote({
        wallet_address: walletAddress,
        content: params.content,
        agent_source: 'AGENT',
        conversation_id: context?.conversation_id,
      });

      return {
        success: !!entry,
        message: entry ? 'Daily note saved' : 'Failed to save note',
      };
    },
  },

  {
    name: 'get_daily_notes',
    description: `Retrieve daily notes for the user. Useful for understanding recent activity
and providing continuity across sessions. Notes are returned in reverse chronological order.`,
    parameters: {
      type: 'object',
      properties: {
        wallet_address: {
          type: 'string',
          description: 'The user wallet address (required if not in context)',
        },
        date: {
          type: 'string',
          description: 'Filter by specific date (YYYY-MM-DD format). Optional.',
        },
        limit: {
          type: 'number',
          description: 'Maximum notes to retrieve. Default: 10',
        },
      },
    },
    execute: async (params, context) => {
      const walletAddress = params.wallet_address || context?.wallet_address;
      if (!walletAddress) {
        return { success: false, error: 'wallet_address required', notes: [] };
      }

      const notes = await getDailyNotes({
        wallet_address: walletAddress,
        date: params.date,
        limit: params.limit,
      });

      return {
        success: true,
        count: notes.length,
        notes: notes.map((n) => ({
          content: n.content,
          created: n.created_at,
        })),
      };
    },
  },

  {
    name: 'get_conversation_context',
    description: `Get recent messages from the current conversation for context.
Use this when you need to reference what was discussed earlier in the conversation
but don't have it in your immediate context window.`,
    parameters: {
      type: 'object',
      properties: {
        conversation_id: {
          type: 'string',
          description: 'The conversation ID (required if not in context)',
        },
        limit: {
          type: 'number',
          description: 'Number of recent messages to retrieve. Default: 20',
        },
      },
    },
    execute: async (params, context) => {
      const conversationId = params.conversation_id || context?.conversation_id;
      if (!conversationId) {
        return {
          success: false,
          message: 'conversation_id required',
          messages: [],
        };
      }

      const messages = await getConversationContext({
        conversation_id: conversationId,
        limit: params.limit,
      });

      return {
        success: true,
        count: messages.length,
        messages,
      };
    },
  },

  {
    name: 'search_past_conversations',
    description: `Search through the user's past conversations for specific topics.
Use this when the user references something they discussed before, like:
- "What did I decide about the Trump market?"
- "Find our conversation about arbitrage"
- "When did we discuss Bitcoin?"

Returns matching conversations with snippets of relevant content.`,
    parameters: {
      type: 'object',
      properties: {
        wallet_address: {
          type: 'string',
          description: 'The user wallet address (required if not in context)',
        },
        query: {
          type: 'string',
          description: 'Search query - keywords to find in past conversations',
        },
        limit: {
          type: 'number',
          description: 'Maximum conversations to return. Default: 10',
        },
      },
      required: ['query'],
    },
    execute: async (params, context) => {
      const walletAddress = params.wallet_address || context?.wallet_address;
      if (!walletAddress) {
        return { success: false, error: 'wallet_address required', conversations: [] };
      }

      const conversations = await searchConversations({
        wallet_address: walletAddress,
        query: params.query,
        limit: params.limit,
      });

      return {
        success: true,
        query: params.query,
        count: conversations.length,
        conversations,
      };
    },
  },

  // ============ SEMANTIC SEARCH TOOLS ============

  {
    name: 'semantic_search_memory',
    description: `Search memory using semantic similarity (AI-powered understanding).
This goes beyond keyword matching to find conceptually related memories.

Use this for queries like:
- "Find memories about risk management" (matches "I prefer conservative positions")
- "What do I think about crypto" (matches discussions about Bitcoin, Ethereum, DeFi)
- "My trading philosophy" (matches strategies, preferences, insights)

More accurate than keyword search for understanding user intent.`,
    parameters: {
      type: 'object',
      properties: {
        wallet_address: {
          type: 'string',
          description: 'The user wallet address (required if not in context)',
        },
        query: {
          type: 'string',
          description: 'Natural language query describing what you want to find',
        },
        entry_type: {
          type: 'string',
          description: 'Filter by memory type (optional)',
          enum: ['fact', 'preference', 'decision', 'insight', 'strategy'],
        },
        limit: {
          type: 'number',
          description: 'Maximum results. Default: 10',
        },
        threshold: {
          type: 'number',
          description: 'Minimum similarity score (0-1). Default: 0.5',
        },
      },
      required: ['query'],
    },
    execute: async (params, context) => {
      const walletAddress = params.wallet_address || context?.wallet_address;
      if (!walletAddress) {
        return { success: false, error: 'wallet_address required', entries: [] };
      }

      const entries = await semanticSearchMemory(walletAddress, params.query, {
        limit: params.limit,
        threshold: params.threshold,
        entryType: params.entry_type,
      });

      return {
        success: true,
        query: params.query,
        semantic_search: isSemanticSearchAvailable(),
        count: entries.length,
        entries: entries.map((e) => ({
          type: e.entry_type,
          content: e.content,
          similarity: e.similarity,
          created: e.created_at,
        })),
      };
    },
  },

  {
    name: 'semantic_search_conversations',
    description: `Find past conversations using semantic similarity.
This helps locate conversations where concepts were discussed, even if exact words weren't used.

Use this for queries like:
- "Find where I discussed market predictions" (finds forecasting discussions)
- "Conversations about my strategy" (finds strategic planning chats)
- "When did I talk about risk" (finds risk-related discussions)

Returns conversations ranked by relevance with preview of matching content.`,
    parameters: {
      type: 'object',
      properties: {
        wallet_address: {
          type: 'string',
          description: 'The user wallet address (required if not in context)',
        },
        query: {
          type: 'string',
          description: 'Natural language query describing what conversations you want to find',
        },
        limit: {
          type: 'number',
          description: 'Maximum conversations to return. Default: 10',
        },
        threshold: {
          type: 'number',
          description: 'Minimum similarity score (0-1). Default: 0.4',
        },
      },
      required: ['query'],
    },
    execute: async (params, context) => {
      const walletAddress = params.wallet_address || context?.wallet_address;
      if (!walletAddress) {
        return { success: false, error: 'wallet_address required', conversations: [] };
      }

      const conversations = await semanticSearchConversations(walletAddress, params.query, {
        limit: params.limit,
        threshold: params.threshold,
      });

      return {
        success: true,
        query: params.query,
        semantic_search: isSemanticSearchAvailable(),
        count: conversations.length,
        conversations: conversations.map((c) => ({
          conversation_id: c.conversation_id,
          title: c.title,
          preview: c.matched_content,
          similarity: c.similarity,
          related_messages: c.message_count,
        })),
      };
    },
  },
];

// ============ HELPER FOR AGENT INTEGRATION ============

/**
 * Create a context object for memory tool execution
 */
export function createMemoryContext(
  walletAddress: string,
  conversationId?: string
): MemoryToolParams {
  return {
    wallet_address: walletAddress,
    conversation_id: conversationId,
  };
}

/**
 * Execute a memory tool by name
 */
export async function executeMemoryTool(
  toolName: string,
  params: Record<string, any>,
  context: MemoryToolParams
): Promise<any> {
  const tool = MEMORY_TOOLS.find((t) => t.name === toolName);
  if (!tool) {
    return { success: false, error: `Unknown memory tool: ${toolName}` };
  }

  return tool.execute(params, context);
}

export default {
  MEMORY_TOOLS,
  createMemoryContext,
  executeMemoryTool,
  saveMemory,
  getMemory,
  searchMemory,
  saveDailyNote,
  getDailyNotes,
  getConversationContext,
  searchConversations,
};
