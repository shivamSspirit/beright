/**
 * Vault Health API
 *
 * GET /api/v2/yield/health - Get vault health status
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection } from '@solana/web3.js';
import { getHealthMonitor } from '@/lib/yield/monitoring';
import { getSupportedTokens } from '@/lib/yield/meteora';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token') as 'USDC' | 'SOL' | 'USDT' | undefined;

    const rpcUrl = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (!rpcUrl) {
      return NextResponse.json(
        { error: 'Solana RPC not configured' },
        { status: 500 }
      );
    }

    const connection = new Connection(rpcUrl, 'confirmed');
    const monitor = getHealthMonitor(connection);

    // Check specific token
    if (token) {
      const health = await monitor.checkHealth(token);
      return NextResponse.json({
        success: true,
        data: health,
      });
    }

    // Check all supported tokens
    const tokens = getSupportedTokens();
    const results: Record<string, unknown> = {};

    for (const t of tokens) {
      try {
        results[t] = await monitor.checkHealth(t);
      } catch (error) {
        results[t] = {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Vault Health API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check vault health' },
      { status: 500 }
    );
  }
}
