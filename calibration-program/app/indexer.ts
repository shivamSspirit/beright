/**
 * BeRight Calibration Program - Helius Indexer Integration
 *
 * Provides utilities for reading compressed predictions from Helius DAS API.
 * Compressed data is NOT queryable via standard Solana RPC - you need an indexer.
 */

import { PublicKey } from '@solana/web3.js';

/**
 * Helius RPC endpoints by cluster
 */
export const HELIUS_RPC_URLS = {
  mainnet: (apiKey: string) => `https://mainnet.helius-rpc.com/?api-key=${apiKey}`,
  devnet: (apiKey: string) => `https://devnet.helius-rpc.com/?api-key=${apiKey}`,
};

/**
 * Compressed prediction metadata (from DAS API)
 */
export interface CompressedPredictionMeta {
  id: string; // Asset ID
  leafIndex: number; // Position in Merkle tree
  treeAddress: string;
  forecaster: string;
  marketId: string;
  predictedProbability: number;
  direction: 'Yes' | 'No';
  committedAt: Date;
  resolvedAt?: Date;
  outcome?: boolean;
  brierScore?: number;
  logScore?: number;
  category: number;
}

/**
 * Fetch compressed predictions for a forecaster
 *
 * Uses Helius Digital Asset Standard (DAS) API to query compressed accounts.
 * Get your free API key at: https://helius.dev
 *
 * @param heliusApiKey - Your Helius API key
 * @param merkleTree - Merkle tree public key
 * @param forecaster - Optional: Filter by forecaster address
 * @param page - Page number (starts at 1)
 * @param limit - Results per page (max 1000)
 * @param cluster - 'mainnet' or 'devnet'
 */
export async function fetchCompressedPredictions(
  heliusApiKey: string,
  merkleTree: PublicKey,
  options: {
    forecaster?: PublicKey;
    page?: number;
    limit?: number;
    cluster?: 'mainnet' | 'devnet';
  } = {}
): Promise<CompressedPredictionMeta[]> {
  const { forecaster, page = 1, limit = 100, cluster = 'mainnet' } = options;

  const url = HELIUS_RPC_URLS[cluster](heliusApiKey);

  // Query compressed NFTs in the tree
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'beright-compressed-predictions',
      method: 'getAssetsByGroup',
      params: {
        groupKey: 'collection',
        groupValue: merkleTree.toBase58(),
        page,
        limit,
        sortBy: {
          sortBy: 'created',
          sortDirection: 'desc',
        },
      },
    }),
  });

  const { result } = await response.json();

  if (!result?.items) {
    return [];
  }

  // Parse and filter predictions
  const predictions: CompressedPredictionMeta[] = result.items
    .map((item: any) => {
      try {
        // Parse prediction data from metadata
        const metadata = item.content?.metadata;
        const data = item.compression?.data_hash;

        // Extract prediction fields from on-chain data
        const prediction: CompressedPredictionMeta = {
          id: item.id,
          leafIndex: item.compression?.leaf_id || 0,
          treeAddress: item.compression?.tree || merkleTree.toBase58(),
          forecaster: metadata?.creators?.[0]?.address || '',
          marketId: metadata?.name || '',
          predictedProbability: parseFloat(metadata?.attributes?.probability || '0.5'),
          direction: metadata?.attributes?.direction || 'Yes',
          committedAt: new Date(item.content?.created_at || Date.now()),
          category: parseInt(metadata?.attributes?.category || '0'),
        };

        // Add resolution data if available
        if (metadata?.attributes?.resolved) {
          prediction.resolvedAt = new Date(metadata.attributes.resolved_at);
          prediction.outcome = metadata.attributes.outcome === 'true';
          prediction.brierScore = parseFloat(metadata.attributes.brier_score || '0');
          prediction.logScore = parseFloat(metadata.attributes.log_score || '0');
        }

        return prediction;
      } catch (err) {
        console.error('Failed to parse compressed prediction:', err);
        return null;
      }
    })
    .filter(Boolean);

  // Filter by forecaster if specified
  if (forecaster) {
    return predictions.filter(p => p.forecaster === forecaster.toBase58());
  }

  return predictions;
}

/**
 * Fetch a single compressed prediction by leaf index
 *
 * @param heliusApiKey - Your Helius API key
 * @param merkleTree - Merkle tree public key
 * @param leafIndex - Leaf position in tree (0-based)
 * @param cluster - 'mainnet' or 'devnet'
 */
