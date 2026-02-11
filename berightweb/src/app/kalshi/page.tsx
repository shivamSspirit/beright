'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getKalshiBalance,
  getKalshiMarkets,
  getKalshiPositions,
  placeKalshiOrder,
  KalshiBalance,
  KalshiMarket,
  KalshiPosition
} from '@/lib/api';

export default function KalshiPage() {
  const [balance, setBalance] = useState<KalshiBalance | null>(null);
  const [markets, setMarkets] = useState<KalshiMarket[]>([]);
  const [positions, setPositions] = useState<KalshiPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'markets' | 'positions'>('markets');
  const [selectedMarket, setSelectedMarket] = useState<KalshiMarket | null>(null);
  const [orderSide, setOrderSide] = useState<'yes' | 'no'>('yes');
  const [orderContracts, setOrderContracts] = useState(1);
  const [orderPrice, setOrderPrice] = useState<number | ''>('');
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [balanceRes, marketsRes, positionsRes] = await Promise.all([
        getKalshiBalance().catch(() => null),
        getKalshiMarkets(30).catch(() => ({ connected: false, markets: [] })),
        getKalshiPositions().catch(() => ({ connected: false, positions: [] })),
      ]);

      if (balanceRes) setBalance(balanceRes);
      setMarkets(marketsRes.markets || []);
      setPositions(positionsRes.positions || []);

      if (!balanceRes?.connected && !marketsRes.connected) {
        setError('Kalshi API not connected. Check your API keys in .env');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Kalshi data');
    } finally {
      setLoading(false);
    }
  }

  async function handlePlaceOrder() {
    if (!selectedMarket) return;

    setOrderLoading(true);
    setOrderSuccess(null);

    try {
      const result = await placeKalshiOrder(
        selectedMarket.ticker,
        orderSide,
        'buy',
        orderContracts,
        orderPrice ? Math.round(orderPrice * 100) : undefined
      );

      if (result.success) {
        setOrderSuccess(`Order placed: ${orderContracts} ${orderSide.toUpperCase()} contracts`);
        setSelectedMarket(null);
        loadData(); // Refresh data
      } else {
        setError(result.error || 'Order failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order failed');
    } finally {
      setOrderLoading(false);
    }
  }

  const formatPrice = (price?: number) => {
    if (price === undefined || price === null) return '-';
    return `${(price * 100).toFixed(0)}c`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <motion.div
          className="text-2xl text-blue-400"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          Loading Kalshi...
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          Kalshi Trading
        </h1>
        <motion.button
          onClick={loadData}
          whileTap={{ scale: 0.95 }}
          className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </motion.button>
      </div>

      {/* Error/Success Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300"
          >
            {error}
            <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-300">
              Dismiss
            </button>
          </motion.div>
        )}
        {orderSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 p-4 rounded-xl bg-green-500/20 border border-green-500/30 text-green-300"
          >
            {orderSuccess}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Balance Card */}
      {balance?.connected && balance.balance && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30"
        >
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-400">Available Balance</p>
              <p className="text-2xl font-bold">${balance.balance.available.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Total Balance</p>
              <p className="text-lg">${balance.balance.total.toFixed(2)}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        {(['markets', 'positions'] as const).map((tab) => (
          <motion.button
            key={tab}
            onClick={() => setActiveTab(tab)}
            whileTap={{ scale: 0.95 }}
            className={`flex-1 py-3 rounded-xl font-medium transition-all ${
              activeTab === tab
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50'
            }`}
          >
            {tab === 'markets' ? 'Markets' : `Positions (${positions.length})`}
          </motion.button>
        ))}
      </div>

      {/* Markets List */}
      {activeTab === 'markets' && (
        <div className="space-y-3">
          {markets.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              No markets available
            </div>
          ) : (
            markets.map((market, index) => (
              <motion.div
                key={market.ticker}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedMarket(market)}
                className="p-4 rounded-xl bg-gray-800/50 border border-gray-700/50 hover:border-blue-500/50 cursor-pointer transition-all"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 pr-4">
                    <p className="font-medium text-sm line-clamp-2">{market.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{market.ticker}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex gap-2">
                      <span className="px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs font-medium">
                        YES {market.yesPct || '-'}c
                      </span>
                      <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs font-medium">
                        NO {market.noPct || '-'}c
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Vol: {market.volume?.toLocaleString() || 0}</span>
                  <span>Closes: {formatDate(market.closeTime)}</span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Positions List */}
      {activeTab === 'positions' && (
        <div className="space-y-3">
          {positions.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              No open positions
            </div>
          ) : (
            positions.map((position, index) => (
              <motion.div
                key={position.ticker}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 rounded-xl bg-gray-800/50 border border-gray-700/50"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{position.ticker}</p>
                    <p className="text-sm text-gray-400">
                      {position.contracts} contracts @ {formatPrice(position.averagePrice)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-blue-400">
                      ${(position.value || position.contracts * position.averagePrice).toFixed(2)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Order Modal */}
      <AnimatePresence>
        {selectedMarket && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 p-4"
            onClick={() => setSelectedMarket(null)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-gray-800 rounded-t-3xl p-6"
            >
              <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-4" />

              <h3 className="text-xl font-bold mb-2">{selectedMarket.title}</h3>
              <p className="text-sm text-gray-400 mb-4">{selectedMarket.ticker}</p>

              {/* Side Selection */}
              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => setOrderSide('yes')}
                  className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                    orderSide === 'yes'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  YES @ {selectedMarket.yesAsk ? `${(selectedMarket.yesAsk * 100).toFixed(0)}c` : '-'}
                </button>
                <button
                  onClick={() => setOrderSide('no')}
                  className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                    orderSide === 'no'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  NO @ {selectedMarket.noAsk ? `${(selectedMarket.noAsk * 100).toFixed(0)}c` : '-'}
                </button>
              </div>

              {/* Contracts Input */}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Contracts</label>
                <input
                  type="number"
                  value={orderContracts}
                  onChange={(e) => setOrderContracts(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                  className="w-full p-3 rounded-xl bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none"
                />
              </div>

              {/* Price Input (optional for limit orders) */}
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2">Price (cents, optional for limit order)</label>
                <input
                  type="number"
                  value={orderPrice}
                  onChange={(e) => setOrderPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="Market order if empty"
                  min={1}
                  max={99}
                  className="w-full p-3 rounded-xl bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none"
                />
              </div>

              {/* Order Button */}
              <motion.button
                onClick={handlePlaceOrder}
                disabled={orderLoading}
                whileTap={{ scale: 0.98 }}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                  orderSide === 'yes'
                    ? 'bg-gradient-to-r from-green-500 to-green-600'
                    : 'bg-gradient-to-r from-red-500 to-red-600'
                } ${orderLoading ? 'opacity-50' : ''}`}
              >
                {orderLoading ? 'Placing Order...' : `Buy ${orderContracts} ${orderSide.toUpperCase()}`}
              </motion.button>

              <p className="text-xs text-gray-500 text-center mt-4">
                Est. Cost: ${((orderPrice || (orderSide === 'yes' ? (selectedMarket.yesAsk || 0.5) : (selectedMarket.noAsk || 0.5))) * orderContracts).toFixed(2)}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
