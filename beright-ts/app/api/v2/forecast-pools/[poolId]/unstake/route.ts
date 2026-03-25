/**
 * Unstake from Forecast Pool API
 *
 * POST /api/v2/forecast-pools/[poolId]/unstake
 * Build a transaction to unstake from a forecast pool
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { z } from 'zod';
import { isDemo } from '../../../../../../lib/mode';

const UnstakeSchema = z.object({
  delegator: z.string().min(32).max(44),
  shares: z.number().int().positive(),
});

// Withdrawal fees (bps)
const NORMAL_WITHDRAWAL_FEE_BPS = 50; // 0.5%
const EARLY_WITHDRAWAL_FEE_BPS = 200; // 2%
const LOCKUP_DAYS = 7;

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
      const sharePrice = 1_000_000; // 1.0 in 6 decimals
      const grossValue = Math.floor(shares * sharePrice / 1_000_000);
      const fee = Math.floor(grossValue * NORMAL_WITHDRAWAL_FEE_BPS / 10000);
      const netValue = grossValue - fee;

      return NextResponse.json({
        success: true,
        data: {
          transaction: 'DEMO_UNSTAKE_TRANSACTION_BASE64_PLACEHOLDER',
          poolAddress: poolId,
          delegator,
          shares: shares.toString(),
          grossValue: grossValue.toString(),
          fee: fee.toString(),
          feeType: 'normal',
          netValue: netValue.toString(),
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

    // Build unstake transaction
    const tx = await client.buildUnstakeTx(delegatorPk, {
      poolAddress: poolId,
      shares,
    });

    // Calculate value and fees (assume default share price 1.0)
    const sharePrice = 1_000_000; // 1.0 in 6 decimals
    const grossValue = Math.floor(shares * sharePrice / 1_000_000);

    // For now, assume normal fee (lockup check would require fetching delegation state)
    const feeType: 'normal' | 'early' = 'normal';
    const feeBps = feeType === 'early' ? EARLY_WITHDRAWAL_FEE_BPS : NORMAL_WITHDRAWAL_FEE_BPS;
    const fee = Math.floor(grossValue * feeBps / 10000);
    const netValue = grossValue - fee;

    // Serialize transaction
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = delegatorPk;

    const serialized = tx.serialize({ requireAllSignatures: false }).toString('base64');

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
      },
      meta: { latencyMs: Date.now() - startTime },
    });
  } catch (error) {
    console.error('[API v2/forecast-pools/unstake] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
