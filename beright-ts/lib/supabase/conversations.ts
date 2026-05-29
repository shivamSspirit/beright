/**
 * Conversation & Memory Database Operations
 * BeRight-compatible memory architecture with wallet-first identity
 */

import { supabaseAdmin } from './client';
import type {
  Conversation,
  ConversationMeta,
  Message,
  MemoryEntry,
  AsyncJob,
  PredictionLink,
  NewConversation,
  NewMessage,
  NewMemoryEntry,
  NewAsyncJob,
  MessageSearchResult,
  MemorySearchResult,
  AgentType,
} from './types';

// ============================================
// CONVERSATIONS
// ============================================

export const conversations = {
  /**
   * Create a new conversation
   */
  async create(data: NewConversation): Promise<Conversation> {
    const { data: conv, error } = await supabaseAdmin
      .from('conversations')
      .insert({
        wallet_address: data.wallet_address,
        title: data.title || null,
        gateway_session_id: data.gateway_session_id || null,
        tags: data.tags || [],
      })
      .select()
      .single();

    if (error) throw error;
    return conv as Conversation;
  },

  /**
   * Get conversation by ID
   */
  async getById(id: string): Promise<Conversation | null> {
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as Conversation | null;
  },

  /**
   * Get conversation with messages
   */
  async getWithMessages(id: string): Promise<{ conversation: Conversation; messages: Message[] } | null> {
    const [convResult, messagesResult] = await Promise.all([
      supabaseAdmin.from('conversations').select('*').eq('id', id).single(),
      supabaseAdmin.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true }),
    ]);

    if (convResult.error && convResult.error.code !== 'PGRST116') throw convResult.error;
    if (!convResult.data) return null;

    return {
      conversation: convResult.data as Conversation,
      messages: (messagesResult.data || []) as Message[],
    };
  },

  /**
   * List conversations for wallet (sidebar)
   */
  async listByWallet(
    walletAddress: string,
    options?: {
      limit?: number;
      offset?: number;
      bookmarkedOnly?: boolean;
      archived?: boolean;
    }
  ): Promise<ConversationMeta[]> {
    const { limit = 50, offset = 0, bookmarkedOnly = false, archived = false } = options || {};

    let query = supabaseAdmin
      .from('conversations')
      .select('id, title, agents_used, bookmarked, pinned, created_at, updated_at, last_message_at')
      .eq('wallet_address', walletAddress)
      .eq('archived', archived)
      .order('pinned', { ascending: false })
      .order('last_message_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (bookmarkedOnly) {
      query = query.eq('bookmarked', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as ConversationMeta[];
  },

  /**
   * Update conversation metadata
   */
  async update(
    id: string,
    updates: {
      title?: string;
      bookmarked?: boolean;
      pinned?: boolean;
      archived?: boolean;
      tags?: string[];
      summary?: string;
    }
  ): Promise<Conversation> {
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Conversation;
  },

  /**
   * Delete conversation
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('conversations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Search conversations by query
   */
  async search(
    walletAddress: string,
    query: string,
    options?: {
      limit?: number;
      marketFilter?: string[];
      agentFilter?: AgentType[];
    }
  ): Promise<ConversationMeta[]> {
    const { limit = 20, marketFilter, agentFilter } = options || {};

    let dbQuery = supabaseAdmin
      .from('conversations')
      .select('id, title, agents_used, bookmarked, pinned, created_at, updated_at, last_message_at')
      .eq('wallet_address', walletAddress)
      .textSearch('search_vector', query)
      .order('last_message_at', { ascending: false })
      .limit(limit);

    if (marketFilter && marketFilter.length > 0) {
      dbQuery = dbQuery.overlaps('markets_discussed', marketFilter);
    }

    if (agentFilter && agentFilter.length > 0) {
      dbQuery = dbQuery.overlaps('agents_used', agentFilter);
    }

    const { data, error } = await dbQuery;
    if (error) throw error;
    return (data || []) as ConversationMeta[];
  },

  /**
   * Link a gateway session to conversation
   */
  async linkGatewaySession(id: string, sessionId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('conversations')
      .update({ gateway_session_id: sessionId })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Find conversation by gateway session
   */
  async findByGatewaySession(sessionId: string): Promise<Conversation | null> {
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('gateway_session_id', sessionId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as Conversation | null;
  },
};

// ============================================
// MESSAGES
// ============================================

export const messages = {
  /**
   * Add message to conversation
   */
  async create(data: NewMessage): Promise<Message> {
    const { data: msg, error } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: data.conversation_id,
        role: data.role,
        agent_type: data.agent_type || null,
        content: data.content,
        mood: data.mood || null,
        tool_calls: data.tool_calls || [],
        market_ids: data.market_ids || [],
        prediction_ids: data.prediction_ids || [],
      })
      .select()
      .single();

    if (error) throw error;
    return msg as Message;
  },

  /**
   * Get messages for conversation
   */
  async getByConversation(
    conversationId: string,
    options?: { limit?: number; before?: string }
  ): Promise<Message[]> {
    const { limit = 100, before } = options || {};

    let query = supabaseAdmin
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Message[];
  },

  /**
   * Search messages (full-text)
   */
  async search(
    walletAddress: string,
    query: string,
    options?: { limit?: number; conversationId?: string }
  ): Promise<MessageSearchResult[]> {
    const { limit = 20, conversationId } = options || {};

    // Use the search function for full-text search
    let dbQuery = supabaseAdmin
      .from('messages')
      .select(`
        id,
        conversation_id,
        content,
        role,
        agent_type,
        created_at,
        conversations!inner(wallet_address)
      `)
      .eq('conversations.wallet_address', walletAddress)
      .textSearch('search_vector', query)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (conversationId) {
      dbQuery = dbQuery.eq('conversation_id', conversationId);
    }

    const { data, error } = await dbQuery;
    if (error) throw error;

    return (data || []).map((m: any) => ({
      message_id: m.id,
      conversation_id: m.conversation_id,
      content: m.content,
      role: m.role,
      agent_type: m.agent_type,
      created_at: m.created_at,
    })) as MessageSearchResult[];
  },

  /**
   * Get recent messages for context
   */
  async getRecentForContext(
    walletAddress: string,
    options?: { limit?: number; hoursBack?: number }
  ): Promise<Message[]> {
    const { limit = 20, hoursBack = 24 } = options || {};
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hoursBack);

    const { data, error } = await supabaseAdmin
      .from('messages')
      .select(`
        *,
        conversations!inner(wallet_address)
      `)
      .eq('conversations.wallet_address', walletAddress)
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as Message[];
  },
};

