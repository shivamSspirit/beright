/**
 * POST /api/v2/pools/[poolId]/undelegate
 * Request withdrawal from a conviction pool
 *
 * Request body:
 * {
 *   "delegator": "pubkey",
 *   "shares": "1000000000"  // Optional - if not specified, withdraws all
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { z } from 'zod';
import { createPoolManager } from '@/lib/pools';

// ============================================================================
// Validation
// ============================================================================

const UndelegateSchema = z.object({
  delegator: z.string().min(32).max(44),
  shares: z.string().regex(/^\d+$/, 'Shares must be a positive integer string').optional(),
});

// ============================================================================
// Singleton Pool Manager
// ============================================================================

let poolManager: ReturnType<typeof createPoolManager> | null = null;

async function getPoolManager() {
  if (!poolManager) {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl);
    const network = process.env.SOLANA_NETWORK === 'devnet' ? 'devnet' : 'mainnet-beta';
    poolManager = createPoolManager(connection, network);
    await poolManager.initialize();
  }
  return poolManager;
}

// ============================================================================
// POST - Undelegate
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ poolId: string }> }
) {
  const startTime = Date.now();

  try {
    const { poolId } = await params;
    const body = await request.json();

    const validated = UndelegateSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: validated.error.issues },
        { status: 400 }
      );
    }

    // Validate pubkey
    let delegatorPubkey: PublicKey;
    try {
      delegatorPubkey = new PublicKey(validated.data.delegator);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid delegator pubkey' },
        { status: 400 }
      );
    }

    const manager = await getPoolManager();

    // Verify pool exists
    const pool = await manager.getPool(poolId);
    if (!pool) {
      return NextResponse.json(
        { success: false, error: 'Pool not found' },
        { status: 404 }
      );
    }

    // Verify delegation exists
    const delegation = await manager.getDelegation(poolId, delegatorPubkey);
    if (!delegation) {
      return NextResponse.json(
        { success: false, error: 'No delegation found for this delegator' },
        { status: 404 }
      );
    }

    // Execute undelegation
    const result = await manager.undelegate({
      poolId,
      delegator: delegatorPubkey,
      shares: validated.data.shares ? BigInt(validated.data.shares) : undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Check if withdrawal is queued or immediate
    const isQueued = result.effectiveDate && result.effectiveDate > new Date();

    return NextResponse.json({
      success: true,
      withdrawal: {
        poolId,
        delegator: delegatorPubkey.toBase58(),
        sharesBurned: result.sharesBurned!.toString(),
        amountReceived: result.amountReceived!.toString(),
        fees: result.fees?.toString() || '0',
        yieldRealized: result.yieldRealized?.toString() || '0',
        status: isQueued ? 'queued' : 'completed',
        effectiveDate: result.effectiveDate?.toISOString(),
      },
      txSignature: result.txSignature,
      latencyMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error('Undelegate error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Undelegation failed' },
      { status: 500 }
    );
  }
}
