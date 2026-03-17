/**
 * Yield Summary API
 *
 * GET /api/v2/yield/summary - Get yield summary for a user or pool
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserYieldSummary, getPoolYieldSummary } from '@/lib/yield/tracking';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const user = searchParams.get('user');
    const poolId = searchParams.get('poolId');

    if (user) {
      const summary = await getUserYieldSummary(user);
      return NextResponse.json({
        success: true,
        type: 'user',
        data: summary,
      });
    }

    if (poolId) {
      const token = searchParams.get('token') as 'USDC' | 'SOL' | 'USDT' || 'USDC';
      const summary = await getPoolYieldSummary(poolId, token);
      return NextResponse.json({
        success: true,
        type: 'pool',
        data: summary,
      });
    }

    return NextResponse.json(
      { error: 'Either user or poolId query parameter is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Yield Summary API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch yield summary' },
      { status: 500 }
    );
  }
}
