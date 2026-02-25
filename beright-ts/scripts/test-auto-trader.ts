import 'dotenv/config';
import { AutonomousTrader } from '../services/autonomousTrader';

async function testAutoTrader() {
  const trader = new AutonomousTrader('test-auto-trader', {
    scanIntervalMs: 60 * 1000,  // 1 minute for testing
    autoExecute: true,
    minConfidence: 35,  // Lower threshold for testing
    minEdge: 0.01,      // 1% edge
    maxConcurrentPositions: 5,
    defaultPositionSizeUsd: 20,
  });

  // Listen for events
  trader.on('tradeExecuted', (data) => {
    console.log('\n*** TRADE EXECUTED ***');
    console.log('Direction:', data.trade.direction);
    console.log('Market:', data.trade.marketTicker);
    console.log('Quantity:', data.trade.quantity);
    console.log('Price:', data.trade.entryPrice);
    console.log('Strategy:', data.trade.strategy);
  });

  trader.on('scanComplete', (data) => {
    console.log('\n[Event] Scan complete:', data);
  });

  // Start trader
  await trader.start();
  console.log('\nWaiting for scan cycle...\n');

  // Auto-stop after 60 seconds (one cycle)
  setTimeout(async () => {
    console.log('\n\nTest complete, stopping trader...\n');
    await trader.stop();
    process.exit(0);
  }, 65000);
}

testAutoTrader().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
