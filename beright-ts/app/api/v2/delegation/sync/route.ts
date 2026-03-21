/**
 * State Sync API
 *
 * POST /api/v2/delegation/sync - Trigger state sync from on-chain
 *
 * This endpoint can be called by a cron job to keep the database
 * in sync with on-chain state.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { createSyncRunner } from '@/lib/delegation';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const SYNC_SECRET = process.env.SYNC_SECRET || 'dev-sync-secret';

export async function POST(request: NextRequest) {
  try {
    // Verify authorization (simple secret for now)
    const authHeader = request.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '');

    if (providedSecret !== SYNC_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { type, poolPda } = body;

    const syncRunner = createSyncRunner(RPC_URL, 'devnet');

    let result;

    switch (type) {
      case 'pools':
        result = await syncRunner.syncPools();
        break;

      case 'depositors':
        if (!poolPda) {
          return NextResponse.json(
            { success: false, error: 'poolPda required for depositors sync' },
            { status: 400 }
          );
        }
        result = await syncRunner.syncPoolDepositors(new PublicKey(poolPda));
        break;

      case 'full':
      default:
        result = await syncRunner.fullSync();
        break;
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Sync failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v2/delegation/sync
 *
 * Health check for sync endpoint
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Sync endpoint ready',
    rpcUrl: RPC_URL,
    network: 'devnet',
  });
}
