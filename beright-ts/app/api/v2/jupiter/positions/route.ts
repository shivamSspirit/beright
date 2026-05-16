/**
 * Jupiter Prediction Positions API
 *
 * GET /api/v2/jupiter/positions?wallet=<pubkey> - Get user positions
 * POST /api/v2/jupiter/positions/claim - Claim winnings (returns unsigned tx)
 * POST /api/v2/jupiter/positions/close - Close position (returns unsigned tx)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPositions,
  getPortfolioSummary,
  claimWinnings,
  closePosition,
  microUsdToUsd,
} from '../../../../../lib/jupiter/prediction';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const walletPubkey = searchParams.get('wallet');

    if (!walletPubkey) {
      return NextResponse.json(
        { success: false, error: 'wallet parameter is required' },
        { status: 400 }
      );
    }

    // Get positions
    const status = searchParams.get('status') as 'open' | 'closed' | 'claimable' | 'all' | undefined;
    const limit = parseInt(searchParams.get('limit') || '50');

    const positionsResponse = await getPositions(walletPubkey, { status, limit });

    if (!positionsResponse.success) {
      return NextResponse.json(
        { success: false, error: positionsResponse.error || 'Failed to fetch positions' },
        { status: 500 }
      );
    }

    // Get portfolio summary
    const summaryResponse = await getPortfolioSummary(walletPubkey);

    // Format positions
    const positions = (positionsResponse.data || []).map(p => ({
      positionPubkey: p.positionPubkey,
      marketId: p.marketId,
      marketTitle: p.marketTitle,
      side: p.isYes ? 'YES' : 'NO',
      contracts: parseInt(p.contracts),
      avgPriceUsd: microUsdToUsd(p.avgPriceUsd),
      currentValueUsd: p.valueUsd ? microUsdToUsd(p.valueUsd) : null,
      pnlUsd: p.pnlUsd ? microUsdToUsd(p.pnlUsd) : null,
      pnlPercent: p.pnlPercent,
      claimable: p.claimable,
      claimed: p.claimed,
      createdAt: p.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        wallet: walletPubkey,
        summary: summaryResponse.success && summaryResponse.data ? {
          totalValueUsd: microUsdToUsd(summaryResponse.data.totalValueUsd),
          totalPnlUsd: microUsdToUsd(summaryResponse.data.totalPnlUsd),
          totalPnlPercent: summaryResponse.data.totalPnlPercent,
          openPositions: summaryResponse.data.openPositions,
          claimablePositions: summaryResponse.data.claimablePositions,
        } : null,
        positions,
        claimableCount: positions.filter(p => p.claimable && !p.claimed).length,
      },
    });
  } catch (error) {
    console.error('[Jupiter Positions API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, positionPubkey, walletPubkey } = body;

    if (!walletPubkey) {
      return NextResponse.json(
        { success: false, error: 'walletPubkey is required' },
        { status: 400 }
      );
    }

    if (!positionPubkey) {
      return NextResponse.json(
        { success: false, error: 'positionPubkey is required' },
        { status: 400 }
      );
    }

    if (action === 'claim') {
      // Claim winnings
      const response = await claimWinnings(positionPubkey, walletPubkey);

      if (!response.success || !response.data) {
        return NextResponse.json(
          { success: false, error: response.error || 'Failed to create claim transaction' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          action: 'claim',
          positionPubkey: response.data.claim.positionPubkey,
          contracts: parseInt(response.data.claim.contracts),
          winningsUsd: microUsdToUsd(response.data.claim.winningsUsd),
          transaction: response.data.transaction,
          txMeta: response.data.txMeta,
        },
      });
    }

    if (action === 'close') {
      // Close position
      const response = await closePosition(positionPubkey, walletPubkey);

      if (!response.success || !response.data) {
        return NextResponse.json(
          { success: false, error: response.error || 'Failed to create close transaction' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          action: 'close',
          positionPubkey: response.data.position.positionPubkey,
          contracts: parseInt(response.data.position.contracts),
          exitPriceUsd: microUsdToUsd(response.data.position.exitPriceUsd),
          proceedsUsd: microUsdToUsd(response.data.position.proceeds),
          transaction: response.data.transaction,
          txMeta: response.data.txMeta,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "claim" or "close"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Jupiter Positions API] POST Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
