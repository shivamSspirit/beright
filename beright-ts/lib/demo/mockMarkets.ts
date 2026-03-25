/**
 * Demo Mode - Mock Market Data
 *
 * Realistic prediction market data for demo/VC presentations.
 * These markets look real but use devnet for transactions.
 *
 * Categories covered:
 * - Crypto (BTC, ETH, SOL)
 * - Politics (Elections, Policy)
 * - Economics (Fed, GDP, Inflation)
 * - Tech (AI, Companies)
 * - Sports (Major events)
 */

import { Platform } from '../../types/market';

// ============================================
// TYPES
// ============================================

export interface DemoMarket {
  id: string;
  platform: Platform;
  title: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  yesPct: number;
  noPct: number;
  volume: number;
  volume24h: number;
  liquidity: number;
  openInterest: number;
  endDate: string;
  status: 'active' | 'closed' | 'resolved';
  url: string;
  category: string;
  imageUrl?: string;
  // DFlow-compatible fields
  ticker: string;
  seriesTicker: string;
  tokens: {
    yesMint: string;
    noMint: string;
    marketLedger: string;
    isInitialized: boolean;
    redemptionStatus: 'open' | 'closed';
  };
}

// ============================================
// DEMO MARKETS - CRYPTO
// ============================================

const CRYPTO_MARKETS: DemoMarket[] = [
  {
    id: 'demo-btc-100k-2025',
    ticker: 'DEMO-BTC100K',
    seriesTicker: 'DEMO-BTC-SERIES',
    platform: 'dflow',
    title: 'Will Bitcoin reach $100,000 by end of 2025?',
    question: 'Will Bitcoin reach $100,000 by end of 2025?',
    yesPrice: 0.72,
    noPrice: 0.28,
    yesPct: 72,
    noPct: 28,
    volume: 4_250_000,
    volume24h: 185_000,
    liquidity: 890_000,
    openInterest: 12500,
    endDate: '2025-12-31T23:59:59Z',
    status: 'active',
    url: 'https://demo.beright.fun/market/btc-100k',
    category: 'crypto',
    imageUrl: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=400&h=300&fit=crop',
    tokens: {
      yesMint: 'DemoYesMint1111111111111111111111111111111',
      noMint: 'DemoNoMint11111111111111111111111111111111',
      marketLedger: 'DemoLedger1111111111111111111111111111111',
      isInitialized: true,
      redemptionStatus: 'open',
    },
  },
  {
    id: 'demo-eth-10k-2025',
    ticker: 'DEMO-ETH10K',
    seriesTicker: 'DEMO-ETH-SERIES',
    platform: 'dflow',
    title: 'Will Ethereum reach $10,000 by end of 2025?',
    question: 'Will Ethereum reach $10,000 by end of 2025?',
    yesPrice: 0.38,
    noPrice: 0.62,
    yesPct: 38,
    noPct: 62,
    volume: 1_890_000,
    volume24h: 92_000,
    liquidity: 445_000,
    openInterest: 7800,
    endDate: '2025-12-31T23:59:59Z',
    status: 'active',
    url: 'https://demo.beright.fun/market/eth-10k',
    category: 'crypto',
    imageUrl: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=400&h=300&fit=crop',
    tokens: {
      yesMint: 'DemoYesMint2222222222222222222222222222222',
      noMint: 'DemoNoMint22222222222222222222222222222222',
      marketLedger: 'DemoLedger2222222222222222222222222222222',
      isInitialized: true,
      redemptionStatus: 'open',
    },
  },
  {
    id: 'demo-sol-500-2025',
    ticker: 'DEMO-SOL500',
    seriesTicker: 'DEMO-SOL-SERIES',
    platform: 'dflow',
    title: 'Will Solana reach $500 by end of 2025?',
    question: 'Will Solana reach $500 by end of 2025?',
    yesPrice: 0.25,
    noPrice: 0.75,
    yesPct: 25,
    noPct: 75,
    volume: 980_000,
    volume24h: 45_000,
    liquidity: 220_000,
    openInterest: 4200,
    endDate: '2025-12-31T23:59:59Z',
    status: 'active',
    url: 'https://demo.beright.fun/market/sol-500',
    category: 'crypto',
    imageUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&h=300&fit=crop',
    tokens: {
      yesMint: 'DemoYesMint3333333333333333333333333333333',
      noMint: 'DemoNoMint33333333333333333333333333333333',
      marketLedger: 'DemoLedger3333333333333333333333333333333',
      isInitialized: true,
      redemptionStatus: 'open',
    },
  },
];

