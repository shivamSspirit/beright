import 'dotenv/config';
import { getKalshiClient, getKalshiBalance, getKalshiMarkets, isKalshiDemo } from '../lib/kalshi';

async function testKalshi() {
  console.log('Testing Kalshi Demo Account Setup...\n');

  // Check if demo mode
  console.log('Demo Mode:', isKalshiDemo() ? 'ENABLED' : 'DISABLED');

  // Get client
  const client = getKalshiClient();
  if (!client) {
    console.log('Failed to initialize Kalshi client');
    return;
  }
  console.log('Kalshi client initialized\n');

  // Get balance
  console.log('Fetching account balance...');
  try {
    const balance = await getKalshiBalance();
    if (balance) {
      console.log('Balance:', JSON.stringify(balance, null, 2));
    } else {
      console.log('Could not fetch balance');
    }
  } catch (err: any) {
    console.log('Balance error:', err?.message || err);
  }

  // Get markets
  console.log('\nFetching active markets...');
  try {
    const markets = await getKalshiMarkets(15);

    if (markets && markets.length > 0) {
      console.log('Found ' + markets.length + ' markets\n');
      console.log('─'.repeat(60));
      for (const m of markets.slice(0, 10)) {
        const price = (m.yes_bid || m.last_price || 50);
        const vol = m.volume || m.volume_24h || 0;
        console.log('* ' + (m.title || m.ticker).substring(0, 50));
        console.log('  Ticker: ' + m.ticker + ' | YES: ' + price + 'c | Vol: ' + vol);
      }
    } else {
      console.log('No markets returned');
    }
  } catch (err: any) {
    console.log('Markets error:', err?.message || err);
  }
}

testKalshi();
