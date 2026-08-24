import { createHash, randomUUID } from 'node:crypto';
import {
  calculateDepositSharesAtomic,
  calculateRedemptionAssetsAtomic,
  type ThesisBlueprint,
  validateThesisBlueprint,
} from './thesisVault';
import {
  capitalMetadataHash,
  deriveCapitalOnchainAddresses,
  fetchCapitalOnchainSnapshot,
  type CapitalOnchainAddresses,
  type CapitalOnchainSnapshot,
} from './onchainTransactions';
import { PublicKey } from '@solana/web3.js';

const USDC_DECIMALS = 6n;
const USDC_SCALE = 10n ** USDC_DECIMALS;
const WALLET_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MAX_DEVNET_DEPOSIT_ATOMIC = 10_000n * USDC_SCALE;
const MAX_DEVNET_WALLET_BALANCE_ATOMIC = 25_000n * USDC_SCALE;

export type ThesisLifecycleStatus = 'funding' | 'dormant' | 'active' | 'paused' | 'expired' | 'closed';

export interface ThesisMarketRule {
  label: string;
  category: string;
  targetBps: number;
}

export interface CapitalThesis extends ThesisBlueprint {
  id: string;
  slug: string;
  thesisStatement: string;
  creatorMotivation: string;
  failureConditions: string;
  creatorWallet: string;
  creatorDisplayName: string;
  curatorWallet: string;
  categories: string[];
  allowedDefiProtocols: string[];
  marketRules: ThesisMarketRule[];
  metadataUri: string | null;
  status: ThesisLifecycleStatus;
  launchMessage: string;
  createdAt: string;
  approvedAt: string | null;
  graduatedAt: string | null;
  totalAssetsAtomic: string;
  totalSharesAtomic: string;
  pendingRedemptionSharesAtomic: string;
  depositCapAtomic: string;
  graduationThresholdAtomic: string;
  qualifyingCapitalAtomic: string;
  perWalletQualifyingCapAtomic: string;
  minimumUniqueContributors: number;
  uniqueContributors: number;
  fundingYieldEnabled: boolean;
  fundingYieldAdapter: 'disabled';
  fundingYieldTargetBps: number;
  fundingIdlePrincipalAtomic: string;
  fundingIdleAssetsAtomic: string;
  fundingLiquidAssetsAtomic: string;
  queuedFundingWithdrawalAssetsAtomic: string;
  indicativeFundingApyPct: number;
  navUpdatedAt: string;
  indicativeDefiApyPct: number;
  predictionReturnPct: number;
  historicalReturnPct: number;
  investorCount: number;
  lockupSeconds: number;
  onchainStatus: 'pending_signature' | 'confirmed';
  onchainAddresses: CapitalOnchainAddresses;
  creationSignature: string | null;
  accruedFeesAtomic: string;
  accruedCuratorFeesAtomic: string;
  accruedProtocolFeesAtomic: string;
  accountingLiquidAssetsAtomic: string;
  strategyExecution: 'external_adapter_required';
}

export interface CreateCapitalThesisInput {
  name: string;
  symbol: string;
  thesisStatement: string;
  creatorMotivation: string;
  failureConditions: string;
  creatorWallet: string;
  creatorDisplayName?: string;
  vaultType: 'index' | 'curated';
  vaultStructure?: 'closed_ended' | 'open_ended';
  categories: string[];
  allowedDefiProtocols: string[];
  marketRules: ThesisMarketRule[];
  predictionAllocationMaxBps: number;
  defiAllocationTargetBps: number;
  liquidReserveTargetBps: number;
  maxMarketAllocationBps: number;
  maxDrawdownBps: number;
  curatorFeeBps: number;
  protocolFeeBps: number;
  maxActivePositions: number;
  expiry?: string;
  depositCapUsdc: string;
  graduationThresholdUsdc?: string;
  minimumUniqueContributors?: number;
  fundingYieldEnabled?: boolean;
  metadataUri?: string;
  lockupSeconds?: number;
}