// ============================================
// MEMORY
// ============================================

export const memory = {
  /**
   * Create memory entry
   */
  async create(data: NewMemoryEntry): Promise<MemoryEntry> {
    const { data: entry, error } = await supabaseAdmin
      .from('memory_entries')
      .insert({
        wallet_address: data.wallet_address,
        entry_type: data.entry_type,
        content: data.content,
        agent_source: data.agent_source || null,
        conversation_id: data.conversation_id || null,
        entry_date: data.entry_date || null,
        importance: data.importance || 5,
        expires_at: data.expires_at || null,
      })
      .select()
      .single();

    if (error) throw error;
    return entry as MemoryEntry;
  },

  /**
   * Get persistent memory (like MEMORY.md)
   */
  async getPersistent(walletAddress: string): Promise<MemoryEntry[]> {
    const { data, error } = await supabaseAdmin
      .from('memory_entries')
      .select('*')
      .eq('wallet_address', walletAddress)
      .in('entry_type', ['fact', 'preference', 'decision', 'strategy'])
      .is('expires_at', null)
      .order('importance', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as MemoryEntry[];
  },

  /**
   * Get daily notes (like memory/YYYY-MM-DD.md)
   */
  async getDailyNotes(
    walletAddress: string,
    options?: { date?: string; daysBack?: number }
  ): Promise<MemoryEntry[]> {
    const { date, daysBack = 2 } = options || {};

    let query = supabaseAdmin
      .from('memory_entries')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('entry_type', 'daily_note')
      .order('entry_date', { ascending: false });

    if (date) {
      query = query.eq('entry_date', date);
    } else {
      // Get last N days
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysBack);
      query = query.gte('entry_date', cutoff.toISOString().split('T')[0]);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as MemoryEntry[];
  },

  /**
   * Search memory (full-text)
   */
  async search(
    walletAddress: string,
    query: string,
    options?: { limit?: number; entryType?: string }
  ): Promise<MemorySearchResult[]> {
    const { limit = 10, entryType } = options || {};

    let dbQuery = supabaseAdmin
      .from('memory_entries')
      .select('id, content, entry_type, agent_source, created_at')
      .eq('wallet_address', walletAddress)
      .textSearch('search_vector', query)
      .order('importance', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (entryType) {
      dbQuery = dbQuery.eq('entry_type', entryType);
    }

    const { data, error } = await dbQuery;
    if (error) throw error;
    return (data || []) as MemorySearchResult[];
  },

  /**
   * Update memory access tracking
   */
  async trackAccess(id: string): Promise<void> {
    const { error } = await supabaseAdmin.rpc('increment_memory_access', { memory_id: id });
    // Ignore error if function doesn't exist yet
    if (error && !error.message.includes('does not exist')) throw error;
  },

  /**
   * Delete expired memory entries
   */
  async cleanupExpired(): Promise<number> {
    const { data, error } = await supabaseAdmin
      .from('memory_entries')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) throw error;
    return (data || []).length;
  },
};

// ============================================
// PREDICTION LINKS
// ============================================

export const predictionLinks = {
  /**
   * Link prediction to conversation
   */
  async create(data: {
    conversation_id: string;
    message_id?: string;
    prediction_id: string;
    market_id: string;
    predicted_probability: number;
    direction: 'YES' | 'NO';
    tx_signature?: string;
    on_chain_pda?: string;
  }): Promise<PredictionLink> {
    const { data: link, error } = await supabaseAdmin
      .from('prediction_conversation_links')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return link as PredictionLink;
  },

  /**
   * Get predictions linked to conversation
   */
  async getByConversation(conversationId: string): Promise<PredictionLink[]> {
    const { data, error } = await supabaseAdmin
      .from('prediction_conversation_links')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as PredictionLink[];
  },

  /**
   * Update prediction resolution
   */
  async resolve(
    predictionId: string,
    resolved: boolean,
    brierContribution: number,
    resolutionTx?: string
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from('prediction_conversation_links')
      .update({
        resolved,
        brier_contribution: brierContribution,
        resolution_tx: resolutionTx || null,
        resolved_at: new Date().toISOString(),
      })
      .eq('prediction_id', predictionId);

    if (error) throw error;
  },
};

// ============================================
// ASYNC JOBS
// ============================================

export const asyncJobs = {
  /**
   * Create async job
   */
  async create(data: NewAsyncJob): Promise<AsyncJob> {
    const { data: job, error } = await supabaseAdmin
      .from('async_jobs')
      .insert({
        wallet_address: data.wallet_address,
        conversation_id: data.conversation_id || null,
        job_type: data.job_type,
        gateway_job_id: data.gateway_job_id || null,
        status: 'pending',
        progress: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return job as AsyncJob;
  },

  /**
   * Get pending jobs for wallet
   */
  async getPending(walletAddress: string): Promise<AsyncJob[]> {
    const { data, error } = await supabaseAdmin
      .from('async_jobs')
      .select('*')
      .eq('wallet_address', walletAddress)
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as AsyncJob[];
  },

  /**
   * Update job progress
   */
  async updateProgress(id: string, progress: number, message?: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('async_jobs')
      .update({
        progress,
        progress_message: message || null,
        status: progress >= 100 ? 'completed' : 'running',
        started_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Complete job
   */
  async complete(id: string, result: Record<string, unknown>): Promise<void> {
    const { error } = await supabaseAdmin
      .from('async_jobs')
      .update({
        status: 'completed',
        progress: 100,
        result,
        completed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Fail job
   */
  async fail(id: string, errorMessage: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('async_jobs')
      .update({
        status: 'failed',
        error: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Cleanup expired jobs
   */
  async cleanup(): Promise<number> {
    const { data, error } = await supabaseAdmin
      .from('async_jobs')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) throw error;
    return (data || []).length;
  },
};

// Export all modules
export const conversationDb = {
  conversations,
  messages,
  memory,
  predictionLinks,
  asyncJobs,
};

export default conversationDb;
