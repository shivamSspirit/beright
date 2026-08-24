import { evaluateCapitalEligibility } from './eligibility';
import { getCapitalDemoMarket } from './demo';
import { normalizeProbabilityPrice } from './riskPrice';
import { simulateMatchedPairYield } from './simulator';
import { recommendCapitalRoute } from './router';
import {
  deriveAgentIntentPda,
  deriveCapitalConfigPda,
  deriveCapitalMarketPda,
  deriveCapitalPositionPda,
  deriveSimulatedPositionPda,
  deriveThesisPda,
  deriveThesisRedemptionPda,
  deriveThesisShareMintPda,
  deriveThesisVaultPda,
} from './solana';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import {
  JUPITER_LEND_PROGRAM_ID,
  validateJupiterEarnInstructions,
} from './jupiterEarn';
import { getCapitalStrategyProviders } from './strategyProviders';
import {
  buildThesisNavCheckpoint,
  calculateDepositSharesAtomic,
  calculateRedemptionAssetsAtomic,
  createSolanaGrowthDevnetBlueprint,
  validateThesisBlueprint,
} from './thesisVault';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function approximatelyEqual(actual: number, expected: number, tolerance = 0.000001): void {
  assert(Math.abs(actual - expected) <= tolerance, `Expected ${expected}, received ${actual}.`);
}

function assertThrows(run: () => void, expectedMessage: string): void {
  try {
    run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(message.includes(expectedMessage), `Expected error containing "${expectedMessage}", received "${message}".`);
    return;
  }
  throw new Error(`Expected function to throw "${expectedMessage}".`);
}

function testPriceNormalization(): void {
  approximatelyEqual(normalizeProbabilityPrice('0.61') ?? 0, 0.61);
  approximatelyEqual(normalizeProbabilityPrice('61') ?? 0, 0.61);
  approximatelyEqual(normalizeProbabilityPrice('6100') ?? 0, 0.61);
  assert(normalizeProbabilityPrice('0') === null, 'Zero must not become a risk price.');
}

function testEligibleDemoMarket(): void {
  const now = new Date('2026-08-11T00:00:00.000Z');
  const { market, orderbook } = getCapitalDemoMarket('YES', now);
  const result = evaluateCapitalEligibility(market, orderbook, undefined, now);
  assert(result.status === 'eligible', `Expected eligible, received ${result.status}.`);
  approximatelyEqual(result.riskPrice.price ?? 0, 0.61);
  assert((result.riskPrice.availableDepthUsd ?? 0) > 1_000, 'Expected adequate executable depth.');
}

function testMissingBidBlocksEligibility(): void {
  const now = new Date('2026-08-11T00:00:00.000Z');
  const { market, orderbook } = getCapitalDemoMarket('YES', now);
  market.bid = null;
  orderbook.yesBids = {};
  const result = evaluateCapitalEligibility(market, orderbook, undefined, now);
  assert(result.status === 'ineligible', 'Missing executable bid must block eligibility.');
  assert(
    result.reasons.some((reason) => reason.code === 'executable_bid_unavailable'),
    'Expected the executable-bid reason.'
  );
}

function testMatchedPairYieldMath(): void {
  const result = simulateMatchedPairYield({
    shares: 100,
    opposingAvailableShares: 80,
    holdingDays: 30,
    strategyApyPct: 6,
    executableBid: 0.6,
    reserveBps: 2_000,
    protocolFeeBps: 0,
  });
  approximatelyEqual(result.matchedShares, 80);
  approximatelyEqual(result.unmatchedShares, 20);
  approximatelyEqual(result.deployedPrincipalUsd, 64);
  approximatelyEqual(result.estimatedNetUserYieldUsd, 0.157808);
}

function testNoOpposingPositionMeansNoYield(): void {
  const result = simulateMatchedPairYield({
    shares: 100,
    opposingAvailableShares: 0,
    holdingDays: 30,
    strategyApyPct: 6,
    executableBid: 0.6,
  });
  assert(result.matchedShares === 0, 'No opposite-side capacity must produce no match.');
  assert(result.estimatedNetUserYieldUsd === 0, 'No matched principal must produce no yield.');
}

function testAgentRoutingCannotExecute(): void {
  const now = new Date('2026-08-11T00:00:00.000Z');
  const { market, orderbook } = getCapitalDemoMarket('YES', now);
  const eligibility = evaluateCapitalEligibility(market, orderbook, undefined, now);
  const recommendation = recommendCapitalRoute({
    eligibility,
    shares: 100,
    opposingAvailableShares: 80,
    holdingDays: 30,
  });
  assert(recommendation.action === 'match_for_yield', 'Expected deterministic yield routing.');
  assert(recommendation.executable === false, 'Recommendations must never execute directly.');
  assert(recommendation.requiresWalletSignature, 'Every intent must require the owner signature.');
}

function testBorrowRouteRespectsLtv(): void {
  const now = new Date('2026-08-11T00:00:00.000Z');
  const { market, orderbook } = getCapitalDemoMarket('YES', now);
  const eligibility = evaluateCapitalEligibility(market, orderbook, undefined, now);
  const recommendation = recommendCapitalRoute({
    eligibility,
    shares: 100,
    opposingAvailableShares: 0,
    holdingDays: 30,
    requestedBorrowUsd: 30,
    maxLtvBps: 3_500,
  });
  assert(recommendation.action === 'hold', 'Borrowing above the deterministic LTV must be rejected.');
  assert(recommendation.intent === null, 'Unsafe borrowing must not produce an intent payload.');
}

