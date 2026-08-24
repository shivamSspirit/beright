import { NextRequest, NextResponse } from 'next/server';
import {
  CAPITAL_DEMO_TICKER,
  evaluateCapitalEligibility,
  getCapitalDemoMarket,
  getCapitalMarketSnapshot,
  getUsdcYieldRate,
  simulateMatchedPairYield,
  type CapitalSide,
} from '../../../../../lib/capital';
import { isDemoRequest } from '../../../../../lib/mode';

interface SimulationBody {
  ticker?: unknown;
  side?: unknown;
  shares?: unknown;
  opposingAvailableShares?: unknown;
  holdingDays?: unknown;
}

function parseSide(value: unknown): CapitalSide | null {
  if (typeof value !== 'string') return null;
  const normalized = value.toUpperCase();
  return normalized === 'YES' || normalized === 'NO' ? normalized : null;
}

function parseNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: NextRequest) {
  let body: SimulationBody;
  try {
    body = await request.json() as SimulationBody;
  } catch {
    return NextResponse.json({ success: false, error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const demoMode = isDemoRequest(request);
  const side = parseSide(body.side);
  const ticker = typeof body.ticker === 'string' && body.ticker.trim()
    ? body.ticker.trim()
    : demoMode ? CAPITAL_DEMO_TICKER : '';
  const shares = parseNumber(body.shares);
  const opposingAvailableShares = parseNumber(body.opposingAvailableShares);
  const holdingDays = parseNumber(body.holdingDays);

  if (!side || !ticker || shares === null || opposingAvailableShares === null || holdingDays === null) {
    return NextResponse.json({
      success: false,
      error: 'ticker, side, shares, opposingAvailableShares, and holdingDays are required.',
    }, { status: 400 });
  }

  try {
    const [snapshot, yieldRate] = await Promise.all([
      demoMode ? Promise.resolve(getCapitalDemoMarket(side)) : getCapitalMarketSnapshot(ticker, side),
      getUsdcYieldRate({ demoMode }),
    ]);
    if (!snapshot) {
      return NextResponse.json({ success: false, error: 'Market not found.' }, { status: 404 });
    }

    const eligibility = evaluateCapitalEligibility(snapshot.market, snapshot.orderbook);
    if (eligibility.status === 'ineligible') {
      return NextResponse.json({
        success: false,
        error: 'This position is not eligible for the Phase 1 model.',
        data: { eligibility },
      }, { status: 422 });
    }
    if (yieldRate.apyPct === null) {
      return NextResponse.json({
        success: false,
        error: yieldRate.message || 'USDC reference rate is unavailable.',
        data: { eligibility, yieldRate },
      }, { status: 503 });
    }
    if (eligibility.riskPrice.price === null) {
      return NextResponse.json({ success: false, error: 'Executable bid is unavailable.' }, { status: 422 });
    }

    const maximumHoldingDays = Math.max(0, Math.floor((eligibility.daysToResolution ?? 0) - 2));
    if (holdingDays > maximumHoldingDays) {
      return NextResponse.json({
        success: false,
        error: `holdingDays must leave a two-day unwind buffer and cannot exceed ${maximumHoldingDays}.`,
      }, { status: 400 });
    }

    const simulation = simulateMatchedPairYield({
      shares,
      opposingAvailableShares,
      holdingDays,
      strategyApyPct: yieldRate.apyPct,
      executableBid: eligibility.riskPrice.price,
      reserveBps: 2_000,
      protocolFeeBps: 0,
    });

    return NextResponse.json({
      success: true,
      data: {
        market: snapshot.market,
        eligibility,
        yieldRate,
        simulation,
      },
      meta: {
        mode: demoMode ? 'demo' : 'production',
        custody: false,
        executable: false,
        disclaimer: 'Simulation only. Rates, matching capacity, and redemption timing can change.',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Simulation failed.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
