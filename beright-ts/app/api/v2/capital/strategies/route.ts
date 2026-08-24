import { NextResponse } from 'next/server';
import { getCapitalStrategyProviders } from '@/lib/capital';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    data: getCapitalStrategyProviders(),
    meta: {
      custody: 'user_wallet',
      serverCanSign: false,
      serverCanSubmit: false,
      borrowedPrincipalIsYield: false,
      matchedPairRedemption: {
        supported: false,
        reason: 'DFlow does not expose a public atomic complete-set merge/redeem CPI.',
      },
    },
  });
}
