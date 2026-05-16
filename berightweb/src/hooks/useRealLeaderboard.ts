/**
 * Hook for fetching real leaderboard data from imported venue scorers
 * with BeRight Scoring V3
 */

'use client';

import { useState, useEffect } from 'react';

export interface RealLeaderboardEntry {
  rank: number;
  username: string;
  walletAddress?: string;
  platform: 'polymarket' | 'limitless' | 'metaculus';

  // Display stats (not canonical scoring inputs)
  profit: string;
  accuracy: number;
  streak: number;
  predictions: number;

  // V3 Scoring (canonical)
  scoreVersion: 'v3';
  scoreEpoch: string;
  vaultScore: number; // 0-1000
  confidence: number; // 0-1
  status: string;
  tier: string;
  importedResolvedCount: number;
  nativeResolvedCount: number;
  penaltyFlags?: string[];

  // Metadata
  isOnChainVerified: boolean;
  calculatedAt: string;
}

interface UseRealLeaderboardResult {
  data: RealLeaderboardEntry[];
  loading: boolean;
  error: string | null;
  total: number;
  lastUpdated: string | null;
  refetch: () => Promise<void>;
}

export function useRealLeaderboard(): UseRealLeaderboardResult {
  const [data, setData] = useState<RealLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/real-leaderboard');
      const result = await response.json();

      if (result.success) {
        setData(result.data.leaderboard || []);
        setTotal(result.data.total || 0);
        setLastUpdated(result.data.lastUpdated || null);
      } else {
        setError(result.error || 'Failed to fetch leaderboard');
        setData([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  return {
    data,
    loading,
    error,
    total,
    lastUpdated,
    refetch: fetchLeaderboard,
  };
}