// ============================================
// DEMO MARKETS - POLITICS
// ============================================

const POLITICS_MARKETS: DemoMarket[] = [
  {
    id: 'demo-potus-2028-rep',
    ticker: 'DEMO-POTUS28R',
    seriesTicker: 'DEMO-POTUS-SERIES',
    platform: 'dflow',
    title: 'Will a Republican win the 2028 Presidential Election?',
    question: 'Will a Republican win the 2028 Presidential Election?',
    yesPrice: 0.52,
    noPrice: 0.48,
    yesPct: 52,
    noPct: 48,
    volume: 8_500_000,
    volume24h: 320_000,
    liquidity: 2_100_000,
    openInterest: 28000,
    endDate: '2028-11-10T00:00:00Z',
    status: 'active',
    url: 'https://demo.beright.fun/market/potus-2028',
    category: 'politics',
    imageUrl: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=400&h=300&fit=crop',
    tokens: {
      yesMint: 'DemoYesMint4444444444444444444444444444444',
      noMint: 'DemoNoMint44444444444444444444444444444444',
      marketLedger: 'DemoLedger4444444444444444444444444444444',
      isInitialized: true,
      redemptionStatus: 'open',
    },
  },
  {
    id: 'demo-fed-chair-2026',
    ticker: 'DEMO-FEDCHAIR',
    seriesTicker: 'DEMO-FED-SERIES',
    platform: 'dflow',
    title: 'Will Jerome Powell remain Fed Chair through 2026?',
    question: 'Will Jerome Powell remain Fed Chair through 2026?',
    yesPrice: 0.85,
    noPrice: 0.15,
    yesPct: 85,
    noPct: 15,
    volume: 1_200_000,
    volume24h: 55_000,
    liquidity: 380_000,
    openInterest: 5600,
    endDate: '2026-12-31T23:59:59Z',
    status: 'active',
    url: 'https://demo.beright.fun/market/fed-chair',
    category: 'politics',
    imageUrl: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=400&h=300&fit=crop',
    tokens: {
      yesMint: 'DemoYesMint5555555555555555555555555555555',
      noMint: 'DemoNoMint55555555555555555555555555555555',
      marketLedger: 'DemoLedger5555555555555555555555555555555',
      isInitialized: true,
      redemptionStatus: 'open',
    },
  },
];

// ============================================
// DEMO MARKETS - ECONOMICS
// ============================================

const ECONOMICS_MARKETS: DemoMarket[] = [
  {
    id: 'demo-fed-rate-q2-2025',
    ticker: 'DEMO-FEDQ2',
    seriesTicker: 'DEMO-RATES-SERIES',
    platform: 'dflow',
    title: 'Will the Fed cut rates in Q2 2025?',
    question: 'Will the Fed cut rates in Q2 2025?',
    yesPrice: 0.45,
    noPrice: 0.55,
    yesPct: 45,
    noPct: 55,
    volume: 2_800_000,
    volume24h: 145_000,
    liquidity: 720_000,
    openInterest: 9800,
    endDate: '2025-06-30T23:59:59Z',
    status: 'active',
    url: 'https://demo.beright.fun/market/fed-q2',
    category: 'economics',
    imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=300&fit=crop',
    tokens: {
      yesMint: 'DemoYesMint6666666666666666666666666666666',
      noMint: 'DemoNoMint66666666666666666666666666666666',
      marketLedger: 'DemoLedger6666666666666666666666666666666',
      isInitialized: true,
      redemptionStatus: 'open',
    },
  },
  {
    id: 'demo-recession-2025',
    ticker: 'DEMO-RECESS25',
    seriesTicker: 'DEMO-ECON-SERIES',
    platform: 'dflow',
    title: 'Will the US enter recession in 2025?',
    question: 'Will the US enter recession in 2025?',
    yesPrice: 0.22,
    noPrice: 0.78,
    yesPct: 22,
    noPct: 78,
    volume: 3_400_000,
    volume24h: 178_000,
    liquidity: 890_000,
    openInterest: 11200,
    endDate: '2025-12-31T23:59:59Z',
    status: 'active',
    url: 'https://demo.beright.fun/market/recession-2025',
    category: 'economics',
    imageUrl: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=400&h=300&fit=crop',
    tokens: {
      yesMint: 'DemoYesMint7777777777777777777777777777777',
      noMint: 'DemoNoMint77777777777777777777777777777777',
      marketLedger: 'DemoLedger7777777777777777777777777777777',
      isInitialized: true,
      redemptionStatus: 'open',
    },
  },
  {
    id: 'demo-inflation-3pct',
    ticker: 'DEMO-CPI3PCT',
    seriesTicker: 'DEMO-INFLATION-SERIES',
    platform: 'dflow',
    title: 'Will US inflation fall below 3% by end of 2025?',
    question: 'Will US inflation fall below 3% by end of 2025?',
    yesPrice: 0.68,
    noPrice: 0.32,
    yesPct: 68,
    noPct: 32,
    volume: 1_950_000,
    volume24h: 88_000,
    liquidity: 510_000,
    openInterest: 7200,
    endDate: '2025-12-31T23:59:59Z',
    status: 'active',
    url: 'https://demo.beright.fun/market/inflation-3pct',
    category: 'economics',
    imageUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=300&fit=crop',
    tokens: {
      yesMint: 'DemoYesMint8888888888888888888888888888888',
      noMint: 'DemoNoMint88888888888888888888888888888888',
      marketLedger: 'DemoLedger8888888888888888888888888888888',
      isInitialized: true,
      redemptionStatus: 'open',
    },
  },
];

