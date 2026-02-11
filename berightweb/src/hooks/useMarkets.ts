'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getHotMarkets,
  searchMarkets,
  getLeaderboard,
  getMorningBrief,
  getUserPredictions,
  createPrediction,
  checkBackendHealth,
  transformMarkets,
  getArbitrageOpportunities,
  getAgentFeed,
  getUserProfile,
  MarketsResponse,
  LeaderboardResponse,
  BriefData,
  PredictionInput,
  PredictionRecord,
  Platform,
  ApiArbitrage,
} from '../lib/api';
import { Prediction } from '../lib/types';
import { mockPredictions, mockLeaderboard, mockUserStats } from '../lib/mockData';

// ============ Backend Status Hook ============

export function useBackendStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    const connected = await checkBackendHealth();
    setIsConnected(connected);
    setIsChecking(false);
    setLastChecked(new Date());
  }, []);

  useEffect(() => {
    checkConnection();

    // Recheck every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  return { isConnected, isChecking, lastChecked, recheck: checkConnection };
}

// ============ Markets Hook ============

interface UseMarketsOptions {
  mode?: 'hot' | 'search' | 'all';
  query?: string;
  platform?: Platform;
  limit?: number;
  compare?: boolean;
  useMockOnError?: boolean;
}

export function useMarkets(options: UseMarketsOptions = {}) {
  const { mode = 'hot', query, platform, limit = 20, compare = false, useMockOnError = true } = options;

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [arbitrage, setArbitrage] = useState<ApiArbitrage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let response: MarketsResponse;

      if (mode === 'search' && query) {
        response = await searchMarkets(query, { platform, limit, compare });
      } else if (mode === 'hot') {
        response = await getHotMarkets(limit);
      } else {
        response = await getHotMarkets(limit);
      }

      const transformed = transformMarkets(response.markets);
      setPredictions(transformed);

      if (response.arbitrage) {
        setArbitrage(response.arbitrage);
      }

      setUsingMock(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch markets';
      setError(message);

      if (useMockOnError) {
        console.warn('Using mock data due to error:', message);
        setPredictions(mockPredictions);
        setUsingMock(true);
      }
    } finally {
      setLoading(false);
    }
  }, [mode, query, platform, limit, compare, useMockOnError]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return {
    predictions,
    arbitrage,
    loading,
    error,
    usingMock,
    refetch: fetchMarkets,
  };
}

// ============ Arbitrage Hook ============

export function useArbitrage(query?: string) {
  const [opportunities, setOpportunities] = useState<ApiArbitrage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scannedAt, setScannedAt] = useState<string | null>(null);

  const fetchArbitrage = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getArbitrageOpportunities(query);
      setOpportunities(response.opportunities);
      setScannedAt(response.scannedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch arbitrage');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchArbitrage();
  }, [fetchArbitrage]);

  return {
    opportunities,
    loading,
    error,
    scannedAt,
    refetch: fetchArbitrage,
  };
}

// ============ Leaderboard Hook ============

interface UseLeaderboardOptions {
  limit?: number;
  userId?: string;
  walletAddress?: string;
}

export function useLeaderboard(options?: UseLeaderboardOptions) {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getLeaderboard(options);
      setData(response);
      setUsingMock(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch leaderboard';
      setError(message);

      // Use mock data as fallback
      setData({
        count: mockLeaderboard.length,
        leaderboard: mockLeaderboard.map((entry) => ({
          rank: entry.rank,
          displayName: entry.username,
          brierScore: 0.25 - (entry.accuracy / 400),
          accuracy: entry.accuracy,
          predictions: entry.totalPredictions,
          streak: entry.streak,
          isCurrentUser: entry.username === 'You',
        })),
        userRank: 8,
        userStats: {
          brierScore: mockUserStats.brierScore,
          accuracy: mockUserStats.accuracy,
          predictions: mockUserStats.resolvedPredictions,
          streak: mockUserStats.winStreak,
        },
      });
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, [options?.limit, options?.userId, options?.walletAddress]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return {
    data,
    loading,
    error,
    usingMock,
    refetch: fetchLeaderboard,
  };
}

// ============ Brief Hook ============

export function useBrief() {
  const [data, setData] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBrief = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getMorningBrief('web');
      setData(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch brief');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrief();
  }, [fetchBrief]);

  return { data, loading, error, refetch: fetchBrief };
}

// ============ User Predictions Hook ============

interface UseUserPredictionsOptions {
  userId?: string;
  walletAddress?: string;
  status?: 'pending' | 'resolved' | 'all';
}

export function useUserPredictions(options?: UseUserPredictionsOptions) {
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPredictions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getUserPredictions({
        userId: options?.userId,
        walletAddress: options?.walletAddress,
        status: options?.status,
      });
      setPredictions(response.predictions);
      setStats(response.stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch predictions');
    } finally {
      setLoading(false);
    }
  }, [options?.userId, options?.walletAddress, options?.status]);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  const addPrediction = async (input: PredictionInput) => {
    try {
      const result = await createPrediction(input);
      await fetchPredictions(); // Refresh list
      return result;
    } catch (err) {
      throw err;
    }
  };

  return {
    predictions,
    stats,
    loading,
    error,
    refetch: fetchPredictions,
    addPrediction,
  };
}

// ============ User Profile Hook ============

interface UseUserProfileOptions {
  walletAddress?: string;
  telegramId?: string;
}

export function useUserProfile(options: UseUserProfileOptions) {
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!options.walletAddress && !options.telegramId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await getUserProfile(options);
      setUser(response.user);
      setStats(response.stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  }, [options.walletAddress, options.telegramId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    user,
    stats,
    loading,
    error,
    refetch: fetchProfile,
  };
}

// ============ Agent Feed Hook ============

export function useAgentFeed(limit = 20) {
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getAgentFeed(limit);
      setFeed(response.feed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agent feed');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchFeed();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchFeed, 30000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  return {
    feed,
    loading,
    error,
    refetch: fetchFeed,
  };
}
