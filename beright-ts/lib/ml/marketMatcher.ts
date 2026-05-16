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
  ArbitrageEVAnalysis,
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
import {
  getClassifier,
  ClassificationInput,
  ClassificationResult,
  isClassificationAvailable,
} from './classification';
import {
  getEVCalculator,
  EVResult,
  ArbitrageEVResult,
  PlatformMarketData,
} from '../ev';

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
 * Uses parallel processing with concurrency limit to avoid memory issues
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

  if (uncached.length === 0) {
    return embeddings;
  }

  console.log(`[ML Matcher] Computing embeddings for ${uncached.length} markets (${embeddings.size} cached)...`);

  // Process in parallel batches with concurrency limit
  // Increased batch size since SBERT is fast locally (~5ms per embedding)
  const BATCH_SIZE = 50; // Process 50 at a time (SBERT handles this well)
  const TIMEOUT_MS = 3000; // 3 second timeout per embedding (generous for local)

  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);

    // Create promises with timeout
    const batchPromises = batch.map(async (market) => {
      try {
        const embedding = await Promise.race([
          getEmbedding(market, config),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error('Embedding timeout')), TIMEOUT_MS)
          ),
        ]);
        if (embedding) {
          return { key: getCacheKey(market.platform, market.id), embedding };
        }
      } catch (error) {
        // Silently skip failed embeddings, will use keyword similarity fallback
      }
      return null;
    });

    // Wait for batch to complete
    const results = await Promise.all(batchPromises);

    // Add successful embeddings to map
    for (const result of results) {
      if (result) {
        embeddings.set(result.key, result.embedding);
      }
    }
  }

  console.log(`[ML Matcher] Computed ${embeddings.size} total embeddings`);
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
// LLM CLASSIFICATION ENHANCEMENT
// =============================================================================

/**
 * Configuration for LLM classification
 */
interface LLMClassificationOptions {
  enabled: boolean;
  onlyMultiPlatform: boolean;     // Only classify clusters with multiple platforms
  minPreScore: number;            // Min pre-score for LLM classification
  enhanceArbitrageOnly: boolean;  // Only enhance clusters with arbitrage
}

const DEFAULT_LLM_OPTIONS: LLMClassificationOptions = {
  enabled: true,
  onlyMultiPlatform: true,
  minPreScore: 0.60,
  enhanceArbitrageOnly: false,
};

/**
 * Enhance match results with LLM classification
 */
