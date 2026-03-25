/**
 * Stake to Forecast Pool API
 *
 * POST /api/v2/forecast-pools/[poolId]/stake
 * Build a transaction to deposit (stake) to a forecast pool using the real on-chain program.
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { z } from 'zod';
import { BN } from '@coral-xyz/anchor';
import { isDemo } from '../../../../../../lib/mode';

const StakeSchema = z.object({
  delegator: z.string().min(32).max(44),
  amount: z.number().int().positive(), // Amount in lamports/base units
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ poolId: string }> }
): Promise<NextResponse> {
  const startTime = Date.now();
  const { poolId } = await params;

  try {
    const body = await req.json();

    const validated = StakeSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: validated.error.issues },
        { status: 400 }
      );
    }

    const { delegator, amount } = validated.data;

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

    console.log(`[API v2/forecast-pools/stake] Mode: ${isDemo() ? 'demo' : 'production'}, Network: ${network}, Pool: ${poolId.slice(0, 8)}...`);

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

    // Build deposit transaction using Anchor client
    const tx = await client.buildDepositTx(delegatorPk, {
      poolAddress: poolPk,
      amount: new BN(amount),
    });

    // Get blockhash and set transaction details
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = delegatorPk;

    // Serialize transaction (delegator needs to sign)
    const serialized = tx.serialize({ requireAllSignatures: false }).toString('base64');

    // Estimate shares based on pool state
    // For now, use 1:1 ratio (will be more sophisticated once we parse pool state properly)
    const sharePrice = 1_000_000; // Default 1.0 in 6 decimals
    const estimatedShares = Math.floor(amount / sharePrice * 1_000_000).toString();

    console.log(`[API v2/forecast-pools/stake] Built deposit tx for ${amount} to pool ${poolId.slice(0, 8)}...`);

    return NextResponse.json({
      success: true,
      data: {
        transaction: serialized,
        poolAddress: poolId,
        delegator,
        amount: amount.toString(),
        estimatedShares,
        blockhash,
        lastValidBlockHeight,
        network,
        rpcUrl, // Return RPC URL for frontend consistency
      },
      meta: { source: 'blockchain', network, latencyMs: Date.now() - startTime },
    });
  } catch (error) {
    console.error('[API v2/forecast-pools/stake] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
