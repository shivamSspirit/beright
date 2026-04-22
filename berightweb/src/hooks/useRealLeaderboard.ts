/**
 * Hook for fetching real leaderboard data from Metaculus and Polymarket
 * with V2 BeRight scores
 */

'use client';

import { useState, useEffect } from 'react';

export interface RealLeaderboardEntry {
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
