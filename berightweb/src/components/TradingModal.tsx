'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { animated, useSpring } from '@react-spring/web';
import { DFlowData, DFlowTokens } from '@/lib/types';
import { useDFlowTrading, TradingStep } from '@/hooks/useDFlowTrading';
import { createPrediction, PredictionInput } from '@/lib/api';
import { useWalletBalance, formatBalance } from '@/hooks/useWalletBalance';
import { usePredictionRecorder } from '@/hooks/usePredictionRecorder';
import { usePredictions } from '@/hooks/usePredictions';
import { getAllExplorerUrls, ExplorerLink } from '@/lib/explorer';

// ============ TYPES ============

interface TradingPrediction {
  id: string;
  question: string;
  marketOdds: number;
  dflow?: DFlowData;
  source?: string;
  endDate?: string;
}

interface TradingModalProps {
  prediction: TradingPrediction;
  isOpen: boolean;
  onClose: (tradeCompleted?: boolean) => void;
}

interface MemoCommitState {
  status: 'idle' | 'pending' | 'success' | 'error';
  signature: string | null;
  explorerUrl: string | null;
  error: string | null;
  retryCount: number;
}

interface FeeEstimate {
  loading: boolean;
  solFee: number | null;
  usdFee: number | null;
  error: string | null;
}

// Analytics event types
type AnalyticsEvent =
  | 'trade_started'
  | 'trade_success'
  | 'trade_error'
  | 'memo_commit_started'
  | 'memo_commit_success'
  | 'memo_commit_failed'
  | 'memo_commit_retry'
  | 'prediction_recorded';

// ============ CONSTANTS ============

const STEP_LABELS: Record<TradingStep, string> = {
  idle: '',
  'getting-quote': 'Getting quote...',
  signing: 'Sign in wallet',
  submitting: 'Submitting...',
  confirming: 'Confirming...',
  success: 'Trade Successful!',
  error: 'Trade Failed',
};

const MAX_MEMO_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;
const SOLANA_FEE_LAMPORTS = 5000; // ~0.000005 SOL per tx
const SOL_PRICE_USD = 150; // Approximate, could be fetched dynamically

// ============ HELPERS ============

/**
 * Track analytics events (replace with your analytics provider)
 */
