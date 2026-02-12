'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getDFlowHotMarkets,
  searchDFlowMarkets,
  getDFlowMarket,
  getDFlowOrderbook,
  getDFlowTrades,
  getDFlowCategories,
  getDFlowPositions,
  getDFlowOrder,
  getDFlowOrderStatus,
  transformDFlowEvents,
  DFlowEvent,
  DFlowOrderbook,
  DFlowTrade,
  DFlowPosition,
  DFlowOrderResponse,
  DFlowOrderStatus,
} from '../lib/api';
import { Prediction } from '../lib/types';

// ============ DFlow Markets Hook ============

interface UseDFlowMarketsOptions {
  mode?: 'hot' | 'search';
  query?: string;
  limit?: number;
}

export function useDFlowMarkets(options: UseDFlowMarketsOptions = {}) {
  const { mode = 'hot', query, limit = 20 } = options;

  const [events, setEvents] = useState<DFlowEvent[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let response;

      if (mode === 'search' && query) {
        response = await searchDFlowMarkets(query, limit);
      } else {
        response = await getDFlowHotMarkets(limit);
      }

      if (response.success) {
        setEvents(response.events);
        setPredictions(transformDFlowEvents(response.events));
      } else {
        setError('Failed to fetch DFlow markets');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch DFlow markets');
    } finally {
      setLoading(false);
    }
  }, [mode, query, limit]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return {
    events,
    predictions,
    loading,
    error,
    refetch: fetchMarkets,
  };
}

// ============ DFlow Market Details Hook ============

interface UseDFlowMarketOptions {
  ticker?: string;
  mint?: string;
}

export function useDFlowMarket(options: UseDFlowMarketOptions) {
  const { ticker, mint } = options;

  const [market, setMarket] = useState<DFlowEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarket = useCallback(async () => {
    if (!ticker && !mint) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getDFlowMarket({ ticker, mint });

      if (response.success && response.market) {
        setMarket(response.market);
      } else {
        setError(response.error || 'Market not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch market');
    } finally {
      setLoading(false);
    }
  }, [ticker, mint]);

  useEffect(() => {
    fetchMarket();
  }, [fetchMarket]);

  return {
    market,
    loading,
    error,
    refetch: fetchMarket,
  };
}

// ============ DFlow Orderbook Hook ============

export function useDFlowOrderbook(ticker?: string) {
  const [orderbook, setOrderbook] = useState<DFlowOrderbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrderbook = useCallback(async () => {
    if (!ticker) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getDFlowOrderbook(ticker);

      if (response.success) {
        setOrderbook(response.orderbook);
      } else {
        setError('Failed to fetch orderbook');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orderbook');
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    fetchOrderbook();

    // Refresh orderbook every 5 seconds
    const interval = setInterval(fetchOrderbook, 5000);
    return () => clearInterval(interval);
  }, [fetchOrderbook]);

  return {
    orderbook,
    loading,
    error,
    refetch: fetchOrderbook,
  };
}

// ============ DFlow Trades Hook ============

export function useDFlowTrades(ticker?: string, limit = 50) {
  const [trades, setTrades] = useState<DFlowTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrades = useCallback(async () => {
    if (!ticker) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getDFlowTrades(ticker, limit);

      if (response.success) {
        setTrades(response.trades);
      } else {
        setError('Failed to fetch trades');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch trades');
    } finally {
      setLoading(false);
    }
  }, [ticker, limit]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  return {
    trades,
    loading,
    error,
    refetch: fetchTrades,
  };
}

// ============ DFlow Categories Hook ============

export function useDFlowCategories() {
  const [categories, setCategories] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getDFlowCategories();

      if (response.success) {
        setCategories(response.categories);
      } else {
        setError('Failed to fetch categories');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories,
  };
}

// ============ DFlow Positions Hook ============

export function useDFlowPositions(mints: string[]) {
  const [positions, setPositions] = useState<DFlowPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!mints || mints.length === 0) {
      setPositions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getDFlowPositions(mints);

      if (response.success) {
        setPositions(response.positions);
      } else {
        setError('Failed to fetch positions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch positions');
    } finally {
      setLoading(false);
    }
  }, [mints.join(',')]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  return {
    positions,
    loading,
    error,
    refetch: fetchPositions,
  };
}

// ============ DFlow Trading Hook ============

interface UseDFlowTradingOptions {
  onSuccess?: (signature: string) => void;
  onError?: (error: string) => void;
}

export function useDFlowTrading(options?: UseDFlowTradingOptions) {
  const [order, setOrder] = useState<DFlowOrderResponse | null>(null);
  const [orderStatus, setOrderStatus] = useState<DFlowOrderStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get order transaction
  const getOrder = useCallback(async (params: {
    inputMint: string;
    outputMint: string;
    amount: number;
    userPublicKey: string;
    slippageBps?: number;
  }) => {
    setLoading(true);
    setError(null);
    setOrder(null);

    try {
      const response = await getDFlowOrder(params);

      if (response.success) {
        setOrder(response.order);
        return response.order;
      } else {
        throw new Error('Failed to get order');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get order';
      setError(message);
      options?.onError?.(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [options]);

  // Check order status
  const checkStatus = useCallback(async (signature: string) => {
    try {
      const response = await getDFlowOrderStatus(signature);

      if (response.success) {
        setOrderStatus(response.status);

        if (response.status.status === 'closed') {
          options?.onSuccess?.(signature);
        } else if (response.status.status === 'failed') {
          options?.onError?.('Order failed');
        }

        return response.status;
      }
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check status';
      setError(message);
      return null;
    }
  }, [options]);

  // Poll order status
  const pollStatus = useCallback(async (signature: string, maxAttempts = 30) => {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await checkStatus(signature);

      if (status?.status === 'closed' || status?.status === 'failed') {
        return status;
      }

      // Wait 2 seconds between polls
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    setError('Order timed out');
    options?.onError?.('Order timed out');
    return null;
  }, [checkStatus, options]);

  return {
    order,
    orderStatus,
    loading,
    error,
    getOrder,
    checkStatus,
    pollStatus,
    reset: () => {
      setOrder(null);
      setOrderStatus(null);
      setError(null);
    },
  };
}

// ============ Combined Hook for Market + Trading ============

export function useDFlowMarketWithTrading(ticker?: string) {
  const market = useDFlowMarket({ ticker });
  const orderbook = useDFlowOrderbook(ticker);
  const trades = useDFlowTrades(ticker, 20);
  const trading = useDFlowTrading();

  return {
    market: market.market,
    orderbook: orderbook.orderbook,
    trades: trades.trades,
    trading,
    loading: market.loading || orderbook.loading || trades.loading,
    error: market.error || orderbook.error || trades.error,
    refetch: () => {
      market.refetch();
      orderbook.refetch();
      trades.refetch();
    },
  };
}
