/**
 * Memory Extraction Module
 *
 * Automatically extracts memorable information from messages.
 * Uses pattern matching for common phrases and LLM for complex extraction.
 *
 * Extraction Rules:
 * - "I prefer X" / "I like X" → preference
 * - "I'm going to X" / "I will X" → decision
 * - "I usually X" / "I always X" → fact
 * - Predictions / forecasts → decision
 * - Analysis conclusions → insight
 */

import type { NewMemoryEntry, MemoryEntryType, AgentType } from '../supabase/types';

// ============================================
// TYPES
// ============================================

export interface ExtractionOptions {
  walletAddress: string;
  conversationId?: string;
  agentSource?: AgentType;
}

interface ExtractionPattern {
  pattern: RegExp;
  type: MemoryEntryType;
  importance: number;
  transform?: (match: RegExpMatchArray, message: string) => string;
}

// ============================================
// EXTRACTION PATTERNS
// ============================================

const USER_PATTERNS: ExtractionPattern[] = [
  // Preferences
  {
    pattern: /\b(?:I prefer|I like|I love|I enjoy|I'd rather|I favor)\s+(.+?)(?:\.|$)/i,
    type: 'preference',
    importance: 6,
    transform: (match) => `User prefers: ${match[1].trim()}`,
  },
  {
    pattern: /\b(?:I don't like|I hate|I dislike|I avoid)\s+(.+?)(?:\.|$)/i,
    type: 'preference',
    importance: 6,
    transform: (match) => `User avoids: ${match[1].trim()}`,
  },

  // Facts about user
  {
    pattern: /\b(?:I am|I'm)\s+(?:a|an)\s+(.+?)(?:\.|$)/i,
    type: 'fact',
    importance: 7,
    transform: (match) => `User is: ${match[1].trim()}`,
  },
  {
    pattern: /\b(?:I usually|I always|I typically|I generally)\s+(.+?)(?:\.|$)/i,
    type: 'fact',
    importance: 5,
    transform: (match) => `User typically: ${match[1].trim()}`,
  },
  {
    pattern: /\b(?:my (?:trading )?strategy is|my approach is)\s+(.+?)(?:\.|$)/i,
    type: 'strategy',
    importance: 7,
    transform: (match) => `User strategy: ${match[1].trim()}`,
  },

  // Decisions
  {
    pattern: /\b(?:I'm going to|I will|I'll|I've decided to|I'm planning to)\s+(.+?)(?:\.|$)/i,
    type: 'decision',
    importance: 8,
    transform: (match) => `User decided: ${match[1].trim()}`,
  },
  {
    pattern: /\b(?:set|setting)\s+(?:a\s+)?(?:stop[- ]?loss|take[- ]?profit|limit)\s+(?:at|to)\s+(\d+%?)/i,
    type: 'decision',
    importance: 8,
    transform: (match, msg) => {
      const type = msg.toLowerCase().includes('stop') ? 'stop-loss' :
                   msg.toLowerCase().includes('profit') ? 'take-profit' : 'limit';
      return `User set ${type} at ${match[1]}`;
    },
  },

  // Predictions
  {
    pattern: /\b(?:I (?:think|believe|predict|forecast|expect))\s+(.+?)\s+(?:will|is going to|at|to be)\s+(\d+%?)/i,
    type: 'decision',
    importance: 8,
    transform: (match) => `User prediction: ${match[1].trim()} → ${match[2]}`,
  },

  // Risk tolerance
  {
    pattern: /\b(?:my )?(?:risk tolerance|risk appetite)\s+(?:is\s+)?(?:about\s+)?(\d+%?|low|medium|high)/i,
    type: 'fact',
    importance: 8,
    transform: (match) => `User risk tolerance: ${match[1]}`,
  },

  // Position sizing
  {
    pattern: /\b(?:I )?(?:usually|typically|generally)?\s*(?:bet|stake|position|size)\s+(?:about\s+)?(\$?\d+(?:k|K)?%?)/i,
    type: 'fact',
    importance: 7,
    transform: (match) => `User typical position size: ${match[1]}`,
  },
];

const AGENT_PATTERNS: ExtractionPattern[] = [
  // Insights from analysis
  {
    pattern: /(?:key (?:insight|finding|takeaway)|important(?: to note)?|notably|significantly):\s*(.+?)(?:\.|$)/i,
    type: 'insight',
    importance: 6,
    transform: (match) => match[1].trim(),
  },

  // Recommendations
  {
    pattern: /(?:I (?:recommend|suggest)|recommendation|consider)\s+(.+?)(?:\.|$)/i,
    type: 'insight',
    importance: 5,
    transform: (match) => `Recommendation: ${match[1].trim()}`,
  },

  // Probability estimates
  {
    pattern: /(?:probability|likelihood|chance)\s+(?:of\s+)?(.+?)\s+(?:is\s+)?(?:approximately|about|around)?\s*(\d+%)/i,
    type: 'insight',
    importance: 6,
    transform: (match) => `${match[1].trim()}: ${match[2]} probability`,
  },

  // Market observations
  {
    pattern: /(?:market|consensus|platform)\s+(?:shows?|indicates?|suggests?)\s+(.+?)(?:\.|$)/i,
    type: 'insight',
    importance: 4,
    transform: (match) => `Market observation: ${match[1].trim()}`,
  },

  // Calibration results
  {
    pattern: /(?:brier score|calibration)\s+(?:is\s+)?(\d+\.?\d*)/i,
    type: 'insight',
    importance: 7,
    transform: (match) => `Calibration score: ${match[1]}`,
  },
];

// ============================================
// EXTRACTION FUNCTIONS
// ============================================

/**
 * Extract memories from a message using pattern matching
 */
export async function extractMemoriesFromMessage(
  message: string,
  role: 'user' | 'agent',
  options: ExtractionOptions
): Promise<NewMemoryEntry[]> {
  const { walletAddress, conversationId, agentSource } = options;
  const memories: NewMemoryEntry[] = [];

  // Skip very short messages
  if (message.length < 10) {
    return memories;
  }

  // Choose patterns based on role
  const patterns = role === 'user' ? USER_PATTERNS : AGENT_PATTERNS;

  // Apply each pattern
  for (const { pattern, type, importance, transform } of patterns) {
    const match = message.match(pattern);
    if (match) {
      const content = transform ? transform(match, message) : match[1]?.trim();

      if (content && content.length > 5 && content.length < 500) {
        // Check for duplicates in current batch
        const isDuplicate = memories.some(
          (m) => m.content.toLowerCase() === content.toLowerCase()
        );

        if (!isDuplicate) {
          memories.push({
            wallet_address: walletAddress,
            entry_type: type,
            content,
            agent_source: role === 'agent' ? agentSource : undefined,
            conversation_id: conversationId,
            importance,
          });
        }
      }
    }
  }

  // Limit extractions per message
  return memories.slice(0, 3);
}

/**
 * Extract key decision from prediction message
 */
export function extractPrediction(message: string, walletAddress: string): NewMemoryEntry | null {
  // Pattern: predict/forecast + market + probability + direction
  const predictionPattern = /(?:predict|forecast|think)\s+(.+?)\s+(?:will\s+)?(?:be\s+)?(?:at\s+)?(\d+%?)\s*(YES|NO)?/i;
  const match = message.match(predictionPattern);

  if (match) {
    const market = match[1].trim();
    const probability = match[2];
    const direction = match[3] || '';

    return {
      wallet_address: walletAddress,
      entry_type: 'decision',
      content: `Predicted ${market}: ${probability} ${direction}`.trim(),
      importance: 8,
    };
  }

  return null;
}

/**
 * Detect if a message contains memory-worthy content
 */
export function shouldExtractMemory(message: string, role: 'user' | 'agent'): boolean {
  const patterns = role === 'user' ? USER_PATTERNS : AGENT_PATTERNS;

  return patterns.some(({ pattern }) => pattern.test(message));
}

/**
 * Score the importance of extracted content
 */
export function scoreImportance(content: string, type: MemoryEntryType): number {
  let score = 5; // Default

  // Type-based scoring
  switch (type) {
    case 'decision':
      score = 8;
      break;
    case 'fact':
      score = 7;
      break;
    case 'strategy':
      score = 7;
      break;
    case 'preference':
      score = 6;
      break;
    case 'insight':
      score = 5;
      break;
    case 'daily_note':
      score = 4;
      break;
  }

  // Content-based adjustments
  if (content.includes('$') || content.includes('%')) {
    score += 1; // Quantitative content is more valuable
  }

  if (content.length > 100) {
    score -= 1; // Very long content is likely less precise
  }

  // Clamp to valid range
  return Math.max(1, Math.min(10, score));
}

export default extractMemoriesFromMessage;
