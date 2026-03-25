/**
 * Stake Modal
 *
 * Modal for delegators to stake to a forecaster's pool.
 *
 * @author BeRight Protocol
 */

'use client';

import React, { useState, useMemo } from 'react';
import { PoolDisplayInfo } from '@/hooks/useForecastPool';

interface StakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  pool: PoolDisplayInfo | null;
  onStake: (poolAddress: string, amount: number) => Promise<string | null>;
  userBalance: number;
  loading?: boolean;
}

export function StakeModal({
  isOpen,
  onClose,
  pool,
  onStake,
  userBalance,
  loading = false,
}: StakeModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [step, setStep] = useState<'input' | 'confirm' | 'success' | 'error'>('input');
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Calculate estimated shares
  const estimatedShares = useMemo(() => {
    if (!pool || !amount) return 0;
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return 0;
    // Convert to lamports/micro-units
    const amountUnits = pool.tier.token === 'SOL' ? amountNum * 1e9 : amountNum * 1e6;
    return amountUnits / pool.sharePrice;
  }, [pool, amount]);

  // Validation
  const validation = useMemo(() => {
    if (!pool || !amount) return { valid: false, error: null };
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return { valid: false, error: 'Enter a valid amount' };
    }
    // Convert to lamports/micro-units
    const amountUnits = pool.tier.token === 'SOL' ? amountNum * 1e9 : amountNum * 1e6;
    const minDeposit = pool.tier.minDeposit;
    if (amountUnits < minDeposit) {
      const minDisplay = pool.tier.token === 'SOL'
        ? `${minDeposit / 1e9} SOL`
        : `$${minDeposit / 1e6}`;
      return { valid: false, error: `Minimum deposit: ${minDisplay}` };
    }
    if (amountNum > userBalance) {
      return { valid: false, error: 'Insufficient balance' };
    }
    // Check capacity
    const availableCapacity = pool.capacity - pool.tvl;
    if (amountUnits > availableCapacity) {
      const availDisplay = pool.tier.token === 'SOL'
        ? `${(availableCapacity / 1e9).toFixed(2)} SOL`
        : `$${(availableCapacity / 1e6).toFixed(2)}`;
      return { valid: false, error: `Max available: ${availDisplay}` };
    }
    return { valid: true, error: null };
  }, [pool, amount, userBalance]);

  // Handle stake
  const handleStake = async () => {
    if (!pool || !validation.valid) return;

    setStep('confirm');
    const amountNum = parseFloat(amount);
    const amountUnits = pool.tier.token === 'SOL' ? amountNum * 1e9 : amountNum * 1e6;

    const signature = await onStake(pool.address, amountUnits);
    if (signature) {
      setTxSignature(signature);
      setStep('success');
    } else {
      setError('Transaction failed');
      setStep('error');
    }
  };

  // Reset modal
  const handleReset = () => {
    setAmount('');
    setStep('input');
    setTxSignature(null);
    setError(null);
  };

  // Handle close
  const handleClose = () => {
    handleReset();
    onClose();
  };

  // Quick amount buttons
  const quickAmounts = pool?.tier.token === 'SOL'
    ? [0.1, 0.5, 1, 5]
    : [10, 50, 100, 500];

  if (!isOpen || !pool) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div>
            <h2 className="text-xl font-semibold text-white">Stake to Pool</h2>
            <p className="text-sm text-zinc-400">{pool.tier.name}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Pool Stats */}
          <div className="mb-6 p-4 bg-zinc-800/50 rounded-xl">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-zinc-500 uppercase">TVL</div>
                <div className="text-lg font-semibold text-white">{pool.tvlDisplay}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 uppercase">Utilization</div>
                <div className="text-lg font-semibold text-white">{pool.utilizationPct.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 uppercase">Win Rate</div>
                <div className="text-lg font-semibold text-green-400">{(pool.winRate * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 uppercase">Share Price</div>
                <div className="text-lg font-semibold text-white">{pool.sharePriceDisplay}</div>
              </div>
            </div>
          </div>

          {/* Step: Input */}
          {step === 'input' && (
            <>
              {/* Amount Input */}
              <div className="mb-4">
                <label className="block text-sm text-zinc-400 mb-2">Amount</label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-lg font-mono focus:outline-none focus:border-blue-500"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">
                    {pool.tier.token}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 text-sm">
                  <span className="text-zinc-500">
                    Balance: {userBalance.toFixed(pool.tier.token === 'SOL' ? 4 : 2)} {pool.tier.token}
                  </span>
                  <button
                    onClick={() => setAmount(userBalance.toString())}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    Max
                  </button>
                </div>
              </div>

              {/* Quick Amount Buttons */}
              <div className="flex gap-2 mb-4">
                {quickAmounts.map((qa) => (
                  <button
                    key={qa}
                    onClick={() => setAmount(qa.toString())}
                    className="flex-1 py-2 px-3 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors"
                  >
                    {qa} {pool.tier.token}
                  </button>
                ))}
              </div>

              {/* Validation Error */}
              {validation.error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {validation.error}
                </div>
              )}

              {/* Estimated Shares */}
              {estimatedShares > 0 && (
                <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">You will receive</span>
                    <span className="text-lg font-semibold text-blue-400">
                      {estimatedShares.toFixed(4)} shares
                    </span>
                  </div>
                </div>
              )}

              {/* Lockup Notice */}
              <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="text-sm">
                    <div className="text-amber-400 font-medium">7-Day Lockup</div>
                    <div className="text-zinc-400">
                      Early withdrawal (before 7 days) incurs a 2% fee. Normal withdrawal fee is 0.5%.
                    </div>
                  </div>
                </div>
              </div>

              {/* Stake Button */}
              <button
                onClick={handleStake}
                disabled={!validation.valid || loading}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Stake'}
              </button>
            </>
          )}

          {/* Step: Confirm (processing) */}
          {step === 'confirm' && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 mb-4">
                <svg className="w-8 h-8 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Confirming Transaction</h3>
              <p className="text-sm text-zinc-400">Please approve the transaction in your wallet</p>
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
                You have successfully staked {amount} {pool.tier.token}
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
                onClick={handleClose}
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

export default StakeModal;
