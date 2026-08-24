import { NextRequest, NextResponse } from 'next/server';
import {
  CAPITAL_DEMO_TICKER,
  evaluateCapitalEligibility,
  getCapitalDemoMarket,
  getCapitalMarketSnapshot,
  recommendCapitalRoute,
  type CapitalSide,
} from '../../../../../lib/capital';
import { isDemoRequest } from '../../../../../lib/mode';

interface RouteBody {
  ticker?: unknown;
  side?: unknown;
  shares?: unknown;
  opposingAvailableShares?: unknown;
  holdingDays?: unknown;
  requestedBorrowUsd?: unknown;
}

function finiteNumber(value: unknown, fallback?: number): number | null {
  if ((value === undefined || value === null || value === '') && fallback !== undefined) return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: NextRequest) {
  let body: RouteBody;
  try {
    body = await request.json() as RouteBody;
  } catch {
    return NextResponse.json({ success: false, error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const side = typeof body.side === 'string' ? body.side.toUpperCase() as CapitalSide : null;
  const demoMode = isDemoRequest(request);
  const ticker = typeof body.ticker === 'string' && body.ticker.trim()
    ? body.ticker.trim()
    : demoMode ? CAPITAL_DEMO_TICKER : '';
  const shares = finiteNumber(body.shares);
  const opposingAvailableShares = finiteNumber(body.opposingAvailableShares);
  const holdingDays = finiteNumber(body.holdingDays);
  const requestedBorrowUsd = finiteNumber(body.requestedBorrowUsd, 0);

  if ((side !== 'YES' && side !== 'NO') || !ticker || shares === null || opposingAvailableShares === null || holdingDays === null || requestedBorrowUsd === null) {
    return NextResponse.json({ success: false, error: 'ticker, side, shares, opposingAvailableShares, and holdingDays are required.' }, { status: 400 });
  }

  try {
    const snapshot = demoMode ? getCapitalDemoMarket(side) : await getCapitalMarketSnapshot(ticker, side);
    if (!snapshot) return NextResponse.json({ success: false, error: 'Market not found.' }, { status: 404 });
    const eligibility = evaluateCapitalEligibility(snapshot.market, snapshot.orderbook);
    const recommendation = recommendCapitalRoute({
      eligibility,
      shares,
      opposingAvailableShares,
      holdingDays,
      requestedBorrowUsd,
    });
    return NextResponse.json({
      success: true,
      data: { market: snapshot.market, eligibility, recommendation },
      meta: {
        mode: demoMode ? 'demo' : 'production',
        deterministic: true,
        aiControlsCustody: false,
        executable: false,
        disclaimer: 'Recommendation only. A fresh, exact wallet signature is required for every on-chain intent.',
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Routing failed.' }, { status: 400 });
  }
}
