/**
 * Delegator API
 *
 * GET /api/v2/delegation/delegator?wallet=<address>
 *
 * Get all delegations for a wallet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDelegationsForWallet } from '@/lib/delegation';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'wallet parameter is required' },
        { status: 400 }
      );
    }

    // Validate wallet address format
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    const delegations = await getDelegationsForWallet(wallet);

    // Calculate summary
    const totalDelegated = delegations.reduce((sum, d) => sum + d.depositedAmount, 0);
    const totalCurrentValue = delegations.reduce((sum, d) => sum + d.currentValue, 0);
    const totalPnl = delegations.reduce((sum, d) => sum + d.pnl, 0);
    const totalPnlPercent = totalDelegated > 0 ? (totalPnl / totalDelegated) * 100 : 0;

    const activePools = delegations.filter((d) => !d.hasWithdrawalPending).length;
    const pendingWithdrawals = delegations.filter((d) => d.hasWithdrawalPending).length;

    return NextResponse.json({
      success: true,
      data: {
        wallet,
        summary: {
          totalDelegated,
          totalCurrentValue,
          totalPnl,
          totalPnlPercent: Math.round(totalPnlPercent * 100) / 100,
          activePools,
          pendingWithdrawals,
          poolCount: delegations.length,
        },
        delegations: delegations.map((d) => ({
          ...d,
          pnlPercent: Math.round(d.pnlPercent * 100) / 100,
        })),
      },
    });
  } catch (error) {
    console.error('[API] Failed to get delegations:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get delegations',
      },
      { status: 500 }
    );
  }
}
