import { NextRequest, NextResponse } from 'next/server';
import {
  getCapitalThesis,
  prepareCollectFeesTransaction,
  refreshCapitalThesis,
} from '@/lib/capital';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  try {
    const body = await request.json() as { wallet?: string };
    if (!body.wallet) throw new Error('Connect the curator wallet before collecting fees.');
    await refreshCapitalThesis(slug);
    const thesis = getCapitalThesis(slug);
    if (!thesis || thesis.onchainStatus !== 'confirmed') throw new Error('Thesis not found.');
    if (body.wallet !== thesis.curatorWallet) throw new Error('Only the curator can prepare this fee collection.');
    if (BigInt(thesis.accruedFeesAtomic) === 0n) throw new Error('No performance fees are currently accrued.');
    const preparedTransaction = await prepareCollectFeesTransaction(
      thesis.onchainAddresses,
      body.wallet,
      thesis.curatorWallet,
    );
    return NextResponse.json({
      success: true,
      data: { preparedTransaction },
      meta: {
        network: 'devnet',
        executionMode: 'onchain',
        custody: 'program-pda',
        feeModel: 'profit-only-high-watermark',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fee collection could not be prepared.';
    return NextResponse.json({ success: false, error: message }, { status: message === 'Thesis not found.' ? 404 : 400 });
  }
}
