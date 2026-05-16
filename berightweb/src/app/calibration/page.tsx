'use client';

/**
 * Calibration Page - Forecaster Stats Dashboard
 *
 * Shows on-chain Brier scores and calibration metrics.
 * Every user is a forecaster - stats auto-initialize on first prediction.
 *
 * Program: GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ (devnet)
 */

import { useState } from 'react';
import { useCalibration } from '@/hooks/useCalibration';
import { useMode } from '@/context/ModeContext';
import PageHeader from '@/components/PageHeader';

// ============================================================================
// CONSTANTS
// ============================================================================

const PROGRAM_ID = 'GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ';

const TIER_COLORS = {
  superforecaster: 'text-purple-400 bg-purple-500/20',
  elite: 'text-amber-400 bg-amber-500/20',
  verified: 'text-emerald-400 bg-emerald-500/20',
  rookie: 'text-blue-400 bg-blue-500/20',
  unranked: 'text-gray-400 bg-gray-500/20',
};

const GRADE_COLORS: Record<string, string> = {
  S: 'text-purple-400',
  A: 'text-emerald-400',
  B: 'text-blue-400',
  C: 'text-amber-400',
  D: 'text-orange-400',
  F: 'text-red-400',
  'N/A': 'text-gray-400',
};

// ============================================================================
// COMPONENTS
// ============================================================================

function StatCard({
  label,
  value,
  subValue,
  color = 'white',
}: {
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
}) {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
      <p className="text-gray-500 text-sm mb-1">{label}</p>
      <p className={`text-2xl font-bold text-${color}`}>{value}</p>
      {subValue && <p className="text-gray-500 text-xs mt-1">{subValue}</p>}
    </div>
  );
}

function CalibrationChart({ buckets }: { buckets: { range: string; count: number; avgOutcome: number }[] }) {
  if (!buckets || buckets.length === 0) {
    return (
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
        <p className="text-gray-500 text-center">No calibration data yet</p>
      </div>
    );
  }

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
      <h3 className="text-white font-medium mb-4">Calibration Curve</h3>
      <div className="space-y-2">
        {buckets.map((bucket, i) => {
          const expectedMidpoint = (i + 0.5) * 10; // 5%, 15%, 25%, etc.
          const actualPct = bucket.avgOutcome * 100;
          const diff = Math.abs(actualPct - expectedMidpoint);
          const isCalibrated = diff < 10;

          return (
            <div key={bucket.range} className="flex items-center gap-3">
              <span className="text-gray-400 text-xs w-16">{bucket.range}</span>
              <div className="flex-1 h-6 bg-[#0d1117] rounded relative overflow-hidden">
                {/* Expected (diagonal line would be perfect calibration) */}
                <div
                  className="absolute h-full bg-gray-700/50"
                  style={{ width: `${expectedMidpoint}%` }}
                />
                {/* Actual */}
                {bucket.count > 0 && (
                  <div
                    className={`absolute h-full ${isCalibrated ? 'bg-emerald-500/70' : 'bg-amber-500/70'}`}
                    style={{ width: `${actualPct}%` }}
                  />
                )}
              </div>
              <span className="text-gray-400 text-xs w-8">{bucket.count}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-emerald-500/70 rounded" />
          <span>Calibrated</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-amber-500/70 rounded" />
          <span>Needs work</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-gray-700/50 rounded" />
          <span>Expected</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PAGE
// ============================================================================

export default function CalibrationPage() {
  const { isDemo, network } = useMode();
  const {
    stats,
    brierScore,
    accuracy,
    grade,
    tier,
    calibrationBuckets,
    isInitialized,
    loading,
    error,
    lastTx,
    connected,
    ownerPubkey,
  } = useCalibration();

  const explorerUrl = ownerPubkey
    ? `https://orbmarkets.io/address/${ownerPubkey}?cluster=${network}`
    : null;

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <PageHeader title="Forecaster Calibration" />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Network Banner */}
        {isDemo && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2 mb-6 flex items-center gap-2">
            <span className="text-amber-400 text-sm font-medium">Devnet Mode</span>
            <span className="text-gray-400 text-sm">
              Program: <code className="font-mono text-xs">{PROGRAM_ID}</code>
            </span>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Your Forecasting Stats</h1>
          <p className="text-gray-400">
            Track your prediction accuracy with on-chain Brier scores.
            Every prediction is recorded immutably on Solana.
          </p>
        </div>

        {/* Not Connected */}
        {!connected && (
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-8 text-center">
            <p className="text-gray-400 mb-4">Connect your wallet to view your forecasting stats</p>
          </div>
        )}

        {/* Loading */}
        {connected && loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        )}

        {/* Connected - Show Stats */}
        {connected && !loading && (
          <div className="space-y-6">
            {/* Profile Header */}
            <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border border-emerald-500/30 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${TIER_COLORS[tier]}`}>
                      {tier.toUpperCase()}
                    </span>
                    <span className={`text-3xl font-bold ${GRADE_COLORS[grade]}`}>{grade}</span>
                  </div>
                  <p className="text-gray-400 text-sm font-mono">
                    {ownerPubkey?.slice(0, 8)}...{ownerPubkey?.slice(-6)}
                  </p>
                </div>
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 text-sm"
                  >
                    View on Explorer
                  </a>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Brier Score"
                value={brierScore !== null ? brierScore.toFixed(3) : '-'}
                subValue="Lower is better"
                color={brierScore !== null && brierScore < 0.2 ? 'emerald-400' : 'white'}
              />
              <StatCard
                label="Accuracy"
                value={accuracy !== null ? `${(accuracy * 100).toFixed(1)}%` : '-'}
                color={accuracy !== null && accuracy > 0.6 ? 'emerald-400' : 'white'}
              />
              <StatCard
                label="Predictions"
                value={stats?.totalPredictions ?? 0}
                subValue={`${stats?.resolvedPredictions ?? 0} resolved`}
              />
              <StatCard
                label="Streak"
                value={stats?.streakCorrect ?? 0}
                subValue={`Max: ${stats?.maxStreakCorrect ?? 0}`}
              />
            </div>

            {/* Calibration Chart */}
            <CalibrationChart buckets={calibrationBuckets} />

            {/* How It Works */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
              <h3 className="text-white font-medium mb-3">How Calibration Works</h3>
              <div className="space-y-2 text-gray-400 text-sm">
                <p>Every prediction you make on BeRight is automatically recorded on-chain.</p>
                <p>Your Brier score measures how well-calibrated your probabilities are - lower is better.</p>
                <p>
                  <span className="text-emerald-400">Superforecasters</span> maintain scores below 0.12 over 100+ predictions.
                </p>
              </div>
            </div>

            {/* Last Transaction */}
            {lastTx && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                <p className="text-emerald-400 text-sm">
                  Last transaction:{' '}
                  <a
                    href={`https://orbmarkets.io/tx/${lastTx}?cluster=${network}&tab=summary`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {lastTx.slice(0, 16)}...
                  </a>
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* First Time User Hint */}
            {!isInitialized && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-400 text-sm">
                  Your forecaster account will be created automatically when you make your first prediction.
                  Just swipe on any market to start building your track record.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