export interface ThesisDepositQuote {
  thesisSlug: string;
  depositAmountAtomic: string;
  sharesAtomic: string;
  sharePriceUsd: number;
  estimatedAnnualDefiIncomeUsd: number;
  predictionOutcomeNotGuaranteed: true;
  network: 'devnet';
  executionMode: 'onchain';
}

export interface ThesisInvestorPosition {
  wallet: string;
  thesisSlug: string;
  thesisName: string;
  symbol: string;
  sharesAtomic: string;
  principalAtomic: string;
  currentValueAtomic: string;
  unrealizedPnlAtomic: string;
  pendingRedemptionSharesAtomic: string;
  pendingRedemptionAssetsAtomic: string;
  nextSettlementAt: string | null;
  updatedAt: string;
}

interface LedgerPosition {
  wallet: string;
  thesisSlug: string;
  sharesAtomic: bigint;
  principalAtomic: bigint;
  pendingRedemptionSharesAtomic: bigint;
  pendingRedemptionAssetsAtomic: bigint;
  nextSettlementAt: string | null;
  updatedAt: string;
}

interface ThesisLedgerState {
  theses: Map<string, CapitalThesis>;
  positions: Map<string, LedgerPosition>;
}

declare global {
  // eslint-disable-next-line no-var
  var __berightCapitalThesisLedger: ThesisLedgerState | undefined;
}

function getState(): ThesisLedgerState {
  if (!globalThis.__berightCapitalThesisLedger) {
    globalThis.__berightCapitalThesisLedger = {
      theses: new Map(),
      positions: new Map(),
    };
  }
  return globalThis.__berightCapitalThesisLedger;
}

export function resetThesisLedgerForTests(): void {
  globalThis.__berightCapitalThesisLedger = undefined;
}

