import {
  getDFlowMarket,
  getDFlowOrderbook,
  type DFlowMarket,
  type DFlowOrderbook,
  USDC_MINT,
} from '../dflow';
import { normalizeProbabilityPrice } from './riskPrice';
import type { CapitalMarketSnapshot, CapitalOrderbook, CapitalSide } from './types';

function numericValue(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function normalizeDFlowMarket(market: DFlowMarket, side: CapitalSide): CapitalMarketSnapshot {
  const account = market.accounts?.[USDC_MINT] ?? null;
  const bid = side === 'YES' ? market.yesBid : market.noBid;
  const ask = side === 'YES' ? market.yesAsk : market.noAsk;

  return {
    ticker: market.ticker,
    eventTicker: market.eventTicker,
    title: market.title,
    status: market.status,
    side,
    bid: normalizeProbabilityPrice(bid),
    ask: normalizeProbabilityPrice(ask),
    volumeUsd: numericValue(market.volume),
    openInterestUsd: numericValue(market.openInterest),
    closeTime: numericValue(market.closeTime),
    expirationTime: numericValue(market.expirationTime),
    canCloseEarly: market.canCloseEarly,
    resolutionRules: [market.rulesPrimary, market.rulesSecondary].filter(Boolean).join('\n\n') || null,
    account: account
      ? {
          marketLedger: account.marketLedger,
          yesMint: account.yesMint,
          noMint: account.noMint,
          isInitialized: account.isInitialized,
          redemptionStatus: account.redemptionStatus,
        }
      : null,
  };
}

export async function getCapitalMarketSnapshot(
  ticker: string,
  side: CapitalSide
): Promise<{ market: CapitalMarketSnapshot; orderbook: CapitalOrderbook | null } | null> {
  const [market, orderbook] = await Promise.all([
    getDFlowMarket(ticker),
    getDFlowOrderbook(ticker),
  ]);
  if (!market) return null;

  return {
    market: normalizeDFlowMarket(market, side),
    orderbook: orderbook as DFlowOrderbook | null,
  };
}
