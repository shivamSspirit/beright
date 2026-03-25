'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { animated, useSpring, to } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Prediction } from '@/lib/types';
import { useUser } from '@/hooks/useUnifiedUser';
import { getDFlowCandlesticks, DFlowCandleData } from '@/lib/api';
import { usePredictionRecorder } from '@/hooks/usePredictionRecorder';
import { usePredictions } from '@/hooks/usePredictions';
import { useMode } from '@/context/ModeContext';

interface SwipeCardProps {
  prediction: Prediction;
  onSwipe: (direction: 'left' | 'right', prediction: Prediction) => void;
  onSkip?: (prediction: Prediction) => void;
  onConnectWallet?: () => void;
  onTradeComplete?: (prediction: Prediction, side: 'YES' | 'NO', traded: boolean) => void;
  isTop: boolean;
  stackIndex: number;
}

function formatVol(v: string): string {
  const match = v.match(/[\d.]+/);
  if (!match) return v;
  const n = parseFloat(match[0]);
  if (v.includes('M')) return `$${n.toFixed(1)}M`;
  if (v.includes('K')) return `$${n}K`;
  return `$${n}`;
}

// Generate realistic close dates when TBD
function generateCloseDate(id: string): Date {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const now = new Date();
  // Generate dates between 1 day and 6 months from now
  const daysAhead = 1 + (hash % 180);
  const closeDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  return closeDate;
}

function Countdown({ date, marketId }: { date: string; marketId: string }) {
  const [t, setT] = useState('');
  const [fullDate, setFullDate] = useState('');

  useEffect(() => {
    const calc = () => {
      let timestamp: number;

      // If date is TBD or invalid, generate a realistic one
      if (!date || date === 'TBD' || date === 'Unknown') {
        const generatedDate = generateCloseDate(marketId);
        timestamp = generatedDate.getTime();
        setFullDate(generatedDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: generatedDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        }));
      } else {
        timestamp = new Date(date).getTime();
        if (isNaN(timestamp)) {
          const generatedDate = generateCloseDate(marketId);
          timestamp = generatedDate.getTime();
          setFullDate(generatedDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          }));
        } else {
          const d = new Date(date);
          setFullDate(d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
          }));
        }
      }

      const diff = timestamp - Date.now();
      if (diff <= 0) return setT('Ended');
      const d = Math.floor(diff / 864e5);
      const h = Math.floor((diff % 864e5) / 36e5);
      setT(d > 30 ? `${Math.floor(d/30)}mo` : d > 0 ? `${d}d ${h}h` : `${h}h`);
    };
    calc();
    const i = setInterval(calc, 6e4);
    return () => clearInterval(i);
  }, [date, marketId]);

  return (
    <span title={fullDate}>{t}</span>
  );
}

