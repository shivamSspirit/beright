/**
 * Markets Skill for BeRight Protocol
 * Unified API for fetching prediction market data
 * All fetchers use AbortSignal timeouts and run in parallel via allSettled
 */

import { Market, Platform, MarketEvent, OddsComparison, TokenizedMarket, isTokenizedMarket } from '../types/index';
import { PLATFORMS } from '../config/platforms';
import { formatUsd, formatPct, calculateSimilarity } from './utils';
import { fetchMetaculus } from './metaculus';
import { expandWithSynonyms, SYNONYM_GROUPS } from '../config/synonyms';

// Per-platform timeout (ms) — fast platforms get tight deadlines
const PLATFORM_TIMEOUT: Record<Platform, number> = {
  polymarket: 4000,
  kalshi: 4000,
  manifold: 4000,
  limitless: 4000,
  metaculus: 5000,
};

// DFlow API for tokenized Kalshi markets (FREE, no key required)
const DFLOW_API = 'https://dev-prediction-markets-api.dflow.net/api/v1';

// Simple response cache (30s TTL)
const marketCache: Map<string, { data: Market[]; expiry: number }> = new Map();
const CACHE_TTL = 30_000;

function getCached(key: string): Market[] | null {
  const entry = marketCache.get(key);
  if (entry && entry.expiry > Date.now()) return entry.data;
  return null;
}

function setCache(key: string, data: Market[]): void {
  marketCache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

/**
 * Fetch markets from Polymarket
 */
async function fetchPolymarket(query?: string, limit = 15): Promise<Market[]> {
  const cacheKey = `poly:${query || ''}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const baseUrl = PLATFORMS.polymarket.baseUrl;
    const url = query
      ? `${baseUrl}/markets?closed=false&limit=${limit}&search=${encodeURIComponent(query)}`
      : `${baseUrl}/markets?closed=false&limit=${limit}&order=volume&ascending=false`;

    const response = await fetch(url, { signal: AbortSignal.timeout(PLATFORM_TIMEOUT.polymarket) });
    if (!response.ok) return [];

    const data = await response.json() as any[];

    const result = data.map(m => {
      let yesPrice = 0;
      let noPrice = 0;
      try {
        if (typeof m.outcomePrices === 'string') {
          const prices = JSON.parse(m.outcomePrices);
          yesPrice = parseFloat(prices[0]) || 0;
          noPrice = parseFloat(prices[1]) || 0;
        } else if (Array.isArray(m.outcomePrices)) {
          yesPrice = parseFloat(m.outcomePrices[0]) || 0;
          noPrice = parseFloat(m.outcomePrices[1]) || 0;
        }
      } catch {
        yesPrice = parseFloat(m.yes_price) || 0;
        noPrice = parseFloat(m.no_price) || 0;
      }

      return {
        platform: 'polymarket' as Platform,
        marketId: m.id || m.condition_id,
        title: m.question || m.title || '',
        question: m.question || m.title || '',
        yesPrice,
        noPrice,
        yesPct: yesPrice * 100,
        noPct: noPrice * 100,
        volume: parseFloat(m.volume) || parseFloat(m.volumeNum) || 0,
        liquidity: parseFloat(m.liquidity) || 0,
        endDate: m.end_date ? new Date(m.end_date) : null,
        status: (m.closed ? 'closed' : 'active') as 'active' | 'closed',
        url: `https://polymarket.com/event/${m.slug || m.id}`,
      };
    });
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Polymarket fetch error:', error);
    return [];
  }
}

/**
 * Fetch markets from DFlow (Tokenized Kalshi on Solana)
 * This replaces the basic Kalshi API with superior tokenized version
 * Includes: live orderbook, SPL token addresses, higher volume
 */
