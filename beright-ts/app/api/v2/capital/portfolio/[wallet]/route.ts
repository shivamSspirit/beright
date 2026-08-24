import { NextResponse } from 'next/server';
import { getCapitalPortfolioOnchain } from '@/lib/capital';

export async function GET(
  _request: Request,
  context: { params: Promise<{ wallet: string }> },
) {
  const { wallet } = await context.params;
  try {
    return NextResponse.json({
      success: true,
      data: await getCapitalPortfolioOnchain(wallet),
      meta: {
        network: 'devnet',
        executionMode: 'onchain',
        custody: 'program-pda',
        transactionSignatures: true,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Could not load the Capital portfolio.' },
      { status: 400 },
    );
  }
}
