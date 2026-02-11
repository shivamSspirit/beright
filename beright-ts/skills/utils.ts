/**
 * Utility Functions for BeRight Protocol
 */

import { STOP_WORDS } from '../config/thresholds';
import {
  entityOverlap,
  extractEntities,
  areSynonyms,
  getSynonyms,
  SYNONYM_GROUPS,
} from '../config/synonyms';

/**
 * Pick a random element from an array
 */
export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Normalize text for comparison
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract meaningful keywords from text
 */
export function extractKeywords(text: string): Set<string> {
  const normalized = normalizeText(text);
  const words = normalized.split(' ');
  return new Set(words.filter(w => w.length > 2 && !STOP_WORDS.has(w)));
}

/**
 * Calculate similarity between two texts (sequence + jaccard)
 * Basic version without synonym support
 */
export function calculateSimilarityBasic(textA: string, textB: string): number {
  const normA = normalizeText(textA);
  const normB = normalizeText(textB);

  // Sequence similarity (simple Levenshtein-like ratio)
  const seqRatio = sequenceSimilarity(normA, normB);

  // Jaccard similarity on keywords
  const keywordsA = extractKeywords(textA);
  const keywordsB = extractKeywords(textB);

  if (keywordsA.size === 0 || keywordsB.size === 0) {
    return seqRatio;
  }

  const intersection = new Set([...keywordsA].filter(x => keywordsB.has(x)));
  const union = new Set([...keywordsA, ...keywordsB]);
  const jaccard = intersection.size / union.size;

  // Weighted combination: 40% sequence, 60% jaccard
  return 0.4 * seqRatio + 0.6 * jaccard;
}

/**
 * Expand keywords with their synonyms for better matching
 */
function expandKeywordsWithSynonyms(keywords: Set<string>): Set<string> {
  const expanded = new Set<string>();

  for (const keyword of keywords) {
    expanded.add(keyword);
    // Add all synonyms for this keyword
    const synonyms = getSynonyms(keyword);
    for (const syn of synonyms) {
      expanded.add(syn);
    }
  }

  return expanded;
}

/**
 * Check if any keyword from set A matches any keyword from set B (including synonyms)
 */
function synonymAwareIntersection(keywordsA: Set<string>, keywordsB: Set<string>): Set<string> {
  const matches = new Set<string>();

  for (const wordA of keywordsA) {
    for (const wordB of keywordsB) {
      // Direct match
      if (wordA === wordB) {
        matches.add(wordA);
        continue;
      }
      // Synonym match
      if (areSynonyms(wordA, wordB)) {
        matches.add(wordA);
      }
    }
  }

  return matches;
}

/**
 * Calculate similarity between two texts with synonym support
 * This is the enhanced version that matches "super bowl" with "pro football championship"
 */
export function calculateSimilarity(textA: string, textB: string): number {
  const normA = normalizeText(textA);
  const normB = normalizeText(textB);

  // 1. Basic sequence similarity
  const seqRatio = sequenceSimilarity(normA, normB);

  // 2. Keyword-based similarity with synonym awareness
  const keywordsA = extractKeywords(textA);
  const keywordsB = extractKeywords(textB);

  if (keywordsA.size === 0 || keywordsB.size === 0) {
    return seqRatio;
  }

  // Regular Jaccard
  const directIntersection = new Set([...keywordsA].filter(x => keywordsB.has(x)));
  const union = new Set([...keywordsA, ...keywordsB]);
  const directJaccard = directIntersection.size / union.size;

  // Synonym-aware intersection
  const synonymIntersection = synonymAwareIntersection(keywordsA, keywordsB);
  const synonymJaccard = synonymIntersection.size / Math.min(keywordsA.size, keywordsB.size);

  // 3. Entity overlap (checks if both texts talk about same high-level topic)
  const entityScore = entityOverlap(textA, textB);

  // 4. Multi-word phrase matching for synonym groups
  let phraseBonus = 0;
  const lowerA = textA.toLowerCase();
  const lowerB = textB.toLowerCase();

  for (const group of SYNONYM_GROUPS) {
    let foundInA = false;
    let foundInB = false;

    for (const phrase of group) {
      if (lowerA.includes(phrase)) foundInA = true;
      if (lowerB.includes(phrase)) foundInB = true;
    }

    if (foundInA && foundInB) {
      phraseBonus = Math.max(phraseBonus, 0.5); // Strong match if same entity mentioned
    }
  }

  // Combine scores with weights:
  // - 20% sequence similarity (character-level)
  // - 30% direct keyword Jaccard
  // - 20% synonym-aware keyword matching
  // - 15% entity overlap
  // - 15% phrase bonus
  const combined =
    0.2 * seqRatio +
    0.3 * directJaccard +
    0.2 * synonymJaccard +
    0.15 * entityScore +
    0.15 * phraseBonus;

  // If we have a strong entity match, boost the score
  if (entityScore > 0.5 || phraseBonus > 0) {
    return Math.min(1, combined + 0.15);
  }

  return combined;
}

/**
 * Simple sequence similarity (longest common subsequence ratio)
 */
function sequenceSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  // Simple approach: count matching characters in order
  let matches = 0;
  let j = 0;
  for (let i = 0; i < a.length && j < b.length; i++) {
    if (a[i] === b[j]) {
      matches++;
      j++;
    }
  }

  return (2 * matches) / (a.length + b.length);
}

/**
 * Format USD amount
 */
export function formatUsd(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  } else if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(1)}K`;
  } else {
    return `$${amount.toFixed(0)}`;
  }
}

/**
 * Format percentage
 */
export function formatPct(value: number): string {
  // If value is decimal (0-1), convert to percentage
  const pct = value <= 1 ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}

/**
 * Get confidence emoji based on score
 */
export function confidenceEmoji(score: number): string {
  if (score > 0.5) return '🟢';
  if (score > 0.35) return '🟡';
  return '🔴';
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Safe JSON parse
 */
export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Current timestamp in ISO format
 */
export function timestamp(): string {
  return new Date().toISOString();
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}
