import { NextRequest, NextResponse } from 'next/server';
import { getUsdcYieldRate } from '../../../../../lib/capital';
import { isDemoRequest } from '../../../../../lib/mode';

export async function GET(request: NextRequest) {
  const rate = await getUsdcYieldRate({ demoMode: isDemoRequest(request) });
  return NextResponse.json({
    success: rate.apyPct !== null,
    data: rate,
    meta: {
      custody: false,
      disclaimer: 'Variable reference rate only. This is not a guaranteed return or an offer to deposit.',
    },
  }, { status: rate.apyPct === null ? 503 : 200 });
}
