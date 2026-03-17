/**
 * ML-Powered Market Matching Engine
 *
 * Combines embedding-based semantic similarity with entity extraction
 * for accurate cross-platform market matching.
 *
 * Pipeline:
 * 1. Compute/fetch embeddings for all markets
 * 2. Cluster by cosine similarity > threshold
 * 3. Validate clusters with entity matching
 * 4. Create unified events with consensus pricing
 *
 * @author BeRight Protocol
 */

import { RawMarketData, DataPlatform } from '../data/types';
import { MarketCategory, detectCategory } from '../dataFabric/types';
import { getEmbeddingWithFallback, cosineSimilarity, textSimilarity } from './embedding';
import {
  MLMatchResult,
  PlatformMarket,
  ArbitrageOpportunity,
  ExtractedEntities,
  ExtractedDate,
  ExtractedAmount,
  MLMatchConfig,
  DEFAULT_ML_CONFIG,
  MarketCluster,
  ClusteringResult,
  SimilarityScore,
  FeedType,
  FeedQuery,
  FeedResponse,
} from './types';

// =============================================================================
// EMBEDDING CACHE
// =============================================================================

interface CacheEntry {
  embedding: number[];
  timestamp: number;
}

const embeddingCache = new Map<string, CacheEntry>();

/**
 * Get cache key for a market
 */
function getCacheKey(platform: DataPlatform, marketId: string): string {
  return `${platform}:${marketId}`;
}

/**
 * Get or compute embedding for a market
 * Uses unified embedding client with SBERT → OpenAI → keyword fallback
 */
async function getEmbedding(
  market: RawMarketData,
  config: MLMatchConfig = DEFAULT_ML_CONFIG
): Promise<number[] | null> {
  const cacheKey = getCacheKey(market.platform, market.id);
  const cached = embeddingCache.get(cacheKey);

  // Return cached if valid
  if (cached && Date.now() - cached.timestamp < config.embeddingCacheTtl) {
    return cached.embedding;
  }

  // Compute new embedding using unified client
  const text = normalizeQuestion(market.question || market.title);
  const result = await getEmbeddingWithFallback(text);

  if (result?.embedding) {
    embeddingCache.set(cacheKey, {
      embedding: result.embedding,
      timestamp: Date.now(),
    });
    return result.embedding;
  }

  // No embedding available - caller will use keyword similarity
  return null;
}

/**
 * Batch compute embeddings for multiple markets
 */
async function batchGetEmbeddings(
  markets: RawMarketData[],
  config: MLMatchConfig = DEFAULT_ML_CONFIG
): Promise<Map<string, number[]>> {
  const embeddings = new Map<string, number[]>();

  // Separate cached and uncached
  const uncached: RawMarketData[] = [];

  for (const market of markets) {
    const cacheKey = getCacheKey(market.platform, market.id);
    const cached = embeddingCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < config.embeddingCacheTtl) {
      embeddings.set(cacheKey, cached.embedding);
    } else {
      uncached.push(market);
    }
  }

  // Compute embeddings for uncached (sequential to avoid rate limits)
  for (const market of uncached) {
    const embedding = await getEmbedding(market, config);
    if (embedding) {
      embeddings.set(getCacheKey(market.platform, market.id), embedding);
    }
  }

  return embeddings;
}

// =============================================================================
// TEXT NORMALIZATION
// =============================================================================

/**
 * Normalize market question for comparison
 */
function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// =============================================================================
// ENTITY EXTRACTION
// =============================================================================

/**
 * Extract entities from market question
 */