// ============================================
// DEMO MARKETS - TECH
// ============================================

const TECH_MARKETS: DemoMarket[] = [
  {
    id: 'demo-agi-2026',
    ticker: 'DEMO-AGI26',
    seriesTicker: 'DEMO-AI-SERIES',
    platform: 'dflow',
    title: 'Will AGI be achieved by end of 2026?',
    question: 'Will AGI be achieved by end of 2026?',
    yesPrice: 0.08,
    noPrice: 0.92,
    yesPct: 8,
    noPct: 92,
    volume: 5_200_000,
    volume24h: 280_000,
    liquidity: 1_300_000,
    openInterest: 18500,
    endDate: '2026-12-31T23:59:59Z',
    status: 'active',
    url: 'https://demo.beright.fun/market/agi-2026',
    category: 'tech',
    imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=300&fit=crop',
    tokens: {
      yesMint: 'DemoYesMint9999999999999999999999999999999',
      noMint: 'DemoNoMint99999999999999999999999999999999',
      marketLedger: 'DemoLedger9999999999999999999999999999999',
      isInitialized: true,
      redemptionStatus: 'open',
    },
  },
  {
    id: 'demo-tesla-fsd-2025',
    ticker: 'DEMO-TSLAFSD',
    seriesTicker: 'DEMO-AUTO-SERIES',
    platform: 'dflow',
    title: 'Will Tesla achieve Level 5 autonomy by end of 2025?',
    question: 'Will Tesla achieve Level 5 autonomy by end of 2025?',
    yesPrice: 0.12,
    noPrice: 0.88,
    yesPct: 12,
    noPct: 88,
    volume: 2_100_000,
    volume24h: 95_000,
    liquidity: 540_000,
    openInterest: 8900,
    endDate: '2025-12-31T23:59:59Z',
    status: 'active',
    url: 'https://demo.beright.fun/market/tesla-fsd',
    category: 'tech',
    imageUrl: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=400&h=300&fit=crop',
    tokens: {
      yesMint: 'DemoYesMintAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      noMint: 'DemoNoMintAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      marketLedger: 'DemoLedgerAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      isInitialized: true,
      redemptionStatus: 'open',
    },
  },
  {
    id: 'demo-apple-ar-2025',
    ticker: 'DEMO-AAPLVR',
    seriesTicker: 'DEMO-APPLE-SERIES',
    platform: 'dflow',
    title: 'Will Apple Vision Pro sell 5M+ units in 2025?',
    question: 'Will Apple Vision Pro sell 5M+ units in 2025?',
    yesPrice: 0.35,
    noPrice: 0.65,
    yesPct: 35,
    noPct: 65,
    volume: 1_450_000,
    volume24h: 72_000,
    liquidity: 380_000,
    openInterest: 6100,
    endDate: '2025-12-31T23:59:59Z',
    status: 'active',
    url: 'https://demo.beright.fun/market/apple-ar',
    category: 'tech',
    imageUrl: 'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=400&h=300&fit=crop',
    tokens: {
      yesMint: 'DemoYesMintBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      noMint: 'DemoNoMintBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      marketLedger: 'DemoLedgerBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      isInitialized: true,
      redemptionStatus: 'open',
    },
  },
];

// ============================================
// DEMO MARKETS - SPORTS
// ============================================