async function enhanceWithLLMClassification(
  results: MLMatchResult[],
  embeddings: Map<string, number[]>,
  config: MLMatchConfig,
  options: Partial<LLMClassificationOptions> = {}
): Promise<MLMatchResult[]> {
  const opts = { ...DEFAULT_LLM_OPTIONS, ...options };

  // Check if LLM classification is available and enabled
  if (!opts.enabled || !isClassificationAvailable()) {
    console.log('[ML Matcher] LLM classification disabled or unavailable');
    return results;
  }

  const classifier = getClassifier();

  // Filter results that need classification
  const toClassify = results.filter(result => {
    if (opts.onlyMultiPlatform && result.markets.length < 2) return false;
    if (opts.enhanceArbitrageOnly && !result.arbitrage) return false;
    return true;
  });

  if (toClassify.length === 0) {
    return results;
  }

  console.log(`[ML Matcher] Enhancing ${toClassify.length} results with LLM classification...`);

  // Build classification inputs for multi-market clusters
  const classificationInputs: Array<{
    resultIndex: number;
    marketAIndex: number;
    marketBIndex: number;
    input: ClassificationInput;
  }> = [];

  for (let ri = 0; ri < toClassify.length; ri++) {
    const result = toClassify[ri];
    const resultIndex = results.indexOf(result);

    // For each pair of markets in the cluster, create a classification input
    for (let i = 0; i < result.markets.length; i++) {
      for (let j = i + 1; j < result.markets.length; j++) {
        const marketA = result.markets[i];
        const marketB = result.markets[j];

        // Get embeddings for pre-score
        const keyA = `${marketA.platform}:${marketA.platformId}`;
        const keyB = `${marketB.platform}:${marketB.platformId}`;
        const embA = embeddings.get(keyA);
        const embB = embeddings.get(keyB);

        // Calculate pre-scores
        const embeddingSimilarity = embA && embB
          ? cosineSimilarity(embA, embB)
          : textSimilarity(marketA.question, marketB.question);

        const entitiesA = extractEntities(marketA.question);
        const entitiesB = extractEntities(marketB.question);
        const { entityScore } = compareEntitiesSimple(entitiesA, entitiesB);
        const { dateScore } = compareDatesSimple(entitiesA.dates, entitiesB.dates);

        if (embeddingSimilarity < opts.minPreScore) continue;

        classificationInputs.push({
          resultIndex,
          marketAIndex: i,
          marketBIndex: j,
          input: {
            marketA: {
              id: marketA.platformId,
              platform: marketA.platform,
              question: marketA.question,
              endDate: marketA.closeDate,
            },
            marketB: {
              id: marketB.platformId,
              platform: marketB.platform,
              question: marketB.question,
              endDate: marketB.closeDate,
            },
            preScore: {
              embeddingSimilarity,
              entityOverlap: entityScore,
              dateAlignment: dateScore,
            },
          },
        });
      }
    }
  }

  if (classificationInputs.length === 0) {
    return results;
  }

  // Run LLM classification in batch
  try {
    const classifications = await classifier.classifyBatch(
      classificationInputs.map(c => c.input)
    );

    // Aggregate classifications per result
    const resultClassifications = new Map<number, ClassificationResult[]>();

    for (let i = 0; i < classifications.length; i++) {
      const { resultIndex } = classificationInputs[i];
      const classification = classifications[i];

      if (!resultClassifications.has(resultIndex)) {
        resultClassifications.set(resultIndex, []);
      }
      resultClassifications.get(resultIndex)!.push(classification);
    }

    // Enhance results with classification data
    for (const [resultIndex, clfs] of resultClassifications.entries()) {
      const result = results[resultIndex];

      // Determine overall classification (majority vote with confidence weighting)
      const exactCount = clfs.filter(c => c.type === 'exact').length;
      const relatedCount = clfs.filter(c => c.type === 'related').length;
      const total = clfs.length;

      // Calculate average confidence
      const avgConfidence = clfs.reduce((sum, c) => sum + c.confidence, 0) / total;

      // If mostly exact, keep as is with enhanced confidence
      if (exactCount > relatedCount && exactCount >= total * 0.5) {
        result.classification = {
          type: 'exact',
          confidence: Math.round(avgConfidence),
          reasoning: `${exactCount}/${total} pairs classified as exact match`,
        };
      } else if (relatedCount > 0) {
        // Mixed results - some pairs are related, not exact
        result.classification = {
          type: 'related',
          confidence: Math.round(avgConfidence),
          reasoning: `Mixed classification: ${exactCount} exact, ${relatedCount} related`,
        };

        // If originally had arbitrage but now classified as related, flag it
        if (result.arbitrage) {
          console.warn(
            `[ML Matcher] Warning: Cluster ${result.eventId} has arbitrage but classified as 'related' - may be false positive`
          );
        }
      }
    }

    console.log(`[ML Matcher] Enhanced ${resultClassifications.size} results with LLM classification`);
  } catch (error) {
    console.error('[ML Matcher] LLM classification failed:', error);
    // Continue without classification
  }

  return results;
}

/**
 * Simple entity comparison for pre-score calculation
 */
function compareEntitiesSimple(
  entitiesA: ExtractedEntities,
  entitiesB: ExtractedEntities
): { entityScore: number } {
  const allA = [
    ...entitiesA.people,
    ...entitiesA.organizations,
    ...entitiesA.events,
    ...entitiesA.locations,
  ].map(e => e.toLowerCase());

  const allB = [
    ...entitiesB.people,
    ...entitiesB.organizations,
    ...entitiesB.events,
    ...entitiesB.locations,
  ].map(e => e.toLowerCase());

  const setA = new Set(allA);
  const setB = new Set(allB);

  let matches = 0;
  for (const e of setA) {
    if (setB.has(e)) matches++;
  }

  const total = Math.max(setA.size, setB.size, 1);
  return { entityScore: matches / total };
}

/**
 * Simple date comparison for pre-score calculation
 */
function compareDatesSimple(
  datesA: ExtractedDate[],
  datesB: ExtractedDate[]
): { dateScore: number } {
  if (datesA.length === 0 && datesB.length === 0) return { dateScore: 0.5 };
  if (datesA.length === 0 || datesB.length === 0) return { dateScore: 0.3 };

  let minDiff = Infinity;
  for (const a of datesA) {
    for (const b of datesB) {
      if (a.normalized && b.normalized) {
        const diff = Math.abs(a.normalized.getTime() - b.normalized.getTime());
        minDiff = Math.min(minDiff, diff);
      }
    }
  }

  if (minDiff === Infinity) return { dateScore: 0.3 };

  const daysDiff = minDiff / (1000 * 60 * 60 * 24);
  if (daysDiff === 0) return { dateScore: 1.0 };
  if (daysDiff < 1) return { dateScore: 0.95 };
  if (daysDiff < 7) return { dateScore: 0.8 };
  if (daysDiff < 30) return { dateScore: 0.5 };
  return { dateScore: 0.2 };
}

// =============================================================================
// EV ANALYSIS ENHANCEMENT
// =============================================================================

/**
 * Enhance match results with EV analysis for arbitrage opportunities
 */
