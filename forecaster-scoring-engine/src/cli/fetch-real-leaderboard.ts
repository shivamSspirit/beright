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

// Real Metaculus top forecasters (verified from leaderboard)
const TOP_METACULUS_FORECASTERS = [
  'Sylvain',
  'Charles',
  'SimonM',
];

// Real Polymarket top traders (replace with real addresses from Polymarket APIs)
const TOP_POLYMARKET_TRADERS = [
  '0x00000048b0880f05C54B1E7f652A11aF8b16c1f2',
];

type RealLeaderboardEntryV3 = {
  rank: number;
  username: string;
  walletAddress?: string;
  platform: 'polymarket' | 'metaculus';

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
    const yesProb = p.predictedProbability;
    const chosenYes = p.direction === 'YES';
    const predictedOutcome = chosenYes ? yesProb >= 0.5 : yesProb < 0.5;
    return Boolean(p.outcome) === predictedOutcome;
  }).length;

  return correct / resolved.length;
}

function computePnL(predictions: V3Prediction[]): number {
  // Only a lightweight display heuristic; V3 score uses proper scoring rules.
  const resolved = predictions.filter((p) => p.outcome !== undefined && p.entryPrice !== undefined && p.positionSize !== undefined);
  return resolved.reduce((sum, p) => {
    const yesProb = p.entryPrice ?? p.predictedProbability;
    const sideYes = p.direction === 'YES';
    const outcomeYes = Boolean(p.outcome);
    const positionSize = p.positionSize ?? 0;

    // Treat as 1.0 payout on correct side, 0.0 otherwise, vs paid price.
    const probPaid = sideYes ? yesProb : (1 - yesProb);
    const payout = (sideYes === outcomeYes) ? 1.0 : 0.0;
    return sum + (payout - probPaid) * positionSize;
  }, 0);
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
  // POLYMARKET
  // ============================================================
  const polymarketIngestor = new PolymarketIngestor();
  for (const walletAddress of TOP_POLYMARKET_TRADERS) {
    logger.info({ walletAddress }, 'Fetching Polymarket trader');

    try {
      const importedPredictions = await polymarketIngestor.fetchUserPredictions(walletAddress);
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
      const profit = computePnL(importedPredictions);

      leaderboard.push({
        rank: leaderboard.length + 1,
        username: `Trader ${walletAddress.slice(0, 6)}...`,
        walletAddress,
        platform: 'polymarket',
        profit: profit >= 0 ? `+$${profit.toFixed(0)}` : `-$${Math.abs(profit).toFixed(0)}`,
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
