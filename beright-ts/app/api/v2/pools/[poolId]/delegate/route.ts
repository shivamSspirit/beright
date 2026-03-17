/**
 * POST /api/v2/pools/[poolId]/delegate
 * Delegate capital to a conviction pool
 *
 * Request body:
 * {
 *   "delegator": "pubkey",
 *   "amount": "1000000000"  // In base units (e.g., 1000 USDC = 1000000000)
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { z } from 'zod';
import { createPoolManager } from '@/lib/pools';

// ============================================================================
// Validation
// ============================================================================

const DelegateSchema = z.object({
  delegator: z.string().min(32).max(44),
  amount: z.string().regex(/^\d+$/, 'Amount must be a positive integer string'),
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
// POST - Delegate
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ poolId: string }> }
) {
  const startTime = Date.now();

  try {
    const { poolId } = await params;
    const body = await request.json();

    const validated = DelegateSchema.safeParse(body);
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

    const amount = BigInt(validated.data.amount);
    if (amount <= 0n) {
      return NextResponse.json(
        { success: false, error: 'Amount must be positive' },
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

    // Execute delegation
    const result = await manager.delegate({
      poolId,
      delegator: delegatorPubkey,
      amount,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      delegation: {
        id: result.delegation!.id,
        poolId: result.delegation!.poolId,
        delegator: result.delegation!.delegator.toBase58(),
        shares: result.sharesReceived!.toString(),
        depositedAmount: result.delegation!.depositedAmount.toString(),
        currentValue: result.delegation!.currentValue.toString(),
        entrySharePrice: result.delegation!.entrySharePrice,
        entryDate: result.delegation!.entryDate.toISOString(),
        status: result.delegation!.status,
      },
      allocation: result.allocationBreakdown
        ? {
            toActive: result.allocationBreakdown.toActive.toString(),
            toYield: result.allocationBreakdown.toYield.toString(),
            toReserve: result.allocationBreakdown.toReserve.toString(),
          }
        : undefined,
      txSignature: result.txSignature,
      latencyMs: Date.now() - startTime,
    }, { status: 201 });
  } catch (error) {
    console.error('Delegate error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Delegation failed' },
      { status: 500 }
    );
  }
}