async function enhanceWithEVAnalysis(
  results: MLMatchResult[]
): Promise<MLMatchResult[]> {
  // Only process results with arbitrage opportunities
  const arbResults = results.filter(r => r.arbitrage && r.arbitrage.netProfit > 0);

  if (arbResults.length === 0) {
    return results;
  }

  console.log(`[ML Matcher] Enhancing ${arbResults.length} results with EV analysis...`);

  const evCalculator = getEVCalculator();

  for (const result of arbResults) {
    if (!result.arbitrage) continue;

    const { buyPlatform, sellPlatform } = result.arbitrage;

    // Find the buy and sell markets
    const buyMarket = result.markets.find(m => m.platform === buyPlatform);
    const sellMarket = result.markets.find(m => m.platform === sellPlatform);

    if (!buyMarket || !sellMarket) continue;

    try {
      // Convert to PlatformMarketData format
      const buyMarketData: PlatformMarketData = {
        platform: buyMarket.platform,
        yesPrice: buyMarket.yesPrice,
        noPrice: buyMarket.noPrice,
        volume24h: buyMarket.volume24h || 0,
        liquidity: buyMarket.liquidity || 10000,
        url: buyMarket.url || '',
      };

      const sellMarketData: PlatformMarketData = {
        platform: sellMarket.platform,
        yesPrice: sellMarket.yesPrice,
        noPrice: sellMarket.noPrice,
        volume24h: sellMarket.volume24h || 0,
        liquidity: sellMarket.liquidity || 10000,
        url: sellMarket.url || '',
      };

      // Calculate detailed EV for arbitrage
      const arbEV = await evCalculator.calculateArbitrageEV(
        buyMarketData,
        sellMarketData,
        1000, // Default $1000 analysis
        'solana' // Default origin chain
      );

      // Add EV analysis to result
      result.arbitrageEV = {
        rawSpread: arbEV.rawSpread,
        effectiveSpread: arbEV.effectiveSpread,
        netProfit: arbEV.netProfit,
        netProfitPct: arbEV.netProfitPct,
        capitalRequired: arbEV.capitalRequired,
        roi: arbEV.roi,
        confidenceLevel: arbEV.confidenceLevel,
        executionProbability: Math.min(
          arbEV.buyLeg.risk.executionProbability,
          arbEV.sellLeg.risk.executionProbability
        ),
        isViable: arbEV.isViable,
        executionPlan: arbEV.executionPlan,
        reasoning: arbEV.reasoning,
      };

      // Also add best platform EV for the result
      const [buyEV, sellEV] = await Promise.all([
        evCalculator.calculateTradeEV(buyMarketData, {
          side: 'YES',
          amount: 1000,
          inputToken: 'USDC',
          originChain: 'solana',
        }),
        evCalculator.calculateTradeEV(sellMarketData, {
          side: 'YES',
          amount: 1000,
          inputToken: 'USDC',
          originChain: 'solana',
        }),
      ]);

      // Determine best platform by effective odds
      const best = buyEV.effectiveOdds < sellEV.effectiveOdds
        ? { platform: buyMarket.platform, ev: buyEV }
        : { platform: sellMarket.platform, ev: sellEV };

      result.evAnalysis = {
        bestPlatform: best.platform,
        effectiveOdds: best.ev.effectiveOdds,
        totalCostPct: best.ev.costs.totalCostPct,
        recommendation: best.ev.recommendation.reasoning,
      };

    } catch (error) {
      console.warn(`[ML Matcher] EV analysis failed for ${result.eventId}:`, error);
      // Continue without EV analysis
    }
  }

  console.log(`[ML Matcher] EV analysis complete for ${arbResults.length} arbitrage opportunities`);
  return results;
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
 * @param llmOptions - LLM classification options
 * @returns Array of matched results
 */
export async function matchMarkets(
  markets: RawMarketData[],
  config: MLMatchConfig = DEFAULT_ML_CONFIG,
  llmOptions?: Partial<LLMClassificationOptions>
): Promise<MLMatchResult[]> {
  if (markets.length === 0) return [];

  console.log(`[ML Matcher] Processing ${markets.length} markets...`);

  // Get embeddings first (needed for both clustering and LLM pre-scores)
  const embeddings = await batchGetEmbeddings(markets, config);

  // Cluster markets
  const clustering = await clusterMarketsWithEmbeddings(markets, embeddings, config);

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

  // Enhance with LLM classification (for multi-platform clusters)
  const classifiedResults = await enhanceWithLLMClassification(
    results,
    embeddings,
    config,
    llmOptions
  );

  // Enhance arbitrage opportunities with EV analysis
  const enhancedResults = await enhanceWithEVAnalysis(classifiedResults);

  // Sort by platform count (multi-platform first), then by volume
  enhancedResults.sort((a, b) => {
    if (a.markets.length !== b.markets.length) {
      return b.markets.length - a.markets.length;
    }
    return b.totalVolume24h - a.totalVolume24h;
  });

  return enhancedResults;
}

/**
 * Cluster markets using pre-computed embeddings
 */
async function clusterMarketsWithEmbeddings(
  markets: RawMarketData[],
  embeddings: Map<string, number[]>,
  config: MLMatchConfig
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
