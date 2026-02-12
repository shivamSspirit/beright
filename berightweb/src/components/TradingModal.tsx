'use client';

import { useState, useCallback, useEffect } from 'react';
import { animated, useSpring } from '@react-spring/web';
import { DFlowData, DFlowTokens } from '@/lib/types';
import { useDFlowTrading, TradingStep } from '@/hooks/useDFlowTrading';

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
  onClose: () => void;
}

const stepLabels: Record<TradingStep, string> = {
  idle: '',
  'getting-quote': 'Getting quote...',
  signing: 'Sign in wallet',
  submitting: 'Submitting...',
  confirming: 'Confirming...',
  success: 'Success!',
  error: 'Failed',
};

export default function TradingModal({ prediction, isOpen, onClose }: TradingModalProps) {
  const [side, setSide] = useState<'YES' | 'NO'>('YES');
  const [amount, setAmount] = useState<string>('10');
  const [inputToken, setInputToken] = useState<'USDC' | 'SOL'>('USDC');
  const [estimatedOutput, setEstimatedOutput] = useState<number | null>(null);

  const {
    step, error, txUrl, isConnected, isReady, executeTrade, connectWallet, reset,
  } = useDFlowTrading();

  const dflow = prediction.dflow;
  const tokens = dflow?.tokens;
  const isTokenized = tokens?.yesMint && tokens?.noMint && tokens?.isInitialized;
  const isTrading = step !== 'idle' && step !== 'success' && step !== 'error';

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

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

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

  const handleTrade = useCallback(async () => {
    if (!isTokenized || !tokens?.yesMint || !tokens?.noMint) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;
    await executeTrade({
      side, amount: numAmount, inputToken,
      yesMint: tokens.yesMint, noMint: tokens.noMint, slippageBps: 100,
    });
  }, [isTokenized, tokens, amount, side, inputToken, executeTrade]);

  const handleClose = useCallback(() => {
    if (!isTrading) onClose();
  }, [isTrading, onClose]);

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
            <button className="tm-close" onClick={handleClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="tm-body">
            {step === 'idle' ? (
              <>
                {/* Question - truncated */}
                <p className="tm-question">{prediction.question}</p>

                {/* Side Toggle */}
                <div className="tm-sides">
                  <button
                    className={`tm-side ${side === 'YES' ? 'active yes' : ''}`}
                    onClick={() => setSide('YES')}
                    disabled={isTrading}
                  >
                    <span className="tm-side-label">YES</span>
                    <span className="tm-side-price">{yesPrice}</span>
                  </button>
                  <button
                    className={`tm-side ${side === 'NO' ? 'active no' : ''}`}
                    onClick={() => setSide('NO')}
                    disabled={isTrading}
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
                      disabled={isTrading}
                    />
                  </div>
                  <div className="tm-quick">
                    {['10', '25', '50', '100'].map((v) => (
                      <button
                        key={v}
                        className={`tm-quick-btn ${amount === v ? 'active' : ''}`}
                        onClick={() => setAmount(v)}
                        disabled={isTrading}
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

                {/* Warning */}
                {!isTokenized && (
                  <div className="tm-warning">Market not available for trading</div>
                )}

                {/* Action */}
                <button
                  className={`tm-action ${!isConnected ? 'connect' : side.toLowerCase()}`}
                  onClick={!isConnected ? connectWallet : handleTrade}
                  disabled={isTrading || (!isConnected ? !isReady : !isTokenized)}
                >
                  {!isConnected ? 'Connect Wallet' : `Buy ${side}`}
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
                <span className="tm-status-text">{stepLabels[step]}</span>
                {error && <span className="tm-error">{error}</span>}
                {txUrl && (
                  <a href={txUrl} target="_blank" rel="noopener noreferrer" className="tm-tx-link">
                    View on Solscan →
                  </a>
                )}
                {(step === 'success' || step === 'error') && (
                  <button className="tm-action done" onClick={handleClose}>
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

        .tm-close:hover { background: rgba(255,255,255,0.1); }
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
          background: rgba(0, 230, 118, 0.1);
          border-color: #00E676;
        }

        .tm-side.active.no {
          background: rgba(255, 82, 82, 0.1);
          border-color: #FF5252;
        }

        .tm-side-label {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255,255,255,0.8);
        }

        .tm-side.active.yes .tm-side-label { color: #00E676; }
        .tm-side.active.no .tm-side-label { color: #FF5252; }

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

        .tm-action.yes {
          background: linear-gradient(135deg, #00E676 0%, #00C853 100%);
          color: #000;
        }

        .tm-action.no {
          background: linear-gradient(135deg, #FF5252 0%, #D32F2F 100%);
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
          background: linear-gradient(135deg, #00E676, #00C853);
        }

        .tm-status-icon.error {
          background: linear-gradient(135deg, #FF5252, #D32F2F);
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
          color: #FF5252;
          text-align: center;
        }

        .tm-tx-link {
          font-size: 12px;
          color: #14F195;
          text-decoration: none;
        }

        .tm-tx-link:hover {
          text-decoration: underline;
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
        }
      `}</style>
    </>
  );
}
