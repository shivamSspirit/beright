'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LoadingState } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { TierBadge } from '@/components/profile/TierBadge';
import { EmptyState } from '@/components/layout/EmptyState';
import { truncateAddress, getGradeColor, cn } from '@/lib/ui-utils';
import type { Forecaster, ForecasterTier } from '@/types';

type FilterTier = 'all' | ForecasterTier;

export default function LeaderboardPage() {
  const [forecasters, setForecasters] = useState<Forecaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTier, setFilterTier] = useState<FilterTier>('all');
  const [sortBy, setSortBy] = useState<'brierScore' | 'accuracy' | 'predictions'>('brierScore');

  useEffect(() => {
    fetchForecasters();
  }, []);

  const fetchForecasters = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/forecasters');
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      const data = await res.json();

      // Transform API response to Forecaster type
      const forecasterList: Forecaster[] = (data.forecasters || data.data || []).map(
        (f: any, index: number) => ({
          address: f.walletAddress || f.address || `unknown-${index}`,
          rank: f.rank || index + 1,
          brierScore: f.brierScore || 0,
          accuracy: f.accuracy || 0,
          totalPredictions: f.totalPredictions || 0,
          resolvedPredictions: f.resolvedPredictions || 0,
          streak: f.streak || 0,
          tier: f.tier || 'unranked',
          grade: f.grade || 'C',
          isOnChainVerified: f.isOnChainVerified || false,
        })
      );

      setForecasters(forecasterList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and sort
  const filteredForecasters = forecasters
    .filter((f) => filterTier === 'all' || f.tier === filterTier)
    .sort((a, b) => {
      switch (sortBy) {
        case 'brierScore':
          return a.brierScore - b.brierScore; // Lower is better
        case 'accuracy':
          return b.accuracy - a.accuracy;
        case 'predictions':
          return b.resolvedPredictions - a.resolvedPredictions;
        default:
          return 0;
      }
    });

  const tierFilters: { value: FilterTier; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'superforecaster', label: 'Superforecasters' },
    { value: 'elite', label: 'Elite' },
    { value: 'verified', label: 'Verified' },
    { value: 'rookie', label: 'Rookies' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Leaderboard</h1>
        <p className="text-gray-500">
          Top forecasters ranked by on-chain calibration scores
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Tier Filter */}
        <div className="flex flex-wrap gap-2">
          {tierFilters.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilterTier(value)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg transition-colors',
                filterTier === value
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
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-1.5 text-sm bg-gray-800 text-gray-300 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="brierScore">Sort by Brier Score</option>
          <option value="accuracy">Sort by Accuracy</option>
          <option value="predictions">Sort by Predictions</option>
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingState message="Loading leaderboard..." />
      ) : error ? (
        <EmptyState
          title="Failed to load leaderboard"
          description={error}
          action={{ label: 'Retry', onClick: fetchForecasters }}
        />
      ) : filteredForecasters.length === 0 ? (
        <EmptyState
          title="No forecasters found"
          description={filterTier !== 'all' ? 'Try a different filter' : 'Be the first to make predictions!'}
          action={filterTier !== 'all' ? { label: 'Clear filter', onClick: () => setFilterTier('all') } : undefined}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Forecaster</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Tier</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Brier</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Accuracy</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Predictions</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredForecasters.map((forecaster, index) => (
                  <tr
                    key={forecaster.address}
                    className="hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="px-4 py-4 text-sm text-gray-400">
                      {index + 1}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/profile/${forecaster.address}`}
                        className="flex items-center gap-2 hover:text-green-400 transition-colors"
                      >
                        <span className="text-sm font-mono text-white">
                          {truncateAddress(forecaster.address, 6)}
                        </span>
                        {forecaster.isOnChainVerified && (
                          <Badge variant="success" size="sm">On-chain</Badge>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <TierBadge tier={forecaster.tier} size="sm" />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className={cn(
                        'text-sm font-medium',
                        forecaster.brierScore < 0.2 ? 'text-green-400' : 'text-white'
                      )}>
                        {forecaster.brierScore.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-sm text-white">
                      {(forecaster.accuracy * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-4 text-right text-sm text-gray-400">
                      {forecaster.resolvedPredictions}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className={cn('text-sm font-bold', getGradeColor(forecaster.grade))}>
                        {forecaster.grade}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Info */}
      <div className="mt-8 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <h3 className="text-sm font-medium text-white mb-2">How rankings work</h3>
        <p className="text-xs text-gray-500">
          Forecasters are ranked by their Brier score, a measure of prediction accuracy where lower is better.
          Scores are committed on-chain to the Solana blockchain for verifiable reputation.
          Make predictions through our Telegram bot to build your on-chain calibration history.
        </p>
      </div>
    </div>
  );
}
