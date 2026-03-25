/**
 * Create Forecast Pool API
 *
 * POST /api/v2/forecast-pools/create
 * Build a transaction to create a new forecast pool using the real on-chain program.
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { z } from 'zod';
import { isDemo } from '../../../../../lib/mode';
import { BN } from '@coral-xyz/anchor';

// Pool tiers (0-7) - UI construct
const PoolTierSchema = z.number().int().min(0).max(7);

const CreatePoolSchema = z.object({
  tier: PoolTierSchema,
  forecaster: z.string().min(32).max(44),
  brierScoreScaled: z.number().int().min(0).max(1000), // 0.xxx * 1000
  predictionCount: z.number().int().min(0),
  tokenMint: z.string().min(32).max(44).optional(), // Custom USDC mint from user's wallet
});

// On-chain program minimum requirements (from IDL):
// - Brier < 0.25 (250 scaled)
// - 20+ resolved predictions
const ON_CHAIN_MIN_BRIER = 249; // < 0.25 (scaled by 1000)
const ON_CHAIN_MIN_PREDICTIONS = 20;

// Tier requirements - maps UI tiers to on-chain parameters
// NOTE: On-chain program enforces Brier < 0.25 regardless of tier
const TIER_REQUIREMENTS: Record<number, {
  maxBrier: number;
  minPredictions: number;
  capacity: bigint;
  token: 'SOL' | 'USDC';
  minDeposit: bigint;
  performanceFeeBps: number;
}> = {
  0: { maxBrier: ON_CHAIN_MIN_BRIER, minPredictions: ON_CHAIN_MIN_PREDICTIONS, capacity: 5_000_000_000n, token: 'SOL', minDeposit: 100_000_000n, performanceFeeBps: 2000 }, // 0.1 SOL min
  1: { maxBrier: ON_CHAIN_MIN_BRIER, minPredictions: ON_CHAIN_MIN_PREDICTIONS, capacity: 10_000_000_000n, token: 'SOL', minDeposit: 100_000_000n, performanceFeeBps: 2000 }, // 0.1 SOL min
  2: { maxBrier: ON_CHAIN_MIN_BRIER, minPredictions: ON_CHAIN_MIN_PREDICTIONS, capacity: 500_000_000n, token: 'USDC', minDeposit: 5_000_000n, performanceFeeBps: 2000 },
  3: { maxBrier: ON_CHAIN_MIN_BRIER, minPredictions: ON_CHAIN_MIN_PREDICTIONS, capacity: 1_000_000_000n, token: 'USDC', minDeposit: 10_000_000n, performanceFeeBps: 2000 },
  4: { maxBrier: 200, minPredictions: 50, capacity: 100_000_000_000n, token: 'SOL', minDeposit: 1_000_000_000n, performanceFeeBps: 2500 },
  5: { maxBrier: 200, minPredictions: 50, capacity: 10_000_000_000n, token: 'USDC', minDeposit: 100_000_000n, performanceFeeBps: 2500 },
  6: { maxBrier: 150, minPredictions: 100, capacity: 500_000_000_000n, token: 'SOL', minDeposit: 5_000_000_000n, performanceFeeBps: 3000 },
  7: { maxBrier: 150, minPredictions: 100, capacity: 50_000_000_000n, token: 'USDC', minDeposit: 500_000_000n, performanceFeeBps: 3000 },
};

// Staking Pool Program ID (from IDL)
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

    const { tier, forecaster, brierScoreScaled, predictionCount, tokenMint } = validated.data;

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

    // Build real transaction using Anchor client
    // Works on both devnet (demo) and mainnet (production)
    const rpcUrl = isDemo()
      ? process.env.HELIUS_RPC_DEVNET || 'https://api.devnet.solana.com'
      : process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_MAINNET || 'https://api.mainnet-beta.solana.com';

    const network = isDemo() ? 'devnet' : 'mainnet';
    const connection = new Connection(rpcUrl, 'confirmed');

    console.log(`[API v2/forecast-pools/create] Mode: ${isDemo() ? 'demo' : 'production'}, Network: ${network}, RPC: ${rpcUrl.slice(0, 40)}...`);

    // Import Anchor client
    const { getStakingPoolClient, PoolType } = await import('../../../../../lib/staking/forecast-pool');

    // Create client with custom token mint if provided (for USDC pools)
    const clientOptions: { network: 'devnet' | 'mainnet'; tokenMint?: string } = { network };
    if (tokenMint && req_.token === 'USDC') {
      clientOptions.tokenMint = tokenMint;
      console.log(`[API v2/forecast-pools/create] Using custom USDC mint from wallet: ${tokenMint.slice(0, 8)}...`);
    }
    const client = getStakingPoolClient(connection, clientOptions);

    // Check if pool already exists (each forecaster can only have ONE pool)
    const [existingPoolPda] = client.derivePoolPda(forecasterPk);
    const existingAccount = await connection.getAccountInfo(existingPoolPda);

    if (existingAccount) {
      console.log(`[API v2/forecast-pools/create] Pool already exists: ${existingPoolPda.toBase58()}`);
      return NextResponse.json(
        {
          success: false,
          error: 'You already have a staking pool',
          existingPool: existingPoolPda.toBase58(),
          message: 'Each forecaster can only create one pool. View your existing pool instead.',
        },
        { status: 409 } // Conflict
      );
    }

    // Build pool config from tier requirements
    const poolConfig = {
      minDeposit: new BN(req_.minDeposit.toString()),
      maxCapacity: new BN(req_.capacity.toString()),
      performanceFeeBps: req_.performanceFeeBps,
      managementFeeBps: 200, // 2%
      lockPeriodDays: 7,
      withdrawalNoticeDays: 3,
      entryFeeBps: 0,
      exitFeeBps: 50, // 0.5%
    };

    // Build create pool transaction
    const { transaction: tx, poolMint, poolAddress } = await client.buildInitializePoolTx(forecasterPk, {
      poolType: PoolType.AlphaVault, // Standard staking pool
      config: poolConfig,
      avgBrierScore: brierScoreScaled / 1000, // Convert back to decimal
      resolvedPredictions: predictionCount,
    });

    // Get latest blockhash and set transaction details
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = forecasterPk;

    // Partially sign with pool mint (it's a new keypair that must sign)
    tx.partialSign(poolMint);

    // Serialize transaction (forecaster still needs to sign)
    const serialized = tx.serialize({ requireAllSignatures: false }).toString('base64');

    console.log(`[API v2/forecast-pools/create] Built tx for pool: ${poolAddress.toBase58()}`);

    return NextResponse.json({
      success: true,
      data: {
        transaction: serialized,
        poolAddress: poolAddress.toBase58(),
        poolMint: poolMint.publicKey.toBase58(),
        tier,
        capacity: req_.capacity.toString(),
        token: req_.token,
        blockhash,
        lastValidBlockHeight,
        network,
        rpcUrl, // Return the RPC URL so frontend uses the same one
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
