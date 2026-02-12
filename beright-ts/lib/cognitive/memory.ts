/**
 * Episodic Memory System - Learning from past experiences
 *
 * Stores episodes (what happened), extracts lessons, and enables
 * retrieval of relevant past experiences for decision-making.
 *
 * Integrates with OpenClaw's memory system (Markdown files with semantic search).
 */

import * as fs from 'fs';
import * as path from 'path';
import { Episode, EpisodeOutcome, Pattern, Bias, BiasType } from './types';

const MEMORY_DIR = path.join(process.cwd(), 'memory');
const EPISODES_FILE = path.join(MEMORY_DIR, 'episodes.json');
const LESSONS_FILE = path.join(MEMORY_DIR, 'lessons.json');
const DAILY_LOG_DIR = path.join(MEMORY_DIR, 'daily');

const MAX_EPISODES = 500;
const RECENT_WINDOW = 50;

// ============================================
// TYPES
// ============================================

interface Lesson {
  id: string;
  content: string;
  context: string;
  sourceEpisodes: string[];
  confidence: number;
  timesApplied: number;
  createdAt: Date;
  lastApplied?: Date;
}

interface MemoryStore {
  episodes: Episode[];
  lessons: Lesson[];
  lastUpdated: string;
  totalEpisodes: number;
}

// ============================================
// PERSISTENCE
// ============================================

function loadMemory(): MemoryStore {
  const defaults: MemoryStore = {
    episodes: [],
    lessons: [],
    lastUpdated: new Date().toISOString(),
    totalEpisodes: 0,
  };

  try {
    if (fs.existsSync(EPISODES_FILE)) {
      const data = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8'));
      return {
        ...defaults,
        ...data,
        episodes: (data.episodes || []).map((e: any) => ({
          ...e,
          timestamp: new Date(e.timestamp),
        })),
        lessons: (data.lessons || []).map((l: any) => ({
          ...l,
          createdAt: new Date(l.createdAt),
          lastApplied: l.lastApplied ? new Date(l.lastApplied) : undefined,
        })),
      };
    }
  } catch (error) {
    console.warn('[Memory] Failed to load memory:', error);
  }

  return defaults;
}

function saveMemory(store: MemoryStore): void {
  try {
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }
    store.lastUpdated = new Date().toISOString();
    fs.writeFileSync(EPISODES_FILE, JSON.stringify(store, null, 2));
  } catch (error) {
    console.error('[Memory] Failed to save memory:', error);
  }
}

// Singleton store
let memoryStore = loadMemory();

// ============================================
// EPISODE RECORDING
// ============================================

/**
 * Record a new episode (something that happened)
 */
export function recordEpisode(
  context: string,
  actionTaken: string,
  outcome: EpisodeOutcome,
  options: {
    lessonLearned?: string;
    relatedGoalId?: string;
    signals?: string[];
  } = {}
): Episode {
  const episode: Episode = {
    id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date(),
    context,
    actionTaken,
    outcome,
    lessonLearned: options.lessonLearned,
    relatedGoalId: options.relatedGoalId,
    signals: options.signals || [],
  };

  memoryStore.episodes.push(episode);
  memoryStore.totalEpisodes++;

  // Limit episodes
  if (memoryStore.episodes.length > MAX_EPISODES) {
    memoryStore.episodes = memoryStore.episodes.slice(-MAX_EPISODES);
  }

  saveMemory(memoryStore);

  // Also write to daily log (OpenClaw format)
  writeDailyLog(episode);

  console.log(`[Memory] Recorded episode: ${actionTaken.slice(0, 50)}... (${outcome})`);

  return episode;
}

/**
 * Update episode outcome (for pending episodes)
 */
export function updateEpisodeOutcome(
  episodeId: string,
  outcome: EpisodeOutcome,
  lessonLearned?: string
): void {
  const episode = memoryStore.episodes.find(e => e.id === episodeId);
  if (episode) {
    episode.outcome = outcome;
    if (lessonLearned) {
      episode.lessonLearned = lessonLearned;

      // Also create a lesson
      createLesson(lessonLearned, episode.context, [episodeId]);
    }
    saveMemory(memoryStore);
  }
}