export function listCapitalTheses(options: { creatorWallet?: string; includePending?: boolean } = {}): CapitalThesis[] {
  const { creatorWallet, includePending = false } = options;
  return [...getState().theses.values()]
    .filter((thesis) => !creatorWallet || thesis.creatorWallet === creatorWallet)
    .filter((thesis) => includePending || thesis.onchainStatus === 'confirmed')
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getCapitalThesis(slug: string): CapitalThesis | null {
  return getState().theses.get(slug) ?? null;
}

export function createCapitalThesis(input: CreateCapitalThesisInput): CapitalThesis {
  validateCreateInput(input);
  const vaultStructure = input.vaultStructure ?? 'closed_ended';
  const minimumUniqueContributors = vaultStructure === 'closed_ended'
    ? input.minimumUniqueContributors ?? 0
    : 0;
  const graduationThresholdAtomic = vaultStructure === 'closed_ended'
    ? parseUsdcAtomic(input.graduationThresholdUsdc ?? '', 'graduationThresholdUsdc')
    : 0n;
  const blueprint: ThesisBlueprint = {
    name: input.name.trim(),
    symbol: input.symbol.trim(),
    network: 'devnet',
    vaultType: input.vaultType,
    vaultStructure,
    depositAsset: 'USDC',
    predictionAllocationMaxBps: input.predictionAllocationMaxBps,
    defiAllocationTargetBps: input.defiAllocationTargetBps,
    liquidReserveTargetBps: input.liquidReserveTargetBps,
    maxMarketAllocationBps: input.maxMarketAllocationBps,
    maxDrawdownBps: input.maxDrawdownBps,
    curatorFeeBps: input.curatorFeeBps,
    protocolFeeBps: input.protocolFeeBps,
    maxActivePositions: input.maxActivePositions,
    expiry: input.expiry ? new Date(input.expiry).toISOString() : null,
    executionMode: 'onchain',
    shareStandard: 'token-2022-non-transferable',
  };
  validateThesisBlueprint(blueprint);

  const now = new Date().toISOString();
  const id = randomUUID();
  const slug = uniqueSlug(input.name, id);
  const thesisId = capitalMetadataHash({ id });
  const onchainAddresses = deriveCapitalOnchainAddresses(
    new PublicKey(input.creatorWallet),
    thesisId,
  );
  const thesis: CapitalThesis = {
    ...blueprint,
    id,
    slug,
    thesisStatement: input.thesisStatement.trim(),
    creatorMotivation: input.creatorMotivation.trim(),
    failureConditions: input.failureConditions.trim(),
    creatorWallet: input.creatorWallet,
    creatorDisplayName: input.creatorDisplayName?.trim() || shortWallet(input.creatorWallet),
    curatorWallet: input.creatorWallet,
    categories: uniqueStrings(input.categories),
    allowedDefiProtocols: uniqueStrings(input.allowedDefiProtocols),
    marketRules: input.marketRules.map((rule) => ({
      label: rule.label.trim(),
      category: rule.category.trim().toLowerCase(),
      targetBps: rule.targetBps,
    })),
    metadataUri: input.metadataUri?.trim() || null,
    status: vaultStructure === 'open_ended' ? 'dormant' : 'funding',
    launchMessage: vaultStructure === 'open_ended'
      ? 'Wallet-signed devnet deposits are available. External strategy execution remains disabled.'
      : 'Wallet-signed devnet funding is open. External strategy execution remains locked behind an audited adapter.',
    createdAt: now,
    approvedAt: null,
    graduatedAt: null,
    totalAssetsAtomic: '0',
    totalSharesAtomic: '0',
    pendingRedemptionSharesAtomic: '0',
    depositCapAtomic: parseUsdcAtomic(input.depositCapUsdc, 'depositCapUsdc').toString(),
    graduationThresholdAtomic: graduationThresholdAtomic.toString(),
    qualifyingCapitalAtomic: '0',
    perWalletQualifyingCapAtomic: vaultStructure === 'closed_ended'
      ? (graduationThresholdAtomic / BigInt(minimumUniqueContributors)).toString()
      : '0',
    minimumUniqueContributors,
    uniqueContributors: 0,
    fundingYieldEnabled: false,
    fundingYieldAdapter: 'disabled',
    fundingYieldTargetBps: 0,
    fundingIdlePrincipalAtomic: '0',
    fundingIdleAssetsAtomic: '0',
    fundingLiquidAssetsAtomic: '0',
    queuedFundingWithdrawalAssetsAtomic: '0',
    indicativeFundingApyPct: 0,
    navUpdatedAt: now,
    indicativeDefiApyPct: 0,
    predictionReturnPct: 0,
    historicalReturnPct: 0,
    investorCount: 0,
    lockupSeconds: input.lockupSeconds ?? 0,
    onchainStatus: 'pending_signature',
    onchainAddresses,
    creationSignature: null,
    accruedFeesAtomic: '0',
    accruedCuratorFeesAtomic: '0',
    accruedProtocolFeesAtomic: '0',
    accountingLiquidAssetsAtomic: '0',
    strategyExecution: 'external_adapter_required',
  };
  getState().theses.set(slug, thesis);
  return thesis;
}

export function capitalThesisId(thesis: CapitalThesis): Uint8Array {
  return capitalMetadataHash({ id: thesis.id });
}

export async function confirmCapitalThesis(
  slug: string,
  signature: string,
): Promise<CapitalThesis> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) {
    throw new Error('A valid Solana transaction signature is required.');
  }
  const thesis = getCapitalThesis(slug);
  if (!thesis) throw new Error('Thesis not found.');
  const snapshot = await fetchCapitalOnchainSnapshot(thesis.onchainAddresses);
  thesis.onchainStatus = 'confirmed';
  thesis.creationSignature = signature;
  applyOnchainSnapshot(thesis, snapshot);
  return thesis;
}

export async function refreshCapitalThesis(slug: string): Promise<CapitalThesis | null> {
  const thesis = getCapitalThesis(slug);
  if (!thesis || thesis.onchainStatus !== 'confirmed') return thesis;
  applyOnchainSnapshot(thesis, await fetchCapitalOnchainSnapshot(thesis.onchainAddresses));
  return thesis;
}