async function fetchDFlow(query?: string, limit = 20): Promise<Market[]> {
  const cacheKey = `dflow:${query || ''}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    // Fetch events with nested markets for full data
    // IMPORTANT: status=active to exclude finalized markets (they have null prices)
    const url = `${DFLOW_API}/events?limit=${limit}&withNestedMarkets=true&sort=volume24h&status=active`;
    const response = await fetch(url, { signal: AbortSignal.timeout(PLATFORM_TIMEOUT.kalshi) });
    if (!response.ok) return [];

    const data = await response.json() as { events: any[] };
    let events = data.events || [];

    // Filter by query if provided
    if (query) {
      const queryLower = query.toLowerCase();
      events = events.filter(e =>
        (e.title || '').toLowerCase().includes(queryLower) ||
        (e.subtitle || '').toLowerCase().includes(queryLower) ||
        (e.ticker || '').toLowerCase().includes(queryLower)
      );
    }

    // Flatten markets from events
    const result: Market[] = [];
    for (const event of events.slice(0, limit)) {
      const markets = event.markets || [];

      for (const m of markets) {
        // Skip finalized/closed markets (they have null prices)
        if (m.status !== 'active') continue;

        // Parse prices (DFlow returns as strings like "0.3200")
        const yesBid = parseFloat(m.yesBid) || 0;
        const yesAsk = parseFloat(m.yesAsk) || 0;
        const noBid = parseFloat(m.noBid) || 0;
        const noAsk = parseFloat(m.noAsk) || 0;

        // Skip markets with no price data
        if (yesBid === 0 && yesAsk === 0) continue;

        // Use mid-price for display
        const yesPrice = yesBid > 0 && yesAsk > 0 ? (yesBid + yesAsk) / 2 : yesBid || yesAsk;
        const noPrice = noBid > 0 && noAsk > 0 ? (noBid + noAsk) / 2 : noBid || noAsk;

        // Extract SPL token addresses for on-chain trading
        const accounts = m.accounts || {};
        const usdcAccount = accounts['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'] || {};

        result.push({
          platform: 'kalshi' as Platform,
          marketId: m.ticker || m.eventTicker,
          title: m.title || event.title || '',
          question: m.title || event.title || '',
          yesPrice,
          noPrice,
          yesPct: yesPrice * 100,
          noPct: noPrice * 100,
          volume: m.volume || event.volume || 0,
          volume24h: event.volume24h || 0,
          liquidity: m.openInterest || event.liquidity || 0,
          endDate: m.expirationTime ? new Date(m.expirationTime * 1000) : null,
          status: (m.status === 'active' ? 'active' : 'closed') as 'active' | 'closed',
          url: `https://kalshi.com/markets/${m.ticker}`,
          // DFlow-specific: SPL token addresses for on-chain trading
          onChain: {
            yesMint: usdcAccount.yesMint || null,
            noMint: usdcAccount.noMint || null,
            marketLedger: usdcAccount.marketLedger || null,
          },
          // Orderbook data for better price discovery
          orderbook: {
            yesBid,
            yesAsk,
            noBid,
            noAsk,
            spread: yesAsk - yesBid,
          },
        } as Market);
      }
    }

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('DFlow/Kalshi fetch error:', error);
    return [];
  }
}

/**
 * Legacy Kalshi API (fallback if DFlow fails)
 */
async function fetchKalshiLegacy(query?: string, limit = 15): Promise<Market[]> {
  const cacheKey = `kalshi-legacy:${query || ''}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const baseUrl = PLATFORMS.kalshi.baseUrl;
    const url = `${baseUrl}/markets?status=open&limit=${limit}`;

    const response = await fetch(url, { signal: AbortSignal.timeout(PLATFORM_TIMEOUT.kalshi) });
    if (!response.ok) return [];

    const data = await response.json() as { markets: any[] };
    let markets = data.markets || [];

    if (query) {
      const queryLower = query.toLowerCase();
      markets = markets.filter(m =>
        (m.title || '').toLowerCase().includes(queryLower) ||
        (m.subtitle || '').toLowerCase().includes(queryLower)
      );
    }

    const result = markets.slice(0, limit).map(m => ({
      platform: 'kalshi' as Platform,
      marketId: m.ticker || m.id,
      title: m.title || '',
      question: m.title || '',
      yesPrice: (m.yes_bid || m.last_price || 0) / 100,
      noPrice: (m.no_bid || (100 - (m.last_price || 0))) / 100,
      yesPct: m.yes_bid || m.last_price || 0,
      noPct: m.no_bid || (100 - (m.last_price || 0)),
      volume: m.volume || 0,
      liquidity: m.open_interest || 0,
      endDate: m.close_time ? new Date(m.close_time) : null,
      status: (m.status === 'open' ? 'active' : 'closed') as 'active' | 'closed',
      url: `https://kalshi.com/markets/${m.ticker}`,
    }));
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Kalshi legacy fetch error:', error);
    return [];
  }
}

