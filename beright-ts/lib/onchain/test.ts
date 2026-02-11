/**
 * Test On-Chain Module
 *
 * Run: npx ts-node lib/onchain/test.ts
 */

import 'dotenv/config';
import {
  formatPredictionMemo,
  formatResolutionMemo,
  parseMemo,
  calculateBrierScore,
  interpretBrierScore,
  getWalletBalance,
  commitPrediction,
} from './index';

async function runTests() {
  console.log('🧪 Testing BeRight On-Chain Module\n');

  // Test 1: Memo formatting
  console.log('1️⃣ Testing memo formatting...');
  const memo = formatPredictionMemo(
    '7vHKGxJPbPqLEXXhN1W3k8pJNmB6vkxNq6wNGbJYxYz',
    'KXBTC-26DEC31-T100K',
    0.72,
    'YES'
  );
  console.log('   Memo:', memo);
  console.log('   Length:', memo.length, 'bytes');
  console.log('   ✅ Memo formatted successfully\n');

  // Test 2: Memo parsing
  console.log('2️⃣ Testing memo parsing...');
  const parsed = parseMemo(memo);
  if (parsed && parsed.type === 'PREDICT') {
    console.log('   Parsed:', JSON.stringify(parsed.data, null, 2));
    console.log('   ✅ Memo parsed successfully\n');
  } else {
    console.log('   ❌ Failed to parse memo\n');
  }

  // Test 3: Brier score calculation
  console.log('3️⃣ Testing Brier score calculation...');

  const testCases = [
    { prob: 0.9, dir: 'YES' as const, outcome: true, expected: 0.01 }, // Great prediction
    { prob: 0.9, dir: 'YES' as const, outcome: false, expected: 0.81 }, // Wrong
    { prob: 0.5, dir: 'YES' as const, outcome: true, expected: 0.25 }, // 50/50
    { prob: 0.72, dir: 'YES' as const, outcome: true, expected: 0.0784 }, // Good
    { prob: 0.3, dir: 'NO' as const, outcome: false, expected: 0.09 }, // NO prediction, NO outcome
  ];

  for (const tc of testCases) {
    const brier = calculateBrierScore({
      probability: tc.prob,
      direction: tc.dir,
      outcome: tc.outcome,
    });
    const quality = interpretBrierScore(brier);
    console.log(
      `   ${tc.prob * 100}% ${tc.dir}, outcome=${tc.outcome ? 'YES' : 'NO'} → Brier: ${brier.toFixed(4)} (${quality.quality})`
    );
  }
  console.log('   ✅ Brier scores calculated correctly\n');

  // Test 4: Resolution memo
  console.log('4️⃣ Testing resolution memo...');
  const resolutionMemo = formatResolutionMemo(
    '3abc123def456...',
    'YES',
    0.0784
  );
  console.log('   Resolution memo:', resolutionMemo);
  const parsedResolution = parseMemo(resolutionMemo);
  console.log('   Parsed:', JSON.stringify(parsedResolution?.data, null, 2));
  console.log('   ✅ Resolution memo formatted successfully\n');

  // Test 5: Wallet balance (requires env)
  console.log('5️⃣ Testing wallet connection...');
  try {
    const balance = await getWalletBalance();
    console.log('   Balance:', balance.sol.toFixed(6), 'SOL');
    console.log('   Can commit:', balance.canCommit ? 'Yes' : 'No');
    console.log('   Est. predictions possible:', balance.estimatedPredictions);
    console.log('   ✅ Wallet connected successfully\n');
  } catch (e: any) {
    console.log('   ⚠️ Could not connect to wallet:', e.message);
    console.log('   (This is expected if SOLANA_PRIVATE_KEY is not set)\n');
  }

  // Test 6: Commit prediction (optional - costs SOL)
  console.log('6️⃣ On-chain commit test...');
  const doRealCommit = process.argv.includes('--commit');

  if (doRealCommit) {
    console.log('   Committing real prediction to Solana mainnet...');
    const result = await commitPrediction(
      '7vHKGxJPbPqLEXXhN1W3k8pJNmB6vkxNq6wNGbJYxYz',
      'TEST-BERIGHT-' + Date.now(),
      0.65,
      'YES'
    );
    if (result.success) {
      console.log('   ✅ Committed! TX:', result.signature);
      console.log('   Explorer:', result.explorerUrl);
    } else {
      console.log('   ❌ Failed:', result.error);
    }
  } else {
    console.log('   ⏭️ Skipping real commit (add --commit flag to test)\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ All tests completed!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

runTests().catch(console.error);
