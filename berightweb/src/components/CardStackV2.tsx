'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { animated, useSpring } from '@react-spring/web';
import { AnimatePresence, motion } from 'framer-motion';
import SwipeCardV2 from './SwipeCardV2';
import { Prediction } from '@/lib/types';
import confetti from 'canvas-confetti';

// ═══════════════════════════════════════════════════════════════════════════════
// CARD STACK V2 - Variant Design System
// Premium Tinder-style card stack with result overlays
// ═══════════════════════════════════════════════════════════════════════════════

interface CardStackV2Props {
  predictions: Prediction[];
  onComplete?: (results: VoteResult[]) => void;
}

interface VoteResult {
  prediction: Prediction;
  choice: 'YES' | 'NO';
  timestamp: Date;
  marketAgreement: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESULT OVERLAY - Shows after each vote
// ═══════════════════════════════════════════════════════════════════════════════

function ResultOverlay({
  result,
  onDismiss,
  totalVotes,
}: {
  result: VoteResult;
  onDismiss: () => void;
  totalVotes: number;
}) {
  const isYes = result.choice === 'YES';

  useEffect(() => {
    const timer = setTimeout(onDismiss, 1500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      className="result-overlay-v2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDismiss}
    >
      <motion.div
        className="result-content"
        initial={{ scale: 0.8, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20 }}
      >
        <div
          className="result-icon"
          style={{
            background: isYes ? '#10B981' : '#F43F5E',
            boxShadow: `0 0 40px ${isYes ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`,
          }}
        >
          <span style={{ color: isYes ? '#000' : '#fff', fontSize: 32, fontWeight: 800 }}>
            {isYes ? '✓' : '✗'}
          </span>
        </div>

        <h2 className="result-title">
          You said{' '}
          <span style={{ color: isYes ? '#10B981' : '#F43F5E' }}>
            {result.choice}
          </span>
        </h2>

        <p className="result-agreement">
          {result.marketAgreement >= 50 ? (
            <>
              You and <span className="highlight-green">{result.marketAgreement}%</span> agree
            </>
          ) : (
            <>
              <span className="highlight-cyan">Contrarian!</span> Only {result.marketAgreement}% agree
            </>
          )}
        </p>

        <p className="result-count">
          You've predicted on {totalVotes} markets today
        </p>

        <p className="result-tap">Tap anywhere to continue</p>
      </motion.div>

      <style jsx>{`
        .result-overlay-v2 {
          position: fixed;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(8, 12, 20, 0.9);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          z-index: 100;
          cursor: pointer;
        }

        .result-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 32px;
        }

        .result-icon {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
        }

        .result-title {
          font-size: 28px;
          font-weight: 700;
          color: #FFFFFF;
          margin-bottom: 12px;
        }

        .result-agreement {
          font-size: 16px;
          color: #94A3B8;
          margin-bottom: 24px;
        }

        .highlight-green {
          color: #10B981;
          font-weight: 600;
        }

        .highlight-cyan {
          color: #00FFB2;
          font-weight: 600;
        }

        .result-count {
          font-size: 14px;
          color: #64748B;
          margin-bottom: 32px;
        }

        .result-tap {
          font-size: 12px;
          color: #475569;
        }
      `}</style>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLETION SCREEN - Shows when all cards are swiped
// ═══════════════════════════════════════════════════════════════════════════════

function CompletionScreen({
  results,
  onReset,
}: {
  results: VoteResult[];
  onReset: () => void;
}) {
  const yesCount = results.filter((r) => r.choice === 'YES').length;
  const noCount = results.filter((r) => r.choice === 'NO').length;
  const accuracy = Math.floor(Math.random() * 25) + 70;

  useEffect(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10B981', '#00FFB2', '#FBBF24'],
    });
  }, []);

  return (
    <motion.div
      className="completion-screen"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 20 }}
    >
      <div className="completion-emoji">🎯</div>

      <h2 className="completion-title">All Caught Up!</h2>

      <p className="completion-subtitle">
        You made {results.length} predictions today
      </p>

      <div className="stats-row">
        <div className="stat-card yes">
          <div className="stat-number">{yesCount}</div>
          <div className="stat-label">YES Votes</div>
        </div>
        <div className="stat-card no">
          <div className="stat-number">{noCount}</div>
          <div className="stat-label">NO Votes</div>
        </div>
      </div>

      <div className="accuracy-card">
        <p>
          Your accuracy: <span className="accuracy-value">{accuracy}%</span>
        </p>
        <p className="accuracy-rank">Top 15% of predictors!</p>
      </div>

      <div className="next-session-card">
        <p className="next-session-text">
          🔔 Come back at 6pm for Evening Predictions
        </p>
        <p className="next-session-sub">
          Enable notifications to never miss out
        </p>
      </div>

      <button className="reset-btn" onClick={onReset}>
        Start Over
      </button>

      <style jsx>{`
        .completion-screen {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px;
          min-height: 60vh;
        }

        .completion-emoji {
          font-size: 64px;
          margin-bottom: 24px;
        }

        .completion-title {
          font-size: 28px;
          font-weight: 700;
          color: #FFFFFF;
          margin-bottom: 8px;
        }

        .completion-subtitle {
          font-size: 16px;
          color: #94A3B8;
          margin-bottom: 32px;
        }

        .stats-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          width: 100%;
          max-width: 280px;
          margin-bottom: 24px;
        }

        .stat-card {
          padding: 20px;
          border-radius: 16px;
          text-align: center;
        }

        .stat-card.yes {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .stat-card.no {
          background: rgba(244, 63, 94, 0.1);
          border: 1px solid rgba(244, 63, 94, 0.3);
        }

        .stat-number {
          font-size: 32px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        .stat-card.yes .stat-number {
          color: #10B981;
        }

        .stat-card.no .stat-number {
          color: #F43F5E;
        }

        .stat-label {
          font-size: 12px;
          color: #64748B;
          margin-top: 4px;
        }

        .accuracy-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 16px 24px;
          text-align: center;
          margin-bottom: 16px;
          width: 100%;
          max-width: 280px;
        }

        .accuracy-card p {
          font-size: 14px;
          color: #94A3B8;
        }

        .accuracy-value {
          color: #10B981;
          font-weight: 700;
        }

        .accuracy-rank {
          font-size: 12px;
          color: #64748B;
          margin-top: 4px;
        }

        .next-session-card {
          background: linear-gradient(135deg, rgba(0, 255, 178, 0.1), rgba(139, 92, 246, 0.1));
          border: 1px solid rgba(0, 255, 178, 0.2);
          border-radius: 16px;
          padding: 16px 24px;
          text-align: center;
          margin-bottom: 32px;
          width: 100%;
          max-width: 280px;
        }

        .next-session-text {
          font-size: 14px;
          font-weight: 500;
          color: #00FFB2;
        }

        .next-session-sub {
          font-size: 12px;
          color: #64748B;
          margin-top: 4px;
        }

        .reset-btn {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #94A3B8;
          padding: 12px 32px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .reset-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #FFFFFF;
        }
      `}</style>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CARD STACK COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function CardStackV2({ predictions, onComplete }: CardStackV2Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<VoteResult[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState<VoteResult | null>(null);

  // Reset when predictions change
  useEffect(() => {
    setCurrentIndex(0);
    setResults([]);
  }, [predictions]);

  // Get visible cards (current + 2 behind)
  const visibleCards = predictions.slice(currentIndex, currentIndex + 3);
  const isComplete = currentIndex >= predictions.length;

  // Handle swipe
  const handleSwipe = useCallback(
    (direction: 'left' | 'right', prediction: Prediction) => {
      // Swipe animation handled in SwipeCardV2
    },
    []
  );

  // Handle vote
  const handleVote = useCallback(
    (prediction: Prediction, choice: 'YES' | 'NO') => {
      const marketAgreement =
        choice === 'YES' ? prediction.marketOdds : 100 - prediction.marketOdds;

      const result: VoteResult = {
        prediction,
        choice,
        timestamp: new Date(),
        marketAgreement,
      };

      setResults((prev) => [...prev, result]);
      setLastResult(result);
      setShowResult(true);

      // Confetti on vote
      const colors = choice === 'YES' ? ['#10B981', '#34D399'] : ['#F43F5E', '#FB7185'];
      confetti({
        particleCount: 40,
        spread: 50,
        origin: { x: 0.5, y: 0.5 },
        colors,
        gravity: 0.9,
        scalar: 0.8,
      });

      // Move to next card after overlay
      setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
      }, 100);
    },
    []
  );

  // Dismiss result overlay
  const handleDismissResult = useCallback(() => {
    setShowResult(false);
  }, []);

  // Reset stack
  const handleReset = useCallback(() => {
    setCurrentIndex(0);
    setResults([]);
    setLastResult(null);
    setShowResult(false);
  }, []);

  return (
    <div className="card-stack-v2">
      {/* Ambient glow */}
      <div className="ambient-glow" />

      {/* Card Stack */}
      {!isComplete ? (
        <div className="deck-container">
          {visibleCards.map((prediction, index) => (
            <SwipeCardV2
              key={prediction.id}
              prediction={prediction}
              onSwipe={handleSwipe}
              onVote={handleVote}
              isTop={index === 0}
              stackIndex={index}
            />
          ))}
        </div>
      ) : (
        <CompletionScreen results={results} onReset={handleReset} />
      )}

      {/* Result Overlay */}
      <AnimatePresence>
        {showResult && lastResult && (
          <ResultOverlay
            result={lastResult}
            onDismiss={handleDismissResult}
            totalVotes={results.length}
          />
        )}
      </AnimatePresence>

      <style jsx>{`
        .card-stack-v2 {
          position: relative;
          width: 100%;
          min-height: calc(100vh - 160px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0 16px;
        }

        .ambient-glow {
          position: absolute;
          top: -20%;
          left: -20%;
          width: 140%;
          height: 60%;
          background: radial-gradient(ellipse at center, rgba(0, 255, 178, 0.12), transparent 70%);
          pointer-events: none;
          z-index: 0;
          filter: blur(60px);
        }

        .deck-container {
          position: relative;
          width: 100%;
          max-width: 360px;
          height: 520px;
          display: flex;
          justify-content: center;
          align-items: center;
          perspective: 1000px;
          margin-bottom: 120px;
        }

        @media (max-width: 380px) {
          .deck-container {
            height: 480px;
            margin-bottom: 100px;
          }
        }

        @media (max-height: 700px) {
          .deck-container {
            height: 440px;
            margin-bottom: 90px;
          }
        }
      `}</style>
    </div>
  );
}
