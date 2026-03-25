/**
 * Forecast Pools API
 *
 * GET /api/v2/forecast-pools - List all forecast pools
 * GET /api/v2/forecast-pools?forecaster=<address> - Get pools by forecaster
 * GET /api/v2/forecast-pools?tier=<0-7> - Filter by tier
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isDemo } from '../../../../lib/mode';

// Tier configs matching the Anchor program
const TIER_CONFIGS = {
  0: { name: 'Starter SOL', capacity: 5_000_000_000, token: 'SOL', maxBrier: 0.35, minPredictions: 10, minDeposit: 50_000_000, isPro: false },
  1: { name: 'Basic SOL', capacity: 10_000_000_000, token: 'SOL', maxBrier: 0.30, minPredictions: 25, minDeposit: 100_000_000, isPro: false },
  2: { name: 'Starter USDC', capacity: 500_000_000, token: 'USDC', maxBrier: 0.35, minPredictions: 10, minDeposit: 5_000_000, isPro: false },
  3: { name: 'Basic USDC', capacity: 1_000_000_000, token: 'USDC', maxBrier: 0.30, minPredictions: 25, minDeposit: 10_000_000, isPro: false },
  4: { name: 'Pro SOL', capacity: 100_000_000_000, token: 'SOL', maxBrier: 0.25, minPredictions: 100, minDeposit: 1_000_000_000, isPro: true },
  5: { name: 'Pro USDC', capacity: 10_000_000_000, token: 'USDC', maxBrier: 0.25, minPredictions: 100, minDeposit: 100_000_000, isPro: true },
  6: { name: 'Elite SOL', capacity: 500_000_000_000, token: 'SOL', maxBrier: 0.20, minPredictions: 250, minDeposit: 5_000_000_000, isPro: true },
  7: { name: 'Elite USDC', capacity: 50_000_000_000, token: 'USDC', maxBrier: 0.20, minPredictions: 250, minDeposit: 500_000_000, isPro: true },
};

// Demo pool data
const DEMO_POOLS = [
  {
    address: 'DemoFPool11111111111111111111111111111111111',
    forecaster: '8X7vZpVYitCw7mb2ny9TWzubebZGanqEEW1fMnn28Rzf',
    forecasterName: 'BeRightBot',
    tier: 4, // ProSol
    tierConfig: TIER_CONFIGS[4],
    tvl: 45_500_000_000,
    tvlDisplay: '45.5 SOL',
    sharePrice: 1_025_000,
    sharePriceDisplay: '1.025',
    utilizationPct: 45.5,
    delegatorCount: 23,
    winRate: 0.72,
    predictionCount: 156,
    winsCount: 112,
    lossesCount: 44,
    status: 'active',
    createdAt: '2024-02-15T00:00:00Z',
  },
  {
    address: 'DemoFPool22222222222222222222222222222222222',
    forecaster: '9Y8wZqXYitDx8nc3nz0UXzucfZIboqFFX2gGonn39Sah',
    forecasterName: 'CryptoOracle',
    tier: 0, // StarterSol
    tierConfig: TIER_CONFIGS[0],
    tvl: 3_200_000_000,
    tvlDisplay: '3.2 SOL',
    sharePrice: 1_000_000,
    sharePriceDisplay: '1.000',
    utilizationPct: 64,
    delegatorCount: 8,
    winRate: 0.65,
    predictionCount: 28,
    winsCount: 18,
    lossesCount: 10,
    status: 'active',
    createdAt: '2024-03-01T00:00:00Z',
  },
  {
    address: 'DemoFPool33333333333333333333333333333333333',
    forecaster: 'AZ9xYpWYitEx9od4oz1VYAudfAJcprFFY3hHpoo40Tbj',
    forecasterName: 'MarketMaven',
    tier: 5, // ProUsdc
    tierConfig: TIER_CONFIGS[5],
    tvl: 7_850_000_000,
    tvlDisplay: '$7,850.00',
    sharePrice: 1_050_000,
    sharePriceDisplay: '1.050',
    utilizationPct: 78.5,
    delegatorCount: 45,
    winRate: 0.78,
    predictionCount: 234,
    winsCount: 182,
    lossesCount: 52,
    status: 'active',
    createdAt: '2024-01-20T00:00:00Z',
  },
];

const QuerySchema = z.object({
  forecaster: z.string().min(32).max(44).optional(),
  tier: z.string().regex(/^[0-7]$/).optional(),
  address: z.string().min(32).max(44).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  offset: z.string().regex(/^\d+$/).optional(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(req.url);
    const params = Object.fromEntries(searchParams.entries());

    const validated = QuerySchema.safeParse(params);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: validated.error.issues },
        { status: 400 }
      );
    }

    const { forecaster, tier, address } = validated.data;
    const limit = validated.data.limit ? parseInt(validated.data.limit) : 50;
    const offset = validated.data.offset ? parseInt(validated.data.offset) : 0;

    // If forecaster is provided, try to fetch their actual pool from blockchain
    if (forecaster) {
      try {
        const { Connection, PublicKey } = await import('@solana/web3.js');
        const { getStakingPoolClient } = await import('../../../../lib/staking/forecast-pool');

        const rpcUrl = isDemo()
          ? process.env.HELIUS_RPC_DEVNET || 'https://api.devnet.solana.com'
          : process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

        console.log(`[API v2/forecast-pools] Fetching pool for forecaster: ${forecaster.slice(0, 12)}... on ${isDemo() ? 'devnet' : 'mainnet'}`);

        const connection = new Connection(rpcUrl, 'confirmed');
        const client = getStakingPoolClient(connection, { network: isDemo() ? 'devnet' : 'mainnet' });

        const forecasterPk = new PublicKey(forecaster);
        const [poolPda] = client.derivePoolPda(forecasterPk);

        console.log(`[API v2/forecast-pools] Pool PDA: ${poolPda.toBase58()}`);

        // First check if account exists at all
        const accountInfo = await connection.getAccountInfo(poolPda);
        console.log(`[API v2/forecast-pools] Account exists: ${!!accountInfo}, size: ${accountInfo?.data?.length || 0} bytes`);

        if (accountInfo) {
          // Account exists - try to decode it
          let poolState = null;
          try {
            poolState = await client.getPoolState(poolPda);
            console.log(`[API v2/forecast-pools] Pool state decoded:`, poolState ? 'success' : 'null');
          } catch (decodeErr) {
            console.error(`[API v2/forecast-pools] Failed to decode pool state:`, decodeErr);
          }

          // Even if decode fails, we know pool exists - return basic info
          const pool = {
            address: poolPda.toBase58(),
            forecaster: forecaster,
            forecasterName: 'You',
            tier: 0, // TODO: extract from decoded pool state
            tierConfig: TIER_CONFIGS[0],
            tvl: 0,
            tvlDisplay: '0 USDC',
            sharePrice: 1_000_000,
            sharePriceDisplay: '1.000',
            utilizationPct: 0,
            delegatorCount: 0,
            winRate: 0,
            predictionCount: 0,
            winsCount: 0,
            lossesCount: 0,
            status: 'active',
            createdAt: new Date().toISOString(),
            _raw: poolState, // Include raw decoded state for debugging
          };

          console.log(`[API v2/forecast-pools] Returning pool: ${poolPda.toBase58()}`);

          return NextResponse.json({
            success: true,
            data: {
              pools: [pool],
              total: 1,
              limit,
              offset,
            },
            meta: { source: 'blockchain', network: isDemo() ? 'devnet' : 'mainnet', latencyMs: Date.now() - startTime },
          });
        } else {
          console.log(`[API v2/forecast-pools] No pool account found for forecaster`);
        }
      } catch (err) {
        console.error('[API v2/forecast-pools] Error fetching on-chain pool:', err);
      }
    }

    // Fall back to demo pools
    if (isDemo()) {
      let pools = [...DEMO_POOLS];

      if (forecaster) {
        pools = pools.filter((p) => p.forecaster === forecaster);
      }

      if (tier !== undefined) {
        pools = pools.filter((p) => p.tier === parseInt(tier));
      }

      if (address) {
        const single = pools.find((p) => p.address === address);
        if (single) {
          return NextResponse.json({
            success: true,
            data: single,
            meta: { source: 'demo', network: 'devnet', latencyMs: Date.now() - startTime },
          });
        }
        return NextResponse.json(
          { success: false, error: 'Pool not found' },
          { status: 404 }
        );
      }

      // Pagination
      const paginatedPools = pools.slice(offset, offset + limit);

      return NextResponse.json({
        success: true,
        data: {
          pools: paginatedPools,
          total: pools.length,
          limit,
          offset,
        },
        meta: { source: 'demo', network: 'devnet', latencyMs: Date.now() - startTime },
      });
    }

    // Production mode - for now return demo data
    // TODO: Implement on-chain fetching after program deployment
    let pools = [...DEMO_POOLS];

    if (forecaster) {
      pools = pools.filter((p) => p.forecaster === forecaster);
    }

    if (tier !== undefined) {
      pools = pools.filter((p) => p.tier === parseInt(tier));
    }

    if (address) {
      const single = pools.find((p) => p.address === address);
      if (single) {
        return NextResponse.json({
          success: true,
          data: single,
          meta: { latencyMs: Date.now() - startTime },
        });
      }
      return NextResponse.json(
        { success: false, error: 'Pool not found' },
        { status: 404 }
      );
    }

    // Pagination
    const paginatedPools = pools.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      data: {
        pools: paginatedPools,
        total: pools.length,
        limit,
        offset,
      },
      meta: { latencyMs: Date.now() - startTime },
    });
  } catch (error) {
    console.error('[API v2/forecast-pools] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
