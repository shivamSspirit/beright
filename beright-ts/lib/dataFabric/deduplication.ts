/**
 * Market Deduplication Engine (Jaccard Fallback)
 *
 * Identifies and merges the same market across different platforms
 * using keyword-based Jaccard similarity.
 *
 * NOTE: This is the FALLBACK matching engine. The primary matching
 * engine is ML-powered (lib/ml/marketMatcher.ts) using semantic embeddings.
 * This engine is used when:
 * - ML_MATCHING_DISABLED=true
 * - No embedding provider available (no SBERT, no OpenAI API key)
 * - ML matching fails for any reason
 *
 * The ML engine provides better accuracy (~95%) vs Jaccard (~70-80%).
 *
 * @author BeRight Protocol
 */

import { RawMarketData, DataPlatform, PLATFORM_CONFIGS } from '../data/types';
import {
  UnifiedMarket,
  PlatformMarketData,
  MarketCategory,
  DeduplicationResult,
  MarketMatchCandidate,
  generateMarketId,
  generateSlug,
  detectCategory,
  calculateConsensusPrice,
  detectArbitrage,
} from './types';

// =============================================================================
// TEXT SIMILARITY
// =============================================================================

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Remove punctuation
    .replace(/\s+/g, ' ')       // Collapse whitespace
    .trim();
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): Set<string> {
  const stopWords = new Set([
    'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'is', 'are',
    'will', 'be', 'by', 'with', 'from', 'as', 'it', 'this', 'that', 'which', 'what',
    'who', 'how', 'when', 'where', 'why', 'if', 'than', 'then', 'do', 'does', 'did',
    'has', 'have', 'had', 'can', 'could', 'would', 'should', 'may', 'might', 'must',
  ]);

  const normalized = normalizeText(text);
  const words = normalized.split(' ');

  return new Set(
    words
      .filter(w => w.length > 2 && !stopWords.has(w))
      .slice(0, 20)  // Limit to top 20 keywords
  );
}

/**
 * Calculate Jaccard similarity between two sets
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

/**
 * Calculate text similarity between two market questions
 */
function calculateTextSimilarity(textA: string, textB: string): number {
  const keywordsA = extractKeywords(textA);
  const keywordsB = extractKeywords(textB);

  const jaccard = jaccardSimilarity(keywordsA, keywordsB);

  // Bonus for exact match
  const normalizedA = normalizeText(textA);
  const normalizedB = normalizeText(textB);

  if (normalizedA === normalizedB) return 1.0;

  // Bonus if one contains the other
  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) {
    return Math.max(jaccard, 0.85);
  }

  return jaccard;
}

// =============================================================================
// MARKET MATCHING
// =============================================================================

/**
 * Determine if two markets are likely the same question
 */
function areMarketsMatching(marketA: RawMarketData, marketB: RawMarketData): MarketMatchCandidate | null {
  // Don't match markets from the same platform
  if (marketA.platform === marketB.platform) return null;

  const similarity = calculateTextSimilarity(
    marketA.question || marketA.title,
    marketB.question || marketB.title
  );

  // Threshold for matching
  if (similarity < 0.5) return null;

  // Determine match type
  let matchType: 'exact' | 'fuzzy' | 'related' = 'fuzzy';
  if (similarity > 0.95) matchType = 'exact';
  else if (similarity < 0.7) matchType = 'related';

  // Calculate confidence based on multiple factors
  let confidence = similarity;

  // Boost if end dates are similar (within 7 days)
  if (marketA.endDate && marketB.endDate) {
    const daysDiff = Math.abs(marketA.endDate.getTime() - marketB.endDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff < 1) confidence = Math.min(1, confidence + 0.1);
    else if (daysDiff < 7) confidence = Math.min(1, confidence + 0.05);
  }

  // Boost if prices are similar (within 10%)
  const priceDiff = Math.abs(marketA.yesPrice - marketB.yesPrice);
  if (priceDiff < 0.1) confidence = Math.min(1, confidence + 0.05);

  return {
    marketA,
    marketB,
    similarity,
    matchType,
    confidence,
  };
}

