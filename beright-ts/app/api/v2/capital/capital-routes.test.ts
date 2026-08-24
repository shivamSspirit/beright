import { NextRequest } from 'next/server';
import { Connection, Keypair, Transaction } from '@solana/web3.js';
import { GET as getEligibility } from './eligibility/route';
import { GET as getPositions } from './positions/[wallet]/route';
import { POST as simulate } from './simulate/route';
import { GET as getYieldRate } from './yield-rates/route';
import { POST as routeCapital } from './route/route';
import { GET as getStrategies } from './strategies/route';
import { POST as prepareJupiter } from './strategies/jupiter/prepare/route';
import { GET as getThesisVault } from './thesis-vault/route';
import { GET as listTheses } from './theses/route';
import {
  capitalMetadataHash,
  capitalThesisId,
  createCapitalThesis,
  prepareCreateVaultTransaction,
  resetThesisLedgerForTests,
} from '@/lib/capital';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function testEligibilityRoute(): Promise<void> {
  const response = await getEligibility(new NextRequest('http://localhost/api/v2/capital/eligibility?side=YES'));
  const payload = await response.json();
  assert(response.status === 200, `Eligibility route returned ${response.status}.`);
  assert(payload.data.eligibility.status === 'eligible', 'Expected the demo market to be eligible.');
  assert(payload.meta.custody === false, 'The legacy simulator must remain non-custodial.');
}

async function testSimulationRoute(): Promise<void> {
  const response = await simulate(new NextRequest('http://localhost/api/v2/capital/simulate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ side: 'YES', shares: 100, opposingAvailableShares: 80, holdingDays: 30 }),
  }));
  const payload = await response.json();
  assert(response.status === 200, `Simulation route returned ${response.status}: ${payload.error ?? ''}`);
  assert(payload.data.simulation.matchedShares === 80, 'Simulation must cap matching at opposite-side capacity.');
  assert(payload.meta.executable === false, 'Legacy simulation must never be executable.');
}

async function testRateRoute(): Promise<void> {
  const response = await getYieldRate(new NextRequest('http://localhost/api/v2/capital/yield-rates'));
  const payload = await response.json();
  assert(response.status === 200, `Yield-rate route returned ${response.status}.`);
  assert(payload.data.source === 'demo_model', 'Demo mode must label the rate as modeled.');
}

async function testPositionRoute(): Promise<void> {
  const wallet = '11111111111111111111111111111111';
  const response = await getPositions(new NextRequest(`http://localhost/api/v2/capital/positions/${wallet}`), {
    params: Promise.resolve({ wallet }),
  });
  const payload = await response.json();
  assert(response.status === 200, `Positions route returned ${response.status}.`);
  assert(payload.data.length === 1, 'Expected one read-only demo position.');
  assert(payload.meta.custody === false, 'Legacy positions must remain non-custodial.');
}

async function testRoutingRoute(): Promise<void> {
  const response = await routeCapital(new NextRequest('http://localhost/api/v2/capital/route', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ side: 'YES', shares: 100, opposingAvailableShares: 80, holdingDays: 30 }),
  }));
  const payload = await response.json();
  assert(response.status === 200, `Routing route returned ${response.status}.`);
  assert(payload.data.recommendation.action === 'match_for_yield', 'Expected yield routing.');
  assert(payload.meta.aiControlsCustody === false, 'AI must never control custody.');
  assert(payload.meta.executable === false, 'Legacy routing must remain recommendation-only.');
}

async function testStrategyBoundaryRoutes(): Promise<void> {
  const strategyResponse = await getStrategies();
  const strategyPayload = await strategyResponse.json();
  assert(strategyResponse.status === 200, 'Strategy registry must be readable.');
  assert(strategyPayload.meta.serverCanSign === false, 'The strategy API must never sign.');
  assert(strategyPayload.meta.borrowedPrincipalIsYield === false, 'Borrowed principal must not be labeled yield.');
  assert(strategyPayload.meta.matchedPairRedemption.supported === false, 'DFlow redemption must remain capability-gated.');

  const previous = process.env.CAPITAL_STRATEGY_PREPARE_ENABLED;
  process.env.CAPITAL_STRATEGY_PREPARE_ENABLED = 'false';
  const response = await prepareJupiter(new NextRequest('http://localhost', { method: 'POST' }));
  const payload = await response.json();
  assert(response.status === 503, 'Disabled preparation must fail closed.');
  assert(payload.code === 'STRATEGY_PREPARATION_DISABLED', 'Expected a stable gate error code.');
  if (previous === undefined) delete process.env.CAPITAL_STRATEGY_PREPARE_ENABLED;
  else process.env.CAPITAL_STRATEGY_PREPARE_ENABLED = previous;
}

