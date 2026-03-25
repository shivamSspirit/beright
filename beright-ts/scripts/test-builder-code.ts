#!/usr/bin/env npx ts-node
/**
 * Test Kalshi Builder Code Integration
 *
 * Tests that Builder Code fee parameters are correctly included in DFlow orders.
 *
 * Usage:
 *   npx ts-node scripts/test-builder-code.ts
 *
 * With custom config:
 *   DFLOW_FEE_ACCOUNT=BRF... DFLOW_PLATFORM_FEE_BPS=100 npx ts-node scripts/test-builder-code.ts
 */

import {
  getBuilderCodeConfig,
  getDFlowOrderTransaction,
  getDFlowClient,
  getDFlowHotMarkets,
  USDC_MINT,
  DFlowMarket
} from '../lib/dflow';

// Test wallet (devnet test wallet - DO NOT USE IN PRODUCTION)
const TEST_WALLET = 'GsbwXfJraMomNxBcjYLcG3mxkBUiyWXAB32fGbSMQRdW';

async function testBuilderCodeConfig() {
  console.log('\n========================================');
  console.log('TEST 1: Builder Code Configuration');
  console.log('========================================\n');

  const config = getBuilderCodeConfig();

  console.log('Current Builder Code Config:');
  console.log('─'.repeat(40));
  console.log(`  Fee Account:     ${config.feeAccount || '(not set)'}`);
  console.log(`  Platform Fee:    ${config.platformFeeBps} bps (${config.platformFeeBps / 100}%)`);
  console.log(`  Fee Scale:       ${config.platformFeeScale}`);
  console.log(`  Enabled:         ${config.enabled ? '✅ YES' : '❌ NO'}`);
  console.log('');

  if (!config.enabled) {
    console.log('⚠️  Builder Code is DISABLED');
    console.log('   To enable, set these environment variables:');
    console.log('   - DFLOW_FEE_ACCOUNT=<your_solana_wallet_pubkey>');
    console.log('   - DFLOW_PLATFORM_FEE_BPS=50  (optional, default 50)');
    console.log('');
  }

  return config;
}

