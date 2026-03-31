/**
 * Oracle Market Discovery Service
 *
 * Discovers trending markets from Polymarket and Jupiter for autonomous forecasting.
 * Applies triage criteria to select the most forecast-worthy markets.
 *
 * Triage Criteria:
 * 1. Volume > $10K (liquid enough to matter)
 * 2. Price between 10-90% (not too certain)
 * 3. Resolves in 7-90 days (actionable timeframe)
 * 4. Binary outcome (YES/NO only)
 * 5. Not already forecasted today
 *
 * @author BeRight Protocol
 * @version 1.0.0
 */

import { polymarketProvider } from '../dataFabric/providers/polymarket';
import { jupiterProvider } from '../dataFabric/providers/jupiter';
import { RawMarketData, DataPlatform } from '../data/types';
import { detectCategory, MarketCategory } from '../dataFabric/types';
import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';

// =============================================================================
// TYPES
// =============================================================================

export interface TriagedMarket {
  // Core identification
  id: string;
  platform: DataPlatform;
  platformId: string;

  // Content
  question: string;
  description?: string;
  category: MarketCategory;

  // Pricing
  yesPrice: number;
  noPrice: number;

  // Volume & Liquidity
  volume: number;
  volume24h?: number;
  liquidity: number;

  // Timing
  endDate: Date | null;
  daysUntilResolution: number;

  // Triage metadata
  triageScore: number;
  triageReasons: string[];

  // URL
  url: string;
}

export interface DiscoveryResult {
  markets: TriagedMarket[];
  scanned: number;
  eligible: number;
  skippedExisting: number;
  platforms: DataPlatform[];
  timestamp: Date;
  duration_ms: number;
}

// =============================================================================
// TRIAGE SCORING
// =============================================================================

/**
 * Triage criteria thresholds
 * Note: Volume thresholds are kept low since Polymarket returns volume
 * in raw units, not normalized to USD. Adjust as needed based on data quality.
 */
const TRIAGE_THRESHOLDS = {
  minVolume: 5,              // Minimum volume (raw units from API)
  minPrice: 0.10,            // Not below 10%
  maxPrice: 0.90,            // Not above 90%
  minDaysToResolve: 1,       // At least 1 day out (for markets with dates)
  maxDaysToResolve: 180,     // Within 6 months
  minLiquidity: 100,         // Minimum liquidity
};

/**
 * Calculate triage score for a market
 *
 * Higher score = more forecast-worthy
 * Components:
 * - Volume score (0-30): More volume = more important
 * - Price score (0-25): Closer to 50% = more interesting
 * - Timing score (0-25): Sweet spot is 14-60 days
 * - Liquidity score (0-20): More liquidity = better execution
 */
