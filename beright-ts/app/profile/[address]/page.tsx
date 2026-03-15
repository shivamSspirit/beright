'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { LoadingState } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { TierBadge } from '@/components/profile/TierBadge';
import { ForecasterStats } from '@/components/profile/StatsGrid';
import { EmptyState } from '@/components/layout/EmptyState';
import { PlatformBadge } from '@/components/market/PlatformBadge';
import { truncateAddress, formatRelativeTime, cn } from '@/lib/ui-utils';
import type { OnChainCalibration, Prediction } from '@/types';

export default function ProfilePage() {
  const params = useParams();
  const address = params.address as string;

  const [calibration, setCalibration] = useState<OnChainCalibration | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (address) {
      fetchProfile();
    }
  }, [address]);

  const fetchProfile = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch calibration data
      const calibRes = await fetch(`/api/v2/calibration?wallet=${address}`);
      if (calibRes.ok) {
        const data = await calibRes.json();
        if (data.success && data.data) {
          setCalibration(data.data);
        }
      }

      // Fetch prediction history (if endpoint exists)
      try {
        const predRes = await fetch(`/api/predictions?wallet=${address}`);
        if (predRes.ok) {
          const predData = await predRes.json();
          setPredictions(predData.predictions || []);
        }
      } catch {
        // Predictions endpoint may not exist yet
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <LoadingState message="Loading profile..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <EmptyState
          title="Failed to load profile"
          description={error}
          action={{ label: 'Retry', onClick: fetchProfile }}
        />
      </div>
    );
  }

  if (!calibration) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <EmptyState
          title="Forecaster not found"
          description="This wallet hasn't made any on-chain predictions yet."
          action={{ label: 'Back to Leaderboard', onClick: () => window.location.href = '/leaderboard' }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Avatar placeholder */}
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-white text-2xl font-bold">
                {address.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold text-white font-mono">
                    {truncateAddress(address, 8)}
                  </h1>
                  <button
                    onClick={copyAddress}
                    className="text-gray-500 hover:text-white transition-colors"
                    title="Copy address"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <TierBadge tier={calibration.tier} />
                  {calibration.isOnChainVerified && (
                    <Badge variant="success">On-chain Verified</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <a
                href={`https://solscan.io/account/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                View on Solscan
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Calibration Stats</h2>
        <ForecasterStats
          brierScore={calibration.brierScore}
          accuracy={calibration.accuracy}
          streak={calibration.streak}
          totalPredictions={calibration.totalPredictions}
          resolvedPredictions={calibration.resolvedPredictions}
          grade={calibration.grade}
        />
      </div>

      {/* On-chain Details */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold text-white">On-chain Details</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Forecaster PDA:</span>
              <p className="font-mono text-gray-300 truncate" title={calibration.forecasterPda}>
                {truncateAddress(calibration.forecasterPda, 12)}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Program ID:</span>
              <p className="font-mono text-gray-300 truncate" title={calibration.programId}>
                {truncateAddress(calibration.programId, 12)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prediction History */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-white">Prediction History</h2>
        </CardHeader>
        <CardContent>
          {predictions.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">
              No prediction history available yet
            </p>
          ) : (
            <div className="space-y-3">
              {predictions.map((pred) => (
                <div
                  key={pred.id}
                  className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <PlatformBadge platform={pred.platform} size="sm" variant="text" />
                      <span className="text-sm text-white truncate">
                        {pred.marketTitle}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{formatRelativeTime(pred.timestamp)}</span>
                      <span>{pred.confidence}% confidence</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={pred.prediction === 'YES' ? 'success' : 'danger'}
                      size="sm"
                    >
                      {pred.prediction}
                    </Badge>
                    {pred.resolved && (
                      <Badge
                        variant={pred.outcome === 'correct' ? 'success' : 'danger'}
                        size="sm"
                      >
                        {pred.outcome === 'correct' ? 'Correct' : 'Wrong'}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
