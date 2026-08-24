import { NextRequest, NextResponse } from 'next/server';
import {
  getCapitalThesis,
  prepareDepositVaultTransaction,
  quoteCapitalThesisDeposit,
  refreshCapitalThesis,
} from '@/lib/capital';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  try {
    const body = await request.json() as {
      wallet?: string;
      amountUsdc?: string;
      action?: 'quote' | 'deposit';
    };
    if (!body.amountUsdc) throw new Error('Enter a USDC amount.');
    const thesis = await refreshCapitalThesis(slug);
    if (!thesis || thesis.onchainStatus !== 'confirmed') throw new Error('Thesis not found.');
    const quote = quoteCapitalThesisDeposit(slug, body.amountUsdc);
    if (body.action === 'quote') {
      return NextResponse.json({ success: true, data: { quote }, meta: onchainMeta() });
    }
    if (!body.wallet) throw new Error('Connect a wallet before preparing the devnet deposit.');
    const current = getCapitalThesis(slug);
    if (!current) throw new Error('Thesis not found.');
    const minimumShares = BigInt(quote.sharesAtomic) * 9_950n / 10_000n;
    const preparedTransaction = await prepareDepositVaultTransaction(
      current.onchainAddresses,
      body.wallet,
      BigInt(quote.depositAmountAtomic),
      minimumShares,
    );
    return NextResponse.json({ success: true, data: { quote, preparedTransaction }, meta: onchainMeta() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The devnet deposit could not be prepared.';
    return NextResponse.json({ success: false, error: message }, { status: message === 'Thesis not found.' ? 404 : 400 });
  }
}

function onchainMeta() {
  return {
    network: 'devnet' as const,
    executionMode: 'onchain' as const,
    custody: 'program-pda' as const,
    walletSignatureRequired: true,
    transactionSignature: null,
    disclaimer: 'Signing moves devnet USDC into a program-owned PDA and mints non-transferable vault shares.',
  };
}
