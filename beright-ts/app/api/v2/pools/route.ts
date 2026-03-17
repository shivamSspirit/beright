/**
 * GET /api/v2/pools
 * List conviction pools with filtering
 *
 * POST /api/v2/pools
 * Create a new conviction pool
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { z } from 'zod';
import { createPoolManager } from '@/lib/pools';
import type { PoolConfig, PoolType } from '@/lib/pools';

// ============================================================================
// Validation Schemas
// ============================================================================

const ListPoolsSchema = z.object({
  status: z.enum(['pending', 'active', 'paused', 'settling', 'closed']).optional(),
  type: z.enum(['public', 'private', 'institutional']).optional(),
  token: z.enum(['USDC', 'SOL', 'USDT']).optional(),
  forecaster: z.string().optional(),
  minTVL: z.string().optional(),
  sortBy: z.enum(['tvl', 'return', 'sharpe', 'delegators', 'created', 'activity']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

const CreatePoolSchema = z.object({
  forecaster: z.string().min(32).max(44),
  name: z.string().min(3).max(50),
  description: z.string().max(500).optional(),
  token: z.enum(['USDC', 'SOL', 'USDT']).default('USDC'),
  type: z.enum(['public', 'private', 'institutional']).default('public'),
  fees: z.object({
    managementFeeBps: z.number().min(0).max(1000).default(200),
    performanceFeeBps: z.number().min(0).max(5000).default(2000),
    entryFeeBps: z.number().min(0).max(100).default(0),
    exitFeeBps: z.number().min(0).max(100).default(25),
  }).optional(),
  constraints: z.object({
    minDeposit: z.string().optional(),
    maxDeposit: z.string().optional(),
    maxTVL: z.string().optional(),
    lockupPeriodDays: z.number().min(0).max(365).default(7),
    withdrawalNoticeDays: z.number().min(0).max(30).default(3),
  }).optional(),
  yieldAllocationBps: z.number().min(0).max(10000).default(5000),
  reserveAllocationBps: z.number().min(0).max(10000).default(2000),
  activeAllocationBps: z.number().min(0).max(10000).default(3000),
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
// GET - List Pools
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());

    const validated = ListPoolsSchema.safeParse(params);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: validated.error.issues },
        { status: 400 }
      );
    }

    const manager = await getPoolManager();

    const pools = await manager.listPools({
      filter: {
        status: validated.data.status,
        type: validated.data.type as PoolType | undefined,
        token: validated.data.token,
        forecaster: validated.data.forecaster
          ? new PublicKey(validated.data.forecaster)
          : undefined,
        minTVL: validated.data.minTVL ? BigInt(validated.data.minTVL) : undefined,
      },
      sortBy: validated.data.sortBy,
      sortOrder: validated.data.sortOrder,
      limit: validated.data.limit ? parseInt(validated.data.limit) : 50,
      offset: validated.data.offset ? parseInt(validated.data.offset) : 0,
    });

    // Serialize BigInts
    const serialized = pools.map(serializePool);

    return NextResponse.json({
      success: true,
      pools: serialized,
      count: serialized.length,
      latencyMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error('List pools error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to list pools' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create Pool
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();

    const validated = CreatePoolSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: validated.error.issues },
        { status: 400 }
      );
    }

    // Validate allocation sums to 100%
    const totalAllocation =
      validated.data.yieldAllocationBps +
      validated.data.reserveAllocationBps +
      validated.data.activeAllocationBps;

    if (totalAllocation !== 10000) {
      return NextResponse.json(
        { success: false, error: `Allocations must sum to 10000bps (100%), got ${totalAllocation}bps` },
        { status: 400 }
      );
    }

    const manager = await getPoolManager();

    const config: PoolConfig = {
      name: validated.data.name,
      description: validated.data.description || '',
      token: validated.data.token,
      type: validated.data.type,
      fees: {
        managementFeeBps: validated.data.fees?.managementFeeBps ?? 200,
        performanceFeeBps: validated.data.fees?.performanceFeeBps ?? 2000,
        entryFeeBps: validated.data.fees?.entryFeeBps ?? 0,
        exitFeeBps: validated.data.fees?.exitFeeBps ?? 25,
        highWaterMark: 0n,
      },
      constraints: {
        minDeposit: validated.data.constraints?.minDeposit
          ? BigInt(validated.data.constraints.minDeposit)
          : 100_000000n,
        maxDeposit: validated.data.constraints?.maxDeposit
          ? BigInt(validated.data.constraints.maxDeposit)
          : undefined,
        maxTVL: validated.data.constraints?.maxTVL
          ? BigInt(validated.data.constraints.maxTVL)
          : undefined,
        lockupPeriodDays: validated.data.constraints?.lockupPeriodDays ?? 7,
        withdrawalNoticeDays: validated.data.constraints?.withdrawalNoticeDays ?? 3,
      },
      yieldAllocationBps: validated.data.yieldAllocationBps,
      reserveAllocationBps: validated.data.reserveAllocationBps,
      activeAllocationBps: validated.data.activeAllocationBps,
    };

    const result = await manager.createPool({
      forecaster: new PublicKey(validated.data.forecaster),
      config,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      pool: serializePool(result.pool!),
      latencyMs: Date.now() - startTime,
    }, { status: 201 });
  } catch (error) {
    console.error('Create pool error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create pool' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

function serializePool(pool: NonNullable<Awaited<ReturnType<ReturnType<typeof createPoolManager>['getPool']>>>) {
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
