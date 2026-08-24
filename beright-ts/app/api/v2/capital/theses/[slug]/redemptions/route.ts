import { NextRequest, NextResponse } from 'next/server';
import {
  fetchCapitalOnchainSnapshot,
  getCapitalThesis,
  prepareCancelFundingTransaction,
  prepareRequestRedemptionTransaction,
  refreshCapitalThesis,
} from '@/lib/capital';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  try {
    const body = await request.json() as { wallet?: string; shares?: string };
    if (!body.wallet) throw new Error('Connect a wallet before requesting redemption.');
    if (!body.shares) throw new Error('Enter the number of shares to redeem.');
    await refreshCapitalThesis(slug);
    const thesis = getCapitalThesis(slug);
    if (!thesis || thesis.onchainStatus !== 'confirmed') throw new Error('Thesis not found.');
    const sharesAtomic = parseSharesAtomic(body.shares);
    const snapshot = await fetchCapitalOnchainSnapshot(thesis.onchainAddresses, body.wallet);
    if (!snapshot.contributor || sharesAtomic > BigInt(snapshot.contributor.ownedSharesAtomic)) {
      throw new Error('Redemption exceeds the wallet’s available on-chain shares.');
    }
    const totalShares = BigInt(snapshot.totalSharesAtomic);
    if (totalShares === 0n) throw new Error('The vault has no redeemable shares.');
    const expectedAssets = sharesAtomic * BigInt(snapshot.totalAssetsAtomic) / totalShares;
    const minimumAssets = expectedAssets * 9_950n / 10_000n;
    const preparedTransaction = thesis.status === 'funding'
      ? await prepareCancelFundingTransaction(
        thesis.onchainAddresses,
        body.wallet,
        sharesAtomic,
        minimumAssets,
      )
      : await prepareRequestRedemptionTransaction(
        thesis.onchainAddresses,
        body.wallet,
        sharesAtomic,
        minimumAssets,
        BigInt(snapshot.nextRedemptionNonce),
      );
    const settlement = thesis.status === 'funding' ? 'immediate-funding-cancel' : 'nav-epoch';
    return NextResponse.json({
      success: true,
      data: { preparedTransaction, expectedAssetsAtomic: expectedAssets.toString() },
      meta: {
        network: 'devnet',
        executionMode: 'onchain',
        custody: 'program-pda',
        settlement,
        transactionSignature: null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The redemption request could not be created.';
    return NextResponse.json({ success: false, error: message }, { status: message === 'Thesis not found.' ? 404 : 400 });
  }
}

function parseSharesAtomic(value: string): bigint {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(normalized)) {
    throw new Error('Shares must be a positive amount with up to 6 decimals.');
  }
  const [whole = '0', fraction = ''] = normalized.split('.');
  const atomic = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
  if (atomic <= 0n) throw new Error('Shares must be greater than zero.');
  return atomic;
}
