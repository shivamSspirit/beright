import { NextRequest, NextResponse } from 'next/server';
import {
  CAPITAL_DEMO_TICKER,
  evaluateCapitalEligibility,
  getCapitalDemoMarket,
  getCapitalMarketSnapshot,
  type CapitalSide,
} from '../../../../../lib/capital';
import { isDemoRequest } from '../../../../../lib/mode';

function parseSide(value: string | null): CapitalSide | null {
  const normalized = value?.toUpperCase();
  return normalized === 'YES' || normalized === 'NO' ? normalized : null;
}

export async function GET(request: NextRequest) {
  const side = parseSide(request.nextUrl.searchParams.get('side'));
  if (!side) {
    return NextResponse.json(
      { success: false, error: 'side must be YES or NO.' },
      { status: 400 }
    );
  }

  const demoMode = isDemoRequest(request);
  const ticker = request.nextUrl.searchParams.get('ticker')?.trim() || (demoMode ? CAPITAL_DEMO_TICKER : '');
  if (!ticker) {
    return NextResponse.json(
      { success: false, error: 'ticker is required.' },
      { status: 400 }
    );
  }

  try {
    const snapshot = demoMode
      ? getCapitalDemoMarket(side)
      : await getCapitalMarketSnapshot(ticker, side);
    if (!snapshot) {
      return NextResponse.json(
        { success: false, error: 'Market or orderbook not found.' },
        { status: 404 }
      );
    }

    const eligibility = evaluateCapitalEligibility(snapshot.market, snapshot.orderbook);
    return NextResponse.json({
      success: true,
      data: {
        market: snapshot.market,
        eligibility,
      },
      meta: {
        mode: demoMode ? 'demo' : 'production',
        custody: false,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Eligibility check failed.';
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
