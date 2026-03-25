/**
 * Create Pool Modal
 *
 * One-click pool creation for forecasters.
 *
 * @author BeRight Protocol
 */

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForecastPool, PoolTier, TIER_CONFIGS, TierConfig, getAvailableTiers } from '@/hooks/useForecastPool';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useMode } from '@/context/ModeContext';

type TokenType = 'SOL' | 'USDC';

interface CreatePoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (signature: string) => void;
}

export function CreatePoolModal({ isOpen, onClose, onSuccess }: CreatePoolModalProps) {
  const router = useRouter();
  const { isDemo } = useMode();

  // Get all state from useForecastPool (uses window bridge internally)
  const {
    forecasterStats,
    loading,
    error,
    createPool,
    connected,
    walletAddress,
    refreshPools,
    hasPool,
    existingPool,
  } = useForecastPool();

  // Get wallet balance and detected USDC mint
  const { usdcMint } = useWalletBalance(walletAddress);

  // Log detected USDC mint for debugging
  useEffect(() => {
    if (isOpen && usdcMint) {
      console.log(`[CreatePoolModal] Detected USDC mint in wallet: ${usdcMint}`);
    }
  }, [isOpen, usdcMint]);

  // Token selection - default to SOL for demo (devnet), USDC for mainnet
  const [selectedToken, setSelectedToken] = useState<TokenType>(isDemo ? 'SOL' : 'USDC');

  // Track if we've already refreshed for this modal open
  const [hasRefreshedOnOpen, setHasRefreshedOnOpen] = useState(false);

  // Reset refresh flag when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasRefreshedOnOpen(false);
    }
  }, [isOpen]);

  // Refresh forecasterStats when modal opens and wallet is connected (once per modal open)
  useEffect(() => {
    if (isOpen && connected && !forecasterStats && !loading && !hasRefreshedOnOpen) {
      console.log('[CreatePoolModal] Modal opened, refreshing forecasterStats (once)');
      setHasRefreshedOnOpen(true);
      refreshPools();
    }
  }, [isOpen, connected, forecasterStats, loading, hasRefreshedOnOpen, refreshPools]);

  // Debug: log wallet state when modal opens
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = typeof window !== 'undefined' ? window as any : null;
      console.log('[CreatePoolModal] Wallet state from hook:', {
        connected,
        walletAddress: walletAddress?.slice(0, 8) || 'none',
        forecasterStats: forecasterStats ? 'loaded' : 'null',
        mode: w?.__BERIGHT_MODE__ || 'unknown',
        provider: w?.__BERIGHT_PROVIDER__ || 'unknown',
      });
    }
  }, [isOpen, connected, walletAddress, forecasterStats]);

  const [selectedTier, setSelectedTier] = useState<PoolTier | null>(null);
  const [step, setStep] = useState<'select' | 'confirm' | 'success' | 'error' | 'existing'>('select');
  const [txSignature, setTxSignature] = useState<string | null>(null);

  // If user already has a pool, show existing pool step
  useEffect(() => {
    if (isOpen && hasPool && existingPool && step === 'select') {
      console.log('[CreatePoolModal] User already has a pool, showing existing pool');
      setStep('existing');
    }
  }, [isOpen, hasPool, existingPool, step]);

  // Get available tiers based on forecaster stats AND selected token
  const availableTiers = useMemo(() => {
    if (!forecasterStats) return [];
    const allTiers = getAvailableTiers(forecasterStats.brierScore, forecasterStats.predictionCount);
    // Filter by selected token type
    return allTiers.filter(tier => tier.token === selectedToken);
  }, [forecasterStats, selectedToken]);

  // Handle tier selection
  const handleSelectTier = (tier: PoolTier) => {
    setSelectedTier(tier);
    setStep('confirm');
  };

  // Handle pool creation
  const handleCreatePool = async () => {
    console.log('[CreatePoolModal] handleCreatePool called');
    console.log('[CreatePoolModal] State:', {
      selectedTier,
      connected,
      walletAddress: walletAddress || 'null',
      loading,
      error,
    });

    if (selectedTier === null || selectedTier === undefined) {
      console.error('[CreatePoolModal] No tier selected');
      return;
    }

    if (!connected) {
      console.error('[CreatePoolModal] Wallet not connected');
      return;
    }

    try {
      // For USDC pools, pass the detected USDC mint from user's wallet
      const tierConfig = TIER_CONFIGS[selectedTier];
      const tokenMintToUse = tierConfig.token === 'USDC' && usdcMint ? usdcMint : undefined;
      console.log('[CreatePoolModal] Calling createPool with tier:', selectedTier, 'tokenMint:', tokenMintToUse?.slice(0, 8) || 'default');
      const signature = await createPool(selectedTier, tokenMintToUse);
      console.log('[CreatePoolModal] createPool returned:', signature);

      if (signature) {
        setTxSignature(signature);
        setStep('success');
        onSuccess?.(signature);
      } else {
        console.error('[CreatePoolModal] createPool returned null, setting error step');
        setStep('error');
      }
    } catch (err) {
      console.error('[CreatePoolModal] Error in handleCreatePool:', err);
      setStep('error');
    }
  };

  // Reset modal
  const handleReset = () => {
    setSelectedTier(null);
    // If user has existing pool, go back to existing step, otherwise select
    setStep(hasPool ? 'existing' : 'select');
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
                Select your pool&apos;s base token and tier.
              </p>

              {/* Token Toggle */}
              <div className="mb-6">
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                  Base Token
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedToken('SOL')}
                    className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                      selectedToken === 'SOL'
                        ? 'bg-purple-600 text-white border border-purple-500'
                        : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-lg">◎</span>
                      <span>SOL</span>
                    </div>
                    <div className="text-xs opacity-70 mt-1">
                      {isDemo ? 'Devnet' : 'Native'}
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedToken('USDC')}
                    className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                      selectedToken === 'USDC'
                        ? 'bg-green-600 text-white border border-green-500'
                        : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-lg">$</span>
                      <span>USDC</span>
                    </div>
                    <div className="text-xs opacity-70 mt-1">
                      {isDemo ? 'Devnet' : 'Mainnet'}
                    </div>
                  </button>
                </div>
              </div>

              {/* Available Tiers */}
              <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Available Tiers ({selectedToken})
              </div>

              {loading && !forecasterStats ? (
                <div className="text-center py-8">
                  <div className="text-zinc-400 mb-2">Loading forecaster stats...</div>
                  <div className="animate-pulse h-4 bg-zinc-700 rounded w-48 mx-auto"></div>
                </div>
              ) : availableTiers.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-zinc-500 mb-2">No {selectedToken} tiers available</div>
                  <p className="text-sm text-zinc-600">
                    {!connected
                      ? 'Please connect your wallet to see available tiers.'
                      : `Improve your Brier score or make more predictions to unlock ${selectedToken} pool tiers.`}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Starter/Basic Tiers */}
                  {availableTiers.filter(t => !t.isPro).length > 0 && (
                    <>
                      <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                        Starter Pools
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

                  {/* Pro/Elite Tiers */}
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
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                  TIER_CONFIGS[selectedTier].token === 'SOL'
                    ? 'bg-purple-500/20'
                    : 'bg-green-500/20'
                }`}>
                  <span className={`text-3xl ${
                    TIER_CONFIGS[selectedTier].token === 'SOL'
                      ? 'text-purple-400'
                      : 'text-green-400'
                  }`}>
                    {TIER_CONFIGS[selectedTier].token === 'SOL' ? '◎' : '$'}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  Create {TIER_CONFIGS[selectedTier].name} Pool
                </h3>
                <p className="text-sm text-zinc-400">
                  Capacity: {TIER_CONFIGS[selectedTier].capacityDisplay}
                </p>
                <p className={`text-xs mt-1 ${
                  TIER_CONFIGS[selectedTier].token === 'SOL'
                    ? 'text-purple-400'
                    : 'text-green-400'
                }`}>
                  Base Token: {TIER_CONFIGS[selectedTier].token}
                </p>
              </div>

              {/* Wallet Status Warning */}
              {!connected && (
                <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-sm text-yellow-400">
                    Wallet not connected. Please connect your wallet to create a pool.
                  </p>
                </div>
              )}

              {/* Debug Info */}
              <div className="mb-4 p-2 rounded-lg bg-zinc-800/50 text-xs font-mono text-zinc-500">
                <div>Wallet: {connected ? walletAddress?.slice(0, 12) + '...' : 'NOT CONNECTED'}</div>
                <div>Mode: {typeof window !== 'undefined' ? String((window as unknown as Record<string, unknown>).__BERIGHT_MODE__ || 'unknown') : 'ssr'}</div>
                <div>Loading: {loading ? 'Yes' : 'No'}</div>
                <div>Button disabled: {(loading || !connected) ? 'YES - ' + (!connected ? 'wallet not connected' : 'loading') : 'No'}</div>
                {error && <div className="text-red-400">Error: {error}</div>}
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

              {/* Error Display */}
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 py-3 px-4 rounded-xl bg-zinc-800 text-zinc-300 font-medium hover:bg-zinc-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleCreatePool}
                  disabled={loading || !connected}
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

          {/* Step: Existing Pool */}
          {step === 'existing' && existingPool && (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 mb-4">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">You Already Have a Pool</h3>
              <p className="text-sm text-zinc-400 mb-4">
                Each forecaster can only create one staking pool.
              </p>

              {/* Pool Info */}
              <div className="bg-zinc-800/50 rounded-xl p-4 mb-4 text-left">
                <div className="text-xs text-zinc-500 uppercase mb-2">Your Pool</div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-400">Address</span>
                  <a
                    href={`https://explorer.solana.com/address/${existingPool.address}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300 font-mono"
                  >
                    {existingPool.address.slice(0, 8)}...{existingPool.address.slice(-4)}
                  </a>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-400">Status</span>
                  <span className="text-sm text-green-400">{existingPool.status}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-400">TVL</span>
                  <span className="text-sm text-white">{existingPool.tvlDisplay}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Delegators</span>
                  <span className="text-sm text-white">{existingPool.delegatorCount}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  onClose();
                  router.push(`/pools/${existingPool.address}`);
                }}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors"
              >
                Manage Pool
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
