import { scanSimple, formatScanResult, formatOpportunity } from '../lib/arbitrage/scanner';

async function runArbScan() {
  console.log('🔄 Running Cross-Platform Arbitrage Scan...\n');
  console.log('═'.repeat(70) + '\n');

  try {
    const result = await scanSimple();

    if (!result || !result.opportunities || result.opportunities.length === 0) {
      console.log('📊 No arbitrage opportunities found at this moment.');
      console.log('\n💡 Arb opportunities are fleeting. Use /arb-subscribe for alerts.');
      console.log('   Or run /arb-monitor for continuous scanning.');
      return;
    }

    console.log('🎯 Found ' + result.opportunities.length + ' Arbitrage Opportunities!\n');
    console.log('─'.repeat(70));

    // Use the built-in formatter for each opportunity
    result.opportunities.slice(0, 10).forEach((opp, index) => {
      console.log(formatOpportunity(opp, index + 1));
      console.log('');
    });

    console.log('═'.repeat(70));
    console.log('\n📈 Use /paptrade to execute paper trades on these opportunities');

  } catch (err: any) {
    console.error('Scan error:', err?.message || err);
  }
}

runArbScan();
