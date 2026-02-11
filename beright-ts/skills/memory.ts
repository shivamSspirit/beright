/**
 * Conversation Memory - Log and Learn from Conversations
 *
 * Stores conversation history and extracts learnings for future reference.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SkillResponse } from '../types/response';
import { timestamp } from './utils';

const MEMORY_DIR = path.join(__dirname, '..', 'memory');
const CONVERSATIONS_FILE = path.join(MEMORY_DIR, 'conversations.json');
const LEARNINGS_FILE = path.join(MEMORY_DIR, 'learnings.json');

// Maximum conversations to keep (rolling window)
const MAX_CONVERSATIONS = 500;
const MAX_LEARNINGS = 100;

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

/**
 * Load conversations from file
 */
function loadConversations(): ConversationEntry[] {
  try {
    if (fs.existsSync(CONVERSATIONS_FILE)) {
      const data = fs.readFileSync(CONVERSATIONS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading conversations:', e);
  }
  return [];
}

/**
 * Save conversations to file
 */
function saveConversations(conversations: ConversationEntry[]): void {
  // Keep only recent conversations
  const trimmed = conversations.slice(-MAX_CONVERSATIONS);
  fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(trimmed, null, 2));
}

/**
 * Load learnings from file
 */
function loadLearnings(): Learning[] {
  try {
    if (fs.existsSync(LEARNINGS_FILE)) {
      const data = fs.readFileSync(LEARNINGS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading learnings:', e);
  }
  return [];
}

/**
 * Save learnings to file
 */
function saveLearnings(learnings: Learning[]): void {
  // Keep top learnings by usage and confidence
  const sorted = learnings
    .sort((a, b) => (b.usageCount * b.confidence) - (a.usageCount * a.confidence))
    .slice(0, MAX_LEARNINGS);
  fs.writeFileSync(LEARNINGS_FILE, JSON.stringify(sorted, null, 2));
}

/**
 * Generate a simple unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Log a conversation exchange
 */
export function logConversation(
  userMessage: string,
  botResponse: string,
  options?: {
    userId?: string;
    skill?: string;
    mood?: string;
    metadata?: Record<string, unknown>;
  }
): ConversationEntry {
  const conversations = loadConversations();

  const entry: ConversationEntry = {
    id: generateId(),
    userMessage,
    botResponse,
    timestamp: timestamp(),
    ...options
  };

  conversations.push(entry);
  saveConversations(conversations);

  return entry;
}

/**
 * Add a learning/insight from a conversation
 */
export function addLearning(
  topic: string,
  insight: string,
  source: Learning['source'] = 'conversation',
  conversationId?: string
): Learning {
  const learnings = loadLearnings();

  // Check if similar learning already exists
  const existing = learnings.find(l =>
    l.topic.toLowerCase() === topic.toLowerCase() &&
    l.insight.toLowerCase().includes(insight.toLowerCase().slice(0, 50))
  );

  if (existing) {
    // Update existing learning
    existing.usageCount++;
    existing.lastUsedAt = timestamp();
    if (conversationId && !existing.relatedConversationIds.includes(conversationId)) {
      existing.relatedConversationIds.push(conversationId);
    }
    saveLearnings(learnings);
    return existing;
  }

  // Create new learning
  const learning: Learning = {
    id: generateId(),
    topic,
    insight,
    source,
    confidence: source === 'correction' ? 0.9 : source === 'feedback' ? 0.8 : 0.6,
    usageCount: 1,
    createdAt: timestamp(),
    lastUsedAt: timestamp(),
    relatedConversationIds: conversationId ? [conversationId] : []
  };

  learnings.push(learning);
  saveLearnings(learnings);

  return learning;
}

/**
 * Search for relevant learnings by topic
 */
export function searchLearnings(query: string): Learning[] {
  const learnings = loadLearnings();
  const queryLower = query.toLowerCase();
  const words = queryLower.split(/\s+/);

  return learnings
    .filter(l => {
      const topicLower = l.topic.toLowerCase();
      const insightLower = l.insight.toLowerCase();
      return words.some(w => topicLower.includes(w) || insightLower.includes(w));
    })
    .sort((a, b) => (b.usageCount * b.confidence) - (a.usageCount * a.confidence))
    .slice(0, 5);
}

/**
 * Get recent conversation context
 */
export function getRecentContext(count: number = 5): ConversationEntry[] {
  const conversations = loadConversations();
  return conversations.slice(-count);
}

/**
 * Record user feedback/correction
 */
export function recordCorrection(
  originalResponse: string,
  correction: string,
  topic?: string
): Learning {
  return addLearning(
    topic || 'user_correction',
    `Original: "${originalResponse.slice(0, 100)}..." -> Correction: "${correction}"`,
    'correction'
  );
}

/**
 * Get memory stats
 */
export function getMemoryStats(): { conversations: number; learnings: number; topTopics: string[] } {
  const conversations = loadConversations();
  const learnings = loadLearnings();

  // Count topics
  const topicCounts: Record<string, number> = {};
  learnings.forEach(l => {
    topicCounts[l.topic] = (topicCounts[l.topic] || 0) + l.usageCount;
  });

  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);

  return {
    conversations: conversations.length,
    learnings: learnings.length,
    topTopics
  };
}

/**
 * Main skill handler
 */
export async function handleMemory(query: string): Promise<SkillResponse> {
  const command = query.toLowerCase().trim();

  // Stats command
  if (command === 'stats' || command === 'status') {
    const stats = getMemoryStats();
    return {
      text: `**Memory Stats**\n\nConversations logged: ${stats.conversations}\nLearnings stored: ${stats.learnings}\nTop topics: ${stats.topTopics.join(', ') || 'None yet'}`,
      mood: 'EDUCATIONAL'
    };
  }

  // Recent context
  if (command === 'recent' || command.startsWith('context')) {
    const recent = getRecentContext(5);
    if (recent.length === 0) {
      return { text: 'No conversations logged yet.', mood: 'NEUTRAL' };
    }

    const formatted = recent.map(c =>
      `[${c.timestamp.slice(0, 16)}] User: ${c.userMessage.slice(0, 50)}...`
    ).join('\n');

    return {
      text: `**Recent Conversations**\n\n${formatted}`,
      mood: 'EDUCATIONAL'
    };
  }

  // Search learnings
  if (command.startsWith('search ') || command.startsWith('recall ')) {
    const searchQuery = command.replace(/^(search|recall)\s+/, '');
    const results = searchLearnings(searchQuery);

    if (results.length === 0) {
      return { text: `No learnings found for "${searchQuery}"`, mood: 'NEUTRAL' };
    }

    const formatted = results.map(l =>
      `**${l.topic}** (used ${l.usageCount}x)\n${l.insight}`
    ).join('\n\n');

    return {
      text: `**Learnings for "${searchQuery}"**\n\n${formatted}`,
      mood: 'EDUCATIONAL',
      data: results
    };
  }

  // Default: show help
  return {
    text: `**Memory Commands**\n\n• \`memory stats\` - Show memory statistics\n• \`memory recent\` - Show recent conversations\n• \`memory search <topic>\` - Search learnings\n\nMemory is automatically saved from conversations.`,
    mood: 'EDUCATIONAL'
  };
}

// CLI support
if (require.main === module) {
  const args = process.argv.slice(2);
  const query = args.join(' ') || 'stats';

  handleMemory(query).then(response => {
    console.log(response.text);
  });
}