function extractEntities(question: string): ExtractedEntities {
  const lower = question.toLowerCase();

  const entities: ExtractedEntities = {
    people: [],
    organizations: [],
    locations: [],
    events: [],
    dates: [],
    amounts: [],
    customTags: [],
  };

  // People patterns
  const peoplePatterns: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /trump|donald\s+trump/i, name: 'Trump' },
    { pattern: /biden|joe\s+biden/i, name: 'Biden' },
    { pattern: /harris|kamala/i, name: 'Harris' },
    { pattern: /desantis/i, name: 'DeSantis' },
    { pattern: /musk|elon\s*musk/i, name: 'Musk' },
    { pattern: /powell|jerome\s+powell/i, name: 'Powell' },
    { pattern: /xi\s+jinping|xi\b/i, name: 'Xi Jinping' },
    { pattern: /putin/i, name: 'Putin' },
    { pattern: /zelensky/i, name: 'Zelensky' },
    { pattern: /bezos/i, name: 'Bezos' },
    { pattern: /zuckerberg/i, name: 'Zuckerberg' },
    { pattern: /altman/i, name: 'Altman' },
  ];

  for (const { pattern, name } of peoplePatterns) {
    if (pattern.test(lower) && !entities.people.includes(name)) {
      entities.people.push(name);
    }
  }

  // Organization patterns
  const orgPatterns: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /\bfed\b|federal\s+reserve|fomc/i, name: 'Fed' },
    { pattern: /\bsec\b/i, name: 'SEC' },
    { pattern: /\bfda\b/i, name: 'FDA' },
    { pattern: /\bnasa\b/i, name: 'NASA' },
    { pattern: /\bun\b|united\s+nations/i, name: 'UN' },
    { pattern: /\bnato\b/i, name: 'NATO' },
    { pattern: /tesla/i, name: 'Tesla' },
    { pattern: /spacex/i, name: 'SpaceX' },
    { pattern: /openai/i, name: 'OpenAI' },
    { pattern: /anthropic/i, name: 'Anthropic' },
    { pattern: /apple\b/i, name: 'Apple' },
    { pattern: /google|alphabet/i, name: 'Google' },
    { pattern: /microsoft/i, name: 'Microsoft' },
    { pattern: /nvidia/i, name: 'NVIDIA' },
    { pattern: /meta\b|facebook/i, name: 'Meta' },
  ];

  for (const { pattern, name } of orgPatterns) {
    if (pattern.test(lower) && !entities.organizations.includes(name)) {
      entities.organizations.push(name);
    }
  }

  // Location patterns
  const locationPatterns: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /\bus\b|united\s+states|america/i, name: 'US' },
    { pattern: /\bchina\b|chinese|beijing/i, name: 'China' },
    { pattern: /\brussia\b|russian|moscow/i, name: 'Russia' },
    { pattern: /\bukraine\b|ukrainian|kyiv/i, name: 'Ukraine' },
    { pattern: /\btaiwan\b|taiwanese/i, name: 'Taiwan' },
    { pattern: /\bisrael\b|israeli/i, name: 'Israel' },
    { pattern: /\bgaza\b|palestinian/i, name: 'Gaza' },
    { pattern: /\biran\b|iranian/i, name: 'Iran' },
    { pattern: /\beu\b|european\s+union/i, name: 'EU' },
    { pattern: /\buk\b|britain|british/i, name: 'UK' },
  ];

  for (const { pattern, name } of locationPatterns) {
    if (pattern.test(lower) && !entities.locations.includes(name)) {
      entities.locations.push(name);
    }
  }

  // Event patterns
  const eventPatterns: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /super\s*bowl/i, name: 'Super Bowl' },
    { pattern: /world\s*series/i, name: 'World Series' },
    { pattern: /nba\s*finals/i, name: 'NBA Finals' },
    { pattern: /stanley\s*cup/i, name: 'Stanley Cup' },
    { pattern: /world\s*cup/i, name: 'World Cup' },
    { pattern: /olympics/i, name: 'Olympics' },
    { pattern: /presidential\s+election/i, name: 'Presidential Election' },
    { pattern: /midterm/i, name: 'Midterm Elections' },
    { pattern: /fomc\s+meeting/i, name: 'FOMC Meeting' },
    { pattern: /oscars?|academy\s+awards?/i, name: 'Oscars' },
    { pattern: /halving/i, name: 'Bitcoin Halving' },
    { pattern: /etf\s+approv/i, name: 'ETF Approval' },
  ];

  for (const { pattern, name } of eventPatterns) {
    if (pattern.test(lower) && !entities.events.includes(name)) {
      entities.events.push(name);
    }
  }

  // Date extraction
  const datePatterns = [
    { pattern: /by\s+(end\s+of\s+)?(20\d{2})/gi, type: 'deadline' as const },
    { pattern: /before\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})/gi, type: 'deadline' as const },
    { pattern: /in\s+(q[1-4])\s+(20\d{2})/gi, type: 'range' as const },
    { pattern: /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+(20\d{2})/gi, type: 'exact' as const },
  ];

  for (const { pattern, type } of datePatterns) {
    const matches = question.matchAll(pattern);
    for (const match of matches) {
      entities.dates.push({
        raw: match[0],
        normalized: parseDate(match[0]),
        type,
      });
    }
  }

  // Amount extraction
  const amountPatterns = [
    /\$(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(k|m|b|thousand|million|billion)?/gi,
    /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*%/gi,
    /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*bps/gi,
    /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(btc|eth|sol)/gi,
  ];

  for (const pattern of amountPatterns) {
    const matches = question.matchAll(pattern);
    for (const match of matches) {
      let value = parseFloat(match[1].replace(/,/g, ''));
      const suffix = match[2]?.toLowerCase();

      if (suffix === 'k' || suffix === 'thousand') value *= 1000;
      if (suffix === 'm' || suffix === 'million') value *= 1_000_000;
      if (suffix === 'b' || suffix === 'billion') value *= 1_000_000_000;

      entities.amounts.push({
        raw: match[0],
        value,
        unit: suffix || 'USD',
      });
    }
  }

  return entities;
}