async function testThesisVaultBlueprintRoute(): Promise<void> {
  const response = await getThesisVault();
  const payload = await response.json();
  assert(response.status === 200, 'Thesis-vault blueprint must be readable.');
  assert(payload.data.executionMode === 'onchain', 'Vault custody must be labeled on-chain.');
  assert(payload.meta.predictionExecution === 'external_adapter_required', 'Prediction execution must fail closed.');
  assert(payload.meta.defiExecution === 'external_adapter_required', 'DeFi execution must fail closed.');
  assert(payload.meta.deployableWithRealValue === false, 'The unaudited vault must reject real-value claims.');
}

async function testWalletSignedVaultPreparation(): Promise<void> {
  resetThesisLedgerForTests();
  const listResponse = await listTheses(new NextRequest('http://localhost/api/v2/capital/theses'));
  const listPayload = await listResponse.json();
  assert(listPayload.data.length === 0, 'The marketplace must not seed fake funded vaults.');
  assert(listPayload.meta.executionMode === 'onchain', 'Marketplace must label on-chain execution.');

  const creator = Keypair.generate().publicKey.toBase58();
  const thesis = createCapitalThesis({
    name: 'Open Solana Adoption Vault',
    symbol: 'brOPEN',
    thesisStatement: 'Solana adoption exposure should remain available through a transparent open-ended vault with explicit risk terms.',
    creatorMotivation: 'I want investors to inspect an ongoing strategy before choosing to fund it on Solana devnet.',
    failureConditions: 'The strategy should close if its risk or liquidity rules can no longer support fair redemption accounting.',
    creatorWallet: creator,
    vaultType: 'curated',
    vaultStructure: 'open_ended',
    categories: ['crypto'],
    allowedDefiProtocols: [],
    marketRules: [{ label: 'Solana adoption activity grows', category: 'crypto', targetBps: 500 }],
    predictionAllocationMaxBps: 2_500,
    defiAllocationTargetBps: 6_500,
    liquidReserveTargetBps: 1_000,
    maxMarketAllocationBps: 500,
    maxDrawdownBps: 1_200,
    curatorFeeBps: 150,
    protocolFeeBps: 50,
    maxActivePositions: 5,
    depositCapUsdc: '50000',
    lockupSeconds: 604_800,
  });
  assert(thesis.onchainStatus === 'pending_signature', 'Metadata must remain pending before wallet confirmation.');
  assert(thesis.totalAssetsAtomic === '0', 'Open-ended vaults must begin at zero AUM.');
  assert(thesis.lockupSeconds === 604_800, 'The program lockup must match the reviewed terms.');

  const mockConnection = {
    getLatestBlockhash: async () => ({ blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 1 }),
  } as Connection;
  const prepared = await prepareCreateVaultTransaction({
    creator,
    thesisId: capitalThesisId(thesis),
    metadataHash: capitalMetadataHash({ id: thesis.id, slug: thesis.slug }),
    metadataUri: `https://beright.xyz/capital/${thesis.slug}`,
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
    expiryUnix: 0n,
    lockupSeconds: thesis.lockupSeconds,
    depositCapAtomic: BigInt(thesis.depositCapAtomic),
    graduationThresholdAtomic: 0n,
    perWalletQualifyingCapAtomic: 0n,
    minimumUniqueContributors: 0,
  }, mockConnection);
  const transaction = Transaction.from(Buffer.from(prepared.transaction, 'base64'));
  assert(prepared.requiresWalletSignature, 'Prepared vault creation must require the creator signature.');
  assert(!prepared.serverSigned && !prepared.serverSubmits, 'The server must not sign or submit.');
  assert(transaction.instructions.length === 2, 'Creation must atomically create the thesis and initialize its vault.');
}

const tests: Array<[string, () => Promise<void>]> = [
  ['eligibility API', testEligibilityRoute],
  ['simulation API', testSimulationRoute],
  ['yield-rate API', testRateRoute],
  ['positions API', testPositionRoute],
  ['deterministic routing API', testRoutingRoute],
  ['external strategy safety boundary', testStrategyBoundaryRoutes],
  ['devnet thesis-vault blueprint', testThesisVaultBlueprintRoute],
  ['wallet-signed vault preparation', testWalletSignedVaultPreparation],
];

async function main(): Promise<void> {
  for (const [name, test] of tests) {
    await test();
    console.log(`✓ ${name}`);
  }
}

void main();
