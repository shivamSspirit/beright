/**
 * MemoryService - Unified Memory Management
 *
 * Single source of truth for all memory operations in BeRight.
 * Replaces file-based memory with database-backed persistence.
 *
 * Memory Types:
 * - fact: Immutable truths ("User prefers crypto markets")
 * - preference: User preferences ("Likes YES positions")
 * - decision: Trading decisions ("Set stop-loss at 10%")
 * - insight: Agent-generated insights ("Calibration improving")
 * - strategy: Trading strategies ("Fade momentum plays")
 * - daily_note: Session summaries
 *
 * Hierarchy:
 * L1: Core Memory (in LLM context) - System prompt, user profile, last 10 msgs
 * L2: Session Memory (Redis, 30min TTL) - Full conversation, active context
 * L3: Archival Memory (Supabase + pgvector) - Long-term, semantic search
 * L4: External Memory (RAG) - Market data, news, docs
 */

import { memory } from '../supabase/conversations';
import { SessionService } from '../redis/sessionService';
import type { MemoryEntry, NewMemoryEntry, MemoryEntryType, AgentType } from '../supabase/types';
import { extractMemoriesFromMessage } from './extractMemory';
import { semanticSearch, generateEmbedding } from './searchMemory';

// ============================================
// TYPES
// ============================================

export interface MemoryContext {
  // Core facts about the user
  facts: string[];
  // User preferences
  preferences: string[];
  // Recent decisions
  decisions: string[];
  // Agent insights
  insights: string[];
  // Formatted for LLM context
  formatted: string;
}

export interface MemorySearchOptions {
  query: string;
  walletAddress: string;
  limit?: number;
  entryTypes?: MemoryEntryType[];
  useSemanticSearch?: boolean;
  minImportance?: number;
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  score: number;
  source: 'text' | 'semantic';
}

// ============================================
// MEMORY SERVICE
// ============================================

export class MemoryService {
  /**
   * Get memory context for LLM prompt
   * Returns formatted string of relevant memories for context injection
   */
  static async getContextForPrompt(
    walletAddress: string,
    options?: {
      maxFacts?: number;
      maxPreferences?: number;
      maxDecisions?: number;
      maxInsights?: number;
      includeRecent?: boolean;
    }
  ): Promise<MemoryContext> {
    const {
      maxFacts = 5,
      maxPreferences = 3,
      maxDecisions = 3,
      maxInsights = 3,
      includeRecent = true,
    } = options || {};

    try {
      // Get persistent memories
      const persistent = await memory.getPersistent(walletAddress);

      // Categorize by type
      const facts = persistent
        .filter((m) => m.entry_type === 'fact')
        .slice(0, maxFacts)
        .map((m) => m.content);

      const preferences = persistent
        .filter((m) => m.entry_type === 'preference')
        .slice(0, maxPreferences)
        .map((m) => m.content);

      const decisions = persistent
        .filter((m) => m.entry_type === 'decision')
        .slice(0, maxDecisions)
        .map((m) => m.content);

      const insights = persistent
        .filter((m) => m.entry_type === 'insight')
        .slice(0, maxInsights)
        .map((m) => m.content);

      // Get recent daily notes if requested
      let recentNotes: string[] = [];
      if (includeRecent) {
        const dailyNotes = await memory.getDailyNotes(walletAddress, { daysBack: 1 });
        recentNotes = dailyNotes.slice(0, 2).map((m) => m.content);
      }

      // Format for LLM context
      const sections: string[] = [];

      if (facts.length > 0) {
        sections.push(`**User Facts:**\n${facts.map((f) => `- ${f}`).join('\n')}`);
      }

      if (preferences.length > 0) {
        sections.push(`**Preferences:**\n${preferences.map((p) => `- ${p}`).join('\n')}`);
      }

      if (decisions.length > 0) {
        sections.push(`**Recent Decisions:**\n${decisions.map((d) => `- ${d}`).join('\n')}`);
      }

      if (insights.length > 0) {
        sections.push(`**Insights:**\n${insights.map((i) => `- ${i}`).join('\n')}`);
      }

      if (recentNotes.length > 0) {
        sections.push(`**Recent Notes:**\n${recentNotes.map((n) => `- ${n}`).join('\n')}`);
      }

      return {
        facts,
        preferences,
        decisions,
        insights,
        formatted: sections.length > 0 ? sections.join('\n\n') : '',
      };
    } catch (error) {
      console.error('[MemoryService] Failed to get context:', error);
      return { facts: [], preferences: [], decisions: [], insights: [], formatted: '' };
    }
  }