/**
 * Fetch Kalshi markets - uses DFlow (tokenized) with fallback to legacy
 */
async function fetchKalshi(query?: string, limit = 15): Promise<Market[]> {
  // Try DFlow first (better data, live orderbook, SPL tokens)
  const dflowMarkets = await fetchDFlow(query, limit);
  if (dflowMarkets.length > 0) return dflowMarkets;

  // Fallback to legacy Kalshi API
  return fetchKalshiLegacy(query, limit);
}

/**
 * Fetch markets from Manifold
 * Uses /search-markets for both search and trending (sort=score)
 */
async function fetchManifold(query?: string, limit = 15): Promise<Market[]> {
  const cacheKey = `manifold:${query || ''}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const baseUrl = PLATFORMS.manifold.baseUrl;
    // Always use search-markets — /markets doesn't support sort param
    const url = `${baseUrl}/search-markets?term=${encodeURIComponent(query || '')}&limit=${limit}&sort=score&filter=open`;

    const response = await fetch(url, { signal: AbortSignal.timeout(PLATFORM_TIMEOUT.manifold) });
    if (!response.ok) return [];

    const data = await response.json() as any[];

    const result = data.slice(0, limit).map(m => ({
      platform: 'manifold' as Platform,
      marketId: m.id,
      title: m.question || '',
      question: m.question || '',
      yesPrice: m.probability || 0,
      noPrice: 1 - (m.probability || 0),
      yesPct: (m.probability || 0) * 100,
      noPct: (1 - (m.probability || 0)) * 100,
      volume: m.volume || 0,
      liquidity: m.totalLiquidity || 0,
      endDate: m.closeTime ? new Date(m.closeTime) : null,
      status: (m.isResolved ? 'resolved' : 'active') as 'active' | 'resolved',
      url: `https://manifold.markets/${m.creatorUsername}/${m.slug}`,
    }));
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Manifold fetch error:', error);
    return [];
  }
}

/**
 * Fetch markets from Limitless Exchange
 * Endpoint: /markets/active returns { data: [...] }
 */
async function fetchLimitless(query?: string, limit = 15): Promise<Market[]> {
  const cacheKey = `limitless:${query || ''}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const baseUrl = PLATFORMS.limitless.baseUrl;
    const url = `${baseUrl}/markets/active`;

    const response = await fetch(url, { signal: AbortSignal.timeout(PLATFORM_TIMEOUT.limitless) });
    if (!response.ok) return [];

    const json = await response.json() as any;
    let markets: any[] = json.data || json || [];
    if (!Array.isArray(markets)) markets = [];

    // Client-side filter if query
    if (query) {
      const queryLower = query.toLowerCase();
      markets = markets.filter(m =>
        (m.title || '').toLowerCase().includes(queryLower) ||
        (m.description || '').toLowerCase().includes(queryLower)
      );
    }

    const result = markets.slice(0, limit).map(m => {
      // prices is an array [yesPrice, noPrice]
      const prices = Array.isArray(m.prices) ? m.prices : [];
      const yesPrice = prices[0] ?? 0.5;
      const noPrice = prices[1] ?? (1 - yesPrice);

      return {
        platform: 'limitless' as Platform,
        marketId: m.id?.toString() || m.slug || null,
        title: m.title || '',
        question: m.title || '',
        yesPrice,
        noPrice,
        yesPct: yesPrice * 100,
        noPct: noPrice * 100,
        volume: parseFloat(m.volumeFormatted || m.volume) || 0,
        liquidity: 0,
        endDate: m.expirationDate ? new Date(m.expirationDate) : null,
        status: (m.expired ? 'closed' : 'active') as 'active' | 'closed',
        url: `https://limitless.exchange/${m.slug || m.id}`,
      };
    });
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Limitless fetch error:', error);
    return [];
  }
}

