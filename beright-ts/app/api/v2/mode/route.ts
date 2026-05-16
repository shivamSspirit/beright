/**
 * Mode Info API
 *
 * Returns current operating mode information for the frontend.
 * The frontend can use this to display appropriate UI indicators.
 *
 * Access Control:
 * - Production mode only available to owner email
 * - All other users see demo mode
 *
 * GET /api/v2/mode
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidatedModeFromHeaders } from '@/lib/mode';

export async function GET(request: NextRequest) {
  try {
    // Get validated mode (respects owner access control)
    const mode = getValidatedModeFromHeaders(request.headers);

    // Override config with validated mode
    const validatedConfig = mode === 'demo' ? {
      mode: 'demo' as const,
      network: 'devnet' as const,
      networkLabel: 'Devnet',
      tradingMode: 'paper' as const,
      showWaitlist: true,
    } : {
      mode: 'production' as const,
      network: 'mainnet-beta' as const,
      networkLabel: 'Mainnet',
      tradingMode: 'live' as const,
      showWaitlist: false,
    };

    return NextResponse.json({
      success: true,
      data: {
        ...validatedConfig,
        features: {
          trading: true,
          predictions: true,
          leaderboard: true,
          agents: true,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Mode API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get mode info',
      },
      { status: 500 }
    );
  }
}
