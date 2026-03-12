'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { animated, useSpring, to } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Prediction } from '@/lib/types';
import { useUser } from '@/context/UserContext';
import { getDFlowCandlesticks, DFlowCandleData } from '@/lib/api';

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
        const resolution = timeRange === '1D' ? '1h' : timeRange === '1W' ? '4h' : '1d';
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
}: {
  prediction: Prediction;
  isVisible: boolean;
  direction: 'left' | 'right' | null;
  onConfirm: (traded: boolean) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(5);
  const [isTrading, setIsTrading] = useState(false);

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
  const canTrade = prediction.dflow?.tokens?.isInitialized;

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
    // TODO: Integrate actual DFlow trading here
    // For now, simulate a short delay
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsTrading(false);
    onConfirm(true);
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
            {isTrading ? 'Trading...' : canTrade ? `Confirm ${side}` : 'Trading Unavailable'}
          </button>
        </div>

        {/* DFlow Link */}
        {!canTrade && (
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
          background: rgba(0, 194, 255, 0.15);
          border-color: rgba(0, 194, 255, 0.4);
          color: #00C2FF;
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
          color: #00C2FF;
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
          color: #00C2FF;
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

export default function SwipeCard({ prediction, onSwipe, onSkip, onConnectWallet, onTradeComplete, isTop, stackIndex }: SwipeCardProps) {
  const { isAuthenticated } = useUser();
  const [pressed, setPressed] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showTooltips, setShowTooltips] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Trading sheet state - shows when user swipes
  const [showTradingSheet, setShowTradingSheet] = useState(false);
  const [pendingDirection, setPendingDirection] = useState<'left' | 'right' | null>(null);

  const mock = useMemo(() => {
    const h = prediction.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return {
      trading: 50 + (h % 250),
      delta: ((h % 20) - 10) * 0.3,
      liq: 50000 + (h % 400000),
      traders: 100 + (h % 1500),
      seed: h,
    };
  }, [prediction.id]);

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
      />

      <animated.div
        {...(bindHandlers as React.HTMLAttributes<HTMLDivElement>)}
        className="swipe-card-wrapper"
        style={{ x, y, rotate, scale, cursor: pressed ? 'grabbing' : 'grab' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <animated.div
          className={`swipe-card-inner ${hasImage ? 'has-media' : ''}`}
          style={{
            boxShadow: to([x, glow], (xv, g) => {
              if (xv > 15) return `0 16px 48px rgba(0,230,118,${0.12 + g * 0.15}), 0 0 0 2px rgba(0,230,118,${0.25 + g * 0.3})`;
              if (xv < -15) return `0 16px 48px rgba(255,82,82,${0.12 + g * 0.15}), 0 0 0 2px rgba(255,82,82,${0.25 + g * 0.3})`;
              return '0 16px 48px rgba(0,0,0,0.5)';
            }),
          }}
        >
          {/* YES/NO Stamps */}
          <animated.div className="swipe-stamp swipe-stamp-yes" style={{ opacity: yesOp }}>YES</animated.div>
          <animated.div className="swipe-stamp swipe-stamp-no" style={{ opacity: noOp }}>NO</animated.div>

          {/* Hero Media Section */}
          {hasImage ? (
            <div className="sc-hero">
              <img
                src={imageUrl}
                alt={prediction.question}
                className="sc-hero-img"
                onError={() => setImgError(true)}
              />
              <div className="sc-hero-overlay" />
              <div className="sc-hero-content">
                <h2 className="sc-hero-question">{prediction.question}</h2>
              </div>
              {/* Info button on hero */}
              <button className="sc-info-btn hero" onClick={handleToggleTooltips}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="sc-text-header">
              <h2 className="sc-text-question">{prediction.question}</h2>
              {/* Info button on text header */}
              <button className="sc-info-btn" onClick={handleToggleTooltips}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
              </button>
            </div>
          )}

          {/* Compact Trading Section with Line Charts */}
          <div className="sc-trading">
            {/* YES Side */}
            <div className="sc-trade-card sc-trade-yes">
              <div className="sc-trade-top">
                <span className="sc-trade-label">YES</span>
                <span className={`sc-trade-delta ${up ? 'up' : 'down'}`}>
                  {up ? '↑' : '↓'}{Math.abs(mock.delta).toFixed(1)}%
                </span>
              </div>
              <div className="sc-trade-main">
                <div className="sc-trade-price-block">
                  <div className="sc-trade-price">{Math.round(yesPrice * 100)}¢</div>
                  <div className="sc-trade-pct">{prediction.marketOdds}% likely</div>
                </div>
                <div className="sc-trade-chart">
                  <MiniLineChart isYes={true} seed={mock.seed} price={yesPrice} />
                </div>
              </div>
            </div>

            {/* NO Side */}
            <div className="sc-trade-card sc-trade-no">
              <div className="sc-trade-top">
                <span className="sc-trade-label">NO</span>
                <span className={`sc-trade-delta ${!up ? 'up' : 'down'}`}>
                  {!up ? '↑' : '↓'}{Math.abs(mock.delta).toFixed(1)}%
                </span>
              </div>
              <div className="sc-trade-main">
                <div className="sc-trade-price-block">
                  <div className="sc-trade-price">{Math.round(noPrice * 100)}¢</div>
                  <div className="sc-trade-pct">{100 - prediction.marketOdds}% likely</div>
                </div>
                <div className="sc-trade-chart">
                  <MiniLineChart isYes={false} seed={mock.seed + 50} price={noPrice} />
                </div>
              </div>
            </div>
          </div>

          {/* Price explanation tooltip */}
          <div className="sc-price-explain">
            <span className="sc-price-explain-icon">💡</span>
            <span className="sc-price-explain-text">
              {Math.round(yesPrice * 100)}¢ = {prediction.marketOdds}% probability • Win $1 if correct
            </span>
          </div>

          {/* Compact Stats Row */}
          <div className="sc-stats-row">
            <div className="sc-stat">
              <span className="sc-stat-val">{formatVol(prediction.volume)}</span>
              <span className="sc-stat-lbl">VOL</span>
            </div>
            <div className="sc-stat-divider" />
            <div className="sc-stat">
              <span className="sc-stat-val">{mock.traders}</span>
              <span className="sc-stat-lbl">TRADERS</span>
            </div>
            <div className="sc-stat-divider" />
            <div className="sc-stat">
              <span className="sc-stat-val"><Countdown date={prediction.resolvesAt} marketId={prediction.id} /></span>
              <span className="sc-stat-lbl">CLOSES</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="sc-actions">
            {isAuthenticated ? (
              <>
                <button className="sc-btn sc-btn-no" onClick={() => vote('left')}>
                  <span className="sc-btn-icon">✕</span>
                  <div className="sc-btn-content">
                    <span className="sc-btn-label">NO</span>
                    <span className="sc-btn-price">{Math.round(noPrice * 100)}¢</span>
                  </div>
                </button>
                <button className="sc-skip-btn" onClick={skip} title="Skip this market">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  <span>Skip</span>
                </button>
                <button className="sc-btn sc-btn-yes" onClick={() => vote('right')}>
                  <span className="sc-btn-icon">✓</span>
                  <div className="sc-btn-content">
                    <span className="sc-btn-label">YES</span>
                    <span className="sc-btn-price">{Math.round(yesPrice * 100)}¢</span>
                  </div>
                </button>
              </>
            ) : (
              <button
                className="sc-connect-cta"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onConnectWallet) onConnectWallet();
                }}
                type="button"
              >
                <div className="sc-connect-cta-inner">
                  <div className="sc-connect-cta-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="6" width="20" height="12" rx="2" />
                      <path d="M22 10H18C16.9 10 16 10.9 16 12C16 13.1 16.9 14 18 14H22" />
                      <circle cx="18" cy="12" r="1" fill="currentColor" />
                    </svg>
                  </div>
                  <div className="sc-connect-cta-text">
                    <span className="sc-connect-cta-title">Connect Wallet to Predict</span>
                    <span className="sc-connect-cta-subtitle">Swipe right for YES, left for NO</span>
                  </div>
                </div>
                <div className="sc-connect-cta-arrow">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            )}
          </div>
        </animated.div>
      </animated.div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

        .swipe-card-wrapper,
        .swipe-card-stack {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          right: 0;
          margin: 0 auto;
          width: calc(100% - 16px);
          max-width: 340px !important;
          touch-action: none;
          z-index: 30;
        }

        .swipe-card-stack {
          z-index: 20;
          pointer-events: none;
        }

        .swipe-card-inner {
          --yes: #10B981;
          --no: #F43F5E;
          --glass: rgba(18, 18, 24, 0.85);
          --glass-border: rgba(255, 255, 255, 0.08);

          width: 100%;
          height: 100%;
          background: linear-gradient(165deg, #13131a 0%, #0a0a0f 100%);
          border-radius: 20px;
          border: 1px solid var(--glass-border);
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
          font-family: 'DM Sans', system-ui, sans-serif;
        }

        /* Stamps */
        .swipe-stamp {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          padding: 8px 16px;
          border: 3px solid currentColor;
          border-radius: 8px;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: 3px;
          pointer-events: none;
          z-index: 50;
          font-family: 'JetBrains Mono', monospace;
        }
        .swipe-stamp-yes { right: 16px; color: var(--yes); text-shadow: 0 0 20px var(--yes); }
        .swipe-stamp-no { left: 16px; color: var(--no); text-shadow: 0 0 20px var(--no); }

        /* Info Button */
        .sc-info-btn {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          z-index: 10;
        }

        .sc-info-btn.hero {
          background: rgba(0, 0, 0, 0.6);
        }

        .sc-info-btn svg {
          width: 18px;
          height: 18px;
          color: rgba(255, 255, 255, 0.7);
        }

        .sc-info-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.25);
        }

        .sc-info-btn:hover svg {
          color: #fff;
        }

        /* Hero Media Section */
        .sc-hero {
          position: relative;
          flex: 1;
          min-height: 160px;
          overflow: hidden;
          border-radius: 19px 19px 0 0;
        }

        .sc-hero-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .sc-hero-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0) 0%,
            rgba(0, 0, 0, 0.2) 40%,
            rgba(10, 10, 15, 0.98) 100%
          );
        }

        .sc-hero-content {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 14px;
        }

        .sc-hero-question {
          font-size: 17px;
          font-weight: 700;
          color: #fff;
          margin: 0;
          line-height: 1.25;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-shadow: 0 2px 12px rgba(0,0,0,0.7);
        }

        /* Text-only Header */
        .sc-text-header {
          flex: 1;
          padding: 16px 14px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          position: relative;
        }

        .sc-text-question {
          font-size: 19px;
          font-weight: 700;
          color: #fff;
          margin: 0;
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
          padding-right: 40px;
        }

        /* Price Explanation */
        .sc-price-explain {
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 6px 10px 0;
          padding: 6px 10px;
          background: rgba(0, 180, 255, 0.08);
          border: 1px solid rgba(0, 180, 255, 0.15);
          border-radius: 8px;
          flex-shrink: 0;
        }

        .sc-price-explain-icon {
          font-size: 11px;
          flex-shrink: 0;
        }

        .sc-price-explain-text {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.3;
        }

        /* Compact Trading Section */
        .sc-trading {
          display: flex;
          gap: 6px;
          padding: 0 10px;
          flex-shrink: 0;
        }

        .sc-trade-card {
          flex: 1;
          background: rgba(0, 0, 0, 0.35);
          border-radius: 10px;
          padding: 8px;
          border: 1px solid transparent;
        }

        .sc-trade-yes { border-color: rgba(0, 230, 118, 0.15); }
        .sc-trade-no { border-color: rgba(255, 82, 82, 0.15); }

        .sc-trade-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .sc-trade-label {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1px;
        }
        .sc-trade-yes .sc-trade-label { color: var(--yes); }
        .sc-trade-no .sc-trade-label { color: var(--no); }

        .sc-trade-delta {
          font-size: 9px;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
        }
        .sc-trade-delta.up { color: var(--yes); }
        .sc-trade-delta.down { color: var(--no); }

        .sc-trade-main {
          display: flex;
          align-items: flex-end;
          gap: 8px;
        }

        .sc-trade-price-block { flex-shrink: 0; }

        .sc-trade-price {
          font-size: 18px;
          font-weight: 800;
          font-family: 'JetBrains Mono', monospace;
          line-height: 1;
        }
        .sc-trade-yes .sc-trade-price { color: var(--yes); }
        .sc-trade-no .sc-trade-price { color: var(--no); }

        .sc-trade-pct {
          font-size: 9px;
          color: rgba(255, 255, 255, 0.4);
          margin-top: 2px;
        }

        .sc-trade-chart {
          flex: 1;
          height: 28px;
          min-width: 0;
        }

        .mini-line-svg {
          width: 100%;
          height: 100%;
        }

        /* Stats Row */
        .sc-stats-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 8px 10px;
          margin: 6px 10px 0;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 10px;
          flex-shrink: 0;
        }

        .sc-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
        }

        .sc-stat-val {
          font-size: 12px;
          font-weight: 700;
          color: #fff;
          font-family: 'JetBrains Mono', monospace;
        }

        .sc-stat-lbl {
          font-size: 8px;
          color: rgba(255, 255, 255, 0.35);
          letter-spacing: 0.5px;
        }

        .sc-stat-divider {
          width: 1px;
          height: 20px;
          background: rgba(255, 255, 255, 0.08);
        }

        /* Action Buttons */
        .sc-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px;
          flex-shrink: 0;
        }

        .sc-btn {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 2px solid;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s ease;
        }

        .sc-btn-yes {
          background: rgba(0, 230, 118, 0.08);
          border-color: rgba(0, 230, 118, 0.35);
          flex-direction: row-reverse;
        }
        .sc-btn-yes:active {
          background: rgba(0, 230, 118, 0.15);
          transform: scale(0.98);
        }

        .sc-btn-no {
          background: rgba(255, 82, 82, 0.08);
          border-color: rgba(255, 82, 82, 0.35);
        }
        .sc-btn-no:active {
          background: rgba(255, 82, 82, 0.15);
          transform: scale(0.98);
        }

        .sc-btn-icon {
          font-size: 14px;
          font-weight: 700;
        }
        .sc-btn-yes .sc-btn-icon { color: var(--yes); }
        .sc-btn-no .sc-btn-icon { color: var(--no); }

        .sc-btn-content {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .sc-btn-yes .sc-btn-content { align-items: flex-end; }
        .sc-btn-no .sc-btn-content { align-items: flex-start; }

        .sc-btn-label {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1px;
        }
        .sc-btn-yes .sc-btn-label { color: var(--yes); }
        .sc-btn-no .sc-btn-label { color: var(--no); }

        .sc-btn-price {
          font-size: 14px;
          font-weight: 800;
          font-family: 'JetBrains Mono', monospace;
        }
        .sc-btn-yes .sc-btn-price { color: var(--yes); }
        .sc-btn-no .sc-btn-price { color: var(--no); }

        .sc-skip-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          flex-shrink: 0;
          min-width: 48px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .sc-skip-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .sc-skip-btn:active { transform: scale(0.95); }

        .sc-skip-btn svg {
          width: 16px;
          height: 16px;
          color: rgba(255, 255, 255, 0.4);
        }

        .sc-skip-btn span {
          font-size: 9px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.4);
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .sc-skip-btn:hover svg,
        .sc-skip-btn:hover span {
          color: rgba(255, 255, 255, 0.6);
        }

        /* Responsive */
        @media (max-width: 359px) {
          .sc-hero { min-height: 130px; }
          .sc-hero-question { font-size: 14px; -webkit-line-clamp: 2; }
          .sc-text-question { font-size: 16px; -webkit-line-clamp: 3; }
          .sc-trade-price { font-size: 15px; }
          .sc-trading { padding: 0 8px; gap: 5px; }
          .sc-trade-card { padding: 6px; }
          .sc-trade-chart { height: 24px; }
          .sc-btn { padding: 8px 10px; }
          .sc-btn-price { font-size: 12px; }
          .sc-actions { padding: 8px; gap: 4px; }
          .sc-stats-row { padding: 6px 8px; margin: 0 8px; gap: 8px; }
          .sc-stat-val { font-size: 11px; }
          .sc-price-explain { margin: 4px 8px 0; padding: 5px 8px; }
          .sc-price-explain-text { font-size: 9px; }
        }

        /* Note: swipe-card-wrapper max-width is defined at the top for mobile-first */

        @media (min-width: 440px) {
          .sc-hero { min-height: 200px; }
          .sc-hero-question { font-size: 19px; }
        }

        @media (max-height: 650px) {
          .sc-hero { min-height: 120px; flex: 0 0 auto; }
          .sc-hero-question { -webkit-line-clamp: 2; font-size: 15px; }
          .sc-text-header { flex: 0 1 auto; padding: 12px; }
          .sc-text-question { -webkit-line-clamp: 3; font-size: 16px; }
          .sc-trading { padding: 0 8px; }
          .sc-trade-card { padding: 6px; }
          .sc-trade-chart { height: 22px; }
          .sc-stats-row { padding: 6px 8px; margin: 0 8px; }
          .sc-actions { padding: 8px; }
          .sc-price-explain { display: none; }
        }

        @media (max-height: 550px) {
          .sc-hero { min-height: 100px; }
          .sc-hero-question { -webkit-line-clamp: 1; }
          .sc-text-question { -webkit-line-clamp: 2; }
        }

        /* Connect Wallet CTA Button */
        .sc-connect-cta {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 18px;
          background: linear-gradient(135deg, rgba(0, 230, 118, 0.12) 0%, rgba(0, 176, 255, 0.12) 100%);
          border: 1px solid rgba(0, 230, 118, 0.3);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.25s ease;
          font-family: inherit;
          position: relative;
          overflow: hidden;
        }

        .sc-connect-cta::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(0, 230, 118, 0.08) 0%, rgba(0, 176, 255, 0.08) 100%);
          opacity: 0;
          transition: opacity 0.25s ease;
        }

        .sc-connect-cta:hover::before { opacity: 1; }

        .sc-connect-cta:hover {
          border-color: rgba(0, 230, 118, 0.5);
          box-shadow: 0 4px 24px rgba(0, 230, 118, 0.2);
          transform: translateY(-1px);
        }

        .sc-connect-cta:active {
          transform: translateY(0);
          box-shadow: 0 2px 12px rgba(0, 230, 118, 0.15);
        }

        .sc-connect-cta-inner {
          display: flex;
          align-items: center;
          gap: 14px;
          position: relative;
          z-index: 1;
        }

        .sc-connect-cta-icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(0, 230, 118, 0.2) 0%, rgba(0, 176, 255, 0.2) 100%);
          border-radius: 12px;
          color: #10B981;
          flex-shrink: 0;
        }

        .sc-connect-cta-text {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
        }

        .sc-connect-cta-title {
          font-size: 15px;
          font-weight: 600;
          color: #fff;
          line-height: 1.2;
        }

        .sc-connect-cta-subtitle {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          line-height: 1.2;
        }

        .sc-connect-cta-arrow {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #10B981 0%, #00C2FF 100%);
          border-radius: 10px;
          color: #000;
          flex-shrink: 0;
          position: relative;
          z-index: 1;
          transition: transform 0.25s ease;
        }

        .sc-connect-cta:hover .sc-connect-cta-arrow {
          transform: translateX(3px);
        }

        @media (max-width: 380px) {
          .sc-connect-cta { padding: 12px 14px; }
          .sc-connect-cta-icon { width: 40px; height: 40px; }
          .sc-connect-cta-icon svg { width: 20px; height: 20px; }
          .sc-connect-cta-title { font-size: 14px; }
          .sc-connect-cta-subtitle { font-size: 11px; }
          .sc-connect-cta-arrow { width: 32px; height: 32px; }
          .sc-connect-cta-arrow svg { width: 16px; height: 16px; }
        }

        @media (max-width: 340px) {
          .sc-connect-cta-subtitle { display: none; }
        }
      `}</style>
    </>
  );
}
