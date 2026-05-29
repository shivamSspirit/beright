/**
 * Cognitive Memory System
 *
 * BeRight Pattern: Memory files that persist across sessions
 *
 * This system manages:
 * 1. Episodic Memory - What happened (actions + outcomes)
 * 2. Semantic Memory - What we know (user preferences, lessons)
 * 3. Working Memory - Current conversation context
 *
 * Data flows:
 * - Conversations → Working Memory (in-memory, per chat)
 * - Actions → Episodic Memory (memory/episodes.json)
 * - Lessons → MEMORY.md (synced periodically)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ============================================================================
// Types
// ============================================================================

export interface Episode {
  id: string;
  timestamp: string;
  userId?: string;
  chatId?: string;

  // What happened
  trigger: string;        // What caused this action
  action: string;         // What the agent did
  outcome: string;        // What resulted

  // Context
  intent?: string;        // Detected intent
  agent?: string;         // Which agent handled it
  skills?: string[];      // Skills used

  // Evaluation
  success: boolean;       // Did it work?
  userFeedback?: string;  // Did user respond positively/negatively?
  confidence?: number;    // Agent's confidence in outcome

  // Learning
  lesson?: string;        // What to remember
  tags?: string[];        // For retrieval
}

export interface UserProfile {
  userId: string;
  firstSeen: string;
  lastSeen: string;

  // Preferences
  preferredTopics?: string[];      // Markets they ask about
  communicationStyle?: string;     // How they like responses
  riskTolerance?: 'low' | 'medium' | 'high';

  // Track record
  predictionsCount?: number;
  calibrationScore?: number;

  // Engagement
  totalMessages: number;
  favoriteCommands?: string[];
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  intent?: string;
  mood?: string;
}

export interface WorkingMemory {
  chatId: string;
  userId?: string;
  turns: ConversationTurn[];
  lastActivity: string;

  // Context from conversation
  currentTopic?: string;
  mentionedMarkets?: string[];
  mentionedPlatforms?: string[];
}

export interface Lesson {
  id: string;
  timestamp: string;
  category: 'user_preference' | 'market_insight' | 'system_learning' | 'calibration';
  content: string;
  confidence: number;
  sourceEpisodes?: string[];  // Episode IDs that led to this lesson
}

// ============================================================================
// Storage Paths
// ============================================================================

const WORKSPACE_ROOT = process.cwd();
const MEMORY_DIR = join(WORKSPACE_ROOT, 'memory');
const EPISODES_FILE = join(MEMORY_DIR, 'episodes.json');
const USERS_FILE = join(MEMORY_DIR, 'users.json');
const LESSONS_FILE = join(MEMORY_DIR, 'lessons.json');
const MEMORY_MD_PATH = join(WORKSPACE_ROOT, 'MEMORY.md');

// Ensure memory directory exists
function ensureMemoryDir() {
  if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

// ============================================================================
// In-Memory Caches
// ============================================================================

// Working memory per chat (recent conversation context)
const workingMemoryCache = new Map<string, WorkingMemory>();
const WORKING_MEMORY_TTL = 30 * 60 * 1000; // 30 minutes
const MAX_TURNS_PER_CHAT = 10;

// User profiles cache
let userProfilesCache: Map<string, UserProfile> | null = null;

// Episodes cache (recent only)
let recentEpisodesCache: Episode[] | null = null;
const MAX_CACHED_EPISODES = 100;

// ============================================================================
// Working Memory (Conversation Context)
// ============================================================================

/**
 * Add a turn to working memory for a chat
 */
export function addToWorkingMemory(
  chatId: string,
  turn: Omit<ConversationTurn, 'timestamp'>,
  userId?: string
): void {
  const existing = workingMemoryCache.get(chatId);
  const now = new Date().toISOString();

  const newTurn: ConversationTurn = {
    ...turn,
    timestamp: now,
  };

  if (existing) {
    // Add turn, keep last N
    existing.turns.push(newTurn);
    if (existing.turns.length > MAX_TURNS_PER_CHAT) {
      existing.turns.shift();
    }
    existing.lastActivity = now;
    if (userId) existing.userId = userId;
  } else {
    workingMemoryCache.set(chatId, {
      chatId,
      userId,
      turns: [newTurn],
      lastActivity: now,
    });
  }
}