/**
 * Find all potential matches for a set of markets
 */
function findMatches(markets: RawMarketData[]): MarketMatchCandidate[] {
  const matches: MarketMatchCandidate[] = [];

  for (let i = 0; i < markets.length; i++) {
    for (let j = i + 1; j < markets.length; j++) {
      const match = areMarketsMatching(markets[i], markets[j]);
      if (match) {
        matches.push(match);
      }
    }
  }

  // Sort by confidence
  matches.sort((a, b) => b.confidence - a.confidence);

  return matches;
}

// =============================================================================
// MARKET UNIFICATION
// =============================================================================

/**
 * Convert RawMarketData to PlatformMarketData
 */
function toPlatformData(raw: RawMarketData): PlatformMarketData {
  const platformConfig = PLATFORM_CONFIGS[raw.platform];

  return {
    platform: raw.platform,
    platformId: raw.id,
    url: raw.url || '',
    yesPrice: raw.yesPrice,
    noPrice: raw.noPrice,
    yesBid: raw.yesBid,
    yesAsk: raw.yesAsk,
    noBid: raw.noBid,
    noAsk: raw.noAsk,
    spread: raw.spread,
    volume: raw.volume || 0,
    volume24h: raw.volume24h,
    liquidity: raw.liquidity || 0,
    openInterest: raw.openInterest,
    lastUpdate: raw.fetchedAt,
    trustScore: platformConfig?.accuracy ? platformConfig.accuracy * 100 : 70,
    trustLevel: 'good',
  };
}

/**
 * Create a UnifiedMarket from a group of matching raw markets
 */
function createUnifiedMarket(markets: RawMarketData[]): UnifiedMarket {
  if (markets.length === 0) {
    throw new Error('Cannot create unified market from empty array');
  }

  // Use the market with highest volume as the primary source
  const sortedByVolume = [...markets].sort((a, b) => (b.volume || 0) - (a.volume || 0));
  const primary = sortedByVolume[0];

  // Convert to platform data
  const platformData = markets.map(toPlatformData);

  // Calculate aggregated values
  const consensusPrice = calculateConsensusPrice(platformData);
  const arbitrage = detectArbitrage(platformData);

  // Find best bid/ask across platforms
  const yesPrices = platformData.map(p => p.yesPrice).filter(p => p > 0);
  const bestBid = Math.max(...yesPrices, 0);
  const bestAsk = Math.min(...yesPrices.map(p => 1 - p), 1);

  // Aggregate totals
  const totalVolume = platformData.reduce((sum, p) => sum + p.volume, 0);
  const totalVolume24h = platformData.reduce((sum, p) => sum + (p.volume24h || 0), 0);
  const totalLiquidity = platformData.reduce((sum, p) => sum + p.liquidity, 0);

  // Calculate trust score (weighted by volume)
  const weightedTrust = platformData.reduce((sum, p) => sum + (p.trustScore * p.volume), 0);
  const overallTrustScore = totalVolume > 0 ? weightedTrust / totalVolume : 70;

  // Determine category and tags
  const question = primary.question || primary.title;
  const category = detectCategory(question);
  const tags: string[] = [];

  // Extract common terms as tags
  const keywords = extractKeywords(question);
  tags.push(...Array.from(keywords).slice(0, 5));

  // Generate IDs
  const id = generateMarketId(question);
  const slug = generateSlug(question);

  return {
    id,
    slug,
    question,
    description: primary.description,
    category,
    tags,
    platforms: platformData,
    bestBid,
    bestAsk,
    consensusPrice,
    priceRange: {
      min: Math.min(...yesPrices),
      max: Math.max(...yesPrices),
    },
    arbitrageSpread: arbitrage?.spread,
    arbitragePlatforms: arbitrage,
    totalVolume,
    totalVolume24h,
    totalLiquidity,
    closeDate: primary.endDate || undefined,
    createdAt: primary.createdAt || undefined,
    lastUpdate: new Date(),
    status: primary.status === 'active' ? 'active' : 'closed',
    isResolved: primary.status === 'resolved',
    resolution: null,
    overallTrustScore,
    platformCount: platformData.length,
  };
}

