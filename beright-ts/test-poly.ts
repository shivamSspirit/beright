import { searchMarkets } from './skills/markets';

async function testSearch() {
  const queries = ['bitcoin', 'ethereum', 'trump', 'fed', 'election'];

  for (const query of queries) {
    console.log(`\n=== Testing "${query}" ===`);
    const markets = await searchMarkets(query, ['polymarket']);
    console.log(`Found ${markets.length} markets:`);
    for (const m of markets.slice(0, 3)) {
      console.log(`  - [${m.platform}] ${m.title}`);
    }
  }
}

testSearch().catch(console.error);