export async function getCapitalPortfolioOnchain(wallet: string): Promise<ThesisInvestorPosition[]> {
  validateWallet(wallet);
  const confirmed = listCapitalTheses({ includePending: false });
  const snapshots = await Promise.all(confirmed.map(async (thesis) => ({
    thesis,
    snapshot: await fetchCapitalOnchainSnapshot(thesis.onchainAddresses, wallet),
  })));
  return snapshots.flatMap(({ thesis, snapshot }) => {
    const contributor = snapshot.contributor;
    if (!contributor || BigInt(contributor.ownedSharesAtomic) === 0n) return [];
    const shares = BigInt(contributor.ownedSharesAtomic);
    const totalShares = BigInt(snapshot.totalSharesAtomic);
    const totalAssets = BigInt(snapshot.totalAssetsAtomic);
    const value = totalShares === 0n ? 0n : shares * totalAssets / totalShares;
    const principal = BigInt(contributor.depositedAssetsAtomic);
    return [{
      wallet,
      thesisSlug: thesis.slug,
      thesisName: thesis.name,
      symbol: thesis.symbol,
      sharesAtomic: shares.toString(),
      principalAtomic: principal.toString(),
      currentValueAtomic: value.toString(),
      unrealizedPnlAtomic: (value - principal).toString(),
      pendingRedemptionSharesAtomic: '0',
      pendingRedemptionAssetsAtomic: '0',
      nextSettlementAt: null,
      updatedAt: thesis.navUpdatedAt,
    }];
  });
}

function applyOnchainSnapshot(thesis: CapitalThesis, snapshot: CapitalOnchainSnapshot): void {
  thesis.status = snapshot.status;
  thesis.totalAssetsAtomic = snapshot.totalAssetsAtomic;
  thesis.totalSharesAtomic = snapshot.totalSharesAtomic;
  thesis.pendingRedemptionSharesAtomic = snapshot.pendingRedemptionSharesAtomic;
  thesis.qualifyingCapitalAtomic = snapshot.qualifyingCapitalAtomic;
  thesis.uniqueContributors = snapshot.uniqueContributors;
  thesis.accountingLiquidAssetsAtomic = snapshot.accountingLiquidAssetsAtomic;
  thesis.accruedFeesAtomic = snapshot.accruedFeesAtomic;
  thesis.accruedCuratorFeesAtomic = snapshot.accruedCuratorFeesAtomic;
  thesis.accruedProtocolFeesAtomic = snapshot.accruedProtocolFeesAtomic;
  thesis.graduatedAt = snapshot.graduatedAt;
  thesis.navUpdatedAt = new Date().toISOString();
}

export function quoteCapitalThesisDeposit(slug: string, amountUsdc: string): ThesisDepositQuote {
  const thesis = requireDepositableThesis(slug);
  const amountAtomic = parseUsdcAtomic(amountUsdc, 'amountUsdc');
  if (amountAtomic > MAX_DEVNET_DEPOSIT_ATOMIC) {
    throw new Error('Devnet deposits are capped at 10,000 USDC per action.');
  }
  const totalAssets = BigInt(thesis.totalAssetsAtomic);
  const totalShares = BigInt(thesis.totalSharesAtomic);
  if (totalAssets + amountAtomic > BigInt(thesis.depositCapAtomic)) {
    throw new Error('This deposit would exceed the thesis deposit cap.');
  }
  const shares = thesis.vaultStructure === 'closed_ended' && thesis.status === 'funding' && !thesis.fundingYieldEnabled
    ? amountAtomic
    : calculateDepositSharesAtomic(amountAtomic, totalShares, totalAssets);
  if (shares <= 0n) throw new Error('Deposit is too small to mint a share.');
  const sharePriceUsd = totalShares === 0n ? 1 : Number(totalAssets) / Number(totalShares);
  return {
    thesisSlug: slug,
    depositAmountAtomic: amountAtomic.toString(),
    sharesAtomic: shares.toString(),
    sharePriceUsd,
    estimatedAnnualDefiIncomeUsd: (Number(amountAtomic) / Number(USDC_SCALE))
      * (thesis.defiAllocationTargetBps / 10_000)
      * (thesis.indicativeDefiApyPct / 100),
    predictionOutcomeNotGuaranteed: true,
    network: 'devnet',
    executionMode: 'onchain',
  };
}

