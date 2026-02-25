import 'dotenv/config';
import { getKalshiMarkets, isKalshiDemo } from '../lib/kalshi';

// Direct Polymarket API
async function getPolymarkets(): Promise<any[]> {
  const fetch = (await import('node-fetch')).default;
  const response = await fetch('https://gamma-api.polymarket.com/markets?closed=false&limit=50', {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Polymarket API error');
  const data: any = await response.json();
  return Array.isArray(data) ? data : [];
}

// Find similar markets using fuzzy matching
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarity(a: string, b: string): number {
  const aNorm = normalizeTitle(a);
  const bNorm = normalizeTitle(b);

  const aWords = new Set(aNorm.split(' ').filter(w => w.length > 3));
  const bWords = new Set(bNorm.split(' ').filter(w => w.length > 3));

  const intersection = [...aWords].filter(w => bWords.has(w)).length;
  const union = new Set([...aWords, ...bWords]).size;

  return union > 0 ? intersection / union : 0;
}

async function crossPlatformScan() {
  console.log('='.repeat(70));
  console.log('CROSS-PLATFORM ARBITRAGE SCAN');
  console.log('Kalshi vs Polymarket');
  console.log('Kalshi Demo Mode:', isKalshiDemo() ? 'YES' : 'NO');
  console.log('='.repeat(70) + '\n');

  try {
    // Fetch from both platforms
    console.log('Fetching markets from both platforms...\n');

    const [kalshiMarkets, polyMarkets] = await Promise.all([getKalshiMarkets(50), getPolymarkets()]);

    console.log('Kalshi: ' + kalshiMarkets.length + ' markets');
    console.log('Polymarket: ' + polyMarkets.length + ' markets\n');

    // Parse Polymarket prices
    const polyParsed = polyMarkets.map(m => {
      let yesPrice = 0.5;
      try {
        const prices = JSON.parse(m.outcomePrices || '[]');
        yesPrice = parseFloat(prices[0]) || 0.5;
      } catch (e) {}
      return {
        ...m,
        title: m.question || m.title || '',
        yesPrice,
        noPrice: 1 - yesPrice,
      };
    });

    // Parse Kalshi prices
    const kalshiParsed = kalshiMarkets.map(m => ({
      ...m,
      title: m.title || m.ticker || '',
      yesPrice: (m.yes_bid || m.last_price || 50) / 100,
      noPrice: 1 - (m.yes_bid || m.last_price || 50) / 100,
    }));

    // Find matches
    console.log('Searching for matching markets...\n');
    console.log('-'.repeat(70));

    const opportunities: any[] = [];

    for (const kalshi of kalshiParsed) {
      if (kalshi.yesPrice <= 0.05 || kalshi.yesPrice >= 0.95) continue;

      for (const poly of polyParsed) {
        if (poly.yesPrice <= 0.05 || poly.yesPrice >= 0.95) continue;

        const sim = similarity(kalshi.title, poly.title);

        if (sim > 0.4) {
          // Found a match!
          const spread = Math.abs(kalshi.yesPrice - poly.yesPrice);
          const spreadPct = spread * 100;

          if (spreadPct > 1) {
            // Significant spread
            opportunities.push({
              kalshiTitle: kalshi.title,
              polyTitle: poly.title,
              similarity: sim,
              kalshiYes: kalshi.yesPrice,
              polyYes: poly.yesPrice,
              spread: spreadPct,
              buyPlatform: kalshi.yesPrice < poly.yesPrice ? 'Kalshi' : 'Polymarket',
              sellPlatform: kalshi.yesPrice < poly.yesPrice ? 'Polymarket' : 'Kalshi',
              buyPrice: Math.min(kalshi.yesPrice, poly.yesPrice),
              sellPrice: Math.max(kalshi.yesPrice, poly.yesPrice),
              kalshiTicker: kalshi.ticker,
              polySlug: poly.slug,
            });
          }

          // Log the match
          console.log('MATCH FOUND (similarity: ' + (sim * 100).toFixed(0) + '%)');
          console.log('  Kalshi: ' + kalshi.title.substring(0, 50));
          console.log('  Poly:   ' + poly.title.substring(0, 50));
          console.log('  Kalshi YES: $' + kalshi.yesPrice.toFixed(3) + ' | Poly YES: $' + poly.yesPrice.toFixed(3));
          console.log('  Spread: ' + spreadPct.toFixed(2) + '%');
          console.log('');
        }
      }
    }

    // Results
    console.log('='.repeat(70));
    console.log('ARBITRAGE OPPORTUNITIES: ' + opportunities.length + ' found');
    console.log('='.repeat(70) + '\n');

    if (opportunities.length === 0) {
      console.log('No arbitrage opportunities detected.');
      console.log('\nMarkets are efficiently priced across platforms.');
      console.log('Try again during high-volatility news events.');
    } else {
      // Sort by spread
      opportunities.sort((a, b) => b.spread - a.spread);

      for (const opp of opportunities.slice(0, 10)) {
        const emoji = opp.spread > 5 ? '[HOT]' : opp.spread > 3 ? '[GOOD]' : '[OK]';
        console.log(emoji + ' Spread: ' + opp.spread.toFixed(2) + '%');
        console.log('  Market: ' + opp.kalshiTitle.substring(0, 55));
        console.log('  BUY YES @ $' + opp.buyPrice.toFixed(3) + ' on ' + opp.buyPlatform);
        console.log('  SELL YES @ $' + opp.sellPrice.toFixed(3) + ' on ' + opp.sellPlatform);
        console.log('  Kalshi: ' + opp.kalshiTicker.substring(0, 30));
        console.log('  Poly: https://polymarket.com/event/' + opp.polySlug);
        console.log('');
      }
    }
  } catch (err: any) {
    console.error('Scan error:', err?.message || err);
  }
}

crossPlatformScan();