  /**
   * Store a new memory entry
   */
  static async store(entry: NewMemoryEntry): Promise<MemoryEntry> {
    try {
      const stored = await memory.create(entry);
      console.log(`[MemoryService] Stored ${entry.entry_type}: "${entry.content.slice(0, 50)}..."`);
      return stored;
    } catch (error) {
      console.error('[MemoryService] Failed to store memory:', error);
      throw error;
    }
  }

  /**
   * Store a fact about the user
   */
  static async storeFact(
    walletAddress: string,
    content: string,
    options?: { agentSource?: AgentType; conversationId?: string; importance?: number }
  ): Promise<MemoryEntry> {
    return this.store({
      wallet_address: walletAddress,
      entry_type: 'fact',
      content,
      agent_source: options?.agentSource,
      conversation_id: options?.conversationId,
      importance: options?.importance || 7,
    });
  }

  /**
   * Store a user preference
   */
  static async storePreference(
    walletAddress: string,
    content: string,
    options?: { agentSource?: AgentType; conversationId?: string; importance?: number }
  ): Promise<MemoryEntry> {
    return this.store({
      wallet_address: walletAddress,
      entry_type: 'preference',
      content,
      agent_source: options?.agentSource,
      conversation_id: options?.conversationId,
      importance: options?.importance || 6,
    });
  }

  /**
   * Store a trading decision
   */
  static async storeDecision(
    walletAddress: string,
    content: string,
    options?: { agentSource?: AgentType; conversationId?: string; importance?: number }
  ): Promise<MemoryEntry> {
    return this.store({
      wallet_address: walletAddress,
      entry_type: 'decision',
      content,
      agent_source: options?.agentSource,
      conversation_id: options?.conversationId,
      importance: options?.importance || 8,
    });
  }

  /**
   * Store an agent insight
   */
  static async storeInsight(
    walletAddress: string,
    content: string,
    options?: { agentSource?: AgentType; conversationId?: string; importance?: number }
  ): Promise<MemoryEntry> {
    return this.store({
      wallet_address: walletAddress,
      entry_type: 'insight',
      content,
      agent_source: options?.agentSource,
      conversation_id: options?.conversationId,
      importance: options?.importance || 5,
    });
  }

  /**
   * Store a trading strategy
   */
  static async storeStrategy(
    walletAddress: string,
    content: string,
    options?: { agentSource?: AgentType; conversationId?: string; importance?: number }
  ): Promise<MemoryEntry> {
    return this.store({
      wallet_address: walletAddress,
      entry_type: 'strategy',
      content,
      agent_source: options?.agentSource,
      conversation_id: options?.conversationId,
      importance: options?.importance || 7,
    });
  }

  /**
   * Store a daily note / session summary
   */
  static async storeDailyNote(
    walletAddress: string,
    content: string,
    options?: { agentSource?: AgentType; conversationId?: string; date?: string }
  ): Promise<MemoryEntry> {
    return this.store({
      wallet_address: walletAddress,
      entry_type: 'daily_note',
      content,
      agent_source: options?.agentSource,
      conversation_id: options?.conversationId,
      entry_date: options?.date || new Date().toISOString().split('T')[0],
      importance: 4,
    });
  }

  /**
   * Search memories using text search
   */
  static async searchText(
    walletAddress: string,
    query: string,
    options?: { limit?: number; entryType?: MemoryEntryType }
  ): Promise<MemoryEntry[]> {
    try {
      const results = await memory.search(walletAddress, query, {
        limit: options?.limit || 10,
        entryType: options?.entryType,
      });
      return results.map((r) => ({
        id: r.id,
        wallet_address: walletAddress,
        entry_type: r.entry_type,
        content: r.content,
        agent_source: r.agent_source,
        conversation_id: null,
        entry_date: null,
        importance: 5,
        last_accessed_at: null,
        access_count: 0,
        created_at: r.created_at,
        expires_at: null,
      }));
    } catch (error) {
      console.error('[MemoryService] Text search failed:', error);
      return [];
    }
  }

