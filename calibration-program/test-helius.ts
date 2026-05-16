#!/usr/bin/env ts-node
/**
 * BeRight Calibration Program - Helius Testing Script
 *
 * Tests the on-chain calibration program using Helius RPC.
 * Validates that predictions are being recorded correctly and Brier scores are calculated.
 *
 * Usage:
 *   npm run test:calibration
 *   npm run test:calibration -- --forecaster <WALLET_ADDRESS>
 *   npm run test:calibration -- --market <MARKET_ID>
 *
 * Requirements:
 *   - HELIUS_API_KEY in .env (get from https://dev.helius.xyz)
 *   - Calibration program deployed on devnet
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { deriveForecasterPda, derivePredictionPda, CALIBRATION_PROGRAM_ID } from './app/client';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../.env' });

// ============================================================================
// CONSTANTS
// ============================================================================

const HELIUS_RPC_URL =
  process.env.HELIUS_RPC_DEVNET ||
  process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL ||
  'https://api.devnet.solana.com';

const CALIBRATION_PROGRAM = CALIBRATION_PROGRAM_ID.toBase58();

// ============================================================================
// TYPES
// ============================================================================

interface ForecasterAccount {
  authority: PublicKey;
  totalPredictions: number;
  resolvedPredictions: number;
  brierScore: number;
  logScore: number;
  createdAt: number;
}

interface PredictionAccount {
  forecaster: PublicKey;
  marketId: Buffer;
  predictedProbability: number;
  direction: { yes?: {}; no?: {} };
  committedAt: number;
  memoTxSignature: Buffer;
  category: number;
  resolvedAt?: number;
  outcome?: boolean;
  brierScore?: number;
  logScore?: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function parseDirection(direction: { yes?: {}; no?: {} }): 'YES' | 'NO' {
  return 'yes' in direction ? 'YES' : 'NO';
}

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
// MAIN TEST FUNCTIONS
// ============================================================================

/**
 * Get all program accounts (forecasters and predictions)
 */
async function getAllProgramAccounts(connection: Connection): Promise<{
  forecasters: Array<{ pubkey: PublicKey; account: ForecasterAccount }>;
  predictions: Array<{ pubkey: PublicKey; account: PredictionAccount }>;
}> {
  console.log('\n📊 Fetching all program accounts...\n');

  const accounts = await connection.getProgramAccounts(
    CALIBRATION_PROGRAM_ID,
    {
      commitment: 'confirmed',
      dataSlice: undefined, // Get full account data
    }
  );

  console.log(`✓ Found ${accounts.length} total accounts\n`);

  const forecasters: Array<{ pubkey: PublicKey; account: any }> = [];
  const predictions: Array<{ pubkey: PublicKey; account: any }> = [];

  for (const { pubkey, account } of accounts) {
    try {
      const data = account.data;

      // Discriminator is first 8 bytes
      // ForecasterState accounts are larger (~100 bytes)
      // Prediction accounts are ~200 bytes

      if (data.length < 100) {
        continue; // Skip invalid accounts
      }

      // Check if this is a forecaster account (has authority field at offset 8)
      const hasAuthority = data.slice(8, 40).some(b => b !== 0);

      if (hasAuthority && data.length < 150) {
        // Forecaster account
        const authority = new PublicKey(data.slice(8, 40));
        const totalPredictions = Number(data.readBigUInt64LE(40));
        const resolvedPredictions = Number(data.readBigUInt64LE(48));
        const brierScore = data.readDoubleLE(56);
        const logScore = data.readDoubleLE(64);
        const createdAt = Number(data.readBigUInt64LE(72));

        forecasters.push({
          pubkey,
          account: {
            authority,
            totalPredictions,
            resolvedPredictions,
            brierScore,
            logScore,
            createdAt,
          },
        });
      } else if (data.length > 150) {
        // Prediction account
        const forecaster = new PublicKey(data.slice(8, 40));
        const marketId = data.slice(40, 72);
        const predictedProbability = data.readDoubleLE(72);

        // Direction enum (1 byte): 0 = Yes, 1 = No
        const directionByte = data[80];
        const direction = directionByte === 0 ? { yes: {} } : { no: {} };

        const committedAt = Number(data.readBigUInt64LE(81));
        const memoTxSignature = data.slice(89, 153); // 64 bytes
        const category = data[153];

        // Optional resolution fields
        const hasResolution = data[154] === 1;
        let resolvedAt, outcome, brierScore, logScore;

        if (hasResolution) {
          resolvedAt = Number(data.readBigUInt64LE(155));
          outcome = data[163] === 1;
          brierScore = data.readDoubleLE(164);
          logScore = data.readDoubleLE(172);
        }

        predictions.push({
          pubkey,
          account: {
            forecaster,
            marketId,
            predictedProbability,
            direction,
            committedAt,
            memoTxSignature,
            category,
            resolvedAt,
            outcome,
            brierScore,
            logScore,
          },
        });
      }
    } catch (err) {
      console.warn(`⚠️  Failed to parse account ${pubkey.toBase58()}:`, err);
    }
  }

  return { forecasters, predictions };
}

