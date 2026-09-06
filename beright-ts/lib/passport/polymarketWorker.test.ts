import assert from 'node:assert/strict';
import test from 'node:test';
import { replayEvidenceBundleV1 } from '@beright/forecaster-scoring-engine';
import { PolymarketClient, PolymarketProviderError, type PolymarketHistory, type PolymarketMarket, type PolymarketPosition } from './polymarketClient';
import { buildPolymarketPassport } from './polymarketWorker';

const address = '0x56687bf447db6ffa42ffe2204a05edaa20f55839';
const now = new Date('2026-09-02T12:00:00.000Z');

function condition(index: number): string {
  return `0x${index.toString(16).padStart(64, '0')}`;
}

function historyFixture(count = 10): PolymarketHistory {
  const closedPositions: PolymarketPosition[] = [];
  const markets: PolymarketMarket[] = [];
  for (let index = 1; index <= count; index += 1) {
    const conditionId = condition(index);
    closedPositions.push({
      proxyWallet: address, asset: `asset-${index}`, conditionId, avgPrice: 0.75, totalBought: 100,
      realizedPnl: 25, curPrice: 1, title: `Will Bitcoin fixture ${index} resolve yes?`, slug: `fixture-${index}`,
      eventSlug: `fixture-event-${index}`, outcome: 'Yes', outcomeIndex: 0, oppositeOutcome: 'No',
      oppositeAsset: `opposite-${index}`, endDate: '2026-08-01T00:00:00.000Z', timestamp: 1_753_056_000 + index,
    });
    markets.push({
      id: String(index), question: `Will Bitcoin fixture ${index} resolve yes?`, conditionId, slug: `fixture-${index}`,
      resolutionSource: 'Polymarket fixture', startDate: '2025-01-01T00:00:00.000Z', endDate: '2026-08-01T00:00:00.000Z',
      description: `Fixture rule ${index}`, outcomes: '["Yes","No"]', outcomePrices: '["1","0"]', category: 'Crypto',
      closed: true, closedTime: '2026-08-01T01:00:00.000Z', umaResolutionStatus: 'resolved',
    });
  }
  return {
    address,
    profile: { createdAt: '2024-10-14T04:57:11.603Z', proxyWallet: address, name: 'Fixture Trader', displayUsernamePublic: true },
    trades: [],
    closedPositions,
    currentPositions: [],
    markets,
    reportedMarketCount: count,
    fetchedAt: now.toISOString(),
  };
}

test('builds and replays a complete Polymarket Passport from one address history', () => {
  const build = buildPolymarketPassport(historyFixture(), now);
  assert.equal(build.subject.primaryWallet, address);
  assert.equal(build.subject.walletChain, 'ethereum');
  assert.equal(build.subject.identityStatus, 'unverified');
  assert.equal(build.receipts.length, 10);
  assert.equal(build.resolutions.length, 10);
  assert.equal(build.snapshots.length, 1);
  assert.equal(build.snapshots[0].status, 'Provisional');
  assert.equal(build.report.completeHistory, true);
  assert.equal(build.underwriting.eligibility, 'ineligible');
  assert.equal(replayEvidenceBundleV1(build.bundle).valid, true);
});

test('marks a publicly fetched but incomplete account history as selective import risk', () => {
  const fixture = historyFixture(2);
  fixture.reportedMarketCount = 3;
  const build = buildPolymarketPassport(fixture, now);
  assert.equal(build.report.completeHistory, false);
  assert.ok(build.snapshots[0].penaltyFlags.includes('selective-history-import'));
  assert.equal(build.snapshots[0].status, 'Restricted');
});

function tradeFixture(index: number, timestamp: number) {
  return {
    proxyWallet: address, side: 'BUY' as const, asset: `asset-${index}`, conditionId: condition(index),
    size: index + 1, price: 0.5, timestamp, title: `Trade ${index}`, slug: `trade-${index}`,
    eventSlug: `event-${index}`, outcome: 'Yes', outcomeIndex: 0, transactionHash: `tx-${index}`,
  };
}

function polymarketFetch(trades: ReturnType<typeof tradeFixture>[]): typeof fetch {
  return async (input) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (url.pathname === '/public-profile') return new Response('', { status: 404 });
    if (url.pathname === '/traded') return Response.json({ traded: 0 });
    if (url.pathname === '/positions' || url.pathname === '/closed-positions' || url.pathname === '/markets') return Response.json([]);
    if (url.pathname === '/trades') {
      const start = Number(url.searchParams.get('start'));
      const end = Number(url.searchParams.get('end'));
      const offset = Number(url.searchParams.get('offset'));
      const limit = Number(url.searchParams.get('limit'));
      const page = trades.filter((trade) => trade.timestamp >= start && trade.timestamp <= end)
        .sort((left, right) => right.timestamp - left.timestamp)
        .slice(offset, offset + limit);
      return Response.json(page);
    }
    throw new Error(`Unexpected Polymarket test URL: ${url}`);
  };
}

test('backfills trade history beyond the offset cap by splitting timestamp windows', async () => {
  const trades = [tradeFixture(1, 2), tradeFixture(2, 3), tradeFixture(3, 4), tradeFixture(4, 8), tradeFixture(5, 9), tradeFixture(6, 10)];
  const history = await new PolymarketClient({
    fetchImplementation: polymarketFetch(trades), tradePageSize: 2, tradeMaximumOffset: 2,
    now: () => new Date(11_000),
  }).fetchHistory(address);
  assert.deepEqual(history.trades.map((trade) => trade.transactionHash), trades.map((trade) => trade.transactionHash));
});

test('fails closed when one timestamp alone exceeds the provider offset budget', async () => {
  const trades = Array.from({ length: 5 }, (_, index) => tradeFixture(index + 1, 5));
  const client = new PolymarketClient({
    fetchImplementation: polymarketFetch(trades), tradePageSize: 2, tradeMaximumOffset: 2,
    now: () => new Date(11_000),
  });
  await assert.rejects(() => client.fetchHistory(address), (error: unknown) =>
    error instanceof PolymarketProviderError && error.message.includes('cannot enumerate that second completely'));
});

test('retries a successful Polymarket response whose body is not JSON', async () => {
  const validFetch = polymarketFetch([]);
  let profileRequests = 0;
  const fetchImplementation: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (url.pathname === '/public-profile') {
      profileRequests += 1;
      if (profileRequests === 1) return new Response('Internal Server Error', { status: 200 });
    }
    return validFetch(input, init);
  };

  const history = await new PolymarketClient({
    fetchImplementation,
    retryCount: 2,
    now: () => new Date(11_000),
  }).fetchHistory(address);

  assert.equal(history.profile, null);
  assert.equal(profileRequests, 2);
});

test('reports persistent non-JSON responses as retryable provider errors', async () => {
  const validFetch = polymarketFetch([]);
  const fetchImplementation: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (url.pathname === '/public-profile') return new Response('Internal Server Error', { status: 200 });
    return validFetch(input, init);
  };
  const client = new PolymarketClient({
    fetchImplementation,
    retryCount: 1,
    now: () => new Date(11_000),
  });

  await assert.rejects(() => client.fetchHistory(address), (error: unknown) =>
    error instanceof PolymarketProviderError
      && error.retryable
      && error.message.includes('invalid JSON for /public-profile'));
});