/**
 * Get recent conversation context for a chat
 */
export function getWorkingMemory(chatId: string): WorkingMemory | null {
  const memory = workingMemoryCache.get(chatId);
  if (!memory) return null;

  // Check TTL
  const age = Date.now() - new Date(memory.lastActivity).getTime();
  if (age > WORKING_MEMORY_TTL) {
    workingMemoryCache.delete(chatId);
    return null;
  }

  return memory;
}

/**
 * Get conversation summary for context injection
 */
export function getConversationSummary(chatId: string): string | null {
  const memory = getWorkingMemory(chatId);
  if (!memory || memory.turns.length === 0) return null;

  // Last 3 turns as context
  const recent = memory.turns.slice(-3);
  return recent.map(t => `${t.role}: ${t.content}`).join('\n');
}

/**
 * Update current topic being discussed
 */
export function setCurrentTopic(chatId: string, topic: string): void {
  const memory = workingMemoryCache.get(chatId);
  if (memory) {
    memory.currentTopic = topic;
  }
}

/**
 * Clean up old working memories
 */
export function cleanupWorkingMemory(): void {
  const now = Date.now();
  for (const [chatId, memory] of workingMemoryCache.entries()) {
    const age = now - new Date(memory.lastActivity).getTime();
    if (age > WORKING_MEMORY_TTL) {
      workingMemoryCache.delete(chatId);
    }
  }
}

// ============================================================================
// Episodic Memory (What Happened)
// ============================================================================

/**
 * Record an episode (action + outcome)
 */
