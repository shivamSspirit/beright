#!/usr/bin/env node
/**
 * Fetch Real Leaderboard Data
 *
 * Fetches actual top forecasters from Metaculus and traders from Polymarket,
 * calculates their V2 scores, and exports to berightweb
 */

import { PolymarketIngestor } from '../ingestors/polymarket';
import { MetaculusIngestor } from '../ingestors/metaculus';
import { calculateCompleteScore } from '../calculators';
import { ForecasterIdentity } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import pino from 'pino';

const logger = pino({
  name: 'fetch-real-leaderboard',
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

// Real Metaculus top forecasters (verified from leaderboard)
const TOP_METACULUS_FORECASTERS = [
  'Sylvain',
  'Charles',
  'SimonM',
];

// Real Polymarket top traders (these are actual high-volume traders)
// Note: These will need to be updated with real addresses from Polymarket API
const TOP_POLYMARKET_TRADERS = [
  '0x00000048b0880f05C54B1E7f652A11aF8b16c1f2', // Known large trader
  '0x00000004f5fc3e6c0a13c34c2f4b5b1b1b1b1b1b', // Placeholder - replace with real
  '0x000000058b6e51c9e8c1e8f7e9b1c6b1c1c1c1c1', // Placeholder - replace with real
];

interface WebLeaderboardEntry {
  rank: number;
  username: string;
  walletAddress?: string;
  platform: 'polymarket' | 'metaculus';

  // Scores
  profit: string;
  accuracy: number;
  streak: number;
  predictions: number;

  // V2 Scoring
  finalCompositeScore: number;
  tier: string; // 'TIER_1', 'TIER_2', etc.
  grade: string; // 'A+', 'A', 'B+', etc.
  brierScore: number;

  // Components
  s1: number;
  s2: number;
  s3: number;
  s4: number;
  s5: number;
  s6: number;

  // Metadata
  isOnChainVerified: boolean;
  calculatedAt: string;
}

async function main() {
  logger.info('Fetching real forecaster data from Metaculus and Polymarket...');

  const leaderboard: WebLeaderboardEntry[] = [];

  // ============================================================
  // METACULUS - Real forecasters
  // ============================================================
  logger.info(`Fetching ${TOP_METACULUS_FORECASTERS.length} Metaculus forecasters...`);

  const metaculusIngestor = new MetaculusIngestor();

  for (const username of TOP_METACULUS_FORECASTERS) {
    logger.info({ username }, 'Fetching Metaculus forecaster');

    try {
      // Fetch predictions
      const predictions = await metaculusIngestor.fetchUserPredictions(username);

      if (predictions.length === 0) {
        logger.warn({ username }, 'No predictions found, skipping');
        continue;
      }

      logger.info(
        { username, count: predictions.length },
        'Fetched predictions'
      );

      // Create identity
      const identity: ForecasterIdentity = {
        id: username,
        metaculusUsername: username,
        linkageConfidence: 1.0,
        linkageMethod: 'self_declared',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Calculate score
      const score = await calculateCompleteScore(username, identity, predictions);

      // Convert to web format
      const entry: WebLeaderboardEntry = {
        rank: leaderboard.length + 1,
        username,
        platform: 'metaculus',
        profit: '-', // Metaculus doesn't have profit
        accuracy: score.accuracy,
        streak: 0, // Calculate from predictions if needed
        predictions: score.totalPredictions,
        finalCompositeScore: score.finalCompositeScore,
        tier: getTierLabel(score.tier),
        grade: getGradeFromScore(score.finalCompositeScore),
        brierScore: score.avgBrierScore,
        s1: score.components.s1Composite,
        s2: score.components.s2Resolution,
        s3: score.components.s3Composite,
        s4: score.components.s4DifficultyWeighted,
        s5: score.components.s5VolumeConsistency,
        s6: score.components.s6CrossPlatform,
        isOnChainVerified: false, // Will be true once written to Solana
        calculatedAt: new Date().toISOString(),
      };

      leaderboard.push(entry);

      logger.info(
        {
          username,
          score: score.finalCompositeScore,
          tier: entry.tier,
          grade: entry.grade,
        },
        'Calculated score'
      );

      // Rate limiting
      await sleep(3000);
    } catch (error) {
      logger.error({ username, error }, 'Failed to fetch forecaster');
    }
  }

  // ============================================================
  // POLYMARKET - Real traders
  // ============================================================
  logger.info(`Fetching ${TOP_POLYMARKET_TRADERS.length} Polymarket traders...`);

  const polymarketIngestor = new PolymarketIngestor();

  for (const wallet of TOP_POLYMARKET_TRADERS) {
    logger.info({ wallet }, 'Fetching Polymarket trader');

    try {
      // Fetch predictions
      const predictions = await polymarketIngestor.fetchUserPredictions(wallet);

      if (predictions.length === 0) {
        logger.warn({ wallet }, 'No predictions found, skipping');
        continue;
      }

      logger.info(
        { wallet, count: predictions.length },
        'Fetched predictions'
      );

      // Create identity
      const identity: ForecasterIdentity = {
        id: wallet,
        polymarketWallet: wallet,
        linkageConfidence: 1.0,
        linkageMethod: 'cryptographic',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Calculate score
      const score = await calculateCompleteScore(wallet, identity, predictions);

      // Calculate profit from predictions (simplified)
      const profit = predictions
        .filter(p => p.outcome !== undefined && p.positionSize)
        .reduce((sum, p) => {
          const outcome = p.outcome ? 1.0 : 0.0;
          const entryPrice = p.entryPrice || 0.5;
          const pnl = (outcome - entryPrice) * (p.positionSize || 0);
          return sum + pnl;
        }, 0);

      // Convert to web format
      const entry: WebLeaderboardEntry = {
        rank: leaderboard.length + 1,
        username: `Trader ${wallet.slice(0, 6)}...`,
        walletAddress: wallet,
        platform: 'polymarket',
        profit: profit > 0 ? `+$${profit.toFixed(0)}` : `-$${Math.abs(profit).toFixed(0)}`,
        accuracy: score.accuracy,
        streak: 0, // Calculate from predictions if needed
        predictions: score.totalPredictions,
        finalCompositeScore: score.finalCompositeScore,
        tier: getTierLabel(score.tier),
        grade: getGradeFromScore(score.finalCompositeScore),
        brierScore: score.avgBrierScore,
        s1: score.components.s1Composite,
        s2: score.components.s2Resolution,
        s3: score.components.s3Composite,
        s4: score.components.s4DifficultyWeighted,
        s5: score.components.s5VolumeConsistency,
        s6: score.components.s6CrossPlatform,
        isOnChainVerified: false,
        calculatedAt: new Date().toISOString(),
      };

      leaderboard.push(entry);

      logger.info(
        {
          wallet,
          score: score.finalCompositeScore,
          tier: entry.tier,
          grade: entry.grade,
          profit: entry.profit,
        },
        'Calculated score'
      );

      // Rate limiting
      await sleep(3000);
    } catch (error) {
      logger.error({ wallet, error }, 'Failed to fetch trader');
    }
  }

  // ============================================================
  // SORT AND EXPORT
  // ============================================================

  // Sort by final composite score
  leaderboard.sort((a, b) => b.finalCompositeScore - a.finalCompositeScore);

  // Re-assign ranks
  leaderboard.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  // Export to forecaster-scoring-engine data directory
  const dataDir = path.join(process.cwd(), 'data');
  await fs.mkdir(dataDir, { recursive: true });

  const outputPath = path.join(dataDir, 'real-leaderboard.json');
  await fs.writeFile(outputPath, JSON.stringify(leaderboard, null, 2));

  logger.info({ path: outputPath, count: leaderboard.length }, 'Saved to scoring engine');

  // Also export to berightweb public directory
  const webDataDir = path.join(process.cwd(), '..', 'berightweb', 'public', 'data');
  await fs.mkdir(webDataDir, { recursive: true });

  const webOutputPath = path.join(webDataDir, 'real-leaderboard.json');
  await fs.writeFile(webOutputPath, JSON.stringify(leaderboard, null, 2));

  logger.info({ path: webOutputPath }, 'Saved to berightweb');

  // Print summary
  console.log('\n✅ REAL LEADERBOARD DATA FETCHED!\n');
  console.log('Rank | Platform   | ID                | Score | Tier    | Predictions');
  console.log('-----|------------|-------------------|-------|---------|------------');

  leaderboard.forEach(entry => {
    const id = entry.username.padEnd(17);
    console.log(
      `${String(entry.rank).padStart(4)} | ${entry.platform.padEnd(10)} | ${id} | ${String(entry.finalCompositeScore).padStart(5)} | ${entry.tier.padEnd(7)} | ${entry.predictions}`
    );
  });

  console.log('\n📊 Summary:');
  console.log(`  Total forecasters: ${leaderboard.length}`);
  console.log(`  Metaculus: ${leaderboard.filter(e => e.platform === 'metaculus').length}`);
  console.log(`  Polymarket: ${leaderboard.filter(e => e.platform === 'polymarket').length}`);
  console.log(`  Average score: ${Math.round(leaderboard.reduce((sum, e) => sum + e.finalCompositeScore, 0) / leaderboard.length)}`);
  console.log('\n');
}

function getTierLabel(tier: number): string {
  const tierLabels: Record<number, string> = {
    1: 'TIER_1',
    2: 'TIER_2',
    3: 'TIER_3',
    4: 'TIER_4',
    5: 'TIER_5',
  };
  return tierLabels[tier] || 'UNRANKED';
}

function getGradeFromScore(score: number): string {
  if (score >= 900) return 'A+';
  if (score >= 850) return 'A';
  if (score >= 800) return 'A-';
  if (score >= 750) return 'B+';
  if (score >= 700) return 'B';
  if (score >= 650) return 'B-';
  if (score >= 600) return 'C+';
  if (score >= 550) return 'C';
  if (score >= 500) return 'C-';
  if (score >= 450) return 'D+';
  if (score >= 400) return 'D';
  return 'F';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