/**
 * Parse date from text
 */
function parseDate(text: string): Date | null {
  const lower = text.toLowerCase();
  const now = new Date();

  // Year match
  const yearMatch = lower.match(/(20\d{2})/);
  if (!yearMatch) return null;

  const year = parseInt(yearMatch[1]);

  // Month mapping
  const months: Record<string, number> = {
    january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2,
    april: 3, apr: 3, may: 4, june: 5, jun: 5, july: 6, jul: 6,
    august: 7, aug: 7, september: 8, sep: 8, sept: 8,
    october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
  };

  for (const [monthName, monthNum] of Object.entries(months)) {
    if (lower.includes(monthName)) {
      const dayMatch = lower.match(new RegExp(`${monthName}\\s+(\\d{1,2})`));
      const day = dayMatch ? parseInt(dayMatch[1]) : 1;
      return new Date(year, monthNum, day);
    }
  }

  // Quarter
  if (lower.includes('q1')) return new Date(year, 2, 31);
  if (lower.includes('q2')) return new Date(year, 5, 30);
  if (lower.includes('q3')) return new Date(year, 8, 30);
  if (lower.includes('q4')) return new Date(year, 11, 31);

  // End of year
  if (lower.includes('end of')) return new Date(year, 11, 31);

  return new Date(year, 11, 31);
}

// =============================================================================
// SIMILARITY CALCULATION
// =============================================================================

/**
 * Calculate detailed similarity between two markets
 */
function calculateSimilarity(
  marketA: RawMarketData,
  marketB: RawMarketData,
  embeddingA: number[] | null,
  embeddingB: number[] | null,
  config: MLMatchConfig = DEFAULT_ML_CONFIG
): SimilarityScore {
  const questionA = marketA.question || marketA.title;
  const questionB = marketB.question || marketB.title;

  // 1. Embedding similarity (or keyword fallback)
  let embeddingScore: number;
  if (embeddingA && embeddingB) {
    embeddingScore = cosineSimilarity(embeddingA, embeddingB);
  } else {
    // Fallback to keyword-based
    embeddingScore = textSimilarity(questionA, questionB);
  }

  // 2. Entity similarity
  const entitiesA = extractEntities(questionA);
  const entitiesB = extractEntities(questionB);
  const { entityScore, matchedEntities, conflictingEntities } = compareEntities(entitiesA, entitiesB);

  // 3. Date alignment
  const { dateScore, daysDiff } = compareDates(entitiesA.dates, entitiesB.dates);

  // 4. Category match
  const categoryA = detectCategory(questionA);
  const categoryB = detectCategory(questionB);
  const categoryScore = categoryA === categoryB ? 1.0 : 0.0;

  // Calculate weighted overall score
  const overall =
    config.weights.embedding * embeddingScore +
    config.weights.entity * entityScore +
    config.weights.date * dateScore +
    config.weights.category * categoryScore;

  return {
    overall,
    components: {
      embedding: embeddingScore,
      entity: entityScore,
      date: dateScore,
      category: categoryScore,
    },
    details: {
      matchedEntities,
      conflictingEntities,
      dateDifferencesDays: daysDiff,
      categoryMatch: categoryA === categoryB,
    },
  };
}