export function depositCapitalThesis(slug: string, wallet: string, amountUsdc: string): ThesisInvestorPosition {
  validateWallet(wallet);
  const thesis = requireDepositableThesis(slug);
  const quote = quoteCapitalThesisDeposit(slug, amountUsdc);
  const amountAtomic = BigInt(quote.depositAmountAtomic);
  const sharesAtomic = BigInt(quote.sharesAtomic);
  const positionKey = `${wallet}:${slug}`;
  const previous = getState().positions.get(positionKey);
  const previousPrincipal = previous?.principalAtomic ?? 0n;
  if (previousPrincipal + amountAtomic > MAX_DEVNET_WALLET_BALANCE_ATOMIC) {
    throw new Error('A wallet can allocate at most 25,000 devnet USDC across this thesis.');
  }

  const now = new Date().toISOString();
  const next: LedgerPosition = {
    wallet,
    thesisSlug: slug,
    sharesAtomic: (previous?.sharesAtomic ?? 0n) + sharesAtomic,
    principalAtomic: previousPrincipal + amountAtomic,
    pendingRedemptionSharesAtomic: previous?.pendingRedemptionSharesAtomic ?? 0n,
    pendingRedemptionAssetsAtomic: previous?.pendingRedemptionAssetsAtomic ?? 0n,
    nextSettlementAt: previous?.nextSettlementAt ?? null,
    updatedAt: now,
  };
  getState().positions.set(positionKey, next);

  thesis.totalAssetsAtomic = (BigInt(thesis.totalAssetsAtomic) + amountAtomic).toString();
  thesis.totalSharesAtomic = (BigInt(thesis.totalSharesAtomic) + sharesAtomic).toString();
  if (!previous || previous.principalAtomic === 0n) {
    thesis.investorCount += 1;
    if (thesis.vaultStructure === 'closed_ended') thesis.uniqueContributors += 1;
  }
  if (thesis.status === 'funding') {
    if (thesis.fundingYieldEnabled) {
      const idleAllocation = amountAtomic * BigInt(thesis.fundingYieldTargetBps) / 10_000n;
      thesis.fundingIdlePrincipalAtomic = (BigInt(thesis.fundingIdlePrincipalAtomic) + idleAllocation).toString();
      thesis.fundingIdleAssetsAtomic = (BigInt(thesis.fundingIdleAssetsAtomic) + idleAllocation).toString();
      thesis.fundingLiquidAssetsAtomic = (BigInt(thesis.fundingLiquidAssetsAtomic) + amountAtomic - idleAllocation).toString();
    } else {
      thesis.fundingLiquidAssetsAtomic = (BigInt(thesis.fundingLiquidAssetsAtomic) + amountAtomic).toString();
    }
    const qualifyingCap = BigInt(thesis.perWalletQualifyingCapAtomic);
    const previousQualifying = previousPrincipal < qualifyingCap ? previousPrincipal : qualifyingCap;
    const nextPrincipal = previousPrincipal + amountAtomic;
    const nextQualifying = nextPrincipal < qualifyingCap ? nextPrincipal : qualifyingCap;
    thesis.qualifyingCapitalAtomic = (
      BigInt(thesis.qualifyingCapitalAtomic) + nextQualifying - previousQualifying
    ).toString();
    if (
      BigInt(thesis.qualifyingCapitalAtomic) >= BigInt(thesis.graduationThresholdAtomic)
      && thesis.uniqueContributors >= thesis.minimumUniqueContributors
    ) {
      thesis.status = 'active';
      thesis.graduatedAt = now;
      thesis.approvedAt = now;
      thesis.launchMessage = 'Automatically graduated. Strategy execution and checkpoint NAV accounting are now enabled.';
      thesis.indicativeDefiApyPct = 6;
    }
  } else if (thesis.vaultStructure === 'open_ended' && thesis.status === 'dormant') {
    thesis.status = 'active';
    thesis.approvedAt = now;
    thesis.launchMessage = 'Active open-ended vault. Deposits and redemptions remain available under the vault terms.';
  }
  thesis.navUpdatedAt = now;
  return serializePosition(next, thesis);
}

