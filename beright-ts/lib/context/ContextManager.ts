/**
 * ContextManager - Context Window Management
 *
 * Manages the context window for LLM interactions.
 * Implements efficient context usage through sliding windows,
 * summarization, and RAG-based memory retrieval.
 *
 * Context Budget (200k tokens):
 * - System prompt: ~500 tokens
 * - User profile: ~200 tokens
 * - Recent messages (10): ~2000 tokens
 * - Retrieved memories: ~1000 tokens
 * - Market data: ~500 tokens
 * - Current exchange: ~4000 tokens
 * Total: ~8200 tokens (4% of window)
 */

import { messages } from '../supabase/conversations';
import { SessionService } from '../redis/sessionService';
import { MemoryService } from '../memory';
import type { Message, AgentType } from '../supabase/types';

// ============================================
// TYPES
// ============================================

export interface ContextConfig {
  maxRecentMessages: number;
  maxTokens: number;
  includeMemories: boolean;
  includeMarketContext: boolean;
  summarizeOldMessages: boolean;
}

export interface ContextWindow {
  systemPrompt: string;
  userProfile: string;
  recentMessages: ContextMessage[];
  memories: string;
  marketContext: string;
  totalTokens: number;
}

export interface ContextMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface TokenBudget {
  system: number;
  profile: number;
  messages: number;
  memories: number;
  market: number;
  response: number;
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_CONFIG: ContextConfig = {
  maxRecentMessages: 10,
  maxTokens: 8000,
  includeMemories: true,
  includeMarketContext: true,
  summarizeOldMessages: true,
};

const DEFAULT_BUDGET: TokenBudget = {
  system: 500,
  profile: 200,
  messages: 2000,
  memories: 1000,
  market: 500,
  response: 4000,
};

// Approximate tokens per character (for estimation)
const TOKENS_PER_CHAR = 0.25;

// ============================================
// CONTEXT MANAGER
// ============================================

export class ContextManager {
  private config: ContextConfig;
  private budget: TokenBudget;

  constructor(config?: Partial<ContextConfig>, budget?: Partial<TokenBudget>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.budget = { ...DEFAULT_BUDGET, ...budget };
  }

  /**
   * Build full context window for a conversation
   */
  async buildContext(
    walletAddress: string,
    conversationId: string,
    options?: {
      currentMessage?: string;
      agentType?: AgentType;
      systemPrompt?: string;
    }
  ): Promise<ContextWindow> {
    const { currentMessage, agentType, systemPrompt } = options || {};

    // Build context components in parallel
    const [userProfile, recentMessages, memories, marketContext] = await Promise.all([
      this.buildUserProfile(walletAddress),
      this.buildRecentMessages(conversationId, walletAddress),
      this.config.includeMemories ? this.buildMemoryContext(walletAddress, currentMessage) : '',
      this.config.includeMarketContext ? this.buildMarketContext(currentMessage) : '',
    ]);

    // Calculate token usage
    const totalTokens = this.estimateTokens(
      (systemPrompt || '') + userProfile + memories + marketContext
    ) + recentMessages.reduce((sum, m) => sum + this.estimateTokens(m.content), 0);

    return {
      systemPrompt: systemPrompt || this.getDefaultSystemPrompt(agentType),
      userProfile,
      recentMessages,
      memories,
      marketContext,
      totalTokens,
    };
  }

  /**
   * Build user profile from memories
   */
  private async buildUserProfile(walletAddress: string): Promise<string> {
    try {
      return await MemoryService.generateUserProfile(walletAddress);
    } catch (error) {
      console.error('[ContextManager] Failed to build user profile:', error);
      return '';
    }
  }