/**
 * Write to daily log (OpenClaw memory format)
 */
function writeDailyLog(episode: Episode): void {
  try {
    if (!fs.existsSync(DAILY_LOG_DIR)) {
      fs.mkdirSync(DAILY_LOG_DIR, { recursive: true });
    }

    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(DAILY_LOG_DIR, `${date}.md`);

    const entry = `
## ${episode.timestamp.toLocaleTimeString()} - ${episode.outcome.toUpperCase()}

**Context:** ${episode.context}

**Action:** ${episode.actionTaken}

${episode.lessonLearned ? `**Lesson:** ${episode.lessonLearned}` : ''}

---
`;

    fs.appendFileSync(logFile, entry);
  } catch (error) {
    console.warn('[Memory] Failed to write daily log:', error);
  }
}

// ============================================
// LESSON MANAGEMENT
// ============================================

/**
 * Create a new lesson from experience
 */
export function createLesson(
  content: string,
  context: string,
  sourceEpisodes: string[]
): Lesson {
  // Check if similar lesson exists
  const existing = memoryStore.lessons.find(l =>
    l.content.toLowerCase().includes(content.toLowerCase()) ||
    content.toLowerCase().includes(l.content.toLowerCase())
  );

  if (existing) {
    // Strengthen existing lesson
    existing.confidence = Math.min(1, existing.confidence + 0.1);
    existing.sourceEpisodes.push(...sourceEpisodes);
    saveMemory(memoryStore);
    return existing;
  }

  const lesson: Lesson = {
    id: `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    content,
    context,
    sourceEpisodes,
    confidence: 0.5,
    timesApplied: 0,
    createdAt: new Date(),
  };

  memoryStore.lessons.push(lesson);
  saveMemory(memoryStore);

  console.log(`[Memory] Created lesson: ${content.slice(0, 50)}...`);

  return lesson;
}

/**
 * Mark lesson as applied
 */
export function applyLesson(lessonId: string): void {
  const lesson = memoryStore.lessons.find(l => l.id === lessonId);
  if (lesson) {
    lesson.timesApplied++;
    lesson.lastApplied = new Date();
    saveMemory(memoryStore);
  }
}

/**
 * Strengthen or weaken a lesson based on outcome
 */
export function updateLessonConfidence(lessonId: string, wasHelpful: boolean): void {
  const lesson = memoryStore.lessons.find(l => l.id === lessonId);
  if (lesson) {
    lesson.confidence += wasHelpful ? 0.1 : -0.1;
    lesson.confidence = Math.max(0.1, Math.min(1, lesson.confidence));
    saveMemory(memoryStore);
  }
}

// ============================================
// RETRIEVAL
// ============================================

/**
 * Get recent episodes
 */
export function getRecentEpisodes(limit = RECENT_WINDOW): Episode[] {
  return memoryStore.episodes.slice(-limit);
}

/**
 * Get episodes by outcome
 */
export function getEpisodesByOutcome(outcome: EpisodeOutcome): Episode[] {
  return memoryStore.episodes.filter(e => e.outcome === outcome);
}

/**
 * Search episodes by context (simple text matching)
 */
export function searchEpisodes(query: string, limit = 10): Episode[] {
  const queryLower = query.toLowerCase();
  const matches = memoryStore.episodes.filter(e =>
    e.context.toLowerCase().includes(queryLower) ||
    e.actionTaken.toLowerCase().includes(queryLower)
  );

  return matches.slice(-limit);
}

/**
 * Get relevant lessons for a situation
 */
export function getRelevantLessons(situation: string, limit = 5): Lesson[] {
  const situationLower = situation.toLowerCase();
  const scored = memoryStore.lessons
    .map(lesson => {
      // Simple relevance scoring
      let score = 0;

      // Context match
      if (lesson.context.toLowerCase().includes(situationLower) ||
          situationLower.includes(lesson.context.toLowerCase())) {
        score += 0.5;
      }

      // Content match
      const words = situationLower.split(/\s+/);
      for (const word of words) {
        if (lesson.content.toLowerCase().includes(word)) {
          score += 0.1;
        }
      }

      // Confidence and usage bonus
      score += lesson.confidence * 0.3;
      score += Math.min(lesson.timesApplied * 0.05, 0.2);

      return { lesson, score };
    })
    .filter(x => x.score > 0.2)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(x => x.lesson);
}

/**
 * Get all lessons with minimum confidence
 */
export function getLessons(minConfidence = 0.3): Lesson[] {
  return memoryStore.lessons.filter(l => l.confidence >= minConfidence);
}

// ============================================
// PATTERN ANALYSIS
// ============================================

/**
 * Analyze episodes for patterns
 */
export function analyzePatterns(windowSize = 50): Pattern[] {
  const episodes = getRecentEpisodes(windowSize);
  const patterns: Pattern[] = [];

  // Group by action type
  const actionGroups = new Map<string, Episode[]>();
  for (const ep of episodes) {
    const actionType = extractActionType(ep.actionTaken);
    if (!actionGroups.has(actionType)) {
      actionGroups.set(actionType, []);
    }
    actionGroups.get(actionType)!.push(ep);
  }

  // Analyze each group
  for (const [actionType, group] of actionGroups) {
    if (group.length < 3) continue;

    const successes = group.filter(e => e.outcome === 'success').length;
    const successRate = successes / group.length;

    patterns.push({
      id: `pattern-${actionType}`,
      description: `${actionType} actions`,
      frequency: group.length,
      successRate,
      context: `Observed ${group.length} times in last ${windowSize} episodes`,
    });
  }

  return patterns;
}

function extractActionType(action: string): string {
  const actionLower = action.toLowerCase();
  if (actionLower.includes('predict')) return 'prediction';
  if (actionLower.includes('trade') || actionLower.includes('buy') || actionLower.includes('sell')) return 'trade';
  if (actionLower.includes('research')) return 'research';
  if (actionLower.includes('alert')) return 'alert';
  if (actionLower.includes('arb')) return 'arbitrage';
  return 'other';
}

/**
 * Detect cognitive biases from episodes
 */
export function detectBiases(windowSize = 50): Bias[] {
  const episodes = getRecentEpisodes(windowSize);
  const biases: Bias[] = [];

  // Overconfidence detection
  const predictions = episodes.filter(e =>
    e.actionTaken.toLowerCase().includes('predict') && e.outcome !== 'pending'
  );

  if (predictions.length >= 5) {
    const failures = predictions.filter(e => e.outcome === 'failure').length;
    const failureRate = failures / predictions.length;

    if (failureRate > 0.4) {
      biases.push({
        type: 'overconfidence',
        magnitude: failureRate - 0.3,
        context: 'predictions',
        evidence: [`${failures}/${predictions.length} predictions failed`],
      });
    }
  }

  // Recency bias detection (overweighting recent events)
  const veryRecent = episodes.slice(-10);
  const older = episodes.slice(0, -10);

  if (veryRecent.length >= 5 && older.length >= 10) {
    const recentActions = new Set(veryRecent.map(e => extractActionType(e.actionTaken)));
    const olderActions = new Set(older.map(e => extractActionType(e.actionTaken)));

    const recentOnly = [...recentActions].filter(a => !olderActions.has(a));
    if (recentOnly.length > 0) {
      biases.push({
        type: 'recency',
        magnitude: recentOnly.length / recentActions.size,
        context: 'action selection',
        evidence: [`New action types in recent window: ${recentOnly.join(', ')}`],
      });
    }
  }

  return biases;
}

// ============================================
// MEMORY SUMMARY
// ============================================

/**
 * Get memory summary for context injection
 */
export function getMemorySummary(): string {
  const recentEpisodes = getRecentEpisodes(10);
  const lessons = getLessons(0.5);
  const patterns = analyzePatterns();
  const biases = detectBiases();

  let summary = `## Memory Summary\n\n`;

  // Lessons
  if (lessons.length > 0) {
    summary += `### Key Lessons Learned\n`;
    for (const lesson of lessons.slice(0, 5)) {
      summary += `- ${lesson.content} (confidence: ${(lesson.confidence * 100).toFixed(0)}%)\n`;
    }
    summary += '\n';
  }

  // Recent outcomes
  const recentOutcomes = {
    success: recentEpisodes.filter(e => e.outcome === 'success').length,
    failure: recentEpisodes.filter(e => e.outcome === 'failure').length,
    partial: recentEpisodes.filter(e => e.outcome === 'partial').length,
    pending: recentEpisodes.filter(e => e.outcome === 'pending').length,
  };

  summary += `### Recent Activity (${recentEpisodes.length} episodes)\n`;
  summary += `- Success: ${recentOutcomes.success}\n`;
  summary += `- Failure: ${recentOutcomes.failure}\n`;
  summary += `- Partial: ${recentOutcomes.partial}\n`;
  summary += `- Pending: ${recentOutcomes.pending}\n\n`;

  // Patterns
  if (patterns.length > 0) {
    summary += `### Patterns Detected\n`;
    for (const pattern of patterns.slice(0, 3)) {
      summary += `- ${pattern.description}: ${(pattern.successRate * 100).toFixed(0)}% success (n=${pattern.frequency})\n`;
    }
    summary += '\n';
  }

  // Biases
  if (biases.length > 0) {
    summary += `### ⚠️ Detected Biases\n`;
    for (const bias of biases) {
      summary += `- **${bias.type}**: ${bias.evidence[0]}\n`;
    }
  }

  return summary;
}

/**
 * Get lessons formatted for MEMORY.md (OpenClaw format)
 */
export function formatForOpenClawMemory(): string {
  const lessons = getLessons(0.4);

  let content = `# BeRight Agent Memory\n\n`;
  content += `*Last updated: ${new Date().toISOString()}*\n\n`;

  content += `## Key Lessons\n\n`;
  for (const lesson of lessons) {
    content += `### ${lesson.context}\n`;
    content += `${lesson.content}\n`;
    content += `- Confidence: ${(lesson.confidence * 100).toFixed(0)}%\n`;
    content += `- Applied: ${lesson.timesApplied} times\n\n`;
  }

  const biases = detectBiases();
  if (biases.length > 0) {
    content += `## Bias Corrections\n\n`;
    for (const bias of biases) {
      content += `- **${bias.type}**: Magnitude ${(bias.magnitude * 100).toFixed(0)}%\n`;
      content += `  - Context: ${bias.context}\n`;
      content += `  - Evidence: ${bias.evidence.join(', ')}\n\n`;
    }
  }

  return content;
}

/**
 * Sync to OpenClaw MEMORY.md file
 */
export function syncToOpenClawMemory(): void {
  try {
    const content = formatForOpenClawMemory();
    const memoryFile = path.join(process.cwd(), 'MEMORY.md');
    fs.writeFileSync(memoryFile, content);
    console.log('[Memory] Synced to MEMORY.md');
  } catch (error) {
    console.warn('[Memory] Failed to sync to MEMORY.md:', error);
  }
}

/**
 * Reset memory (for testing)
 */
export function resetMemory(): void {
  memoryStore = {
    episodes: [],
    lessons: [],
    lastUpdated: new Date().toISOString(),
    totalEpisodes: 0,
  };
  saveMemory(memoryStore);
}

export default {
  recordEpisode,
  updateEpisodeOutcome,
  createLesson,
  applyLesson,
  updateLessonConfidence,
  getRecentEpisodes,
  getEpisodesByOutcome,
  searchEpisodes,
  getRelevantLessons,
  getLessons,
  analyzePatterns,
  detectBiases,
  getMemorySummary,
  formatForOpenClawMemory,
  syncToOpenClawMemory,
  resetMemory,
};
