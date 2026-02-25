import 'dotenv/config';
import { getKalshiMarkets, getKalshiMarketsByCategory, isKalshiDemo } from '../lib/kalshi';
import { getStrategyFramework } from '../services/strategyFramework';

async function kalshiScan() {
  console.log('='.repeat(70));
  console.log('TRADER SCAN - Kalshi Live Markets');
  console.log('Demo Mode:', isKalshiDemo() ? 'YES (paper trading)' : 'NO (real money)');
  console.log('='.repeat(70) + '\n');

  try {
    // Get markets from multiple categories
    console.log('Fetching Kalshi markets...\n');

    const [general, politics, crypto] = await Promise.all([
      getKalshiMarkets(30),
      getKalshiMarketsByCategory('Politics', 20).catch(() => []),
      getKalshiMarketsByCategory('Crypto', 20).catch(() => []),
    ]);

    // Combine and dedupe
    const allMarkets = [...general, ...politics, ...crypto];
    const seen = new Set<string>();
    const markets = allMarkets.filter(m => {
      if (seen.has(m.ticker)) return false;
      seen.add(m.ticker);
      return true;
    });

    console.log('Found ' + markets.length + ' unique markets\n');

    // Show top markets by volume
    console.log('TOP KALSHI MARKETS BY VOLUME:');
    console.log('-'.repeat(70));

    const sortedByVol = [...markets].sort((a, b) => (b.volume || 0) - (a.volume || 0));
    for (const m of sortedByVol.slice(0, 15)) {
      const yesPrice = (m.yes_bid || m.last_price || 50) / 100;
      const vol = m.volume || 0;
      console.log('* ' + (m.title || m.ticker).substring(0, 55));
      console.log('  ' + m.ticker.substring(0, 40));
      console.log('  YES: $' + yesPrice.toFixed(2) + ' | Vol: ' + vol.toLocaleString() + ' contracts');
    }

    // Strategy evaluation
    console.log('\n' + '='.repeat(70));
    console.log('STRATEGY EVALUATION');
    console.log('='.repeat(70) + '\n');

    const framework = getStrategyFramework();
    console.log('Enabled strategies:', framework.getEnabledStrategies().join(', ') + '\n');

    const results: any[] = [];

    for (const market of markets) {
      const yesPrice = (market.yes_bid || market.last_price || 50) / 100;
      const noPrice = 1 - yesPrice;

      // Skip extreme prices
      if (yesPrice <= 0.05 || yesPrice >= 0.95) continue;

      const context: any = {
        market,
        platform: 'kalshi',
        marketId: market.ticker,
        ticker: market.ticker,
        title: market.title || market.ticker,
        category: 'general',
        currentPrice: yesPrice,
        volume: market.volume || 0,
        liquidity: market.open_interest || 0,
        volatility: 0.15,
        sentiment: 0,
        newsRecency: 60,
        daysToExpiry: market.expiration_time
          ? Math.max(1, (new Date(market.expiration_time).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : 30,
        historicalPrices: [],
        relatedMarkets: [],
      };

      try {
        const signal = await framework.getBestSignal(context);

        if (signal && signal.confidence > 30) {
          results.push({
            market: context.title,
            ticker: context.ticker,
            yesPrice,
            noPrice,
            strategy: signal.strategyType,
            direction: signal.direction,
            confidence: signal.confidence,
            edge: signal.edge,
            reasoning: signal.reasoning,
            volume: context.volume,
            daysToExpiry: context.daysToExpiry,
          });
        }
      } catch (e) {
        // Skip failed evaluations
      }
    }

    // Sort by confidence
    results.sort((a, b) => b.confidence - a.confidence);

    console.log('SCAN RESULTS: ' + results.length + ' signals detected\n');

    if (results.length === 0) {
      console.log('No actionable signals found.');
      console.log('\nPossible reasons:');
      console.log('- Markets are efficiently priced');
      console.log('- Need cross-platform arbitrage (run /arb)');
      console.log('- Try during high-volatility news events');
    } else {
      console.log('TOP TRADING SIGNALS:\n');

      for (const r of results.slice(0, 10)) {
        const confEmoji = r.confidence > 60 ? '[HOT]' : r.confidence > 45 ? '[WARM]' : '[WATCH]';
        const urgency = r.daysToExpiry < 7 ? ' [EXPIRING SOON]' : '';

        console.log(confEmoji + ' ' + r.strategy.toUpperCase() + urgency);
        console.log('  Market: ' + r.market.substring(0, 55));
        console.log('  Ticker: ' + r.ticker.substring(0, 40));
        console.log('  Signal: ' + r.direction + ' @ $' + (r.direction === 'YES' ? r.yesPrice : r.noPrice).toFixed(3));
        console.log('  Confidence: ' + r.confidence.toFixed(0) + '% | Edge: ' + (r.edge * 100).toFixed(2) + '%');
        console.log('  Volume: ' + r.volume.toLocaleString() + ' | Expires: ' + r.daysToExpiry.toFixed(0) + ' days');
        console.log('  Reason: ' + r.reasoning.substring(0, 60));
        console.log('');
      }

      // Execution command
      const top = results[0];
      console.log('-'.repeat(70));
      console.log('\nTO PAPER TRADE TOP SIGNAL:');
      console.log(
        '/paptrade ' +
          top.direction +
          ' ' +
          top.ticker.substring(0, 20) +
          ' 10 ' +
          (top.direction === 'YES' ? top.yesPrice : top.noPrice).toFixed(2)
      );
    }
  } catch (err: any) {
    console.error('Scan error:', err?.message || err);
  }
}

kalshiScan();