export async function fetchCompressedPredictionByIndex(
  heliusApiKey: string,
  merkleTree: PublicKey,
  leafIndex: number,
  cluster: 'mainnet' | 'devnet' = 'mainnet'
): Promise<CompressedPredictionMeta | null> {
  const url = HELIUS_RPC_URLS[cluster](heliusApiKey);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'beright-get-asset',
      method: 'getAsset',
      params: {
        id: `${merkleTree.toBase58()}-${leafIndex}`,
      },
    }),
  });

  const { result } = await response.json();

  if (!result) return null;

  // Parse prediction from result (same as above)
  const metadata = result.content?.metadata;

  return {
    id: result.id,
    leafIndex: result.compression?.leaf_id || leafIndex,
    treeAddress: result.compression?.tree || merkleTree.toBase58(),
    forecaster: metadata?.creators?.[0]?.address || '',
    marketId: metadata?.name || '',
    predictedProbability: parseFloat(metadata?.attributes?.probability || '0.5'),
    direction: metadata?.attributes?.direction || 'Yes',
    committedAt: new Date(result.content?.created_at || Date.now()),
    resolvedAt: metadata?.attributes?.resolved_at
      ? new Date(metadata.attributes.resolved_at)
      : undefined,
    outcome: metadata?.attributes?.outcome === 'true' ? true : undefined,
    brierScore: metadata?.attributes?.brier_score
      ? parseFloat(metadata.attributes.brier_score)
      : undefined,
    logScore: metadata?.attributes?.log_score
      ? parseFloat(metadata.attributes.log_score)
      : undefined,
    category: parseInt(metadata?.attributes?.category || '0'),
  };
}

/**
 * Build leaderboard from compressed predictions
 *
 * Aggregates all compressed predictions across forecasters to generate
 * leaderboard stats. This should be run periodically (e.g., every 5 minutes)
 * and cached for fast queries.
 *
 * @param heliusApiKey - Your Helius API key
 * @param merkleTree - Merkle tree public key
 * @param cluster - 'mainnet' or 'devnet'
 */
export async function buildCompressedLeaderboard(
  heliusApiKey: string,
  merkleTree: PublicKey,
  cluster: 'mainnet' | 'devnet' = 'mainnet'
): Promise<
  Array<{
    forecaster: string;
    totalPredictions: number;
    resolvedPredictions: number;
    avgBrierScore: number;
    accuracy: number;
  }>
> {
  const predictions = await fetchCompressedPredictions(heliusApiKey, merkleTree, {
    limit: 1000, // Fetch all (paginate if needed)
    cluster,
  });

  // Group by forecaster
  const forecasterStats = new Map<
    string,
    {
      total: number;
      resolved: number;
      brierSum: number;
      correct: number;
    }
  >();

  for (const pred of predictions) {
    const stats = forecasterStats.get(pred.forecaster) || {
      total: 0,
      resolved: 0,
      brierSum: 0,
      correct: 0,
    };

    stats.total++;

    if (pred.outcome !== undefined && pred.brierScore !== undefined) {
      stats.resolved++;
      stats.brierSum += pred.brierScore;

      // Check if correct (simplified: prob > 0.5 and YES, or prob < 0.5 and NO)
      const predictedYes = pred.predictedProbability > 0.5;
      const isCorrect = (predictedYes && pred.outcome) || (!predictedYes && !pred.outcome);
      if (isCorrect) stats.correct++;
    }

    forecasterStats.set(pred.forecaster, stats);
  }

  // Convert to leaderboard format
  return Array.from(forecasterStats.entries())
    .map(([forecaster, stats]) => ({
      forecaster,
      totalPredictions: stats.total,
      resolvedPredictions: stats.resolved,
      avgBrierScore: stats.resolved > 0 ? stats.brierSum / stats.resolved : 0,
      accuracy: stats.resolved > 0 ? stats.correct / stats.resolved : 0,
    }))
    .sort((a, b) => a.avgBrierScore - b.avgBrierScore); // Lower Brier = better
}

/**
 * Example usage:
 *
 * ```typescript
 * import { fetchCompressedPredictions, buildCompressedLeaderboard } from './indexer';
 *
 * // 1. Fetch predictions for a specific tree
 * const predictions = await fetchCompressedPredictions(
 *   process.env.HELIUS_API_KEY!,
 *   new PublicKey('YOUR_MERKLE_TREE_ADDRESS'),
 *   { limit: 100, cluster: 'devnet' }
 * );
 *
 * console.log(`Found ${predictions.length} predictions`);
 *
 * // 2. Build leaderboard
 * const leaderboard = await buildCompressedLeaderboard(
 *   process.env.HELIUS_API_KEY!,
 *   new PublicKey('YOUR_MERKLE_TREE_ADDRESS'),
 *   'devnet'
 * );
 *
 * console.log('Top 10 forecasters:', leaderboard.slice(0, 10));
 * ```
 */
