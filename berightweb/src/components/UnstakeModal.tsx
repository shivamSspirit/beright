/**
 * Unstake Modal
 *
 * Modal for withdrawing capital from a forecaster staking pool.
 *
 * @author BeRight Protocol
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useForecastPool, DelegationInfo } from '@/hooks/useForecastPool';

interface UnstakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  poolAddress: string;
  poolName?: string;
  token: 'SOL' | 'USDC';
  delegation: DelegationInfo | null;
  sharePrice?: number; // Share price in base units
  onSuccess?: (signature: string) => void;
}

export function UnstakeModal({
  isOpen,
  onClose,
  poolAddress,
  poolName,
  token,
  delegation,
  sharePrice = 1_000_000, // Default 1.0
  onSuccess,
}: UnstakeModalProps) {
  const { unstake, loading, error, connected } = useForecastPool();

  const [shares, setShares] = useState<string>('');
  const [step, setStep] = useState<'input' | 'confirm' | 'success' | 'error'>('input');
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Decimals for token
  const decimals = token === 'SOL' ? 9 : 6;
  const tokenSymbol = token;

  // Parse shares to number
  const sharesAmount = parseFloat(shares || '0') * 1_000_000; // Shares have 6 decimals

  // Available shares from delegation
  const availableShares = delegation?.shares || 0;

  // Calculate estimated value
  const estimatedValue = (sharesAmount * sharePrice) / 1_000_000_000_000; // Share decimals * price decimals

  // Calculate fees
  const isEarlyWithdrawal = delegation && !delegation.lockupComplete;
  const feeRate = isEarlyWithdrawal ? 200 : 50; // 2% early, 0.5% normal (in bps)
  const fee = estimatedValue * (feeRate / 10000);
  const netValue = estimatedValue - fee;

  // Validation
  const isValidAmount = sharesAmount > 0;
  const hasSufficientShares = sharesAmount <= availableShares;

  const canUnstake = connected && isValidAmount && hasSufficientShares && !loading;

  // Format display values
  const formatAmount = (units: number): string => {
    const value = units / Math.pow(10, decimals);
    if (token === 'SOL') {
      return `${value.toFixed(4)} SOL`;
    }
    return `$${value.toFixed(2)}`;
  };

  const formatShares = (amount: number): string => {
    return (amount / 1_000_000).toFixed(2);
  };

  // Handle unstake
  const handleUnstake = useCallback(async () => {
    if (!canUnstake) return;

    setLocalError(null);
    setStep('confirm');

    try {
      const signature = await unstake(poolAddress, Math.floor(sharesAmount));

      if (signature) {
        setTxSignature(signature);
        setStep('success');
        onSuccess?.(signature);
      } else {
        setStep('error');
      }
    } catch (err) {
      console.error('[UnstakeModal] Error:', err);
      setLocalError(err instanceof Error ? err.message : 'Failed to unstake');
      setStep('error');
    }
  }, [canUnstake, unstake, poolAddress, sharesAmount, onSuccess]);

  // Handle max button
  const handleMax = () => {
    setShares(formatShares(availableShares));
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShares('');
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
            Withdraw from {poolName || 'Pool'}
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
              {/* Early Withdrawal Warning */}
              {isEarlyWithdrawal && (
                <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-sm text-yellow-400">
                    Early withdrawal fee applies: 2% (lockup period not complete)
                  </p>
                </div>
              )}

              {/* Current Position */}
              <div className="mb-4 p-3 bg-zinc-800/50 rounded-xl">
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-zinc-400">Your Shares</span>
                  <span className="text-white font-medium">
                    {formatShares(availableShares)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-400">Current Value</span>
                  <span className="text-white font-medium">
                    {delegation?.valueDisplay || formatAmount(0)}
                  </span>
                </div>
                {delegation && (
                  <div className="flex justify-between items-center text-sm mt-2">
                    <span className="text-zinc-400">P&L</span>
                    <span className={delegation.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {delegation.pnlDisplay}
                    </span>
                  </div>
                )}
              </div>

              {/* Shares Input */}
              <div className="mb-4">
                <label className="block text-sm text-zinc-400 mb-2">Shares to Redeem</label>
                <div className="relative">
                  <input
                    type="number"
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
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
                    <span className="text-zinc-400">shares</span>
                  </div>
                </div>
              </div>

              {/* Validation Messages */}
              {shares && !isValidAmount && (
                <div className="mb-4 text-sm text-red-400">Enter a valid amount</div>
              )}
              {shares && isValidAmount && !hasSufficientShares && (
                <div className="mb-4 text-sm text-red-400">
                  Insufficient shares. Available: {formatShares(availableShares)}
                </div>
              )}

              {/* Breakdown */}
              <div className="mb-6 p-4 bg-zinc-800/30 rounded-xl space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Gross Value</span>
                  <span className="text-white">
                    {isValidAmount ? formatAmount(estimatedValue * Math.pow(10, decimals)) : formatAmount(0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">
                    Withdrawal Fee ({feeRate / 100}%)
                  </span>
                  <span className="text-red-400">
                    -{isValidAmount ? formatAmount(fee * Math.pow(10, decimals)) : formatAmount(0)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-zinc-700 pt-2">
                  <span className="text-white font-medium">You Receive</span>
                  <span className="text-green-400 font-medium">
                    {isValidAmount ? formatAmount(netValue * Math.pow(10, decimals)) : formatAmount(0)}
                  </span>
                </div>
              </div>

              {/* Connect Wallet */}
              {!connected && (
                <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-sm text-yellow-400">
                    Connect your wallet to withdraw
                  </p>
                </div>
              )}

              {/* No Shares */}
              {connected && availableShares === 0 && (
                <div className="mb-4 p-3 rounded-lg bg-zinc-800 border border-zinc-700">
                  <p className="text-sm text-zinc-400">
                    You don't have any shares in this pool
                  </p>
                </div>
              )}

              {/* Unstake Button */}
              <button
                onClick={handleUnstake}
                disabled={!canUnstake}
                className="w-full py-3 px-4 rounded-xl bg-red-600 text-white font-medium hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Withdraw'}
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
              <h3 className="text-lg font-semibold text-white mb-2">Withdrawal Successful!</h3>
              <p className="text-sm text-zinc-400 mb-4">
                Your {tokenSymbol} has been returned to your wallet.
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
              <h3 className="text-lg font-semibold text-white mb-2">Withdrawal Failed</h3>
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

export default UnstakeModal;