  /**
   * Search memories using semantic similarity (requires embeddings)
   */
  static async searchSemantic(
    walletAddress: string,
    query: string,
    options?: { limit?: number; entryTypes?: MemoryEntryType[]; threshold?: number }
  ): Promise<MemorySearchResult[]> {
    try {
      return await semanticSearch(walletAddress, query, options);
    } catch (error) {
      console.error('[MemoryService] Semantic search failed:', error);
      // Fall back to text search
      const textResults = await this.searchText(walletAddress, query, {
        limit: options?.limit,
      });
      return textResults.map((entry) => ({
        entry,
        score: 0.5,
        source: 'text' as const,
      }));
    }
  }

  /**
   * Unified search combining text and semantic
   */
  static async search(options: MemorySearchOptions): Promise<MemorySearchResult[]> {
    const { query, walletAddress, limit = 10, useSemanticSearch = true } = options;

    try {
      if (useSemanticSearch) {
        return await this.searchSemantic(walletAddress, query, {
          limit,
          entryTypes: options.entryTypes,
        });
      } else {
        const textResults = await this.searchText(walletAddress, query, { limit });
        return textResults.map((entry) => ({
          entry,
          score: 1.0,
          source: 'text' as const,
        }));
      }
    } catch (error) {
      console.error('[MemoryService] Search failed:', error);
      return [];
    }
  }

  /**
   * Process a message and extract memories automatically
   * Called after each message exchange
   */
  static async processMessage(
    walletAddress: string,
    message: string,
    role: 'user' | 'agent',
    options?: { conversationId?: string; agentType?: AgentType }
  ): Promise<MemoryEntry[]> {
    try {
      const extracted = await extractMemoriesFromMessage(message, role, {
        walletAddress,
        conversationId: options?.conversationId,
        agentSource: options?.agentType,
      });

      const stored: MemoryEntry[] = [];
      for (const mem of extracted) {
        try {
          const entry = await this.store(mem);
          stored.push(entry);
        } catch (err) {
          console.error('[MemoryService] Failed to store extracted memory:', err);
        }
      }

      if (stored.length > 0) {
        console.log(`[MemoryService] Extracted and stored ${stored.length} memories from message`);
      }

      return stored;
    } catch (error) {
      console.error('[MemoryService] Failed to process message:', error);
      return [];
    }
  }

  /**
   * Summarize a conversation and store as daily note
   */
  static async summarizeConversation(
    walletAddress: string,
    conversationId: string,
    summary: string
  ): Promise<MemoryEntry> {
    return this.storeDailyNote(walletAddress, summary, {
      conversationId,
      date: new Date().toISOString().split('T')[0],
    });
  }

  /**
   * Get session context from Redis (L2 memory)
   */
  static async getSessionContext(sessionId: string): Promise<string> {
    return SessionService.getContextString(sessionId, 10);
  }

  /**
   * Clean up expired memories
   */
  static async cleanup(): Promise<number> {
    try {
      return await memory.cleanupExpired();
    } catch (error) {
      console.error('[MemoryService] Cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Generate a user profile summary from memories
   */
  static async generateUserProfile(walletAddress: string): Promise<string> {
    const context = await this.getContextForPrompt(walletAddress, {
      maxFacts: 10,
      maxPreferences: 5,
      maxDecisions: 5,
      maxInsights: 5,
    });

    if (!context.formatted) {
      return 'New user - no profile data yet.';
    }

    const profile = [];

    if (context.facts.length > 0) {
      profile.push(`Known facts: ${context.facts.join('; ')}`);
    }

    if (context.preferences.length > 0) {
      profile.push(`Preferences: ${context.preferences.join('; ')}`);
    }

    if (context.decisions.length > 0) {
      profile.push(`Recent activity: ${context.decisions.slice(0, 3).join('; ')}`);
    }

    return profile.join('\n') || 'Minimal profile data available.';
  }
}

export default MemoryService;
