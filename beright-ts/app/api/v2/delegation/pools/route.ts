/**
 * Delegation Pools API
 *
 * GET /api/v2/delegation/pools - List pools with filters
 * POST /api/v2/delegation/pools - Create pool (returns unsigned transaction)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import {
  listPools,
  checkPoolEligibility,
  createDelegationPoolClient,
  TIER_REQUIREMENTS,
} from '@/lib/delegation';
import type { PoolFilterOptions, OnChainPoolStatus, ForecasterTier } from '@/lib/delegation';

// Devnet RPC
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

/**
 * GET /api/v2/delegation/pools
 *
 * List pools with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const filters: PoolFilterOptions = {
      status: parseStatus(searchParams.get('status')),
      tier: parseTier(searchParams.get('tier')),
      minTvl: searchParams.get('minTvl')
        ? parseFloat(searchParams.get('minTvl')!)
        : undefined,
      maxTvl: searchParams.get('maxTvl')
        ? parseFloat(searchParams.get('maxTvl')!)
        : undefined,
      sortBy: (searchParams.get('sortBy') as any) || 'tvl',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    const pools = await listPools(filters);

    return NextResponse.json({
      success: true,
      data: pools,
      meta: {
        count: pools.length,
        filters: {
          status: filters.status,
          tier: filters.tier,
          sortBy: filters.sortBy,
        },
      },
    });
  } catch (error) {
    console.error('[API] Failed to list pools:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list pools',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v2/delegation/pools
 *
 * Create a new pool (returns unsigned transaction)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { forecasterWallet, name, description, poolType, baseMint, config } = body;

    if (!forecasterWallet) {
      return NextResponse.json(
        { success: false, error: 'forecasterWallet is required' },
        { status: 400 }
      );
    }

    // Check eligibility
    const eligibility = await checkPoolEligibility(forecasterWallet);

    if (!eligibility.eligible) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not eligible to create pool',
          eligibility,
        },
        { status: 403 }
      );
    }

    // Build transaction
    const connection = new Connection(RPC_URL, 'confirmed');

    // Create dummy wallet for building transaction (user will sign client-side)
    const dummyKeypair = Keypair.generate();
    const dummyWallet = {
      publicKey: new PublicKey(forecasterWallet),
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any[]) => txs,
    };

    const client = createDelegationPoolClient(connection, dummyWallet as any);

    // Determine max capacity from tier
    const maxCapacityUsd = TIER_REQUIREMENTS[eligibility.tier].capacity;
    const maxCapacity =
      maxCapacityUsd === Infinity
        ? BigInt(Number.MAX_SAFE_INTEGER)
        : BigInt(maxCapacityUsd) * BigInt(1_000000);

    const { transaction, poolPda, poolMint } = await client.buildInitializePoolTx({
      forecaster: new PublicKey(forecasterWallet),
      poolType: poolType || 'alpha_vault',
      baseMint: new PublicKey(baseMint || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), // USDC
      config: {
        ...config,
        maxCapacity,
      },
      avgBrierScore: eligibility.brierScore || 0.25,
      resolvedPredictions: eligibility.predictionCount,
    });

    // Serialize transaction for client signing
    const serializedTx = transaction
      .serialize({ requireAllSignatures: false })
      .toString('base64');

    return NextResponse.json({
      success: true,
      data: {
        transaction: serializedTx,
        poolPda: poolPda.toBase58(),
        poolMint: poolMint.toBase58(),
        eligibility,
        poolConfig: {
          name,
          description,
          maxCapacity: maxCapacityUsd,
          tier: eligibility.tier,
        },
      },
    });
  } catch (error) {
    console.error('[API] Failed to create pool:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create pool',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

function parseStatus(value: string | null): OnChainPoolStatus | OnChainPoolStatus[] | undefined {
  if (!value) return undefined;
  const statuses = value.split(',') as OnChainPoolStatus[];
  return statuses.length === 1 ? statuses[0] : statuses;
}

function parseTier(value: string | null): ForecasterTier | ForecasterTier[] | undefined {
  if (!value) return undefined;
  const tiers = value.split(',') as ForecasterTier[];
  return tiers.length === 1 ? tiers[0] : tiers;
}
