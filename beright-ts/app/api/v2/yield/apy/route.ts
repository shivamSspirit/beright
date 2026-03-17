/**
 * Vault APY API
 *
 * GET /api/v2/yield/apy - Get current APY for vaults
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchVaultAPY,
  fetchAllVaultAPYs,
  getCachedAPY,
  getSupportedTokens,
} from '@/lib/yield/meteora';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token') as 'USDC' | 'SOL' | 'USDT' | undefined;
    const cached = searchParams.get('cached') === 'true';

    // Get specific token APY
    if (token) {
      // Try cache first if requested
      if (cached) {
        const cachedAPY = getCachedAPY(token);
        if (cachedAPY) {
          return NextResponse.json({
            success: true,
            cached: true,
            data: cachedAPY,
          });
        }
      }

      const apy = await fetchVaultAPY(token);
      return NextResponse.json({
        success: true,
        cached: false,
        data: apy,
      });
    }

    // Get all token APYs
    const apys = await fetchAllVaultAPYs();
    const tokens = getSupportedTokens();

    return NextResponse.json({
      success: true,
      data: apys,
      tokens,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Vault APY API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch APY data' },
      { status: 500 }
    );
  }
}