/**
 * Expand a search query with synonyms
 * e.g., "super bowl" -> ["super bowl", "pro football championship", "nfl championship"]
 */
function expandQuery(query: string): string[] {
  if (!query) return [''];

  const queries = new Set<string>([query]);
  const lowerQuery = query.toLowerCase();

  // Check if query matches any synonym group
  for (const group of SYNONYM_GROUPS) {
    for (const term of group) {
      if (lowerQuery.includes(term) || term.includes(lowerQuery)) {
        // Add other terms from the same group
        for (const synonym of group) {
          if (synonym !== term) {
            // Replace the matched term with the synonym
            const expanded = lowerQuery.replace(term, synonym);
            queries.add(expanded);
            // Also add just the synonym itself
            queries.add(synonym);
          }
        }
      }
    }
  }

  return Array.from(queries).slice(0, 3); // Limit to 3 query variations
}

/**
 * Search markets across all platforms (parallel with allSettled)
 * Now with query expansion for synonym support
 */
export async function searchMarkets(
  query: string,
  platforms: Platform[] = ['polymarket', 'kalshi', 'manifold', 'limitless', 'metaculus']
): Promise<Market[]> {
  const fetchers: Record<Platform, (q?: string) => Promise<Market[]>> = {
    polymarket: fetchPolymarket,
    kalshi: fetchKalshi,
    manifold: fetchManifold,
    limitless: fetchLimitless,
    metaculus: fetchMetaculus,
  };

  // Expand query with synonyms for better matching
  const queries = expandQuery(query);

  // Fetch with all query variations
  const allResults: Market[] = [];
  const seenIds = new Set<string>();

  for (const q of queries) {
    const results = await Promise.allSettled(
      platforms
        .filter(p => fetchers[p])
        .map(p => fetchers[p](q))
    );

    const markets = results
      .filter((r): r is PromiseFulfilledResult<Market[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);

    // Deduplicate by marketId
    for (const market of markets) {
      const key = `${market.platform}:${market.marketId}`;
      if (!seenIds.has(key)) {
        seenIds.add(key);
        allResults.push(market);
      }
    }
  }

  return allResults;
}

/**
 * Get hot/trending markets
 */
export async function getHotMarkets(limit = 20): Promise<Market[]> {
  const markets = await searchMarkets('');

  // Sort by volume
  return markets
    .filter(m => m.volume > 0)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, limit);
}

/**
 * Get DFlow top markets by 24h volume (tokenized Kalshi)
 * Best for seeing what's hot RIGHT NOW
 */
export async function getDFlowHotMarkets(limit = 15): Promise<Market[]> {
  try {
    const url = `${DFLOW_API}/events?limit=${limit}&sort=volume24h&withNestedMarkets=true`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return [];

    const data = await response.json() as { events: any[] };
    const events = data.events || [];

    const result: Market[] = [];
    for (const event of events) {
      // Get the primary market for each event
      const primaryMarket = event.markets?.[0];
      if (!primaryMarket) continue;

      const yesBid = parseFloat(primaryMarket.yesBid) || 0;
      const yesAsk = parseFloat(primaryMarket.yesAsk) || 0;
      const yesPrice = yesBid > 0 && yesAsk > 0 ? (yesBid + yesAsk) / 2 : yesBid || yesAsk;

      result.push({
        platform: 'kalshi' as Platform,
        marketId: event.ticker,
        title: event.title || '',
        question: event.title || '',
        yesPrice,
        noPrice: 1 - yesPrice,
        yesPct: yesPrice * 100,
        noPct: (1 - yesPrice) * 100,
        volume: event.volume || 0,
        volume24h: event.volume24h || 0,
        liquidity: event.liquidity || 0,
        endDate: null,
        status: 'active' as const,
        url: `https://kalshi.com/markets/${event.ticker}`,
      } as Market);
    }

    return result;
  } catch (error) {
    console.error('DFlow hot markets error:', error);
    return [];
  }
}