function testPdaDerivationsAreStable(): void {
  const [config] = deriveCapitalConfigPda();
  const [market] = deriveCapitalMarketPda(config, new Uint8Array(32).fill(7));
  const [position] = deriveCapitalPositionPda(market, config);
  const [intentZero] = deriveAgentIntentPda(position, 0n);
  const [intentOne] = deriveAgentIntentPda(position, 1n);
  assert(!intentZero.equals(intentOne), 'Distinct u64 nonces must derive distinct intent PDAs.');
  assert(config.toBytes().length === 32 && market.toBytes().length === 32, 'Every PDA must be a Solana public key.');
}

function testThesisVaultPdaDerivationsAreStable(): void {
  const [config] = deriveCapitalConfigPda();
  const creator = new PublicKey(new Uint8Array(32).fill(4));
  const thesisId = new Uint8Array(32).fill(5);
  const [thesis] = deriveThesisPda(config, creator, thesisId);
  const [vault] = deriveThesisVaultPda(thesis);
  const [shareMint] = deriveThesisShareMintPda(vault);
  const [position] = deriveSimulatedPositionPda(vault, new Uint8Array(32).fill(6));
  const [redemptionZero] = deriveThesisRedemptionPda(vault, 0n);
  const [redemptionOne] = deriveThesisRedemptionPda(vault, 1n);
  assert(!shareMint.equals(position), 'Share mint and simulated position PDAs must be isolated.');
  assert(!redemptionZero.equals(redemptionOne), 'Redemption nonces must derive unique PDAs.');
}

function testThesisVaultAccounting(): void {
  const blueprint = createSolanaGrowthDevnetBlueprint();
  validateThesisBlueprint(blueprint);
  assert(blueprint.executionMode === 'onchain', 'The devnet blueprint must label PDA custody as on-chain.');
  assert(calculateDepositSharesAtomic(1_000n, 100_000n, 120_000n) === 833n, 'Deposits must round shares down.');
  assert(calculateRedemptionAssetsAtomic(833n, 100_000n, 120_000n) === 999n, 'Redemptions must round assets down.');
  const checkpoint = buildThesisNavCheckpoint(1n, 1_786_700_000n, {
    accountingLiquidAssets: 10_000n,
    defiAssets: 65_000n,
    predictionAssets: 25_000n,
    resolvedUnclaimedAssets: 500n,
    accruedFees: 200n,
    liabilities: 300n,
  });
  assert(checkpoint.totalAssets === 100_000n, 'NAV must subtract fees and liabilities.');
  assert(checkpoint.contentHash.length === 32, 'NAV checkpoint hash must be 32 bytes.');
}

function testJupiterInstructionPolicy(): void {
  const wallet = new PublicKey(new Uint8Array(32).fill(3));
  const validInstruction = new TransactionInstruction({
    programId: JUPITER_LEND_PROGRAM_ID,
    keys: [{ pubkey: wallet, isSigner: true, isWritable: true }],
    data: Buffer.from([1]),
  });
  const programs = validateJupiterEarnInstructions([validInstruction], wallet);
  assert(programs.includes(JUPITER_LEND_PROGRAM_ID.toBase58()), 'Expected the Jupiter program to be retained.');

  const unexpectedProgram = new TransactionInstruction({
    programId: new PublicKey(new Uint8Array(32).fill(8)),
    keys: [{ pubkey: wallet, isSigner: true, isWritable: true }],
    data: Buffer.from([1]),
  });
  assertThrows(
    () => validateJupiterEarnInstructions([unexpectedProgram], wallet),
    'unapproved program',
  );

  const unexpectedSigner = new PublicKey(new Uint8Array(32).fill(9));
  const unsafeInstruction = new TransactionInstruction({
    programId: JUPITER_LEND_PROGRAM_ID,
    keys: [{ pubkey: unexpectedSigner, isSigner: true, isWritable: false }],
    data: Buffer.from([1]),
  });
  assertThrows(
    () => validateJupiterEarnInstructions([unsafeInstruction], wallet),
    'unexpected signer',
  );
}

function testStrategyProviderGate(): void {
  const previous = process.env.CAPITAL_STRATEGY_PREPARE_ENABLED;
  process.env.CAPITAL_STRATEGY_PREPARE_ENABLED = 'false';
  const providers = getCapitalStrategyProviders();
  const jupiter = providers.find((provider) => provider.id === 'jupiter_earn');
  assert(jupiter?.status === 'configuration_required', 'Jupiter preparation must default to gated.');
  assert(
    providers.every((provider) => provider.custody === 'user_wallet'),
    'Every external provider must remain user-custodied.',
  );
  if (previous === undefined) delete process.env.CAPITAL_STRATEGY_PREPARE_ENABLED;
  else process.env.CAPITAL_STRATEGY_PREPARE_ENABLED = previous;
}

const tests: Array<[string, () => void]> = [
  ['normalizes price scales', testPriceNormalization],
  ['accepts the conservative demo market', testEligibleDemoMarket],
  ['blocks a missing executable bid', testMissingBidBlocksEligibility],
  ['calculates matched-pair yield', testMatchedPairYieldMath],
  ['does not yield without an opposite side', testNoOpposingPositionMeansNoYield],
  ['keeps agent routing recommendation-only', testAgentRoutingCannotExecute],
  ['rejects borrowing above LTV', testBorrowRouteRespectsLtv],
  ['derives stable protocol PDAs', testPdaDerivationsAreStable],
  ['derives stable thesis-vault PDAs', testThesisVaultPdaDerivationsAreStable],
  ['calculates tokenized thesis accounting', testThesisVaultAccounting],
  ['rejects unsafe Jupiter instruction graphs', testJupiterInstructionPolicy],
  ['keeps external strategies explicitly gated', testStrategyProviderGate],
];

for (const [name, test] of tests) {
  test();
  console.log(`✓ ${name}`);
}
