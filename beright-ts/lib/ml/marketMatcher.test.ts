/**
 * ML Market Matcher Tests
 *
 * Tests for the ML-powered market matching engine.
 * Run with: npx ts-node lib/ml/marketMatcher.test.ts
 *
 * @author BeRight Protocol
 */

import { extractEntities, matchMarkets, DEFAULT_ML_CONFIG } from './marketMatcher';
import { mlResultToUnifiedMarket } from './adapters';
import { RawMarketData } from '../data/types';

// =============================================================================
// TEST HELPERS
// =============================================================================

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    testsPassed++;
    console.log(`  ✓ ${message}`);
  } else {
    testsFailed++;
    console.error(`  ✗ ${message}`);
  }
}

function describe(name: string, fn: () => void | Promise<void>): void {
  console.log(`\n${name}`);
  fn();
}

async function describeAsync(name: string, fn: () => Promise<void>): Promise<void> {
  console.log(`\n${name}`);
  await fn();
}

// =============================================================================
// ENTITY EXTRACTION TESTS
// =============================================================================

describe('extractEntities', () => {
  // Test people extraction
  const entities1 = extractEntities('Will Trump win the 2024 presidential election?');
  assert(entities1.people.includes('Trump'), 'extracts Trump from question');
  assert(entities1.events.includes('Presidential Election'), 'extracts Presidential Election event');

  // Test organization extraction
  const entities2 = extractEntities('Will the Fed raise interest rates in Q1 2025?');
  assert(entities2.organizations.includes('Fed'), 'extracts Fed organization');

  // Test location extraction
  const entities3 = extractEntities('Will China invade Taiwan by 2025?');
  assert(entities3.locations.includes('China'), 'extracts China location');
  assert(entities3.locations.includes('Taiwan'), 'extracts Taiwan location');

  // Test date extraction
  const entities4 = extractEntities('Will BTC reach $100K by end of 2025?');
  assert(entities4.dates.length > 0, 'extracts date from question');
  assert(entities4.amounts.length > 0, 'extracts amount ($100K) from question');

  // Test crypto entities
  const entities5 = extractEntities('Will SEC approve the Bitcoin ETF approval application?');
  assert(entities5.organizations.includes('SEC'), 'extracts SEC organization');
  assert(entities5.events.includes('ETF Approval'), 'extracts ETF Approval event');

  // Test multiple entities
  const entities6 = extractEntities('Will Elon Musk announce Tesla joining the S&P 500?');
  assert(entities6.people.includes('Musk'), 'extracts Musk from question');
  assert(entities6.organizations.includes('Tesla'), 'extracts Tesla organization');
});

// =============================================================================
// ADAPTER TESTS
// =============================================================================

describe('mlResultToUnifiedMarket', () => {
  const mockResult = {
    eventId: 'test-123',
    canonicalQuestion: 'Will BTC reach $100K?',
    category: 'crypto' as const,
    markets: [
      {
        platform: 'polymarket' as const,
        platformId: 'pm-1',
        question: 'Will BTC reach $100K?',
        yesPrice: 0.65,
        noPrice: 0.35,
        volume24h: 50000,
        liquidity: 100000,
        url: 'https://polymarket.com/...',
      },
      {
        platform: 'kalshi' as const,
        platformId: 'k-1',
        question: 'Bitcoin to $100,000',
        yesPrice: 0.62,
        noPrice: 0.38,
        volume24h: 30000,
        liquidity: 80000,
      },
    ],
    matchConfidence: 0.92,
    consensusPrice: 0.64,
    priceSpread: 0.03,
    totalLiquidity: 180000,
    totalVolume24h: 80000,
    entities: {
      people: [],
      organizations: [],
      locations: [],
      events: ['ETF Approval'],
      dates: [],
      amounts: [{ raw: '$100K', value: 100000, unit: 'USD' }],
      customTags: [],
    },
    matchedAt: new Date(),
  };

  const unified = mlResultToUnifiedMarket(mockResult);

  assert(unified.id === 'test-123', 'preserves event ID');
  assert(unified.question === 'Will BTC reach $100K?', 'preserves canonical question');
  assert(unified.category === 'crypto', 'preserves category');
  assert(unified.platforms.length === 2, 'converts all platform markets');
  assert(unified.platformCount === 2, 'sets correct platform count');
  assert(unified.totalLiquidity === 180000, 'preserves total liquidity');
  assert(unified.overallTrustScore === 92, 'converts confidence to trust score (0-100)');
  assert(unified.bestBid === 0.65, 'calculates best bid correctly');
});