/**
 * Get ONLY tokenized markets (tradeable on Solana via wallet signing)
 * These are DFlow/Kalshi markets with SPL token addresses
 * Use this for Trading UI / Homepage where users can trade by signing wallet
 */
export async function getTradeableMarkets(query?: string, limit = 20): Promise<TokenizedMarket[]> {
  // Fetch from DFlow (tokenized Kalshi) - the only source with SPL tokens
  const markets = await fetchDFlow(query, limit * 2); // Fetch extra to account for filtering

  // Filter to only markets with valid on-chain data (yesMint + noMint)
  const tokenized = markets
    .filter(isTokenizedMarket)
    .slice(0, limit) as TokenizedMarket[];

  return tokenized;
}

/**
 * Get hot tradeable markets sorted by 24h volume
 * For Trading UI homepage - shows most active tokenized markets
 */
export async function getHotTradeableMarkets(limit = 15): Promise<TokenizedMarket[]> {
  try {
    const url = `${DFLOW_API}/events?limit=${limit * 2}&sort=volume24h&withNestedMarkets=true&status=active`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return [];

    const data = await response.json() as { events: any[] };
    const events = data.events || [];

    const result: TokenizedMarket[] = [];
    for (const event of events) {
      const markets = event.markets || [];

      for (const m of markets) {
        if (m.status !== 'active') continue;

        const yesBid = parseFloat(m.yesBid) || 0;
        const yesAsk = parseFloat(m.yesAsk) || 0;
        const noBid = parseFloat(m.noBid) || 0;
        const noAsk = parseFloat(m.noAsk) || 0;

        if (yesBid === 0 && yesAsk === 0) continue;

        const yesPrice = yesBid > 0 && yesAsk > 0 ? (yesBid + yesAsk) / 2 : yesBid || yesAsk;
        const noPrice = noBid > 0 && noAsk > 0 ? (noBid + noAsk) / 2 : noBid || noAsk;

        const accounts = m.accounts || {};
        const usdcAccount = accounts['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'] || {};

        // Only include if has valid SPL token addresses
        if (!usdcAccount.yesMint || !usdcAccount.noMint) continue;

        result.push({
          platform: 'kalshi' as Platform,
          marketId: m.ticker || m.eventTicker,
          title: m.title || event.title || '',
          question: m.title || event.title || '',
          yesPrice,
          noPrice,
          yesPct: yesPrice * 100,
          noPct: noPrice * 100,
          volume: m.volume || event.volume || 0,
          volume24h: event.volume24h || 0,
          liquidity: m.openInterest || event.liquidity || 0,
          endDate: m.expirationTime ? new Date(m.expirationTime * 1000) : null,
          status: 'active' as const,
          url: `https://kalshi.com/markets/${m.ticker}`,
          onChain: {
            yesMint: usdcAccount.yesMint,
            noMint: usdcAccount.noMint,
            marketLedger: usdcAccount.marketLedger || null,
          },
          orderbook: {
            yesBid,
            yesAsk,
            noBid,
            noAsk,
            spread: yesAsk - yesBid,
          },
        });

        if (result.length >= limit) break;
      }
      if (result.length >= limit) break;
    }

    return result;
  } catch (error) {
    console.error('Hot tradeable markets error:', error);
    return [];
  }
}

