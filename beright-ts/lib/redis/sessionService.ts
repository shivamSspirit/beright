/**
 * Redis Session Service
 *
 * Manages chat session context with Redis persistence.
 * Sessions survive server restarts and work across multiple instances.
 *
 * Features:
 * - 30 minute TTL (auto-extends on activity)
 * - Stores last 20 messages for context
 * - Links session to wallet and conversation
 * - Falls back to in-memory if Redis unavailable
 */

import { redis } from './client';

// ============================================
// TYPES
// ============================================

export interface SessionMessage {
  role: 'user' | 'agent';
  text: string;
  timestamp: number;
}

export interface SessionContext {
  sessionId: string;
  walletAddress?: string;
  conversationId?: string;
  lastMessages: SessionMessage[];
  createdAt: number;
  lastActivityAt: number;
}

// ============================================
// CONSTANTS
// ============================================

const SESSION_PREFIX = 'session:';
const SESSION_TTL = 30 * 60; // 30 minutes in seconds
const MAX_MESSAGES = 20;

// In-memory fallback
const memoryStore = new Map<string, SessionContext>();

// ============================================
// SESSION SERVICE
// ============================================

export class SessionService {
  /**
   * Get or create a session
   */
  static async getOrCreate(sessionId: string): Promise<SessionContext> {
    // Try Redis first
    if (redis.isAvailable) {
      try {
        const session = await redis.getJSON<SessionContext>(`${SESSION_PREFIX}${sessionId}`);
        if (session) {
          // Update last activity and extend TTL
          session.lastActivityAt = Date.now();
          await this.save(session);
          return session;
        }
      } catch (error) {
        console.warn('[SessionService] Redis get failed, using memory:', error);
      }
    }

    // Check memory fallback
    const memSession = memoryStore.get(sessionId);
    if (memSession) {
      memSession.lastActivityAt = Date.now();
      return memSession;
    }

    // Create new session
    const newSession: SessionContext = {
      sessionId,
      lastMessages: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    await this.save(newSession);
    return newSession;
  }

  /**
   * Get a session (returns null if not found)
   */
  static async get(sessionId: string): Promise<SessionContext | null> {
    if (redis.isAvailable) {
      try {
        return await redis.getJSON<SessionContext>(`${SESSION_PREFIX}${sessionId}`);
      } catch (error) {
        console.warn('[SessionService] Redis get failed:', error);
      }
    }

    return memoryStore.get(sessionId) ?? null;
  }

  /**
   * Save a session
   */
  static async save(session: SessionContext): Promise<void> {
    if (redis.isAvailable) {
      try {
        await redis.setJSON(`${SESSION_PREFIX}${session.sessionId}`, session, SESSION_TTL);
        return;
      } catch (error) {
        console.warn('[SessionService] Redis save failed, using memory:', error);
      }
    }

    // Memory fallback
    memoryStore.set(session.sessionId, session);
  }

  /**
   * Add a message to session history
   */
  static async addMessage(
    sessionId: string,
    role: 'user' | 'agent',
    text: string
  ): Promise<SessionContext> {
    const session = await this.getOrCreate(sessionId);

    session.lastMessages.push({
      role,
      text,
      timestamp: Date.now(),
    });

    // Keep only last N messages
    if (session.lastMessages.length > MAX_MESSAGES) {
      session.lastMessages = session.lastMessages.slice(-MAX_MESSAGES);
    }

    session.lastActivityAt = Date.now();
    await this.save(session);

    return session;
  }

  /**
   * Link session to wallet address
   */
  static async linkWallet(sessionId: string, walletAddress: string): Promise<SessionContext> {
    const session = await this.getOrCreate(sessionId);
    session.walletAddress = walletAddress;
    session.lastActivityAt = Date.now();
    await this.save(session);
    return session;
  }

  /**
   * Link session to conversation ID
   */
  static async linkConversation(sessionId: string, conversationId: string): Promise<SessionContext> {
    const session = await this.getOrCreate(sessionId);
    session.conversationId = conversationId;
    session.lastActivityAt = Date.now();
    await this.save(session);
    return session;
  }

  /**
   * Get conversation history as formatted string (for LLM context)
   */
  static async getContextString(sessionId: string, maxMessages = 10): Promise<string> {
    const session = await this.get(sessionId);
    if (!session || session.lastMessages.length === 0) {
      return '';
    }

    const messages = session.lastMessages.slice(-maxMessages);
    return messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
      .join('\n');
  }

  /**
   * Delete a session
   */
  static async delete(sessionId: string): Promise<void> {
    if (redis.isAvailable) {
      try {
        await redis.del(`${SESSION_PREFIX}${sessionId}`);
      } catch (error) {
        console.warn('[SessionService] Redis delete failed:', error);
      }
    }

    memoryStore.delete(sessionId);
  }

  /**
   * Clean up expired sessions (for memory fallback)
   */
  static cleanupExpired(): number {
    const now = Date.now();
    const ttlMs = SESSION_TTL * 1000;
    let cleaned = 0;

    for (const [id, session] of memoryStore.entries()) {
      if (now - session.lastActivityAt > ttlMs) {
        memoryStore.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get session statistics
   */
  static async getStats(): Promise<{
    memorySessionCount: number;
    redisAvailable: boolean;
  }> {
    return {
      memorySessionCount: memoryStore.size,
      redisAvailable: redis.isAvailable,
    };
  }
}

// Cleanup expired memory sessions every 5 minutes
setInterval(() => {
  const cleaned = SessionService.cleanupExpired();
  if (cleaned > 0) {
    console.log(`[SessionService] Cleaned up ${cleaned} expired sessions from memory`);
  }
}, 5 * 60 * 1000);

export default SessionService;
