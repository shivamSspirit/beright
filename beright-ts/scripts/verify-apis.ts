/**
 * API Verification Script
 * Run: npx ts-node scripts/verify-apis.ts
 *
 * Tests all external APIs and prints their JSON responses
 */

import 'dotenv/config';

interface ApiTest {
  name: string;
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
  requiresKey?: string;
}

const tests: ApiTest[] = [
  // Prediction Markets
  {
    name: 'Polymarket',
    url: 'https://gamma-api.polymarket.com/markets?closed=false&limit=2',
  },
  {
    name: 'DFlow (Tokenized Kalshi)',
    url: 'https://dev-prediction-markets-api.dflow.net/api/v1/events?limit=2&withNestedMarkets=true&status=active',
  },
  {
    name: 'Kalshi Legacy',
    url: 'https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=2',
  },
  {
    name: 'Manifold',
    url: 'https://api.manifold.markets/v0/search-markets?term=&limit=2&sort=score&filter=open',
  },
  {
    name: 'Limitless',
    url: 'https://api.limitless.exchange/markets/active',
  },
  {
    name: 'Metaculus',
    url: 'https://www.metaculus.com/api2/questions/?limit=2&status=open',
  },

  // Price Oracles
  {
    name: 'Pyth (SOL price)',
    url: 'https://hermes.pyth.network/v2/updates/price/latest?ids[]=0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  },
  {
    name: 'Jupiter Quote (1 USDC -> SOL)',
    url: 'https://lite-api.jup.ag/swap/v1/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=So11111111111111111111111111111111111111112&amount=1000000&slippageBps=50',
  },
  {
    name: 'DeFi Llama (SOL price)',
    url: 'https://coins.llama.fi/prices/current/solana:So11111111111111111111111111111111111111112',
  },

  // News/Intel
  {
    name: 'Reddit Search',
    url: 'https://www.reddit.com/search.json?q=bitcoin&limit=2&sort=relevance&t=week',
    headers: { 'User-Agent': 'BeRight/1.0' },
  },
  {
    name: 'Google News RSS',
    url: 'https://news.google.com/rss/search?q=bitcoin&hl=en-US&gl=US&ceid=US:en',
  },

  // RSS Feeds (sampling a few)
  {
    name: 'Reuters RSS',
    url: 'https://feeds.reuters.com/reuters/topNews',
  },
  {
    name: 'CoinDesk RSS',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
  },
];

// Tests requiring API keys
const keyTests: ApiTest[] = [
  {
    name: 'Helius Transactions',
    url: `https://api.helius.xyz/v0/addresses/DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK/transactions?api-key=${process.env.HELIUS_API_KEY}&limit=2`,
    requiresKey: 'HELIUS_API_KEY',
  },
];

async function testApi(test: ApiTest): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${test.name}`);
  console.log(`URL: ${test.url.slice(0, 80)}${test.url.length > 80 ? '...' : ''}`);
  console.log('='.repeat(60));

  try {
    const response = await fetch(test.url, {
      method: test.method || 'GET',
      headers: test.headers,
      body: test.body ? JSON.stringify(test.body) : undefined,
      signal: AbortSignal.timeout(10000),
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await response.json();
      console.log('\nJSON Response (truncated):');
      const preview = JSON.stringify(data, null, 2).slice(0, 1500);
      console.log(preview);
      if (JSON.stringify(data).length > 1500) {
        console.log('... (truncated)');
      }
      console.log(`\n✅ ${test.name}: OK (JSON)`);
    } else if (contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom')) {
      const text = await response.text();
      console.log('\nXML/RSS Response (first 500 chars):');
      console.log(text.slice(0, 500));
      console.log('... (truncated)');
      console.log(`\n✅ ${test.name}: OK (XML/RSS)`);
    } else {
      const text = await response.text();
      console.log('\nText Response (first 500 chars):');
      console.log(text.slice(0, 500));
      console.log(`\n✅ ${test.name}: OK (Text)`);
    }
  } catch (error) {
    console.log(`\n❌ ${test.name}: FAILED`);
    console.log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function main() {
  console.log('\n🔍 BeRight API Verification Script');
  console.log('===================================\n');
  console.log('This script tests all external APIs and prints their responses.\n');

  // Run public API tests
  console.log('\n📡 PUBLIC APIs (No Auth Required)');
  console.log('==================================');

  for (const test of tests) {
    await testApi(test);
  }

  // Run key-dependent tests
  console.log('\n\n🔑 AUTHENTICATED APIs');
  console.log('======================');

  for (const test of keyTests) {
    if (test.requiresKey && !process.env[test.requiresKey]) {
      console.log(`\n⏭️ Skipping ${test.name} - ${test.requiresKey} not set`);
      continue;
    }
    await testApi(test);
  }

  console.log('\n\n✨ Verification Complete!');
  console.log('=========================');
  console.log('Review the outputs above to verify each API is returning expected data.\n');
}

main().catch(console.error);
