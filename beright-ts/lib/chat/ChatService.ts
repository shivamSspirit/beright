/**
 * ChatService - Orchestrates conversation persistence
 *
 * This service ensures all messages are properly persisted to Supabase
 * while maintaining backward compatibility with the existing gateway.
 *
 * Flow:
 * 1. Get or create conversation
 * 2. Save user message to DB
 * 3. Process through agent handler
 * 4. Save agent response to DB
 * 5. Return with IDs for frontend sync
 */

import { conversations, messages } from '../supabase/conversations';
import { secureTelegramHandler } from '../secureHandler';
import { TelegramMessage, SkillResponse } from '../../types/index';
import type { Conversation, Message, AgentType } from '../supabase/types';

// ============================================
// TYPES
// ============================================

export interface ChatRequest {
  message: string;
  walletAddress?: string;
  conversationId?: string;
  sessionId?: string;
  userId?: string;
}

export interface ChatResponse {
  success: boolean;
  conversationId: string;
  userMessageId: string;
  agentMessageId: string;
  sessionId: string;
  text: string;
  rawText: string;
  mood?: string;
  agentType: AgentType;
  data?: unknown;
  async?: boolean;
  jobId?: string;
}

export interface ChatError {
  success: false;
  error: string;
  code: 'NO_WALLET' | 'DB_ERROR' | 'HANDLER_ERROR' | 'UNKNOWN';
}

// ============================================
// AGENT ROUTING (mirrors telegramHandler logic)
// ============================================

function detectAgentType(message: string): AgentType {
  const lower = message.toLowerCase().trim();

  // Trader commands
  if (
    lower.startsWith('/trade') ||
    lower.startsWith('/positions') ||
    lower.startsWith('/portfolio') ||
    lower.startsWith('/pnl') ||
    lower.startsWith('/kalshi') ||
    lower.startsWith('/dflow') ||
    lower.includes('buy ') ||
    lower.includes('sell ')
  ) {
    return 'TRADER';
  }

  // Analyst commands
  if (
    lower.startsWith('/research') ||
    lower.startsWith('/intelligence') ||
    lower.startsWith('/odds') ||
    lower.startsWith('/analyze') ||
    lower.includes('probability') ||
    lower.includes('forecast')
  ) {
    return 'ANALYST';
  }

  // Scout commands (default for most queries)
  if (
    lower.startsWith('/hot') ||
    lower.startsWith('/arb') ||
    lower.startsWith('/brief') ||
    lower.startsWith('/news') ||
    lower.startsWith('/whale') ||
    lower.startsWith('/signals')
  ) {
    return 'SCOUT';
  }

  // Default to SCOUT for general queries
  return 'SCOUT';
}

// ============================================
// SESSION MANAGEMENT
// ============================================

interface SessionContext {
  lastMessages: Array<{ role: 'user' | 'agent'; text: string; timestamp: number }>;
  conversationId?: string;
  walletAddress?: string;
}

const sessionCache = new Map<string, SessionContext>();
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

function getOrCreateSession(sessionId: string): SessionContext {
  const existing = sessionCache.get(sessionId);
  if (existing) return existing;

  const newSession: SessionContext = {
    lastMessages: [],
  };
  sessionCache.set(sessionId, newSession);
  return newSession;
}

function addToSessionHistory(sessionId: string, role: 'user' | 'agent', text: string) {
  const session = getOrCreateSession(sessionId);
  session.lastMessages.push({ role, text, timestamp: Date.now() });

  // Keep only last 20 messages for context
  if (session.lastMessages.length > 20) {
    session.lastMessages = session.lastMessages.slice(-20);
  }
}

// Cleanup old sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessionCache) {
    const lastMessage = session.lastMessages[session.lastMessages.length - 1];
    if (!lastMessage || now - lastMessage.timestamp > SESSION_TTL) {
      sessionCache.delete(id);
    }
  }
}, 5 * 60 * 1000);

// ============================================
// MAIN SERVICE
// ============================================

