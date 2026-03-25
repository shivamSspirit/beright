/**
 * Stake to Forecast Pool API
 *
 * POST /api/v2/forecast-pools/[poolId]/stake
 * Build a transaction to stake to a forecast pool
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { z } from 'zod';
import { isDemo } from '../../../../../../lib/mode';

const StakeSchema = z.object({
  delegator: z.string().min(32).max(44),
  amount: z.number().int().positive(),
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
    try {
      delegatorPk = new PublicKey(delegator);
      new PublicKey(poolId); // Validate pool address format
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid address' },
        { status: 400 }
      );
    }

    // Demo mode
    if (isDemo()) {
      // Simulate share calculation
      const sharePrice = 1_000_000; // 1.0 in 6 decimals
      const shares = Math.floor(amount / sharePrice * 1_000_000);

      return NextResponse.json({
        success: true,
        data: {
          transaction: 'DEMO_STAKE_TRANSACTION_BASE64_PLACEHOLDER',
          poolAddress: poolId,
          delegator,
          amount: amount.toString(),
          estimatedShares: shares.toString(),
          _demo: true,
        },
        meta: { latencyMs: Date.now() - startTime },
      });
    }

    // Production mode
    const connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );

    // Import SDK
    const { getForecastPoolClient } = await import('../../../../../../lib/staking/forecast-pool');

    const client = getForecastPoolClient(connection, { network: 'devnet' });

    // Build stake transaction
    const tx = await client.buildStakeTx(delegatorPk, {
      poolAddress: poolId,
      amount,
    });

    // Serialize transaction
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = delegatorPk;

    const serialized = tx.serialize({ requireAllSignatures: false }).toString('base64');

    // Estimate shares (assuming 1:1 share price for new pools)
    const sharePrice = 1_000_000; // Default share price 1.0 in 6 decimals
    const estimatedShares = Math.floor(amount / sharePrice * 1_000_000).toString();

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
      },
      meta: { latencyMs: Date.now() - startTime },
    });
  } catch (error) {
    console.error('[API v2/forecast-pools/stake] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
