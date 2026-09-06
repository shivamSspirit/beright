import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateCanonicalEquivalence, type CanonicalMarketDescriptor } from './equivalence';

const base: CanonicalMarketDescriptor = {
  title: 'Will Bitcoin trade above $100,000 by August 31, 2026?', topic: 'crypto', subtopic: 'bitcoin', entities: ['bitcoin'],
  eventDate: '2026-08-31T23:59:59.000Z', marketCloseDate: '2026-08-31T23:59:59.000Z', resolutionDate: '2026-08-31T23:59:59.000Z',
  outcomeStructure: 'binary', outcomes: ['YES', 'NO'], numericalThreshold: 100000, unit: 'USD', timezone: 'UTC',
  resolutionSource: 'Coinbase BTC-USD', cancellationRules: 'refund if Coinbase unavailable', normalizedRules: 'btc above 100000 usd by 2026-08-31 coinbase',
};

const fixtures: Array<{ name: string; right: CanonicalMarketDescriptor; expected: ReturnType<typeof evaluateCanonicalEquivalence>['decision'] }> = [
  { name: 'true equivalent', right: { ...base, title: 'Bitcoin at or above $100k before August 31 2026?' }, expected: 'exact_equivalent' },
  { name: 'subtly different deadline', right: { ...base, marketCloseDate: '2026-09-02T23:59:59.000Z', resolutionDate: '2026-09-02T23:59:59.000Z' }, expected: 'related_not_equivalent' },
  { name: 'different resolution source', right: { ...base, resolutionSource: 'Binance BTC-USDT' }, expected: 'related_not_equivalent' },
  { name: 'inverted outcome', right: { ...base, title: 'Will Bitcoin not trade above $100,000 by August 31, 2026?' }, expected: 'exact_equivalent' },
  { name: 'similar title different entity', right: { ...base, title: 'Will Ethereum trade above $100,000 by August 31, 2026?', entities: ['ethereum'], subtopic: 'ethereum' }, expected: 'related_not_equivalent' },
  { name: 'related threshold', right: { ...base, title: 'Will Bitcoin trade above $110,000 by August 31, 2026?', numericalThreshold: 110000 }, expected: 'related_not_equivalent' },
  { name: 'ambiguous missing sources', right: { ...base, resolutionSource: null, timezone: null, cancellationRules: null, normalizedRules: 'btc above 100000 by august' }, expected: 'ambiguous_requires_review' },
  { name: 'unrelated macro market', right: { ...base, title: 'Will the Fed cut rates?', topic: 'macro', subtopic: 'rates', entities: ['fed'], numericalThreshold: null, unit: null }, expected: 'rejected' },
];

for (const fixture of fixtures) test(fixture.name, () => {
  const result = evaluateCanonicalEquivalence(base, fixture.right);
  assert.equal(result.decision, fixture.expected);
  if (fixture.name === 'inverted outcome') assert.equal(result.outcomeMapping.inverted, true);
});

test('fixture audit has precision above 95 percent for automatic exact matches', () => {
  const automatic = fixtures.filter((fixture) => evaluateCanonicalEquivalence(base, fixture.right).decision === 'exact_equivalent');
  const truePositives = automatic.filter((fixture) => fixture.name === 'true equivalent' || fixture.name === 'inverted outcome');
  assert.ok(automatic.length > 0); assert.ok(truePositives.length / automatic.length > 0.95);
});
