'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { animated, useSpring, useTransition, config } from '@react-spring/web';
import SwipeCard from './SwipeCard';
import AIFactCheckModal from './AIFactCheckModal';
import TradingModal from './TradingModal';
import { Prediction, DFlowData } from '@/lib/types';
import confetti from 'canvas-confetti';

// ═══════════════════════════════════════════════════════════
// SPRING CONFIGS - Optimized for smooth card stack animations
// ═══════════════════════════════════════════════════════════

const STACK_SPRING_CONFIG = {
  // Card reveal - smooth bounce when next card becomes active
  reveal: { tension: 280, friction: 24, mass: 1 },
  // Card enter - staggered entrance
  enter: { tension: 220, friction: 26, clamp: false },
  // Card leave - fast dismissal
  leave: { tension: 320, friction: 28, clamp: true },
  // Result overlay
  overlay: { tension: 300, friction: 20 },
  // Completion screen
  completion: { tension: 280, friction: 24 },
};

interface CardStackProps {
  predictions: Prediction[];
  onComplete?: (results: PredictionResult[]) => void;
}

interface PredictionResult {
  prediction: Prediction;
  direction: 'yes' | 'no';
  timestamp: Date;
  factChecked?: boolean;
  traded?: boolean;
}

// Result Overlay Component
function ResultOverlay({
  result,
  onDismiss,
  stats,
}: {
  result: PredictionResult;
  onDismiss: () => void;
  stats: { correct: number; total: number };
}) {
  const isYes = result.direction === 'yes';
  const marketAgrees = isYes
    ? result.prediction.marketOdds >= 50
    : result.prediction.marketOdds < 50;
  const agreementPercent = isYes
    ? result.prediction.marketOdds
    : 100 - result.prediction.marketOdds;

  useEffect(() => {
    // Auto-dismiss after 1.5s
    const timer = setTimeout(onDismiss, 1500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const [spring] = useSpring(() => ({
    from: { opacity: 0, scale: 0.8, y: 20 },
    to: { opacity: 1, scale: 1, y: 0 },
    config: STACK_SPRING_CONFIG.overlay,
  }));

  return (
    <animated.div
      className="result-overlay"
      style={spring}
      onClick={onDismiss}
    >
      {/* Your Pick */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
        style={{
          background: isYes ? 'var(--yes)' : 'var(--no)',
          boxShadow: `0 0 40px ${isYes ? 'var(--yes-glow)' : 'var(--no-glow)'}`,
        }}
      >
        <span className="text-3xl font-bold" style={{ color: isYes ? '#000' : '#fff' }}>
          {isYes ? '✓' : '✗'}
        </span>
      </div>

      <h2 className="text-2xl font-bold mb-2">
        You said <span style={{ color: isYes ? 'var(--yes)' : 'var(--no)' }}>{isYes ? 'YES' : 'NO'}</span>
      </h2>

      <p className="text-center mb-4" style={{ color: 'var(--text-secondary)' }}>
        {marketAgrees ? (
          <>You and <span style={{ color: 'var(--yes)' }}>{agreementPercent}%</span> agree</>
        ) : (
          <>
            <span style={{ color: 'var(--accent)' }}>Contrarian!</span> Only {agreementPercent}% agree 🧠
          </>
        )}
      </p>

      {stats.total > 0 && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          You've predicted on {stats.total} markets today
        </p>
      )}

      <button className="btn-ghost mt-6">
        Share your take
      </button>

      <p className="text-xs mt-4" style={{ color: 'var(--text-ghost)' }}>
        Tap anywhere to continue
      </p>
    </animated.div>
  );
}

// Completion Screen Component
function CompletionScreen({
  results,
  onReset,
}: {
  results: PredictionResult[];
  onReset: () => void;
}) {
  const yesCount = results.filter((r) => r.direction === 'yes').length;
  const noCount = results.filter((r) => r.direction === 'no').length;
  const accuracy = Math.floor(Math.random() * 30) + 65; // Simulated

  const [spring] = useSpring(() => ({
    from: { opacity: 0, scale: 0.9 },
    to: { opacity: 1, scale: 1 },
    config: STACK_SPRING_CONFIG.completion,
  }));

  useEffect(() => {
    // Celebration confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00E676', '#2979FF', '#FFD700'],
    });
  }, []);

  return (
    <animated.div
      className="absolute inset-0 flex flex-col items-center justify-center p-6 glass"
      style={spring}
    >
      <div className="text-6xl mb-6">🎯</div>

      <h2 className="text-2xl font-bold mb-2">All Caught Up!</h2>

      <p className="text-center mb-6" style={{ color: 'var(--text-secondary)' }}>
        You made {results.length} predictions today
      </p>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-6">
        <div
          className="p-4 rounded-xl text-center"
          style={{ background: 'var(--yes-subtle)', border: '1px solid rgba(0, 230, 118, 0.3)' }}
        >
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--yes)' }}>
            {yesCount}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>YES Votes</div>
        </div>

        <div
          className="p-4 rounded-xl text-center"
          style={{ background: 'var(--no-subtle)', border: '1px solid rgba(255, 23, 68, 0.3)' }}
        >
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--no)' }}>
            {noCount}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>NO Votes</div>
        </div>
      </div>

      {/* Accuracy Teaser */}
      <div
        className="w-full max-w-xs p-4 rounded-xl mb-6 text-center"
        style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
      >
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Your accuracy: <span className="font-bold" style={{ color: 'var(--yes)' }}>{accuracy}%</span>
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Top 15% of predictors!
        </p>
      </div>

      {/* Next Session Teaser */}
      <div
        className="w-full max-w-xs p-4 rounded-xl mb-6 text-center"
        style={{ background: 'linear-gradient(135deg, rgba(41, 121, 255, 0.1), rgba(139, 92, 246, 0.1))', border: '1px solid var(--accent-glow)' }}
      >
        <p className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
          🔔 Come back at 6pm for Evening Predictions
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Enable notifications to never miss out
        </p>
      </div>

      <button onClick={onReset} className="btn-ghost">
        Start Over
      </button>
    </animated.div>
  );
}