// =============================================================================
// MAIN DEDUPLICATION FUNCTION
// =============================================================================

/**
 * Deduplicate markets from multiple platforms
 *
 * @param markets - Array of raw markets from all platforms
 * @returns Unified markets with cross-platform data
 */
export function deduplicateMarkets(markets: RawMarketData[]): DeduplicationResult {
  if (markets.length === 0) {
    return {
      unified: [],
      unmatched: [],
      matchStats: {
        totalInput: 0,
        totalUnified: 0,
        totalMatches: 0,
        avgSimilarity: 0,
      },
    };
  }

  // Find all potential matches
  const matches = findMatches(markets);

  // Track which markets have been assigned to groups
  const assignedMarkets = new Set<string>();
  const marketGroups: Map<string, RawMarketData[]> = new Map();

  // Process matches in order of confidence
  for (const match of matches) {
    const keyA = `${match.marketA.platform}:${match.marketA.id}`;
    const keyB = `${match.marketB.platform}:${match.marketB.id}`;

    // Skip if both already assigned
    if (assignedMarkets.has(keyA) && assignedMarkets.has(keyB)) continue;

    // Find or create group
    let groupId: string;
    let group: RawMarketData[];

    if (assignedMarkets.has(keyA)) {
      // Add B to A's group
      groupId = Array.from(marketGroups.entries()).find(([_, g]) =>
        g.some(m => `${m.platform}:${m.id}` === keyA)
      )?.[0] || keyA;
      group = marketGroups.get(groupId) || [];
      if (!group.some(m => `${m.platform}:${m.id}` === keyB)) {
        group.push(match.marketB);
      }
    } else if (assignedMarkets.has(keyB)) {
      // Add A to B's group
      groupId = Array.from(marketGroups.entries()).find(([_, g]) =>
        g.some(m => `${m.platform}:${m.id}` === keyB)
      )?.[0] || keyB;
      group = marketGroups.get(groupId) || [];
      if (!group.some(m => `${m.platform}:${m.id}` === keyA)) {
        group.push(match.marketA);
      }
    } else {
      // Create new group
      groupId = keyA;
      group = [match.marketA, match.marketB];
    }

    marketGroups.set(groupId, group);
    assignedMarkets.add(keyA);
    assignedMarkets.add(keyB);
  }

  // Add unmatched markets as single-platform groups
  const unmatched: RawMarketData[] = [];
  for (const market of markets) {
    const key = `${market.platform}:${market.id}`;
    if (!assignedMarkets.has(key)) {
      // Create single-market group
      marketGroups.set(key, [market]);
      assignedMarkets.add(key);
    }
  }

  // Convert groups to unified markets
  const unified: UnifiedMarket[] = [];
  for (const group of marketGroups.values()) {
    try {
      unified.push(createUnifiedMarket(group));
    } catch (error) {
      console.error('[Dedup] Error creating unified market:', error);
      // Add as unmatched
      unmatched.push(...group);
    }
  }

  // Sort by total volume
  unified.sort((a, b) => b.totalVolume - a.totalVolume);

  // Calculate stats
  const avgSimilarity = matches.length > 0
    ? matches.reduce((sum, m) => sum + m.similarity, 0) / matches.length
    : 0;

  return {
    unified,
    unmatched,
    matchStats: {
      totalInput: markets.length,
      totalUnified: unified.length,
      totalMatches: matches.length,
      avgSimilarity,
    },
  };
}

/**
 * Quick match check for two markets
 */
export function quickMatchCheck(questionA: string, questionB: string): {
  isMatch: boolean;
  similarity: number;
} {
  const similarity = calculateTextSimilarity(questionA, questionB);
  return {
    isMatch: similarity >= 0.5,
    similarity,
  };
}

export default {
  deduplicateMarkets,
  quickMatchCheck,
  calculateTextSimilarity,
};