export class ChatService {
  /**
   * Process a chat message with full persistence
   */
  static async processMessage(request: ChatRequest): Promise<ChatResponse | ChatError> {
    const {
      message,
      walletAddress,
      conversationId: existingConversationId,
      sessionId: providedSessionId,
      userId,
    } = request;

    // Generate session ID if not provided
    const sessionId = providedSessionId || `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Detect agent type for routing
    const agentType = detectAgentType(message);

    try {
      // Step 1: Get or create conversation
      let conversation: Conversation;
      let conversationId = existingConversationId;

      if (walletAddress) {
        if (conversationId) {
          // Load existing conversation
          const existing = await conversations.getById(conversationId);
          if (existing) {
            conversation = existing;
          } else {
            // Conversation ID provided but not found, create new
            conversation = await conversations.create({
              wallet_address: walletAddress,
              gateway_session_id: sessionId,
            });
            conversationId = conversation.id;
          }
        } else {
          // No conversation ID, check if we have one in session
          const session = getOrCreateSession(sessionId);
          if (session.conversationId) {
            const existing = await conversations.getById(session.conversationId);
            if (existing) {
              conversation = existing;
              conversationId = existing.id;
            } else {
              // Create new
              conversation = await conversations.create({
                wallet_address: walletAddress,
                gateway_session_id: sessionId,
              });
              conversationId = conversation.id;
              session.conversationId = conversationId;
            }
          } else {
            // Create new conversation
            conversation = await conversations.create({
              wallet_address: walletAddress,
              gateway_session_id: sessionId,
            });
            conversationId = conversation.id;
            session.conversationId = conversationId;
          }
        }

        // Link session to wallet
        const session = getOrCreateSession(sessionId);
        session.walletAddress = walletAddress;
        session.conversationId = conversationId;
      } else {
        // No wallet - use session-only mode (no DB persistence)
        // This maintains backward compatibility for anonymous users
        conversationId = sessionId;
        conversation = {
          id: sessionId,
          wallet_address: '',
          title: null,
          summary: null,
          agents_used: [],
          markets_discussed: [],
          tags: [],
          bookmarked: false,
          pinned: false,
          archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
          gateway_session_id: sessionId,
        };
      }

      // Step 2: Save user message to DB (if wallet connected)
      let userMessageId = `temp-user-${Date.now()}`;
      if (walletAddress && conversationId !== sessionId) {
        try {
          const userMessage = await messages.create({
            conversation_id: conversationId,
            role: 'user',
            content: message,
          });
          userMessageId = userMessage.id;
        } catch (dbError) {
          console.error('[ChatService] Failed to save user message:', dbError);
          // Continue anyway - don't fail the request
        }
      }

      // Add to session history
      addToSessionHistory(sessionId, 'user', message);

      // Step 3: Process through agent handler
      const pseudoMessage: TelegramMessage = {
        message_id: Date.now(),
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: parseInt(sessionId.replace(/\D/g, '').slice(0, 10)) || Date.now(),
          type: 'private',
        },
        from: {
          id: userId ? parseInt(userId.replace(/\D/g, '').slice(0, 10)) || Date.now() : Date.now(),
          first_name: 'Web User',
          username: walletAddress || userId || undefined,
        },
        text: message.trim(),
      };

      console.log(`[ChatService] Processing: "${message.slice(0, 50)}..." | Conv: ${conversationId} | Agent: ${agentType}`);

      const response = await secureTelegramHandler(pseudoMessage);

      // Step 4: Save agent response to DB (if wallet connected)
      let agentMessageId = `temp-agent-${Date.now()}`;
      if (walletAddress && conversationId !== sessionId) {
        try {
          const agentMessage = await messages.create({
            conversation_id: conversationId,
            role: 'agent',
            agent_type: agentType,
            content: response.text,
            mood: response.mood as any,
            tool_calls: response.data ? [{ name: 'gateway_data', arguments: {}, result: response.data }] : undefined,
          });
          agentMessageId = agentMessage.id;

          // Update conversation metadata
          await conversations.update(conversationId, {
            title: conversation.title || generateTitle(message),
          });
        } catch (dbError) {
          console.error('[ChatService] Failed to save agent message:', dbError);
          // Continue anyway
        }
      }

      // Add to session history
      addToSessionHistory(sessionId, 'agent', response.text);

      // Step 5: Format and return response
      const formattedText = formatResponseForWeb(response.text);

      return {
        success: true,
        conversationId,
        userMessageId,
        agentMessageId,
        sessionId,
        text: formattedText,
        rawText: response.text,
        mood: response.mood,
        agentType,
        data: response.data,
      };
    } catch (error) {
      console.error('[ChatService] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'HANDLER_ERROR',
      };
    }
  }

  /**
   * Process a long-running request asynchronously
   */
  static async processAsyncMessage(
    request: ChatRequest,
    jobId: string,
    updateProgress: (progress: number, message?: string) => void
  ): Promise<ChatResponse | ChatError> {
    updateProgress(10, 'Starting analysis...');

    const result = await this.processMessage(request);

    if (result.success) {
      updateProgress(100, 'Complete');
    }

    return result;
  }

  /**
   * Get session context for debugging
   */
  static getSessionContext(sessionId: string): SessionContext | undefined {
    return sessionCache.get(sessionId);
  }

  /**
   * Link a session to a conversation
   */
  static linkSessionToConversation(sessionId: string, conversationId: string) {
    const session = getOrCreateSession(sessionId);
    session.conversationId = conversationId;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate a title from the first message
 */
function generateTitle(message: string): string {
  // Remove command prefix
  let title = message.replace(/^\/\w+\s*/, '').trim();

  // Truncate to 50 chars
  if (title.length > 50) {
    title = title.slice(0, 47) + '...';
  }

  // Default title if empty
  if (!title) {
    title = `Chat ${new Date().toLocaleDateString()}`;
  }

  return title;
}

/**
 * Convert Telegram markdown to web-friendly format
 */
function formatResponseForWeb(text: string): string {
  let formatted = text;

  // Remove markdown code fences
  formatted = formatted.replace(/^```markdown\s*/i, '').replace(/```\s*$/, '');
  formatted = formatted.replace(/^```\s*/gm, '').replace(/```\s*$/gm, '');

  // Convert Telegram bold *text* to markdown bold **text**
  formatted = formatted.replace(/\*([^*]+)\*/g, '**$1**');

  // Convert Telegram italic _text_ to markdown italic *text*
  formatted = formatted.replace(/_([^_]+)_/g, '*$1*');

  // Normalize excessive line breaks
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  return formatted.trim();
}

export default ChatService;
