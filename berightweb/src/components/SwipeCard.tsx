'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import { animated, useSpring, to } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Prediction } from '@/lib/types';
import { useUser } from '@/context/UserContext';

interface SwipeCardProps {
  prediction: Prediction;
  onSwipe: (direction: 'left' | 'right', prediction: Prediction) => void;
  onSkip?: (prediction: Prediction) => void;
  onConnectWallet?: () => void;
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

function Countdown({ date }: { date: string }) {
  const [t, setT] = useState('');
  useEffect(() => {
    const calc = () => {
      if (!date || date === 'TBD' || date === 'Unknown') return setT('TBD');
      const timestamp = new Date(date).getTime();
      if (isNaN(timestamp)) return setT('TBD');
      const diff = timestamp - Date.now();
      if (diff <= 0) return setT('Ended');
      const d = Math.floor(diff / 864e5);
      const h = Math.floor((diff % 864e5) / 36e5);
      setT(d > 30 ? `${Math.floor(d/30)}mo` : d > 0 ? `${d}d ${h}h` : `${h}h`);
    };
    calc();
    const i = setInterval(calc, 6e4);
    return () => clearInterval(i);
  }, [date]);
  return <span>{t}</span>;
}

// Mini Line Chart Component
function MiniLineChart({ isYes, seed, price }: { isYes: boolean; seed: number; price: number }) {
  const { points, trend } = useMemo(() => {
    // Generate 12 data points for smooth line
    const base = price;
    const data: number[] = [];
    let val = base - 0.1;
    for (let i = 0; i < 12; i++) {
      const h = (seed + i * 13) % 100;
      val += ((h % 30) - 14) / 100;
      val = Math.max(0.01, Math.min(0.99, val));
      data.push(val);
    }
    // End near current price
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

  const color = isYes ? '#00E676' : '#FF5252';
  const gradientId = `grad-${isYes ? 'yes' : 'no'}-${seed}`;

  return (
    <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="mini-line-svg">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Fill area */}
      <polygon
        points={`0,50 ${points} 100,50`}
        fill={`url(#${gradientId})`}
      />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
      />
      {/* End dot */}
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

export default function SwipeCard({ prediction, onSwipe, onSkip, onConnectWallet, isTop, stackIndex }: SwipeCardProps) {
  const { isAuthenticated } = useUser();
  const [pressed, setPressed] = useState(false);
  const [imgError, setImgError] = useState(false);

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

  // Get image URL from dflow data
  const imageUrl = prediction.dflow?.imageUrl;
  const hasImage = imageUrl && !imgError;

  const [{ x, rotate, scale, y }, api] = useSpring(() => ({
    x: 0, y: 0, rotate: 0, scale: 1,
    config: { tension: 400, friction: 30 },
  }));

  const yesOp = isTop ? x.to(v => Math.min(1, Math.max(0, v / 80) ** 2)) : 0;
  const noOp = isTop ? x.to(v => Math.min(1, Math.max(0, -v / 80) ** 2)) : 0;
  const glow = isTop ? x.to(v => Math.min(1, Math.abs(v) / 150)) : 0;

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

  const bind = useDrag(
    ({ down, movement: [mx, my], velocity: [vx], direction: [dx], first, last }) => {
      // Block swipe for unauthenticated users
      if (!isAuthenticated) {
        if (first && Math.abs(mx) > 20 && onConnectWallet) {
          onConnectWallet();
        }
        return;
      }

      if (first) setPressed(true);
      if (last) setPressed(false);
      const trigger = vx > 0.3 || Math.abs(mx) > 80;
      const dir = dx > 0 ? 1 : -1;
      if (!down && trigger && Math.abs(mx) > 40) {
        flyOut(dir);
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
    { filterTaps: true, pointer: { touch: true }, enabled: isTop, rubberband: true }
  );

  const vote = useCallback((dir: 'left' | 'right') => {
    if (!isTop) return;

    // Block vote for unauthenticated users
    if (!isAuthenticated) {
      if (onConnectWallet) onConnectWallet();
      return;
    }

    const d = dir === 'right' ? 1 : -1;
    if (navigator.vibrate) navigator.vibrate(10);
    api.start({ x: d * -15, scale: 1.03, config: { tension: 600, friction: 20 } });
    setTimeout(() => flyOut(d), 60);
  }, [isTop, api, flyOut, isAuthenticated, onConnectWallet]);

  const skip = useCallback(() => {
    if (!isTop || !onSkip) return;
    if (navigator.vibrate) navigator.vibrate(5);
    // Animate card flying up/away
    api.start({
      y: -window.innerHeight,
      scale: 0.8,
      rotate: 0,
      config: { tension: 250, friction: 28, clamp: true },
      onRest: () => onSkip(prediction),
    });
  }, [isTop, api, onSkip, prediction]);

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
      <animated.div
        {...(bindHandlers as React.HTMLAttributes<HTMLDivElement>)}
        className="swipe-card-wrapper"
        style={{ x, y, rotate, scale, cursor: pressed ? 'grabbing' : 'grab' }}
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
            </div>
          ) : (
            /* Text-only header */
            <div className="sc-text-header">
              <h2 className="sc-text-question">{prediction.question}</h2>
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
                  <div className="sc-trade-price">${yesPrice.toFixed(2)}</div>
                  <div className="sc-trade-pct">{prediction.marketOdds}%</div>
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
                  <div className="sc-trade-price">${noPrice.toFixed(2)}</div>
                  <div className="sc-trade-pct">{100 - prediction.marketOdds}%</div>
                </div>
                <div className="sc-trade-chart">
                  <MiniLineChart isYes={false} seed={mock.seed + 50} price={noPrice} />
                </div>
              </div>
            </div>
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
              <span className="sc-stat-val"><Countdown date={prediction.resolvesAt} /></span>
              <span className="sc-stat-lbl">CLOSES</span>
            </div>
          </div>

          {/* Action Buttons - Different layout based on auth state */}
          <div className="sc-actions">
            {isAuthenticated ? (
              <>
                <button className="sc-btn sc-btn-no" onClick={() => vote('left')}>
                  <span className="sc-btn-icon">✕</span>
                  <div className="sc-btn-content">
                    <span className="sc-btn-label">NO</span>
                    <span className="sc-btn-price">${noPrice.toFixed(2)}</span>
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
                    <span className="sc-btn-price">${yesPrice.toFixed(2)}</span>
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
          left: 6px;
          right: 6px;
          top: 0;
          bottom: 0;
          touch-action: none;
          z-index: 30;
        }

        .swipe-card-stack {
          z-index: 20;
          pointer-events: none;
        }

        .swipe-card-inner {
          --yes: #00E676;
          --no: #FF5252;
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

        /* ═══ Hero Media Section ═══ */
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

        /* ═══ Text-only Header ═══ */
        .sc-text-header {
          flex: 1;
          padding: 16px 14px;
          display: flex;
          flex-direction: column;
          justify-content: center;
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
        }

        /* ═══ Badges ═══ */
        .sc-badge-live {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 8px;
          background: rgba(255, 59, 48, 0.15);
          border: 1px solid rgba(255, 59, 48, 0.3);
          border-radius: 6px;
          font-size: 9px;
          font-weight: 700;
          color: #FF3B30;
          letter-spacing: 1px;
        }

        .sc-live-dot {
          width: 5px;
          height: 5px;
          background: #FF3B30;
          border-radius: 50%;
          box-shadow: 0 0 8px #FF3B30;
          animation: pulse-dot 2s ease-in-out infinite;
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }

        .sc-badge-hot {
          padding: 4px 8px;
          background: linear-gradient(135deg, #FF6B35, #F7931E);
          border-radius: 6px;
          font-size: 9px;
          font-weight: 700;
          color: #fff;
          letter-spacing: 1px;
        }

        /* ═══ Compact Trading Section with Line Charts ═══ */
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

        .sc-trade-yes {
          border-color: rgba(0, 230, 118, 0.15);
        }

        .sc-trade-no {
          border-color: rgba(255, 82, 82, 0.15);
        }

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

        .sc-trade-price-block {
          flex-shrink: 0;
        }

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

        /* ═══ Stats Row ═══ */
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

        /* ═══ Action Buttons ═══ */
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

        .sc-skip-btn:active {
          transform: scale(0.95);
        }

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

        /* ═══ Responsive ═══ */
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
        }

        @media (min-width: 400px) {
          .swipe-card-wrapper,
          .swipe-card-stack {
            left: 10px;
            right: 10px;
          }
          .sc-hero { min-height: 180px; }
          .sc-hero-question { font-size: 18px; }
          .sc-text-question { font-size: 20px; }
          .sc-trade-price { font-size: 20px; }
          .sc-trade-chart { height: 32px; }
        }

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
        }

        @media (max-height: 550px) {
          .sc-hero { min-height: 100px; }
          .sc-hero-question { -webkit-line-clamp: 1; }
          .sc-text-question { -webkit-line-clamp: 2; }
        }

        /* ═══ Connect Wallet CTA Button (Integrated in Action Area) ═══ */
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

        .sc-connect-cta:hover::before {
          opacity: 1;
        }

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
          color: #00E676;
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
          background: linear-gradient(135deg, #00E676 0%, #00B0FF 100%);
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

        /* Mobile adjustments for connect CTA */
        @media (max-width: 380px) {
          .sc-connect-cta {
            padding: 12px 14px;
          }

          .sc-connect-cta-icon {
            width: 40px;
            height: 40px;
          }

          .sc-connect-cta-icon svg {
            width: 20px;
            height: 20px;
          }

          .sc-connect-cta-title {
            font-size: 14px;
          }

          .sc-connect-cta-subtitle {
            font-size: 11px;
          }

          .sc-connect-cta-arrow {
            width: 32px;
            height: 32px;
          }

          .sc-connect-cta-arrow svg {
            width: 16px;
            height: 16px;
          }
        }

        @media (max-width: 340px) {
          .sc-connect-cta-subtitle {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
