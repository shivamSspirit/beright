import {
  BN,
  BorshAccountsCoder,
  BorshInstructionCoder,
  type Idl,
} from '@coral-xyz/anchor';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { createHash } from 'node:crypto';
import capitalIdlJson from './berightcapital.idl.json';
import {
  BERIGHT_CAPITAL_PROGRAM_ID,
  deriveCapitalConfigPda,
  deriveThesisContributorPda,
  deriveThesisLiquidVaultPda,
  deriveThesisPda,
  deriveThesisRedemptionPda,
  deriveThesisShareMintPda,
  deriveThesisVaultPda,
} from './solana';

const capitalIdl = capitalIdlJson as unknown as Idl;
const instructionCoder = new BorshInstructionCoder(capitalIdl);
const accountCoder = new BorshAccountsCoder(capitalIdl);

export const DEVNET_USDC_MINT = new PublicKey(
  process.env.CAPITAL_DEVNET_USDC_MINT ?? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // pragma: allowlist secret
);

export interface CapitalOnchainAddresses {
  programId: string;
  config: string;
  thesis: string;
  vault: string;
  shareMint: string;
  liquidVault: string;
  depositMint: string;
}

export interface PreparedVaultTransaction {
  action: 'create_vault' | 'deposit' | 'cancel_funding' | 'request_redemption' | 'collect_fees';
  network: 'devnet';
  transaction: string;
  encoding: 'base64';
  recentBlockhash: string;
  lastValidBlockHeight: number;
  feePayer: string;
  programIds: string[];
  addresses: CapitalOnchainAddresses;
  expected: {
    assetsAtomic?: string;
    sharesAtomic?: string;
    minimumAssetsOutAtomic?: string;
    minimumSharesAtomic?: string;
    lockupSeconds?: number;
  };
  requiresWalletSignature: true;
  serverSigned: false;
  serverSubmits: false;
}

export interface CreateVaultTransactionInput {
  creator: string;
  thesisId: Uint8Array;
  metadataHash: Uint8Array;
  metadataUri: string;
  vaultType: 'index' | 'curated';
  vaultStructure: 'closed_ended' | 'open_ended';
  predictionAllocationMaxBps: number;
  defiAllocationTargetBps: number;
  liquidReserveTargetBps: number;
  maxMarketAllocationBps: number;
  maxDrawdownBps: number;
  curatorFeeBps: number;
  protocolFeeBps: number;
  maxActivePositions: number;
  expiryUnix: bigint;
  lockupSeconds: number;
  depositCapAtomic: bigint;
  graduationThresholdAtomic: bigint;
  perWalletQualifyingCapAtomic: bigint;
  minimumUniqueContributors: number;
  maxNavAgeSeconds?: number;
  maxNavChangeBps?: number;
}

interface DecodedVaultAccount {
  total_assets: BN;
  total_shares: BN;
  pending_redemption_shares: BN;
  accrued_fees: BN;
  accrued_curator_fees: BN;
  accrued_protocol_fees: BN;
  next_redemption_nonce: BN;
  graduated_at: BN;
  nav_epoch: BN;
  qualifying_capital: BN;
  unique_contributors: number;
  accounting_liquid_assets: BN;
}

interface DecodedThesisAccount {
  thesis_status: Record<string, unknown>;
}

interface DecodedProtocolConfigAccount {
  admin: PublicKey;
}

interface DecodedContributorAccount {
  deposited_assets: BN;
  owned_shares: BN;
  last_deposit_at: BN;
}

export interface CapitalOnchainSnapshot {
  status: 'funding' | 'dormant' | 'active' | 'paused' | 'expired' | 'closed';
  totalAssetsAtomic: string;
  totalSharesAtomic: string;
  pendingRedemptionSharesAtomic: string;
  accruedFeesAtomic: string;
  accruedCuratorFeesAtomic: string;
  accruedProtocolFeesAtomic: string;
  nextRedemptionNonce: string;
  graduatedAt: string | null;
  navEpoch: string;
  qualifyingCapitalAtomic: string;
  uniqueContributors: number;
  accountingLiquidAssetsAtomic: string;
  contributor: {
    depositedAssetsAtomic: string;
    ownedSharesAtomic: string;
    lastDepositAt: string | null;
  } | null;
}

