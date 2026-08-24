import { NextRequest, NextResponse } from 'next/server';
import {
  capitalDevnetConnection,
  capitalMetadataHash,
  capitalThesisId,
  confirmCapitalThesis,
  createCapitalThesis,
  listCapitalTheses,
  prepareCreateVaultTransaction,
  refreshCapitalThesis,
  type CreateCapitalThesisInput,
} from '@/lib/capital';

const ONCHAIN_META = {
  network: 'devnet',
  executionMode: 'onchain',
  custody: 'program-pda',
  metadataPersistence: 'process-memory',
  onchainProgramDeployed: true,
  onchainProgramId: 'F2WkXzns4p5pe8NAuK6V5NhZ4bdpXxAE9h5kLAMtxqCT', // pragma: allowlist secret
  onchainProgramStatus: 'deployed',
  strategyExecution: 'external_adapter_required',
  disclaimer: 'Devnet USDC only. The program is unaudited and must not receive mainnet funds.',
} as const;

export async function GET(request: NextRequest) {
  const creatorWallet = request.nextUrl.searchParams.get('creatorWallet') ?? undefined;
  const includePending = request.nextUrl.searchParams.get('includePending') === 'true';
  try {
    const theses = listCapitalTheses({ creatorWallet, includePending });
    await Promise.all(theses.map((thesis) => thesis.onchainStatus === 'confirmed'
      ? refreshCapitalThesis(thesis.slug)
      : Promise.resolve(thesis)));
    return NextResponse.json({
      success: true,
      data: theses,
      meta: ONCHAIN_META,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Could not load theses.' },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CreateCapitalThesisInput;
    const thesis = createCapitalThesis(body);
    const expiryUnix = thesis.expiry
      ? BigInt(Math.floor(new Date(thesis.expiry).getTime() / 1_000))
      : 0n;
    const preparedTransaction = await prepareCreateVaultTransaction({
      creator: thesis.creatorWallet,
      thesisId: capitalThesisId(thesis),
      metadataHash: capitalMetadataHash({
        id: thesis.id,
        slug: thesis.slug,
        thesisStatement: thesis.thesisStatement,
        marketRules: thesis.marketRules,
      }),
      metadataUri: thesis.metadataUri ?? `https://beright.xyz/capital/${thesis.slug}`,
      vaultType: thesis.vaultType,
      vaultStructure: thesis.vaultStructure,
      predictionAllocationMaxBps: thesis.predictionAllocationMaxBps,
      defiAllocationTargetBps: thesis.defiAllocationTargetBps,
      liquidReserveTargetBps: thesis.liquidReserveTargetBps,
      maxMarketAllocationBps: thesis.maxMarketAllocationBps,
      maxDrawdownBps: thesis.maxDrawdownBps,
      curatorFeeBps: thesis.curatorFeeBps,
      protocolFeeBps: thesis.protocolFeeBps,
      maxActivePositions: thesis.maxActivePositions,
      expiryUnix,
      lockupSeconds: thesis.lockupSeconds,
      depositCapAtomic: BigInt(thesis.depositCapAtomic),
      graduationThresholdAtomic: BigInt(thesis.graduationThresholdAtomic),
      perWalletQualifyingCapAtomic: BigInt(thesis.perWalletQualifyingCapAtomic),
      minimumUniqueContributors: thesis.minimumUniqueContributors,
    });
    return NextResponse.json({
      success: true,
      data: { thesis, preparedTransaction },
      meta: ONCHAIN_META,
    }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Could not submit the thesis.' },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as { slug?: string; signature?: string };
    if (!body.slug || !body.signature) throw new Error('Thesis slug and transaction signature are required.');
    const connection = capitalDevnetConnection();
    const result = await connection.getSignatureStatus(body.signature, { searchTransactionHistory: true });
    if (!result.value || result.value.err) throw new Error('The vault creation transaction is not confirmed on devnet.');
    const thesis = await confirmCapitalThesis(body.slug, body.signature);
    return NextResponse.json({ success: true, data: thesis, meta: ONCHAIN_META });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Could not confirm the thesis.' },
      { status: 400 },
    );
  }
}