/**
 * Compare extracted entities
 */
function compareEntities(
  entitiesA: ExtractedEntities,
  entitiesB: ExtractedEntities
): {
  entityScore: number;
  matchedEntities: string[];
  conflictingEntities: string[];
} {
  const matchedEntities: string[] = [];
  const conflictingEntities: string[] = [];

  // Compare all entity types
  const allTypesA = [
    ...entitiesA.people,
    ...entitiesA.organizations,
    ...entitiesA.events,
    ...entitiesA.locations,
  ];
  const allTypesB = [
    ...entitiesB.people,
    ...entitiesB.organizations,
    ...entitiesB.events,
    ...entitiesB.locations,
  ];

  const setA = new Set(allTypesA.map(e => e.toLowerCase()));
  const setB = new Set(allTypesB.map(e => e.toLowerCase()));

  // Find matches
  for (const entity of setA) {
    if (setB.has(entity)) {
      matchedEntities.push(entity);
    }
  }

  // Detect conflicts (e.g., different people in "who will win")
  const peopleA = new Set(entitiesA.people.map(p => p.toLowerCase()));
  const peopleB = new Set(entitiesB.people.map(p => p.toLowerCase()));

  if (peopleA.size > 0 && peopleB.size > 0) {
    const hasOverlap = [...peopleA].some(p => peopleB.has(p));
    if (!hasOverlap) {
      conflictingEntities.push(`People: ${[...peopleA].join(',')} vs ${[...peopleB].join(',')}`);
    }
  }

  // Compare amounts
  for (const amountA of entitiesA.amounts) {
    for (const amountB of entitiesB.amounts) {
      if (Math.abs(amountA.value - amountB.value) > 0.01 * amountA.value) {
        conflictingEntities.push(`Amount: ${amountA.raw} vs ${amountB.raw}`);
      }
    }
  }

  // Calculate score
  const totalEntities = Math.max(setA.size, setB.size, 1);
  const matchScore = matchedEntities.length / totalEntities;
  const conflictPenalty = conflictingEntities.length > 0 ? 0.3 : 0;

  return {
    entityScore: Math.max(0, matchScore - conflictPenalty),
    matchedEntities,
    conflictingEntities,
  };
}

/**
 * Compare dates
 */
function compareDates(
  datesA: ExtractedDate[],
  datesB: ExtractedDate[]
): {
  dateScore: number;
  daysDiff: number | null;
} {
  if (datesA.length === 0 && datesB.length === 0) {
    return { dateScore: 0.5, daysDiff: null }; // No dates to compare
  }

  if (datesA.length === 0 || datesB.length === 0) {
    return { dateScore: 0.3, daysDiff: null }; // One has dates, one doesn't
  }

  // Find closest date pair
  let minDiff = Infinity;

  for (const dateA of datesA) {
    for (const dateB of datesB) {
      if (dateA.normalized && dateB.normalized) {
        const diff = Math.abs(dateA.normalized.getTime() - dateB.normalized.getTime());
        minDiff = Math.min(minDiff, diff);
      }
    }
  }

  if (minDiff === Infinity) {
    return { dateScore: 0.3, daysDiff: null };
  }

  const daysDiff = minDiff / (1000 * 60 * 60 * 24);

  // Score based on difference
  let dateScore: number;
  if (daysDiff === 0) dateScore = 1.0;
  else if (daysDiff < 1) dateScore = 0.95;
  else if (daysDiff < 7) dateScore = 0.8;
  else if (daysDiff < 30) dateScore = 0.5;
  else dateScore = 0.2;

  return { dateScore, daysDiff };
}

// =============================================================================
// CLUSTERING
// =============================================================================

/**
 * Cluster markets by similarity
 */
