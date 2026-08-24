import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getJupiterEarnPosition } from '@/lib/capital';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  wallet: z.string().min(32).max(44),
}).strict();

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const input = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const position = await getJupiterEarnPosition(input.wallet);
    return NextResponse.json({
      success: true,
      data: position,
      meta: {
        custody: 'user_wallet',
        ratesAreVariable: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load Jupiter Earn position.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
