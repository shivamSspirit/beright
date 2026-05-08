#!/usr/bin/env node
/**
 * Calculate Leaderboard Scores (V3)
 *
 * Fetches top forecasters from Polymarket and Metaculus,
 * computes BeRight Scoring V3 imported snapshots,
 * and exports a combined leaderboard JSON to `forecaster-scoring-engine/data/leaderboard.json`.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import pino from 'pino';

import { MetaculusIngestor } from '../ingestors/metaculus';
import { PolymarketIngestor } from '../ingestors/polymarket';
import { calculateV3UnifiedScore, V3Identity } from '../v3';

const logger = pino({
  name: 'calculate-leaderboard-v3',
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

type LeaderboardEntryV3 = {
  rank: number;
  forecasterId: string;
  platform: 'polymarket' | 'metaculus';
  username?: string;
  walletAddress?: string;

  scoreVersion: 'v3';
  scoreEpoch: string;
  vaultScore: number;
  confidence: number;
  status: string;
  tier: string;
  importedResolvedCount: number;
  nativeResolvedCount: number;
  penaltyFlags: string[];

  totalPredictions: number;
  calculatedAt: string;
};

async function main() {
  logger.info('Starting leaderboard calculation (V3)...');

  const polymarketTop = parseInt(process.env.POLYMARKET_TOP || '20', 10);
  const metaculusTop = parseInt(process.env.METACULUS_TOP || '20', 10);
  const scoreEpoch = new Date().toISOString();

  const leaderboard: LeaderboardEntryV3[] = [];

  // ============================================================
  // POLYMARKET
  // ============================================================
  const polymarketIngestor = new PolymarketIngestor();
  try {
    const traders = await polymarketIngestor.getTopForecasters(polymarketTop);
    for (const [index, walletAddress] of traders.entries()) {
      logger.info({ walletAddress, progress: `${index + 1}/${traders.length}` }, 'Scoring Polymarket trader');
      const importedPredictions = await polymarketIngestor.fetchUserPredictions(walletAddress);
      if (importedPredictions.length === 0) continue;

      const identity: V3Identity = {
        forecasterId: walletAddress,
        linkedAccounts: { polymarket: walletAddress },
      };

      const snapshot = calculateV3UnifiedScore({
        forecasterId: walletAddress,
        identity,
        importedPredictions,
        nativePredictions: [],
        scoreEpoch,
      });

      leaderboard.push({
        rank: leaderboard.length + 1,
        forecasterId: walletAddress,
        platform: 'polymarket',
        walletAddress,
        scoreVersion: 'v3',
        scoreEpoch: snapshot.scoreEpoch,
        vaultScore: snapshot.vaultScore,
        confidence: snapshot.confidence,
        status: snapshot.status,
        tier: snapshot.tier,
        importedResolvedCount: snapshot.importedResolvedCount,
        nativeResolvedCount: snapshot.nativeResolvedCount,
        penaltyFlags: [...(snapshot.importedScore?.penalties.flags ?? [])].sort(),
        totalPredictions: importedPredictions.length,
        calculatedAt: snapshot.calculatedAt.toISOString(),
      });

      await sleep(1200);
    }
  } catch (error) {
    logger.error({ error }, 'Failed to calculate Polymarket leaderboard');
  }

  // ============================================================
  // METACULUS
  // ============================================================
  const metaculusIngestor = new MetaculusIngestor();
  try {
    const forecasters = await metaculusIngestor.getTopForecasters(metaculusTop);
    for (const [index, username] of forecasters.entries()) {
      logger.info({ username, progress: `${index + 1}/${forecasters.length}` }, 'Scoring Metaculus forecaster');
      const importedPredictions = await metaculusIngestor.fetchUserPredictions(username);
      if (importedPredictions.length === 0) continue;

      const identity: V3Identity = {
        forecasterId: username,
        linkedAccounts: { metaculus: username },
      };

      const snapshot = calculateV3UnifiedScore({
        forecasterId: username,
        identity,
        importedPredictions,
        nativePredictions: [],
        scoreEpoch,
      });

      leaderboard.push({
        rank: leaderboard.length + 1,
        forecasterId: username,
        platform: 'metaculus',
        username,
        scoreVersion: 'v3',
        scoreEpoch: snapshot.scoreEpoch,
        vaultScore: snapshot.vaultScore,
        confidence: snapshot.confidence,
        status: snapshot.status,
        tier: snapshot.tier,
        importedResolvedCount: snapshot.importedResolvedCount,
        nativeResolvedCount: snapshot.nativeResolvedCount,
        penaltyFlags: [...(snapshot.importedScore?.penalties.flags ?? [])].sort(),
        totalPredictions: importedPredictions.length,
        calculatedAt: snapshot.calculatedAt.toISOString(),
      });

      await sleep(1200);
    }
  } catch (error) {
    logger.error({ error }, 'Failed to calculate Metaculus leaderboard');
  }

  leaderboard.sort((a, b) => b.vaultScore - a.vaultScore);
  leaderboard.forEach((entry, index) => { entry.rank = index + 1; });

  const outputDir = path.join(process.cwd(), 'data');
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'leaderboard.json');
  await fs.writeFile(outputPath, JSON.stringify(leaderboard, null, 2));

  logger.info({ path: outputPath, count: leaderboard.length }, 'Leaderboard exported');

  const statsPath = path.join(outputDir, 'leaderboard-stats.json');
  const stats = {
    scoreVersion: 'v3',
    totalForecasters: leaderboard.length,
    polymarketCount: leaderboard.filter((e) => e.platform === 'polymarket').length,
    metaculusCount: leaderboard.filter((e) => e.platform === 'metaculus').length,
    averageVaultScore: leaderboard.length > 0
      ? leaderboard.reduce((sum, e) => sum + e.vaultScore, 0) / leaderboard.length
      : 0,
    calculatedAt: new Date().toISOString(),
  };
  await fs.writeFile(statsPath, JSON.stringify(stats, null, 2));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