export function requestCapitalThesisRedemption(
  slug: string,
  wallet: string,
  shares: string,
): ThesisInvestorPosition {
  validateWallet(wallet);
  const thesis = getCapitalThesis(slug);
  if (!thesis) throw new Error('Thesis not found.');
  const positionKey = `${wallet}:${slug}`;
  const position = getState().positions.get(positionKey);
  if (!position) throw new Error('No thesis shares were found for this wallet.');
  if (position.pendingRedemptionSharesAtomic > 0n) {
    throw new Error('This wallet already has a redemption waiting for settlement.');
  }
  const sharesAtomic = parseTokenAtomic(shares, 'shares');
  if (sharesAtomic > position.sharesAtomic) throw new Error('Redemption exceeds the available shares.');
  const totalShares = BigInt(thesis.totalSharesAtomic);
  const totalAssets = BigInt(thesis.totalAssetsAtomic);
  const assetsAtomic = calculateRedemptionAssetsAtomic(sharesAtomic, totalShares, totalAssets);

  if (thesis.status === 'funding') {
    const qualifyingCap = BigInt(thesis.perWalletQualifyingCapAtomic);
    const previousPrincipal = position.principalAtomic;
    const principalReduction = sharesAtomic === position.sharesAtomic
      ? previousPrincipal
      : sharesAtomic * previousPrincipal / position.sharesAtomic;
    const nextPrincipal = previousPrincipal - principalReduction;
    const previousQualifying = previousPrincipal < qualifyingCap ? previousPrincipal : qualifyingCap;
    const nextQualifying = nextPrincipal < qualifyingCap ? nextPrincipal : qualifyingCap;
    position.sharesAtomic -= sharesAtomic;
    position.principalAtomic = nextPrincipal;
    position.updatedAt = new Date().toISOString();
    thesis.qualifyingCapitalAtomic = (
      BigInt(thesis.qualifyingCapitalAtomic) - (previousQualifying - nextQualifying)
    ).toString();
    if (nextPrincipal === 0n) {
      thesis.investorCount -= 1;
      thesis.uniqueContributors -= 1;
    }
    const liquidAssets = BigInt(thesis.fundingLiquidAssetsAtomic);
    if (assetsAtomic <= liquidAssets) {
      thesis.totalAssetsAtomic = (totalAssets - assetsAtomic).toString();
      thesis.totalSharesAtomic = (totalShares - sharesAtomic).toString();
      thesis.fundingLiquidAssetsAtomic = (liquidAssets - assetsAtomic).toString();
    } else {
      position.pendingRedemptionSharesAtomic = sharesAtomic;
      position.pendingRedemptionAssetsAtomic = assetsAtomic;
      position.nextSettlementAt = nextDailySettlement().toISOString();
      thesis.pendingRedemptionSharesAtomic = (BigInt(thesis.pendingRedemptionSharesAtomic) + sharesAtomic).toString();
      thesis.queuedFundingWithdrawalAssetsAtomic = (BigInt(thesis.queuedFundingWithdrawalAssetsAtomic) + assetsAtomic).toString();
    }
    thesis.navUpdatedAt = position.updatedAt;
    return serializePosition(position, thesis);
  }

  position.sharesAtomic -= sharesAtomic;
  position.pendingRedemptionSharesAtomic = sharesAtomic;
  position.pendingRedemptionAssetsAtomic = assetsAtomic;
  position.nextSettlementAt = nextWeeklySettlement().toISOString();
  position.updatedAt = new Date().toISOString();
  thesis.pendingRedemptionSharesAtomic = (
    BigInt(thesis.pendingRedemptionSharesAtomic) + sharesAtomic
  ).toString();
  return serializePosition(position, thesis);
}

