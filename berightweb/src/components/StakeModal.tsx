/**
 * Stake Modal
 *
 * Modal for delegating capital to a forecaster staking pool.
 *
 * @author BeRight Protocol
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useForecastPool } from '@/hooks/useForecastPool';
import { useWalletBalance } from '@/hooks/useWalletBalance';

interface StakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  poolAddress: string;
  poolName?: string;
  token: 'SOL' | 'USDC';
  minDeposit?: number; // In base units (lamports or USDC decimals)
  currentTvl?: number;
  maxCapacity?: number;
  onSuccess?: (signature: string) => void;
}

export function StakeModal({
  isOpen,
  onClose,
  poolAddress,
  poolName,
  token,
  minDeposit = 0,
  currentTvl = 0,
  maxCapacity = Infinity,
  onSuccess,
}: StakeModalProps) {
  const { stake, loading, error, connected, walletAddress } = useForecastPool();
  const { sol, usdc, usdcMint, isLoading: balanceLoading } = useWalletBalance(walletAddress);

  // Log detected USDC mint for debugging
  useEffect(() => {
    if (isOpen && token === 'USDC' && usdcMint) {
      console.log(`[StakeModal] Detected USDC mint in wallet: ${usdcMint}`);
    }
  }, [isOpen, token, usdcMint]);

  const [amount, setAmount] = useState<string>('');
  const [step, setStep] = useState<'input' | 'confirm' | 'success' | 'error'>('input');
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Decimals for token
  const decimals = token === 'SOL' ? 9 : 6;
  const tokenSymbol = token;

  // Get balance in base units
  const balanceInBaseUnits = token === 'SOL'
    ? sol * Math.pow(10, 9)
    : usdc * Math.pow(10, 6);

  // Parse amount to base units
  const amountInBaseUnits = parseFloat(amount || '0') * Math.pow(10, decimals);

  // Validation
  const availableCapacity = maxCapacity - currentTvl;
  const isValidAmount = amountInBaseUnits > 0;
  const meetsMinimum = amountInBaseUnits >= minDeposit;
  const withinCapacity = amountInBaseUnits <= availableCapacity;
  const hasSufficientBalance = amountInBaseUnits <= balanceInBaseUnits;

  const canStake = connected && isValidAmount && meetsMinimum && withinCapacity && hasSufficientBalance && !loading;

  // Format display values
  const formatAmount = (units: number): string => {
    const value = units / Math.pow(10, decimals);
    if (token === 'SOL') {
      return `${value.toFixed(4)} SOL`;
    }
    return `$${value.toFixed(2)}`;
  };

  // Handle stake
  const handleStake = useCallback(async () => {
    if (!canStake) return;

    setLocalError(null);
    setStep('confirm');

    try {
      const signature = await stake(poolAddress, Math.floor(amountInBaseUnits));

      if (signature) {
        setTxSignature(signature);
        setStep('success');
        onSuccess?.(signature);
      } else {
        setStep('error');
      }
    } catch (err) {
      console.error('[StakeModal] Error:', err);
      setLocalError(err instanceof Error ? err.message : 'Failed to stake');
      setStep('error');
    }
  }, [canStake, stake, poolAddress, amountInBaseUnits, onSuccess]);

  // Handle max button
  const handleMax = () => {
    // Leave some for gas if SOL
    const maxAmount = token === 'SOL'
      ? Math.max(0, balanceInBaseUnits - 0.01 * 1e9) // Leave 0.01 SOL for gas
      : balanceInBaseUnits;

    // Also cap at available capacity
    const finalAmount = Math.min(maxAmount, availableCapacity);

    setAmount((finalAmount / Math.pow(10, decimals)).toString());
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setAmount('');
      setStep('input');
      setTxSignature(null);
      setLocalError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const displayError = localError || error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <h2 className="text-xl font-semibold text-white">
            Stake to {poolName || 'Pool'}
          </h2>
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
          {/* Step: Input */}
          {step === 'input' && (
            <>
              {/* Balance Display */}
              <div className="mb-4 p-3 bg-zinc-800/50 rounded-xl">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-400">Available Balance</span>
                  <span className="text-white font-medium">
                    {balanceLoading ? '...' : formatAmount(balanceInBaseUnits)}
                  </span>
                </div>
              </div>

              {/* Amount Input */}
              <div className="mb-4">
                <label className="block text-sm text-zinc-400 mb-2">Amount to Stake</label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 pr-20 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-lg focus:outline-none focus:border-blue-500"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <button
                      onClick={handleMax}
                      className="px-2 py-1 text-xs text-blue-400 hover:text-blue-300"
                    >
                      MAX
                    </button>
                    <span className="text-zinc-400">{tokenSymbol}</span>
                  </div>
                </div>
              </div>

              {/* Validation Messages */}
              {amount && !isValidAmount && (
                <div className="mb-4 text-sm text-red-400">Enter a valid amount</div>
              )}
              {amount && isValidAmount && !meetsMinimum && (
                <div className="mb-4 text-sm text-red-400">
                  Minimum deposit: {formatAmount(minDeposit)}
                </div>
              )}
              {amount && isValidAmount && !withinCapacity && (
                <div className="mb-4 text-sm text-red-400">
                  Exceeds pool capacity. Available: {formatAmount(availableCapacity)}
                </div>
              )}
              {amount && isValidAmount && !hasSufficientBalance && (
                <div className="mb-4 text-sm text-red-400">Insufficient balance</div>
              )}

              {/* Info */}
              <div className="mb-6 p-4 bg-zinc-800/30 rounded-xl space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Estimated Shares</span>
                  <span className="text-white">
                    {isValidAmount ? (amountInBaseUnits / 1_000_000).toFixed(2) : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Pool Capacity</span>
                  <span className="text-white">
                    {formatAmount(currentTvl)} / {maxCapacity === Infinity ? '∞' : formatAmount(maxCapacity)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Lock Period</span>
                  <span className="text-white">7 days</span>
                </div>
              </div>

              {/* Connect Wallet */}
              {!connected && (
                <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-sm text-yellow-400">
                    Connect your wallet to stake
                  </p>
                </div>
              )}

              {/* Stake Button */}
              <button
                onClick={handleStake}
                disabled={!canStake}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Stake'}
              </button>
            </>
          )}

          {/* Step: Confirm (processing) */}
          {step === 'confirm' && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 mb-4 animate-pulse">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Confirming Transaction</h3>
              <p className="text-sm text-zinc-400">
                Please approve the transaction in your wallet...
              </p>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Stake Successful!</h3>
              <p className="text-sm text-zinc-400 mb-4">
                You have successfully staked {formatAmount(amountInBaseUnits)} to this pool.
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
              <h3 className="text-lg font-semibold text-white mb-2">Stake Failed</h3>
              <p className="text-sm text-red-400 mb-4">{displayError || 'Something went wrong'}</p>
              <button
                onClick={() => setStep('input')}
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

export default StakeModal;
