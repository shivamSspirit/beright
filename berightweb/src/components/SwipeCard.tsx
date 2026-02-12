'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import { animated, useSpring, to } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Prediction } from '@/lib/types';

interface SwipeCardProps {
  prediction: Prediction;
  onSwipe: (direction: 'left' | 'right', prediction: Prediction) => void;
  isTop: boolean;
  stackIndex: number;
}

const categoryIcons: Record<string, string> = {
  crypto: '₿',
  politics: '🏛',
  economics: '📊',
  tech: '🚀',
  sports: '🏆',
};

function formatVol(v: string): string {
  const match = v.match(/[\d.]+/);
  if (!match) return v;
  const n = parseFloat(match[0]);
  if (v.includes('M')) return `$${n.toFixed(1)}M`;
  if (v.includes('K')) return `$${n}K`;
  return `$${n}`;
}

function parseVol(v: string): number {
  const match = v.match(/[\d.]+/);
  if (!match) return 0;
  const n = parseFloat(match[0]);
  if (v.includes('M')) return n * 1e6;
  if (v.includes('K')) return n * 1e3;
  return n;
}

function Countdown({ date }: { date: string }) {
  const [t, setT] = useState('');
  useEffect(() => {
    const calc = () => {
      // Handle invalid/missing dates
      if (!date || date === 'TBD' || date === 'Unknown') {
        return setT('TBD');
      }

      const timestamp = new Date(date).getTime();
      if (isNaN(timestamp)) {
        return setT('TBD');
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
  }, [date]);
  return <span>{t}</span>;
}

export default function SwipeCard({ prediction, onSwipe, isTop, stackIndex }: SwipeCardProps) {
  const [pressed, setPressed] = useState(false);

  const mock = useMemo(() => {
    const h = prediction.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return {
      trading: 50 + (h % 250),
      delta: ((h % 20) - 10) * 0.3,
      liq: 50000 + (h % 400000),
      traders: 100 + (h % 1500),
    };
  }, [prediction.id]);

  const vol = parseVol(prediction.volume);
  const isHot = vol > 500000;
  const yesPrice = prediction.dflow?.yesBid ?? prediction.marketOdds / 100;
  const noPrice = prediction.dflow?.noBid ?? (100 - prediction.marketOdds) / 100;
  const up = mock.delta >= 0;
  const cat = categoryIcons[prediction.category] || '📊';

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
    const d = dir === 'right' ? 1 : -1;
    if (navigator.vibrate) navigator.vibrate(10);
    api.start({ x: d * -15, scale: 1.03, config: { tension: 600, friction: 20 } });
    setTimeout(() => flyOut(d), 60);
  }, [isTop, api, flyOut]);

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
          className="swipe-card-inner"
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

          {/* Top badges */}
          <div className="sc-top">
            <div className="sc-badges">
              <span className="sc-cat">{cat} {prediction.category.toUpperCase()}</span>
              {isHot && <span className="sc-hot">🔥</span>}
            </div>
            <div className="sc-live">
              <span className="sc-live-dot" />
              <span className="sc-live-text">LIVE</span>
              <span className="sc-live-count">{mock.trading}</span>
            </div>
          </div>

          {/* Question - flexible center */}
          <div className="sc-question">
            <h2>{prediction.question}</h2>
          </div>

          {/* Price cards */}
          <div className="sc-prices">
            <div className="sc-price sc-price-yes">
              <div className="sc-price-head">
                <span className="sc-price-label">YES</span>
                <span className={`sc-delta ${up ? 'up' : 'down'}`}>{up ? '▲' : '▼'}{Math.abs(mock.delta).toFixed(1)}%</span>
              </div>
              <div className="sc-price-val">{yesPrice.toFixed(2)}</div>
              <div className="sc-price-pct">{prediction.marketOdds}%</div>
            </div>
            <div className="sc-price sc-price-no">
              <div className="sc-price-head">
                <span className="sc-price-label">NO</span>
                <span className={`sc-delta ${!up ? 'up' : 'down'}`}>{!up ? '▲' : '▼'}{Math.abs(mock.delta).toFixed(1)}%</span>
              </div>
              <div className="sc-price-val">{noPrice.toFixed(2)}</div>
              <div className="sc-price-pct">{100 - prediction.marketOdds}%</div>
            </div>
          </div>

          {/* Stats bar */}
          <div className="sc-stats">
            <div className="sc-stat"><span className="sc-stat-label">VOL</span><span className="sc-stat-val">{formatVol(prediction.volume)}</span></div>
            <div className="sc-stat"><span className="sc-stat-label">TRADERS</span><span className="sc-stat-val">{mock.traders.toLocaleString()}</span></div>
            <div className="sc-stat"><span className="sc-stat-label">LIQ</span><span className="sc-stat-val">${(mock.liq / 1000).toFixed(0)}K</span></div>
          </div>

          {/* Meta row */}
          <div className="sc-meta">
            <span className="sc-platform">{prediction.platform}</span>
            <span className="sc-timer">⏱ <Countdown date={prediction.resolvesAt} /></span>
          </div>

          {/* Action buttons */}
          <div className="sc-actions">
            <button className="sc-btn sc-btn-no" onClick={() => vote('left')}>
              <span className="sc-btn-label">NO</span>
              <span className="sc-btn-price">{noPrice.toFixed(2)}</span>
            </button>
            <span className="sc-swipe-hint">swipe</span>
            <button className="sc-btn sc-btn-yes" onClick={() => vote('right')}>
              <span className="sc-btn-label">YES</span>
              <span className="sc-btn-price">{yesPrice.toFixed(2)}</span>
            </button>
          </div>
        </animated.div>
      </animated.div>

      <style jsx global>{`
        /* ═══════════════════════════════════════════════════════════
           MOBILE-FIRST SWIPE CARD - Fits viewport without scroll
           ═══════════════════════════════════════════════════════════ */

        .swipe-card-wrapper,
        .swipe-card-stack {
          position: absolute;
          left: 8px;
          right: 8px;
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
          width: 100%;
          height: 100%;
          background: linear-gradient(165deg, #151520 0%, #0c0c14 100%);
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.08);
          display: flex;
          flex-direction: column;
          padding: 12px;
          gap: 8px;
          position: relative;
          overflow: hidden;
        }

        /* ─── Stamps ─── */
        .swipe-stamp {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          padding: 6px 14px;
          border: 3px solid currentColor;
          border-radius: 6px;
          font-size: 20px;
          font-weight: 900;
          letter-spacing: 2px;
          pointer-events: none;
          z-index: 50;
        }
        .swipe-stamp-yes { right: 10px; color: #00E676; text-shadow: 0 0 16px rgba(0,230,118,0.7); }
        .swipe-stamp-no { left: 10px; color: #FF5252; text-shadow: 0 0 16px rgba(255,82,82,0.7); }

        /* ─── Top Row ─── */
        .sc-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        }
        .sc-badges {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .sc-cat {
          padding: 3px 6px;
          background: rgba(99,102,241,0.15);
          color: #818CF8;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.3px;
        }
        .sc-hot {
          font-size: 12px;
          animation: pulse-hot 1s ease-in-out infinite;
        }
        @keyframes pulse-hot {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
        .sc-live {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 9px;
          color: rgba(255,255,255,0.5);
        }
        .sc-live-dot {
          width: 5px;
          height: 5px;
          background: #FF3B30;
          border-radius: 50%;
          box-shadow: 0 0 6px #FF3B30;
          animation: pulse-dot 2s ease-in-out infinite;
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .sc-live-text {
          color: #FF3B30;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .sc-live-count {
          font-family: var(--font-mono, monospace);
        }

        /* ─── Question ─── */
        .sc-question {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 0;
          padding: 4px 0;
        }
        .sc-question h2 {
          font-size: clamp(14px, 4vw, 17px);
          font-weight: 700;
          line-height: 1.25;
          text-align: center;
          color: #fff;
          margin: 0;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
        }

        /* ─── Price Cards ─── */
        .sc-prices {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }
        .sc-price {
          flex: 1;
          padding: 8px;
          background: rgba(0,0,0,0.3);
          border-radius: 8px;
        }
        .sc-price-yes { border-left: 3px solid #00E676; }
        .sc-price-no { border-left: 3px solid #FF5252; }
        .sc-price-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2px;
        }
        .sc-price-label {
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.8px;
        }
        .sc-price-yes .sc-price-label { color: #00E676; }
        .sc-price-no .sc-price-label { color: #FF5252; }
        .sc-delta {
          font-size: 8px;
          font-weight: 600;
          font-family: var(--font-mono, monospace);
        }
        .sc-delta.up { color: #00E676; }
        .sc-delta.down { color: #FF5252; }
        .sc-price-val {
          font-size: 20px;
          font-weight: 800;
          font-family: var(--font-mono, monospace);
          line-height: 1;
        }
        .sc-price-yes .sc-price-val { color: #00E676; }
        .sc-price-no .sc-price-val { color: #FF5252; }
        .sc-price-pct {
          font-size: 8px;
          color: rgba(255,255,255,0.4);
          font-family: var(--font-mono, monospace);
          margin-top: 1px;
        }

        /* ─── Stats Bar ─── */
        .sc-stats {
          display: flex;
          justify-content: space-around;
          padding: 6px 8px;
          background: rgba(0,0,0,0.25);
          border-radius: 6px;
          flex-shrink: 0;
        }
        .sc-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
        }
        .sc-stat-label {
          font-size: 7px;
          color: rgba(255,255,255,0.35);
          letter-spacing: 0.3px;
        }
        .sc-stat-val {
          font-size: 10px;
          font-weight: 700;
          color: #fff;
          font-family: var(--font-mono, monospace);
        }

        /* ─── Meta Row ─── */
        .sc-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 8px;
          color: rgba(255,255,255,0.4);
          flex-shrink: 0;
        }
        .sc-timer {
          padding: 2px 5px;
          background: rgba(255,255,255,0.05);
          border-radius: 3px;
          font-family: var(--font-mono, monospace);
        }

        /* ─── Action Buttons ─── */
        .sc-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .sc-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px;
          border-radius: 10px;
          border: 2px solid;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s ease;
        }
        .sc-btn-yes {
          background: rgba(0,230,118,0.1);
          border-color: rgba(0,230,118,0.4);
        }
        .sc-btn-yes:active {
          background: rgba(0,230,118,0.2);
          transform: scale(0.98);
        }
        .sc-btn-no {
          background: rgba(255,82,82,0.1);
          border-color: rgba(255,82,82,0.4);
        }
        .sc-btn-no:active {
          background: rgba(255,82,82,0.2);
          transform: scale(0.98);
        }
        .sc-btn-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .sc-btn-yes .sc-btn-label { color: #00E676; }
        .sc-btn-no .sc-btn-label { color: #FF5252; }
        .sc-btn-price {
          font-size: 14px;
          font-weight: 800;
          font-family: var(--font-mono, monospace);
        }
        .sc-btn-yes .sc-btn-price { color: #00E676; }
        .sc-btn-no .sc-btn-price { color: #FF5252; }
        .sc-swipe-hint {
          font-size: 7px;
          color: rgba(255,255,255,0.12);
          letter-spacing: 0.5px;
          text-transform: uppercase;
          flex-shrink: 0;
        }

        /* ═══════════════════════════════════════════════════════════
           RESPONSIVE - Very small screens
           ═══════════════════════════════════════════════════════════ */
        @media (max-width: 359px) {
          .swipe-card-inner {
            padding: 10px;
            gap: 6px;
          }
          .sc-question h2 {
            font-size: 13px;
          }
          .sc-price-val {
            font-size: 18px;
          }
          .sc-btn {
            padding: 8px;
          }
          .sc-btn-price {
            font-size: 12px;
          }
        }

        /* Larger phones */
        @media (min-width: 400px) {
          .swipe-card-wrapper,
          .swipe-card-stack {
            left: 12px;
            right: 12px;
          }
          .swipe-card-inner {
            padding: 14px;
            gap: 10px;
            border-radius: 20px;
          }
          .sc-question h2 {
            font-size: 17px;
          }
          .sc-price {
            padding: 10px;
          }
          .sc-price-val {
            font-size: 22px;
          }
        }

        /* Landscape / short screens */
        @media (max-height: 600px) {
          .swipe-card-inner {
            padding: 8px;
            gap: 4px;
          }
          .sc-question {
            padding: 2px 0;
          }
          .sc-question h2 {
            -webkit-line-clamp: 2;
          }
          .sc-stats {
            padding: 4px 6px;
          }
          .sc-btn {
            padding: 6px;
          }
        }
      `}</style>
    </>
  );
}
