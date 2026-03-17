/**
 * Yield Deposits API
 *
 * GET /api/v2/yield/deposits - Get deposit history for a user or pool
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDepositHistory, getWithdrawalHistory } from '@/lib/yield/tracking';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const user = searchParams.get('user');
    const poolId = searchParams.get('poolId');
    const token = searchParams.get('token') as 'USDC' | 'SOL' | 'USDT' | undefined;
    const type = searchParams.get('type') || 'deposits'; // deposits or withdrawals
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!user && !poolId) {
      return NextResponse.json(
        { error: 'Either user or poolId query parameter is required' },
        { status: 400 }
      );
    }

    const query = {
      user: user || undefined,
      poolId: poolId || undefined,
      token,
      limit,
      offset,
    };

    if (type === 'withdrawals') {
      const withdrawals = await getWithdrawalHistory(query);
      return NextResponse.json({
        success: true,
        type: 'withdrawals',
        data: withdrawals,
        pagination: { limit, offset },
      });
    }

    const deposits = await getDepositHistory(query);
    return NextResponse.json({
      success: true,
      type: 'deposits',
      data: deposits,
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error('[Yield Deposits API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deposit history' },
      { status: 500 }
    );
  }
}