export function capitalDevnetConnection(): Connection {
  const rpcUrl = process.env.CAPITAL_DEVNET_RPC_URL
    ?? 'https://api.devnet.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

export function deriveCapitalOnchainAddresses(
  creator: PublicKey,
  thesisId: Uint8Array,
  depositMint = DEVNET_USDC_MINT,
): CapitalOnchainAddresses {
  const [config] = deriveCapitalConfigPda();
  const [thesis] = deriveThesisPda(config, creator, thesisId);
  const [vault] = deriveThesisVaultPda(thesis);
  const [shareMint] = deriveThesisShareMintPda(vault);
  const [liquidVault] = deriveThesisLiquidVaultPda(vault);
  return {
    programId: BERIGHT_CAPITAL_PROGRAM_ID.toBase58(),
    config: config.toBase58(),
    thesis: thesis.toBase58(),
    vault: vault.toBase58(),
    shareMint: shareMint.toBase58(),
    liquidVault: liquidVault.toBase58(),
    depositMint: depositMint.toBase58(),
  };
}

export function capitalMetadataHash(value: unknown): Uint8Array {
  return Uint8Array.from(createHash('sha256').update(JSON.stringify(value)).digest());
}

export async function prepareCreateVaultTransaction(
  input: CreateVaultTransactionInput,
  connection = capitalDevnetConnection(),
): Promise<PreparedVaultTransaction> {
  assertBytes32(input.thesisId, 'thesisId');
  assertBytes32(input.metadataHash, 'metadataHash');
  const creator = new PublicKey(input.creator);
  const addresses = deriveCapitalOnchainAddresses(creator, input.thesisId);
  const accountKeys = parseAddresses(addresses);
  const createData = instructionCoder.encode('create_thesis', {
    params: {
      thesis_id: [...input.thesisId],
      curator: creator,
      metadata_hash: [...input.metadataHash],
      metadata_uri: input.metadataUri,
      vault_type: input.vaultType === 'index' ? { Index: null } : { Curated: null },
      vault_structure: input.vaultStructure === 'closed_ended'
        ? { ClosedEnded: null }
        : { OpenEnded: null },
      prediction_allocation_max_bps: input.predictionAllocationMaxBps,
      defi_allocation_target_bps: input.defiAllocationTargetBps,
      liquid_reserve_target_bps: input.liquidReserveTargetBps,
      max_market_allocation_bps: input.maxMarketAllocationBps,
      max_drawdown_bps: input.maxDrawdownBps,
      curator_fee_bps: input.curatorFeeBps,
      protocol_fee_bps: input.protocolFeeBps,
      minimum_reputation_tier: 0,
      max_active_positions: input.maxActivePositions,
      expiry: toI64Bn(input.expiryUnix, 'expiryUnix'),
      lockup_seconds: toI64Bn(BigInt(input.lockupSeconds), 'lockupSeconds'),
    },
  });
  const initializeData = instructionCoder.encode('initialize_thesis_vault', {
    params: {
      deposit_cap: toBn(input.depositCapAtomic, 'depositCapAtomic'),
      graduation_threshold: toBn(input.graduationThresholdAtomic, 'graduationThresholdAtomic'),
      per_wallet_qualifying_cap: toBn(
        input.perWalletQualifyingCapAtomic,
        'perWalletQualifyingCapAtomic',
      ),
      minimum_unique_contributors: input.minimumUniqueContributors,
      funding_yield_target_bps: 0,
      max_nav_age_seconds: toI64Bn(BigInt(input.maxNavAgeSeconds ?? 604_800), 'maxNavAgeSeconds'),
      max_nav_change_bps: input.maxNavChangeBps ?? 2_000,
    },
  });

  const instructions = [
    new TransactionInstruction({
      programId: BERIGHT_CAPITAL_PROGRAM_ID,
      keys: [
        { pubkey: creator, isSigner: true, isWritable: true },
        { pubkey: accountKeys.config, isSigner: false, isWritable: false },
        { pubkey: accountKeys.thesis, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: createData,
    }),
    new TransactionInstruction({
      programId: BERIGHT_CAPITAL_PROGRAM_ID,
      keys: [
        { pubkey: creator, isSigner: true, isWritable: true },
        { pubkey: accountKeys.config, isSigner: false, isWritable: false },
        { pubkey: accountKeys.thesis, isSigner: false, isWritable: true },
        { pubkey: accountKeys.vault, isSigner: false, isWritable: true },
        { pubkey: accountKeys.shareMint, isSigner: false, isWritable: true },
        { pubkey: accountKeys.liquidVault, isSigner: false, isWritable: true },
        { pubkey: accountKeys.depositMint, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: initializeData,
    }),
  ];
  return finalizePreparedTransaction({
    action: 'create_vault',
    connection,
    feePayer: creator,
    instructions,
    addresses,
    expected: { lockupSeconds: input.lockupSeconds },
  });
}

export async function prepareDepositVaultTransaction(
  addresses: CapitalOnchainAddresses,
  ownerAddress: string,
  amountAtomic: bigint,
  minimumSharesAtomic: bigint,
  connection = capitalDevnetConnection(),
): Promise<PreparedVaultTransaction> {
  requirePositiveU64(amountAtomic, 'amountAtomic');
  requireU64(minimumSharesAtomic, 'minimumSharesAtomic');
  const owner = new PublicKey(ownerAddress);
  const keys = parseAddresses(addresses);
  const [contributor] = deriveThesisContributorPda(keys.vault, owner);
  const userDepositAccount = getAssociatedTokenAddressSync(
    keys.depositMint,
    owner,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const userShareAccount = getAssociatedTokenAddressSync(
    keys.shareMint,
    owner,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const instructions: TransactionInstruction[] = [];
  if (!(await connection.getAccountInfo(userShareAccount, 'confirmed'))) {
    instructions.push(createAssociatedTokenAccountIdempotentInstruction(
      owner,
      userShareAccount,
      owner,
      keys.shareMint,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ));
  }
  instructions.push(new TransactionInstruction({
    programId: BERIGHT_CAPITAL_PROGRAM_ID,
    keys: [
      { pubkey: keys.config, isSigner: false, isWritable: false },
      { pubkey: keys.thesis, isSigner: false, isWritable: true },
      { pubkey: keys.vault, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: contributor, isSigner: false, isWritable: true },
      { pubkey: userDepositAccount, isSigner: false, isWritable: true },
      { pubkey: keys.liquidVault, isSigner: false, isWritable: true },
      { pubkey: keys.depositMint, isSigner: false, isWritable: false },
      { pubkey: keys.shareMint, isSigner: false, isWritable: true },
      { pubkey: userShareAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: instructionCoder.encode('deposit_thesis_vault', {
      amount: toBn(amountAtomic, 'amountAtomic'),
      minimum_shares: toBn(minimumSharesAtomic, 'minimumSharesAtomic'),
    }),
  }));
  return finalizePreparedTransaction({
    action: 'deposit',
    connection,
    feePayer: owner,
    instructions,
    addresses,
    expected: {
      assetsAtomic: amountAtomic.toString(),
      minimumSharesAtomic: minimumSharesAtomic.toString(),
    },
  });
}

export async function prepareCancelFundingTransaction(
  addresses: CapitalOnchainAddresses,
  ownerAddress: string,
  sharesAtomic: bigint,
  minimumAssetsOutAtomic: bigint,
  connection = capitalDevnetConnection(),
): Promise<PreparedVaultTransaction> {
  return prepareShareExitTransaction({
    action: 'cancel_funding',
    addresses,
    ownerAddress,
    sharesAtomic,
    minimumAssetsOutAtomic,
    connection,
  });
}

export async function prepareRequestRedemptionTransaction(
  addresses: CapitalOnchainAddresses,
  ownerAddress: string,
  sharesAtomic: bigint,
  minimumAssetsOutAtomic: bigint,
  nonce: bigint,
  connection = capitalDevnetConnection(),
): Promise<PreparedVaultTransaction> {
  requirePositiveU64(sharesAtomic, 'sharesAtomic');
  requireU64(minimumAssetsOutAtomic, 'minimumAssetsOutAtomic');
  requireU64(nonce, 'nonce');
  const owner = new PublicKey(ownerAddress);
  const keys = parseAddresses(addresses);
  const [contributor] = deriveThesisContributorPda(keys.vault, owner);
  const [request] = deriveThesisRedemptionPda(keys.vault, nonce);
  const userShareAccount = getAssociatedTokenAddressSync(
    keys.shareMint,
    owner,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const instruction = new TransactionInstruction({
    programId: BERIGHT_CAPITAL_PROGRAM_ID,
    keys: [
      { pubkey: keys.thesis, isSigner: false, isWritable: false },
      { pubkey: keys.vault, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: contributor, isSigner: false, isWritable: true },
      { pubkey: request, isSigner: false, isWritable: true },
      { pubkey: keys.shareMint, isSigner: false, isWritable: true },
      { pubkey: userShareAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: instructionCoder.encode('request_thesis_redemption', {
      params: {
        shares: toBn(sharesAtomic, 'sharesAtomic'),
        minimum_assets_out: toBn(minimumAssetsOutAtomic, 'minimumAssetsOutAtomic'),
        nonce: toBn(nonce, 'nonce'),
      },
    }),
  });
  return finalizePreparedTransaction({
    action: 'request_redemption',
    connection,
    feePayer: owner,
    instructions: [instruction],
    addresses,
    expected: {
      sharesAtomic: sharesAtomic.toString(),
      minimumAssetsOutAtomic: minimumAssetsOutAtomic.toString(),
    },
  });
}

export async function prepareCollectFeesTransaction(
  addresses: CapitalOnchainAddresses,
  authorityAddress: string,
  curatorAddress: string,
  connection = capitalDevnetConnection(),
): Promise<PreparedVaultTransaction> {
  const authority = new PublicKey(authorityAddress);
  const curator = new PublicKey(curatorAddress);
  const keys = parseAddresses(addresses);
  const configAccount = await connection.getAccountInfo(keys.config, 'confirmed');
  if (!configAccount) throw new Error('Capital protocol configuration is missing on devnet.');
  const config = accountCoder.decode('ProtocolConfig', configAccount.data) as DecodedProtocolConfigAccount;
  const protocolTreasury = config.admin;
  const curatorDestination = getAssociatedTokenAddressSync(keys.depositMint, curator, true);
  const protocolDestination = getAssociatedTokenAddressSync(keys.depositMint, protocolTreasury, true);
  const instructions = [
    createAssociatedTokenAccountIdempotentInstruction(
      authority,
      curatorDestination,
      curator,
      keys.depositMint,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      authority,
      protocolDestination,
      protocolTreasury,
      keys.depositMint,
    ),
    new TransactionInstruction({
      programId: BERIGHT_CAPITAL_PROGRAM_ID,
      keys: [
        { pubkey: keys.config, isSigner: false, isWritable: false },
        { pubkey: keys.thesis, isSigner: false, isWritable: false },
        { pubkey: keys.vault, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
        { pubkey: keys.liquidVault, isSigner: false, isWritable: true },
        { pubkey: curatorDestination, isSigner: false, isWritable: true },
        { pubkey: curator, isSigner: false, isWritable: false },
        { pubkey: protocolDestination, isSigner: false, isWritable: true },
        { pubkey: protocolTreasury, isSigner: false, isWritable: false },
        { pubkey: keys.depositMint, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: instructionCoder.encode('collect_thesis_fees', {}),
    }),
  ];
  return finalizePreparedTransaction({
    action: 'collect_fees',
    connection,
    feePayer: authority,
    instructions,
    addresses,
    expected: {},
  });
}

export async function fetchCapitalOnchainSnapshot(
  addresses: CapitalOnchainAddresses,
  ownerAddress?: string,
  connection = capitalDevnetConnection(),
): Promise<CapitalOnchainSnapshot> {
  const keys = parseAddresses(addresses);
  const contributor = ownerAddress
    ? deriveThesisContributorPda(keys.vault, new PublicKey(ownerAddress))[0]
    : null;
  const [thesisAccount, vaultAccount, contributorAccount] = await Promise.all([
    connection.getAccountInfo(keys.thesis, 'confirmed'),
    connection.getAccountInfo(keys.vault, 'confirmed'),
    contributor ? connection.getAccountInfo(contributor, 'confirmed') : Promise.resolve(null),
  ]);
  if (!thesisAccount) throw new Error('The on-chain thesis does not exist on devnet.');
  if (!vaultAccount) throw new Error('The on-chain thesis vault does not exist on devnet.');
  if (!vaultAccount.owner.equals(BERIGHT_CAPITAL_PROGRAM_ID)) {
    throw new Error('The thesis vault is not owned by the configured Capital program.');
  }
  const vault = accountCoder.decode('ThesisVault', vaultAccount.data) as DecodedVaultAccount;
  const thesis = accountCoder.decode('Thesis', thesisAccount.data) as DecodedThesisAccount;
  const decodedContributor = contributorAccount
    ? accountCoder.decode('ThesisContributor', contributorAccount.data) as DecodedContributorAccount
    : null;
  return {
    status: decodeThesisStatus(thesis.thesis_status),
    totalAssetsAtomic: vault.total_assets.toString(),
    totalSharesAtomic: vault.total_shares.toString(),
    pendingRedemptionSharesAtomic: vault.pending_redemption_shares.toString(),
    accruedFeesAtomic: vault.accrued_fees.toString(),
    accruedCuratorFeesAtomic: vault.accrued_curator_fees.toString(),
    accruedProtocolFeesAtomic: vault.accrued_protocol_fees.toString(),
    nextRedemptionNonce: vault.next_redemption_nonce.toString(),
    graduatedAt: unixSecondsToIso(vault.graduated_at),
    navEpoch: vault.nav_epoch.toString(),
    qualifyingCapitalAtomic: vault.qualifying_capital.toString(),
    uniqueContributors: vault.unique_contributors,
    accountingLiquidAssetsAtomic: vault.accounting_liquid_assets.toString(),
    contributor: decodedContributor ? {
      depositedAssetsAtomic: decodedContributor.deposited_assets.toString(),
      ownedSharesAtomic: decodedContributor.owned_shares.toString(),
      lastDepositAt: unixSecondsToIso(decodedContributor.last_deposit_at),
    } : null,
  };
}

function decodeThesisStatus(value: Record<string, unknown>): CapitalOnchainSnapshot['status'] {
  const key = Object.keys(value)[0]?.replace(/_/g, '').toLowerCase();
  const statuses: Record<string, CapitalOnchainSnapshot['status']> = {
    funding: 'funding',
    dormant: 'dormant',
    active: 'active',
    paused: 'paused',
    expired: 'expired',
    closed: 'closed',
  };
  const status = key ? statuses[key] : undefined;
  if (!status) throw new Error('The thesis account contains an unknown lifecycle status.');
  return status;
}

async function prepareShareExitTransaction(input: {
  action: 'cancel_funding';
  addresses: CapitalOnchainAddresses;
  ownerAddress: string;
  sharesAtomic: bigint;
  minimumAssetsOutAtomic: bigint;
  connection: Connection;
}): Promise<PreparedVaultTransaction> {
  requirePositiveU64(input.sharesAtomic, 'sharesAtomic');
  requireU64(input.minimumAssetsOutAtomic, 'minimumAssetsOutAtomic');
  const owner = new PublicKey(input.ownerAddress);
  const keys = parseAddresses(input.addresses);
  const [contributor] = deriveThesisContributorPda(keys.vault, owner);
  const userDepositAccount = getAssociatedTokenAddressSync(keys.depositMint, owner);
  const userShareAccount = getAssociatedTokenAddressSync(
    keys.shareMint,
    owner,
    false,
    TOKEN_2022_PROGRAM_ID,
  );
  const instruction = new TransactionInstruction({
    programId: BERIGHT_CAPITAL_PROGRAM_ID,
    keys: [
      { pubkey: keys.config, isSigner: false, isWritable: false },
      { pubkey: keys.thesis, isSigner: false, isWritable: false },
      { pubkey: keys.vault, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: contributor, isSigner: false, isWritable: true },
      { pubkey: userDepositAccount, isSigner: false, isWritable: true },
      { pubkey: keys.liquidVault, isSigner: false, isWritable: true },
      { pubkey: keys.depositMint, isSigner: false, isWritable: false },
      { pubkey: keys.shareMint, isSigner: false, isWritable: true },
      { pubkey: userShareAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: instructionCoder.encode('cancel_thesis_funding', {
      shares: toBn(input.sharesAtomic, 'sharesAtomic'),
      minimum_assets_out: toBn(input.minimumAssetsOutAtomic, 'minimumAssetsOutAtomic'),
    }),
  });
  return finalizePreparedTransaction({
    action: input.action,
    connection: input.connection,
    feePayer: owner,
    instructions: [instruction],
    addresses: input.addresses,
    expected: {
      sharesAtomic: input.sharesAtomic.toString(),
      minimumAssetsOutAtomic: input.minimumAssetsOutAtomic.toString(),
    },
  });
}

async function finalizePreparedTransaction(input: {
  action: PreparedVaultTransaction['action'];
  connection: Connection;
  feePayer: PublicKey;
  instructions: TransactionInstruction[];
  addresses: CapitalOnchainAddresses;
  expected: PreparedVaultTransaction['expected'];
}): Promise<PreparedVaultTransaction> {
  const { blockhash, lastValidBlockHeight } = await input.connection.getLatestBlockhash('confirmed');
  const transaction = new Transaction();
  transaction.feePayer = input.feePayer;
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.add(...input.instructions);
  const programIds = [...new Set(input.instructions.map((instruction) => instruction.programId.toBase58()))];
  return {
    action: input.action,
    network: 'devnet',
    transaction: transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    }).toString('base64'),
    encoding: 'base64',
    recentBlockhash: blockhash,
    lastValidBlockHeight,
    feePayer: input.feePayer.toBase58(),
    programIds,
    addresses: input.addresses,
    expected: input.expected,
    requiresWalletSignature: true,
    serverSigned: false,
    serverSubmits: false,
  };
}

function parseAddresses(addresses: CapitalOnchainAddresses) {
  if (addresses.programId !== BERIGHT_CAPITAL_PROGRAM_ID.toBase58()) {
    throw new Error('The thesis references an unexpected Capital program.');
  }
  return {
    config: new PublicKey(addresses.config),
    thesis: new PublicKey(addresses.thesis),
    vault: new PublicKey(addresses.vault),
    shareMint: new PublicKey(addresses.shareMint),
    liquidVault: new PublicKey(addresses.liquidVault),
    depositMint: new PublicKey(addresses.depositMint),
  };
}

function toBn(value: bigint, name: string): BN {
  requireU64(value, name);
  return new BN(value.toString());
}

function toI64Bn(value: bigint, name: string): BN {
  requireU64(value, name, true);
  return new BN(value.toString());
}

function requirePositiveU64(value: bigint, name: string): void {
  requireU64(value, name);
  if (value === 0n) throw new Error(`${name} must be greater than zero.`);
}

function requireU64(value: bigint, name: string, signed = false): void {
  const minimum = signed ? -(1n << 63n) : 0n;
  const maximum = signed ? (1n << 63n) - 1n : 0xffff_ffff_ffff_ffffn;
  if (value < minimum || value > maximum) throw new Error(`${name} is outside its integer range.`);
}

function assertBytes32(value: Uint8Array, name: string): void {
  if (value.length !== 32) throw new Error(`${name} must be exactly 32 bytes.`);
}

function unixSecondsToIso(value: BN): string | null {
  if (value.isZero()) return null;
  return new Date(value.toNumber() * 1_000).toISOString();
}
