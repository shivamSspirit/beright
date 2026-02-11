/**
 * Memory Types for BeRight Protocol
 * Conversation logging and learning storage
 */

export interface ConversationEntry {
  id: string;
  userId?: string;
  userMessage: string;
  botResponse: string;
  skill?: string;
  mood?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface Learning {
  id: string;
  topic: string;
  insight: string;
  source: 'conversation' | 'correction' | 'feedback' | 'observation';
  confidence: number; // 0-1
  usageCount: number;
  createdAt: string;
  lastUsedAt: string;
  relatedConversationIds: string[];
}

export interface MemoryStats {
  conversations: number;
  learnings: number;
  topTopics: string[];
}
