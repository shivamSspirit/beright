import { NextRequest } from 'next/server';
import type { JupiterEvent } from '../../../../../lib/jupiter/types';
import { GET } from './route';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function testDemoEventsUseCanonicalJupiterSchema(): Promise<void> {
  const response = await GET(new NextRequest(
    'http://localhost/api/v2/jupiter/events?q=Bitcoin%20reach&limit=1&includeMarkets=true',
    { headers: { 'x-beright-mode': 'demo' } },
  ));
  const payload = await response.json() as { success: boolean; data: JupiterEvent[] };

  assert(response.status === 200, `Jupiter events route returned ${response.status}.`);
  assert(payload.success, 'Jupiter events route must report success.');
  assert(payload.data.length === 1, 'Expected one matching demo event.');

  const event = payload.data[0];
  const market = event.markets?.[0];
  assert(event.eventId === 'evt-DEMO-BTC100K', 'Event must expose its canonical eventId.');
  assert(event.category === 'crypto', 'Demo category must use a supported Jupiter category.');
  assert(event.status === 'active', 'Demo event must use a supported Jupiter status.');
  assert(market, 'Demo event must include its canonical market object.');
  assert(market.marketId === 'mkt-DEMO-BTC100K', 'Market must expose its canonical marketId.');
  assert(market.eventId === event.eventId, 'Market must reference its parent event.');
  assert(market.pricing.buyYesPriceUsd === '720000', 'YES price must be encoded in micro USD.');
  assert(market.pricing.buyNoPriceUsd === '280000', 'NO price must be encoded in micro USD.');
  assert(market.pricing.volume === '4250000000000', 'Volume must be encoded in micro USD.');
  assert(market.pricing.liquidity === '890000000000', 'Liquidity must be encoded in micro USD.');
  assert(market.closeTime === event.endTime, 'Market and event resolution dates must stay aligned.');
  assert(market.onChain?.marketPubkey, 'Demo market must preserve its linked market ledger.');
}

async function main(): Promise<void> {
  await testDemoEventsUseCanonicalJupiterSchema();
  console.log('✓ demo events use the canonical Jupiter schema');
}

void main();
