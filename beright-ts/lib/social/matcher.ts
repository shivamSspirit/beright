/**
 * Social Listener - Market Matcher
 *
 * Matches social media mentions to prediction markets.
 * Uses keyword extraction and fuzzy matching.
 */

import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import { SocialMention } from './types';

// Cache for market keywords (refreshed every 5 min)
let keywordCache: Map<string, { marketId: string; platform: string; title: string }> = new Map();
let lastCacheUpdate = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Entity types for extraction
 */
const ENTITY_PATTERNS = {
  // People (common prediction market subjects)
  people: [
    /trump/i, /biden/i, /obama/i, /harris/i, /desantis/i, /pence/i,
    /musk/i, /bezos/i, /zuckerberg/i, /altman/i,
    /putin/i, /zelensky/i, /xi/i, /modi/i,
  ],

  // Events
  events: [
    /election/i, /debate/i, /vote/i, /primary/i, /caucus/i,
    /superbowl/i, /world cup/i, /championship/i, /finals/i,
    /fed\s*(rate|meeting|decision)/i, /fomc/i,
    /earnings/i, /ipo/i, /merger/i,
  ],

  // Topics
  topics: [
    /bitcoin/i, /btc/i, /ethereum/i, /eth/i, /crypto/i,
    /ai\b/i, /artificial intelligence/i, /gpt/i, /openai/i,
    /recession/i, /inflation/i, /interest rate/i,
    /ukraine/i, /russia/i, /china/i, /taiwan/i,
  ],

  // Platforms
  platforms: [
    /polymarket/i, /kalshi/i, /manifold/i, /predictit/i, /metaculus/i,
  ],
};

/**
 * Extract entities from text
 */
export function extractEntities(text: string): string[] {
  const entities: string[] = [];

  for (const [category, patterns] of Object.entries(ENTITY_PATTERNS)) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        entities.push(match[0].toLowerCase());
      }
    }
  }

  return [...new Set(entities)]; // Dedupe
}

/**
 * Extract keywords from text (simple tokenization)
 */
export function extractKeywords(text: string): string[] {
  // Remove URLs
  const noUrls = text.replace(/https?:\/\/\S+/g, '');

  // Remove special chars, keep words
  const words = noUrls
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);

  // Remove stop words
  const stopWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can',
    'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'will',
    'this', 'that', 'with', 'from', 'they', 'what', 'there', 'their',
    'would', 'could', 'should', 'about', 'which', 'when', 'where',
    'just', 'like', 'more', 'some', 'than', 'then', 'very', 'into',
  ]);

  return words.filter(w => !stopWords.has(w));
}

/**
 * Refresh keyword cache from database
 */
async function refreshKeywordCache(): Promise<void> {
  if (!isSupabaseConfigured) return;

  const now = Date.now();
  if (now - lastCacheUpdate < CACHE_TTL) return;

  try {
    // Get active keywords
    const { data: keywords } = await supabaseAdmin
      .from('social_keywords')
      .select('keyword, market_id, platform')
      .eq('is_active', true);

    // Get market titles from momentum table
    const { data: markets } = await supabaseAdmin
      .from('market_momentum')
      .select('market_id, market_title, platform')
      .limit(500);

    keywordCache.clear();

    // Add explicit keywords
    if (keywords) {
      for (const kw of keywords) {
        if (kw.market_id) {
          keywordCache.set(kw.keyword.toLowerCase(), {
            marketId: kw.market_id,
            platform: kw.platform || 'unknown',
            title: kw.keyword,
          });
        }
      }
    }

    // Add market title keywords
    if (markets) {
      for (const m of markets) {
        const titleWords = extractKeywords(m.market_title);
        for (const word of titleWords.slice(0, 5)) { // First 5 significant words
          if (word.length > 4) { // Only meaningful words
            keywordCache.set(word, {
              marketId: m.market_id,
              platform: m.platform,
              title: m.market_title,
            });
          }
        }

        // Also add entities from title
        const entities = extractEntities(m.market_title);
        for (const entity of entities) {
          keywordCache.set(entity, {
            marketId: m.market_id,
            platform: m.platform,
            title: m.market_title,
          });
        }
      }
    }

    lastCacheUpdate = now;
  } catch (err) {
    console.warn('[Social Matcher] Failed to refresh cache:', err);
  }
}

/**
 * Match a social mention to a market
 *
 * Returns: { marketId, platform, title, confidence } or null
 */
export async function matchMentionToMarket(mention: SocialMention): Promise<{
  marketId: string;
  platform: string;
  title: string;
  confidence: number;
} | null> {
  await refreshKeywordCache();

  const text = mention.content;
  const keywords = extractKeywords(text);
  const entities = extractEntities(text);

  // Score matches
  const matches: Map<string, { marketId: string; platform: string; title: string; score: number }> = new Map();

  // Check entities first (higher confidence)
  for (const entity of entities) {
    const match = keywordCache.get(entity);
    if (match) {
      const key = `${match.marketId}:${match.platform}`;
      const existing = matches.get(key);
      const newScore = (existing?.score || 0) + 0.4; // Entities worth more
      matches.set(key, { ...match, score: newScore });
    }
  }

  // Check keywords
  for (const keyword of keywords) {
    const match = keywordCache.get(keyword);
    if (match) {
      const key = `${match.marketId}:${match.platform}`;
      const existing = matches.get(key);
      const newScore = (existing?.score || 0) + 0.2;
      matches.set(key, { ...match, score: newScore });
    }
  }

  if (matches.size === 0) return null;

  // Return highest scoring match
  let best: { marketId: string; platform: string; title: string; score: number } | null = null;
  for (const match of matches.values()) {
    if (!best || match.score > best.score) {
      best = match;
    }
  }

  if (!best) return null;

  // Normalize confidence to 0-1
  const confidence = Math.min(1, best.score);

  // Only return if confidence > 0.3
  if (confidence < 0.3) return null;

  return {
    marketId: best.marketId,
    platform: best.platform,
    title: best.title,
    confidence,
  };
}

/**
 * Batch match multiple mentions
 */
export async function matchMentionsToMarkets(mentions: SocialMention[]): Promise<SocialMention[]> {
  await refreshKeywordCache();

  const results: SocialMention[] = [];

  for (const mention of mentions) {
    const match = await matchMentionToMarket(mention);

    if (match) {
      results.push({
        ...mention,
        marketId: match.marketId,
        marketTitle: match.title,
        platform: match.platform,
        matchConfidence: match.confidence,
      });
    } else {
      results.push(mention); // Keep unmatched for sentiment aggregation
    }
  }

  return results;
}

/**
 * Generate content hash for deduplication
 */
export function generateContentHash(content: string): string {
  // Simple hash - in production use crypto.createHash('md5')
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}
