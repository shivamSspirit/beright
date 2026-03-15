'use client';

import { useState, useEffect, useCallback } from 'react';
import { LoadingState } from '@/components/ui/Spinner';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { MarketCard } from '@/components/market/MarketCard';
import { EmptyState } from '@/components/layout/EmptyState';
import { cn } from '@/lib/ui-utils';
import type { Market, Platform } from '@/types';

const PLATFORMS: { value: Platform | 'all'; label: string }[] = [
  { value: 'all', label: 'All Platforms' },
  { value: 'polymarket', label: 'Polymarket' },
  { value: 'kalshi', label: 'Kalshi' },
  { value: 'manifold', label: 'Manifold' },
  { value: 'metaculus', label: 'Metaculus' },
];

type SortOption = 'volume' | 'probability' | 'change';

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [filteredMarkets, setFilteredMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('volume');

  const fetchMarkets = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v2/markets/trending?limit=50');
      if (!res.ok) throw new Error('Failed to fetch markets');

      const data = await res.json();
      const marketList: Market[] = (data.data || data.markets || []).map((m: any) => ({
        id: m.id || m.marketId || '',
        question: m.question || m.title || 'Unknown Market',
        title: m.title || m.question,
        platform: m.platform || 'unknown',
        yesPrice: m.yesPrice || m.probability || 0.5,
        probability: m.probability || m.yesPrice,
        volume: m.volume || 0,
        url: m.url,
        category: m.category,
        endDate: m.endDate,
        participants: m.uniqueTraders || m.participants,
        change24h: m.change24h || 0,
      }));

      setMarkets(marketList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load markets');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  // Filter and sort markets
  useEffect(() => {
    let result = [...markets];

    // Platform filter
    if (platformFilter !== 'all') {
      result = result.filter((m) => m.platform.toLowerCase() === platformFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.question.toLowerCase().includes(query) ||
          m.title?.toLowerCase().includes(query) ||
          m.category?.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'volume':
          return (b.volume || 0) - (a.volume || 0);
        case 'probability':
          return (b.yesPrice || 0) - (a.yesPrice || 0);
        case 'change':
          return Math.abs(b.change24h || 0) - Math.abs(a.change24h || 0);
        default:
          return 0;
      }
    });

    setFilteredMarkets(result);
  }, [markets, platformFilter, searchQuery, sortBy]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Markets</h1>
        <p className="text-gray-500">
          Browse prediction markets across multiple platforms
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search markets..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>

        {/* Platform Filter */}
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setPlatformFilter(value)}
              className={cn(
                'px-3 py-2 text-sm rounded-lg transition-colors',
                platformFilter === value
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="px-3 py-2 text-sm bg-gray-800 text-gray-300 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="volume">Highest Volume</option>
          <option value="probability">Highest Probability</option>
          <option value="change">Biggest Movers</option>
        </select>
      </div>

      {/* Results Count */}
      {!isLoading && !error && (
        <p className="text-sm text-gray-500 mb-4">
          Showing {filteredMarkets.length} of {markets.length} markets
        </p>
      )}

      {/* Content */}
      {isLoading ? (
        <LoadingState message="Loading markets..." />
      ) : error ? (
        <EmptyState
          title="Failed to load markets"
          description={error}
          action={{ label: 'Retry', onClick: fetchMarkets }}
        />
      ) : filteredMarkets.length === 0 ? (
        <EmptyState
          title="No markets found"
          description={searchQuery ? 'Try a different search term' : 'No markets available'}
          action={
            searchQuery
              ? { label: 'Clear search', onClick: () => setSearchQuery('') }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMarkets.map((market) => (
            <MarketCard key={market.id || market.question} market={market} />
          ))}
        </div>
      )}

      {/* Load More (placeholder) */}
      {filteredMarkets.length >= 50 && (
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Showing top 50 markets. Use search to find specific markets.
          </p>
        </div>
      )}
    </div>
  );
}
