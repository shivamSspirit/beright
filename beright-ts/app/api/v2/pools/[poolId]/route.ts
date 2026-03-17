/**
 * GET /api/v2/pools/[poolId]
 * Get single pool details
 *
 * GET /api/v2/pools/[poolId]?include=delegations
 * Get pool with delegations
 *
 * GET /api/v2/pools/[poolId]?include=performance
 * Get pool with performance metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { createPoolManager } from '@/lib/pools';
import type { ConvictionPool, Delegation, PoolPerformance } from '@/lib/pools';

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
// GET - Single Pool
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ poolId: string }> }
) {
  const startTime = Date.now();

  try {
    const { poolId } = await params;
    const { searchParams } = new URL(request.url);
    const include = searchParams.get('include')?.split(',') || [];

    const manager = await getPoolManager();

    // Try by ID first, then by slug
    let pool = await manager.getPool(poolId);
    if (!pool) {
      pool = await manager.getPoolBySlug(poolId);
    }

    if (!pool) {
      return NextResponse.json(
        { success: false, error: 'Pool not found' },
        { status: 404 }
      );
    }

    const response: {
      success: boolean;
      pool: ReturnType<typeof serializePool>;
      delegations?: ReturnType<typeof serializeDelegation>[];
      performance?: ReturnType<typeof serializePerformance>;
      latencyMs: number;
    } = {
      success: true,
      pool: serializePool(pool),
      latencyMs: Date.now() - startTime,
    };

    // Include delegations if requested
    if (include.includes('delegations')) {
      const delegations = await manager.getPoolDelegations(pool.id);
      response.delegations = delegations.map(serializeDelegation);
    }

    // Include performance if requested
    if (include.includes('performance')) {
      const performance = await manager.getPoolPerformance(pool.id);
      if (performance) {
        response.performance = serializePerformance(performance);
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get pool error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get pool' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Serializers
// ============================================================================

function serializePool(pool: ConvictionPool) {
  return {
    ...pool,
    forecaster: pool.forecaster.toBase58(),
    address: pool.address?.toBase58(),
    tvl: pool.tvl.toString(),
    activeCapital: pool.activeCapital.toString(),
    yieldCapital: pool.yieldCapital.toString(),
    reserveCapital: pool.reserveCapital.toString(),
    totalShares: pool.totalShares.toString(),
    yieldEarned: pool.yieldEarned.toString(),
    config: {
      ...pool.config,
      fees: {
        ...pool.config.fees,
        highWaterMark: pool.config.fees.highWaterMark.toString(),
      },
      constraints: {
        ...pool.config.constraints,
        minDeposit: pool.config.constraints.minDeposit.toString(),
        maxDeposit: pool.config.constraints.maxDeposit?.toString(),
        maxTVL: pool.config.constraints.maxTVL?.toString(),
      },
    },
    createdAt: pool.createdAt.toISOString(),
    activatedAt: pool.activatedAt?.toISOString(),
    lastActivityAt: pool.lastActivityAt.toISOString(),
  };
}

function serializeDelegation(delegation: Delegation) {
  return {
    ...delegation,
    delegator: delegation.delegator.toBase58(),
    shares: delegation.shares.toString(),
    depositedAmount: delegation.depositedAmount.toString(),
    currentValue: delegation.currentValue.toString(),
    pnl: delegation.pnl.toString(),
    yieldEarned: delegation.yieldEarned.toString(),
    feesAccrued: delegation.feesAccrued.toString(),
    entryDate: delegation.entryDate.toISOString(),
    lastUpdateAt: delegation.lastUpdateAt.toISOString(),
    withdrawalRequest: delegation.withdrawalRequest
      ? {
          ...delegation.withdrawalRequest,
          shares: delegation.withdrawalRequest.shares.toString(),
          requestedAt: delegation.withdrawalRequest.requestedAt.toISOString(),
          effectiveDate: delegation.withdrawalRequest.effectiveDate.toISOString(),
        }
      : undefined,
  };
}

function serializePerformance(performance: PoolPerformance) {
  return {
    ...performance,
    tvl: performance.tvl.toString(),
    timestamp: performance.timestamp.toISOString(),
  };
}
