'use client';

import { useState, useCallback, useRef } from 'react';
import { Prediction } from '@/lib/types';

/**
 * SwipeCards - Direct 1:1 replica of Variant HTML design
 * Premium glass morphism card stack with swipe voting
 */

interface SwipeCardsProps {
    predictions: Prediction[];
    onVote?: (prediction: Prediction, choice: 'YES' | 'NO') => void;
}

export default function SwipeCards({ predictions, onVote }: SwipeCardsProps) {
    const [cardIndices, setCardIndices] = useState([0, 1, 2]);
    const [showOverlay, setShowOverlay] = useState(false);
    const [lastChoice, setLastChoice] = useState<'YES' | 'NO'>('YES');
    const [swipeClass, setSwipeClass] = useState<string | null>(null);
    const isAnimating = useRef(false);

    // Get cards for display
    const getCard = (displayIndex: number) => {
        const predictionIndex = cardIndices[displayIndex];
        if (predictionIndex === undefined || predictionIndex >= predictions.length) return null;
        return predictions[predictionIndex];
    };

    const topCard = getCard(0);
    const middleCard = getCard(1);
    const bottomCard = getCard(2);

    // Format volume
    const formatVol = (vol: string | number) => {
        const n = typeof vol === 'number' ? vol : parseFloat(vol.replace(/[^0-9.]/g, ''));
        if (isNaN(n)) return vol.toString();
        if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
        return `$${n}`;
    };

    // Format time remaining
    const formatTime = (dateStr: string) => {
        if (!dateStr || dateStr === 'TBD') return 'TBD';
        const end = new Date(dateStr).getTime();
        const diff = end - Date.now();
        if (diff <= 0) return 'Ended';
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        if (d > 30) return `${Math.floor(d / 30)}mo`;
        if (d > 0) return `${d}d ${h}h`;
        return `${h}h`;
    };

    // Vote handler - mirrors the original JS logic exactly
    const vote = useCallback((choice: 'YES' | 'NO') => {
        if (isAnimating.current || !topCard) return;
        isAnimating.current = true;

        setLastChoice(choice);
        setShowOverlay(true);

        // After 600ms: hide overlay, start swipe animation
        setTimeout(() => {
            setSwipeClass(choice === 'YES' ? 'swipe-right' : 'swipe-left');
            setShowOverlay(false);
        }, 600);

        // After 1200ms: rotate cards
        setTimeout(() => {
            setSwipeClass(null);
            setCardIndices(prev => {
                const next = [...prev];
                const first = next.shift()!;
                next.push(first + 3); // Move to end, increment by 3 for next batch
                return next;
            });

            // Call onVote callback
            if (onVote && topCard) {
                onVote(topCard, choice);
            }

            setTimeout(() => {
                isAnimating.current = false;
            }, 200);
        }, 1200);
    }, [topCard, onVote]);

    // Get category label
    const getCategoryLabel = (cat: string) => {
        const labels: Record<string, string> = {
            crypto: 'Crypto',
            politics: 'Politics',
            tech: 'Tech & AI',
            economics: 'Economics',
            sports: 'Sports',
        };
        return labels[cat] || cat;
    };

    return (
        <div className="swipe-cards-root">
            {/* Ambient Glow */}
            <div className="ambient-glow" />

            {/* Header */}
            <header className="header">
                <div className="user-pill">
                    <div className="avatar" />
                    <div className="balance"><span>$1,240.50</span> USD</div>
                </div>
                <div className="icon-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                </div>
            </header>

            <main className="deck-container">
                {bottomCard && (
                    <div className="card" data-index="2">
                        <div className="deco-circle dc-1" />
                        <div className="deco-circle dc-2" />
                        <div className="card-header">
                            <div className="category-pill">{getCategoryLabel(bottomCard.category)}</div>
                        </div>
                        <div className="market-question">{bottomCard.question}</div>
                    </div>
                )}

                {middleCard && (
                    <div className="card" data-index="1">
                        <div className="deco-circle dc-1" />
                        <div className="deco-circle dc-2" />
                        <div className="card-header">
                            <div className="category-pill">{getCategoryLabel(middleCard.category)}</div>
                        </div>
                        <div className="market-question">{middleCard.question}</div>
                    </div>
                )}

                {topCard && (
                    <div className={`card ${swipeClass || ''}`} data-index="0">
                        <div className="deco-circle dc-1" />
                        <div className="deco-circle dc-2" />

                        <div className="card-header">
                            <div className="category-pill">{getCategoryLabel(topCard.category)}</div>
                            <div className="icon-btn" style={{ width: 28, height: 28, border: 'none', background: 'transparent' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="1" />
                                    <circle cx="19" cy="12" r="1" />
                                    <circle cx="5" cy="12" r="1" />
                                </svg>
                            </div>
                        </div>

                        <h2 className="market-question">{topCard.question}</h2>

                        <div className="chart-container">
                            <div className="chart-bg" />
                            <svg className="sparkline" viewBox="0 0 100 20" preserveAspectRatio="none">
                                <path d="M0,15 Q10,12 20,14 T40,10 T60,5 T80,8 T100,2" fill="none" vectorEffect="non-scaling-stroke" />
                            </svg>
                        </div>

                        <div className="stats-grid">
                            <div className="stat-box">
                                <div className="stat-label">Yes Price</div>
                                <div className="stat-value val-yes">
                                    {topCard.marketOdds}¢ <span className="stat-sub">↑ 4%</span>
                                </div>
                            </div>
                            <div className="stat-box">
                                <div className="stat-label">No Price</div>
                                <div className="stat-value val-no">
                                    {100 - topCard.marketOdds}¢ <span className="stat-sub">↓ 2%</span>
                                </div>
                            </div>
                        </div>

                        <div className="card-footer">
                            <div className="meta-item">
                                <svg className="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                                </svg>
                                <span>{formatVol(topCard.volume)} Vol</span>
                            </div>
                            <div className="meta-item">
                                <svg className="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                                <span>Ends {formatTime(topCard.resolvesAt)}</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className={`result-overlay ${showOverlay ? 'active' : ''}`}>
                    <div className="result-badge" style={{ color: lastChoice === 'YES' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        You said {lastChoice}
                    </div>
                    <div className="result-sub">Market Agreement: {topCard?.marketOdds || 68}%</div>
                </div>
            </main>

            {/* Controls */}
            <div className="controls">
                <button className="control-btn btn-no" onClick={() => vote('NO')}>
                    <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
                <button className="control-btn btn-yes" onClick={() => vote('YES')}>
                    <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                </button>
            </div>

            <style jsx>{`
        .swipe-cards-root {
          --bg-deep: #080C14;
          --bg-glow: #0F1629;
          --accent-cyan: #00C2FF;
          --accent-green: #10B981;
          --accent-red: #F43F5E;
          --text-primary: #FFFFFF;
          --text-secondary: #94A3B8;
          --text-tertiary: #64748B;
          --glass-bg: rgba(20, 25, 40, 0.6);
          --glass-border: rgba(255, 255, 255, 0.08);
          --glass-highlight: rgba(255, 255, 255, 0.15);
          --card-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.6);
          --glow-inner: inset 0 1px 1px rgba(255, 255, 255, 0.15);
          --radius-xl: 32px;
          --radius-lg: 20px;
          --radius-md: 12px;
          --radius-sm: 8px;
          --space-xs: 4px;
          --space-sm: 8px;
          --space-md: 16px;
          --space-lg: 24px;
          --space-xl: 32px;

          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background-color: var(--bg-deep);
          background-image:
            radial-gradient(circle at 50% 0%, #1a2342 0%, var(--bg-deep) 60%),
            radial-gradient(circle at 80% 90%, rgba(0, 194, 255, 0.08) 0%, transparent 40%);
          color: var(--text-primary);
          height: 100vh;
          width: 100%;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .ambient-glow {
          position: absolute;
          top: -20%;
          left: -20%;
          width: 140%;
          height: 60%;
          background: radial-gradient(ellipse at center, rgba(0, 194, 255, 0.15), transparent 70%);
          pointer-events: none;
          z-index: 0;
          filter: blur(60px);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-md) var(--space-lg);
          position: relative;
          z-index: 10;
        }

        .user-pill {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          background: rgba(255, 255, 255, 0.05);
          padding: 4px 12px 4px 4px;
          border-radius: 20px;
          border: 1px solid var(--glass-border);
        }

        .avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-cyan), #0066cc);
        }

        .balance {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .balance span {
          color: var(--text-primary);
        }

        .icon-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          cursor: pointer;
        }

        .deck-container {
          flex: 1;
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          perspective: 1000px;
          padding: 0 var(--space-md);
          margin-top: -20px;
        }

        .card {
          position: absolute;
          width: 100%;
          max-width: 360px;
          height: 480px;
          background: rgba(18, 22, 36, 0.7);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-radius: var(--radius-xl);
          border: 1px solid var(--glass-border);
          box-shadow: var(--card-shadow), var(--glow-inner);
          display: flex;
          flex-direction: column;
          padding: var(--space-lg);
          transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.4s;
          overflow: hidden;
          transform-style: preserve-3d;
        }

        .card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 120px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, transparent 100%);
          pointer-events: none;
          border-radius: var(--radius-xl) var(--radius-xl) 0 0;
        }

        .card[data-index="0"] {
          z-index: 3;
          transform: translateY(0) scale(1);
          background: rgba(18, 22, 36, 1);
        }

        .card[data-index="1"] {
          z-index: 2;
          transform: translateY(16px) scale(0.96);
          opacity: 0.6;
          background: rgba(18, 22, 36, 0.9);
        }

        .card[data-index="2"] {
          z-index: 1;
          transform: translateY(32px) scale(0.92);
          opacity: 0.3;
          background: rgba(18, 22, 36, 0.95);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--space-md);
          position: relative;
          z-index: 2;
        }

        .category-pill {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--accent-cyan);
          background: rgba(0, 194, 255, 0.1);
          padding: 6px 10px;
          border-radius: var(--radius-sm);
          border: 1px solid rgba(0, 194, 255, 0.2);
          box-shadow: 0 0 10px rgba(0, 194, 255, 0.1);
        }

        .market-question {
          font-size: 22px;
          line-height: 1.3;
          font-weight: 700;
          margin-bottom: var(--space-lg);
          color: var(--text-primary);
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
          position: relative;
          z-index: 2;
          min-height: 86px;
        }

        .chart-container {
          flex: 1;
          position: relative;
          width: 100%;
          margin-bottom: var(--space-lg);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }

        .sparkline {
          width: 100%;
          height: 80px;
          stroke: var(--accent-cyan);
          stroke-width: 2;
          fill: none;
          filter: drop-shadow(0 0 4px rgba(0, 194, 255, 0.4));
        }

        .chart-bg {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 80px;
          background: linear-gradient(180deg, rgba(0, 194, 255, 0.1) 0%, transparent 100%);
          clip-path: polygon(0 80px, 10% 70px, 20% 50px, 30% 60px, 40% 40px, 50% 45px, 60% 30px, 70% 35px, 80% 20px, 90% 10px, 100% 5px, 100% 80px);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-md);
          margin-bottom: var(--space-lg);
          background: rgba(0, 0, 0, 0.2);
          padding: var(--space-md);
          border-radius: var(--radius-lg);
          border: 1px solid rgba(255, 255, 255, 0.03);
        }

        .stat-box {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-label {
          font-size: 11px;
          color: var(--text-tertiary);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .stat-sub {
          font-size: 11px;
          font-weight: 500;
          margin-left: 2px;
        }

        .val-yes {
          color: var(--accent-green);
          text-shadow: 0 0 10px rgba(16, 185, 129, 0.2);
        }

        .val-no {
          color: var(--accent-red);
          text-shadow: 0 0 10px rgba(244, 63, 94, 0.2);
        }

        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: var(--space-md);
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .meta-icon {
          width: 14px;
          height: 14px;
          opacity: 0.7;
        }

        .controls {
          padding: 0 var(--space-lg) calc(var(--space-xl) + 80px);
          display: flex;
          justify-content: center;
          gap: 40px;
          z-index: 10;
        }

        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .controls {
            padding-bottom: calc(var(--space-xl) + 80px + env(safe-area-inset-bottom));
          }
        }

        .control-btn {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          position: relative;
          transition: transform 0.1s ease, box-shadow 0.2s;
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .control-btn:active {
          transform: scale(0.92);
        }

        .btn-no {
          border: 1px solid rgba(244, 63, 94, 0.3);
          color: var(--accent-red);
        }

        .btn-yes {
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: var(--accent-green);
        }

        .btn-icon {
          width: 32px;
          height: 32px;
          stroke-width: 2.5;
          z-index: 2;
          filter: drop-shadow(0 0 4px currentColor);
        }

        .result-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background: rgba(8, 12, 20, 0.85);
          backdrop-filter: blur(8px);
          z-index: 20;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
        }

        .result-overlay.active {
          opacity: 1;
          pointer-events: auto;
        }

        .result-badge {
          font-size: 32px;
          font-weight: 800;
          margin-bottom: var(--space-sm);
          transform: scale(0.8);
          opacity: 0;
          transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s;
        }

        .result-overlay.active .result-badge {
          transform: scale(1);
          opacity: 1;
        }

        .result-sub {
          font-size: 16px;
          color: var(--text-secondary);
          margin-top: 8px;
        }

        .swipe-right {
          animation: flyOutRight 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        .swipe-left {
          animation: flyOutLeft 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        @keyframes flyOutRight {
          to {
            transform: translateX(120%) rotate(15deg) translateY(20px);
            opacity: 0;
          }
        }

        @keyframes flyOutLeft {
          to {
            transform: translateX(-120%) rotate(-15deg) translateY(20px);
            opacity: 0;
          }
        }

        .deco-circle {
          position: absolute;
          border-radius: 50%;
          filter: blur(40px);
          z-index: 0;
          opacity: 0.4;
          pointer-events: none;
        }

        .dc-1 {
          top: -20px;
          right: -20px;
          width: 100px;
          height: 100px;
          background: var(--accent-cyan);
        }

        .dc-2 {
          bottom: -30px;
          left: -30px;
          width: 120px;
          height: 120px;
          background: #4f46e5;
        }

      `}</style>
        </div>
    );
}