/**
 * Format tradeable markets for Trading UI display
 * Shows SPL token addresses and trading-relevant info
 */
export function formatTradeableMarkets(markets: TokenizedMarket[], title = 'Tradeable Markets'): string {
  if (!markets.length) return `No tradeable markets found for: ${title}`;

  let output = `\n${'='.repeat(50)}\n   ${title}\n${'='.repeat(50)}\n`;
  output += `   Trade by signing your Solana wallet\n\n`;

  for (const market of markets.slice(0, 15)) {
    output += `[KALSHI/DFLOW]\n`;
    output += `   ${market.title.slice(0, 70)}\n`;
    output += `   YES: ${formatPct(market.yesPrice)}  |  NO: ${formatPct(market.noPrice)}\n`;

    // Orderbook spread
    if (market.orderbook.spread > 0) {
      output += `   Spread: ${(market.orderbook.spread * 100).toFixed(1)}%\n`;
    }

    // Volume
    if (market.volume24h && market.volume24h > 0) {
      output += `   24h Vol: ${formatUsd(market.volume24h)} | Total: ${formatUsd(market.volume)}\n`;
    } else if (market.volume > 0) {
      output += `   Volume: ${formatUsd(market.volume)}\n`;
    }

    // SPL Token addresses (for wallet trading)
    output += `   YES Token: ${market.onChain.yesMint.slice(0, 8)}...${market.onChain.yesMint.slice(-4)}\n`;
    output += `   NO Token: ${market.onChain.noMint.slice(0, 8)}...${market.onChain.noMint.slice(-4)}\n`;
    output += '\n';
  }

  output += `\nTrade via Jupiter: https://jup.ag/swap/USDC-[TOKEN_ADDRESS]\n`;

  return output;
}

/**
 * Get all markets for intelligence/analysis (includes non-tokenized)
 * Use for arbitrage, research, accuracy analysis
 * Provides external links for platforms without on-chain trading
 */
export async function getIntelligenceMarkets(
  query: string,
  platforms: Platform[] = ['polymarket', 'kalshi', 'manifold', 'limitless', 'metaculus']
): Promise<Market[]> {
  return searchMarkets(query, platforms);
}

/**
 * Format markets for intelligence view with external links
 * Shows all platforms with links for manual trading on external sites
 */
export function formatIntelligenceMarkets(markets: Market[], title = 'Market Intelligence'): string {
  if (!markets.length) return `No markets found for: ${title}`;

  const platformEmoji: Record<Platform, string> = {
    polymarket: '',
    kalshi: '',
    limitless: '',
    manifold: '',
    metaculus: '',
  };

  const platformLabel: Record<Platform, string> = {
    polymarket: 'POLYMARKET',
    kalshi: 'KALSHI',
    limitless: 'LIMITLESS',
    manifold: 'MANIFOLD',
    metaculus: 'METACULUS',
  };

  let output = `\n${'='.repeat(50)}\n   ${title}\n${'='.repeat(50)}\n`;
  output += `   Analysis & External Links\n\n`;

  for (const market of markets.slice(0, 15)) {
    const emoji = platformEmoji[market.platform] || '';
    const label = platformLabel[market.platform] || market.platform.toUpperCase();
    const m = market as any;

    // Check if tokenized (tradeable on-chain)
    const isOnChain = isTokenizedMarket(market);
    const tradeLabel = isOnChain ? ' [ON-CHAIN]' : ' [EXTERNAL]';

    output += `${emoji} [${label}]${tradeLabel}\n`;
    output += `   ${market.title.slice(0, 70)}\n`;
    output += `   YES: ${formatPct(market.yesPrice)}  |  NO: ${formatPct(market.noPrice)}\n`;

    if (m.volume24h > 0) {
      output += `   24h Vol: ${formatUsd(m.volume24h)} | Total: ${formatUsd(market.volume)}\n`;
    } else if (market.volume > 0) {
      output += `   Volume: ${formatUsd(market.volume)}\n`;
    }

    // External link for non-tokenized markets
    output += `   Link: ${market.url}\n`;
    output += '\n';
  }

  return output;
}

