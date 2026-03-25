/**
 * Create Pool Modal
 *
 * One-click pool creation for forecasters.
 *
 * @author BeRight Protocol
 */

'use client';

import React, { useState, useMemo } from 'react';
import { useForecastPool, PoolTier, TIER_CONFIGS, TierConfig, getAvailableTiers } from '@/hooks/useForecastPool';

interface CreatePoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (signature: string) => void;
}

export function CreatePoolModal({ isOpen, onClose, onSuccess }: CreatePoolModalProps) {
  const {
    forecasterStats,
    loading,
    error,
    createPool,
  } = useForecastPool();

  const [selectedTier, setSelectedTier] = useState<PoolTier | null>(null);
  const [step, setStep] = useState<'select' | 'confirm' | 'success' | 'error'>('select');
  const [txSignature, setTxSignature] = useState<string | null>(null);

  // Get available tiers based on forecaster stats
  const availableTiers = useMemo(() => {
    if (!forecasterStats) return [];
    return getAvailableTiers(forecasterStats.brierScore, forecasterStats.predictionCount);
  }, [forecasterStats]);

  // Handle tier selection
  const handleSelectTier = (tier: PoolTier) => {
    setSelectedTier(tier);
    setStep('confirm');
  };

  // Handle pool creation
  const handleCreatePool = async () => {
    if (!selectedTier) return;

    const signature = await createPool(selectedTier);
    if (signature) {
      setTxSignature(signature);
      setStep('success');
      onSuccess?.(signature);
    } else {
      setStep('error');
    }
  };

  // Reset modal
  const handleReset = () => {
    setSelectedTier(null);
    setStep('select');
    setTxSignature(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <h2 className="text-xl font-semibold text-white">Create Staking Pool</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Stats Banner */}
          {forecasterStats && (
            <div className="mb-6 p-4 bg-zinc-800/50 rounded-xl">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-sm text-zinc-400">Brier Score</div>
                  <div className="text-lg font-semibold text-white">
                    {forecasterStats.brierScore.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-zinc-400">Predictions</div>
                  <div className="text-lg font-semibold text-white">
                    {forecasterStats.predictionCount}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-zinc-400">Win Rate</div>
                  <div className="text-lg font-semibold text-green-400">
                    {(forecasterStats.winRate * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step: Select Tier */}
          {step === 'select' && (
            <>
              <p className="text-zinc-400 mb-4">
                Select a pool tier based on your forecasting performance.
              </p>

              {availableTiers.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-zinc-500 mb-2">No tiers available</div>
                  <p className="text-sm text-zinc-600">
                    Improve your Brier score or make more predictions to unlock pool tiers.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Newbie Tiers */}
                  {availableTiers.filter(t => !t.isPro).length > 0 && (
                    <>
                      <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                        Newbie Pools
                      </div>
                      {availableTiers.filter(t => !t.isPro).map((tier) => (
                        <TierCard
                          key={tier.tier}
                          tier={tier}
                          onSelect={() => handleSelectTier(tier.tier)}
                        />
                      ))}
                    </>
                  )}

                  {/* Pro Tiers */}
                  {availableTiers.filter(t => t.isPro).length > 0 && (
                    <>
                      <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 mt-4">
                        Pro Pools
                      </div>
                      {availableTiers.filter(t => t.isPro).map((tier) => (
                        <TierCard
                          key={tier.tier}
                          tier={tier}
                          onSelect={() => handleSelectTier(tier.tier)}
                          isPro
                        />
                      ))}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* Step: Confirm */}
          {step === 'confirm' && selectedTier !== null && (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 mb-4">
                  <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  Create {TIER_CONFIGS[selectedTier].name} Pool
                </h3>
                <p className="text-sm text-zinc-400">
                  Capacity: {TIER_CONFIGS[selectedTier].capacityDisplay}
                </p>
              </div>

              <div className="bg-zinc-800/50 rounded-xl p-4 mb-6">
                <div className="text-sm text-zinc-400 mb-3">Revenue Split</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 bg-zinc-700/50 rounded-lg">
                    <div className="text-lg font-semibold text-green-400">30%</div>
                    <div className="text-xs text-zinc-400">You (Forecaster)</div>
                  </div>
                  <div className="text-center p-2 bg-zinc-700/50 rounded-lg">
                    <div className="text-lg font-semibold text-blue-400">50%</div>
                    <div className="text-xs text-zinc-400">Delegators</div>
                  </div>
                  <div className="text-center p-2 bg-zinc-700/50 rounded-lg">
                    <div className="text-lg font-semibold text-purple-400">20%</div>
                    <div className="text-xs text-zinc-400">Platform</div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 py-3 px-4 rounded-xl bg-zinc-800 text-zinc-300 font-medium hover:bg-zinc-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleCreatePool}
                  disabled={loading}
                  className="flex-1 py-3 px-4 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create Pool'}
                </button>
              </div>
            </>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Pool Created!</h3>
              <p className="text-sm text-zinc-400 mb-4">
                Your staking pool is now live and accepting delegations.
              </p>
              {txSignature && (
                <a
                  href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  View on Explorer
                </a>
              )}
              <button
                onClick={onClose}
                className="w-full mt-4 py-3 px-4 rounded-xl bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {/* Step: Error */}
          {step === 'error' && (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 mb-4">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Creation Failed</h3>
              <p className="text-sm text-red-400 mb-4">{error || 'Something went wrong'}</p>
              <button
                onClick={handleReset}
                className="w-full py-3 px-4 rounded-xl bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TIER CARD COMPONENT
// =============================================================================

interface TierCardProps {
  tier: TierConfig;
  onSelect: () => void;
  isPro?: boolean;
}

function TierCard({ tier, onSelect, isPro }: TierCardProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full p-4 rounded-xl border transition-all text-left ${
        isPro
          ? 'bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/30 hover:border-purple-500/50'
          : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">{tier.name}</span>
          {isPro && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-400">
              PRO
            </span>
          )}
        </div>
        <span className={`text-sm ${tier.token === 'SOL' ? 'text-purple-400' : 'text-green-400'}`}>
          {tier.token}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-400">Capacity: {tier.capacityDisplay}</span>
        <span className="text-zinc-500">
          Brier &lt; {tier.maxBrier} | {tier.minPredictions}+ predictions
        </span>
      </div>
    </button>
  );
}

export default CreatePoolModal;
