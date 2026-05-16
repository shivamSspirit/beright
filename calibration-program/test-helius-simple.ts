#!/usr/bin/env ts-node
/**
 * BeRight Calibration Program - Helius Testing Script (Simplified)
 *
 * Tests the on-chain calibration program using Helius RPC.
 * This version bypasses client.ts to avoid TypeScript compilation errors.
 *
 * Usage:
 *   npm run test:calibration
 *   npm run test:calibration -- --forecaster <WALLET_ADDRESS>
 */

import { Connection, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../.env' });

// ============================================================================
// CONSTANTS
// ============================================================================

const CALIBRATION_PROGRAM_ID = new PublicKey(
  'GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ' // pragma: allowlist secret
);

const HELIUS_RPC_URL =
  process.env.HELIUS_RPC_DEVNET ||
  process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL ||
  'https://api.devnet.solana.com';

// ============================================================================
// PDA DERIVATION
// ============================================================================

function deriveForecasterPda(forecasterPubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('forecaster'), forecasterPubkey.toBuffer()],
    CALIBRATION_PROGRAM_ID
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatPubkey(pubkey: PublicKey): string {
  const str = pubkey.toBase58();
  return `${str.slice(0, 4)}...${str.slice(-4)}`;
}

function formatMarketId(buffer: Buffer): string {
  const str = buffer.toString('utf8').replace(/\0/g, '');
  return str.length > 40 ? `${str.slice(0, 40)}...` : str;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

// ============================================================================
// ACCOUNT PARSING
// ============================================================================

interface ForecasterAccount {
  bump: number;
  authority: PublicKey;
  totalPredictions: number;
  resolvedPredictions: number;
  cumulativeBrierScore: number;
  avgBrierScore: number;
  cumulativeLogScore: number;
  avgLogScore: number;
  correctPredictions: number;
  accuracy: number;
  marketsTraded: number;
  bestCategory: number;
  worstCategory: number;
  streakCorrect: number;
  maxStreakCorrect: number;
  lastPredictionTs: number;
  createdAt: number;
}

interface PredictionAccount {
  bump: number;
  forecaster: PublicKey;
  marketId: Buffer;
  predictedProbability: number;
  direction: 'YES' | 'NO';
  committedAt: number;
  resolvedAt?: number;
  outcome?: boolean;
  brierScore?: number;
  logScore?: number;
  memoTxSignature: Buffer;
  category: number;
  version: number;
}

function parseForecasterAccount(data: Buffer): ForecasterAccount | null {
  try {
    // Anchor adds 8-byte discriminator
    let offset = 8;

    const bump = data.readUInt8(offset);
    offset += 1;

    const authority = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const totalPredictions = data.readUInt32LE(offset);
    offset += 4;

    const resolvedPredictions = data.readUInt32LE(offset);
    offset += 4;

    const cumulativeBrierScore = data.readDoubleLE(offset);
    offset += 8;

    const avgBrierScore = data.readDoubleLE(offset);
    offset += 8;

    const cumulativeLogScore = data.readDoubleLE(offset);
    offset += 8;

    const avgLogScore = data.readDoubleLE(offset);
    offset += 8;

    const correctPredictions = data.readUInt32LE(offset);
    offset += 4;

    const accuracy = data.readDoubleLE(offset);
    offset += 8;

    const marketsTraded = data.readUInt16LE(offset);
    offset += 2;

    const bestCategory = data.readUInt8(offset);
    offset += 1;

    const worstCategory = data.readUInt8(offset);
    offset += 1;

    const streakCorrect = data.readUInt16LE(offset);
    offset += 2;

    const maxStreakCorrect = data.readUInt16LE(offset);
    offset += 2;

    const lastPredictionTs = Number(data.readBigInt64LE(offset));
    offset += 8;

    const createdAt = Number(data.readBigInt64LE(offset));

    return {
      bump,
      authority,
      totalPredictions,
      resolvedPredictions,
      cumulativeBrierScore,
      avgBrierScore,
      cumulativeLogScore,
      avgLogScore,
      correctPredictions,
      accuracy,
      marketsTraded,
      bestCategory,
      worstCategory,
      streakCorrect,
      maxStreakCorrect,
      lastPredictionTs,
      createdAt,
    };
  } catch (err) {
    console.warn('Failed to parse forecaster account:', err);
    return null;
  }
}

function parsePredictionAccount(data: Buffer): PredictionAccount | null {
  try {
    // Anchor adds 8-byte discriminator
    let offset = 8;

    const bump = data.readUInt8(offset);
    offset += 1;

    const forecaster = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const marketId = data.slice(offset, offset + 32);
    offset += 32;

    const predictedProbability = data.readDoubleLE(offset);
    offset += 8;

    // Direction enum: 0 = Yes, 1 = No
    const directionByte = data.readUInt8(offset);
    const direction = directionByte === 0 ? 'YES' : 'NO';
    offset += 1;

    const committedAt = Number(data.readBigInt64LE(offset));
    offset += 8;

    // Option<i64> for resolvedAt
    const hasResolvedAt = data.readUInt8(offset) === 1;
    offset += 1;
    let resolvedAt: number | undefined;
    if (hasResolvedAt) {
      resolvedAt = Number(data.readBigInt64LE(offset));
    }
    offset += 8;

    // Option<bool> for outcome
    const hasOutcome = data.readUInt8(offset) === 1;
    offset += 1;
    let outcome: boolean | undefined;
    if (hasOutcome) {
      outcome = data.readUInt8(offset) === 1;
    }
    offset += 1;

    // Option<f64> for brierScore
    const hasBrierScore = data.readUInt8(offset) === 1;
    offset += 1;
    let brierScore: number | undefined;
    if (hasBrierScore) {
      brierScore = data.readDoubleLE(offset);
    }
    offset += 8;

    // Option<f64> for logScore
    const hasLogScore = data.readUInt8(offset) === 1;
    offset += 1;
    let logScore: number | undefined;
    if (hasLogScore) {
      logScore = data.readDoubleLE(offset);
    }
    offset += 8;

    const memoTxSignature = data.slice(offset, offset + 64);
    offset += 64;

    const category = data.readUInt8(offset);
    offset += 1;

    const version = data.readUInt8(offset);

    return {
      bump,
      forecaster,
      marketId,
      predictedProbability,
      direction,
      committedAt,
      resolvedAt,
      outcome,
      brierScore,
      logScore,
      memoTxSignature,
      category,
      version,
    };
  } catch (err) {
    console.warn('Failed to parse prediction account:', err);
    return null;
  }
}

// ============================================================================
// MAIN TEST FUNCTIONS
// ============================================================================

async function getAllProgramAccounts(connection: Connection): Promise<{
  forecasters: Array<{ pubkey: PublicKey; account: ForecasterAccount }>;
  predictions: Array<{ pubkey: PublicKey; account: PredictionAccount }>;
}> {
  console.log('\n📊 Fetching all program accounts...\n');

  const accounts = await connection.getProgramAccounts(CALIBRATION_PROGRAM_ID, {
    commitment: 'confirmed',
  });

  console.log(`✓ Found ${accounts.length} total accounts\n`);

  const forecasters: Array<{ pubkey: PublicKey; account: ForecasterAccount }> = [];
  const predictions: Array<{ pubkey: PublicKey; account: PredictionAccount }> = [];

  for (const { pubkey, account } of accounts) {
    const data = account.data;

    // ForecasterState is ~200 bytes
    // PredictionRecord is ~200 bytes
    // Differentiate by checking first field after discriminator

    if (data.length < 100) continue;

    // Try parsing as ForecasterState first (has u8 bump, then Pubkey)
    const parsed = parseForecasterAccount(data);
    if (parsed && parsed.totalPredictions !== undefined) {
      forecasters.push({ pubkey, account: parsed });
    } else {
      // Try as PredictionRecord
      const pred = parsePredictionAccount(data);
      if (pred) {
        predictions.push({ pubkey, account: pred });
      }
    }
  }

  return { forecasters, predictions };
}

async function testForecaster(
  connection: Connection,
  forecasterAddress: string
): Promise<void> {
  console.log(`\n🔍 Testing forecaster: ${forecasterAddress}\n`);

  const forecasterPubkey = new PublicKey(forecasterAddress);
  const [forecasterPda] = deriveForecasterPda(forecasterPubkey);

  console.log(`Forecaster PDA: ${forecasterPda.toBase58()}\n`);

  try {
    const accountInfo = await connection.getAccountInfo(forecasterPda, 'confirmed');

    if (!accountInfo) {
      console.log('❌ Forecaster not initialized\n');
      console.log('This wallet has not made any predictions yet.\n');
      return;
    }

    console.log('✓ Forecaster account found\n');
    console.log(`Owner: ${accountInfo.owner.toBase58()}`);
    console.log(`Data length: ${accountInfo.data.length} bytes`);
    console.log(`Lamports: ${accountInfo.lamports / 1e9} SOL\n`);

    const forecaster = parseForecasterAccount(accountInfo.data);

    if (!forecaster) {
      console.log('❌ Failed to parse forecaster account\n');
      return;
    }

    console.log('📈 Forecaster Stats:\n');
    console.log(`  Authority: ${forecaster.authority.toBase58()}`);
    console.log(`  Total Predictions: ${forecaster.totalPredictions}`);
    console.log(`  Resolved Predictions: ${forecaster.resolvedPredictions}`);
    console.log(`  Average Brier Score: ${forecaster.avgBrierScore.toFixed(4)}`);
    console.log(`  Average Log Score: ${forecaster.avgLogScore.toFixed(4)}`);
    console.log(`  Accuracy: ${(forecaster.accuracy * 100).toFixed(1)}%`);
    console.log(`  Correct Predictions: ${forecaster.correctPredictions}`);
    console.log(`  Current Streak: ${forecaster.streakCorrect}`);
    console.log(`  Max Streak: ${forecaster.maxStreakCorrect}`);
    console.log(`  Markets Traded: ${forecaster.marketsTraded}`);
    console.log(`  Account Created: ${formatTimestamp(forecaster.createdAt)}`);
    console.log('');

    // Rating
    const brier = forecaster.avgBrierScore;
    if (forecaster.resolvedPredictions === 0) {
      console.log('📊 No resolved predictions yet\n');
    } else if (brier < 0.20) {
      console.log('🏆 WORLD-CLASS forecaster (Brier < 0.20)\n');
    } else if (brier < 0.25) {
      console.log('⭐ SUPERFORECASTER level (Brier < 0.25)\n');
    } else if (brier < 0.30) {
      console.log('✓ Good forecaster (Brier < 0.30)\n');
    } else {
      console.log('📊 Developing forecaster\n');
    }

    // Fetch predictions
    console.log('🔎 Fetching prediction history...\n');

    const allAccounts = await connection.getProgramAccounts(CALIBRATION_PROGRAM_ID, {
      filters: [
        {
          memcmp: {
            offset: 9, // After discriminator (8) + bump (1)
            bytes: forecasterPubkey.toBase58(),
          },
        },
      ],
    });

    const predictions = allAccounts
      .map(({ pubkey, account }) => parsePredictionAccount(account.data))
      .filter((p): p is PredictionAccount => p !== null);

    console.log(`Found ${predictions.length} predictions\n`);

    if (predictions.length > 0) {
      console.log('Recent Predictions:\n');
      predictions.slice(0, 5).forEach((pred, i) => {
        console.log(`${i + 1}. ${formatMarketId(pred.marketId)}`);
        console.log(
          `   Predicted: ${pred.direction} @ ${(pred.predictedProbability * 100).toFixed(1)}%`
        );
        console.log(`   Committed: ${formatTimestamp(pred.committedAt)}`);
        if (pred.resolvedAt && pred.outcome !== undefined) {
          console.log(
            `   Outcome: ${pred.outcome ? 'YES' : 'NO'} | Brier: ${pred.brierScore?.toFixed(4)}`
          );
        } else {
          console.log(`   Status: Pending resolution`);
        }
        console.log('');
      });
    }
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

function displaySummary(
  forecasters: Array<{ pubkey: PublicKey; account: ForecasterAccount }>,
  predictions: Array<{ pubkey: PublicKey; account: PredictionAccount }>
): void {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                    CALIBRATION PROGRAM SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Program ID: ${CALIBRATION_PROGRAM_ID.toBase58()}`);
  console.log(`Network: Devnet\n`);

  console.log('📊 Overall Stats:\n');
  console.log(`  Total Forecasters: ${forecasters.length}`);
  console.log(`  Total Predictions: ${predictions.length}`);

  const resolvedCount = predictions.filter((p) => p.account.outcome !== undefined).length;
  console.log(`  Resolved Predictions: ${resolvedCount}`);
  console.log(`  Pending Predictions: ${predictions.length - resolvedCount}\n`);

  if (forecasters.length > 0) {
    console.log('🏆 Top Forecasters (by Brier Score):\n');

    const sorted = forecasters
      .filter((f) => f.account.resolvedPredictions > 0)
      .sort((a, b) => a.account.avgBrierScore - b.account.avgBrierScore);

    sorted.slice(0, 5).forEach((f, i) => {
      const rank = i + 1;
      const badge = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      console.log(`  ${badge} ${formatPubkey(f.account.authority)}`);
      console.log(
        `      Brier: ${f.account.avgBrierScore.toFixed(4)} | Predictions: ${f.account.totalPredictions} | Resolved: ${f.account.resolvedPredictions}`
      );
    });
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════\n');
}

async function testConnection(connection: Connection): Promise<boolean> {
  console.log('🔌 Testing Helius RPC connection...\n');
  console.log(`RPC URL: ${HELIUS_RPC_URL}\n`);

  try {
    const version = await connection.getVersion();
    console.log(`✓ Connected to Solana ${version['solana-core']}\n`);

    const slot = await connection.getSlot();
    console.log(`Current slot: ${slot}\n`);

    return true;
  } catch (err) {
    console.error('❌ Connection failed:', err);
    console.log('\nTroubleshooting:');
    console.log('  1. Check HELIUS_API_KEY in .env');
    console.log('  2. Verify HELIUS_RPC_DEVNET is set');
    console.log('  3. Test manually: curl https://api.devnet.solana.com');
    console.log('');
    return false;
  }
}

async function testProgramDeployment(connection: Connection): Promise<boolean> {
  console.log('📦 Testing calibration program deployment...\n');

  try {
    const accountInfo = await connection.getAccountInfo(CALIBRATION_PROGRAM_ID);

    if (!accountInfo) {
      console.log('❌ Program not found on devnet\n');
      console.log(`Expected program ID: ${CALIBRATION_PROGRAM_ID.toBase58()}\n`);
      return false;
    }

    console.log('✓ Program deployed\n');
    console.log(`Owner: ${accountInfo.owner.toBase58()}`);
    console.log(`Executable: ${accountInfo.executable}`);
    console.log(`Data length: ${accountInfo.data.length} bytes\n`);

    return true;
  } catch (err) {
    console.error('❌ Error checking program:', err);
    return false;
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║    BeRight Calibration Program - Helius Test Suite        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const args = process.argv.slice(2);
  const forecasterFlag = args.indexOf('--forecaster');
  const specificForecaster = forecasterFlag !== -1 ? args[forecasterFlag + 1] : null;

  if (!process.env.HELIUS_API_KEY && !HELIUS_RPC_URL.includes('api-key')) {
    console.warn('⚠️  HELIUS_API_KEY not set - using public RPC (may be slow)\n');
  }

  const connection = new Connection(HELIUS_RPC_URL, 'confirmed');

  const connected = await testConnection(connection);
  if (!connected) {
    process.exit(1);
  }

  const deployed = await testProgramDeployment(connection);
  if (!deployed) {
    process.exit(1);
  }

  if (specificForecaster) {
    await testForecaster(connection, specificForecaster);
  } else {
    const { forecasters, predictions } = await getAllProgramAccounts(connection);
    displaySummary(forecasters, predictions);

    if (forecasters.length > 0) {
      console.log('💡 Tip: Test a specific forecaster with:\n');
      console.log(
        `   npm run test:calibration -- --forecaster ${forecasters[0].account.authority.toBase58()}\n`
      );
    }
  }

  console.log('✅ Test completed!\n');
  console.log(
    'Explorer: https://explorer.solana.com/address/' +
      CALIBRATION_PROGRAM_ID.toBase58() +
      '?cluster=devnet\n'
  );
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