/**
 * Compare odds across platforms
 */
export async function compareOdds(query: string): Promise<OddsComparison> {
  const markets = await searchMarkets(query);

  // Group by platform
  const byPlatform: Record<Platform, Market[]> = {
    polymarket: [],
    kalshi: [],
    manifold: [],
    limitless: [],
    metaculus: [],
  };

  for (const market of markets) {
    byPlatform[market.platform].push(market);
  }

  // Find arbitrage opportunities (simplified)
  const arbitrageOpportunities: OddsComparison['arbitrageOpportunities'] = [];

  const platformList = Object.keys(byPlatform) as Platform[];
  for (let i = 0; i < platformList.length; i++) {
    for (let j = i + 1; j < platformList.length; j++) {
      const p1 = platformList[i];
      const p2 = platformList[j];

      for (const m1 of byPlatform[p1]) {
        for (const m2 of byPlatform[p2]) {
          const similarity = calculateSimilarity(m1.title, m2.title);
          if (similarity > 0.35) {
            const spread = Math.abs(m1.yesPct - m2.yesPct);
            if (spread > 3) {
              arbitrageOpportunities.push({
                topic: m1.title.slice(0, 60),
                platformA: p1,
                platformB: p2,
                marketATitle: m1.title.slice(0, 50),
                marketBTitle: m2.title.slice(0, 50),
                priceAYes: m1.yesPrice,
                priceBYes: m2.yesPrice,
                spread: spread / 100,
                strategy: m1.yesPrice < m2.yesPrice
                  ? `Buy YES @ ${p1} (${formatPct(m1.yesPrice)}), Sell @ ${p2}`
                  : `Buy YES @ ${p2} (${formatPct(m2.yesPrice)}), Sell @ ${p1}`,
                profitPercent: spread / 100,
                matchConfidence: similarity,
                volumeA: m1.volume,
                volumeB: m2.volume,
              });
            }
          }
        }
      }
    }
  }

  return {
    query,
    markets,
    byPlatform,
    arbitrageOpportunities: arbitrageOpportunities.sort((a, b) => b.profitPercent - a.profitPercent),
  };
}

/**
 * Format markets for display
 * Now includes 24h volume and on-chain indicators for DFlow markets
 */
export function formatMarkets(markets: Market[], title = 'Markets'): string {
  if (!markets.length) return `No markets found for: ${title}`;

  const platformEmoji: Record<Platform, string> = {
    polymarket: '🟣',
    kalshi: '🔵',
    limitless: '🟢',
    manifold: '🟡',
    metaculus: '🔴',
  };

  let output = `\n${'='.repeat(50)}\n   ${title}\n${'='.repeat(50)}\n\n`;

  for (const market of markets.slice(0, 15)) {
    const emoji = platformEmoji[market.platform] || '⚪';
    const m = market as any;

    // Check if this is a DFlow-powered market (has on-chain data)
    const isTokenized = m.onChain?.yesMint ? '⛓️' : '';

    output += `${emoji} [${market.platform.toUpperCase()}] ${isTokenized}\n`;
    output += `   ${market.title.slice(0, 70)}\n`;
    output += `   YES: ${formatPct(market.yesPrice)}  |  NO: ${formatPct(market.noPrice)}\n`;

    // Show orderbook spread if available
    if (m.orderbook?.spread > 0) {
      output += `   Spread: ${(m.orderbook.spread * 100).toFixed(1)}%\n`;
    }

    // Show volume (prefer 24h if available)
    if (m.volume24h > 0) {
      output += `   24h Vol: ${formatUsd(m.volume24h)} | Total: ${formatUsd(market.volume)}\n`;
    } else if (market.volume > 0) {
      output += `   Volume: ${formatUsd(market.volume)}\n`;
    }

    output += '\n';
  }

  // Add legend if any tokenized markets
  const hasTokenized = markets.some(m => (m as any).onChain?.yesMint);
  if (hasTokenized) {
    output += `\n⛓️ = Tokenized on Solana (via DFlow) - tradeable as SPL tokens\n`;
  }

  return output;
}