export function getCapitalPortfolio(wallet: string): ThesisInvestorPosition[] {
  validateWallet(wallet);
  return [...getState().positions.values()]
    .filter((position) => position.wallet === wallet)
    .map((position) => {
      const thesis = getCapitalThesis(position.thesisSlug);
      if (!thesis) throw new Error('Portfolio references a missing thesis.');
      return serializePosition(position, thesis);
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function serializePosition(position: LedgerPosition, thesis: CapitalThesis): ThesisInvestorPosition {
  const totalShares = BigInt(thesis.totalSharesAtomic);
  const totalAssets = BigInt(thesis.totalAssetsAtomic);
  const liquidShareValue = totalShares === 0n || position.sharesAtomic === 0n
    ? 0n
    : calculateRedemptionAssetsAtomic(position.sharesAtomic, totalShares, totalAssets);
  const currentValue = liquidShareValue + position.pendingRedemptionAssetsAtomic;
  return {
    wallet: position.wallet,
    thesisSlug: thesis.slug,
    thesisName: thesis.name,
    symbol: thesis.symbol,
    sharesAtomic: position.sharesAtomic.toString(),
    principalAtomic: position.principalAtomic.toString(),
    currentValueAtomic: currentValue.toString(),
    unrealizedPnlAtomic: (currentValue - position.principalAtomic).toString(),
    pendingRedemptionSharesAtomic: position.pendingRedemptionSharesAtomic.toString(),
    pendingRedemptionAssetsAtomic: position.pendingRedemptionAssetsAtomic.toString(),
    nextSettlementAt: position.nextSettlementAt,
    updatedAt: position.updatedAt,
  };
}

function validateCreateInput(input: CreateCapitalThesisInput): void {
  validateWallet(input.creatorWallet);
  if (input.name.trim().length < 4 || input.name.trim().length > 80) {
    throw new Error('Thesis name must contain 4–80 characters.');
  }
  if (!/^[A-Za-z][A-Za-z0-9-]{2,9}$/.test(input.symbol.trim())) {
    throw new Error('Share symbol must contain 3–10 letters, numbers, or hyphens.');
  }
  if (input.thesisStatement.trim().length < 40 || input.thesisStatement.trim().length > 600) {
    throw new Error('Thesis statement must contain 40–600 characters.');
  }
  if (input.creatorMotivation.trim().length < 20 || input.creatorMotivation.trim().length > 400) {
    throw new Error('Creator motivation must contain 20–400 characters.');
  }
  if (input.failureConditions.trim().length < 20 || input.failureConditions.trim().length > 400) {
    throw new Error('Failure conditions must contain 20–400 characters.');
  }
  if (uniqueStrings(input.categories).length < 1 || uniqueStrings(input.categories).length > 5) {
    throw new Error('Choose 1–5 market categories.');
  }
  if (uniqueStrings(input.allowedDefiProtocols).length > 3) {
    throw new Error('Choose no more than 3 proposed DeFi strategies.');
  }
  if (input.marketRules.length < 1 || input.marketRules.length > input.maxActivePositions) {
    throw new Error('Market rules must fit within the active-position limit.');
  }
  if (input.marketRules.some((rule) => !rule.label.trim() || !rule.category.trim())) {
    throw new Error('Every market rule needs a label and category.');
  }
  if (input.marketRules.some((rule) => rule.targetBps <= 0 || rule.targetBps > input.maxMarketAllocationBps)) {
    throw new Error('Every market target must fit within the per-market allocation limit.');
  }
  const vaultStructure = input.vaultStructure ?? 'closed_ended';
  if (vaultStructure === 'closed_ended' || input.expiry) {
    const expiry = new Date(input.expiry ?? '');
    const minimumExpiry = Date.now() + 30 * 24 * 60 * 60 * 1_000;
    if (Number.isNaN(expiry.getTime()) || expiry.getTime() < minimumExpiry) {
      throw new Error('Thesis expiry must be at least 30 days away.');
    }
  }
  if (input.maxDrawdownBps < 100 || input.maxDrawdownBps > 5_000) {
    throw new Error('Maximum drawdown must be between 1% and 50%.');
  }
  if (input.curatorFeeBps < 0 || input.curatorFeeBps > 2_000) {
    throw new Error('Curator fee cannot exceed 20%.');
  }
  if (input.protocolFeeBps < 0 || input.protocolFeeBps > 1_000) {
    throw new Error('Protocol fee cannot exceed 10%.');
  }
  const allocationTotal = input.predictionAllocationMaxBps
    + input.defiAllocationTargetBps
    + input.liquidReserveTargetBps;
  if (allocationTotal !== 10_000) throw new Error('Prediction, DeFi, and reserve allocations must equal 100%.');
  const marketTargetTotal = input.marketRules.reduce((total, rule) => total + rule.targetBps, 0);
  if (marketTargetTotal > input.predictionAllocationMaxBps) {
    throw new Error('Market targets exceed the thesis prediction allocation.');
  }
  const depositCap = parseUsdcAtomic(input.depositCapUsdc, 'depositCapUsdc');
  if (depositCap < 1_000n * USDC_SCALE || depositCap > 1_000_000n * USDC_SCALE) {
    throw new Error('Deposit cap must be between 1,000 and 1,000,000 USDC.');
  }
  if (vaultStructure === 'closed_ended') {
    const graduationThreshold = parseUsdcAtomic(input.graduationThresholdUsdc ?? '', 'graduationThresholdUsdc');
    if (graduationThreshold < 1_000n * USDC_SCALE || graduationThreshold > depositCap) {
      throw new Error('Graduation threshold must be at least 1,000 USDC and no greater than the deposit cap.');
    }
    if (!Number.isInteger(input.minimumUniqueContributors)
      || (input.minimumUniqueContributors ?? 0) < 2
      || (input.minimumUniqueContributors ?? 0) > 100) {
      throw new Error('Minimum unique contributors must be an integer from 2 to 100.');
    }
  }
  if (input.fundingYieldEnabled) {
    throw new Error('Funding-yield execution is disabled until an audited PDA-compatible adapter is deployed.');
  }
  if (!Number.isInteger(input.lockupSeconds ?? 0)
    || (input.lockupSeconds ?? 0) < 0
    || (input.lockupSeconds ?? 0) > 31_536_000) {
    throw new Error('Lockup must be an integer from 0 seconds to 365 days.');
  }
  if (input.metadataUri && !/^https:\/\//i.test(input.metadataUri.trim())) {
    throw new Error('Metadata URI must use HTTPS.');
  }
}

function requireDepositableThesis(slug: string): CapitalThesis {
  const thesis = getCapitalThesis(slug);
  if (!thesis) throw new Error('Thesis not found.');
  const acceptsDeposits = thesis.vaultStructure === 'closed_ended'
    ? thesis.status === 'funding'
    : thesis.status === 'dormant' || thesis.status === 'active';
  if (!acceptsDeposits) throw new Error('This thesis is not accepting deposits.');
  if (thesis.expiry && new Date(thesis.expiry).getTime() <= Date.now()) throw new Error('This thesis has expired.');
  return thesis;
}

function validateWallet(wallet: string): void {
  if (!WALLET_PATTERN.test(wallet)) throw new Error('A valid Solana wallet address is required.');
}

function parseUsdcAtomic(value: string, name: string): bigint {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(normalized)) {
    throw new Error(`${name} must be a positive USDC amount with up to 6 decimals.`);
  }
  const [whole = '0', fraction = ''] = normalized.split('.');
  const atomic = BigInt(whole) * USDC_SCALE + BigInt(fraction.padEnd(6, '0'));
  if (atomic <= 0n) throw new Error(`${name} must be greater than zero.`);
  return atomic;
}

function parseTokenAtomic(value: string, name: string): bigint {
  return parseUsdcAtomic(value, name);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueSlug(name: string, id: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'thesis';
  const digest = createHash('sha256').update(id).digest('hex').slice(0, 6);
  return `${base}-${digest}`;
}

function shortWallet(wallet: string): string {
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}

function nextWeeklySettlement(): Date {
  const date = new Date();
  const daysUntilMonday = (8 - date.getUTCDay()) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + daysUntilMonday);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function nextDailySettlement(): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}