async function clusterMarkets(
  markets: RawMarketData[],
  config: MLMatchConfig = DEFAULT_ML_CONFIG
): Promise<ClusteringResult> {
  if (markets.length === 0) {
    return {
      clusters: [],
      orphans: [],
      stats: {
        totalMarkets: 0,
        totalClusters: 0,
        avgClusterSize: 0,
        avgConfidence: 0,
      },
    };
  }

  // Get embeddings for all markets
  const embeddings = await batchGetEmbeddings(markets, config);

  // Track which markets have been assigned
  const assigned = new Set<string>();
  const clusters: MarketCluster[] = [];
  const orphans: PlatformMarket[] = [];

  // Sort by volume (prioritize high volume markets as cluster seeds)
  const sortedMarkets = [...markets].sort((a, b) => (b.volume || 0) - (a.volume || 0));

  for (const seedMarket of sortedMarkets) {
    const seedKey = getCacheKey(seedMarket.platform, seedMarket.id);
    if (assigned.has(seedKey)) continue;

    const seedEmbedding = embeddings.get(seedKey);
    const clusterMarkets: PlatformMarket[] = [];
    const clusterEmbeddings: number[][] = [];
    let totalConfidence = 0;

    // Find similar markets
    for (const candidateMarket of markets) {
      const candidateKey = getCacheKey(candidateMarket.platform, candidateMarket.id);
      if (assigned.has(candidateKey)) continue;
      if (candidateMarket.platform === seedMarket.platform && candidateMarket.id === seedMarket.id) {
        // Add seed to cluster
        clusterMarkets.push(toPlatformMarket(seedMarket, seedEmbedding));
        if (seedEmbedding) clusterEmbeddings.push(seedEmbedding);
        assigned.add(seedKey);
        continue;
      }

      const candidateEmbedding = embeddings.get(candidateKey);
      const similarity = calculateSimilarity(
        seedMarket,
        candidateMarket,
        seedEmbedding || null,
        candidateEmbedding || null,
        config
      );

      if (
        similarity.overall >= config.minOverallScore &&
        similarity.components.embedding >= config.minEmbeddingSimilarity * 0.9 &&
        similarity.details.conflictingEntities.length === 0
      ) {
        clusterMarkets.push(toPlatformMarket(candidateMarket, candidateEmbedding));
        if (candidateEmbedding) clusterEmbeddings.push(candidateEmbedding);
        assigned.add(candidateKey);
        totalConfidence += similarity.overall;
      }
    }

    // Create cluster if we have matches
    if (clusterMarkets.length >= 1) {
      const avgConfidence = clusterMarkets.length > 1
        ? totalConfidence / (clusterMarkets.length - 1)
        : 1.0;

      if (avgConfidence >= config.minClusterConfidence || clusterMarkets.length === 1) {
        clusters.push({
          clusterId: generateClusterId(),
          centroid: calculateCentroid(clusterEmbeddings),
          markets: clusterMarkets,
          confidence: clusterMarkets.length === 1 ? 1.0 : avgConfidence,
          canonicalQuestion: seedMarket.question || seedMarket.title,
        });
      } else {
        // Low confidence - treat as orphans
        for (const market of clusterMarkets) {
          orphans.push(market);
        }
      }
    }
  }

  // Collect any remaining unassigned markets as orphans
  for (const market of markets) {
    const key = getCacheKey(market.platform, market.id);
    if (!assigned.has(key)) {
      orphans.push(toPlatformMarket(market, embeddings.get(key)));
    }
  }

  return {
    clusters,
    orphans,
    stats: {
      totalMarkets: markets.length,
      totalClusters: clusters.length,
      avgClusterSize: clusters.length > 0
        ? clusters.reduce((sum, c) => sum + c.markets.length, 0) / clusters.length
        : 0,
      avgConfidence: clusters.length > 0
        ? clusters.reduce((sum, c) => sum + c.confidence, 0) / clusters.length
        : 0,
    },
  };
}

/**
 * Convert RawMarketData to PlatformMarket
 */
function toPlatformMarket(market: RawMarketData, embedding?: number[]): PlatformMarket {
  return {
    platform: market.platform,
    platformId: market.id,
    question: market.question || market.title,
    yesPrice: market.yesPrice,
    noPrice: market.noPrice,
    volume24h: market.volume24h || market.volume || 0,
    liquidity: market.liquidity || 0,
    url: market.url,
    closeDate: market.endDate || undefined,
    embedding,
  };
}

