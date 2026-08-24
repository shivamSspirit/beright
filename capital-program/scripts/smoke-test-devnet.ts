import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEVNET_USDC_MINT,
  fetchCapitalOnchainSnapshot,
  prepareCreateVaultTransaction,
} from '../../beright-ts/lib/capital/onchainTransactions';
import { BERIGHT_CAPITAL_PROGRAM_ID } from '../../beright-ts/lib/capital/solana';

async function main(): Promise<void> {
  const rpcUrl = process.env.CAPITAL_DEVNET_RPC_URL ?? 'https://api.devnet.solana.com';
  requireDevnetRpc(rpcUrl);

  const keypairPath = resolve(
    process.cwd(),
    process.env.CAPITAL_DEPLOYER_KEYPAIR ?? 'devnet-deployer.keypair.json',
  );
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(keypairPath, 'utf8')) as number[]),
  );
  const connection = new Connection(rpcUrl, 'confirmed');
  const uniqueLabel = `beright-capital-devnet-smoke-${Date.now()}`;
  const thesisId = digest(uniqueLabel);
  const metadata = {
    name: 'BeRight Capital devnet smoke vault',
    description: 'Disposable open-ended vault used to verify the deployed lifecycle.',
    network: 'solana-devnet',
    uniqueLabel,
  };

  const prepared = await prepareCreateVaultTransaction({
    creator: payer.publicKey.toBase58(),
    thesisId,
    metadataHash: digest(JSON.stringify(metadata)),
    metadataUri: 'https://beright.xyz/devnet-smoke',
    vaultType: 'curated',
    vaultStructure: 'open_ended',
    predictionAllocationMaxBps: 2_500,
    defiAllocationTargetBps: 6_500,
    liquidReserveTargetBps: 1_000,
    maxMarketAllocationBps: 500,
    maxDrawdownBps: 2_500,
    curatorFeeBps: 1_000,
    protocolFeeBps: 100,
    maxActivePositions: 10,
    expiryUnix: 0n,
    lockupSeconds: 60,
    depositCapAtomic: 1_000_000_000n,
    graduationThresholdAtomic: 0n,
    perWalletQualifyingCapAtomic: 0n,
    minimumUniqueContributors: 0,
  }, connection);

  const transaction = Transaction.from(Buffer.from(prepared.transaction, 'base64'));
  transaction.sign(payer);
  const simulation = await connection.simulateTransaction(transaction, undefined, true);
  if (simulation.value.err) {
    throw new Error(
      `Create-vault simulation failed: ${JSON.stringify(simulation.value.err)}\n${simulation.value.logs?.join('\n') ?? ''}`,
    );
  }

  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    preflightCommitment: 'confirmed',
    skipPreflight: false,
  });
  const confirmation = await connection.confirmTransaction({
    signature,
    blockhash: prepared.recentBlockhash,
    lastValidBlockHeight: prepared.lastValidBlockHeight,
  }, 'confirmed');
  if (confirmation.value.err) {
    throw new Error(`Create-vault transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  const addressEntries = [
    ['thesis', prepared.addresses.thesis, BERIGHT_CAPITAL_PROGRAM_ID],
    ['vault', prepared.addresses.vault, BERIGHT_CAPITAL_PROGRAM_ID],
    ['share mint', prepared.addresses.shareMint, TOKEN_2022_PROGRAM_ID],
    ['liquid vault', prepared.addresses.liquidVault, TOKEN_PROGRAM_ID],
  ] as const;
  const accounts = await connection.getMultipleAccountsInfo(
    addressEntries.map(([, address]) => new PublicKey(address)),
    'confirmed',
  );
  for (const [index, [label, address, expectedOwner]] of addressEntries.entries()) {
    const account = accounts[index];
    if (!account) throw new Error(`${label} account ${address} was not created.`);
    if (!account.owner.equals(expectedOwner)) {
      throw new Error(`${label} account ${address} has owner ${account.owner.toBase58()}.`);
    }
  }

  const snapshot = await fetchCapitalOnchainSnapshot(prepared.addresses, payer.publicKey.toBase58(), connection);
  const payerUsdcAta = getAssociatedTokenAddressSync(DEVNET_USDC_MINT, payer.publicKey);
  const payerUsdcAccount = await connection.getAccountInfo(payerUsdcAta, 'confirmed');
  const payerUsdcAtomic = payerUsdcAccount
    ? (await connection.getTokenAccountBalance(payerUsdcAta, 'confirmed')).value.amount
    : '0';

  console.log(JSON.stringify({
    programId: BERIGHT_CAPITAL_PROGRAM_ID.toBase58(),
    transaction: signature,
    addresses: prepared.addresses,
    status: snapshot.status,
    lockupSeconds: prepared.expected.lockupSeconds,
    totalAssetsAtomic: snapshot.totalAssetsAtomic,
    totalSharesAtomic: snapshot.totalSharesAtomic,
    accountOwnersVerified: true,
    payerUsdcAta: payerUsdcAta.toBase58(),
    payerUsdcAtomic,
    depositSmokeAvailable: payerUsdcAtomic !== '0',
  }, null, 2));
}

function digest(value: string): Uint8Array {
  return Uint8Array.from(createHash('sha256').update(value).digest());
}

function requireDevnetRpc(rpcUrl: string): void {
  if (!rpcUrl.toLowerCase().includes('devnet')) {
    throw new Error('Refusing to run the Capital smoke test against a non-devnet RPC URL.');
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
