'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import { animated, useSpring, to } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Prediction } from '@/lib/types';
// Chart data is generated locally - no external API needed

// ═══════════════════════════════════════════════════════════════════════════════
// SWIPE CARD V2 - Variant Design System
// Premium glass morphism with dual-line YES/NO charts
// ═══════════════════════════════════════════════════════════════════════════════

interface SwipeCardV2Props {
  prediction: Prediction;
  onSwipe: (direction: 'left' | 'right', prediction: Prediction) => void;
  onVote: (prediction: Prediction, choice: 'YES' | 'NO') => void;
  isTop: boolean;
  stackIndex: number;
}

// Category colors and styles
const CATEGORY_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  crypto: { color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.1)', border: 'rgba(251, 191, 36, 0.2)' },
  politics: { color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.1)', border: 'rgba(167, 139, 250, 0.2)' },
  tech: { color: '#00FFB2', bg: 'rgba(0, 255, 178, 0.1)', border: 'rgba(0, 255, 178, 0.2)' },
  economics: { color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.2)' },
  sports: { color: '#FB923C', bg: 'rgba(251, 146, 60, 0.1)', border: 'rgba(251, 146, 60, 0.2)' },
};

// Format volume string
function formatVolume(vol: string | number): string {
  const n = typeof vol === 'number' ? vol : parseFloat(vol.replace(/[^0-9.]/g, ''));
  if (isNaN(n)) return vol.toString();
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// Calculate time remaining
function getTimeRemaining(dateStr: string): string {
  if (!dateStr || dateStr === 'TBD') return 'TBD';
  const end = new Date(dateStr).getTime();
  const now = Date.now();
  const diff = end - now;
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 30) return `${Math.floor(days / 30)}mo`;
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUAL LINE CHART - YES (green) and NO (red) price lines
// ═══════════════════════════════════════════════════════════════════════════════

function DualLineChart({
  yesPrice,
  noPrice,
  seed
}: {
  yesPrice: number;
  noPrice: number;
  seed: number;
}) {
  // Generate chart data locally
  const { yesPoints, noPoints, yesArea, noArea } = useMemo(() => {
    const dataPoints = 24;
    const width = 100;
    const height = 80;
    const padding = 4;

    const yesData: number[] = [];
    const noData: number[] = [];

    // Generate simulated data based on current prices
    let yVal = yesPrice - 10 + (seed % 5);
    let nVal = noPrice - 10 + ((seed * 7) % 5);

    for (let i = 0; i < dataPoints; i++) {
      const h = (seed + i * 13) % 100;
      yVal += ((h % 20) - 9) / 2;
      nVal += (((h * 3) % 20) - 9) / 2;
      yVal = Math.max(5, Math.min(95, yVal));
      nVal = Math.max(5, Math.min(95, nVal));
      yesData.push(yVal);
      noData.push(nVal);
    }
    // End at current prices
    yesData[dataPoints - 1] = yesPrice;
    noData[dataPoints - 1] = noPrice;

    // Normalize to chart dimensions
    const allValues = [...yesData, ...noData];
    const minVal = Math.min(...allValues) - 5;
    const maxVal = Math.max(...allValues) + 5;
    const range = maxVal - minVal || 1;

    const toPoint = (val: number, idx: number) => {
      const x = padding + (idx / (dataPoints - 1)) * (width - padding * 2);
      const y = padding + ((maxVal - val) / range) * (height - padding * 2);
      return `${x},${y}`;
    };

    const yesPointsArr = yesData.map((v, i) => toPoint(v, i));
    const noPointsArr = noData.map((v, i) => toPoint(v, i));

    // Create area paths (for gradient fill under lines)
    const yesAreaPath = `M${padding},${height} ${yesPointsArr.map((p, i) => (i === 0 ? `L${p}` : `L${p}`)).join(' ')} L${width - padding},${height} Z`;
    const noAreaPath = `M${padding},${height} ${noPointsArr.map((p, i) => (i === 0 ? `L${p}` : `L${p}`)).join(' ')} L${width - padding},${height} Z`;

    return {
      yesPoints: yesPointsArr.join(' '),
      noPoints: noPointsArr.join(' '),
      yesArea: yesAreaPath,
      noArea: noAreaPath,
    };
  }, [yesPrice, noPrice, seed]);

  const lastYesPoint = yesPoints.split(' ').pop()?.split(',');
  const lastNoPoint = noPoints.split(' ').pop()?.split(',');

  return (
    <div className="dual-chart-container">
      <svg viewBox="0 0 100 80" preserveAspectRatio="none" className="dual-chart-svg">
        <defs>
          <linearGradient id="yesGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="noGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#F43F5E" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#F43F5E" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area fills */}
        <path d={yesArea} fill="url(#yesGradient)" className="chart-area-yes" />
        <path d={noArea} fill="url(#noGradient)" className="chart-area-no" />

        {/* Lines */}
        <polyline
          points={noPoints}
          fill="none"
          stroke="#F43F5E"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="chart-line-no"
        />
        <polyline
          points={yesPoints}
          fill="none"
          stroke="#10B981"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="chart-line-yes"
        />

        {/* End dots */}
        {lastNoPoint && (
          <circle
            cx={lastNoPoint[0]}
            cy={lastNoPoint[1]}
            r="3"
            fill="#F43F5E"
            className="chart-dot-no"
          />
        )}
        {lastYesPoint && (
          <circle
            cx={lastYesPoint[0]}
            cy={lastYesPoint[1]}
            r="4"
            fill="#10B981"
            className="chart-dot-yes"
          />
        )}
      </svg>

      {/* Legend */}
      <div className="chart-legend">
        <span className="legend-item yes">
          <span className="legend-dot" />
          YES
        </span>
        <span className="legend-item no">
          <span className="legend-dot" />
          NO
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SWIPE CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function SwipeCardV2({
  prediction,
  onSwipe,
  onVote,
  isTop,
  stackIndex,
}: SwipeCardV2Props) {
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  // Card position spring
  const [{ x, y, rotate, scale }, api] = useSpring(() => ({
    x: 0,
    y: 0,
    rotate: 0,
    scale: 1,
    config: { tension: 300, friction: 20 },
  }));

  // Stack positioning
  const stackSpring = useSpring({
    y: stackIndex * 16,
    scale: 1 - stackIndex * 0.04,
    opacity: stackIndex === 0 ? 1 : stackIndex === 1 ? 0.6 : 0.3,
    config: { tension: 280, friction: 24 },
  });

  // Swipe threshold
  const SWIPE_THRESHOLD = 100;

  // Handle drag gesture
  const bind = useDrag(
    ({ active, movement: [mx], direction: [xDir], velocity: [vx], cancel }) => {
      if (!isTop || isAnimatingOut) return;

      if (active) {
        api.start({
          x: mx,
          rotate: mx / 20,
          scale: 1.02,
        });
      } else {
        // Check if swipe threshold met
        const shouldSwipe = Math.abs(mx) > SWIPE_THRESHOLD || vx > 0.5;

        if (shouldSwipe) {
          const dir = mx > 0 ? 'right' : 'left';
          triggerSwipe(dir);
        } else {
          // Snap back
          api.start({ x: 0, rotate: 0, scale: 1 });
        }
      }
    },
    { filterTaps: true, rubberband: true }
  );

  // Trigger swipe animation
  const triggerSwipe = useCallback((direction: 'left' | 'right') => {
    setIsAnimatingOut(true);
    setSwipeDirection(direction);

    const flyOutX = direction === 'right' ? 500 : -500;
    const flyRotate = direction === 'right' ? 30 : -30;

    api.start({
      x: flyOutX,
      rotate: flyRotate,
      scale: 0.9,
      config: { tension: 200, friction: 25 },
    });

    setTimeout(() => {
      onSwipe(direction, prediction);
      onVote(prediction, direction === 'right' ? 'YES' : 'NO');
    }, 300);
  }, [api, onSwipe, onVote, prediction]);

  // Handle button clicks
  const handleVote = useCallback((choice: 'YES' | 'NO') => {
    if (isAnimatingOut) return;
    triggerSwipe(choice === 'YES' ? 'right' : 'left');
  }, [isAnimatingOut, triggerSwipe]);

  // Get category style
  const catStyle = CATEGORY_STYLES[prediction.category] || CATEGORY_STYLES.tech;

  // Calculate prices
  const yesPrice = prediction.marketOdds;
  const noPrice = 100 - prediction.marketOdds;
  const yesCents = Math.round(yesPrice);
  const noCents = Math.round(noPrice);

  // Generate seed for chart
  const seed = prediction.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);

  return (
    <animated.div
      {...(isTop ? bind() : {})}
      className={`swipe-card-v2 ${isTop ? 'is-top' : ''}`}
      data-index={stackIndex}
      style={{
        x: isTop ? x : 0,
        y: isTop ? y : stackSpring.y,
        rotate: isTop ? rotate : 0,
        scale: isTop ? scale : stackSpring.scale,
        opacity: stackSpring.opacity,
        zIndex: 10 - stackIndex,
        touchAction: 'none',
      }}
    >
      {/* Decorative glows */}
      <div className="deco-circle dc-cyan" />
      <div className="deco-circle dc-purple" />

      {/* Card Header */}
      <div className="card-header-v2">
        <div
          className="category-pill-v2"
          style={{
            color: catStyle.color,
            background: catStyle.bg,
            borderColor: catStyle.border,
          }}
        >
          {prediction.category.toUpperCase()}
        </div>
        <button className="icon-btn-v2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </button>
      </div>

      {/* Market Question */}
      <h2 className="market-question-v2">{prediction.question}</h2>

      {/* Dual Line Chart */}
      <DualLineChart
        yesPrice={yesPrice}
        noPrice={noPrice}
        seed={seed}
      />

      {/* Stats Grid */}
      <div className="stats-grid-v2">
        <div className="stat-box-v2">
          <div className="stat-label-v2">Yes Price</div>
          <div className="stat-value-v2 val-yes">
            {yesCents}¢
            <span className="stat-change up">↑ {Math.floor(Math.random() * 8) + 1}%</span>
          </div>
        </div>
        <div className="stat-box-v2">
          <div className="stat-label-v2">No Price</div>
          <div className="stat-value-v2 val-no">
            {noCents}¢
            <span className="stat-change down">↓ {Math.floor(Math.random() * 5) + 1}%</span>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="card-footer-v2">
        <div className="meta-item-v2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <span>{formatVolume(prediction.volume)} Vol</span>
        </div>
        <div className="meta-item-v2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>Ends {getTimeRemaining(prediction.resolvesAt)}</span>
        </div>
      </div>

      {/* Vote Controls (only on top card) */}
      {isTop && (
        <div className="controls-v2">
          <button
            className="control-btn-v2 btn-no-v2"
            onClick={() => handleVote('NO')}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <button
            className="control-btn-v2 btn-yes-v2"
            onClick={() => handleVote('YES')}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        </div>
      )}

      <style jsx>{`
        .swipe-card-v2 {
          position: absolute;
          width: 100%;
          max-width: 360px;
          height: 520px;
          background: rgba(18, 22, 36, 0.75);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-radius: 32px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow:
            0 24px 48px -12px rgba(0, 0, 0, 0.6),
            inset 0 1px 1px rgba(255, 255, 255, 0.1);
          display: flex;
          flex-direction: column;
          padding: 24px;
          overflow: hidden;
          cursor: grab;
          user-select: none;
        }

        .swipe-card-v2.is-top {
          cursor: grab;
        }

        .swipe-card-v2.is-top:active {
          cursor: grabbing;
        }

        /* Decorative glows */
        .deco-circle {
          position: absolute;
          border-radius: 50%;
          filter: blur(40px);
          z-index: 0;
          opacity: 0.4;
          pointer-events: none;
        }

        .dc-cyan {
          top: -20px;
          right: -20px;
          width: 100px;
          height: 100px;
          background: #00FFB2;
        }

        .dc-purple {
          bottom: -30px;
          left: -30px;
          width: 120px;
          height: 120px;
          background: #4f46e5;
        }

        /* Header */
        .card-header-v2 {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
          position: relative;
          z-index: 2;
        }

        .category-pill-v2 {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 6px 10px;
          border-radius: 8px;
          border: 1px solid;
          box-shadow: 0 0 10px rgba(0, 255, 178, 0.1);
        }

        .icon-btn-v2 {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: transparent;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94A3B8;
          cursor: pointer;
        }

        /* Question */
        .market-question-v2 {
          font-size: 22px;
          line-height: 1.3;
          font-weight: 700;
          margin-bottom: 16px;
          color: #FFFFFF;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
          position: relative;
          z-index: 2;
          min-height: 86px;
        }

        /* Chart */
        .dual-chart-container {
          flex: 1;
          position: relative;
          width: 100%;
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }

        .dual-chart-svg {
          width: 100%;
          height: 80px;
        }

        .chart-line-yes {
          filter: drop-shadow(0 0 6px rgba(16, 185, 129, 0.6));
        }

        .chart-line-no {
          filter: drop-shadow(0 0 4px rgba(244, 63, 94, 0.4));
        }

        .chart-dot-yes {
          filter: drop-shadow(0 0 8px #10B981);
          animation: pulse-dot 2s ease-in-out infinite;
        }

        .chart-dot-no {
          filter: drop-shadow(0 0 6px #F43F5E);
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        .chart-legend {
          display: flex;
          gap: 16px;
          justify-content: center;
          margin-top: 8px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .legend-item.yes {
          color: #10B981;
        }

        .legend-item.no {
          color: #F43F5E;
        }

        .legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
        }

        /* Stats Grid */
        .stats-grid-v2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
          background: rgba(0, 0, 0, 0.2);
          padding: 16px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.03);
        }

        .stat-box-v2 {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-label-v2 {
          font-size: 11px;
          color: #64748B;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-value-v2 {
          font-size: 20px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .stat-value-v2.val-yes {
          color: #10B981;
          text-shadow: 0 0 10px rgba(16, 185, 129, 0.2);
        }

        .stat-value-v2.val-no {
          color: #F43F5E;
          text-shadow: 0 0 10px rgba(244, 63, 94, 0.2);
        }

        .stat-change {
          font-size: 11px;
          font-weight: 500;
        }

        .stat-change.up {
          color: #10B981;
        }

        .stat-change.down {
          color: #F43F5E;
        }

        /* Footer */
        .card-footer-v2 {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 16px;
        }

        .meta-item-v2 {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #94A3B8;
        }

        .meta-item-v2 svg {
          opacity: 0.7;
        }

        /* Controls */
        .controls-v2 {
          position: absolute;
          bottom: -100px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 48px;
          z-index: 20;
        }

        .control-btn-v2 {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          position: relative;
          transition: transform 0.15s ease, box-shadow 0.2s;
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .control-btn-v2:active {
          transform: scale(0.92);
        }

        .btn-no-v2 {
          border: 1px solid rgba(244, 63, 94, 0.3);
          color: #F43F5E;
        }

        .btn-no-v2::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: radial-gradient(circle at center, rgba(244, 63, 94, 0.15), transparent 70%);
          opacity: 0.5;
        }

        .btn-yes-v2 {
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #10B981;
        }

        .btn-yes-v2::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: radial-gradient(circle at center, rgba(16, 185, 129, 0.15), transparent 70%);
          opacity: 0.5;
        }

        .control-btn-v2 svg {
          z-index: 2;
          filter: drop-shadow(0 0 4px currentColor);
        }

        /* Responsive */
        @media (max-width: 380px) {
          .swipe-card-v2 {
            height: 480px;
            padding: 20px;
          }

          .market-question-v2 {
            font-size: 20px;
            min-height: 78px;
          }

          .control-btn-v2 {
            width: 64px;
            height: 64px;
          }

          .controls-v2 {
            gap: 36px;
          }
        }

        @media (max-height: 700px) {
          .swipe-card-v2 {
            height: 440px;
          }

          .dual-chart-svg {
            height: 60px;
          }
        }
      `}</style>
    </animated.div>
  );
}