export function recordEpisode(episode: Omit<Episode, 'id' | 'timestamp'>): Episode {
  ensureMemoryDir();

  const fullEpisode: Episode = {
    ...episode,
    id: `ep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };

  // Load existing episodes (handle both old format {episodes:[]} and new format [])
  let episodes: Episode[] = [];
  let existingData: { episodes?: Episode[]; lessons?: unknown[]; lastUpdated?: string; totalEpisodes?: number } | Episode[] | null = null;

  if (existsSync(EPISODES_FILE)) {
    try {
      existingData = JSON.parse(readFileSync(EPISODES_FILE, 'utf-8'));
      // Handle old format: { episodes: [], lessons: [], ... }
      if (existingData && !Array.isArray(existingData) && Array.isArray((existingData as { episodes?: Episode[] }).episodes)) {
        episodes = (existingData as { episodes: Episode[] }).episodes;
      }
      // Handle new format: direct array
      else if (Array.isArray(existingData)) {
        episodes = existingData;
      }
    } catch {
      episodes = [];
    }
  }

  // Add new episode
  episodes.push(fullEpisode);

  // Keep last 1000 episodes
  if (episodes.length > 1000) {
    episodes = episodes.slice(-1000);
  }

  // Save in compatible format (preserve old structure if it existed)
  let dataToSave: unknown;
  if (existingData && !Array.isArray(existingData)) {
    // Preserve old format
    dataToSave = {
      ...existingData,
      episodes,
      lastUpdated: new Date().toISOString(),
      totalEpisodes: episodes.length,
    };
  } else {
    // Use new format (direct array)
    dataToSave = episodes;
  }
  writeFileSync(EPISODES_FILE, JSON.stringify(dataToSave, null, 2));

  // Update cache
  if (recentEpisodesCache) {
    recentEpisodesCache.push(fullEpisode);
    if (recentEpisodesCache.length > MAX_CACHED_EPISODES) {
      recentEpisodesCache.shift();
    }
  }

  console.log(`[Memory] Recorded episode: ${fullEpisode.action.slice(0, 50)}...`);

  return fullEpisode;
}

/**
 * Get recent episodes for a user
 */
export function getRecentEpisodes(userId?: string, limit = 10): Episode[] {
  ensureMemoryDir();

  // Load from cache or file
  if (!recentEpisodesCache) {
    if (existsSync(EPISODES_FILE)) {
      try {
        const data = JSON.parse(readFileSync(EPISODES_FILE, 'utf-8'));
        // Handle old format: { episodes: [], ... }
        let all: Episode[];
        if (data && !Array.isArray(data) && Array.isArray(data.episodes)) {
          all = data.episodes;
        } else if (Array.isArray(data)) {
          all = data;
        } else {
          all = [];
        }
        recentEpisodesCache = all.slice(-MAX_CACHED_EPISODES);
      } catch {
        recentEpisodesCache = [];
      }
    } else {
      recentEpisodesCache = [];
    }
  }

  let episodes = recentEpisodesCache;

  // Filter by user if specified
  if (userId) {
    episodes = episodes.filter(e => e.userId === userId);
  }

  return episodes.slice(-limit);
}

/**
 * Find similar episodes (for learning from past)
 */
export function findSimilarEpisodes(intent: string, topic?: string): Episode[] {
  const episodes = getRecentEpisodes(undefined, 50);

  return episodes.filter(e => {
    if (e.intent === intent) return true;
    if (topic && e.tags?.some(t => t.toLowerCase().includes(topic.toLowerCase()))) return true;
    return false;
  }).slice(-5);
}

// ============================================================================
// User Profiles
// ============================================================================

/**
 * Get or create user profile
 */
export function getUserProfile(userId: string): UserProfile {
  ensureMemoryDir();

  // Load cache
  if (!userProfilesCache) {
    if (existsSync(USERS_FILE)) {
      try {
        const data = JSON.parse(readFileSync(USERS_FILE, 'utf-8'));
        userProfilesCache = new Map(Object.entries(data));
      } catch {
        userProfilesCache = new Map();
      }
    } else {
      userProfilesCache = new Map();
    }
  }

  const existing = userProfilesCache.get(userId);
  if (existing) {
    // Update last seen
    existing.lastSeen = new Date().toISOString();
    existing.totalMessages++;
    return existing;
  }

  // Create new profile
  const newProfile: UserProfile = {
    userId,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    totalMessages: 1,
  };

  userProfilesCache.set(userId, newProfile);
  saveUserProfiles();

  return newProfile;
}

/**
 * Update user preferences based on behavior
 */
export function updateUserPreferences(
  userId: string,
  update: Partial<Pick<UserProfile, 'preferredTopics' | 'communicationStyle' | 'riskTolerance' | 'favoriteCommands'>>
): void {
  const profile = getUserProfile(userId);

  if (update.preferredTopics) {
    profile.preferredTopics = [
      ...new Set([...(profile.preferredTopics || []), ...update.preferredTopics]),
    ].slice(-10); // Keep last 10
  }

  if (update.favoriteCommands) {
    profile.favoriteCommands = [
      ...new Set([...(profile.favoriteCommands || []), ...update.favoriteCommands]),
    ].slice(-10);
  }

  if (update.communicationStyle) profile.communicationStyle = update.communicationStyle;
  if (update.riskTolerance) profile.riskTolerance = update.riskTolerance;

  saveUserProfiles();
}

function saveUserProfiles(): void {
  if (!userProfilesCache) return;

  ensureMemoryDir();
  const data = Object.fromEntries(userProfilesCache.entries());
  writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

// ============================================================================
// Lessons (What We Learned)
// ============================================================================

/**
 * Record a lesson learned
 */
export function recordLesson(lesson: Omit<Lesson, 'id' | 'timestamp'>): Lesson {
  ensureMemoryDir();

  const fullLesson: Lesson = {
    ...lesson,
    id: `lesson_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };

  // Load existing lessons
  let lessons: Lesson[] = [];
  if (existsSync(LESSONS_FILE)) {
    try {
      lessons = JSON.parse(readFileSync(LESSONS_FILE, 'utf-8'));
    } catch {
      lessons = [];
    }
  }

  lessons.push(fullLesson);
  writeFileSync(LESSONS_FILE, JSON.stringify(lessons, null, 2));

  // Sync to MEMORY.md
  syncToMemoryMd();

  console.log(`[Memory] Recorded lesson: ${fullLesson.content.slice(0, 50)}...`);

  return fullLesson;
}

/**
 * Get lessons by category
 */
export function getLessons(category?: Lesson['category']): Lesson[] {
  ensureMemoryDir();

  if (!existsSync(LESSONS_FILE)) return [];

  try {
    const lessons = JSON.parse(readFileSync(LESSONS_FILE, 'utf-8')) as Lesson[];
    if (category) {
      return lessons.filter(l => l.category === category);
    }
    return lessons;
  } catch {
    return [];
  }
}