async function testDFlowConnection() {
  console.log('\n========================================');
  console.log('TEST 2: DFlow API Connection');
  console.log('========================================\n');

  try {
    const client = getDFlowClient();
    const markets = await getDFlowHotMarkets(3);

    console.log(`✅ Connected to DFlow API`);
    console.log(`   Found ${markets.length} hot markets:\n`);

    for (const event of markets) {
      const market = event.markets?.[0];
      if (market) {
        const yesBid = parseFloat(market.yesBid || '0');
        const yesAsk = parseFloat(market.yesAsk || '0');
        const midPrice = ((yesBid + yesAsk) / 2 * 100).toFixed(1);
        console.log(`   [${event.ticker}]`);
        console.log(`   ${event.title}`);
        console.log(`   YES: ${midPrice}% | Vol24h: $${(event.volume24h || 0).toLocaleString()}`);
        console.log('');
      }
    }

    return markets[0]?.markets?.[0] || null;
  } catch (error) {
    console.log(`❌ Failed to connect to DFlow API`);
    console.log(`   Error: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

async function testOrderWithBuilderCode(market: DFlowMarket | null) {
  console.log('\n========================================');
  console.log('TEST 3: Order Request with Builder Code');
  console.log('========================================\n');

  if (!market) {
    console.log('⚠️  No market available for testing');
    console.log('   Skipping order test');
    return;
  }

  const config = getBuilderCodeConfig();
  const usdcAccount = market.accounts?.[USDC_MINT];

  if (!usdcAccount?.yesMint) {
    console.log('⚠️  Market not initialized for trading');
    console.log('   Skipping order test');
    return;
  }

  console.log(`Testing order for: ${market.title}`);
  console.log(`Output Mint (YES): ${usdcAccount.yesMint.slice(0, 20)}...`);
  console.log('');

  try {
    // Request a small quote (1 USDC)
    const testAmount = 1_000_000; // 1 USDC in lamports

    console.log('Requesting quote from DFlow...');
    console.log(`  Input: 1 USDC`);
    console.log(`  Output: YES tokens`);
    console.log(`  Wallet: ${TEST_WALLET.slice(0, 8)}...`);

    if (config.enabled) {
      console.log(`  Fee Account: ${config.feeAccount?.slice(0, 8)}...`);
      console.log(`  Fee BPS: ${config.platformFeeBps}`);
    }
    console.log('');

    const order = await getDFlowOrderTransaction({
      inputMint: USDC_MINT,
      outputMint: usdcAccount.yesMint,
      amount: testAmount,
      userPublicKey: TEST_WALLET,
      slippageBps: 100,
    });

    console.log('✅ Order quote received!\n');
    console.log('Order Details:');
    console.log('─'.repeat(40));
    console.log(`  Input Amount:    ${parseInt(order.inAmount) / 1e6} USDC`);
    console.log(`  Output Amount:   ${parseInt(order.outAmount) / 1e6} shares`);
    console.log(`  Price Impact:    ${order.priceImpactPct}%`);
    console.log(`  Execution Mode:  ${order.executionMode}`);
    console.log(`  Slippage:        ${order.slippageBps} bps`);

    if (order.platformFee) {
      console.log('');
      console.log('Platform Fee (Builder Code):');
      console.log(`  Fee Amount:      ${parseInt(order.platformFee.amount) / 1e6} USDC`);
      console.log(`  Fee BPS:         ${order.platformFee.feeBps}`);
      console.log('  ✅ Builder Code fees are being applied!');
    } else if (config.enabled) {
      console.log('');
      console.log('⚠️  Platform fee not shown in response');
      console.log('   (Fee may still be applied - check transaction)');
    }

    console.log('');
    console.log(`Transaction: ${order.transaction ? '✅ Ready to sign' : '❌ Not available'}`);

    if (order.transaction) {
      const txSize = Buffer.from(order.transaction, 'base64').length;
      console.log(`  Size: ${txSize} bytes`);
    }

  } catch (error) {
    console.log(`❌ Order request failed`);
    console.log(`   Error: ${error instanceof Error ? error.message : error}`);
  }
}

async function testOrderWithoutBuilderCode(market: DFlowMarket | null) {
  console.log('\n========================================');
  console.log('TEST 4: Order WITHOUT Builder Code');
  console.log('========================================\n');

  if (!market) {
    console.log('⚠️  No market available for testing');
    return;
  }

  const usdcAccount = market.accounts?.[USDC_MINT];

  if (!usdcAccount?.yesMint) {
    console.log('⚠️  Market not initialized');
    return;
  }

  console.log('Testing order with Builder Code DISABLED...\n');

  try {
    const testAmount = 1_000_000; // 1 USDC

    const order = await getDFlowOrderTransaction({
      inputMint: USDC_MINT,
      outputMint: usdcAccount.yesMint,
      amount: testAmount,
      userPublicKey: TEST_WALLET,
      slippageBps: 100,
      // Explicitly disable Builder Code
      builderCode: {
        enabled: false,
      },
    });

    console.log('✅ Order quote received (no Builder Code)\n');
    console.log(`  Input:  ${parseInt(order.inAmount) / 1e6} USDC`);
    console.log(`  Output: ${parseInt(order.outAmount) / 1e6} shares`);

    if (order.platformFee) {
      console.log(`  Fee:    ${parseInt(order.platformFee.amount) / 1e6} USDC`);
    } else {
      console.log(`  Fee:    None (Builder Code disabled)`);
    }

  } catch (error) {
    console.log(`❌ Order request failed: ${error instanceof Error ? error.message : error}`);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Kalshi Builder Code Integration Test  ║');
  console.log('╚════════════════════════════════════════╝');

  // Test 1: Check config
  await testBuilderCodeConfig();

  // Test 2: Connect to DFlow
  const market = await testDFlowConnection();

  // Test 3: Order with Builder Code
  await testOrderWithBuilderCode(market);

  // Test 4: Order without Builder Code (comparison)
  await testOrderWithoutBuilderCode(market);

  console.log('\n========================================');
  console.log('TEST COMPLETE');
  console.log('========================================\n');

  const config = getBuilderCodeConfig();
  if (config.enabled) {
    console.log('✅ Builder Code is ACTIVE');
    console.log(`   All trades will include ${config.platformFeeBps}bps fee`);
    console.log(`   Fees go to: ${config.feeAccount}`);
  } else {
    console.log('⚠️  Builder Code is NOT active');
    console.log('   Set DFLOW_FEE_ACCOUNT to enable');
  }
  console.log('');
}

main().catch(console.error);
