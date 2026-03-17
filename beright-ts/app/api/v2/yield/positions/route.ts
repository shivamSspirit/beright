/**
 * Yield Positions API
 *
 * GET /api/v2/yield/positions - Get yield positions for a user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserPositions, getPoolPositions, getPosition } from '@/lib/yield/tracking';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const user = searchParams.get('user');
    const poolId = searchParams.get('poolId');
    const token = searchParams.get('token') as 'USDC' | 'SOL' | 'USDT' | undefined;

    // Single position lookup
    const protocol = (searchParams.get('protocol') || 'meteora') as 'meteora';

    if (user && poolId && token) {
      const position = await getPosition(poolId, user, token, protocol);
      return NextResponse.json({
        success: true,
        data: position,
      });
    }

    // User's all positions
    if (user) {
      const positions = await getUserPositions(user);
      return NextResponse.json({
        success: true,
        data: positions,
        count: positions.length,
      });
    }

    // Pool's all positions
    if (poolId) {
      const positions = await getPoolPositions(poolId);
      return NextResponse.json({
        success: true,
        data: positions,
        count: positions.length,
      });
    }

    return NextResponse.json(
      { error: 'Either user or poolId query parameter is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Yield Positions API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch positions' },
      { status: 500 }
    );
  }
}
