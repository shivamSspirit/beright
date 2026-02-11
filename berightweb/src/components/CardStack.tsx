'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { animated, useSpring, useTransition } from '@react-spring/web';
import SwipeCard from './SwipeCard';
import { Prediction } from '@/lib/types';
import confetti from 'canvas-confetti';

interface CardStackProps {
  predictions: Prediction[];
  onComplete?: (results: PredictionResult[]) => void;
}

interface PredictionResult {
  prediction: Prediction;
  direction: 'yes' | 'no';
  timestamp: Date;
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
    config: { tension: 300, friction: 20 },
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
    config: { tension: 280, friction: 24 },
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

  // Reset when predictions change
  useEffect(() => {
    setCurrentIndex(0);
    setResults([]);
  }, [predictions]);

  const visibleCards = useMemo(() => {
    return predictions.slice(currentIndex, currentIndex + 3);
  }, [predictions, currentIndex]);

  const isComplete = currentIndex >= predictions.length;

  const handleSwipe = useCallback(
    (direction: 'left' | 'right', prediction: Prediction) => {
      const result: PredictionResult = {
        prediction,
        direction: direction === 'right' ? 'yes' : 'no',
        timestamp: new Date(),
      };

      setResults((prev) => [...prev, result]);
      setLastResult(result);
      setShowResult(true);

      // Trigger confetti on swipe
      const colors = direction === 'right' ? ['#00E676', '#00C853'] : ['#FF5252', '#D32F2F'];
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { x: direction === 'right' ? 0.75 : 0.25, y: 0.5 },
        colors,
        gravity: 0.8,
        scalar: 0.9,
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
  }, []);

  // Stagger animation for card stack
  const transitions = useTransition(visibleCards, {
    keys: (item) => item.id,
    from: { opacity: 0, scale: 0.8, y: 50 },
    enter: { opacity: 1, scale: 1, y: 0 },
    leave: { opacity: 0, scale: 0.9, y: -20 },
    config: { tension: 280, friction: 24 },
  });

  return (
    <div className="relative w-full" style={{ height: 'calc(70vh + 20px)', minHeight: '460px', maxHeight: '640px' }}>
      {/* Card Stack */}
      {!isComplete ? (
        <div className="relative w-full h-full">
          {visibleCards.map((prediction, index) => (
            <SwipeCard
              key={prediction.id}
              prediction={prediction}
              onSwipe={handleSwipe}
              isTop={index === 0}
              stackIndex={index}
            />
          ))}
        </div>
      ) : (
        <CompletionScreen results={results} onReset={handleReset} />
      )}

      {/* Result Overlay */}
      {showResult && lastResult && (
        <ResultOverlay
          result={lastResult}
          onDismiss={handleDismissResult}
          stats={{ correct: 0, total: results.length }}
        />
      )}
    </div>
  );
}