const SPORTS_MARKETS: DemoMarket[] = [
  {
    id: 'demo-superbowl-2026',
    ticker: 'DEMO-SB2026',
    seriesTicker: 'DEMO-NFL-SERIES',
    platform: 'dflow',
    title: 'Will the Kansas City Chiefs win Super Bowl LX?',
    question: 'Will the Kansas City Chiefs win Super Bowl LX?',
    yesPrice: 0.18,
    noPrice: 0.82,
    yesPct: 18,
    noPct: 82,
    volume: 6_800_000,
    volume24h: 420_000,
    liquidity: 1_800_000,
    openInterest: 24000,
    endDate: '2026-02-15T00:00:00Z',
    status: 'active',
    url: 'https://demo.beright.fun/market/superbowl-2026',
    category: 'sports',
    imageUrl: 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=400&h=300&fit=crop',
    tokens: {
      yesMint: 'DemoYesMintCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      noMint: 'DemoNoMintCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      marketLedger: 'DemoLedgerCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      isInitialized: true,
      redemptionStatus: 'open',
    },
  },
  {
    id: 'demo-worldcup-2026',
    ticker: 'DEMO-WC2026',
    seriesTicker: 'DEMO-FIFA-SERIES',
    platform: 'dflow',
    title: 'Will USA reach World Cup 2026 semifinals?',
    question: 'Will USA reach World Cup 2026 semifinals?',
    yesPrice: 0.28,
    noPrice: 0.72,
    yesPct: 28,
    noPct: 72,
    volume: 4_200_000,
    volume24h: 195_000,
    liquidity: 980_000,
    openInterest: 15200,
    endDate: '2026-07-19T00:00:00Z',
    status: 'active',
    url: 'https://demo.beright.fun/market/worldcup-2026',
    category: 'sports',
    imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&h=300&fit=crop',
    tokens: {
      yesMint: 'DemoYesMintDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
      noMint: 'DemoNoMintDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
      marketLedger: 'DemoLedgerDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
      isInitialized: true,
      redemptionStatus: 'open',
    },
  },
];

// ============================================
// COMBINED DEMO MARKETS
// ============================================

export const DEMO_MARKETS: DemoMarket[] = [
  ...CRYPTO_MARKETS,
  ...POLITICS_MARKETS,
  ...ECONOMICS_MARKETS,
  ...TECH_MARKETS,
  ...SPORTS_MARKETS,
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get all demo markets
 */
export function getDemoMarkets(): DemoMarket[] {
  return DEMO_MARKETS;
}

/**
 * Get demo markets by category
 */
export function getDemoMarketsByCategory(category: string): DemoMarket[] {
  return DEMO_MARKETS.filter(m => m.category === category);
}

/**
 * Get demo market by ID
 */
export function getDemoMarketById(id: string): DemoMarket | undefined {
  return DEMO_MARKETS.find(m => m.id === id || m.ticker === id);
}

/**
 * Get hot demo markets (sorted by 24h volume)
 */
export function getHotDemoMarkets(limit: number = 20): DemoMarket[] {
  return [...DEMO_MARKETS]
    .sort((a, b) => b.volume24h - a.volume24h)
    .slice(0, limit);
}

/**
 * Search demo markets
 */
export function searchDemoMarkets(query: string, limit: number = 20): DemoMarket[] {
  const lower = query.toLowerCase();
  return DEMO_MARKETS
    .filter(m =>
      m.title.toLowerCase().includes(lower) ||
      m.question.toLowerCase().includes(lower) ||
      m.category.toLowerCase().includes(lower)
    )
    .slice(0, limit);
}

/**
 * Add some randomness to prices (for live feel)
 * Call this periodically to simulate market movement
 */
export function applyPriceJitter(market: DemoMarket): DemoMarket {
  const jitter = (Math.random() - 0.5) * 0.02; // +/- 1%
  const newYesPrice = Math.max(0.01, Math.min(0.99, market.yesPrice + jitter));

  return {
    ...market,
    yesPrice: Number(newYesPrice.toFixed(2)),
    noPrice: Number((1 - newYesPrice).toFixed(2)),
    yesPct: Math.round(newYesPrice * 100),
    noPct: Math.round((1 - newYesPrice) * 100),
  };
}

/**
 * Get demo markets with price jitter applied
 */
export function getDemoMarketsWithJitter(limit: number = 20): DemoMarket[] {
  return getHotDemoMarkets(limit).map(applyPriceJitter);
}
