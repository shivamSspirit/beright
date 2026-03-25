/**
 * Unstake from Forecast Pool API
 *
 * POST /api/v2/forecast-pools/[poolId]/unstake
 * Build a transaction to withdraw (unstake) from a forecast pool using the real on-chain program.
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { z } from 'zod';
import { BN } from '@coral-xyz/anchor';
import { isDemo } from '../../../../../../lib/mode';

const UnstakeSchema = z.object({
  delegator: z.string().min(32).max(44),
  shares: z.number().int().positive(), // Share tokens to redeem
});

// Withdrawal fees (bps)
const NORMAL_WITHDRAWAL_FEE_BPS = 50; // 0.5%
const EARLY_WITHDRAWAL_FEE_BPS = 200; // 2%

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ poolId: string }> }
): Promise<NextResponse> {
  const startTime = Date.now();
  const { poolId } = await params;

  try {
    const body = await req.json();

    const validated = UnstakeSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: validated.error.issues },
        { status: 400 }
      );
    }

    const { delegator, shares } = validated.data;

    // Validate addresses
    let delegatorPk: PublicKey;
    let poolPk: PublicKey;
    try {
      delegatorPk = new PublicKey(delegator);
      poolPk = new PublicKey(poolId);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid address' },
        { status: 400 }
      );
    }

    // Use appropriate RPC
    const rpcUrl = isDemo()
      ? process.env.HELIUS_RPC_DEVNET || 'https://api.devnet.solana.com'
      : process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_MAINNET || 'https://api.mainnet-beta.solana.com';

    const network = isDemo() ? 'devnet' : 'mainnet';
    const connection = new Connection(rpcUrl, 'confirmed');

    console.log(`[API v2/forecast-pools/unstake] Mode: ${isDemo() ? 'demo' : 'production'}, Network: ${network}, Pool: ${poolId.slice(0, 8)}...`);

    // Import Anchor client for proper IDL-based transaction building
    const { getStakingPoolClient } = await import('../../../../../../lib/staking/forecast-pool');

    const client = getStakingPoolClient(connection, { network });

    // Verify pool exists
    const poolState = await client.getPoolState(poolPk);
    if (!poolState) {
      return NextResponse.json(
        { success: false, error: 'Pool not found' },
        { status: 404 }
      );
    }

    // Check depositor state for lockup info
    const depositorState = await client.getDepositorState(poolPk, delegatorPk);
    let feeType: 'normal' | 'early' = 'normal';

    if (depositorState) {
      // Check if still in lockup period (7 days default)
      const depositedAt = (depositorState as { depositedAt?: bigint }).depositedAt;
      if (depositedAt) {
        const lockupEndTime = Number(depositedAt) + (7 * 24 * 60 * 60); // 7 days in seconds
        if (Date.now() / 1000 < lockupEndTime) {
          feeType = 'early';
        }
      }
    }

    // Build withdraw transaction using Anchor client
    const tx = await client.buildWithdrawTx(delegatorPk, {
      poolAddress: poolPk,
      shares: new BN(shares),
    });

    // Get blockhash and set transaction details
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = delegatorPk;

    // Serialize transaction (delegator needs to sign)
    const serialized = tx.serialize({ requireAllSignatures: false }).toString('base64');

    // Calculate estimated values
    const sharePrice = 1_000_000; // Default 1.0 in 6 decimals
    const grossValue = Math.floor(shares * sharePrice / 1_000_000);
    const feeBps = feeType === 'early' ? EARLY_WITHDRAWAL_FEE_BPS : NORMAL_WITHDRAWAL_FEE_BPS;
    const fee = Math.floor(grossValue * feeBps / 10000);
    const netValue = grossValue - fee;

    console.log(`[API v2/forecast-pools/unstake] Built withdraw tx for ${shares} shares from pool ${poolId.slice(0, 8)}...`);

    return NextResponse.json({
      success: true,
      data: {
        transaction: serialized,
        poolAddress: poolId,
        delegator,
        shares: shares.toString(),
        grossValue: grossValue.toString(),
        fee: fee.toString(),
        feeType,
        netValue: netValue.toString(),
        blockhash,
        lastValidBlockHeight,
        network,
        rpcUrl, // Return RPC URL for frontend consistency
      },
      meta: { source: 'blockchain', network, latencyMs: Date.now() - startTime },
    });
  } catch (error) {
    console.error('[API v2/forecast-pools/unstake] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
