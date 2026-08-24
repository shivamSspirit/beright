import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  isCapitalStrategyPreparationEnabled,
  prepareJupiterEarnTransaction,
} from '@/lib/capital';

export const dynamic = 'force-dynamic';

const prepareSchema = z.object({
  action: z.enum(['deposit', 'withdraw', 'redeem']),
  wallet: z.string().min(32).max(44),
  amountAtomic: z.string().regex(/^[1-9]\d*$/).max(20),
}).strict();

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isCapitalStrategyPreparationEnabled()) {
    return NextResponse.json({
      success: false,
      error: 'Jupiter Earn transaction preparation is disabled until the production strategy gate is enabled.',
      code: 'STRATEGY_PREPARATION_DISABLED',
    }, { status: 503 });
  }

  try {
    const input = prepareSchema.parse(await request.json());
    const transaction = await prepareJupiterEarnTransaction(input);
    return NextResponse.json({
      success: true,
      data: transaction,
      meta: {
        executableByServer: false,
        requiresWalletReview: true,
        warning: 'Rates are variable. Review the wallet simulation and transaction accounts before signing.',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to prepare Jupiter Earn transaction.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