function trackEvent(event: AnalyticsEvent, data?: Record<string, unknown>): void {
  if (typeof window !== 'undefined') {
    console.log(`[Analytics] ${event}`, data);
    // Example: posthog.capture(event, data);
    // Example: mixpanel.track(event, data);
    // Example: window.gtag?.('event', event, data);
  }
}

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(attempt: number): number {
  return BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all explorer URLs for a transaction
 */
function getExplorerLinks(signature: string): ExplorerLink[] {
  return getAllExplorerUrls(signature, 'devnet');
}

// ============ COMPONENT ============

export default function TradingModal({ prediction, isOpen, onClose }: TradingModalProps) {
  // Trade state
  const [side, setSide] = useState<'YES' | 'NO'>('YES');
  const [amount, setAmount] = useState<string>('10');
  const [inputToken] = useState<'USDC' | 'SOL'>('USDC');
  const [estimatedOutput, setEstimatedOutput] = useState<number | null>(null);

  // Memo commit state
  const [memoState, setMemoState] = useState<MemoCommitState>({
    status: 'idle',
    signature: null,
    explorerUrl: null,
    error: null,
    retryCount: 0,
  });

  // Fee estimate state
  const [feeEstimate, setFeeEstimate] = useState<FeeEstimate>({
    loading: false,
    solFee: null,
    usdFee: null,
    error: null,
  });

  // UI state
  const [copiedTrade, setCopiedTrade] = useState(false);
  const [copiedMemo, setCopiedMemo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs to prevent duplicate submissions
  const memoCommitInProgress = useRef(false);
  const lastTradeSignature = useRef<string | null>(null);

  const {
    step,
    error,
    txUrl,
    signature: tradeSignature,
    isConnected,
    isReady,
    walletAddress,
    executeTrade,
    connectWallet,
    reset,
  } = useDFlowTrading();

  // Calibration - record every prediction on-chain
  const { recordPrediction } = usePredictionRecorder();

  // Save predictions to localStorage/API for profile display
  const { savePrediction } = usePredictions(walletAddress);

  // Wallet balance check
  const { sol, usdc, isLoading: balanceLoading, hasEnoughForTrade, refetch: refetchBalance } = useWalletBalance(walletAddress);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const dflow = prediction.dflow;
  const tokens = dflow?.tokens;
  const isTokenized = tokens?.yesMint && tokens?.noMint && tokens?.isInitialized;
  const isTrading = step !== 'idle' && step !== 'success' && step !== 'error';
  const showMemoSection = step === 'success' || memoState.status !== 'idle';

  // ============ ANIMATIONS ============

  const modalSpring = useSpring({
    opacity: isOpen ? 1 : 0,
    y: isOpen ? 0 : 40,
    scale: isOpen ? 1 : 0.96,
    config: { tension: 400, friction: 32 },
  });

  const backdropSpring = useSpring({
    opacity: isOpen ? 1 : 0,
    config: { tension: 400, friction: 32 },
  });

  // ============ EFFECTS ============

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      reset();
      setMemoState({
        status: 'idle',
        signature: null,
        explorerUrl: null,
        error: null,
        retryCount: 0,
      });
      setCopiedTrade(false);
      setCopiedMemo(false);
      setCopiedAddress(false);
      setShowAddFunds(false);
      setIsSubmitting(false);
      memoCommitInProgress.current = false;
      lastTradeSignature.current = null;
    }
  }, [isOpen, reset]);

  // Check if user needs to add funds when connected
  useEffect(() => {
    if (isConnected && !balanceLoading && !hasEnoughForTrade) {
      setShowAddFunds(true);
    } else if (hasEnoughForTrade) {
      setShowAddFunds(false);
    }
  }, [isConnected, balanceLoading, hasEnoughForTrade]);

  // Calculate estimated output
  useEffect(() => {
    if (!dflow || !amount) {
      setEstimatedOutput(null);
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setEstimatedOutput(null);
      return;
    }
    const price = side === 'YES'
      ? (dflow.yesBid + dflow.yesAsk) / 2
      : (dflow.noBid + dflow.noAsk) / 2;
    if (price > 0) {
      setEstimatedOutput(Math.floor((numAmount / price) * 100) / 100);
    }
  }, [amount, side, dflow]);

  // Estimate transaction fees when amount changes
  useEffect(() => {
    if (!amount || !isConnected) {
      setFeeEstimate({ loading: false, solFee: null, usdFee: null, error: null });
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFeeEstimate({ loading: false, solFee: null, usdFee: null, error: null });
      return;
    }

    // Estimate fees (DFlow swap + potential memo)
    setFeeEstimate({ loading: true, solFee: null, usdFee: null, error: null });

    // Simulate async fee estimation
    const timer = setTimeout(() => {
      // DFlow swap typically costs ~0.000005-0.00001 SOL
      // Memo transaction costs ~0.000005 SOL
      const totalLamports = SOLANA_FEE_LAMPORTS * 2; // Swap + Memo
      const solFee = totalLamports / 1e9;
      const usdFee = solFee * SOL_PRICE_USD;

      setFeeEstimate({
        loading: false,
        solFee,
        usdFee,
        error: null,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [amount, isConnected]);

  // Auto-commit memo after successful trade
  useEffect(() => {
    if (
      step === 'success' &&
      tradeSignature &&
      tradeSignature !== lastTradeSignature.current &&
      memoState.status === 'idle' &&
      !memoCommitInProgress.current
    ) {
      lastTradeSignature.current = tradeSignature;
      commitPredictionToChain(tradeSignature);
    }
  }, [step, tradeSignature, memoState.status]);

  // ============ HANDLERS ============

  /**
   * Commit prediction to blockchain via /api/predictions
   */
  const commitPredictionToChain = useCallback(async (tradeTxSignature: string) => {
    if (memoCommitInProgress.current) return;
    memoCommitInProgress.current = true;

    setMemoState(prev => ({
      ...prev,
      status: 'pending',
      error: null,
    }));

    trackEvent('memo_commit_started', {
      marketId: prediction.id,
      side,
      amount,
      tradeTxSignature,
    });

    try {
      const predictionInput: PredictionInput = {
        question: prediction.question,
        probability: prediction.marketOdds / 100,
        direction: side,
        walletAddress: walletAddress || undefined,
        marketId: prediction.id,
        marketUrl: `https://dflow.net/market/${prediction.id}`,
        platform: 'dflow',
        confidence: 'medium',
        reasoning: `Trade executed: ${side} position, $${amount} USDC`,
      };

      const response = await createPrediction(predictionInput);

      if (response.success && response.onChain?.signature) {
        setMemoState({
          status: 'success',
          signature: response.onChain.signature,
          explorerUrl: null, // We now generate multiple explorer links dynamically
          error: null,
          retryCount: 0,
        });

        trackEvent('memo_commit_success', {
          marketId: prediction.id,
          memoSignature: response.onChain.signature,
        });

        trackEvent('prediction_recorded', {
          predictionId: response.prediction.id,
          marketId: prediction.id,
          direction: side,
          probability: prediction.marketOdds / 100,
        });
      } else if (response.success) {
        // Prediction saved but no on-chain commit (might be disabled)
        setMemoState({
          status: 'success',
          signature: null,
          explorerUrl: null,
          error: null,
          retryCount: 0,
        });

        trackEvent('prediction_recorded', {
          predictionId: response.prediction.id,
          marketId: prediction.id,
          direction: side,
          onChain: false,
        });
      } else {
        throw new Error('Failed to record prediction');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to commit prediction';

      setMemoState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage,
      }));

      trackEvent('memo_commit_failed', {
        marketId: prediction.id,
        error: errorMessage,
        retryCount: memoState.retryCount,
      });

      console.error('[TradingModal] Memo commit failed:', err);
    } finally {
      memoCommitInProgress.current = false;
    }
  }, [prediction, side, amount, walletAddress, memoState.retryCount]);

  /**
   * Retry memo commit with exponential backoff
   */
  const retryMemoCommit = useCallback(async () => {
    if (memoState.retryCount >= MAX_MEMO_RETRIES) {
      setMemoState(prev => ({
        ...prev,
        error: `Maximum retries (${MAX_MEMO_RETRIES}) exceeded. Please try again later.`,
      }));
      return;
    }

    const delay = getRetryDelay(memoState.retryCount);

    trackEvent('memo_commit_retry', {
      marketId: prediction.id,
      attempt: memoState.retryCount + 1,
      delay,
    });

    setMemoState(prev => ({
      ...prev,
      status: 'pending',
      error: null,
      retryCount: prev.retryCount + 1,
    }));

    // Wait for exponential backoff delay
    await new Promise(resolve => setTimeout(resolve, delay));

    if (tradeSignature) {
      await commitPredictionToChain(tradeSignature);
    }
  }, [memoState.retryCount, tradeSignature, prediction.id, commitPredictionToChain]);

  /**
   * Execute trade
   */
  const handleTrade = useCallback(async () => {
    if (!isTokenized || !tokens?.yesMint || !tokens?.noMint) return;
    if (isSubmitting) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    setIsSubmitting(true);

    const isYes = side === 'YES';
    const probability = isYes
      ? (dflow?.yesBid ?? prediction.marketOdds / 100)
      : (dflow?.noBid ?? (100 - prediction.marketOdds) / 100);

    trackEvent('trade_started', {
      marketId: prediction.id,
      side,
      amount: numAmount,
      inputToken,
    });

    try {
      // First, record prediction to on-chain calibration program
      const calibrationSig = await recordPrediction({
        marketId: prediction.id,
        direction: isYes ? 'yes' : 'no',
        probability,
      });

      // Try DFlow trade (may not work on devnet)
      let dflowSig: string | null = null;
      try {
        dflowSig = await executeTrade({
          side,
          amount: numAmount,
          inputToken,
          yesMint: tokens.yesMint,
          noMint: tokens.noMint,
          slippageBps: 100,
        });
      } catch (dflowErr) {
        console.log('[TradingModal] DFlow trade failed (expected on devnet):', dflowErr);
      }

      // Use calibration signature (or DFlow if available)
      const signature = dflowSig || calibrationSig;

      if (signature) {
        trackEvent('trade_success', {
          marketId: prediction.id,
          side,
          amount: numAmount,
          signature,
        });

        // Save prediction to localStorage/API for profile display
        const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
        await savePrediction(
          {
            id: prediction.id,
            question: prediction.question,
            marketOdds: prediction.marketOdds,
            platform: prediction.source,
          },
          side,
          signature,
          explorerUrl
        );
      } else {
        throw new Error('Failed to record prediction on-chain');
      }
    } catch (err) {
      trackEvent('trade_error', {
        marketId: prediction.id,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [isTokenized, tokens, amount, side, inputToken, executeTrade, prediction.id, prediction.question, prediction.source, prediction.marketOdds, dflow, recordPrediction, savePrediction, isSubmitting]);

  /**
   * Copy transaction signature to clipboard
   */
  const handleCopyTrade = useCallback(async () => {
    if (tradeSignature && await copyToClipboard(tradeSignature)) {
      setCopiedTrade(true);
      setTimeout(() => setCopiedTrade(false), 2000);
    }
  }, [tradeSignature]);

  const handleCopyMemo = useCallback(async () => {
    if (memoState.signature && await copyToClipboard(memoState.signature)) {
      setCopiedMemo(true);
      setTimeout(() => setCopiedMemo(false), 2000);
    }
  }, [memoState.signature]);

  /**
   * Copy wallet address to clipboard
   */
  const handleCopyWalletAddress = useCallback(async () => {
    if (walletAddress && await copyToClipboard(walletAddress)) {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  }, [walletAddress]);

  /**
   * Open Moonpay for buying USDC
   */
  const handleBuyWithMoonpay = useCallback(() => {
    const moonpayUrl = `https://buy.moonpay.com/?apiKey=pk_live_123&currencyCode=usdc_sol&walletAddress=${walletAddress}`;
    window.open(moonpayUrl, '_blank');
  }, [walletAddress]);

  /**
   * Open Jupiter for swapping to USDC
   */
  const handleSwapOnJupiter = useCallback(() => {
    const jupiterUrl = `https://jup.ag/swap/SOL-USDC`;
    window.open(jupiterUrl, '_blank');
  }, []);

  /**
   * Close modal without completing trade (user cancelled/skipped)
   */
  const handleClose = useCallback(() => {
    if (!isTrading && !isSubmitting) onClose(false);
  }, [isTrading, isSubmitting, onClose]);

  /**
   * Close modal after successful trade
   */
  const handleTradeComplete = useCallback(() => {
    onClose(true);
  }, [onClose]);

  // ============ RENDER ============

  if (!isOpen) return null;

  const yesPrice = (dflow?.yesAsk || prediction.marketOdds / 100).toFixed(2);
  const noPrice = (dflow?.noAsk || (100 - prediction.marketOdds) / 100).toFixed(2);

  return (
    <>
      <animated.div className="tm-backdrop" style={backdropSpring} onClick={handleClose} />

      <div className="tm-container" onClick={handleClose}>
        <animated.div
          className="tm-modal"
          style={{
            opacity: modalSpring.opacity,
            transform: modalSpring.y.to(y => `translateY(${y}px)`),
            scale: modalSpring.scale,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="tm-header">
            <span className="tm-title">Trade</span>
            <button className="tm-close" onClick={handleClose} disabled={isTrading || isSubmitting}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="tm-body">
            {/* No Funds Screen */}
            {showAddFunds && step === 'idle' ? (
              <div className="tm-no-funds">
                <div className="tm-no-funds-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                    <path d="M8 14h8" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <h3 className="tm-no-funds-title">No Funds Detected</h3>
                <p className="tm-no-funds-desc">
                  Your wallet needs USDC to make predictions.
                </p>

                {/* Balance Display */}
                <div className="tm-balance-info">
                  <div className="tm-balance-row">
                    <span className="tm-balance-label">SOL Balance</span>
                    <span className="tm-balance-value">{formatBalance(sol, 4)} SOL</span>
                  </div>
                  <div className="tm-balance-row">
                    <span className="tm-balance-label">USDC Balance</span>
                    <span className="tm-balance-value">${formatBalance(usdc, 2)}</span>
                  </div>
                </div>

                {/* Add Funds Options */}
                <div className="tm-add-funds-options">
                  <button className="tm-add-funds-btn moonpay" onClick={handleBuyWithMoonpay}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M6 12h4M14 12h4" />
                      <path d="M12 8v8" />
                    </svg>
                    Buy with Card
                    <span className="tm-add-funds-provider">Moonpay</span>
                  </button>

                  <button className="tm-add-funds-btn jupiter" onClick={handleSwapOnJupiter}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 16V4m0 0L3 8m4-4l4 4" />
                      <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                    Swap on Jupiter
                    <span className="tm-add-funds-provider">SOL → USDC</span>
                  </button>

                  <div className="tm-deposit-section">
                    <span className="tm-deposit-label">Deposit from Exchange</span>
                    <div className="tm-wallet-address">
                      <span className="tm-address-text">
                        {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                      </span>
                      <button
                        className={`tm-copy-address-btn ${copiedAddress ? 'copied' : ''}`}
                        onClick={handleCopyWalletAddress}
                      >
                        {copiedAddress ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12l5 5L20 7" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <span className="tm-deposit-note">Send USDC (Solana) to this address</span>
                  </div>
                </div>

                <button className="tm-refresh-balance" onClick={() => refetchBalance()}>
                  {balanceLoading ? 'Checking...' : 'Refresh Balance'}
                </button>
              </div>
            ) : step === 'idle' ? (
              <>
                {/* Question - truncated */}
                <p className="tm-question">{prediction.question}</p>

                {/* Side Toggle */}
                <div className="tm-sides">
                  <button
                    className={`tm-side ${side === 'YES' ? 'active yes' : ''}`}
                    onClick={() => setSide('YES')}
                    disabled={isTrading || isSubmitting}
                  >
                    <span className="tm-side-label">YES</span>
                    <span className="tm-side-price">{yesPrice}</span>
                  </button>
                  <button
                    className={`tm-side ${side === 'NO' ? 'active no' : ''}`}
                    onClick={() => setSide('NO')}
                    disabled={isTrading || isSubmitting}
                  >
                    <span className="tm-side-label">NO</span>
                    <span className="tm-side-price">{noPrice}</span>
                  </button>
                </div>

                {/* Amount Row */}
                <div className="tm-amount-row">
                  <div className="tm-input-wrap">
                    <span className="tm-currency">$</span>
                    <input
                      type="number"
                      className="tm-input"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      min="0"
                      disabled={isTrading || isSubmitting}
                    />
                  </div>
                  <div className="tm-quick">
                    {['10', '25', '50', '100'].map((v) => (
                      <button
                        key={v}
                        className={`tm-quick-btn ${amount === v ? 'active' : ''}`}
                        onClick={() => setAmount(v)}
                        disabled={isTrading || isSubmitting}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Output estimate */}
                {estimatedOutput !== null && (
                  <div className="tm-estimate">
                    <span>≈ {estimatedOutput.toFixed(1)} {side} shares</span>
                    {isTokenized && <span className="tm-chain">◎ Solana</span>}
                  </div>
                )}

                {/* Fee Estimate (P3) */}
                {isConnected && feeEstimate.solFee !== null && (
                  <div className="tm-fee-estimate">
                    <span className="tm-fee-label">Est. Network Fee</span>
                    <span className="tm-fee-value">
                      {feeEstimate.loading ? (
                        <span className="tm-fee-loading">...</span>
                      ) : (
                        <>
                          ~{feeEstimate.solFee.toFixed(6)} SOL
                          {feeEstimate.usdFee !== null && (
                            <span className="tm-fee-usd"> (${feeEstimate.usdFee.toFixed(4)})</span>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                )}

                {/* Warning */}
                {!isTokenized && (
                  <div className="tm-warning">Market not available for trading</div>
                )}

                {/* Action */}
                <button
                  className={`tm-action ${!isConnected ? 'connect' : side.toLowerCase()}`}
                  onClick={!isConnected ? connectWallet : handleTrade}
                  disabled={isTrading || isSubmitting || (isConnected && !isTokenized)}
                >
                  {isSubmitting ? (
                    <span className="tm-action-loading">
                      <span className="tm-spinner-inline" />
                      Processing...
                    </span>
                  ) : !isConnected ? (
                    'Connect Wallet'
                  ) : (
                    `Buy ${side}`
                  )}
                </button>
              </>
            ) : (
              /* Progress State */
              <div className="tm-progress">
                <div className={`tm-status-icon ${step}`}>
                  {step === 'success' ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  ) : step === 'error' ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  ) : (
                    <div className="tm-spinner" />
                  )}
                </div>
                <span className="tm-status-text">{STEP_LABELS[step]}</span>
                {error && <span className="tm-error">{error}</span>}

                {/* Trade Transaction Links */}
                {tradeSignature && (
                  <div className="tm-tx-section">
                    <div className="tm-tx-header">
                      <span className="tm-tx-label">Trade Transaction</span>
                      <button
                        className={`tm-copy-btn ${copiedTrade ? 'copied' : ''}`}
                        onClick={handleCopyTrade}
                        title="Copy signature"
                      >
                        {copiedTrade ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12l5 5L20 7" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <div className="tm-explorer-links">
                      {getExplorerLinks(tradeSignature).map((link) => (
                        <a
                          key={link.name}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`tm-explorer-link ${link.icon}`}
                          title={`View on ${link.name}`}
                        >
                          {link.icon === 'solscan' && (
                            <svg viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                            </svg>
                          )}
                          {link.icon === 'solana' && (
                            <svg viewBox="0 0 24 24" fill="currentColor">
                              <path d="M4.5 18.75l3.5-3.75H20c.28 0 .5.22.5.5s-.22.5-.5.5H8.5l-3.5 3.25c-.1.1-.23.15-.35.15-.13 0-.26-.05-.35-.15-.2-.2-.2-.5 0-.7zm15-13.5l-3.5 3.75H4c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h11.5l3.5-3.25c.2-.2.5-.2.7 0 .2.2.2.5 0 .7zm0 6l-3.5 3.75H4c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h11.5l3.5-3.25c.2-.2.5-.2.7 0 .2.2.2.5 0 .7z"/>
                            </svg>
                          )}
                          {link.icon === 'orb' && (
                            <svg viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="12" r="10"/>
                            </svg>
                          )}
                          <span>{link.name}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Memo Transaction Section (P1 & P2) */}
                {showMemoSection && (
                  <div className="tm-memo-section">
                    <div className="tm-memo-header">
                      <span className="tm-memo-label">Prediction Record</span>
                      {memoState.status === 'pending' && (
                        <span className="tm-memo-status pending">
                          <span className="tm-spinner-small" />
                          Recording...
                        </span>
                      )}
                      {memoState.status === 'success' && (
                        <span className="tm-memo-status success">Recorded</span>
                      )}
                      {memoState.status === 'error' && (
                        <span className="tm-memo-status error">Failed</span>
                      )}
                    </div>

                    {/* Success: Show explorer links */}
                    {memoState.status === 'success' && memoState.signature && (
                      <div className="tm-tx-section memo">
                        <div className="tm-tx-header">
                          <button
                            className={`tm-copy-btn ${copiedMemo ? 'copied' : ''}`}
                            onClick={handleCopyMemo}
                            title="Copy signature"
                          >
                            {copiedMemo ? (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 12l5 5L20 7" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                              </svg>
                            )}
                          </button>
                        </div>
                        <div className="tm-explorer-links">
                          {getExplorerLinks(memoState.signature).map((link) => (
                            <a
                              key={link.name}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`tm-explorer-link ${link.icon}`}
                              title={`View on ${link.name}`}
                            >
                              {link.icon === 'solscan' && (
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                                </svg>
                              )}
                              {link.icon === 'solana' && (
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M4.5 18.75l3.5-3.75H20c.28 0 .5.22.5.5s-.22.5-.5.5H8.5l-3.5 3.25c-.1.1-.23.15-.35.15-.13 0-.26-.05-.35-.15-.2-.2-.2-.5 0-.7zm15-13.5l-3.5 3.75H4c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h11.5l3.5-3.25c.2-.2.5-.2.7 0 .2.2.2.5 0 .7zm0 6l-3.5 3.75H4c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h11.5l3.5-3.25c.2-.2.5-.2.7 0 .2.2.2.5 0 .7z"/>
                                </svg>
                              )}
                              {link.icon === 'orb' && (
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                  <circle cx="12" cy="12" r="10"/>
                                </svg>
                              )}
                              <span>{link.name}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Success without on-chain */}
                    {memoState.status === 'success' && !memoState.signature && (
                      <p className="tm-memo-info">Prediction saved to your account</p>
                    )}

                    {/* Error: Show retry button (P2) */}
                    {memoState.status === 'error' && (
                      <div className="tm-memo-error">
                        <p className="tm-memo-error-text">{memoState.error}</p>
                        <button
                          className="tm-retry-btn"
                          onClick={retryMemoCommit}
                          disabled={memoState.retryCount >= MAX_MEMO_RETRIES}
                        >
                          {memoState.retryCount >= MAX_MEMO_RETRIES ? (
                            'Max Retries Reached'
                          ) : (
                            `Retry (${memoState.retryCount}/${MAX_MEMO_RETRIES})`
                          )}
                        </button>
                        <p className="tm-memo-note">
                          Your trade was successful. This only affects the prediction record.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {(step === 'success' || step === 'error') && (
                  <button className="tm-action done" onClick={step === 'success' ? handleTradeComplete : handleClose}>
                    {step === 'success' ? 'Done' : 'Close'}
                  </button>
                )}
              </div>
            )}
          </div>
        </animated.div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&family=Outfit:wght@400;500;600;700&display=swap');

        .tm-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 1000;
        }

        .tm-container {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1001;
        }

        .tm-modal {
          width: 100%;
          max-width: 340px;
          background: #0D0D12;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          overflow: hidden;
          font-family: 'Outfit', -apple-system, sans-serif;
        }

        .tm-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .tm-title {
          font-size: 15px;
          font-weight: 600;
          color: #fff;
          letter-spacing: -0.01em;
        }

        .tm-close {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.06);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s;
        }

        .tm-close:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
        .tm-close:disabled { opacity: 0.5; cursor: not-allowed; }
        .tm-close svg { width: 14px; height: 14px; color: rgba(255,255,255,0.5); }

        .tm-body {
          padding: 14px 16px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .tm-question {
          font-size: 13px;
          color: rgba(255,255,255,0.7);
          line-height: 1.4;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* Side Toggle - Horizontal Pills */
        .tm-sides {
          display: flex;
          gap: 8px;
        }

        .tm-side {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          background: rgba(255,255,255,0.04);
          border: 1.5px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .tm-side:hover:not(:disabled) {
          background: rgba(255,255,255,0.06);
        }

        .tm-side.active.yes {
          background: rgba(0, 255, 178, 0.1);
          border-color: #10B981;
        }

        .tm-side.active.no {
          background: rgba(255, 71, 87, 0.1);
          border-color: #F43F5E;
        }

        .tm-side-label {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255,255,255,0.8);
        }

        .tm-side.active.yes .tm-side-label { color: #10B981; }
        .tm-side.active.no .tm-side-label { color: #F43F5E; }

        .tm-side-price {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255,255,255,0.5);
        }

        .tm-side.active .tm-side-price { color: rgba(255,255,255,0.9); }

        /* Amount Row - Compact */
        .tm-amount-row {
          display: flex;
          gap: 8px;
          align-items: stretch;
        }

        .tm-input-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 0 12px;
        }

        .tm-currency {
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          color: rgba(255,255,255,0.4);
          margin-right: 4px;
        }

        .tm-input {
          flex: 1;
          background: transparent;
          border: none;
          font-family: 'JetBrains Mono', monospace;
          font-size: 16px;
          font-weight: 500;
          color: #fff;
          padding: 10px 0;
          width: 100%;
          min-width: 0;
        }

        .tm-input:focus { outline: none; }
        .tm-input::placeholder { color: rgba(255,255,255,0.25); }

        .tm-quick {
          display: flex;
          gap: 4px;
        }

        .tm-quick-btn {
          padding: 0 10px;
          height: 100%;
          min-height: 40px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          font-weight: 500;
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          transition: all 0.15s;
        }

        .tm-quick-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.08);
          color: #fff;
        }

        .tm-quick-btn.active {
          background: rgba(255,255,255,0.12);
          border-color: rgba(255,255,255,0.2);
          color: #fff;
        }

        /* Estimate */
        .tm-estimate {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          background: rgba(255,255,255,0.02);
          border-radius: 8px;
          font-size: 12px;
          color: rgba(255,255,255,0.5);
        }

        .tm-chain {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #14F195;
        }

        /* Fee Estimate (P3) */
        .tm-fee-estimate {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          background: rgba(255,255,255,0.02);
          border-radius: 8px;
          font-size: 11px;
        }

        .tm-fee-label {
          color: rgba(255,255,255,0.4);
        }

        .tm-fee-value {
          font-family: 'JetBrains Mono', monospace;
          color: rgba(255,255,255,0.6);
        }

        .tm-fee-usd {
          color: rgba(255,255,255,0.4);
        }

        .tm-fee-loading {
          animation: tm-pulse 1s ease-in-out infinite;
        }

        @keyframes tm-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }

        /* Warning */
        .tm-warning {
          padding: 8px 10px;
          background: rgba(255, 193, 7, 0.1);
          border-radius: 8px;
          font-size: 12px;
          color: #FFC107;
          text-align: center;
        }

        /* Action Button */
        .tm-action {
          width: 100%;
          padding: 12px;
          border: none;
          border-radius: 10px;
          font-family: 'Outfit', sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }

        .tm-action-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .tm-spinner-inline {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(0,0,0,0.2);
          border-top-color: currentColor;
          border-radius: 50%;
          animation: tm-spin 0.8s linear infinite;
        }

        .tm-action.yes {
          background: linear-gradient(135deg, #10B981 0%, #10B981 100%);
          color: #000;
        }

        .tm-action.no {
          background: linear-gradient(135deg, #F43F5E 0%, #F43F5E 100%);
          color: #fff;
        }

        .tm-action.connect {
          background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
          color: #fff;
        }

        .tm-action.done {
          background: rgba(255,255,255,0.1);
          color: #fff;
        }

        .tm-action:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .tm-action:not(:disabled):hover {
          transform: translateY(-1px);
          filter: brightness(1.05);
        }

        .tm-action:not(:disabled):active {
          transform: scale(0.98);
        }

        /* Progress State */
        .tm-progress {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 16px 0;
        }

        .tm-status-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }

        .tm-status-icon.success {
          background: linear-gradient(135deg, #10B981, #10B981);
        }

        .tm-status-icon.error {
          background: linear-gradient(135deg, #F43F5E, #F43F5E);
        }

        .tm-status-icon svg {
          width: 24px;
          height: 24px;
          color: #000;
        }

        .tm-status-icon.error svg { color: #fff; }

        .tm-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(255,255,255,0.1);
          border-top-color: #14F195;
          border-radius: 50%;
          animation: tm-spin 0.8s linear infinite;
        }

        .tm-spinner-small {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.2);
          border-top-color: currentColor;
          border-radius: 50%;
          animation: tm-spin 0.8s linear infinite;
          display: inline-block;
        }

        @keyframes tm-spin {
          to { transform: rotate(360deg); }
        }

        .tm-status-text {
          font-size: 14px;
          font-weight: 500;
          color: #fff;
        }

        .tm-error {
          font-size: 12px;
          color: #F43F5E;
          text-align: center;
        }

        /* Transaction Section (P1) */
        .tm-tx-section {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 10px 12px;
          background: rgba(255,255,255,0.03);
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.06);
        }

        .tm-tx-section.memo {
          background: rgba(20, 241, 149, 0.05);
          border-color: rgba(20, 241, 149, 0.15);
        }

        .tm-tx-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .tm-tx-label {
          font-size: 11px;
          font-weight: 500;
          color: rgba(255,255,255,0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .tm-copy-btn {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.06);
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .tm-copy-btn:hover {
          background: rgba(255,255,255,0.1);
        }

        .tm-copy-btn.copied {
          background: rgba(0, 255, 178, 0.2);
        }

        .tm-copy-btn svg {
          width: 12px;
          height: 12px;
          color: rgba(255,255,255,0.6);
        }

        .tm-copy-btn.copied svg {
          color: #10B981;
        }

        .tm-tx-link {
          font-size: 12px;
          color: #14F195;
          text-decoration: none;
          transition: color 0.15s;
        }

        .tm-tx-link:hover {
          color: #10B981;
          text-decoration: underline;
        }

        .tm-tx-link.memo {
          color: #14F195;
        }

        /* Explorer Links */
        .tm-explorer-links {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .tm-explorer-link {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 6px 10px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 500;
          color: rgba(255,255,255,0.7);
          text-decoration: none;
          transition: all 0.15s;
          cursor: pointer;
        }

        .tm-explorer-link:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.15);
          color: #fff;
          transform: translateY(-1px);
        }

        .tm-explorer-link svg {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
        }

        /* Solscan - purple theme */
        .tm-explorer-link.solscan {
          border-color: rgba(153, 69, 255, 0.2);
        }
        .tm-explorer-link.solscan:hover {
          background: rgba(153, 69, 255, 0.15);
          border-color: rgba(153, 69, 255, 0.4);
        }
        .tm-explorer-link.solscan svg {
          color: #9945FF;
        }

        /* Solana Explorer - teal/green theme */
        .tm-explorer-link.solana {
          border-color: rgba(20, 241, 149, 0.2);
        }
        .tm-explorer-link.solana:hover {
          background: rgba(20, 241, 149, 0.15);
          border-color: rgba(20, 241, 149, 0.4);
        }
        .tm-explorer-link.solana svg {
          color: #14F195;
        }

        /* Orb - cyan/blue theme */
        .tm-explorer-link.orb {
          border-color: rgba(59, 130, 246, 0.2);
        }
        .tm-explorer-link.orb:hover {
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.4);
        }
        .tm-explorer-link.orb svg {
          color: #3B82F6;
        }

        /* Memo Section (P1 & P2) */
        .tm-memo-section {
          width: 100%;
          margin-top: 4px;
          padding: 10px 12px;
          background: rgba(255,255,255,0.02);
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.06);
        }

        .tm-memo-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .tm-memo-label {
          font-size: 11px;
          font-weight: 500;
          color: rgba(255,255,255,0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .tm-memo-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 500;
        }

        .tm-memo-status.pending {
          color: #FFC107;
        }

        .tm-memo-status.success {
          color: #10B981;
        }

        .tm-memo-status.error {
          color: #F43F5E;
        }

        .tm-memo-info {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          margin: 0;
        }

        .tm-memo-error {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .tm-memo-error-text {
          font-size: 12px;
          color: #F43F5E;
          margin: 0;
        }

        .tm-retry-btn {
          width: 100%;
          padding: 10px;
          background: rgba(255, 71, 87, 0.1);
          border: 1px solid rgba(255, 71, 87, 0.3);
          border-radius: 8px;
          color: #F43F5E;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }

        .tm-retry-btn:hover:not(:disabled) {
          background: rgba(255, 71, 87, 0.15);
        }

        .tm-retry-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .tm-retry-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .tm-memo-note {
          font-size: 10px;
          color: rgba(255,255,255,0.4);
          margin: 0;
          text-align: center;
        }

        /* No Funds Screen */
        .tm-no-funds {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 8px 0;
        }

        .tm-no-funds-icon {
          width: 64px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(255, 193, 7, 0.15) 0%, rgba(255, 152, 0, 0.15) 100%);
          border-radius: 50%;
          margin-bottom: 16px;
        }

        .tm-no-funds-icon svg {
          width: 32px;
          height: 32px;
          color: #FFC107;
        }

        .tm-no-funds-title {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 8px;
        }

        .tm-no-funds-desc {
          font-size: 13px;
          color: rgba(255,255,255,0.6);
          margin: 0 0 16px;
          line-height: 1.4;
        }

        .tm-balance-info {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 10px 12px;
          background: rgba(255,255,255,0.03);
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.06);
          margin-bottom: 16px;
        }

        .tm-balance-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .tm-balance-label {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
        }

        .tm-balance-value {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255,255,255,0.9);
        }

        .tm-add-funds-options {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .tm-add-funds-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'Outfit', sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: #fff;
        }

        .tm-add-funds-btn:hover {
          background: rgba(255,255,255,0.08);
          transform: translateY(-1px);
        }

        .tm-add-funds-btn svg {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }

        .tm-add-funds-btn.moonpay {
          border-color: rgba(117, 81, 255, 0.3);
        }

        .tm-add-funds-btn.moonpay:hover {
          background: rgba(117, 81, 255, 0.1);
          border-color: rgba(117, 81, 255, 0.5);
        }

        .tm-add-funds-btn.moonpay svg {
          color: #7551FF;
        }

        .tm-add-funds-btn.jupiter {
          border-color: rgba(20, 241, 149, 0.3);
        }

        .tm-add-funds-btn.jupiter:hover {
          background: rgba(20, 241, 149, 0.1);
          border-color: rgba(20, 241, 149, 0.5);
        }

        .tm-add-funds-btn.jupiter svg {
          color: #14F195;
        }

        .tm-add-funds-provider {
          margin-left: auto;
          font-size: 11px;
          font-weight: 400;
          color: rgba(255,255,255,0.4);
        }

        .tm-deposit-section {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px 14px;
          background: rgba(255,255,255,0.02);
          border: 1px dashed rgba(255,255,255,0.15);
          border-radius: 12px;
        }

        .tm-deposit-label {
          font-size: 12px;
          font-weight: 500;
          color: rgba(255,255,255,0.6);
        }

        .tm-wallet-address {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          background: rgba(0,0,0,0.3);
          border-radius: 8px;
        }

        .tm-address-text {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          color: #fff;
        }

        .tm-copy-address-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.08);
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .tm-copy-address-btn:hover {
          background: rgba(255,255,255,0.15);
        }

        .tm-copy-address-btn.copied {
          background: rgba(0, 255, 178, 0.2);
        }

        .tm-copy-address-btn svg {
          width: 14px;
          height: 14px;
          color: rgba(255,255,255,0.6);
        }

        .tm-copy-address-btn.copied svg {
          color: #10B981;
        }

        .tm-deposit-note {
          font-size: 11px;
          color: rgba(255,255,255,0.4);
          text-align: center;
        }

        .tm-refresh-balance {
          margin-top: 12px;
          padding: 10px 20px;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 8px;
          font-family: 'Outfit', sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          transition: all 0.15s;
        }

        .tm-refresh-balance:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.25);
          color: #fff;
        }

        /* Mobile adjustments */
        @media (max-width: 380px) {
          .tm-container { padding: 16px; }
          .tm-modal { max-width: 100%; }
          .tm-body { padding: 12px 14px 14px; gap: 10px; }
          .tm-question { font-size: 12px; }
          .tm-side { padding: 8px 10px; }
          .tm-side-label, .tm-side-price { font-size: 12px; }
          .tm-input { font-size: 15px; }
          .tm-quick-btn { padding: 0 8px; font-size: 11px; }
          .tm-action { padding: 11px; font-size: 13px; }
          .tm-no-funds-icon { width: 56px; height: 56px; }
          .tm-no-funds-icon svg { width: 28px; height: 28px; }
          .tm-no-funds-title { font-size: 16px; }
          .tm-add-funds-btn { padding: 10px 12px; font-size: 13px; }
        }
      `}</style>
    </>
  );
}
