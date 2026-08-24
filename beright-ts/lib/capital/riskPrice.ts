import type {
  CapitalMarketSnapshot,
  CapitalOrderbook,
  CapitalRiskPrice,
  CapitalSide,
} from './types';

interface PriceLevel {
  price: number;
  shares: number;
}

const DEPTH_WINDOW = 0.05;

export function normalizeProbabilityPrice(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;

  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  let normalized = parsed;
  if (parsed > 100) normalized = parsed / 10_000;
  else if (parsed > 1) normalized = parsed / 100;

  return normalized > 0 && normalized < 1 ? normalized : null;
}

function parseLevels(levels: Record<string, number> | undefined): PriceLevel[] {
  if (!levels) return [];

  return Object.entries(levels).flatMap(([rawPrice, rawShares]) => {
    const price = normalizeProbabilityPrice(rawPrice);
    const shares = Number(rawShares);
    if (price === null || !Number.isFinite(shares) || shares <= 0) return [];
    return [{ price, shares }];
  });
}

function sideLevels(orderbook: CapitalOrderbook | null, side: CapitalSide) {
  if (!orderbook) return { bids: [], asks: [] };
  return side === 'YES'
    ? { bids: parseLevels(orderbook.yesBids), asks: parseLevels(orderbook.yesAsks) }
    : { bids: parseLevels(orderbook.noBids), asks: parseLevels(orderbook.noAsks) };
}

function calculateSpreadBps(bestBid: number | null, bestAsk: number | null): number | null {
  if (bestBid === null || bestAsk === null || bestAsk < bestBid) return null;
  const midpoint = (bestBid + bestAsk) / 2;
  return midpoint > 0 ? ((bestAsk - bestBid) / midpoint) * 10_000 : null;
}

export function calculateCapitalRiskPrice(
  market: CapitalMarketSnapshot,
  orderbook: CapitalOrderbook | null,
  now = new Date()
): CapitalRiskPrice {
  const { bids, asks } = sideLevels(orderbook, market.side);
  const bookBid = bids.length > 0 ? Math.max(...bids.map((level) => level.price)) : null;
  const bookAsk = asks.length > 0 ? Math.min(...asks.map((level) => level.price)) : null;
  const bestBid = bookBid ?? normalizeProbabilityPrice(market.bid);
  const bestAsk = bookAsk ?? normalizeProbabilityPrice(market.ask);

  const depthLevels = bestBid === null
    ? []
    : bids.filter((level) => level.price >= Math.max(0, bestBid - DEPTH_WINDOW));
  const availableDepthShares = bids.length === 0
    ? null
    : depthLevels.reduce((sum, level) => sum + level.shares, 0);
  const availableDepthUsd = bids.length === 0
    ? null
    : depthLevels.reduce((sum, level) => sum + (level.shares * level.price), 0);

  return {
    price: bestBid,
    source: bestBid === null ? 'unavailable' : 'executable_bid',
    bestBid,
    bestAsk,
    spreadBps: calculateSpreadBps(bestBid, bestAsk),
    availableDepthShares,
    availableDepthUsd,
    asOf: now.toISOString(),
  };
}
