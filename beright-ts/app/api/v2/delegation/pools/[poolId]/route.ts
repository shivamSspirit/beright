/**
 * Pool Detail API
 *
 * GET /api/v2/delegation/pools/[poolId] - Get pool details
 * POST /api/v2/delegation/pools/[poolId] - Actions (delegate, undelegate, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import {
  getPoolDetails,
  getPoolBySlug,
  createDelegationPoolClient,
  getDelegation,
  recordTransaction,
} from '@/lib/delegation';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

interface RouteParams {
  params: Promise<{ poolId: string }>;
}

/**
 * GET /api/v2/delegation/pools/[poolId]
 *
 * Get pool details by ID or slug
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { poolId } = await params;

    // Try by ID first, then by slug
    let pool = await getPoolDetails(poolId);

    if (!pool) {
      const poolBySlug = await getPoolBySlug(poolId);
      if (poolBySlug) {
        pool = await getPoolDetails(poolBySlug.id);
      }
    }

    if (!pool) {
      return NextResponse.json(
        { success: false, error: 'Pool not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: pool,
    });
  } catch (error) {
    console.error('[API] Failed to get pool:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get pool' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v2/delegation/pools/[poolId]
 *
 * Perform actions on a pool:
 * - delegate: Deposit to pool
 * - undelegate: Request withdrawal
 * - processWithdrawal: Execute pending withdrawal
 * - updateNav: Update NAV (forecaster only)
 * - collectFees: Collect fees (forecaster only)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { poolId } = await params;
    const body = await request.json();
    const { action, wallet, amount, shares } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'action is required' },
        { status: 400 }
      );
    }

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'wallet is required' },
        { status: 400 }
      );
    }

    // Get pool
    let pool = await getPoolDetails(poolId);
    if (!pool) {
      const poolBySlug = await getPoolBySlug(poolId);
      if (poolBySlug) {
        pool = await getPoolDetails(poolBySlug.id);
      }
    }

    if (!pool) {
      return NextResponse.json(
        { success: false, error: 'Pool not found' },
        { status: 404 }
      );
    }

    const connection = new Connection(RPC_URL, 'confirmed');
    const dummyWallet = {
      publicKey: new PublicKey(wallet),
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any[]) => txs,
    };

    const client = createDelegationPoolClient(connection, dummyWallet as any);

    let transaction;
    let txType: string;

    switch (action) {
      case 'delegate': {
        if (!amount) {
          return NextResponse.json(
            { success: false, error: 'amount is required for delegate' },
            { status: 400 }
          );
        }

        // Validate amount
        const depositAmount = BigInt(Math.floor(parseFloat(amount) * 1_000000));

        if (depositAmount < BigInt(pool.minDeposit * 1_000000)) {
          return NextResponse.json(
            {
              success: false,
              error: `Minimum deposit is ${pool.minDeposit} ${pool.baseToken}`,
            },
            { status: 400 }
          );
        }

        transaction = await client.buildDepositTx({
          poolPda: new PublicKey(pool.poolPda),
          depositor: new PublicKey(wallet),
          amount: depositAmount,
        });
        txType = 'deposit';
        break;
      }

      case 'undelegate': {
        if (!shares) {
          return NextResponse.json(
            { success: false, error: 'shares is required for undelegate' },
            { status: 400 }
          );
        }

        // Check if user has delegation
        const delegation = await getDelegation(pool.id, wallet);
        if (!delegation) {
          return NextResponse.json(
            { success: false, error: 'No delegation found' },
            { status: 400 }
          );
        }

        const sharesToWithdraw = BigInt(shares);
        if (sharesToWithdraw > BigInt(delegation.shares.toString())) {
          return NextResponse.json(
            { success: false, error: 'Insufficient shares' },
            { status: 400 }
          );
        }

        transaction = await client.buildRequestWithdrawalTx({
          poolPda: new PublicKey(pool.poolPda),
          depositor: new PublicKey(wallet),
          shares: sharesToWithdraw,
        });
        txType = 'withdrawal_request';
        break;
      }

      case 'processWithdrawal': {
        transaction = await client.buildProcessWithdrawalTx({
          poolPda: new PublicKey(pool.poolPda),
          depositor: new PublicKey(wallet),
        });
        txType = 'withdrawal_process';
        break;
      }

      case 'updateNav': {
        // Verify forecaster
        if (wallet !== pool.forecasterWallet) {
          return NextResponse.json(
            { success: false, error: 'Only forecaster can update NAV' },
            { status: 403 }
          );
        }

        const { newNavPerShare } = body;
        if (!newNavPerShare) {
          return NextResponse.json(
            { success: false, error: 'newNavPerShare is required' },
            { status: 400 }
          );
        }

        transaction = await client.buildUpdateNavTx({
          poolPda: new PublicKey(pool.poolPda),
          forecaster: new PublicKey(wallet),
          newNavPerShare: BigInt(Math.floor(parseFloat(newNavPerShare) * 1e9)),
        });
        txType = 'nav_update';
        break;
      }

      case 'collectFees': {
        // Verify forecaster
        if (wallet !== pool.forecasterWallet) {
          return NextResponse.json(
            { success: false, error: 'Only forecaster can collect fees' },
            { status: 403 }
          );
        }

        transaction = await client.buildCollectFeesTx(
          new PublicKey(pool.poolPda),
          new PublicKey(wallet)
        );
        txType = 'fee_collection';
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    // Serialize transaction
    const serializedTx = transaction
      .serialize({ requireAllSignatures: false })
      .toString('base64');

    return NextResponse.json({
      success: true,
      data: {
        action,
        transaction: serializedTx,
        poolPda: pool.poolPda,
        txType,
      },
    });
  } catch (error) {
    console.error('[API] Pool action failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Action failed',
      },
      { status: 500 }
    );
  }
}
