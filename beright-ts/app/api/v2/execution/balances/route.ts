/**
 * Balances API v2
 *
 * Account balances across all platforms.
 *
 * @author BeRight Protocol
 */

import { NextResponse } from 'next/server';
import { getExecutionEngine } from '../../../../../lib/execution';

/**
 * GET /api/v2/execution/balances
 *
 * Get balances from all connected platforms.
 */
export async function GET() {
  try {
    const engine = getExecutionEngine();

    // Initialize if needed
    await engine.initialize();

    const [balances, totalBalance, exposure] = await Promise.all([
      engine.getBalances(),
      engine.getTotalBalance(),
      engine.getExposure(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        balances,
        total: {
          ...totalBalance,
          currency: 'USD',
        },
        exposure: {
          totalAtRisk: exposure.totalAtRisk,
          totalMaxGain: exposure.totalMaxGain,
          riskRewardRatio: exposure.riskRewardRatio,
        },
        summary: {
          availableFunds: totalBalance.available,
          lockedInOrders: totalBalance.locked,
          exposedInPositions: exposure.totalAtRisk,
          effectiveBuyingPower: totalBalance.available - exposure.totalAtRisk,
        },
      },
      meta: {
        platforms: Object.keys(totalBalance.byPlatform).length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API v2/execution/balances] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