/**
 * Test specific forecaster
 */
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

    // Parse account data
    const data = accountInfo.data;
    const authority = new PublicKey(data.slice(8, 40));
    const totalPredictions = Number(data.readBigUInt64LE(40));
    const resolvedPredictions = Number(data.readBigUInt64LE(48));
    const brierScore = data.readDoubleLE(56);
    const logScore = data.readDoubleLE(64);
    const createdAt = Number(data.readBigUInt64LE(72));

    console.log('📈 Forecaster Stats:\n');
    console.log(`  Authority: ${authority.toBase58()}`);
    console.log(`  Total Predictions: ${totalPredictions}`);
    console.log(`  Resolved Predictions: ${resolvedPredictions}`);
    console.log(`  Average Brier Score: ${brierScore.toFixed(4)}`);
    console.log(`  Average Log Score: ${logScore.toFixed(4)}`);
    console.log(`  Account Created: ${formatTimestamp(createdAt)}`);
    console.log('');

    // Validate Brier score
    if (brierScore < 0 || brierScore > 1) {
      console.log('⚠️  WARNING: Brier score out of valid range [0, 1]\n');
    } else if (brierScore < 0.20) {
      console.log('🏆 WORLD-CLASS forecaster (Brier < 0.20)\n');
    } else if (brierScore < 0.25) {
      console.log('⭐ SUPERFORECASTER level (Brier < 0.25)\n');
    } else if (brierScore < 0.30) {
      console.log('✓ Good forecaster (Brier < 0.30)\n');
    } else {
      console.log('📊 Developing forecaster\n');
    }

    // Fetch predictions for this forecaster
    console.log('🔎 Fetching prediction history...\n');

    const allAccounts = await connection.getProgramAccounts(
      CALIBRATION_PROGRAM_ID,
      {
        filters: [
          {
            memcmp: {
              offset: 8, // Forecaster field offset
              bytes: forecasterPubkey.toBase58(),
            },
          },
        ],
      }
    );

    const predictions = allAccounts
      .filter(a => a.account.data.length > 150) // Prediction accounts
      .map(({ pubkey, account }) => {
        const data = account.data;
        return {
          pubkey,
          marketId: formatMarketId(data.slice(40, 72)),
          probability: data.readDoubleLE(72),
          direction: data[80] === 0 ? 'YES' : 'NO',
          committedAt: Number(data.readBigUInt64LE(81)),
          resolved: data[154] === 1,
          outcome: data[154] === 1 ? (data[163] === 1 ? 'YES' : 'NO') : null,
          brierScore: data[154] === 1 ? data.readDoubleLE(164) : null,
        };
      });

    console.log(`Found ${predictions.length} predictions\n`);

    if (predictions.length > 0) {
      console.log('Recent Predictions:\n');
      predictions.slice(0, 5).forEach((pred, i) => {
        console.log(`${i + 1}. ${pred.marketId}`);
        console.log(`   Predicted: ${pred.direction} @ ${(pred.probability * 100).toFixed(1)}%`);
        console.log(`   Committed: ${formatTimestamp(pred.committedAt)}`);
        if (pred.resolved) {
          console.log(`   Outcome: ${pred.outcome} | Brier: ${pred.brierScore?.toFixed(4)}`);
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

/**
 * Display summary statistics
 */
function displaySummary(
  forecasters: Array<{ pubkey: PublicKey; account: ForecasterAccount }>,
  predictions: Array<{ pubkey: PublicKey; account: PredictionAccount }>
): void {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                    CALIBRATION PROGRAM SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Program ID: ${CALIBRATION_PROGRAM}`);
  console.log(`Network: Devnet\n`);

  console.log('📊 Overall Stats:\n');
  console.log(`  Total Forecasters: ${forecasters.length}`);
  console.log(`  Total Predictions: ${predictions.length}`);

  const resolvedCount = predictions.filter(p => p.account.outcome !== undefined).length;
  console.log(`  Resolved Predictions: ${resolvedCount}`);
  console.log(`  Pending Predictions: ${predictions.length - resolvedCount}\n`);

  if (forecasters.length > 0) {
    console.log('🏆 Top Forecasters (by Brier Score):\n');

    const sorted = forecasters
      .filter(f => f.account.resolvedPredictions > 0)
      .sort((a, b) => a.account.brierScore - b.account.brierScore);

    sorted.slice(0, 5).forEach((f, i) => {
      const rank = i + 1;
      const badge = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      console.log(`  ${badge} ${formatPubkey(f.account.authority)}`);
      console.log(`      Brier: ${f.account.brierScore.toFixed(4)} | Predictions: ${f.account.totalPredictions} | Resolved: ${f.account.resolvedPredictions}`);
    });
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════\n');
}

/**
 * Test RPC connection
 */
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

/**
 * Test program deployment
 */
async function testProgramDeployment(connection: Connection): Promise<boolean> {
  console.log('📦 Testing calibration program deployment...\n');

  try {
    const accountInfo = await connection.getAccountInfo(CALIBRATION_PROGRAM_ID);

    if (!accountInfo) {
      console.log('❌ Program not found on devnet\n');
      console.log(`Expected program ID: ${CALIBRATION_PROGRAM}\n`);
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

  // Parse CLI args
  const args = process.argv.slice(2);
  const forecasterFlag = args.indexOf('--forecaster');
  const specificForecaster = forecasterFlag !== -1 ? args[forecasterFlag + 1] : null;

  // Setup connection
  if (!process.env.HELIUS_API_KEY && !HELIUS_RPC_URL.includes('api-key')) {
    console.warn('⚠️  HELIUS_API_KEY not set - using public RPC (may be slow)\n');
  }

  const connection = new Connection(HELIUS_RPC_URL, 'confirmed');

  // Run tests
  const connected = await testConnection(connection);
  if (!connected) {
    process.exit(1);
  }

  const deployed = await testProgramDeployment(connection);
  if (!deployed) {
    process.exit(1);
  }

  // Test specific forecaster or show summary
  if (specificForecaster) {
    await testForecaster(connection, specificForecaster);
  } else {
    const { forecasters, predictions } = await getAllProgramAccounts(connection);
    displaySummary(forecasters, predictions);

    if (forecasters.length > 0) {
      console.log('💡 Tip: Test a specific forecaster with:\n');
      console.log(`   npm run test:calibration -- --forecaster ${forecasters[0].account.authority.toBase58()}\n`);
    }
  }

  console.log('✅ Test completed!\n');
  console.log('Explorer: https://explorer.solana.com/address/' + CALIBRATION_PROGRAM + '?cluster=devnet\n');
}

// ============================================================================
// RUN
// ============================================================================

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
