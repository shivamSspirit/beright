'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MarketInsight } from '@/components/InsightCard';

// ============================================
// TYPES
// ============================================

interface InsightState {
  data: MarketInsight | null;
  isLoading: boolean;
  error: string | null;
}

interface MarketInfo {
  id: string;
  question: string;
  price: number;
  category?: string;
}

interface UseInsightPrefetchResult {
  insights: Record<string, InsightState>;
  getInsight: (marketId: string) => InsightState;
  prefetch: (markets: MarketInfo[]) => void;
  refetch: (marketId: string, market: MarketInfo) => Promise<void>;
}

// ============================================
// HOOK
// ============================================

/**
 * Hook to prefetch AI insights for multiple markets
 *
 * Features:
 * - Parallel fetching for multiple markets
 * - Deduplication of in-flight requests
 * - Caching of fetched insights
 * - Error handling per market
 *
 * @param initialMarkets - Initial markets to prefetch (optional)
 * @param prefetchCount - Number of markets to prefetch (default: 3)
 */
export function useInsightPrefetch(
  initialMarkets: MarketInfo[] = [],
  prefetchCount: number = 3
): UseInsightPrefetchResult {
  const [insights, setInsights] = useState<Record<string, InsightState>>({});
  const fetchingRef = useRef<Set<string>>(new Set());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Fetch single insight
  const fetchInsight = useCallback(async (market: MarketInfo): Promise<void> => {
    const { id, question, price, category } = market;

    // Skip if already fetching
    if (fetchingRef.current.has(id)) {
      return;
    }

    // Skip if already have data
    if (insights[id]?.data) {
      return;
    }

    // Mark as fetching
    fetchingRef.current.add(id);

    // Set loading state
    setInsights((prev) => ({
      ...prev,
      [id]: { data: null, isLoading: true, error: null },
    }));

    // Create abort controller
    const abortController = new AbortController();
    abortControllersRef.current.set(id, abortController);

    try {
      const params = new URLSearchParams({
        question: question,
        price: price.toString(),
        ...(category && { category }),
      });

      const response = await fetch(
        `/api/v2/oracle/insight/${encodeURIComponent(id)}?${params}`,
        {
          signal: abortController.signal,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch insight: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch insight');
      }

      setInsights((prev) => ({
        ...prev,
        [id]: { data: result.data, isLoading: false, error: null },
      }));
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      console.error(`[useInsightPrefetch] Error fetching ${id}:`, error);
      setInsights((prev) => ({
        ...prev,
        [id]: {
          data: null,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }));
    } finally {
      fetchingRef.current.delete(id);
      abortControllersRef.current.delete(id);
    }
  }, [insights]);

  // Prefetch multiple markets
  const prefetch = useCallback((markets: MarketInfo[]) => {
    // Only prefetch the first N markets
    const toPrefetch = markets.slice(0, prefetchCount);

    // Fetch in parallel
    toPrefetch.forEach((market) => {
      fetchInsight(market);
    });
  }, [fetchInsight, prefetchCount]);

  // Refetch a single market (for retry)
  const refetch = useCallback(async (marketId: string, market: MarketInfo): Promise<void> => {
    // Cancel any existing request
    const existingController = abortControllersRef.current.get(marketId);
    if (existingController) {
      existingController.abort();
    }

    // Remove from fetching set to allow refetch
    fetchingRef.current.delete(marketId);

    // Clear existing data
    setInsights((prev) => ({
      ...prev,
      [marketId]: { data: null, isLoading: true, error: null },
    }));

    // Fetch again
    await fetchInsight(market);
  }, [fetchInsight]);

  // Get insight for a specific market
  const getInsight = useCallback((marketId: string): InsightState => {
    return insights[marketId] || { data: null, isLoading: false, error: null };
  }, [insights]);

  // Prefetch initial markets on mount
  useEffect(() => {
    if (initialMarkets.length > 0) {
      prefetch(initialMarkets);
    }
  }, []); // Only run on mount

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Abort all in-flight requests
      abortControllersRef.current.forEach((controller) => {
        controller.abort();
      });
      abortControllersRef.current.clear();
      fetchingRef.current.clear();
    };
  }, []);

  return {
    insights,
    getInsight,
    prefetch,
    refetch,
  };
}

export default useInsightPrefetch;