/**
 * Calculate centroid of embeddings
 */
function calculateCentroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];
  if (embeddings.length === 1) return embeddings[0];

  const dim = embeddings[0].length;
  const centroid = new Array(dim).fill(0);

  for (const embedding of embeddings) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += embedding[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    centroid[i] /= embeddings.length;
  }

  return centroid;
}

/**
 * Generate unique cluster ID
 */
function generateClusterId(): string {
  return `cl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// =============================================================================
// MATCH RESULT CREATION
// =============================================================================

/**
 * Create MLMatchResult from a cluster
 */
function createMatchResult(cluster: MarketCluster, config: MLMatchConfig): MLMatchResult {
  const { markets, canonicalQuestion, confidence } = cluster;

  // Calculate consensus price (volume-weighted)
  const totalVolume = markets.reduce((sum, m) => sum + m.volume24h, 0);
  let consensusPrice: number;

  if (totalVolume > 0) {
    consensusPrice = markets.reduce((sum, m) => {
      const weight = m.volume24h / totalVolume;
      return sum + m.yesPrice * weight;
    }, 0);
  } else {
    consensusPrice = markets.reduce((sum, m) => sum + m.yesPrice, 0) / markets.length;
  }

  // Calculate price spread
  const prices = markets.map(m => m.yesPrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceSpread = maxPrice - minPrice;

  // Detect arbitrage
  const arbitrage = detectArbitrage(markets, config);

  // Aggregate liquidity and volume
  const totalLiquidity = markets.reduce((sum, m) => sum + m.liquidity, 0);
  const totalVolume24h = markets.reduce((sum, m) => sum + m.volume24h, 0);

  // Extract entities from canonical question
  const entities = extractEntities(canonicalQuestion);

  // Determine close date (earliest)
  const closeDates = markets.filter(m => m.closeDate).map(m => m.closeDate!);
  const closeDate = closeDates.length > 0
    ? closeDates.reduce((earliest, d) => d < earliest ? d : earliest)
    : undefined;

  return {
    eventId: cluster.clusterId,
    canonicalQuestion,
    category: detectCategory(canonicalQuestion),
    markets,
    matchConfidence: confidence,
    consensusPrice: Math.round(consensusPrice * 1000) / 1000,
    priceSpread: Math.round(priceSpread * 1000) / 1000,
    totalLiquidity,
    totalVolume24h,
    arbitrage,
    entities,
    closeDate,
    matchedAt: new Date(),
  };
}

/**
 * Detect arbitrage opportunity
 */
function detectArbitrage(
  markets: PlatformMarket[],
  config: MLMatchConfig
): ArbitrageOpportunity | undefined {
  if (markets.length < 2) return undefined;

  let bestArb: ArbitrageOpportunity | undefined;
  let maxNetProfit = 0;

  for (let i = 0; i < markets.length; i++) {
    for (let j = i + 1; j < markets.length; j++) {
      const mA = markets[i];
      const mB = markets[j];

      // Try both directions
      const directions = [
        { buy: mA, sell: mB },
        { buy: mB, sell: mA },
      ];

      for (const { buy, sell } of directions) {
        const spread = sell.yesPrice - buy.yesPrice;

        if (spread > config.minArbSpread) {
          const buyFee = config.platformFees[buy.platform] || 0.01;
          const sellFee = config.platformFees[sell.platform] || 0.01;
          const totalFees = buyFee + sellFee;
          const netProfit = spread - totalFees;

          if (netProfit > maxNetProfit) {
            maxNetProfit = netProfit;
            bestArb = {
              buyPlatform: buy.platform,
              buyPrice: buy.yesPrice,
              sellPlatform: sell.platform,
              sellPrice: sell.yesPrice,
              spread,
              profitPct: spread * 100,
              estimatedFees: totalFees,
              netProfit,
            };
          }
        }
      }
    }
  }

  return bestArb;
}

// =============================================================================
// MAIN MATCHING FUNCTION
// =============================================================================

/**
 * Match markets from multiple platforms
 *
 * Main entry point for ML-powered market matching.
 *
 * @param markets - Raw markets from all platforms
 * @param config - ML configuration
 * @returns Array of matched results
 */
export async function matchMarkets(
  markets: RawMarketData[],
  config: MLMatchConfig = DEFAULT_ML_CONFIG
): Promise<MLMatchResult[]> {
  if (markets.length === 0) return [];

  console.log(`[ML Matcher] Processing ${markets.length} markets...`);

  // Cluster markets
  const clustering = await clusterMarkets(markets, config);

  console.log(`[ML Matcher] Created ${clustering.clusters.length} clusters, ${clustering.orphans.length} orphans`);

  // Convert clusters to match results
  const results: MLMatchResult[] = [];

  for (const cluster of clustering.clusters) {
    const result = createMatchResult(cluster, config);
    results.push(result);
  }

  // Add orphans as single-market results
  for (const orphan of clustering.orphans) {
    results.push({
      eventId: generateClusterId(),
      canonicalQuestion: orphan.question,
      category: detectCategory(orphan.question),
      markets: [orphan],
      matchConfidence: 1.0,
      consensusPrice: orphan.yesPrice,
      priceSpread: 0,
      totalLiquidity: orphan.liquidity,
      totalVolume24h: orphan.volume24h,
      arbitrage: undefined,
      entities: extractEntities(orphan.question),
      closeDate: orphan.closeDate,
      matchedAt: new Date(),
    });
  }

  // Sort by platform count (multi-platform first), then by volume
  results.sort((a, b) => {
    if (a.markets.length !== b.markets.length) {
      return b.markets.length - a.markets.length;
    }
    return b.totalVolume24h - a.totalVolume24h;
  });

  return results;
}

// =============================================================================
// FEED FUNCTIONS
// =============================================================================

/**
 * Get markets by feed type
 */
export function filterByFeedType(
  results: MLMatchResult[],
  query: FeedQuery
): FeedResponse {
  const start = Date.now();
  let filtered = [...results];

  // Apply feed type filters
  switch (query.type) {
    case 'hot':
      // Multi-platform, high volume
      filtered = filtered.filter(r => r.markets.length >= 2 || r.totalVolume24h > 10000);
      filtered.sort((a, b) => b.totalVolume24h - a.totalVolume24h);
      break;

    case 'closing_soon':
      // Closing within 24h
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;
      filtered = filtered.filter(r =>
        r.closeDate && r.closeDate.getTime() - now < oneDayMs && r.closeDate.getTime() > now
      );
      filtered.sort((a, b) => (a.closeDate?.getTime() || 0) - (b.closeDate?.getTime() || 0));
      break;

    case 'arbitrage':
      // Has arbitrage opportunity
      filtered = filtered.filter(r => r.arbitrage && r.arbitrage.netProfit > 0);
      filtered.sort((a, b) => (b.arbitrage?.netProfit || 0) - (a.arbitrage?.netProfit || 0));
      break;

    case 'new':
      // Created recently (would need createdAt field)
      filtered.sort((a, b) => b.matchedAt.getTime() - a.matchedAt.getTime());
      break;

    case 'trending':
      // High volume (proxy for trending)
      filtered.sort((a, b) => b.totalVolume24h - a.totalVolume24h);
      break;

    case 'category':
      if (query.category) {
        filtered = filtered.filter(r => r.category === query.category);
      }
      break;
  }

  // Apply additional filters
  if (query.minLiquidity) {
    filtered = filtered.filter(r => r.totalLiquidity >= query.minLiquidity!);
  }

  if (query.platforms && query.platforms.length > 0) {
    filtered = filtered.filter(r =>
      r.markets.some(m => query.platforms!.includes(m.platform))
    );
  }

  // Pagination
  const offset = query.offset || 0;
  const limit = query.limit || 20;
  const total = filtered.length;
  const paged = filtered.slice(offset, offset + limit);

  return {
    type: query.type,
    markets: paged,
    total,
    hasMore: offset + limit < total,
    fetchedAt: new Date(),
    latencyMs: Date.now() - start,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  extractEntities,
  calculateSimilarity,
  clusterMarkets,
  DEFAULT_ML_CONFIG,
};