  /**
   * Build recent messages with sliding window
   */
  private async buildRecentMessages(
    conversationId: string,
    walletAddress: string
  ): Promise<ContextMessage[]> {
    try {
      // Get messages from database
      const dbMessages = await messages.getByConversation(conversationId, {
        limit: this.config.maxRecentMessages * 2, // Get extra for potential summarization
      });

      // Get session context as backup
      const sessionContext = await SessionService.getContextString(
        `conv-${conversationId}`,
        this.config.maxRecentMessages
      );

      // Use DB messages if available, otherwise parse session
      const msgList: ContextMessage[] = dbMessages.length > 0
        ? dbMessages.map((m): ContextMessage => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content,
            timestamp: new Date(m.created_at),
          }))
        : this.parseSessionContext(sessionContext);

      // Apply sliding window
      const recent: ContextMessage[] = msgList.slice(-this.config.maxRecentMessages);

      // Check if we need to summarize older messages
      if (this.config.summarizeOldMessages && msgList.length > this.config.maxRecentMessages) {
        const older = msgList.slice(0, -this.config.maxRecentMessages);
        const summary = await this.summarizeMessages(older);

        if (summary) {
          const summaryMsg: ContextMessage = {
            role: 'system',
            content: `Previous conversation summary: ${summary}`,
            timestamp: new Date(),
          };
          return [summaryMsg, ...recent];
        }
      }

