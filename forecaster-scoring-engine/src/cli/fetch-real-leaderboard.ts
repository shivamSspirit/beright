#!/usr/bin/env node
/**
 * Fetch Real Leaderboard Data (V3)
 *
 * Fetches top forecasters from Metaculus and traders from Polymarket,
 * computes BeRight Scoring V3 imported snapshots, and exports JSON
 * to `berightweb/public/data/real-leaderboard.json`.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import pino from 'pino';

import { LimitlessIngestor } from '../ingestors/limitless';
import { MetaculusIngestor } from '../ingestors/metaculus';
import { PolymarketIngestor } from '../ingestors/polymarket';
import { calculateV3UnifiedScore, V3Identity, V3Prediction } from '../v3';

const logger = pino({
  name: 'fetch-real-leaderboard-v3',
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

const TOP_METACULUS_FORECASTERS = (process.env.METACULUS_USERNAMES ?? '')
  .split(',')
  .map((username) => username.trim())
  .filter(Boolean);

const DEFAULT_POLYMARKET_WALLETS = [
  '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b',
  '0x8f42ae0a01c0383c7ca8bd060b86a645ee74b88f',
  '0x204f72f35326db932158cba6adff0b9a1da95e14',
];

const TOP_POLYMARKET_TRADERS = (process.env.POLYMARKET_WALLETS ?? DEFAULT_POLYMARKET_WALLETS.join(','))
  .split(',')
  .map((wallet) => wallet.trim())
  .filter(Boolean);

const TOP_LIMITLESS_TRADERS = (process.env.LIMITLESS_WALLETS ?? '')
  .split(',')
  .map((wallet) => wallet.trim())
  .filter(Boolean);

type RealLeaderboardEntryV3 = {
  rank: number;
  username: string;
  walletAddress?: string;
  platform: 'polymarket' | 'limitless' | 'metaculus';

  // Display stats (non-canonical)
  profit: string;
  accuracy: number;
  streak: number;
  predictions: number;

  // Canonical V3 scoring
  scoreVersion: 'v3';
  scoreEpoch: string;
  vaultScore: number;
  confidence: number;
  status: string;
  tier: string;
  importedResolvedCount: number;
  nativeResolvedCount: number;
  penaltyFlags: string[];

  // Metadata
  isOnChainVerified: boolean;
  calculatedAt: string;
};

function computeAccuracy(predictions: V3Prediction[]): number {
  const resolved = predictions.filter((p) => p.outcome !== undefined);
  if (resolved.length === 0) return 0;

  const correct = resolved.filter((p) => {
    const predictedOutcome = p.predictedProbability >= 0.5;
    return Boolean(p.outcome) === predictedOutcome;
  }).length;

  return correct / resolved.length;
}

function formatProfit(profit: number): string {
  const sign = profit >= 0 ? '+' : '-';
  return `${sign}$${Math.round(Math.abs(profit)).toLocaleString('en-US')}`;
}

async function main() {
  logger.info('Fetching real imported forecaster data (V3)...');

  const leaderboard: RealLeaderboardEntryV3[] = [];
  const scoreEpoch = new Date().toISOString();

  // ============================================================
  // METACULUS
  // ============================================================
  const metaculusIngestor = new MetaculusIngestor();
  for (const username of TOP_METACULUS_FORECASTERS) {
    logger.info({ username }, 'Fetching Metaculus forecaster');

    try {
      const importedPredictions = await metaculusIngestor.fetchUserPredictions(username);
      if (importedPredictions.length === 0) {
        logger.warn({ username }, 'No predictions found, skipping');
        continue;
      }

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

      const accuracy = computeAccuracy(importedPredictions);

      leaderboard.push({
        rank: leaderboard.length + 1,
        username,
        platform: 'metaculus',
        profit: '-',
        accuracy: Number((accuracy * 100).toFixed(1)),
        streak: 0,
        predictions: importedPredictions.length,
        scoreVersion: 'v3',
        scoreEpoch: snapshot.scoreEpoch,
        vaultScore: snapshot.vaultScore,
        confidence: snapshot.confidence,
        status: snapshot.status,
        tier: snapshot.tier,
        importedResolvedCount: snapshot.importedResolvedCount,
        nativeResolvedCount: snapshot.nativeResolvedCount,
        penaltyFlags: [...(snapshot.importedScore?.penalties.flags ?? [])].sort(),
        isOnChainVerified: false,
        calculatedAt: snapshot.calculatedAt.toISOString(),
      });

      await sleep(1500);
    } catch (error) {
      logger.error({ username, error }, 'Failed to fetch Metaculus forecaster');
    }
  }

  // ============================================================
  // LIMITLESS
  // ============================================================
  const limitlessIngestor = new LimitlessIngestor();
  for (const walletAddress of TOP_LIMITLESS_TRADERS) {
    logger.info({ walletAddress }, 'Fetching Limitless trader');

    try {
      const scoringData = await limitlessIngestor.fetchUserScoringData(walletAddress);
      const importedPredictions = scoringData.predictions;
      if (importedPredictions.length === 0) {
        logger.warn({ walletAddress }, 'No predictions found, skipping');
        continue;
      }

      const identity: V3Identity = {
        forecasterId: walletAddress,
        linkedAccounts: { limitless: walletAddress },
      };

      const snapshot = calculateV3UnifiedScore({
        forecasterId: walletAddress,
        identity,
        importedPredictions,
        nativePredictions: [],
        scoreEpoch,
      });

      const accuracy = computeAccuracy(importedPredictions);
      const profit = scoringData.summary.realizedPnl;

      leaderboard.push({
        rank: leaderboard.length + 1,
        username: `Limitless ${walletAddress.slice(0, 6)}...`,
        walletAddress,
        platform: 'limitless',
        profit: formatProfit(profit),
        accuracy: Number((accuracy * 100).toFixed(1)),
        streak: 0,
        predictions: importedPredictions.length,
        scoreVersion: 'v3',
        scoreEpoch: snapshot.scoreEpoch,
        vaultScore: snapshot.vaultScore,
        confidence: snapshot.confidence,
        status: snapshot.status,
        tier: snapshot.tier,
        importedResolvedCount: snapshot.importedResolvedCount,
        nativeResolvedCount: snapshot.nativeResolvedCount,
        penaltyFlags: [...(snapshot.importedScore?.penalties.flags ?? [])].sort(),
        isOnChainVerified: false,
        calculatedAt: snapshot.calculatedAt.toISOString(),
      });

      await sleep(1500);
    } catch (error) {
      logger.error({ walletAddress, error }, 'Failed to fetch Limitless trader');
    }
  }

  // ============================================================
  // POLYMARKET
  // ============================================================
  const polymarketIngestor = new PolymarketIngestor();
  for (const walletAddress of TOP_POLYMARKET_TRADERS) {
    logger.info({ walletAddress }, 'Fetching Polymarket trader');

    try {
      const scoringData = await polymarketIngestor.fetchUserScoringData(walletAddress);
      const importedPredictions = scoringData.predictions;
      if (importedPredictions.length === 0) {
        logger.warn({ walletAddress }, 'No predictions found, skipping');
        continue;
      }

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

      const accuracy = computeAccuracy(importedPredictions);
      const profit = scoringData.summary.realizedPnl;

      leaderboard.push({
        rank: leaderboard.length + 1,
        username: `Trader ${walletAddress.slice(0, 6)}...`,
        walletAddress,
        platform: 'polymarket',
        profit: formatProfit(profit),
        accuracy: Number((accuracy * 100).toFixed(1)),
        streak: 0,
        predictions: importedPredictions.length,
        scoreVersion: 'v3',
        scoreEpoch: snapshot.scoreEpoch,
        vaultScore: snapshot.vaultScore,
        confidence: snapshot.confidence,
        status: snapshot.status,
        tier: snapshot.tier,
        importedResolvedCount: snapshot.importedResolvedCount,
        nativeResolvedCount: snapshot.nativeResolvedCount,
        penaltyFlags: [...(snapshot.importedScore?.penalties.flags ?? [])].sort(),
        isOnChainVerified: false,
        calculatedAt: snapshot.calculatedAt.toISOString(),
      });

      await sleep(1500);
    } catch (error) {
      logger.error({ walletAddress, error }, 'Failed to fetch Polymarket trader');
    }
  }

  // ============================================================
  // SORT + EXPORT
  // ============================================================
  leaderboard.sort((a, b) => b.vaultScore - a.vaultScore);
  leaderboard.forEach((entry, index) => { entry.rank = index + 1; });

  const outputPath = path.join(process.cwd(), '..', 'berightweb', 'public', 'data', 'real-leaderboard.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(leaderboard, null, 2));

  logger.info({ path: outputPath, count: leaderboard.length }, 'Exported real leaderboard (V3)');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
