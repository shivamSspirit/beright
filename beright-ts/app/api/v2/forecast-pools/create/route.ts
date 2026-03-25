/**
 * Create Forecast Pool API
 *
 * POST /api/v2/forecast-pools/create
 * Build a transaction to create a new forecast pool
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { z } from 'zod';
import { isDemo } from '../../../../../lib/mode';
import type { PoolTier as PoolTierType } from '../../../../../lib/staking/forecast-pool/types';

// Pool tiers (0-7)
const PoolTierSchema = z.number().int().min(0).max(7);

const CreatePoolSchema = z.object({
  tier: PoolTierSchema,
  forecaster: z.string().min(32).max(44),
  brierScoreScaled: z.number().int().min(0).max(1000), // 0.xxx * 1000
  predictionCount: z.number().int().min(0),
});

// Tier requirements
const TIER_REQUIREMENTS: Record<number, { maxBrier: number; minPredictions: number; capacity: bigint; token: 'SOL' | 'USDC' }> = {
  0: { maxBrier: 350, minPredictions: 10, capacity: 5_000_000_000n, token: 'SOL' },
  1: { maxBrier: 300, minPredictions: 25, capacity: 10_000_000_000n, token: 'SOL' },
  2: { maxBrier: 350, minPredictions: 10, capacity: 500_000_000n, token: 'USDC' },
  3: { maxBrier: 300, minPredictions: 25, capacity: 1_000_000_000n, token: 'USDC' },
  4: { maxBrier: 250, minPredictions: 100, capacity: 100_000_000_000n, token: 'SOL' },
  5: { maxBrier: 250, minPredictions: 100, capacity: 10_000_000_000n, token: 'USDC' },
  6: { maxBrier: 200, minPredictions: 250, capacity: 500_000_000_000n, token: 'SOL' },
  7: { maxBrier: 200, minPredictions: 250, capacity: 50_000_000_000n, token: 'USDC' },
};

// Staking Pool Program ID
const STAKING_POOL_PROGRAM_ID = new PublicKey('Fkb7q8pbMa4Wko4u1DYZMXBrXvq8ECFnSqze2TYMm4pM');

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const body = await req.json();

    const validated = CreatePoolSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: validated.error.issues },
        { status: 400 }
      );
    }

    const { tier, forecaster, brierScoreScaled, predictionCount } = validated.data;

    // Validate forecaster address
    let forecasterPk: PublicKey;
    try {
      forecasterPk = new PublicKey(forecaster);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid forecaster address' },
        { status: 400 }
      );
    }

    // Check tier eligibility
    const req_ = TIER_REQUIREMENTS[tier];
    if (!req_) {
      return NextResponse.json(
        { success: false, error: 'Invalid tier' },
        { status: 400 }
      );
    }

    if (brierScoreScaled > req_.maxBrier) {
      return NextResponse.json(
        { success: false, error: `Brier score too high for tier ${tier}. Max: ${req_.maxBrier / 1000}, got: ${brierScoreScaled / 1000}` },
        { status: 400 }
      );
    }

    if (predictionCount < req_.minPredictions) {
      return NextResponse.json(
        { success: false, error: `Not enough predictions for tier ${tier}. Need: ${req_.minPredictions}, have: ${predictionCount}` },
        { status: 400 }
      );
    }

    // Demo mode - return mock transaction
    if (isDemo()) {
      return NextResponse.json({
        success: true,
        data: {
          transaction: 'DEMO_TRANSACTION_BASE64_PLACEHOLDER',
          poolAddress: `DemoFPool${tier}${forecaster.slice(0, 8)}`,
          tier,
          capacity: req_.capacity.toString(),
          token: req_.token,
          _demo: true,
        },
        meta: { latencyMs: Date.now() - startTime },
      });
    }

    // Production mode - build real transaction
    const connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );

    // Import SDK
    const { getForecastPoolClient, deriveForecastPoolPda } = await import('../../../../../lib/staking/forecast-pool');

    const client = getForecastPoolClient(connection, { network: 'devnet' });

    // Build create pool transaction
    const tx = await client.buildCreatePoolTx(forecasterPk, {
      tier: tier as PoolTierType,
      brierScoreScaled,
      predictionCount,
    });

    // Derive pool address for response
    const [poolPda] = deriveForecastPoolPda(forecasterPk, tier as PoolTierType, STAKING_POOL_PROGRAM_ID);

    // Serialize transaction
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = forecasterPk;

    const serialized = tx.serialize({ requireAllSignatures: false }).toString('base64');

    return NextResponse.json({
      success: true,
      data: {
        transaction: serialized,
        poolAddress: poolPda.toBase58(),
        tier,
        capacity: req_.capacity.toString(),
        token: req_.token,
        blockhash,
        lastValidBlockHeight,
      },
      meta: { latencyMs: Date.now() - startTime },
    });
  } catch (error) {
    console.error('[API v2/forecast-pools/create] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