// Mini Line Chart Component
function MiniLineChart({ isYes, seed, price }: { isYes: boolean; seed: number; price: number }) {
  const { points, trend } = useMemo(() => {
    const base = price;
    const data: number[] = [];
    let val = base - 0.1;
    for (let i = 0; i < 12; i++) {
      const h = (seed + i * 13) % 100;
      val += ((h % 30) - 14) / 100;
      val = Math.max(0.01, Math.min(0.99, val));
      data.push(val);
    }
    data[11] = base;

    const minVal = Math.min(...data) - 0.02;
    const maxVal = Math.max(...data) + 0.02;
    const range = maxVal - minVal || 0.1;

    const pts = data.map((v, i) => {
      const x = (i / 11) * 100;
      const y = ((maxVal - v) / range) * 100;
      return `${x},${y}`;
    });

    return { points: pts.join(' '), trend: data[11] > data[0] };
  }, [seed, price]);

  const color = isYes ? '#10B981' : '#F43F5E';
  const gradientId = `grad-${isYes ? 'yes' : 'no'}-${seed}`;

  return (
    <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="mini-line-svg">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,50 ${points} 100,50`}
        fill={`url(#${gradientId})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
      />
      <circle
        cx="100"
        cy={points.split(' ').pop()?.split(',')[1]}
        r="3"
        fill={color}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
    </svg>
  );
}

// ============================================
// TRADING CHART - Kalshi-style with real data
// ============================================

type TimeRange = '1D' | '1W' | '1M' | 'ALL';

function TradingChart({
  ticker,
  currentPrice,
  seed
}: {
  ticker?: string;
  currentPrice: number;
  seed: number;
}) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1W');
  const [candles, setCandles] = useState<DFlowCandleData[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch real candlestick data
  useEffect(() => {
    if (!ticker) return;

    const fetchCandles = async () => {
      setLoading(true);
      try {
        const resolution = timeRange === '1D' ? '1h' : timeRange === '1W' ? '1h' : '1d';
        const result = await getDFlowCandlesticks(ticker, resolution);
        if (result.success && result.candles?.length > 0) {
          setCandles(result.candles);
        }
      } catch (err) {
        console.error('Failed to fetch candles:', err);
      }
      setLoading(false);
    };

    fetchCandles();
  }, [ticker, timeRange]);

  // Generate mock data if no real data available
  const chartData = useMemo(() => {
    if (candles.length > 0) {
      return candles.map(c => ({
        time: c.time,
        price: c.close * 100, // Convert to cents/percentage
      }));
    }

    // Fallback: generate realistic mock data
    const points = timeRange === '1D' ? 24 : timeRange === '1W' ? 7 * 4 : timeRange === '1M' ? 30 : 90;
    const data = [];
    let price = currentPrice * 100;
    const now = Date.now();
    const interval = timeRange === '1D' ? 3600000 : timeRange === '1W' ? 6 * 3600000 : 24 * 3600000;

    for (let i = points - 1; i >= 0; i--) {
      const volatility = ((seed + i) % 8) - 4;
      price = Math.max(5, Math.min(95, price + volatility));
      data.push({
        time: now - i * interval,
        price: Math.round(price * 10) / 10,
      });
    }
    data[data.length - 1].price = currentPrice * 100;
    return data;
  }, [candles, currentPrice, seed, timeRange]);

  // Calculate chart dimensions
  const prices = chartData.map(d => d.price);
  const minPrice = Math.max(0, Math.min(...prices) - 5);
  const maxPrice = Math.min(100, Math.max(...prices) + 5);
  const priceRange = maxPrice - minPrice || 10;

  // Generate SVG path
  const pathPoints = chartData.map((d, i) => {
    const x = (i / (chartData.length - 1)) * 100;
    const y = 100 - ((d.price - minPrice) / priceRange) * 100;
    return `${x},${y}`;
  }).join(' ');

  const currentPriceY = 100 - ((currentPrice * 100 - minPrice) / priceRange) * 100;
  const priceChange = chartData.length > 1
    ? ((chartData[chartData.length - 1].price - chartData[0].price) / chartData[0].price * 100).toFixed(1)
    : '0';
  const isUp = parseFloat(priceChange) >= 0;

  // Format time labels
  const getTimeLabels = () => {
    if (chartData.length < 2) return ['', ''];
    const first = new Date(chartData[0].time);
    const last = new Date(chartData[chartData.length - 1].time);

    if (timeRange === '1D') {
      return [first.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 'Now'];
    }
    return [
      first.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      last.toLocaleDateString([], { month: 'short', day: 'numeric' })
    ];
  };

  const [startLabel, endLabel] = getTimeLabels();

  return (
    <div className="trading-chart">
      <div className="tc-header">
        <span className="tc-title">PRICE CHART</span>
        <span className={`tc-change ${isUp ? 'up' : 'down'}`}>
          {isUp ? '+' : ''}{priceChange}%
        </span>
      </div>

      {/* Time Range Selector */}
      <div className="tc-ranges">
        {(['1D', '1W', '1M', 'ALL'] as TimeRange[]).map(range => (
          <button
            key={range}
            className={`tc-range-btn ${timeRange === range ? 'active' : ''}`}
            onClick={() => setTimeRange(range)}
          >
            {range}
          </button>
        ))}
      </div>

      {/* Chart Area */}
      <div className="tc-chart-area">
        {/* Y-Axis Labels */}
        <div className="tc-y-axis">
          <span>{Math.round(maxPrice)}%</span>
          <span>{Math.round((maxPrice + minPrice) / 2)}%</span>
          <span>{Math.round(minPrice)}%</span>
        </div>

        {/* Chart SVG */}
        <div className="tc-chart-container">
          {loading ? (
            <div className="tc-loading">Loading...</div>
          ) : (
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="tc-svg">
              {/* Grid lines */}
              <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
              <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />

              {/* Gradient fill */}
              <defs>
                <linearGradient id="tcGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={isUp ? '#00F593' : '#FF4757'} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={isUp ? '#00F593' : '#FF4757'} stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Area fill */}
              <polygon
                points={`0,100 ${pathPoints} 100,100`}
                fill="url(#tcGradient)"
              />

              {/* Line */}
              <polyline
                points={pathPoints}
                fill="none"
                stroke={isUp ? '#00F593' : '#FF4757'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Current price dot */}
              <circle
                cx="100"
                cy={currentPriceY}
                r="4"
                fill={isUp ? '#00F593' : '#FF4757'}
              />
            </svg>
          )}

          {/* Current Price Label */}
          <div
            className="tc-price-label"
            style={{ top: `${Math.max(10, Math.min(85, currentPriceY))}%` }}
          >
            <span className={isUp ? 'up' : 'down'}>{(currentPrice * 100).toFixed(0)}¢</span>
          </div>
        </div>
      </div>

      {/* X-Axis Labels */}
      <div className="tc-x-axis">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </div>
  );
}

// ============================================
// TRADING SHEET - Bottom Sheet for Trading
// ============================================

function TradingSheet({
  prediction,
  isVisible,
  direction,
  onConfirm,
  onClose,
  walletAddress,
}: {
  prediction: Prediction;
  isVisible: boolean;
  direction: 'left' | 'right' | null;
  onConfirm: (traded: boolean) => void;
  onClose: () => void;
  walletAddress: string | null;
}) {
  const [amount, setAmount] = useState(5);
  const [isTrading, setIsTrading] = useState(false);

  // Calibration - record every prediction on-chain
  const { recordPrediction } = usePredictionRecorder();

  // Save predictions to localStorage/API for profile display
  const { savePrediction } = usePredictions(walletAddress);

  // Check if in demo mode
  const { isDemo } = useMode();

  const side = direction === 'right' ? 'YES' : 'NO';
  const isYes = direction === 'right';

  const yesPrice = prediction.dflow?.yesBid ?? prediction.marketOdds / 100;
  const noPrice = prediction.dflow?.noBid ?? (100 - prediction.marketOdds) / 100;
  const selectedPrice = isYes ? yesPrice : noPrice;
  const selectedPct = isYes ? prediction.marketOdds : 100 - prediction.marketOdds;

  // Calculate potential payout
  const potentialPayout = amount / selectedPrice;
  const potentialProfit = potentialPayout - amount;

  // Check if trading is available
  // In demo mode, always allow trading (we record to calibration program, not DFlow)
  // In production, require DFlow tokens to be initialized
  const canTrade = isDemo || prediction.dflow?.tokens?.isInitialized;

  // Spring animation for sheet
  const sheetSpring = useSpring({
    transform: isVisible ? 'translateX(-50%) translateY(0%)' : 'translateX(-50%) translateY(100%)',
    opacity: isVisible ? 1 : 0,
    config: { tension: 300, friction: 30 },
  });

  const backdropSpring = useSpring({
    opacity: isVisible ? 1 : 0,
    config: { tension: 400, friction: 35 },
  });

  // Don't render on server
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isVisible) return null;

  const handleTrade = async () => {
    setIsTrading(true);

    try {
      // Use the selected price as the user's confidence level
      const probability = isYes ? selectedPrice : 1 - selectedPrice;

      // Record prediction to on-chain calibration program
      const signature = await recordPrediction({
        marketId: prediction.id,
        direction: isYes ? 'yes' : 'no',
        probability,
      });

      if (!signature) {
        throw new Error('Failed to record prediction on-chain');
      }

      console.log('[SwipeCard] Prediction recorded on-chain:', signature);

      // Save to localStorage with the calibration tx signature
      const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
      await savePrediction(
        {
          id: prediction.id,
          question: prediction.question,
          marketOdds: prediction.marketOdds,
          platform: prediction.platform,
        },
        side,
        signature,
        explorerUrl
      );

      setIsTrading(false);
      onConfirm(true);
    } catch (err) {
      console.error('[SwipeCard] Trade error:', err);
      setIsTrading(false);
      onConfirm(false);
    }
  };

  const handleSkip = () => {
    onConfirm(false);
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <animated.div
        className="trading-sheet-backdrop"
        style={{ opacity: backdropSpring.opacity }}
        onClick={onClose}
      />

      {/* Trading Sheet */}
      <animated.div
        className="trading-sheet"
        style={{
          transform: sheetSpring.transform,
          opacity: sheetSpring.opacity,
        }}
      >
        {/* Handle */}
        <div className="ts-handle" onClick={onClose}>
          <div className="ts-handle-bar" />
        </div>

        {/* Direction Badge */}
        <div className={`ts-direction ${isYes ? 'yes' : 'no'}`}>
          <span className="ts-direction-icon">{isYes ? '✓' : '✕'}</span>
          <span className="ts-direction-label">You're betting {side}</span>
        </div>

        {/* Question */}
        <p className="ts-question">{prediction.question}</p>

        {/* Price Display */}
        <div className="ts-price-section">
          <div className={`ts-price-box ${isYes ? 'yes' : 'no'}`}>
            <span className="ts-price-label">{side} Price</span>
            <span className="ts-price-value">{Math.round(selectedPrice * 100)}¢</span>
            <span className="ts-price-pct">{selectedPct}% chance</span>
          </div>
        </div>

        {/* Amount Selector */}
        <div className="ts-amount-section">
          <span className="ts-amount-label">Amount (USDC)</span>
          <div className="ts-amount-buttons">
            {[5, 10, 25, 50, 100].map(val => (
              <button
                key={val}
                className={`ts-amount-btn ${amount === val ? 'active' : ''}`}
                onClick={() => setAmount(val)}
              >
                ${val}
              </button>
            ))}
          </div>
        </div>

        {/* Potential Returns */}
        <div className="ts-returns">
          <div className="ts-return-row">
            <span>You pay</span>
            <span className="ts-return-value">${amount.toFixed(2)}</span>
          </div>
          <div className="ts-return-row">
            <span>Potential return</span>
            <span className="ts-return-value highlight">${potentialPayout.toFixed(2)}</span>
          </div>
          <div className="ts-return-row profit">
            <span>Potential profit</span>
            <span className="ts-return-value profit">+${potentialProfit.toFixed(2)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="ts-actions">
          <button className="ts-btn ts-btn-skip" onClick={handleSkip}>
            Skip Trade
          </button>
          <button
            className={`ts-btn ts-btn-trade ${isYes ? 'yes' : 'no'}`}
            onClick={handleTrade}
            disabled={!canTrade || isTrading}
          >
            {isTrading ? 'Recording...' : isDemo ? `Record ${side}` : (canTrade ? `Confirm ${side}` : 'Trading Unavailable')}
          </button>
        </div>

        {/* DFlow Link - only show in production when not available */}
        {!isDemo && !canTrade && (
          <p className="ts-dflow-note">
            <a href="https://dflow.net/proof" target="_blank" rel="noopener noreferrer">
              Verify wallet at DFlow
            </a> to enable trading
          </p>
        )}
      </animated.div>

      <style jsx global>{`
        .trading-sheet-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 9998;
        }

        .trading-sheet {
          position: fixed;
          bottom: 0;
          left: 50%;
          width: calc(100% - 16px);
          max-width: 340px;
          background: linear-gradient(180deg, #1a1a22 0%, #0d0d12 100%);
          border-radius: 24px 24px 0 0;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-bottom: none;
          padding: 0 16px 24px;
          padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
          z-index: 9999;
          font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
          box-shadow: 0 -10px 60px rgba(0, 0, 0, 0.6);
        }

        .ts-handle {
          display: flex;
          justify-content: center;
          padding: 12px 0 16px;
          cursor: pointer;
        }

        .ts-handle-bar {
          width: 40px;
          height: 4px;
          background: rgba(255, 255, 255, 0.25);
          border-radius: 4px;
        }

        .ts-direction {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px 20px;
          border-radius: 16px;
          margin-bottom: 16px;
        }

        .ts-direction.yes {
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .ts-direction.no {
          background: rgba(244, 63, 94, 0.15);
          border: 1px solid rgba(244, 63, 94, 0.3);
        }

        .ts-direction-icon {
          font-size: 24px;
          font-weight: 700;
        }

        .ts-direction.yes .ts-direction-icon { color: #10B981; }
        .ts-direction.no .ts-direction-icon { color: #F43F5E; }

        .ts-direction-label {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
        }

        .ts-question {
          font-size: 14px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.7);
          text-align: center;
          margin: 0 0 20px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .ts-price-section {
          display: flex;
          justify-content: center;
          margin-bottom: 20px;
        }

        .ts-price-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px 32px;
          border-radius: 16px;
          min-width: 160px;
        }

        .ts-price-box.yes {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.25);
        }

        .ts-price-box.no {
          background: rgba(244, 63, 94, 0.1);
          border: 1px solid rgba(244, 63, 94, 0.25);
        }

        .ts-price-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .ts-price-value {
          font-size: 36px;
          font-weight: 800;
          font-family: 'JetBrains Mono', monospace;
        }

        .ts-price-box.yes .ts-price-value { color: #10B981; }
        .ts-price-box.no .ts-price-value { color: #F43F5E; }

        .ts-price-pct {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          margin-top: 2px;
        }

        .ts-amount-section {
          margin-bottom: 20px;
        }

        .ts-amount-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          margin-bottom: 10px;
          text-align: center;
        }

        .ts-amount-buttons {
          display: flex;
          gap: 8px;
          justify-content: center;
        }

        .ts-amount-btn {
          padding: 10px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ts-amount-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .ts-amount-btn.active {
          background: rgba(0, 255, 178, 0.15);
          border-color: rgba(0, 255, 178, 0.4);
          color: #00FFB2;
        }

        .ts-returns {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 20px;
        }

        .ts-return-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 0;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
        }

        .ts-return-row.profit {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          margin-top: 6px;
          padding-top: 10px;
        }

        .ts-return-value {
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
          color: #fff;
        }

        .ts-return-value.highlight {
          color: #00FFB2;
        }

        .ts-return-value.profit {
          color: #10B981;
        }

        .ts-actions {
          display: flex;
          gap: 12px;
        }

        .ts-btn {
          flex: 1;
          padding: 16px;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .ts-btn-skip {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.6);
        }

        .ts-btn-skip:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .ts-btn-trade {
          flex: 2;
        }

        .ts-btn-trade.yes {
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          color: #000;
        }

        .ts-btn-trade.no {
          background: linear-gradient(135deg, #F43F5E 0%, #DC2626 100%);
          color: #fff;
        }

        .ts-btn-trade:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .ts-btn-trade:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .ts-dflow-note {
          text-align: center;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          margin-top: 12px;
        }

        .ts-dflow-note a {
          color: #00FFB2;
          text-decoration: none;
        }

        .ts-dflow-note a:hover {
          text-decoration: underline;
        }
      `}</style>
    </>,
    document.body
  );
}

// ============================================
// MARKET DETAIL DRAWER - Bottom Sheet Design
// ============================================

function MarketDetailDrawer({
  prediction,
  isVisible,
  mock,
  onClose,
}: {
  prediction: Prediction;
  isVisible: boolean;
  mock: { trading: number; delta: number; liq: number; traders: number; seed: number };
  onClose: () => void;
}) {
  // Spring animation for drawer slide-up (use vh units for reliable positioning)
  const drawerSpring = useSpring({
    transform: isVisible ? 'translateX(-50%) translateY(0vh)' : 'translateX(-50%) translateY(100vh)',
    opacity: isVisible ? 1 : 0,
    config: { tension: 300, friction: 30 },
  });

  const backdropSpring = useSpring({
    opacity: isVisible ? 1 : 0,
    config: { tension: 400, friction: 35 },
  });

  const aiConfidence = prediction.aiPrediction;
  const confidenceColor = aiConfidence >= 70 ? '#00F593' : aiConfidence >= 40 ? '#FFD93D' : '#FF4757';
  const yesPrice = prediction.dflow?.yesBid ?? prediction.marketOdds / 100;
  const noPrice = prediction.dflow?.noBid ?? (100 - prediction.marketOdds) / 100;

  // Generate mock stats
  const stats = useMemo(() => {
    const h = mock.seed;
    return {
      volume24h: 5000 + (h % 50000),
      totalVolume: 50000 + (h % 500000),
      priceHistory: Array.from({ length: 7 }, (_, i) => 30 + ((h + i * 17) % 50)),
      recentTrades: [
        { side: 'YES' as const, amount: 50 + (h % 200), time: '2m', user: 'anon' },
        { side: 'NO' as const, amount: 100 + ((h * 2) % 500), time: '5m', user: 'whale' },
        { side: 'YES' as const, amount: 25 + ((h * 3) % 150), time: '12m', user: 'degen' },
      ],
    };
  }, [mock.seed]);

  // Don't render on server
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isVisible || !mounted) return null;

  // Use portal to render at document root - escapes any parent stacking contexts
  return createPortal(
    <>
      {/* Backdrop */}
      <animated.div
        className="drawer-backdrop"
        style={{ opacity: backdropSpring.opacity }}
        onClick={onClose}
      />

      {/* Drawer */}
      <animated.div
        className="drawer-container"
        style={{
          transform: drawerSpring.transform,
          opacity: drawerSpring.opacity,
        }}
      >
        {/* Drag Handle */}
        <div className="drawer-handle" onClick={onClose}>
          <div className="drawer-handle-bar" />
        </div>

        {/* Header with AI Badge */}
        <div className="drawer-header">
          <div className="ai-badge" style={{ background: `${confidenceColor}15`, borderColor: `${confidenceColor}40` }}>
            <span className="ai-badge-icon">🤖</span>
            <span className="ai-badge-value" style={{ color: confidenceColor }}>{aiConfidence}%</span>
            <span className="ai-badge-label">AI Confidence</span>
          </div>
        </div>

        {/* AI Reasoning */}
        <div className="drawer-section">
          <p className="ai-reasoning">
            {prediction.aiReasoning || 'BeRight AI is analyzing market sentiment, news signals, and historical patterns...'}
          </p>
        </div>

        {/* Price Comparison */}
        <div className="price-row">
          <div className="price-block yes">
            <div className="price-side">YES</div>
            <div className="price-value">{Math.round(yesPrice * 100)}¢</div>
            <div className="price-pct">{prediction.marketOdds}%</div>
          </div>
          <div className="price-divider">
            <span className="price-vs">VS</span>
          </div>
          <div className="price-block no">
            <div className="price-side">NO</div>
            <div className="price-value">{Math.round(noPrice * 100)}¢</div>
            <div className="price-pct">{100 - prediction.marketOdds}%</div>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="stats-strip">
          <div className="stat-chip">
            <span className="stat-chip-value">${(stats.volume24h / 1000).toFixed(0)}K</span>
            <span className="stat-chip-label">24h</span>
          </div>
          <div className="stat-chip">
            <span className="stat-chip-value">{mock.traders}</span>
            <span className="stat-chip-label">traders</span>
          </div>
          <div className="stat-chip">
            <span className="stat-chip-value">${(mock.liq / 1000).toFixed(0)}K</span>
            <span className="stat-chip-label">liquidity</span>
          </div>
          <div className="stat-chip">
            <span className="stat-chip-value">${(stats.totalVolume / 1000).toFixed(0)}K</span>
            <span className="stat-chip-label">total</span>
          </div>
        </div>

        {/* AI Fact Check - Concise */}
        <div className="fact-check-section">
          <div className="fc-header">
            <div className="fc-badge" data-status={aiConfidence >= 70 ? 'high' : aiConfidence >= 40 ? 'medium' : 'low'}>
              <span className="fc-badge-icon">{aiConfidence >= 70 ? '✓' : aiConfidence >= 40 ? '◐' : '⚠'}</span>
              <span className="fc-badge-text">
                {aiConfidence >= 70 ? 'High Confidence' : aiConfidence >= 40 ? 'Moderate' : 'Uncertain'}
              </span>
            </div>
            <span className="fc-score">{aiConfidence}%</span>
          </div>

          <div className="fc-checks">
            <div className="fc-check-item">
              <span className="fc-check-icon">📊</span>
              <span className="fc-check-text">Market data verified</span>
            </div>
            <div className="fc-check-item">
              <span className="fc-check-icon">🔍</span>
              <span className="fc-check-text">{(prediction.aiEvidence?.for?.length || 0) + (prediction.aiEvidence?.against?.length || 0)} sources analyzed</span>
            </div>
            <div className="fc-check-item">
              <span className="fc-check-icon">⏱</span>
              <span className="fc-check-text">Updated {Math.floor(Math.random() * 5) + 1}h ago</span>
            </div>
          </div>

          {/* Resource Links */}
          <div className="fc-links">
            {prediction.url && (
              <a href={prediction.url} target="_blank" rel="noopener noreferrer" className="fc-link primary">
                <span className="fc-link-icon">🎯</span>
                <span>Trade on {prediction.platform}</span>
                <span className="fc-link-arrow">↗</span>
              </a>
            )}
            <div className="fc-links-row">
              <a
                href="https://polymarket.com/markets"
                target="_blank"
                rel="noopener noreferrer"
                className="fc-link-small"
              >
                <span>Polymarket</span>
              </a>
              <a
                href="https://kalshi.com/markets"
                target="_blank"
                rel="noopener noreferrer"
                className="fc-link-small"
              >
                <span>Kalshi</span>
              </a>
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(prediction.question.slice(0, 60))}+news`}
                target="_blank"
                rel="noopener noreferrer"
                className="fc-link-small"
              >
                <span>📰 News</span>
              </a>
              <a
                href={`https://x.com/search?q=${encodeURIComponent(prediction.question.split(' ').slice(0, 4).join(' '))}&f=live`}
                target="_blank"
                rel="noopener noreferrer"
                className="fc-link-small"
              >
                <span>𝕏 Live</span>
              </a>
            </div>
          </div>
        </div>

        {/* Price Chart - Kalshi-style TradingChart */}
        <TradingChart
          ticker={prediction.dflow?.ticker}
          currentPrice={yesPrice}
          seed={mock.seed}
        />

        {/* Order Book */}
        <div className="orderbook-section">
          <span className="orderbook-title">ORDER BOOK</span>
          <div className="orderbook-container">
            <div className="orderbook-side bids">
              <div className="orderbook-header">BIDS (BUY)</div>
              {[
                { price: Math.round(yesPrice * 100) - 1, size: 150 + (mock.seed % 200) },
                { price: Math.round(yesPrice * 100) - 2, size: 280 + (mock.seed % 300) },
                { price: Math.round(yesPrice * 100) - 3, size: 420 + (mock.seed % 400) },
              ].map((bid, i) => (
                <div key={i} className="orderbook-row bid">
                  <span className="ob-price">{bid.price}¢</span>
                  <span className="ob-size">${bid.size}</span>
                  <div className="ob-bar" style={{ width: `${Math.min(100, bid.size / 5)}%` }} />
                </div>
              ))}
            </div>
            <div className="orderbook-side asks">
              <div className="orderbook-header">ASKS (SELL)</div>
              {[
                { price: Math.round(yesPrice * 100) + 1, size: 180 + (mock.seed % 250) },
                { price: Math.round(yesPrice * 100) + 2, size: 320 + (mock.seed % 350) },
                { price: Math.round(yesPrice * 100) + 3, size: 450 + (mock.seed % 450) },
              ].map((ask, i) => (
                <div key={i} className="orderbook-row ask">
                  <span className="ob-price">{ask.price}¢</span>
                  <span className="ob-size">${ask.size}</span>
                  <div className="ob-bar" style={{ width: `${Math.min(100, ask.size / 5)}%` }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Trades */}
        <div className="trades-section">
          <span className="trades-title">RECENT TRADES</span>
          <div className="trades-list">
            {stats.recentTrades.map((trade, i) => (
              <div key={i} className={`trade-item ${trade.side.toLowerCase()}`}>
                <span className="trade-side">{trade.side}</span>
                <span className="trade-amount">${trade.amount}</span>
                <span className="trade-time">{trade.time} ago</span>
              </div>
            ))}
          </div>
        </div>

        {/* Evidence Section */}
        {(prediction.aiEvidence?.for?.length || prediction.aiEvidence?.against?.length) && (
          <div className="evidence-section">
            <div className="evidence-row">
              <div className="evidence-col for">
                <span className="evidence-header">✓ BULLISH</span>
                {(prediction.aiEvidence?.for || []).slice(0, 2).map((item, i) => (
                  <span key={i} className="evidence-point">{item}</span>
                ))}
              </div>
              <div className="evidence-col against">
                <span className="evidence-header">✗ BEARISH</span>
                {(prediction.aiEvidence?.against || []).slice(0, 2).map((item, i) => (
                  <span key={i} className="evidence-point">{item}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Close Hint */}
        <div className="close-hint">
          <span>Tap outside or swipe down to close</span>
        </div>
      </animated.div>

      <style jsx global>{`
        .drawer-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 9998;
        }

        .drawer-container {
          position: fixed;
          bottom: 0;
          left: 50%;
          width: calc(100% - 16px);
          max-width: 340px;
          min-height: 50vh;
          max-height: 80vh;
          background: linear-gradient(180deg, #1a1a22 0%, #0d0d12 100%);
          border-radius: 24px 24px 0 0;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-bottom: none;
          padding: 0 16px 24px;
          padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
          overflow-y: auto;
          z-index: 9999;
          font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
          box-shadow: 0 -10px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.05);
        }

        .drawer-handle {
          display: flex;
          justify-content: center;
          padding: 12px 0 16px;
          cursor: pointer;
        }

        .drawer-handle-bar {
          width: 40px;
          height: 4px;
          background: rgba(255, 255, 255, 0.25);
          border-radius: 4px;
        }

        .drawer-header {
          display: flex;
          justify-content: center;
          margin-bottom: 16px;
        }

        .ai-badge {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 20px;
          border-radius: 16px;
          border: 1px solid;
        }

        .ai-badge-icon {
          font-size: 20px;
        }

        .ai-badge-value {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -1px;
        }

        .ai-badge-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.5);
        }

        .drawer-section {
          margin-bottom: 20px;
        }

        .ai-reasoning {
          font-size: 14px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.7);
          text-align: center;
          margin: 0;
          padding: 0 10px;
        }

        .price-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          padding: 0 4px;
        }

        .price-block {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px 12px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .price-block.yes {
          border-color: rgba(0, 245, 147, 0.2);
          background: rgba(0, 245, 147, 0.05);
        }

        .price-block.no {
          border-color: rgba(255, 71, 87, 0.2);
          background: rgba(255, 71, 87, 0.05);
        }

        .price-side {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          margin-bottom: 4px;
        }

        .price-block.yes .price-side { color: #00F593; }
        .price-block.no .price-side { color: #FF4757; }

        .price-value {
          font-size: 36px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -1px;
          line-height: 1;
        }

        .price-pct {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          margin-top: 4px;
        }

        .price-divider {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .price-vs {
          font-size: 10px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.25);
          letter-spacing: 1px;
        }

        .stats-strip {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          overflow-x: auto;
          padding: 2px 0;
          -webkit-overflow-scrolling: touch;
        }

        .stat-chip {
          flex: 1;
          min-width: 70px;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 10px 8px;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .stat-chip-value {
          font-size: 15px;
          font-weight: 700;
          color: #fff;
        }

        .stat-chip-label {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-top: 2px;
        }

        .chart-section {
          margin-bottom: 20px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .chart-title {
          font-size: 11px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.5);
          letter-spacing: 0.5px;
        }

        .chart-change {
          font-size: 12px;
          font-weight: 700;
        }

        .chart-change.up { color: #00F593; }
        .chart-change.down { color: #FF4757; }

        .line-chart-container {
          position: relative;
        }

        .drawer-line-chart {
          width: 100%;
          height: 80px;
          display: block;
        }

        .chart-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 8px;
        }

        .chart-labels span {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.3);
        }

        /* Order Book Styles */
        .orderbook-section {
          margin-bottom: 20px;
        }

        .orderbook-title {
          font-size: 11px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.5);
          letter-spacing: 0.5px;
          display: block;
          margin-bottom: 12px;
        }

        .orderbook-container {
          display: flex;
          gap: 12px;
        }

        .orderbook-side {
          flex: 1;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 12px;
          padding: 12px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .orderbook-header {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.5px;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .orderbook-side.bids .orderbook-header { color: #00F593; }
        .orderbook-side.asks .orderbook-header { color: #FF4757; }

        .orderbook-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 0;
          position: relative;
        }

        .ob-price {
          font-size: 12px;
          font-weight: 600;
          width: 35px;
        }

        .orderbook-row.bid .ob-price { color: #00F593; }
        .orderbook-row.ask .ob-price { color: #FF4757; }

        .ob-size {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.6);
          flex: 1;
          text-align: right;
        }

        .ob-bar {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          border-radius: 4px;
          z-index: 0;
          opacity: 0.15;
        }

        .orderbook-row.bid .ob-bar { background: #00F593; }
        .orderbook-row.ask .ob-bar { background: #FF4757; }

        .trades-section {
          margin-bottom: 20px;
        }

        .trades-title {
          font-size: 11px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.5);
          letter-spacing: 0.5px;
          display: block;
          margin-bottom: 10px;
        }

        .trades-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .trade-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .trade-item.yes {
          border-left: 3px solid #00F593;
        }

        .trade-item.no {
          border-left: 3px solid #FF4757;
        }

        .trade-side {
          font-size: 11px;
          font-weight: 700;
          width: 32px;
        }

        .trade-item.yes .trade-side { color: #00F593; }
        .trade-item.no .trade-side { color: #FF4757; }

        .trade-amount {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          flex: 1;
        }

        .trade-time {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.35);
        }

        .evidence-section {
          margin-bottom: 16px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 16px;
        }

        .evidence-row {
          display: flex;
          gap: 16px;
        }

        .evidence-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .evidence-header {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .evidence-col.for .evidence-header { color: #00F593; }
        .evidence-col.against .evidence-header { color: #FF4757; }

        .evidence-point {
          font-size: 11px;
          line-height: 1.4;
          color: rgba(255, 255, 255, 0.6);
          padding-left: 8px;
          border-left: 2px solid rgba(255, 255, 255, 0.1);
        }

        .close-hint {
          text-align: center;
          padding-top: 8px;
        }

        .close-hint span {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.25);
        }

        /* Fact Check Section */
        .fact-check-section {
          margin-bottom: 20px;
          padding: 14px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .fc-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .fc-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
        }

        .fc-badge[data-status="high"] {
          background: rgba(0, 245, 147, 0.12);
          color: #00F593;
        }

        .fc-badge[data-status="medium"] {
          background: rgba(255, 217, 61, 0.12);
          color: #FFD93D;
        }

        .fc-badge[data-status="low"] {
          background: rgba(255, 71, 87, 0.12);
          color: #FF4757;
        }

        .fc-badge-icon {
          font-size: 12px;
        }

        .fc-score {
          font-size: 18px;
          font-weight: 800;
          font-family: 'JetBrains Mono', monospace;
          color: rgba(255, 255, 255, 0.9);
        }

        .fc-checks {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }

        .fc-check-item {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 8px;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 6px;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.6);
        }

        .fc-check-icon {
          font-size: 11px;
        }

        .fc-links {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .fc-link {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          color: rgba(255, 255, 255, 0.8);
          text-decoration: none;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .fc-link:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.12);
          color: #fff;
        }

        .fc-link:active {
          transform: scale(0.98);
        }

        .fc-link-icon {
          font-size: 14px;
          flex-shrink: 0;
        }

        .fc-link span:nth-child(2) {
          flex: 1;
        }

        .fc-link-arrow {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        }

        .fc-link.primary {
          background: linear-gradient(135deg, rgba(0, 245, 147, 0.1) 0%, rgba(0, 176, 255, 0.1) 100%);
          border-color: rgba(0, 245, 147, 0.25);
        }

        .fc-link.primary:hover {
          background: linear-gradient(135deg, rgba(0, 245, 147, 0.15) 0%, rgba(0, 176, 255, 0.15) 100%);
          border-color: rgba(0, 245, 147, 0.4);
        }

        .fc-links-row {
          display: flex;
          gap: 6px;
          margin-top: 8px;
        }

        .fc-link-small {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px 6px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.6);
          text-decoration: none;
          font-size: 10px;
          font-weight: 600;
          transition: all 0.2s;
        }

        .fc-link-small:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
          color: #fff;
        }

        .fc-link-small:active {
          transform: scale(0.96);
        }

        /* Trading Chart Styles */
        .trading-chart {
          margin-bottom: 20px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .tc-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }

        .tc-title {
          font-size: 11px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.5);
          letter-spacing: 0.5px;
        }

        .tc-change {
          font-size: 13px;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
        }

        .tc-change.up { color: #00F593; }
        .tc-change.down { color: #FF4757; }

        .tc-ranges {
          display: flex;
          gap: 6px;
          margin-bottom: 16px;
        }

        .tc-range-btn {
          flex: 1;
          padding: 8px 0;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 11px;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tc-range-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .tc-range-btn.active {
          background: rgba(0, 245, 147, 0.12);
          border-color: rgba(0, 245, 147, 0.3);
          color: #00F593;
        }

        .tc-chart-area {
          display: flex;
          gap: 8px;
          height: 100px;
        }

        .tc-y-axis {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          width: 32px;
          flex-shrink: 0;
        }

        .tc-y-axis span {
          font-size: 9px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.35);
          font-family: 'JetBrains Mono', monospace;
          text-align: right;
        }

        .tc-chart-container {
          flex: 1;
          position: relative;
          min-width: 0;
        }

        .tc-loading {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.4);
          font-size: 12px;
        }

        .tc-svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        .tc-price-label {
          position: absolute;
          right: -4px;
          transform: translateY(-50%);
          padding: 3px 6px;
          background: rgba(0, 0, 0, 0.8);
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .tc-price-label span {
          font-size: 10px;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
        }

        .tc-price-label span.up { color: #00F593; }
        .tc-price-label span.down { color: #FF4757; }

        .tc-x-axis {
          display: flex;
          justify-content: space-between;
          margin-top: 10px;
          padding-left: 40px;
        }

        .tc-x-axis span {
          font-size: 9px;
          color: rgba(255, 255, 255, 0.35);
          font-family: 'JetBrains Mono', monospace;
        }

        /* Desktop adjustments */
        /* Mobile-first: keep drawer at mobile width on all screens */
      `}</style>
    </>,
    document.body
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NIKITA BIER "HOOK-FIRST" CARD DESIGN
// 5 Zones: Hook (top) → Question → Probability → Social Proof → Swipe Affordance
// ═══════════════════════════════════════════════════════════════════════════════

// Format trader count human-readable (Bier style: "14.9K traders" not raw numbers)
function formatTraders(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// Calculate payout multiplier (Bier style: "Win 2.4x" not "41¢")
function calcPayout(price: number): string {
  const mult = 1 / price;
  return mult >= 10 ? `${Math.round(mult)}x` : `${mult.toFixed(1)}x`;
}

// Determine urgency status based on market conditions
function getUrgencyBadge(prediction: Prediction, seed: number): { text: string; type: 'hot' | 'new' | 'closing' | null } {
  // Check if closing soon
  const end = new Date(prediction.resolvesAt).getTime();
  const now = Date.now();
  const hoursLeft = (end - now) / (1000 * 60 * 60);

  if (hoursLeft > 0 && hoursLeft < 24) return { text: 'CLOSING SOON', type: 'closing' };

  // Check if contested (40-60% range = most engaging)
  const odds = prediction.marketOdds;
  if (odds >= 40 && odds <= 60) return { text: 'MOVING FAST', type: 'hot' };

  // Simulate "just opened" for some markets
  if (seed % 5 === 0) return { text: 'JUST OPENED', type: 'new' };

  return { text: '', type: null };
}

export default function SwipeCard({ prediction, onSwipe, onSkip, onConnectWallet, onTradeComplete, isTop, stackIndex }: SwipeCardProps) {
  const { isAuthenticated, walletAddress } = useUser();
  const [pressed, setPressed] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showTooltips, setShowTooltips] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Trading sheet state - shows when user swipes
  const [showTradingSheet, setShowTradingSheet] = useState(false);
  const [pendingDirection, setPendingDirection] = useState<'left' | 'right' | null>(null);

  const mock = useMemo(() => {
    const h = prediction.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const delta = ((h % 20) - 10) * 0.8; // Bigger swings for drama
    const traders = 1000 + (h % 15000);
    const odds = prediction.marketOdds;

    // Nikita Bier computed values
    const isHot = Math.abs(delta) > 8; // Hot if moved >8pts

    // Context line - single most important fact
    const contextLines = [
      'Trending on social media',
      'Major news coverage today',
      'Volume spike detected',
      'Analyst upgrade this week',
      'Breaking developments',
      'Market momentum building',
    ];
    const contextLine = contextLines[h % contextLines.length];

    // Gauge color: green (>60%), red (<40%), amber (contested 40-60%)
    const gaugeColor = odds >= 60 ? 'hot-yes' : odds <= 40 ? 'hot-no' : 'contested';

    // Payout multiplier (simplified)
    const payoutMult = (100 / odds).toFixed(1) + 'x';

    // Traders text (social framing)
    const tradersText = traders >= 10000
      ? `${(traders / 1000).toFixed(1)}K`
      : traders >= 1000
        ? `${(traders / 1000).toFixed(1)}K`
        : traders.toString();

    return {
      trading: 50 + (h % 250),
      delta,
      liq: 50000 + (h % 400000),
      traders,
      seed: h,
      // Nikita Bier additions
      isHot,
      contextLine,
      gaugeColor,
      payoutMult,
      tradersText,
      selectedStake: 5, // Default stake
    };
  }, [prediction.id, prediction.marketOdds]);

  // Bier-style computed values
  const urgency = useMemo(() => getUrgencyBadge(prediction, mock.seed), [prediction, mock.seed]);

  const yesPrice = prediction.dflow?.yesBid ?? prediction.marketOdds / 100;
  const noPrice = prediction.dflow?.noBid ?? (100 - prediction.marketOdds) / 100;
  const up = mock.delta >= 0;

  const imageUrl = prediction.dflow?.imageUrl;
  const hasImage = imageUrl && !imgError;

  const [{ x, rotate, scale, y }, api] = useSpring(() => ({
    x: 0, y: 0, rotate: 0, scale: 1,
    config: { tension: 400, friction: 30 },
  }));

  const yesOp = isTop ? x.to(v => Math.min(1, Math.max(0, v / 80) ** 2)) : 0;
  const noOp = isTop ? x.to(v => Math.min(1, Math.max(0, -v / 80) ** 2)) : 0;
  const glow = isTop ? x.to(v => Math.min(1, Math.abs(v) / 150)) : 0;

  // Actually fly out the card (called after trading sheet interaction)
  const flyOut = useCallback((dir: number) => {
    if (navigator.vibrate) navigator.vibrate([5, 15, 5]);
    api.start({
      x: dir * window.innerWidth * 1.5,
      y: dir * -30,
      rotate: dir * 35,
      scale: 0.8,
      config: { tension: 250, friction: 28, clamp: true },
      onRest: () => onSwipe(dir > 0 ? 'right' : 'left', prediction),
    });
  }, [api, onSwipe, prediction]);

  // Show trading sheet instead of flying out immediately
  const showTradingOnSwipe = useCallback((dir: 'left' | 'right') => {
    if (navigator.vibrate) navigator.vibrate(10);
    setPendingDirection(dir);
    setShowTradingSheet(true);
  }, []);

  // Handle trading sheet confirmation
  const handleTradingConfirm = useCallback((traded: boolean) => {
    if (!pendingDirection) return;
    const side = pendingDirection === 'right' ? 'YES' : 'NO';

    // Close the sheet
    setShowTradingSheet(false);

    // Notify parent about trade completion
    if (onTradeComplete) {
      onTradeComplete(prediction, side as 'YES' | 'NO', traded);
    }

    // Fly out the card
    const dir = pendingDirection === 'right' ? 1 : -1;
    setTimeout(() => flyOut(dir), 100);

    setPendingDirection(null);
  }, [pendingDirection, prediction, onTradeComplete, flyOut]);

  // Handle trading sheet close without trading
  const handleTradingClose = useCallback(() => {
    setShowTradingSheet(false);
    setPendingDirection(null);
    // Reset card position
    api.start({ x: 0, y: 0, rotate: 0, scale: 1 });
  }, [api]);

  const bind = useDrag(
    ({ down, movement: [mx, my], velocity: [vx], direction: [dx], first, last }) => {
      if (!isAuthenticated) {
        if (first && Math.abs(mx) > 20 && onConnectWallet) {
          onConnectWallet();
        }
        return;
      }

      // Don't allow dragging while trading sheet is open
      if (showTradingSheet) return;

      if (first) setPressed(true);
      if (last) setPressed(false);
      const trigger = vx > 0.3 || Math.abs(mx) > 80;
      // Use mx (displacement) not dx (instantaneous direction) for reliable swipe detection
      const swipeDir = mx > 0 ? 'right' : 'left';
      if (!down && trigger && Math.abs(mx) > 40) {
        // Show trading sheet instead of flying out
        showTradingOnSwipe(swipeDir);
      } else {
        api.start({
          x: down ? mx : 0,
          y: down ? my * 0.2 : 0,
          rotate: down ? mx * 0.06 : 0,
          scale: down ? 1.02 : 1,
          immediate: k => down && k !== 'scale',
          config: down ? { tension: 800, friction: 35 } : { tension: 500, friction: 30 },
        });
      }
    },
    { filterTaps: true, pointer: { touch: true }, enabled: isTop && !showTradingSheet, rubberband: true }
  );

  const vote = useCallback((dir: 'left' | 'right') => {
    if (!isTop || showTradingSheet) return;

    if (!isAuthenticated) {
      if (onConnectWallet) onConnectWallet();
      return;
    }

    // Show trading sheet instead of flying out
    if (navigator.vibrate) navigator.vibrate(10);
    showTradingOnSwipe(dir);
  }, [isTop, showTradingSheet, isAuthenticated, onConnectWallet, showTradingOnSwipe]);

  const skip = useCallback(() => {
    if (!isTop || !onSkip) return;
    if (navigator.vibrate) navigator.vibrate(5);
    api.start({
      y: -window.innerHeight,
      scale: 0.8,
      rotate: 0,
      config: { tension: 250, friction: 28, clamp: true },
      onRest: () => onSkip(prediction),
    });
  }, [isTop, api, onSkip, prediction]);

  // Toggle tooltips on info button tap (mobile)
  const handleToggleTooltips = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.vibrate) navigator.vibrate(5);
    setShowTooltips(prev => !prev);
  }, []);

  // Hover handlers for desktop
  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
  }, []);

  // Combined visibility - show on hover OR on toggle (for mobile)
  const tooltipsVisible = isTop && (isHovering || showTooltips);

  // Stacked card (not interactive)
  if (stackIndex > 0) {
    return (
      <div className="swipe-card-stack" style={{
        opacity: 0.5 - stackIndex * 0.15,
        transform: `scale(${1 - stackIndex * 0.04}) translateY(${stackIndex * 8}px)`,
        zIndex: 20 - stackIndex,
      }}>
        <div className="swipe-card-inner" />
      </div>
    );
  }

  const bindHandlers = bind();

  return (
    <>
      {/* Market Detail Drawer - Bottom Sheet */}
      <MarketDetailDrawer
        prediction={prediction}
        isVisible={tooltipsVisible}
        mock={mock}
        onClose={() => setShowTooltips(false)}
      />

      {/* Trading Sheet - Shows on swipe */}
      <TradingSheet
        prediction={prediction}
        isVisible={showTradingSheet}
        direction={pendingDirection}
        onConfirm={handleTradingConfirm}
        onClose={handleTradingClose}
        walletAddress={walletAddress}
      />

      {/* ═══════════════════════════════════════════════════════════════════════
          NIKITA BIER 5-ZONE LAYOUT - Hook-First Dopamine Card
          Zone 1: Hook (image + LIVE + category)
          Zone 2: Question (punchy + context)
          Zone 3: Number (probability gauge + payout)
          Zone 4: Social Proof (traders + movement + countdown)
          Zone 5: Swipe Affordance (edge glows + stake chips)
          ═══════════════════════════════════════════════════════════════════════ */}
      <animated.div
        {...(bindHandlers as React.HTMLAttributes<HTMLDivElement>)}
        className={`nb-wrapper ${mock.isHot ? 'nb-hot' : ''}`}
        style={{ x, y, rotate, scale, cursor: pressed ? 'grabbing' : 'grab' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* The Card */}
        <animated.div
          className="nb-card"
          style={{
            boxShadow: to([x, glow], (xv, g) => {
              if (xv > 15) return `0 25px 80px rgba(0,230,118,${0.3 + g * 0.3}), inset 0 0 0 2px rgba(0,230,118,${0.6})`;
              if (xv < -15) return `0 25px 80px rgba(255,82,82,${0.3 + g * 0.3}), inset 0 0 0 2px rgba(255,82,82,${0.6})`;
              return '0 30px 100px rgba(0, 0, 0, 0.6)';
            }),
          }}
        >
          {/* ═══ ZONE 1: THE HOOK (top 30%) ═══ */}
          <div className="nb-hook" style={{
            backgroundImage: hasImage ? `url(${imageUrl})` : undefined,
          }}>
            {/* Gradient overlay for text readability */}
            <div className="nb-hook-overlay" />

            {/* Hot Card Flame Badge */}
            {mock.isHot && (
              <div className="nb-hot-badge">
                <span className="nb-flame">🔥</span>
                <span>MOVING FAST</span>
              </div>
            )}

            {/* Top row: LIVE dot + Category */}
            <div className="nb-hook-top">
              <div className="nb-live">
                <span className="nb-live-dot" />
                <span>LIVE</span>
              </div>
              <div className="nb-category">{prediction.category.toUpperCase()}</div>
            </div>
          </div>

          {/* ═══ ZONE 2: THE QUESTION ═══ */}
          <div className="nb-question-zone">
            <h2 className="nb-question">{prediction.question}</h2>
            <p className="nb-context">
              {mock.contextLine} · <span className={up ? 'up' : 'down'}>{up ? '↑' : '↓'}{Math.abs(mock.delta).toFixed(0)}pts today</span>
            </p>
          </div>

          {/* ═══ ZONE 3: THE NUMBER (Probability Gauge) ═══ */}
          <div className="nb-number-zone">
            <div className="nb-gauge">
              <div
                className={`nb-gauge-fill ${mock.gaugeColor}`}
                style={{ width: `${prediction.marketOdds}%` }}
              />
              <div className="nb-gauge-track" />
            </div>
            <div className="nb-odds-row">
              <span className={`nb-odds-value ${mock.gaugeColor}`}>{prediction.marketOdds}%</span>
              <span className="nb-odds-label">YES</span>
            </div>
            <div className="nb-payout">
              Pays <span className="nb-payout-mult">{mock.payoutMult}</span> if YES
            </div>
          </div>

          {/* ═══ ZONE 4: SOCIAL PROOF BAR ═══ */}
          <div className="nb-social-zone">
            <div className="nb-social-stat">
              <span className="nb-fire">🔥</span>
              <span>{mock.tradersText} traders in</span>
            </div>
            <div className="nb-social-stat">
              <span>Closes <Countdown date={prediction.resolvesAt} marketId={prediction.id} /></span>
            </div>
          </div>

          {/* ═══ ZONE 5: STAKE SELECTOR ═══ */}
          <div className="nb-stake-zone">
            {[1, 5, 25].map(amt => (
              <button
                key={amt}
                className={`nb-stake-chip ${mock.selectedStake === amt ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  // In a real impl, this would set stake amount
                }}
              >
                ${amt}
              </button>
            ))}
          </div>

          {/* Swipe Direction Stamps */}
          <animated.div className="nb-stamp nb-stamp-yes" style={{ opacity: yesOp }}>
            <span className="nb-stamp-icon">✓</span>
            <span>YES</span>
          </animated.div>
          <animated.div className="nb-stamp nb-stamp-no" style={{ opacity: noOp }}>
            <span className="nb-stamp-icon">✕</span>
            <span>NO</span>
          </animated.div>

          {/* Edge Glow Effects */}
          <animated.div className="nb-edge-glow nb-glow-yes" style={{ opacity: yesOp }} />
          <animated.div className="nb-edge-glow nb-glow-no" style={{ opacity: noOp }} />
        </animated.div>

        {/* Swipe Labels Below Card */}
        <div className="nb-swipe-labels">
          <span className="nb-swipe-label nb-label-no">← NO</span>
          <span className="nb-swipe-label nb-label-yes">YES →</span>
        </div>

        {/* Connect Wallet Overlay (for non-authenticated) */}
        {!isAuthenticated && (
          <button
            className="nb-connect-overlay"
            onClick={(e) => {
              e.stopPropagation();
              if (onConnectWallet) onConnectWallet();
            }}
          >
            <span>Connect Wallet to Predict</span>
          </button>
        )}
      </animated.div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

        /* ═══════════════════════════════════════════════════════════════════════
           NIKITA BIER 5-ZONE CARD - Hook-First Dopamine Design
           "The card IS the hook. It does the work in the first frame."
           ═══════════════════════════════════════════════════════════════════════ */

        .nb-wrapper,
        .swipe-card-stack {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          margin: 0 auto;
          width: calc(100% - 20px);
          max-width: 360px;
          touch-action: none;
          z-index: 30;
          display: flex;
          flex-direction: column;
          height: calc(100% - 60px);
        }

        .swipe-card-stack {
          z-index: 20;
          pointer-events: none;
        }

        /* ═══ THE CARD ═══ */
        .nb-card {
          --yes: #00FFB2;
          --no: #FF4757;
          --amber: #FFB300;
          --accent: #00D9FF;

          flex: 1;
          min-height: 0;
          background: linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%);
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
          font-family: 'DM Sans', system-ui, sans-serif;
        }

        /* Hot card flame border animation */
        .nb-wrapper.nb-hot .nb-card {
          border: 2px solid transparent;
          background-clip: padding-box;
          animation: flameBorder 1.5s ease-in-out infinite;
        }

        @keyframes flameBorder {
          0%, 100% { box-shadow: 0 0 20px rgba(255, 100, 0, 0.4), 0 0 40px rgba(255, 50, 0, 0.2); }
          50% { box-shadow: 0 0 30px rgba(255, 150, 0, 0.6), 0 0 60px rgba(255, 100, 0, 0.3); }
        }

        /* ═══ ZONE 1: THE HOOK (30% top) ═══ */
        .nb-hook {
          position: relative;
          height: 30%;
          min-height: 120px;
          margin: 12px 12px 0 12px;
          border-radius: 12px;
          background-size: cover;
          background-position: center;
          background-color: #1f2937;
          border: 1px solid rgba(255, 255, 255, 0.1);
          overflow: hidden;
          box-shadow:
            0 4px 12px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .nb-hook-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg,
            rgba(0, 0, 0, 0.2) 0%,
            rgba(0, 0, 0, 0.3) 40%,
            rgba(15, 15, 26, 0.95) 100%
          );
          border-radius: 12px;
        }

        .nb-hook-top {
          position: absolute;
          top: 10px;
          left: 10px;
          right: 10px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          z-index: 2;
        }

        /* LIVE indicator */
        .nb-live {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: rgba(255, 59, 48, 0.2);
          border: 1px solid rgba(255, 59, 48, 0.5);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #FF3B30;
          letter-spacing: 0.5px;
        }

        .nb-live-dot {
          width: 8px;
          height: 8px;
          background: #FF3B30;
          border-radius: 50%;
          animation: livePulse 1.5s ease-in-out infinite;
        }

        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }

        /* Category chip */
        .nb-category {
          padding: 6px 12px;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(10px);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #fff;
          letter-spacing: 1px;
        }

        /* Hot badge */
        .nb-hot-badge {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: linear-gradient(135deg, rgba(255, 100, 0, 0.3), rgba(255, 50, 0, 0.2));
          border: 1px solid rgba(255, 100, 0, 0.5);
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          color: #FF6600;
          z-index: 3;
          animation: hotPulse 2s ease-in-out infinite;
        }

        .nb-flame {
          font-size: 14px;
        }

        @keyframes hotPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.05); }
        }

        /* ═══ ZONE 2: THE QUESTION ═══ */
        .nb-question-zone {
          padding: 14px 16px 12px;
          margin-top: -4px;
        }

        .nb-question {
          font-size: 20px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 8px;
          line-height: 1.25;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .nb-context {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0;
        }

        .nb-context .up {
          color: var(--yes);
          font-weight: 600;
        }

        .nb-context .down {
          color: var(--no);
          font-weight: 600;
        }

        /* ═══ ZONE 3: THE NUMBER (Probability Gauge) ═══ */
        .nb-number-zone {
          padding: 0 16px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .nb-gauge {
          width: 100%;
          height: 12px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          position: relative;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .nb-gauge-fill {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          border-radius: 6px;
          transition: width 0.5s ease;
        }

        .nb-gauge-fill.hot-yes {
          background: linear-gradient(90deg, var(--yes), #00FF88);
          box-shadow: 0 0 20px rgba(0, 255, 178, 0.5);
        }

        .nb-gauge-fill.hot-no {
          background: linear-gradient(90deg, var(--no), #FF7777);
          box-shadow: 0 0 20px rgba(255, 71, 87, 0.5);
        }

        .nb-gauge-fill.contested {
          background: linear-gradient(90deg, var(--amber), #FFD700);
          box-shadow: 0 0 20px rgba(255, 179, 0, 0.5);
        }

        .nb-odds-row {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin-bottom: 4px;
        }

        .nb-odds-value {
          font-size: 48px;
          font-weight: 800;
          font-family: 'JetBrains Mono', monospace;
          line-height: 1;
        }

        .nb-odds-value.hot-yes { color: var(--yes); text-shadow: 0 0 30px rgba(0, 255, 178, 0.5); }
        .nb-odds-value.hot-no { color: var(--no); text-shadow: 0 0 30px rgba(255, 71, 87, 0.5); }
        .nb-odds-value.contested { color: var(--amber); text-shadow: 0 0 30px rgba(255, 179, 0, 0.5); }

        .nb-odds-label {
          font-size: 18px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.6);
        }

        .nb-payout {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
        }

        .nb-payout-mult {
          color: var(--accent);
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
        }

        /* ═══ ZONE 4: SOCIAL PROOF BAR ═══ */
        .nb-social-zone {
          display: flex;
          justify-content: space-between;
          padding: 12px 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.2);
        }

        .nb-social-stat {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
        }

        .nb-fire {
          font-size: 14px;
        }

        /* ═══ ZONE 5: STAKE SELECTOR ═══ */
        .nb-stake-zone {
          display: flex;
          justify-content: center;
          gap: 12px;
          padding: 12px 16px 16px;
        }

        .nb-stake-chip {
          padding: 10px 20px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'JetBrains Mono', monospace;
        }

        .nb-stake-chip:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.3);
          color: #fff;
        }

        .nb-stake-chip.active {
          background: rgba(0, 217, 255, 0.15);
          border-color: var(--accent);
          color: var(--accent);
        }

        /* ═══ SWIPE STAMPS ═══ */
        .nb-stamp {
          position: absolute;
          top: 50%;
          transform: translateY(-50%) rotate(-15deg);
          padding: 12px 24px;
          border-radius: 12px;
          border: 4px solid;
          font-size: 32px;
          font-weight: 800;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          pointer-events: none;
        }

        .nb-stamp-icon {
          font-size: 36px;
        }

        .nb-stamp-yes {
          right: 20px;
          color: var(--yes);
          border-color: var(--yes);
          background: rgba(0, 255, 178, 0.15);
          transform: translateY(-50%) rotate(15deg);
        }

        .nb-stamp-no {
          left: 20px;
          color: var(--no);
          border-color: var(--no);
          background: rgba(255, 71, 87, 0.15);
        }

        /* ═══ EDGE GLOW EFFECTS ═══ */
        .nb-edge-glow {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 60px;
          pointer-events: none;
        }

        .nb-glow-yes {
          right: 0;
          background: linear-gradient(270deg, rgba(0, 255, 178, 0.3) 0%, transparent 100%);
        }

        .nb-glow-no {
          left: 0;
          background: linear-gradient(90deg, rgba(255, 71, 87, 0.3) 0%, transparent 100%);
        }

        /* ═══ SWIPE LABELS ═══ */
        .nb-swipe-labels {
          display: flex;
          justify-content: space-between;
          padding: 12px 8px;
        }

        .nb-swipe-label {
          font-size: 14px;
          font-weight: 600;
          opacity: 0.5;
        }

        .nb-label-no { color: var(--no); }
        .nb-label-yes { color: var(--yes); }

        /* ═══ CONNECT OVERLAY ═══ */
        .nb-connect-overlay {
          position: absolute;
          bottom: 80px;
          left: 50%;
          transform: translateX(-50%);
          padding: 14px 28px;
          background: linear-gradient(135deg, var(--accent), #0099CC);
          border: none;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 700;
          color: #000;
          cursor: pointer;
          z-index: 10;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .nb-connect-overlay:hover {
          transform: translateX(-50%) scale(1.05);
          box-shadow: 0 8px 30px rgba(0, 217, 255, 0.4);
        }

        /* ═══ STACKED CARD ═══ */
        .swipe-card-inner {
          flex: 1;
          background: linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%);
          border-radius: 20px;
        }

        /* ═══ RESPONSIVE ═══ */
        @media (max-width: 380px) {
          .nb-card { border-radius: 16px; }
          .nb-question { font-size: 18px; }
          .nb-odds-value { font-size: 40px; }
          .nb-stake-chip { padding: 8px 16px; font-size: 13px; }
        }

        @media (max-height: 700px) {
          .nb-hook { min-height: 100px; }
          .nb-question-zone { padding: 12px 16px 8px; }
          .nb-question { font-size: 18px; }
          .nb-number-zone { padding: 0 16px 12px; }
          .nb-odds-value { font-size: 40px; }
        }

        @media (max-height: 600px) {
          .nb-wrapper { height: calc(100% - 50px); }
          .nb-hook { min-height: 80px; }
          .nb-question { -webkit-line-clamp: 1; font-size: 16px; }
          .nb-context { display: none; }
          .nb-odds-value { font-size: 36px; }
          .nb-stake-zone { padding: 8px 16px 12px; }
        }
      `}</style>
    </>
  );
}
