/**
 * Pool Browser Component
 *
 * Displays available forecast pools for delegators to browse and stake to.
 *
 * @author BeRight Protocol
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useForecastPool, PoolDisplayInfo, PoolTier, TIER_CONFIGS } from '@/hooks/useForecastPool';
import { StakeModal } from './StakeModal';

interface PoolBrowserProps {
  onSelectPool?: (pool: PoolDisplayInfo) => void;
  userBalance?: number;
}

export function PoolBrowser({ onSelectPool, userBalance = 0 }: PoolBrowserProps) {
  const { pools, loading, error, stake, refreshPools } = useForecastPool();
  const [selectedPool, setSelectedPool] = useState<PoolDisplayInfo | null>(null);
  const [stakeModalOpen, setStakeModalOpen] = useState(false);
  const [filterTier, setFilterTier] = useState<'all' | 'newbie' | 'pro'>('all');
  const [sortBy, setSortBy] = useState<'tvl' | 'winRate' | 'delegators'>('tvl');

  // Filter and sort pools
  const filteredPools = pools
    .filter((pool) => {
      if (filterTier === 'newbie') return !pool.tier.isPro;
      if (filterTier === 'pro') return pool.tier.isPro;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'tvl':
          return b.tvl - a.tvl;
        case 'winRate':
          return b.winRate - a.winRate;
        case 'delegators':
          return b.delegatorCount - a.delegatorCount;
        default:
          return 0;
      }
    });

  // Handle stake
  const handleStake = async (poolAddress: string, amount: number): Promise<string | null> => {
    const sig = await stake(poolAddress, amount);
    if (sig) {
      setStakeModalOpen(false);
      refreshPools();
    }
    return sig;
  };

  // Open stake modal
  const handleSelectPool = (pool: PoolDisplayInfo) => {
    setSelectedPool(pool);
    setStakeModalOpen(true);
    onSelectPool?.(pool);
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Forecast Pools</h2>
          <p className="text-sm text-zinc-400">Stake to top forecasters and earn a share of their profits</p>
        </div>
        <button
          onClick={() => refreshPools()}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">Tier:</span>
          <div className="flex rounded-lg bg-zinc-800 p-1">
            {(['all', 'newbie', 'pro'] as const).map((tier) => (
              <button
                key={tier}
                onClick={() => setFilterTier(tier)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filterTier === tier
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tier === 'all' ? 'All' : tier === 'newbie' ? 'Newbie' : 'Pro'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'tvl' | 'winRate' | 'delegators')}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 text-white text-sm border border-zinc-700 focus:outline-none focus:border-blue-500"
          >
            <option value="tvl">TVL</option>
            <option value="winRate">Win Rate</option>
            <option value="delegators">Delegators</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
          {error}
        </div>
      )}

      {/* Pools Grid */}
      {loading && pools.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse bg-zinc-800/50 rounded-2xl h-64" />
          ))}
        </div>
      ) : filteredPools.length === 0 ? (
        <div className="text-center py-12 bg-zinc-800/30 rounded-2xl">
          <div className="text-zinc-500 text-lg mb-2">No pools found</div>
          <p className="text-zinc-600 text-sm">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPools.map((pool) => (
            <PoolCard
              key={pool.address}
              pool={pool}
              onSelect={() => handleSelectPool(pool)}
            />
          ))}
        </div>
      )}

      {/* Stake Modal */}
      <StakeModal
        isOpen={stakeModalOpen}
        onClose={() => setStakeModalOpen(false)}
        pool={selectedPool}
        onStake={handleStake}
        userBalance={userBalance}
        loading={loading}
      />
    </div>
  );
}

// =============================================================================
// POOL CARD COMPONENT
// =============================================================================

interface PoolCardProps {
  pool: PoolDisplayInfo;
  onSelect: () => void;
}

function PoolCard({ pool, onSelect }: PoolCardProps) {
  const isPro = pool.tier.isPro;

  return (
    <div
      className={`p-5 rounded-2xl border cursor-pointer transition-all hover:scale-[1.02] ${
        isPro
          ? 'bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/30 hover:border-purple-500/50'
          : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
      }`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-white">{pool.tier.name}</span>
            {isPro && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-400">
                PRO
              </span>
            )}
          </div>
          <div className="text-xs text-zinc-500 font-mono truncate max-w-[180px]">
            {pool.forecaster.slice(0, 8)}...{pool.forecaster.slice(-4)}
          </div>
        </div>
        <div className={`text-sm font-medium ${pool.status === 'active' ? 'text-green-400' : 'text-zinc-500'}`}>
          {pool.status}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <div className="text-xs text-zinc-500 uppercase">TVL</div>
          <div className="text-lg font-semibold text-white">{pool.tvlDisplay}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 uppercase">Win Rate</div>
          <div className="text-lg font-semibold text-green-400">{(pool.winRate * 100).toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 uppercase">Delegators</div>
          <div className="text-lg font-semibold text-white">{pool.delegatorCount}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 uppercase">Predictions</div>
          <div className="text-lg font-semibold text-white">{pool.predictionCount}</div>
        </div>
      </div>

      {/* Capacity Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-zinc-500">Capacity</span>
          <span className="text-zinc-400">{pool.utilizationPct.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              pool.utilizationPct > 90 ? 'bg-red-500' : pool.utilizationPct > 70 ? 'bg-amber-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(pool.utilizationPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Share Price */}
      <div className="flex items-center justify-between pt-3 border-t border-zinc-700/50">
        <span className="text-sm text-zinc-400">Share Price</span>
        <span className="text-sm font-medium text-white">{pool.sharePriceDisplay}</span>
      </div>
    </div>
  );
}

export default PoolBrowser;
