'use client';

import { useRef, useCallback, useMemo, useState } from 'react';
import { animated, useSpring, to } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Prediction } from '@/lib/types';

interface SwipeCardProps {
  prediction: Prediction;
  onSwipe: (direction: 'left' | 'right', prediction: Prediction) => void;
  isTop: boolean;
  stackIndex: number;
}

const categoryConfig: Record<string, { icon: string; color: string; label: string }> = {
  crypto: { icon: '₿', color: '#F7931A', label: 'Crypto' },
  politics: { icon: '🏛', color: '#6366F1', label: 'Politics' },
  economics: { icon: '📊', color: '#10B981', label: 'Economics' },
  tech: { icon: '🚀', color: '#8B5CF6', label: 'Tech' },
  sports: { icon: '🏆', color: '#F59E0B', label: 'Sports' },
};

// Mini Sparkline Chart Component
function SparklineChart({
  odds,
  color,
  isYes = true
}: {
  odds: number;
  color: string;
  isYes?: boolean;
}) {
  // Generate realistic-looking chart data based on current odds
  const chartData = useMemo(() => {
    const points: number[] = [];
    const volatility = 0.15;
    const trend = isYes ? odds / 100 : (100 - odds) / 100;

    // Start from a random point and trend toward current value
    let value = trend + (Math.random() - 0.5) * 0.3;

    for (let i = 0; i < 20; i++) {
      // Add some noise but trend toward the final value
      const noise = (Math.random() - 0.5) * volatility;
      const pull = (trend - value) * 0.15;
      value = Math.max(0.05, Math.min(0.95, value + noise + pull));
      points.push(value);
    }

    // Ensure last point is close to actual odds
    points[points.length - 1] = trend;

    return points;
  }, [odds, isYes]);

  // Convert to SVG path
  const pathD = useMemo(() => {
    const width = 100;
    const height = 40;
    const padding = 2;

    const xStep = (width - padding * 2) / (chartData.length - 1);

    const points = chartData.map((val, i) => {
      const x = padding + i * xStep;
      const y = height - padding - val * (height - padding * 2);
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  }, [chartData]);

  // Area fill path
  const areaD = useMemo(() => {
    const width = 100;
    const height = 40;
    const padding = 2;

    const xStep = (width - padding * 2) / (chartData.length - 1);

    const points = chartData.map((val, i) => {
      const x = padding + i * xStep;
      const y = height - padding - val * (height - padding * 2);
      return `${x},${y}`;
    });

    return `M ${padding},${height - padding} L ${points.join(' L ')} L ${100 - padding},${height - padding} Z`;
  }, [chartData]);

  return (
    <svg
      viewBox="0 0 100 40"
      className="sparkline-chart"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`gradient-${isYes ? 'yes' : 'no'}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path
        d={areaD}
        fill={`url(#gradient-${isYes ? 'yes' : 'no'})`}
        className="sparkline-area"
      />

      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="sparkline-line"
      />

      {/* End dot */}
      <circle
        cx={98}
        cy={40 - 2 - chartData[chartData.length - 1] * 36}
        r="3"
        fill={color}
        className="sparkline-dot"
      />
    </svg>
  );
}

export default function SwipeCard({ prediction, onSwipe, isTop, stackIndex }: SwipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isPressed, setIsPressed] = useState(false);

  // Generate stable voter count
  const voterCount = useMemo(() => {
    const hash = prediction.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return 500 + (hash % 2000);
  }, [prediction.id]);

  // Smoother spring physics - buttery feel
  const [{ x, rotate, scale, y }, api] = useSpring(() => ({
    x: 0,
    y: 0,
    rotate: 0,
    scale: 1,
    config: {
      tension: 400,
      friction: 30,
      mass: 1,
    },
  }));

  // Glow intensity based on drag distance
  const glowIntensity = isTop ? x.to((val) => Math.min(1, Math.abs(val) / 150)) : 0;

  // Stamp opacity with smoother curve
  const yesOpacity = isTop ? x.to((val) => {
    const normalized = Math.max(0, val / 80);
    return Math.min(1, normalized * normalized); // Quadratic ease
  }) : 0;

  const noOpacity = isTop ? x.to((val) => {
    const normalized = Math.max(0, -val / 80);
    return Math.min(1, normalized * normalized);
  }) : 0;

  // Card tilt based on drag (3D effect)
  const rotateY = isTop ? x.to((val) => val * 0.05) : 0;
  const rotateX = isTop ? y.to((val) => -val * 0.02) : 0;

  const flyOut = useCallback((dir: number) => {
    // Haptic feedback pattern
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([5, 20, 10, 20, 5]);
    }

    // Satisfying fly-out animation
    api.start({
      x: dir * window.innerWidth * 1.5,
      y: dir * -50, // Slight arc
      rotate: dir * 45,
      scale: 0.8,
      config: {
        tension: 250,
        friction: 28,
        clamp: true,
      },
      onRest: () => onSwipe(dir > 0 ? 'right' : 'left', prediction),
    });
  }, [api, onSwipe, prediction]);

  const bind = useDrag(
    ({ down, movement: [mx, my], velocity: [vx], direction: [dx], first, last }) => {
      if (first) setIsPressed(true);
      if (last) setIsPressed(false);

      const trigger = vx > 0.3 || Math.abs(mx) > 80;
      const dir = dx > 0 ? 1 : -1;

      if (!down && trigger && Math.abs(mx) > 40) {
        flyOut(dir);
      } else {
        api.start({
          x: down ? mx : 0,
          y: down ? my * 0.3 : 0, // Subtle vertical movement
          rotate: down ? mx * 0.08 : 0,
          scale: down ? 1.03 : 1,
          immediate: (key) => down && key !== 'scale',
          config: down
            ? { tension: 800, friction: 35 } // Responsive during drag
            : { tension: 500, friction: 30, clamp: false }, // Bouncy return
        });
      }
    },
    {
      filterTaps: true,
      pointer: { touch: true },
      enabled: isTop,
      rubberband: true,
    }
  );

  const handleVote = useCallback((direction: 'left' | 'right') => {
    if (!isTop) return;

    // Anticipation animation before fly out
    const dir = direction === 'right' ? 1 : -1;

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(15);
    }

    // Quick wind-up then fly out
    api.start({
      x: dir * -20,
      scale: 1.05,
      config: { tension: 600, friction: 20 },
    });

    setTimeout(() => flyOut(dir), 80);
  }, [isTop, api, flyOut]);

  const categoryData = categoryConfig[prediction.category] || categoryConfig.politics;

  // Stack cards behind with parallax
  if (stackIndex > 0) {
    const stackScale = 1 - stackIndex * 0.05;
    const stackY = stackIndex * 12;
    const stackOpacity = 0.6 - stackIndex * 0.2;

    return (
      <div
        className="swipe-card-v2 absolute inset-x-3"
        style={{
          height: 'calc(70vh)',
          minHeight: '420px',
          maxHeight: '600px',
          opacity: stackOpacity,
          transform: `scale(${stackScale}) translateY(${stackY}px)`,
          zIndex: 20 - stackIndex,
          transition: 'transform 0.3s ease, opacity 0.3s ease',
        }}
      />
    );
  }

  return (
    <animated.div
      ref={cardRef}
      {...bind()}
      className={`swipe-card-v2 absolute inset-x-3 ${isPressed ? 'is-pressed' : ''}`}
      style={{
        x,
        y,
        rotate,
        scale,
        rotateY,
        rotateX,
        zIndex: 30,
        touchAction: 'none',
        height: 'calc(70vh)',
        minHeight: '420px',
        maxHeight: '600px',
        transformStyle: 'preserve-3d',
        perspective: '1000px',
      }}
    >
      <animated.div
        className="card-inner"
        style={{
          boxShadow: to(
            [x, glowIntensity],
            (xVal, glow) => {
              if (xVal > 20) {
                return `0 25px 80px rgba(0,230,118,${0.15 + glow * 0.2}),
                        0 0 0 2px rgba(0,230,118,${0.2 + glow * 0.4}),
                        inset 0 0 60px rgba(0,230,118,${glow * 0.1})`;
              } else if (xVal < -20) {
                return `0 25px 80px rgba(255,82,82,${0.15 + glow * 0.2}),
                        0 0 0 2px rgba(255,82,82,${0.2 + glow * 0.4}),
                        inset 0 0 60px rgba(255,82,82,${glow * 0.1})`;
              }
              return '0 25px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)';
            }
          ),
        }}
      >
        {/* YES Stamp */}
        <animated.div
          className="stamp stamp-yes"
          style={{
            opacity: yesOpacity,
            transform: isTop
              ? x.to((val) => {
                  const o = Math.min(1, Math.max(0, val / 80) ** 2);
                  return `scale(${0.8 + o * 0.2}) rotate(-12deg)`;
                })
              : 'scale(0.8) rotate(-12deg)',
          }}
        >
          YES
        </animated.div>

        {/* NO Stamp */}
        <animated.div
          className="stamp stamp-no"
          style={{
            opacity: noOpacity,
            transform: isTop
              ? x.to((val) => {
                  const o = Math.min(1, Math.max(0, -val / 80) ** 2);
                  return `scale(${0.8 + o * 0.2}) rotate(12deg)`;
                })
              : 'scale(0.8) rotate(12deg)',
          }}
        >
          NO
        </animated.div>

        {/* Content */}
        <div className="card-content">
          {/* Header */}
          <div className="card-top">
            <div
              className="category-badge"
              style={{
                background: `${categoryData.color}20`,
                color: categoryData.color,
                borderColor: `${categoryData.color}40`,
              }}
            >
              <span>{categoryData.icon}</span>
              <span>{categoryData.label}</span>
            </div>
            <div className="voters">
              <span className="voters-dot" />
              <span>{voterCount.toLocaleString()} voted</span>
            </div>
          </div>

          {/* Question - THE HERO */}
          <div className="question-section">
            <h2 className="question-text">{prediction.question}</h2>
          </div>

          {/* Chart Section */}
          <div className="chart-section">
            <div className="chart-container">
              <div className="chart-side chart-yes">
                <div className="chart-header">
                  <span className="chart-label">YES</span>
                  <span className="chart-value yes-value">{prediction.marketOdds}%</span>
                </div>
                <SparklineChart odds={prediction.marketOdds} color="#00E676" isYes={true} />
              </div>
              <div className="chart-divider" />
              <div className="chart-side chart-no">
                <div className="chart-header">
                  <span className="chart-value no-value">{100 - prediction.marketOdds}%</span>
                  <span className="chart-label">NO</span>
                </div>
                <SparklineChart odds={prediction.marketOdds} color="#FF5252" isYes={false} />
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="card-meta">
            <span className="meta-item">
              <span className="meta-icon">📅</span>
              {prediction.resolvesAt}
            </span>
            <span className="meta-divider">•</span>
            <span className="meta-item">{prediction.platform}</span>
            <span className="meta-divider">•</span>
            <span className="meta-item">{prediction.volume}</span>
          </div>

          {/* Action Buttons */}
          <div className="action-row">
            <button
              className="action-btn action-no"
              onClick={() => handleVote('left')}
              onMouseDown={() => setIsPressed(true)}
              onMouseUp={() => setIsPressed(false)}
              onMouseLeave={() => setIsPressed(false)}
            >
              <span className="btn-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </span>
              <span className="btn-label">NO</span>
            </button>

            <div className="swipe-hint">
              <div className="swipe-arrows">
                <span className="arrow arrow-left">‹</span>
                <span className="hint-text">swipe</span>
                <span className="arrow arrow-right">›</span>
              </div>
            </div>

            <button
              className="action-btn action-yes"
              onClick={() => handleVote('right')}
              onMouseDown={() => setIsPressed(true)}
              onMouseUp={() => setIsPressed(false)}
              onMouseLeave={() => setIsPressed(false)}
            >
              <span className="btn-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              </span>
              <span className="btn-label">YES</span>
            </button>
          </div>
        </div>
      </animated.div>
    </animated.div>
  );
}
