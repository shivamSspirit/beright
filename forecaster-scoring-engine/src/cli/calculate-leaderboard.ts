#!/usr/bin/env node
/**
 * Calculate Leaderboard Scores
 *
 * Fetches top forecasters from Polymarket and Metaculus,
 * calculates their scores using our V2 system,
 * and exports to JSON for the BeRight web leaderboard
 */

import { PolymarketIngestor } from '../ingestors/polymarket';
import { MetaculusIngestor } from '../ingestors/metaculus';
import { calculateCompleteScore } from '../calculators';
import { ForecasterIdentity, ForecasterScore } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import pino from 'pino';

const logger = pino({
  name: 'calculate-leaderboard',
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

interface LeaderboardEntry {
  rank: number;
  forecasterId: string;
  platform: 'polymarket' | 'metaculus' | 'cross-platform';
  username?: string;
  walletAddress?: string;

  // Scores
  finalCompositeScore: number;
  rawCompositeScore: number;
  tier: number;
  confidenceWeight: number;

  // Component scores
  s1: number;
  s2: number;
  s3: number;
  s4: number;
  s5: number;
  s6: number;

  // Stats
  totalPredictions: number;
  totalResolved: number;
  accuracy: number;
  avgBrierScore: number;

  // Anti-gaming
  flags: string[];

  // Metadata
  calculatedAt: string;
}

async function main() {
  logger.info('Starting leaderboard calculation...');

  const polymarketTop = parseInt(process.env.POLYMARKET_TOP || '20', 10);
  const metaculusTop = parseInt(process.env.METACULUS_TOP || '20', 10);

  const leaderboard: LeaderboardEntry[] = [];

  // ============================================================
  // POLYMARKET
  // ============================================================
  logger.info(`Fetching top ${polymarketTop} Polymarket traders...`);

  const polymarketIngestor = new PolymarketIngestor();

  try {
    const polymarketTraders = await polymarketIngestor.getTopForecasters(polymarketTop);
    logger.info({ count: polymarketTraders.length }, 'Found Polymarket traders');

    for (const [index, trader] of polymarketTraders.entries()) {
      logger.info(
        { trader, progress: `${index + 1}/${polymarketTraders.length}` },
        'Calculating Polymarket score'
      );

      try {
        // Fetch predictions
        const predictions = await polymarketIngestor.fetchUserPredictions(trader);

        if (predictions.length === 0) {
          logger.warn({ trader }, 'No predictions found, skipping');
          continue;
        }

        // Create identity
        const identity: ForecasterIdentity = {
          id: trader,
          polymarketWallet: trader,
          linkageConfidence: 1.0,
          linkageMethod: 'self_declared',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Calculate score
        const score = await calculateCompleteScore(trader, identity, predictions);

        // Add to leaderboard
        leaderboard.push(convertToLeaderboardEntry(score, leaderboard.length + 1, 'polymarket'));

        logger.info(
          {
            trader,
            score: score.finalCompositeScore,
            tier: score.tier,
            predictions: predictions.length,
          },
          'Score calculated'
        );

        // Rate limiting
        await sleep(2000);
      } catch (error) {
        logger.error({ trader, error }, 'Failed to calculate score');
      }
    }
  } catch (error) {
    logger.error({ error }, 'Failed to fetch Polymarket leaderboard');
  }

  // ============================================================
  // METACULUS
  // ============================================================
  logger.info(`Fetching top ${metaculusTop} Metaculus forecasters...`);

  const metaculusIngestor = new MetaculusIngestor();

  try {
    const metaculusForecasters = await metaculusIngestor.getTopForecasters(metaculusTop);
    logger.info({ count: metaculusForecasters.length }, 'Found Metaculus forecasters');

    for (const [index, forecaster] of metaculusForecasters.entries()) {
      logger.info(
        { forecaster, progress: `${index + 1}/${metaculusForecasters.length}` },
        'Calculating Metaculus score'
      );

      try {
        // Fetch predictions
        const predictions = await metaculusIngestor.fetchUserPredictions(forecaster);

        if (predictions.length === 0) {
          logger.warn({ forecaster }, 'No predictions found, skipping');
          continue;
        }

        // Create identity
        const identity: ForecasterIdentity = {
          id: forecaster,
          metaculusUsername: forecaster,
          linkageConfidence: 1.0,
          linkageMethod: 'self_declared',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Calculate score
        const score = await calculateCompleteScore(forecaster, identity, predictions);

        // Add to leaderboard
        leaderboard.push(convertToLeaderboardEntry(score, leaderboard.length + 1, 'metaculus'));

        logger.info(
          {
            forecaster,
            score: score.finalCompositeScore,
            tier: score.tier,
            predictions: predictions.length,
          },
          'Score calculated'
        );

        // Rate limiting
        await sleep(2000);
      } catch (error) {
        logger.error({ forecaster, error }, 'Failed to calculate score');
      }
    }
  } catch (error) {
    logger.error({ error }, 'Failed to fetch Metaculus leaderboard');
  }

  // ============================================================
  // EXPORT
  // ============================================================

  // Sort by final composite score (descending)
  leaderboard.sort((a, b) => b.finalCompositeScore - a.finalCompositeScore);

  // Re-assign ranks
  leaderboard.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  // Export to JSON
  const outputDir = path.join(process.cwd(), 'data');
  await fs.mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, 'leaderboard.json');
  await fs.writeFile(outputPath, JSON.stringify(leaderboard, null, 2));

  logger.info({ path: outputPath, count: leaderboard.length }, 'Leaderboard exported');

  // Export summary stats
  const stats = {
    totalForecasters: leaderboard.length,
    polymarketCount: leaderboard.filter(e => e.platform === 'polymarket').length,
    metaculusCount: leaderboard.filter(e => e.platform === 'metaculus').length,
    averageScore: leaderboard.reduce((sum, e) => sum + e.finalCompositeScore, 0) / leaderboard.length,
    tier1Count: leaderboard.filter(e => e.tier === 1).length,
    tier2Count: leaderboard.filter(e => e.tier === 2).length,
    tier3Count: leaderboard.filter(e => e.tier === 3).length,
    calculatedAt: new Date().toISOString(),
  };

  const statsPath = path.join(outputDir, 'leaderboard-stats.json');
  await fs.writeFile(statsPath, JSON.stringify(stats, null, 2));

  logger.info(stats, 'Summary stats');
  logger.info('✅ Leaderboard calculation complete!');

  // Print top 10
  console.log('\n🏆 TOP 10 FORECASTERS:\n');
  console.log('Rank | Platform   | ID                | Score | Tier | Predictions');
  console.log('-----|------------|-------------------|-------|------|------------');

  leaderboard.slice(0, 10).forEach(entry => {
    const id = entry.username || entry.walletAddress?.slice(0, 8) || entry.forecasterId;
    console.log(
      `${String(entry.rank).padStart(4)} | ${entry.platform.padEnd(10)} | ${id.padEnd(17)} | ${String(entry.finalCompositeScore).padStart(5)} | ${entry.tier}    | ${entry.totalPredictions}`
    );
  });

  console.log('\n');
}

function convertToLeaderboardEntry(
  score: ForecasterScore,
  rank: number,
  platform: 'polymarket' | 'metaculus'
): LeaderboardEntry {
  return {
    rank,
    forecasterId: score.forecasterId,
    platform,
    username: score.identity.metaculusUsername,
    walletAddress: score.identity.polymarketWallet,

    finalCompositeScore: score.finalCompositeScore,
    rawCompositeScore: score.rawCompositeScore,
    tier: score.tier,
    confidenceWeight: score.confidenceWeight,

    s1: score.components.s1Composite,
    s2: score.components.s2Resolution,
    s3: score.components.s3Composite,
    s4: score.components.s4DifficultyWeighted,
    s5: score.components.s5VolumeConsistency,
    s6: score.components.s6CrossPlatform,

    totalPredictions: score.totalPredictions,
    totalResolved: score.totalResolved,
    accuracy: score.accuracy,
    avgBrierScore: score.avgBrierScore,

    flags: score.antiGaming.flags,

    calculatedAt: score.calculatedAt.toISOString(),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
