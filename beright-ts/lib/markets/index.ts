/**
 * lib/markets — Unified Market Data Layer
 *
 * Single entry point for all prediction market data across platforms.
 * Library code (signals, arbitrage, scoring) should import from here
 * rather than reaching into skills/ or types/ directly.
 *
 * PLATFORMS
 * ─────────────────────────────────────────────────────────────────────────────
 *   polymarket  → Polymarket REST API (via skills/markets.ts adapter)
 *   kalshi      → lib/kalshi.ts (full REST + WebSocket client)
 *   manifold    → Manifold API (via skills/markets.ts adapter)
 *   metaculus   → Metaculus API (via skills/metaculus.ts adapter)
 *   limitless   → DFlow/Limitless (via lib/dflow.ts)
 *
 * CANONICAL TYPES (re-exported from types/market.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Market            — normalized market object (platform-agnostic)
 *   Platform          — union of supported platform identifiers
 *   MarketEvent       — event with multiple markets
 *   ArbitrageOpportunity — simple arb pair (legacy; arbitrage/types.ts is richer)
 *   TokenizedMarket   — Market with guaranteed on-chain SPL token data
 *   isTokenizedMarket — type guard
 *
 * FETCHERS (re-exported from skills/markets.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *   searchMarkets(query, platforms?)   → Market[]  (all platforms, parallel)
 *   getHotMarkets(platforms?)          → Market[]  (trending, high-volume)
 *   getMarketOddsComparison(query)     → OddsComparison  (cross-platform odds)
 */

// ── Canonical types ────────────────────────────────────────────────────────
export type {
  Platform,
  Market,
  MarketEvent,
  ArbitrageOpportunity,
  TokenizedMarket,
  OnChainData,
  OrderbookData,
  OddsComparison,
} from '../../types/market';
export { isTokenizedMarket } from '../../types/market';

// ── Cross-platform fetchers ────────────────────────────────────────────────
export {
  searchMarkets,
  getHotMarkets,
  compareOdds as getMarketOddsComparison,   // canonical export alias
} from '../../skills/markets';
