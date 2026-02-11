/**
 * Platform Configuration for BeRight Protocol
 * API endpoints and settings for prediction markets
 */

import { PlatformConfig } from '../types';

export const PLATFORMS: Record<string, PlatformConfig> = {
  polymarket: {
    name: 'polymarket',
    baseUrl: 'https://gamma-api.polymarket.com',
    requiresAuth: false,
    fee: 0.005,  // 0.5%
  },
  kalshi: {
    name: 'kalshi',
    baseUrl: 'https://api.elections.kalshi.com/trade-api/v2',
    requiresAuth: true,
    fee: 0.01,   // 1%
  },
  limitless: {
    name: 'limitless',
    baseUrl: 'https://api.limitless.exchange',
    requiresAuth: false,
    fee: 0.01,   // 1% estimated
  },
  manifold: {
    name: 'manifold',
    baseUrl: 'https://api.manifold.markets/v0',
    requiresAuth: false,
    fee: 0,      // No fees on Manifold
  },
  metaculus: {
    name: 'metaculus' as any,
    baseUrl: 'https://www.metaculus.com/api2',
    requiresAuth: false,
    fee: 0,      // No fees (not a real-money market)
  },
};

// Solana Configuration
export const SOLANA = {
  rpcEndpoint: process.env.HELIUS_RPC_MAINNET || `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
  jupiterApi: 'https://lite-api.jup.ag/swap/v1',
  jitoEndpoint: 'https://mainnet.block-engine.jito.wtf/api/v1',
};

// Token Addresses
export const TOKENS = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  SOL: 'So11111111111111111111111111111111111111112',
  WSOL: 'So11111111111111111111111111111111111111112',
};

// News RSS Feeds
export const RSS_FEEDS: Record<string, string> = {
  // General News
  reuters: 'https://feeds.reuters.com/reuters/topNews',
  ap: 'https://apnews.com/apf-topnews/feed',
  bbc: 'https://feeds.bbci.co.uk/news/world/rss.xml',

  // Business/Finance
  wsj_markets: 'https://feeds.content.dowjones.io/public/rss/mw_topstories',
  cnbc: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114',
  bloomberg: 'https://feeds.bloomberg.com/markets/news.rss',

  // Crypto
  coindesk: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
  cointelegraph: 'https://cointelegraph.com/rss',
  decrypt: 'https://decrypt.co/feed',

  // Politics
  politico: 'https://www.politico.com/rss/politicopicks.xml',
  hill: 'https://thehill.com/feed/',
  fivethirtyeight: 'https://fivethirtyeight.com/features/feed/',

  // Tech
  techcrunch: 'https://techcrunch.com/feed/',
  verge: 'https://www.theverge.com/rss/index.xml',
};

// Google News RSS template
export const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en';

// ============================================
// OFFICIAL GOVERNMENT SOURCES (Tier 1 - 100% Authentic)
// ============================================
export const OFFICIAL_SOURCES: Record<string, string> = {
  // US Federal Reserve
  fed: 'https://www.federalreserve.gov/feeds/press_all.xml',
  fed_speeches: 'https://www.federalreserve.gov/feeds/speeches.xml',

  // US Treasury
  treasury: 'https://home.treasury.gov/system/files/136/treasury-rss.xml',

  // SEC (Securities and Exchange Commission)
  sec_filings: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&output=atom',
  sec_press: 'https://www.sec.gov/news/pressreleases.rss',

  // White House
  whitehouse: 'https://www.whitehouse.gov/feed/',

  // Congress
  congress_bills: 'https://www.congress.gov/rss/most-viewed-bills.xml',
  congress_activity: 'https://www.congress.gov/rss/house-floor-today.xml',

  // Bureau of Labor Statistics (Jobs, CPI, etc.)
  bls: 'https://www.bls.gov/feed/bls_latest.rss',

  // CFTC (Commodity Futures Trading Commission)
  cftc: 'https://www.cftc.gov/rss/pressroom/pressreleases.xml',

  // FDA (for health/pharma markets)
  fda: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml',

  // CDC (for health events)
  cdc: 'https://tools.cdc.gov/podcasts/feed.asp?feedid=183',

  // State Department (geopolitics)
  state_dept: 'https://www.state.gov/rss-feed/press-releases/feed/',

  // Supreme Court (for legal markets)
  scotus_blog: 'https://www.scotusblog.com/feed/',
};

// ============================================
// SOURCE TIERS - Authenticity Scoring
// ============================================
export type SourceTier = 1 | 2 | 3 | 4 | 5;

export interface SourceConfig {
  tier: SourceTier;
  name: string;
  reliability: number; // 0-100
  speed: 'realtime' | 'fast' | 'moderate' | 'slow';
  category: 'official' | 'wire' | 'major_news' | 'specialized' | 'social';
}

export const SOURCE_TIERS: Record<string, SourceConfig> = {
  // Tier 1: Official/Government Sources (100% authentic)
  fed: { tier: 1, name: 'Federal Reserve', reliability: 100, speed: 'moderate', category: 'official' },
  fed_speeches: { tier: 1, name: 'Fed Speeches', reliability: 100, speed: 'moderate', category: 'official' },
  treasury: { tier: 1, name: 'US Treasury', reliability: 100, speed: 'moderate', category: 'official' },
  sec_filings: { tier: 1, name: 'SEC Filings', reliability: 100, speed: 'fast', category: 'official' },
  sec_press: { tier: 1, name: 'SEC Press', reliability: 100, speed: 'moderate', category: 'official' },
  whitehouse: { tier: 1, name: 'White House', reliability: 100, speed: 'moderate', category: 'official' },
  congress_bills: { tier: 1, name: 'Congress Bills', reliability: 100, speed: 'slow', category: 'official' },
  bls: { tier: 1, name: 'Bureau of Labor Stats', reliability: 100, speed: 'slow', category: 'official' },
  cftc: { tier: 1, name: 'CFTC', reliability: 100, speed: 'moderate', category: 'official' },
  fda: { tier: 1, name: 'FDA', reliability: 100, speed: 'moderate', category: 'official' },
  cdc: { tier: 1, name: 'CDC', reliability: 100, speed: 'moderate', category: 'official' },
  state_dept: { tier: 1, name: 'State Department', reliability: 100, speed: 'moderate', category: 'official' },

  // Tier 2: Wire Services (95% reliable, fast)
  reuters: { tier: 2, name: 'Reuters', reliability: 95, speed: 'realtime', category: 'wire' },
  ap: { tier: 2, name: 'Associated Press', reliability: 95, speed: 'realtime', category: 'wire' },

  // Tier 3: Major News Outlets (90% reliable)
  bloomberg: { tier: 3, name: 'Bloomberg', reliability: 90, speed: 'fast', category: 'major_news' },
  wsj_markets: { tier: 3, name: 'Wall Street Journal', reliability: 90, speed: 'fast', category: 'major_news' },
  bbc: { tier: 3, name: 'BBC', reliability: 90, speed: 'fast', category: 'major_news' },
  cnbc: { tier: 3, name: 'CNBC', reliability: 85, speed: 'fast', category: 'major_news' },

  // Tier 4: Specialized Sources (85% reliable)
  coindesk: { tier: 4, name: 'CoinDesk', reliability: 85, speed: 'fast', category: 'specialized' },
  cointelegraph: { tier: 4, name: 'Cointelegraph', reliability: 80, speed: 'fast', category: 'specialized' },
  decrypt: { tier: 4, name: 'Decrypt', reliability: 80, speed: 'fast', category: 'specialized' },
  politico: { tier: 4, name: 'Politico', reliability: 85, speed: 'fast', category: 'specialized' },
  hill: { tier: 4, name: 'The Hill', reliability: 80, speed: 'fast', category: 'specialized' },
  fivethirtyeight: { tier: 4, name: 'FiveThirtyEight', reliability: 90, speed: 'moderate', category: 'specialized' },
  techcrunch: { tier: 4, name: 'TechCrunch', reliability: 80, speed: 'fast', category: 'specialized' },
  scotus_blog: { tier: 4, name: 'SCOTUSblog', reliability: 95, speed: 'moderate', category: 'specialized' },

  // Tier 5: Social/Aggregated (70% reliable, fastest but noisy)
  google_news: { tier: 5, name: 'Google News', reliability: 70, speed: 'realtime', category: 'social' },
  reddit: { tier: 5, name: 'Reddit', reliability: 50, speed: 'realtime', category: 'social' },
};

// Helper to get tier for a source
export function getSourceTier(source: string): SourceConfig | null {
  const normalized = source.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return SOURCE_TIERS[normalized] || null;
}

// Calculate weighted confidence based on source tiers
export function calculateSourceConfidence(sources: string[]): number {
  if (sources.length === 0) return 0;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const source of sources) {
    const config = getSourceTier(source);
    if (config) {
      const weight = 6 - config.tier; // Tier 1 = weight 5, Tier 5 = weight 1
      weightedSum += config.reliability * weight;
      totalWeight += weight;
    } else {
      // Unknown source gets tier 5 treatment
      weightedSum += 60;
      totalWeight += 1;
    }
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;
}