// ============================================================================
// MEMORY.md Sync
// ============================================================================

/**
 * Sync lessons to MEMORY.md (BeRight pattern)
 */
export function syncToMemoryMd(): void {
  const lessons = getLessons();
  const userCount = userProfilesCache?.size || 0;
  const episodeCount = recentEpisodesCache?.length || 0;

  const content = `# BeRight Agent Memory

*Last updated: ${new Date().toISOString()}*

## Key Lessons

${lessons.length === 0 ? '_No lessons recorded yet._' : lessons.map(l => `
### ${l.category.replace('_', ' ').toUpperCase()}
- **${l.content}**
- Confidence: ${Math.round(l.confidence * 100)}%
- Recorded: ${new Date(l.timestamp).toLocaleDateString()}
`).join('\n')}

## Statistics

- **Users tracked**: ${userCount}
- **Episodes recorded**: ${episodeCount}
- **Lessons learned**: ${lessons.length}

## User Insights

${userProfilesCache && userProfilesCache.size > 0 ? Array.from(userProfilesCache.values()).slice(-5).map(u => `
- User ${u.userId.slice(0, 8)}...: ${u.totalMessages} messages, topics: ${u.preferredTopics?.join(', ') || 'unknown'}
`).join('') : '_No user data yet._'}

## Recent Patterns

${analyzePatterns()}

---

*This file is auto-generated by the cognitive memory system.*
*Edit with caution - changes may be overwritten.*
`;

  writeFileSync(MEMORY_MD_PATH, content);
  console.log('[Memory] Synced to MEMORY.md');
}

/**
 * Analyze patterns from recent episodes
 */
function analyzePatterns(): string {
  const episodes = getRecentEpisodes(undefined, 50);
  if (episodes.length < 5) return '_Not enough data for pattern analysis._';

  // Count intents
  const intentCounts: Record<string, number> = {};
  const successRate: Record<string, { success: number; total: number }> = {};

  for (const ep of episodes) {
    const intent = ep.intent || 'unknown';
    intentCounts[intent] = (intentCounts[intent] || 0) + 1;

    if (!successRate[intent]) successRate[intent] = { success: 0, total: 0 };
    successRate[intent].total++;
    if (ep.success) successRate[intent].success++;
  }

  const topIntents = Object.entries(intentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return topIntents.map(([intent, count]) => {
    const rate = successRate[intent];
    const pct = Math.round((rate.success / rate.total) * 100);
    return `- **${intent}**: ${count} occurrences, ${pct}% success rate`;
  }).join('\n');
}

// ============================================================================
// Context Building for LLM
// ============================================================================

/**
 * Build context string for injecting into LLM prompts
 */
export function buildMemoryContext(chatId: string, userId?: string): string {
  const parts: string[] = [];

  // Conversation context
  const conversationSummary = getConversationSummary(chatId);
  if (conversationSummary) {
    parts.push(`## Recent Conversation\n${conversationSummary}`);
  }

  // User preferences
  if (userId) {
    const profile = getUserProfile(userId);
    if (profile.preferredTopics?.length) {
      parts.push(`## User Preferences\n- Interested in: ${profile.preferredTopics.join(', ')}`);
    }
    if (profile.communicationStyle) {
      parts.push(`- Communication style: ${profile.communicationStyle}`);
    }
  }

  // Recent lessons
  const lessons = getLessons().slice(-3);
  if (lessons.length > 0) {
    parts.push(`## Lessons Learned\n${lessons.map(l => `- ${l.content}`).join('\n')}`);
  }

  return parts.length > 0 ? parts.join('\n\n') : '';
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // Working memory
  addToWorkingMemory,
  getWorkingMemory,
  getConversationSummary,
  setCurrentTopic,
  cleanupWorkingMemory,

  // Episodes
  recordEpisode,
  getRecentEpisodes,
  findSimilarEpisodes,

  // Users
  getUserProfile,
  updateUserPreferences,

  // Lessons
  recordLesson,
  getLessons,
  syncToMemoryMd,

  // Context
  buildMemoryContext,
};
