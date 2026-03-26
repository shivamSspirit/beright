'use client';

/**
 * ConvictionStakeModal - Modal for creating and staking on conviction markets
 *
 * Allows projects to:
 * 1. Create a new conviction market (stake on their milestone)
 * 2. Stake SOL to activate the market
 * 3. View market status
 */

import { useState, useCallback } from 'react';
import { useUser } from '@/hooks/useUnifiedUser';
import { useConvictionEscrow } from '@/hooks/useConvictionEscrow';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import LoadingSpinner from './LoadingSpinner';

// Format SOL balance for display
function formatBalance(sol: number): string {
  return sol.toFixed(4);
}

// ============================================================================
// TYPES
// ============================================================================

interface ConvictionStakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  milestoneQuestion?: string;
  suggestedResolver?: string;
}

type Step = 'form' | 'confirm' | 'signing' | 'success' | 'error';

// ============================================================================
// CONSTANTS
// ============================================================================

const MIN_STAKE_SOL = 0.1;
const SUGGESTED_STAKES = [0.5, 1, 2, 5];

// ============================================================================
// COMPONENT
// ============================================================================

export function ConvictionStakeModal({
  isOpen,
  onClose,
  projectName = 'Your Project',
  milestoneQuestion = 'Will we achieve our milestone?',
  suggestedResolver,
}: ConvictionStakeModalProps) {
  // Get wallet state from UserContext (same source as header)
  const { walletAddress, isAuthenticated, isLoading: userLoading } = useUser();

  // Escrow hook for on-chain operations
  const {
    escrowState,
    hasMarket,
    canStake,
    loading,
    txLoading,
    error: escrowError,
    lastTx,
    ownerPubkey,
    createMarket,
    stake,
  } = useConvictionEscrow();

  // Use wallet address from context or fallback to hook
  const effectiveWallet = walletAddress || ownerPubkey;

  // Connected = authenticated + wallet found
  const isConnected = isAuthenticated && !!effectiveWallet;
  const isWalletsLoading = userLoading;

  const walletBalance = useWalletBalance(effectiveWallet);
  const balance = walletBalance.sol;
  const balanceLoading = walletBalance.isLoading;

  // Form state
  const [step, setStep] = useState<Step>('form');
  const [stakeAmount, setStakeAmount] = useState<number>(1);
  const [resolver, setResolver] = useState(suggestedResolver || '');
  const [resolutionDate, setResolutionDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1); // Default to 1 month from now
    return date.toISOString().split('T')[0];
  });
  const [stakePosition, setStakePosition] = useState<'yes' | 'no'>('yes');
  const [localError, setLocalError] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────

  const handleCreateMarket = useCallback(async () => {
    setLocalError(null);

    // Validation
    if (stakeAmount < MIN_STAKE_SOL) {
      setLocalError(`Minimum stake is ${MIN_STAKE_SOL} SOL`);
      return;
    }

    if (!resolver || resolver.length < 32) {
      setLocalError('Please enter a valid resolver wallet address');
      return;
    }

    const resDate = new Date(resolutionDate);
    if (resDate <= new Date()) {
      setLocalError('Resolution date must be in the future');
      return;
    }

    if (balance !== null && stakeAmount > balance) {
      setLocalError(`Insufficient balance. You have ${formatBalance(balance)} SOL`);
      return;
    }

    setStep('signing');

    try {
      await createMarket({
        resolver,
        stakePosition,
        resolutionDate: resDate,
        stakeAmountSol: stakeAmount,
      });

      setStep('success');
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Transaction failed');
      setStep('error');
    }
  }, [stakeAmount, resolver, resolutionDate, stakePosition, balance, createMarket]);

  const handleStake = useCallback(async () => {
    setLocalError(null);
    setStep('signing');

    try {
      await stake();
      setStep('success');
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Transaction failed');
      setStep('error');
    }
  }, [stake]);

  const resetForm = useCallback(() => {
    setStep('form');
    setLocalError(null);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#0D1117] border border-[#30363d] rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            {hasMarket ? 'Conviction Market' : 'Create Conviction Market'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Wallets Loading State */}
        {isWalletsLoading && (
          <div className="text-center py-8">
            <LoadingSpinner size={32} />
            <p className="text-gray-400">Loading wallet...</p>
          </div>
        )}

        {/* Not Connected State - only show after wallets are ready */}
        {!isWalletsLoading && !isConnected && (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">Connect your wallet to continue</p>
          </div>
        )}

        {/* Loading State */}
        {isConnected && loading && (
          <div className="text-center py-8">
            <LoadingSpinner size={32} />
            <p className="text-gray-400">Loading escrow state...</p>
          </div>
        )}

        {/* Existing Market - Pending Stake */}
        {isConnected && !loading && hasMarket && canStake && step !== 'success' && (
          <div className="space-y-4">
            <div className="bg-[#161b22] rounded-lg p-4 border border-[#30363d]">
              <p className="text-gray-400 text-sm mb-1">Market Status</p>
              <p className="text-amber-400 font-medium">Pending Stake</p>
            </div>

            <div className="bg-[#161b22] rounded-lg p-4 border border-[#30363d]">
              <p className="text-gray-400 text-sm mb-1">Stake Amount</p>
              <p className="text-white text-2xl font-bold">
                {escrowState?.stakeAmountSol} SOL
              </p>
            </div>

            <button
              onClick={handleStake}
              disabled={txLoading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {txLoading ? 'Signing...' : 'Stake SOL'}
            </button>

            {(localError || escrowError) && (
              <p className="text-red-400 text-sm text-center">
                {localError || escrowError}
              </p>
            )}
          </div>
        )}

        {/* Existing Market - Active */}
        {isConnected && !loading && hasMarket && escrowState?.status === 'active' && (
          <div className="space-y-4">
            <div className="bg-[#161b22] rounded-lg p-4 border border-emerald-500/30">
              <p className="text-gray-400 text-sm mb-1">Market Status</p>
              <p className="text-emerald-400 font-medium">Active</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#161b22] rounded-lg p-4 border border-[#30363d]">
                <p className="text-gray-400 text-sm mb-1">Staked</p>
                <p className="text-white font-bold">
                  {escrowState?.vaultBalanceSol || 0} SOL
                </p>
              </div>
              <div className="bg-[#161b22] rounded-lg p-4 border border-[#30363d]">
                <p className="text-gray-400 text-sm mb-1">Position</p>
                <p className={`font-bold ${escrowState?.stakePosition === 'yes' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {escrowState?.stakePosition?.toUpperCase()}
                </p>
              </div>
            </div>

            <div className="bg-[#161b22] rounded-lg p-4 border border-[#30363d]">
              <p className="text-gray-400 text-sm mb-1">Resolution Date</p>
              <p className="text-white">
                {escrowState?.resolutionDateISO
                  ? new Date(escrowState.resolutionDateISO).toLocaleDateString()
                  : '-'}
              </p>
            </div>

            <p className="text-gray-400 text-sm text-center">
              Market is active. Waiting for resolution date.
            </p>
          </div>
        )}

        {/* Create New Market Form */}
        {isConnected && !loading && !hasMarket && step === 'form' && (
          <div className="space-y-4">
            {/* Project Info */}
            <div className="bg-[#161b22] rounded-lg p-4 border border-[#30363d]">
              <p className="text-gray-400 text-sm mb-1">Project</p>
              <p className="text-white font-medium">{projectName}</p>
              <p className="text-gray-500 text-sm mt-2">{milestoneQuestion}</p>
            </div>

            {/* Stake Amount */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                Stake Amount (SOL)
              </label>
              <div className="flex gap-2 mb-2">
                {SUGGESTED_STAKES.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setStakeAmount(amount)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      stakeAmount === amount
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#161b22] text-gray-400 hover:text-white border border-[#30363d]'
                    }`}
                  >
                    {amount} SOL
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(parseFloat(e.target.value) || 0)}
                min={MIN_STAKE_SOL}
                step={0.1}
                className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
              {!balanceLoading && balance !== null && (
                <p className="text-gray-500 text-xs mt-1">
                  Balance: {formatBalance(balance)} SOL
                </p>
              )}
            </div>

            {/* Position */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                Your Position
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setStakePosition('yes')}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    stakePosition === 'yes'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#161b22] text-gray-400 border border-[#30363d]'
                  }`}
                >
                  YES - Milestone will be achieved
                </button>
                <button
                  onClick={() => setStakePosition('no')}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    stakePosition === 'no'
                      ? 'bg-red-600 text-white'
                      : 'bg-[#161b22] text-gray-400 border border-[#30363d]'
                  }`}
                >
                  NO
                </button>
              </div>
            </div>

            {/* Resolution Date */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                Resolution Date
              </label>
              <input
                type="date"
                value={resolutionDate}
                onChange={(e) => setResolutionDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Resolver */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                Resolver Wallet
              </label>
              <input
                type="text"
                value={resolver}
                onChange={(e) => setResolver(e.target.value)}
                placeholder="Solana wallet address that can resolve"
                className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 text-sm"
              />
              <p className="text-gray-500 text-xs mt-1">
                This wallet will be able to resolve the market outcome
              </p>
            </div>

            {/* Error */}
            {(localError || escrowError) && (
              <p className="text-red-400 text-sm">{localError || escrowError}</p>
            )}

            {/* Submit */}
            <button
              onClick={handleCreateMarket}
              disabled={txLoading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Market & Stake {stakeAmount} SOL
            </button>
          </div>
        )}

        {/* Signing State */}
        {step === 'signing' && (
          <div className="text-center py-8">
            <LoadingSpinner size={48} />
            <p className="text-white font-medium mb-2">Confirm in your wallet</p>
            <p className="text-gray-400 text-sm">
              Please sign the transaction in your wallet
            </p>
          </div>
        )}

        {/* Success State */}
        {step === 'success' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-emerald-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-emerald-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-white font-medium text-lg mb-2">Success!</p>
            <p className="text-gray-400 text-sm mb-4">
              Your conviction market has been created
            </p>
            {lastTx && (
              <a
                href={`https://orbmarkets.io/tx/${lastTx}?cluster=devnet&tab=summary`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 text-sm hover:underline"
              >
                View transaction
              </a>
            )}
            <button
              onClick={onClose}
              className="w-full mt-6 py-3 bg-[#161b22] hover:bg-[#21262d] text-white font-medium rounded-lg transition-colors border border-[#30363d]"
            >
              Close
            </button>
          </div>
        )}

        {/* Error State */}
        {step === 'error' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <p className="text-white font-medium text-lg mb-2">Transaction Failed</p>
            <p className="text-red-400 text-sm mb-4">{localError || escrowError}</p>
            <button
              onClick={resetForm}
              className="w-full py-3 bg-[#161b22] hover:bg-[#21262d] text-white font-medium rounded-lg transition-colors border border-[#30363d]"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ConvictionStakeModal;