export default function CardStack({ predictions, onComplete }: CardStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<PredictionResult[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState<PredictionResult | null>(null);

  // AI Fact-Check Modal state
  const [showFactCheck, setShowFactCheck] = useState(false);
  const [pendingSwipe, setPendingSwipe] = useState<{
    prediction: Prediction;
    direction: 'yes' | 'no';
  } | null>(null);

  // Trading Modal state
  const [showTrading, setShowTrading] = useState(false);
  const [tradingPrediction, setTradingPrediction] = useState<Prediction | null>(null);
  const [tradingSide, setTradingSide] = useState<'YES' | 'NO'>('YES');

  // Reset when predictions change
  useEffect(() => {
    setCurrentIndex(0);
    setResults([]);
  }, [predictions]);

  const visibleCards = useMemo(() => {
    return predictions.slice(currentIndex, currentIndex + 3);
  }, [predictions, currentIndex]);

  const isComplete = currentIndex >= predictions.length;

  // Handle initial swipe - show fact-check modal instead of immediately processing
  const handleSwipe = useCallback(
    (direction: 'left' | 'right', prediction: Prediction) => {
      // Store the pending swipe and show fact-check modal
      setPendingSwipe({
        prediction,
        direction: direction === 'right' ? 'yes' : 'no',
      });
      setShowFactCheck(true);

      // Small confetti on initial swipe
      const colors = direction === 'right' ? ['#00E676', '#00C853'] : ['#FF5252', '#D32F2F'];
      confetti({
        particleCount: 20,
        spread: 40,
        origin: { x: direction === 'right' ? 0.75 : 0.25, y: 0.5 },
        colors,
        gravity: 0.8,
        scalar: 0.7,
      });
    },
    []
  );

  // Handle fact-check confirmation - proceed to trading
  const handleFactCheckConfirm = useCallback(
    (finalChoice: 'yes' | 'no') => {
      if (!pendingSwipe) return;

      setShowFactCheck(false);

      // Check if this market supports trading (has DFlow tokens)
      const canTrade = pendingSwipe.prediction.dflow?.tokens?.isInitialized;

      if (canTrade) {
        // Show trading modal
        setTradingPrediction(pendingSwipe.prediction);
        setTradingSide(finalChoice === 'yes' ? 'YES' : 'NO');
        setShowTrading(true);
      } else {
        // No trading available - just record the prediction
        finalizePrediction(pendingSwipe.prediction, finalChoice, true, false);
      }
    },
    [pendingSwipe]
  );

  // Handle fact-check skip - just record prediction without trading
  const handleFactCheckSkip = useCallback(() => {
    if (!pendingSwipe) return;

    setShowFactCheck(false);
    finalizePrediction(pendingSwipe.prediction, pendingSwipe.direction, false, false);
  }, [pendingSwipe]);

  // Handle fact-check close
  const handleFactCheckClose = useCallback(() => {
    setShowFactCheck(false);
    setPendingSwipe(null);
  }, []);

  // Handle trading modal close
  const handleTradingClose = useCallback(() => {
    setShowTrading(false);

    // Record the prediction after trading modal closes
    if (pendingSwipe) {
      const traded = true; // Could check actual trade status
      finalizePrediction(
        pendingSwipe.prediction,
        tradingSide === 'YES' ? 'yes' : 'no',
        true,
        traded
      );
    }

    setTradingPrediction(null);
    setPendingSwipe(null);
  }, [pendingSwipe, tradingSide]);

  // Finalize and record the prediction
  const finalizePrediction = useCallback(
    (prediction: Prediction, direction: 'yes' | 'no', factChecked: boolean, traded: boolean) => {
      const result: PredictionResult = {
        prediction,
        direction,
        timestamp: new Date(),
        factChecked,
        traded,
      };

      setResults((prev) => [...prev, result]);
      setLastResult(result);
      setShowResult(true);
      setPendingSwipe(null);

      // Big celebration confetti
      const colors = direction === 'yes' ? ['#00E676', '#00C853', '#4CAF50'] : ['#FF5252', '#D32F2F', '#E91E63'];
      confetti({
        particleCount: 60,
        spread: 80,
        origin: { x: 0.5, y: 0.6 },
        colors,
        gravity: 0.8,
        scalar: 1,
      });
    },
    []
  );

  const handleDismissResult = useCallback(() => {
    setShowResult(false);
    setCurrentIndex((prev) => prev + 1);
  }, []);

  const handleReset = useCallback(() => {
    setCurrentIndex(0);
    setResults([]);
    setLastResult(null);
    setShowResult(false);
    setShowFactCheck(false);
    setShowTrading(false);
    setPendingSwipe(null);
    setTradingPrediction(null);
  }, []);

  // Track if we're transitioning between cards for smoother reveal
  const [isTransitioning, setIsTransitioning] = useState(false);
  const lastIndex = useRef(currentIndex);

  // Detect when we're moving to next card
  useEffect(() => {
    if (currentIndex !== lastIndex.current) {
      setIsTransitioning(true);
      lastIndex.current = currentIndex;
      // Reset after transition completes
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [currentIndex]);

  // Enhanced stagger animation for card stack with smoother physics
  const transitions = useTransition(visibleCards, {
    keys: (item) => item.id,
    from: { opacity: 0, scale: 0.85, y: 40, rotateZ: 0 },
    enter: (item, index) => ({
      opacity: 1,
      scale: 1,
      y: 0,
      rotateZ: 0,
      delay: index * 50, // Stagger delay for dramatic effect
    }),
    leave: { opacity: 0, scale: 0.92, y: -30 },
    config: (item, index, phase) => {
      if (phase === 'leave') return STACK_SPRING_CONFIG.leave;
      if (phase === 'enter') return STACK_SPRING_CONFIG.enter;
      return STACK_SPRING_CONFIG.reveal;
    },
    trail: 80, // Slight trail for staggered entrance
  });

  return (
    <div className="card-stack-container">
      {/* Card Stack */}
      {!isComplete ? (
        <div className={`card-stack-inner ${isTransitioning ? 'is-transitioning' : ''}`}>
          {visibleCards.map((prediction, index) => (
            <SwipeCard
              key={prediction.id}
              prediction={prediction}
              onSwipe={handleSwipe}
              isTop={index === 0 && !showFactCheck && !showTrading && !isTransitioning}
              stackIndex={index}
            />
          ))}
        </div>
      ) : (
        <CompletionScreen results={results} onReset={handleReset} />
      )}

      {/* AI Fact-Check Modal */}
      {pendingSwipe && (
        <AIFactCheckModal
          prediction={pendingSwipe.prediction}
          userChoice={pendingSwipe.direction}
          isOpen={showFactCheck}
          onConfirm={handleFactCheckConfirm}
          onSkip={handleFactCheckSkip}
          onClose={handleFactCheckClose}
        />
      )}

      {/* Trading Modal */}
      {tradingPrediction && (
        <TradingModal
          prediction={{
            id: tradingPrediction.id,
            question: tradingPrediction.question,
            marketOdds: tradingPrediction.marketOdds,
            dflow: tradingPrediction.dflow,
          }}
          isOpen={showTrading}
          onClose={handleTradingClose}
        />
      )}

      {/* Result Overlay */}
      {showResult && lastResult && (
        <ResultOverlay
          result={lastResult}
          onDismiss={handleDismissResult}
          stats={{ correct: 0, total: results.length }}
        />
      )}

      <style jsx global>{`
        /* ═══════════════════════════════════════════════════════════
           CARD STACK CONTAINER - Responsive across all devices
           ═══════════════════════════════════════════════════════════ */

        .card-stack-container {
          position: relative;
          width: 100%;
          height: calc(100dvh - 56px - 72px - 56px - 32px);
          min-height: 320px;
          max-height: 520px;
        }

        .card-stack-inner {
          position: relative;
          width: 100%;
          height: 100%;
          will-change: contents;
          transform: translateZ(0);
          -webkit-transform: translateZ(0);
          perspective: 1200px;
          perspective-origin: center center;
        }

        /* Smooth card reveal animation states */
        .card-stack-inner.is-transitioning {
          pointer-events: none;
        }

        /* iOS safe areas */
        @supports (padding-top: env(safe-area-inset-top)) {
          .card-stack-container {
            height: calc(100dvh - 56px - 72px - 56px - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
          }
        }

        /* ─── VERY SMALL PHONES (< 360px) ─── */
        @media (max-width: 359px) {
          .card-stack-container {
            height: calc(100dvh - 44px - 60px - 44px - 20px);
            min-height: 260px;
            max-height: 380px;
          }
        }

        /* ─── SMALL PHONES (360-400px) ─── */
        @media (min-width: 360px) and (max-width: 399px) {
          .card-stack-container {
            height: calc(100dvh - 52px - 68px - 52px - 24px);
            min-height: 280px;
            max-height: 420px;
          }
        }

        /* ─── SHORT PHONES (height < 667px) ─── */
        @media (max-height: 667px) {
          .card-stack-container {
            height: calc(100dvh - 48px - 64px - 48px - 24px);
            min-height: 260px;
            max-height: 380px;
          }
        }

        /* ─── MEDIUM PHONES (400-480px) ─── */
        @media (min-width: 400px) and (max-width: 479px) {
          .card-stack-container {
            height: calc(100dvh - 56px - 72px - 52px - 28px);
            min-height: 300px;
            max-height: 460px;
          }
        }

        /* ─── LARGE PHONES (480-640px) ─── */
        @media (min-width: 480px) and (max-width: 639px) {
          .card-stack-container {
            height: calc(100dvh - 56px - 72px - 56px - 36px);
            min-height: 340px;
            max-height: 500px;
          }
        }

        /* ─── SMALL TABLETS (640-768px) ─── */
        @media (min-width: 640px) and (max-width: 767px) {
          .card-stack-container {
            height: calc(100dvh - 60px - 76px - 56px - 40px);
            min-height: 360px;
            max-height: 480px;
          }
        }

        /* ─── TABLETS (768-1024px) ─── */
        @media (min-width: 768px) and (max-width: 1023px) {
          .card-stack-container {
            height: calc(100dvh - 64px - 80px - 56px - 48px);
            min-height: 380px;
            max-height: 500px;
          }
        }

        /* ─── DESKTOP (1024px+) ─── */
        @media (min-width: 1024px) {
          .card-stack-container {
            height: 480px;
            min-height: 420px;
            max-height: 520px;
          }
        }

        /* ─── TALL PHONES (height > 800px) ─── */
        @media (min-height: 800px) {
          .card-stack-container {
            max-height: 560px;
          }
        }

        /* ─── EXTRA TALL PHONES (height > 850px) ─── */
        @media (min-height: 850px) {
          .card-stack-container {
            min-height: 400px;
            max-height: 600px;
          }
        }

        /* ─── LANDSCAPE - SHORT (height < 500px) ─── */
        @media (max-height: 500px) and (orientation: landscape) {
          .card-stack-container {
            height: calc(100dvh - 42px - 52px - 16px);
            min-height: 180px;
            max-height: 300px;
          }
        }

        /* ─── LANDSCAPE - MEDIUM (500-700px) ─── */
        @media (min-height: 500px) and (max-height: 700px) and (orientation: landscape) {
          .card-stack-container {
            height: calc(100dvh - 52px - 64px - 24px);
            min-height: 240px;
            max-height: 360px;
          }
        }

        /* ─── FOLDABLE DEVICES ─── */
        @media (min-aspect-ratio: 20/9) {
          .card-stack-container {
            max-height: 400px;
          }
        }

        /* Result overlay responsive */
        .result-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(10, 10, 15, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 16px;
          padding: 24px;
          z-index: 100;
        }

        @media (max-width: 359px) {
          .result-overlay {
            padding: 16px;
          }

          .result-overlay h2 {
            font-size: 1.25rem;
          }
        }

        @media (min-width: 768px) {
          .result-overlay {
            padding: 32px;
            border-radius: 24px;
          }
        }
      `}</style>
    </div>
  );
}
