import { createHash } from 'node:crypto';

const BPS_DENOMINATOR = 10_000n;
const MAX_PREDICTION_BPS = 2_500;
const MIN_RESERVE_BPS = 1_000;

export interface ThesisBlueprint {
  name: string;
  symbol: string;
  network: 'devnet';
  vaultType: 'index' | 'curated';
  vaultStructure: 'closed_ended' | 'open_ended';
  depositAsset: 'USDC';
  predictionAllocationMaxBps: number;
  defiAllocationTargetBps: number;
  liquidReserveTargetBps: number;
  maxMarketAllocationBps: number;
  maxDrawdownBps: number;
  curatorFeeBps: number;
  protocolFeeBps: number;
  maxActivePositions: number;
  expiry: string | null;
  executionMode: 'simulated' | 'onchain';
  shareStandard: 'token-2022-non-transferable';
}

export interface ThesisNavComponentsAtomic {
  accountingLiquidAssets: bigint;
  defiAssets: bigint;
  predictionAssets: bigint;
  resolvedUnclaimedAssets: bigint;
  accruedFees: bigint;
  liabilities: bigint;
}

export interface ThesisNavCheckpointPayload extends ThesisNavComponentsAtomic {
  epoch: bigint;
  observedAt: bigint;
  contentHash: Uint8Array;
  totalAssets: bigint;
}

export function createSolanaGrowthDevnetBlueprint(expiry = '2027-12-31T00:00:00.000Z'): ThesisBlueprint {
  const expiryDate = new Date(expiry);
  if (Number.isNaN(expiryDate.getTime())) throw new Error('expiry must be a valid ISO date.');
  return {
    name: 'Solana Growth Index',
    symbol: 'brSOL27',
    network: 'devnet',
    vaultType: 'index',
    vaultStructure: 'closed_ended',
    depositAsset: 'USDC',
    predictionAllocationMaxBps: 2_500,
    defiAllocationTargetBps: 6_500,
    liquidReserveTargetBps: 1_000,
    maxMarketAllocationBps: 500,
    maxDrawdownBps: 1_200,
    curatorFeeBps: 150,
    protocolFeeBps: 50,
    maxActivePositions: 5,
    expiry: expiryDate.toISOString(),
    executionMode: 'onchain',
    shareStandard: 'token-2022-non-transferable',
  };
}

export function validateThesisBlueprint(blueprint: ThesisBlueprint): void {
  if (blueprint.network !== 'devnet') throw new Error('The MVP thesis must remain on devnet.');
  if (blueprint.predictionAllocationMaxBps < 0 || blueprint.predictionAllocationMaxBps > MAX_PREDICTION_BPS) {
    throw new Error('Prediction allocation exceeds the 25% protocol ceiling.');
  }
  if (blueprint.liquidReserveTargetBps < MIN_RESERVE_BPS) {
    throw new Error('Liquid reserve must be at least 10%.');
  }
  if (blueprint.maxMarketAllocationBps <= 0
    || blueprint.maxMarketAllocationBps > blueprint.predictionAllocationMaxBps) {
    throw new Error('Per-market allocation must be positive and within the prediction ceiling.');
  }
  const targetBps = blueprint.predictionAllocationMaxBps
    + blueprint.defiAllocationTargetBps
    + blueprint.liquidReserveTargetBps;
  if (targetBps > Number(BPS_DENOMINATOR)) throw new Error('Strategy allocation targets exceed 100%.');
  if (blueprint.maxActivePositions <= 0 || blueprint.maxActivePositions > 10) {
    throw new Error('Active prediction positions must be between 1 and 10.');
  }
  if (blueprint.vaultStructure === 'closed_ended' && !blueprint.expiry) {
    throw new Error('Closed-ended vaults require an expiry.');
  }
}

export function calculateThesisNavAtomic(components: ThesisNavComponentsAtomic): bigint {
  const values = Object.values(components);
  if (values.some((value) => value < 0n)) throw new Error('NAV components cannot be negative.');
  const gross = components.accountingLiquidAssets
    + components.defiAssets
    + components.predictionAssets
    + components.resolvedUnclaimedAssets;
  const deductions = components.accruedFees + components.liabilities;
  if (deductions > gross) throw new Error('NAV deductions exceed gross assets.');
  return gross - deductions;
}

export function calculateDepositSharesAtomic(
  depositAmount: bigint,
  totalShares: bigint,
  totalAssets: bigint,
): bigint {
  requirePositive(depositAmount, 'depositAmount');
  if (totalShares === 0n) {
    if (totalAssets !== 0n) throw new Error('Zero share supply requires zero assets.');
    return depositAmount;
  }
  requirePositive(totalAssets, 'totalAssets');
  return (depositAmount * totalShares) / totalAssets;
}

export function calculateRedemptionAssetsAtomic(
  shares: bigint,
  totalShares: bigint,
  totalAssets: bigint,
): bigint {
  requirePositive(shares, 'shares');
  requirePositive(totalShares, 'totalShares');
  if (shares > totalShares) throw new Error('Redemption shares exceed total shares.');
  if (totalAssets < 0n) throw new Error('totalAssets cannot be negative.');
  return (shares * totalAssets) / totalShares;
}

export function buildThesisNavCheckpoint(
  epoch: bigint,
  observedAt: bigint,
  components: ThesisNavComponentsAtomic,
): ThesisNavCheckpointPayload {
  requirePositive(epoch, 'epoch');
  requirePositive(observedAt, 'observedAt');
  const totalAssets = calculateThesisNavAtomic(components);
  const canonical = [
    epoch,
    observedAt,
    components.accountingLiquidAssets,
    components.defiAssets,
    components.predictionAssets,
    components.resolvedUnclaimedAssets,
    components.accruedFees,
    components.liabilities,
    totalAssets,
  ].map((value) => value.toString()).join('|');
  return {
    ...components,
    epoch,
    observedAt,
    totalAssets,
    contentHash: Uint8Array.from(createHash('sha256').update(canonical).digest()),
  };
}

export function serializeThesisNavCheckpoint(checkpoint: ThesisNavCheckpointPayload) {
  return {
    epoch: checkpoint.epoch.toString(),
    observedAt: checkpoint.observedAt.toString(),
    accountingLiquidAssets: checkpoint.accountingLiquidAssets.toString(),
    defiAssets: checkpoint.defiAssets.toString(),
    predictionAssets: checkpoint.predictionAssets.toString(),
    resolvedUnclaimedAssets: checkpoint.resolvedUnclaimedAssets.toString(),
    accruedFees: checkpoint.accruedFees.toString(),
    liabilities: checkpoint.liabilities.toString(),
    totalAssets: checkpoint.totalAssets.toString(),
    contentHashHex: Buffer.from(checkpoint.contentHash).toString('hex'),
  };
}

function requirePositive(value: bigint, name: string): void {
  if (value <= 0n) throw new Error(`${name} must be greater than zero.`);
}