function calculateTriageScore(market: RawMarketData): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Volume score (0-30)
  const volume = market.volume || 0;
  if (volume >= 1000000) {
    score += 30;
    reasons.push('High volume (>$1M)');
  } else if (volume >= 100000) {
    score += 25;
    reasons.push('Good volume (>$100K)');
  } else if (volume >= 50000) {
    score += 20;
  } else if (volume >= 10000) {
    score += 15;
  } else {
    score += 5;
  }

  // Price score (0-25) - closer to 50% is more interesting
  const price = market.yesPrice || 0.5;
  const priceDistance = Math.abs(price - 0.5);
  if (priceDistance <= 0.10) {
    score += 25;
    reasons.push('Uncertain (40-60%)');
  } else if (priceDistance <= 0.20) {
    score += 20;
    reasons.push('Interesting range (30-70%)');
  } else if (priceDistance <= 0.30) {
    score += 15;
  } else {
    score += 5;
  }

  // Timing score (0-25)
  const daysToResolve = market.endDate
    ? Math.floor((market.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 999;

  if (daysToResolve >= 14 && daysToResolve <= 45) {
    score += 25;
    reasons.push('Optimal timeframe (2-6 weeks)');
  } else if (daysToResolve >= 7 && daysToResolve <= 60) {
    score += 20;
  } else if (daysToResolve >= 3 && daysToResolve <= 90) {
    score += 15;
  } else {
    score += 5;
  }

  // Liquidity score (0-20)
  const liquidity = market.liquidity || 0;
  if (liquidity >= 100000) {
    score += 20;
    reasons.push('Deep liquidity (>$100K)');
  } else if (liquidity >= 50000) {
    score += 15;
  } else if (liquidity >= 10000) {
    score += 10;
  } else {
    score += 5;
  }

  return { score, reasons };
}

/**
 * Check if market passes basic triage criteria
 * Note: End date is optional - markets without end dates can still pass
 * but are scored lower in calculateTriageScore
 */
function passesTriageCriteria(market: RawMarketData): boolean {
  const { minVolume, minPrice, maxPrice, minDaysToResolve, maxDaysToResolve, minLiquidity } = TRIAGE_THRESHOLDS;

  // Must have some volume
  if ((market.volume || 0) < minVolume) return false;

  // Must have price in range
  const price = market.yesPrice || 0.5;
  if (price < minPrice || price > maxPrice) return false;

  // If has end date, check it's within acceptable range
  if (market.endDate) {
    const daysToResolve = Math.floor((market.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysToResolve < minDaysToResolve || daysToResolve > maxDaysToResolve) return false;
  }
  // Markets without end dates are allowed but scored lower

  // Must have some liquidity
  if ((market.liquidity || 0) < minLiquidity) return false;

  // Must have a valid question
  if (!market.question || market.question.length < 10) return false;

  return true;
}

// =============================================================================
// DISCOVERY FUNCTIONS
// =============================================================================

/**
 * Fetch markets from all platforms
 */
async function fetchAllMarkets(limit: number = 100): Promise<RawMarketData[]> {
  const results = await Promise.allSettled([
    polymarketProvider.fetchMarkets({ limit }),
    jupiterProvider.fetchMarkets({ limit }),
  ]);

  const markets: RawMarketData[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.markets) {
      markets.push(...result.value.markets);
    } else if (result.status === 'rejected') {
      console.error('[Oracle Discovery] Provider error:', result.reason);
    }
  }

  return markets;
}

/**
 * Get already-forecasted market IDs for today
 */
async function getAlreadyForecastedIds(): Promise<Set<string>> {
  if (!isSupabaseConfigured) {
    return new Set();
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabaseAdmin
      .from('oracle_forecasts')
      .select('market_id')
      .eq('forecasted_for_date', today);

    if (error) {
      console.error('[Oracle Discovery] Error fetching existing forecasts:', error);
      return new Set();
    }

    return new Set(data?.map((f: { market_id: string }) => f.market_id) || []);
  } catch (error) {
    console.error('[Oracle Discovery] Supabase error:', error);
    return new Set();
  }
}

/**
 * Normalize market to TriagedMarket format
 */
function normalizeToTriagedMarket(market: RawMarketData, triageScore: number, triageReasons: string[]): TriagedMarket {
  const daysUntilResolution = market.endDate
    ? Math.floor((market.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  const question = market.question || market.title || '';

  return {
    id: `${market.platform}-${market.id}`,
    platform: market.platform,
    platformId: market.id,
    question,
    description: market.description,
    category: detectCategory(question),
    yesPrice: market.yesPrice,
    noPrice: market.noPrice,
    volume: market.volume || 0,
    volume24h: market.volume24h,
    liquidity: market.liquidity || 0,
    endDate: market.endDate || null,
    daysUntilResolution,
    triageScore,
    triageReasons,
    url: market.url || '',
  };
}

/**
 * Main discovery function - discovers trending markets for forecasting
 *
 * @param targetCount - Number of markets to return (default: 15)
 * @returns Discovery result with triaged markets
 */
export async function discoverTrendingMarkets(targetCount: number = 15): Promise<DiscoveryResult> {
  const startTime = Date.now();
  const platforms: DataPlatform[] = ['polymarket', 'jupiter'];

  console.log('[Oracle Discovery] Starting market discovery...');

  // Fetch markets from all platforms
  const allMarkets = await fetchAllMarkets(100);
  console.log(`[Oracle Discovery] Fetched ${allMarkets.length} markets from ${platforms.length} platforms`);

  // Get already forecasted market IDs
  const alreadyForecasted = await getAlreadyForecastedIds();
  console.log(`[Oracle Discovery] ${alreadyForecasted.size} markets already forecasted today`);

  // Filter and score markets
  const triaged: TriagedMarket[] = [];
  let skippedExisting = 0;

  for (const market of allMarkets) {
    // Skip if already forecasted today
    const marketKey = `${market.platform}-${market.id}`;
    if (alreadyForecasted.has(marketKey)) {
      skippedExisting++;
      continue;
    }

    // Check basic criteria
    if (!passesTriageCriteria(market)) {
      continue;
    }

    // Calculate triage score
    const { score, reasons } = calculateTriageScore(market);
    triaged.push(normalizeToTriagedMarket(market, score, reasons));
  }

  // Sort by triage score (descending)
  triaged.sort((a, b) => b.triageScore - a.triageScore);

  // Take top N markets
  const selectedMarkets = triaged.slice(0, targetCount);

  const result: DiscoveryResult = {
    markets: selectedMarkets,
    scanned: allMarkets.length,
    eligible: triaged.length,
    skippedExisting,
    platforms,
    timestamp: new Date(),
    duration_ms: Date.now() - startTime,
  };

  console.log(`[Oracle Discovery] Discovered ${selectedMarkets.length} markets for forecasting`);
  console.log(`[Oracle Discovery] Stats: scanned=${result.scanned}, eligible=${result.eligible}, skipped=${skippedExisting}`);

  return result;
}

/**
 * Get a single market by ID from any platform
 */
export async function getMarketById(marketId: string): Promise<RawMarketData | null> {
  // Try Polymarket
  if (marketId.startsWith('polymarket-')) {
    const id = marketId.replace('polymarket-', '');
    return polymarketProvider.fetchMarket(id);
  }

  // Try Jupiter
  if (marketId.startsWith('jupiter-')) {
    const id = marketId.replace('jupiter-', '');
    return jupiterProvider.fetchMarket(id);
  }

  // Try both
  const poly = await polymarketProvider.fetchMarket(marketId);
  if (poly) return poly;

  const jup = await jupiterProvider.fetchMarket(marketId);
  return jup;
}

/**
 * Health check for discovery service
 */
export async function isDiscoveryHealthy(): Promise<{ healthy: boolean; platforms: Record<string, boolean> }> {
  const results = await Promise.allSettled([
    polymarketProvider.isHealthy(),
    jupiterProvider.isHealthy(),
  ]);

  const platforms: Record<string, boolean> = {
    polymarket: results[0].status === 'fulfilled' && results[0].value,
    jupiter: results[1].status === 'fulfilled' && results[1].value,
  };

  const healthy = Object.values(platforms).some(v => v);

  return { healthy, platforms };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  calculateTriageScore,
  passesTriageCriteria,
  TRIAGE_THRESHOLDS,
};