// =============================================================================
// MATCHING TESTS
// =============================================================================

async function runMatchingTests(): Promise<void> {
  await describeAsync('matchMarkets', async () => {
    // Test empty input
    const emptyResults = await matchMarkets([]);
    assert(emptyResults.length === 0, 'handles empty input');

    // Test single market
    const singleMarket: RawMarketData = {
      id: 'test-1',
      platform: 'polymarket',
      title: 'Will BTC reach $100K?',
      question: 'Will BTC reach $100K?',
      yesPrice: 0.65,
      noPrice: 0.35,
      volume: 50000,
      volume24h: 50000,
      liquidity: 100000,
      status: 'active',
      fetchedAt: new Date(),
    };

    const singleResults = await matchMarkets([singleMarket]);
    assert(singleResults.length === 1, 'processes single market');
    assert(singleResults[0].markets.length === 1, 'creates single-market cluster');

    // Test matching across platforms (similar questions)
    const markets: RawMarketData[] = [
      {
        id: 'pm-1',
        platform: 'polymarket',
        title: 'Will Trump win 2024 election?',
        question: 'Will Trump win 2024 election?',
        yesPrice: 0.55,
        noPrice: 0.45,
        volume: 100000,
        volume24h: 100000,
        liquidity: 200000,
        status: 'active',
        fetchedAt: new Date(),
      },
      {
        id: 'k-1',
        platform: 'kalshi',
        title: 'Trump to win 2024 presidential election',
        question: 'Trump to win 2024 presidential election',
        yesPrice: 0.52,
        noPrice: 0.48,
        volume: 80000,
        volume24h: 80000,
        liquidity: 150000,
        status: 'active',
        fetchedAt: new Date(),
      },
      {
        id: 'pm-2',
        platform: 'polymarket',
        title: 'Will BTC reach $100K?',
        question: 'Will BTC reach $100K?',
        yesPrice: 0.30,
        noPrice: 0.70,
        volume: 40000,
        volume24h: 40000,
        liquidity: 80000,
        status: 'active',
        fetchedAt: new Date(),
      },
    ];

    const multiResults = await matchMarkets(markets);
    assert(multiResults.length >= 1, 'creates clusters from multiple markets');
    assert(multiResults.length <= 3, 'does not create more clusters than markets');

    // Check that markets are assigned to results
    const totalMarketsInResults = multiResults.reduce((sum, r) => sum + r.markets.length, 0);
    assert(totalMarketsInResults === markets.length, 'all markets are assigned to results');
  });
}

// =============================================================================
// CONFIG TESTS
// =============================================================================

describe('DEFAULT_ML_CONFIG', () => {
  assert(DEFAULT_ML_CONFIG.minEmbeddingSimilarity === 0.85, 'has correct min embedding similarity');
  assert(DEFAULT_ML_CONFIG.minOverallScore === 0.75, 'has correct min overall score');
  assert(DEFAULT_ML_CONFIG.weights.embedding === 0.40, 'embedding weight is 40%');
  assert(DEFAULT_ML_CONFIG.weights.entity === 0.30, 'entity weight is 30%');
  assert(DEFAULT_ML_CONFIG.weights.date === 0.15, 'date weight is 15%');
  assert(DEFAULT_ML_CONFIG.weights.category === 0.15, 'category weight is 15%');
});

// =============================================================================
// RUN TESTS
// =============================================================================

async function runAllTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('ML Market Matcher Tests');
  console.log('='.repeat(60));

  // Run sync tests (already executed above)

  // Run async tests
  await runMatchingTests();

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('='.repeat(60));

  if (testsFailed > 0) {
    process.exit(1);
  }
}

// Run if executed directly
runAllTests().catch(console.error);