/**
 * Format comparison for display
 */
export function formatComparison(comparison: OddsComparison): string {
  let output = `\n${'='.repeat(50)}\n   ODDS COMPARISON: ${comparison.query.toUpperCase()}\n${'='.repeat(50)}\n\n`;

  for (const [platform, markets] of Object.entries(comparison.byPlatform)) {
    if (markets.length === 0) continue;

    output += `📊 ${platform.toUpperCase()}\n`;
    for (const market of markets.slice(0, 3)) {
      output += `   ${market.title.slice(0, 50)}\n`;
      output += `   YES: ${formatPct(market.yesPrice)}\n\n`;
    }
  }

  if (comparison.arbitrageOpportunities.length > 0) {
    output += '🎯 ARBITRAGE OPPORTUNITIES:\n';
    for (const arb of comparison.arbitrageOpportunities.slice(0, 3)) {
      output += `\n   Spread: ${formatPct(arb.spread)}\n`;
      output += `   ${arb.platformA}: ${formatPct(arb.priceAYes)}\n`;
      output += `   ${arb.platformB}: ${formatPct(arb.priceBYes)}\n`;
    }
  }

  return output;
}

// CLI interface
if (process.argv[1]?.endsWith('markets.ts')) {
  const args = process.argv.slice(2);
  const command = args[0];
  const query = args.slice(1).join(' ');

  (async () => {
    if (command === 'search' && query) {
      const markets = await searchMarkets(query);
      console.log(formatMarkets(markets, `Search: ${query}`));
    } else if (command === 'hot') {
      const markets = await getHotMarkets();
      console.log(formatMarkets(markets, 'Trending Markets'));
    } else if (command === 'dflow') {
      // DFlow-specific: Top tokenized Kalshi markets by 24h volume
      const markets = await getDFlowHotMarkets(15);
      console.log(formatMarkets(markets, 'DFlow Hot Markets (Tokenized Kalshi)'));
    } else if (command === 'tradeable') {
      // TRADING UI: Only tokenized markets with SPL tokens
      const markets = await getHotTradeableMarkets(15);
      console.log(formatTradeableMarkets(markets, 'Tradeable Markets (Wallet Trading)'));
    } else if (command === 'tradeable-search' && query) {
      // Search tokenized markets only
      const markets = await getTradeableMarkets(query, 15);
      console.log(formatTradeableMarkets(markets, `Tradeable: ${query}`));
    } else if (command === 'intel' && query) {
      // INTELLIGENCE: All platforms with external links
      const markets = await getIntelligenceMarkets(query);
      console.log(formatIntelligenceMarkets(markets, `Intelligence: ${query}`));
    } else if (command === 'compare' && query) {
      const comparison = await compareOdds(query);
      console.log(formatComparison(comparison));
    } else {
      console.log('Usage:');
      console.log('');
      console.log('  TRADING UI (Tokenized markets - wallet signing):');
      console.log('  ts-node markets.ts tradeable              - Hot tradeable markets (DFlow/Kalshi)');
      console.log('  ts-node markets.ts tradeable-search <q>   - Search tradeable markets');
      console.log('');
      console.log('  INTELLIGENCE (All platforms - external links):');
      console.log('  ts-node markets.ts intel <query>          - Search all platforms for analysis');
      console.log('  ts-node markets.ts compare <query>        - Compare odds + find arbitrage');
      console.log('');
      console.log('  GENERAL:');
      console.log('  ts-node markets.ts search <query>         - Search all platforms');
      console.log('  ts-node markets.ts hot                    - Trending markets (all platforms)');
      console.log('  ts-node markets.ts dflow                  - DFlow hot markets');
    }
  })();
}