      return recent;
    } catch (error) {
      console.error('[ContextManager] Failed to build recent messages:', error);
      return [];
    }
  }

  /**
   * Build memory context using RAG
   */
  private async buildMemoryContext(
    walletAddress: string,
    currentMessage?: string
  ): Promise<string> {
    try {
      // Get general context
      const generalContext = await MemoryService.getContextForPrompt(walletAddress, {
        maxFacts: 3,
        maxPreferences: 2,
        maxDecisions: 2,
        maxInsights: 2,
      });

      // If we have a current message, also do semantic search
      let relevantMemories = '';
      if (currentMessage) {
        const searchResults = await MemoryService.search({
          query: currentMessage,
          walletAddress,
          limit: 5,
          useSemanticSearch: true,
        });

        if (searchResults.length > 0) {
          const relevant = searchResults
            .filter((r) => r.score > 0.6)
            .map((r) => `- ${r.entry.content}`)
            .join('\n');

          if (relevant) {
            relevantMemories = `\n\n**Relevant to current query:**\n${relevant}`;
          }
        }
      }

      return generalContext.formatted + relevantMemories;
    } catch (error) {
      console.error('[ContextManager] Failed to build memory context:', error);
      return '';
    }
  }

  /**
   * Build market context (placeholder - integrate with DataFabric)
   */
  private async buildMarketContext(currentMessage?: string): Promise<string> {
    // This would integrate with DataFabric to get relevant market data
    // For now, return empty - market data is typically injected by the handler
    return '';
  }

  /**
   * Summarize a list of messages
   */
  private async summarizeMessages(messages: ContextMessage[]): Promise<string | null> {
    if (messages.length === 0) return null;

    // Simple extraction-based summarization
    // TODO: Use LLM for better summarization
    const userMessages = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .slice(0, 3);

    const topics = this.extractTopics(userMessages.join(' '));

    if (topics.length === 0) return null;

    return `User previously discussed: ${topics.join(', ')}`;
  }

  /**
   * Extract main topics from text
   */
  private extractTopics(text: string): string[] {
    const topics: string[] = [];

    // Simple keyword extraction
    const patterns = [
      /(?:about|regarding|concerning)\s+([^,.]+)/gi,
      /(?:market|prediction|forecast)\s+(?:for\s+)?([^,.]+)/gi,
      /(?:bitcoin|btc|ethereum|eth|solana|sol)/gi,
      /(?:election|trump|biden|politics)/gi,
      /(?:crypto|defi|nft)/gi,
    ];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const topic = (match[1] || match[0]).trim().toLowerCase();
        if (topic.length > 2 && topic.length < 30 && !topics.includes(topic)) {
          topics.push(topic);
        }
      }
    }

    return topics.slice(0, 5);
  }

  /**
   * Parse session context string into messages
   */
  private parseSessionContext(context: string): ContextMessage[] {
    if (!context) return [];

    const lines = context.split('\n').filter(Boolean);
    return lines.map((line) => {
      const isUser = line.startsWith('User:');
      return {
        role: isUser ? 'user' : 'assistant' as const,
        content: line.replace(/^(User|Assistant):\s*/, ''),
        timestamp: new Date(),
      };
    });
  }

  /**
   * Estimate token count for text
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length * TOKENS_PER_CHAR);
  }

  /**
   * Check if context is within budget
   */
  isWithinBudget(context: ContextWindow): boolean {
    return context.totalTokens <= this.config.maxTokens;
  }

  /**
   * Trim context to fit budget
   */
  trimToFit(context: ContextWindow): ContextWindow {
    if (this.isWithinBudget(context)) return context;

    // Priority: keep system prompt, profile, then recent messages
    const trimmed = { ...context };

    // First, trim memories
    if (trimmed.memories && trimmed.totalTokens > this.config.maxTokens) {
      const memoryTokens = this.estimateTokens(trimmed.memories);
      const excess = trimmed.totalTokens - this.config.maxTokens;

      if (excess < memoryTokens) {
        // Partial trim
        const keepRatio = 1 - (excess / memoryTokens);
        trimmed.memories = trimmed.memories.slice(0, Math.floor(trimmed.memories.length * keepRatio));
      } else {
        trimmed.memories = '';
      }
      trimmed.totalTokens = this.calculateTotalTokens(trimmed);
    }

    // Then, trim market context
    if (trimmed.marketContext && trimmed.totalTokens > this.config.maxTokens) {
      trimmed.marketContext = '';
      trimmed.totalTokens = this.calculateTotalTokens(trimmed);
    }

    // Finally, reduce message count
    while (trimmed.recentMessages.length > 2 && trimmed.totalTokens > this.config.maxTokens) {
      trimmed.recentMessages = trimmed.recentMessages.slice(1);
      trimmed.totalTokens = this.calculateTotalTokens(trimmed);
    }

    return trimmed;
  }

  /**
   * Calculate total tokens for a context window
   */
  private calculateTotalTokens(context: ContextWindow): number {
    return (
      this.estimateTokens(context.systemPrompt) +
      this.estimateTokens(context.userProfile) +
      context.recentMessages.reduce((sum, m) => sum + this.estimateTokens(m.content), 0) +
      this.estimateTokens(context.memories) +
      this.estimateTokens(context.marketContext)
    );
  }

  /**
   * Get default system prompt for agent type
   */
  private getDefaultSystemPrompt(agentType?: AgentType): string {
    const base = 'You are BeRight, an AI prediction market intelligence assistant.';

    switch (agentType) {
      case 'SCOUT':
        return `${base} You scan markets for opportunities, track whale activity, and identify arbitrage.`;
      case 'ANALYST':
        return `${base} You provide deep research, probability estimates, and superforecaster-level analysis.`;
      case 'TRADER':
        return `${base} You execute trades, manage positions, and handle portfolio operations.`;
      default:
        return `${base} You help users navigate prediction markets with intelligence and precision.`;
    }
  }

  /**
   * Format context for LLM messages array
   */
  formatForLLM(context: ContextWindow): Array<{ role: string; content: string }> {
    const formatted: Array<{ role: string; content: string }> = [];

    // System message with prompt and context
    const systemContent = [
      context.systemPrompt,
      context.userProfile ? `\n\n## User Profile\n${context.userProfile}` : '',
      context.memories ? `\n\n## Relevant Memories\n${context.memories}` : '',
      context.marketContext ? `\n\n## Market Context\n${context.marketContext}` : '',
    ].filter(Boolean).join('');

    formatted.push({ role: 'system', content: systemContent });

    // Add conversation history
    for (const msg of context.recentMessages) {
      formatted.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    }

    return formatted;
  }
}

export default ContextManager;
