'use client';

import { useState, useEffect, useCallback } from 'react';
import { animated, useSpring } from '@react-spring/web';
import { Prediction } from '@/lib/types';
import { tavilyGetFacts, TavilyFactsResponse, RateLimitError } from '@/lib/api';

interface AIFactCheckModalProps {
  prediction: Prediction;
  userChoice: 'yes' | 'no';
  isOpen: boolean;
  onConfirm: (finalChoice: 'yes' | 'no') => void;
  onSkip: () => void;
  onClose: () => void;
}

interface FactCheckData {
  facts: string[];
  sources: Array<{ title: string; url: string }>;
  answer?: string;
  confidence: 'high' | 'medium' | 'low';
  recommendation: 'proceed' | 'reconsider' | 'change';
  suggestedDirection: 'yes' | 'no';
  reasoning: string;
}

export default function AIFactCheckModal({
  prediction,
  userChoice,
  isOpen,
  onConfirm,
  onSkip,
  onClose,
}: AIFactCheckModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [factCheck, setFactCheck] = useState<FactCheckData | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<'yes' | 'no'>(userChoice);

  // Animation - use scale and y separately to avoid conflicting with CSS centering
  const modalSpring = useSpring({
    opacity: isOpen ? 1 : 0,
    y: isOpen ? 0 : 30,
    scale: isOpen ? 1 : 0.95,
    config: { tension: 300, friction: 25 },
  });

  const backdropSpring = useSpring({
    opacity: isOpen ? 1 : 0,
    config: { tension: 300, friction: 30 },
  });

  // Fetch facts when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);
    setSelectedChoice(userChoice);

    const fetchFacts = async () => {
      try {
        const response = await tavilyGetFacts(prediction.question);

        if (response.success && response.result) {
          const { facts, sources, answer, confidence } = response.result;

          // Analyze facts to make a recommendation
          const analysis = analyzeFactsForRecommendation(
            facts,
            answer,
            prediction.marketOdds,
            userChoice,
            confidence
          );

          setFactCheck({
            facts,
            sources,
            answer,
            confidence,
            ...analysis,
          });
        } else {
          throw new Error('Failed to fetch facts');
        }
      } catch (err) {
        console.warn('Fact check error:', err);

        // Handle rate limiting gracefully
        if (err instanceof RateLimitError) {
          setError(`AI fact-check is temporarily unavailable (rate limited). You can still proceed with your choice.`);
        } else {
          setError('Could not verify facts. You can still proceed with your choice.');
        }

        // Still allow proceeding even if fact check fails
        setFactCheck({
          facts: [],
          sources: [],
          confidence: 'low',
          recommendation: 'proceed',
          suggestedDirection: userChoice,
          reasoning: 'Unable to verify facts at this time. Trust your judgment!',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchFacts();
  }, [isOpen, prediction.question, prediction.marketOdds, userChoice]);

  const handleConfirm = useCallback(() => {
    onConfirm(selectedChoice);
  }, [selectedChoice, onConfirm]);

  if (!isOpen) return null;

  const confidenceColors = {
    high: '#00E676',
    medium: '#FFB300',
    low: '#FF5252',
  };

  const recommendationConfig = {
    proceed: {
      icon: '✓',
      color: '#00E676',
      label: 'Proceed',
      description: 'Your choice aligns with available evidence',
    },
    reconsider: {
      icon: '⚠',
      color: '#FFB300',
      label: 'Reconsider',
      description: 'Some evidence suggests caution',
    },
    change: {
      icon: '↻',
      color: '#FF5252',
      label: 'Reconsider',
      description: 'Evidence suggests a different outcome',
    },
  };

  return (
    <>
      {/* Backdrop */}
      <animated.div
        className="fact-check-backdrop"
        style={backdropSpring}
        onClick={onClose}
      />

      {/* Modal Container - handles centering */}
      <div className="fact-check-container" onClick={onClose}>
        {/* Modal - handles animation */}
        <animated.div
          className="fact-check-modal"
          style={{
            opacity: modalSpring.opacity,
            transform: modalSpring.y.to(y => `translateY(${y}px)`),
            scale: modalSpring.scale,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
        <div className="modal-header">
          <div className="header-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="modal-title">AI Fact Check</h3>
          <button className="close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="modal-content">
          {loading ? (
            <div className="loading-state">
              <div className="loader">
                <div className="loader-ring" />
                <div className="loader-icon">🔍</div>
              </div>
              <p className="loading-text">Analyzing real-time data...</p>
              <p className="loading-subtext">Checking news, facts & market data</p>
            </div>
          ) : (
            <>
              {/* Your Choice */}
              <div className="your-choice-section">
                <span className="section-label">Your pick</span>
                <div className={`choice-badge ${userChoice}`}>
                  {userChoice.toUpperCase()}
                </div>
              </div>

              {/* Question */}
              <div className="question-section">
                <p className="question-text">{prediction.question}</p>
              </div>

              {/* AI Recommendation */}
              {factCheck && (
                <div
                  className="recommendation-card"
                  style={{
                    borderColor: recommendationConfig[factCheck.recommendation].color + '40',
                    background: recommendationConfig[factCheck.recommendation].color + '10',
                  }}
                >
                  <div className="recommendation-header">
                    <span
                      className="recommendation-icon"
                      style={{ background: recommendationConfig[factCheck.recommendation].color }}
                    >
                      {recommendationConfig[factCheck.recommendation].icon}
                    </span>
                    <div className="recommendation-info">
                      <span
                        className="recommendation-label"
                        style={{ color: recommendationConfig[factCheck.recommendation].color }}
                      >
                        {recommendationConfig[factCheck.recommendation].label}
                      </span>
                      <span className="recommendation-desc">
                        {recommendationConfig[factCheck.recommendation].description}
                      </span>
                    </div>
                    <div
                      className="confidence-badge"
                      style={{
                        background: confidenceColors[factCheck.confidence] + '20',
                        color: confidenceColors[factCheck.confidence],
                      }}
                    >
                      {factCheck.confidence}
                    </div>
                  </div>

                  {/* AI Summary */}
                  {factCheck.answer && (
                    <div className="ai-summary">
                      <span className="ai-label">AI Analysis</span>
                      <p className="ai-text">{factCheck.answer}</p>
                    </div>
                  )}

                  {/* Reasoning */}
                  <p className="recommendation-reasoning">{factCheck.reasoning}</p>
                </div>
              )}

              {/* Key Facts */}
              {factCheck && factCheck.facts.length > 0 && (
                <div className="facts-section">
                  <span className="section-label">Key Facts</span>
                  <div className="facts-list">
                    {factCheck.facts.slice(0, 4).map((fact, index) => (
                      <div key={index} className="fact-item">
                        <span className="fact-bullet">•</span>
                        <span className="fact-text">{fact}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sources */}
              {factCheck && factCheck.sources.length > 0 && (
                <div className="sources-section">
                  <span className="section-label">Sources</span>
                  <div className="sources-list">
                    {factCheck.sources.slice(0, 3).map((source, index) => (
                      <a
                        key={index}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="source-link"
                      >
                        <span className="source-icon">📰</span>
                        <span className="source-title">{source.title.slice(0, 50)}...</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Change Decision */}
              {factCheck && factCheck.recommendation !== 'proceed' && (
                <div className="change-decision-section">
                  <span className="section-label">Change your decision?</span>
                  <div className="decision-buttons">
                    <button
                      className={`decision-btn yes ${selectedChoice === 'yes' ? 'active' : ''}`}
                      onClick={() => setSelectedChoice('yes')}
                    >
                      <span className="btn-icon">✓</span>
                      YES
                    </button>
                    <button
                      className={`decision-btn no ${selectedChoice === 'no' ? 'active' : ''}`}
                      onClick={() => setSelectedChoice('no')}
                    >
                      <span className="btn-icon">✗</span>
                      NO
                    </button>
                  </div>
                </div>
              )}

              {/* Market Context */}
              <div className="market-context">
                <span className="context-label">Market odds:</span>
                <span className="context-value yes">{prediction.marketOdds}% YES</span>
                <span className="context-divider">|</span>
                <span className="context-value no">{100 - prediction.marketOdds}% NO</span>
              </div>

              {/* Error State */}
              {error && (
                <div className="error-banner">
                  <span className="error-icon">⚠️</span>
                  <span className="error-text">{error}</span>
                </div>
              )}

              {/* Actions */}
              <div className="action-buttons">
                <button className="action-btn skip" onClick={onSkip}>
                  Skip Card
                </button>
                <button
                  className={`action-btn confirm ${selectedChoice}`}
                  onClick={handleConfirm}
                >
                  {selectedChoice === userChoice ? (
                    `Confirm ${selectedChoice.toUpperCase()}`
                  ) : (
                    `Change to ${selectedChoice.toUpperCase()}`
                  )}
                </button>
              </div>
            </>
          )}
          </div>
        </animated.div>
      </div>

      <style jsx global>{`
        .fact-check-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          z-index: 9998;
        }

        .fact-check-container {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          z-index: 9999;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        .fact-check-modal {
          position: relative;
          width: 100%;
          max-width: 400px;
          max-height: calc(100vh - 32px);
          max-height: calc(100dvh - 32px);
          background: linear-gradient(180deg, #1E1E2E 0%, #12121C 100%);
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        /* Small mobile */
        @media (max-width: 380px) {
          .fact-check-container {
            padding: 12px;
          }
          .fact-check-modal {
            border-radius: 14px;
            max-height: calc(100dvh - 24px);
          }
        }

        /* Tablet */
        @media (min-width: 481px) and (max-width: 768px) {
          .fact-check-container {
            padding: 24px;
          }
          .fact-check-modal {
            max-width: 440px;
          }
        }

        /* Desktop */
        @media (min-width: 769px) {
          .fact-check-container {
            padding: 32px;
          }
          .fact-check-modal {
            max-width: 420px;
            max-height: calc(100vh - 64px);
          }
        }

        .modal-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          flex-shrink: 0;
        }

        @media (max-width: 480px) {
          .modal-header {
            padding: 14px 16px;
            gap: 10px;
          }
        }

        .header-icon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366F1, #8B5CF6);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        @media (max-width: 380px) {
          .header-icon {
            width: 32px;
            height: 32px;
          }
        }

        .header-icon svg {
          width: 20px;
          height: 20px;
          color: #fff;
        }

        @media (max-width: 380px) {
          .header-icon svg {
            width: 18px;
            height: 18px;
          }
        }

        .modal-title {
          flex: 1;
          font-size: 18px;
          font-weight: 700;
          color: #fff;
        }

        @media (max-width: 380px) {
          .modal-title {
            font-size: 16px;
          }
        }

        .close-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.2s;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .close-btn:active {
          transform: scale(0.95);
        }

        .close-btn svg {
          width: 16px;
          height: 16px;
          color: rgba(255, 255, 255, 0.6);
        }

        .modal-content {
          flex: 1;
          min-height: 0;
          padding: 16px 20px 20px;
          overflow-y: auto;
          overflow-x: hidden;
          display: flex;
          flex-direction: column;
          gap: 16px;
          -webkit-overflow-scrolling: touch;
        }

        @media (max-width: 480px) {
          .modal-content {
            padding: 14px 16px 16px;
            gap: 14px;
          }
        }

        /* Loading State */
        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          gap: 16px;
        }

        .loader {
          position: relative;
          width: 80px;
          height: 80px;
        }

        .loader-ring {
          position: absolute;
          inset: 0;
          border: 3px solid rgba(99, 102, 241, 0.2);
          border-top-color: #6366F1;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .loader-icon {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .loading-text {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
        }

        .loading-subtext {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Your Choice Section */
        .your-choice-section {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .section-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(255, 255, 255, 0.5);
        }

        .choice-badge {
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 700;
        }

        .choice-badge.yes {
          background: rgba(0, 230, 118, 0.15);
          color: #00E676;
          border: 1px solid rgba(0, 230, 118, 0.3);
        }

        .choice-badge.no {
          background: rgba(255, 82, 82, 0.15);
          color: #FF5252;
          border: 1px solid rgba(255, 82, 82, 0.3);
        }

        /* Question */
        .question-section {
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
        }

        @media (max-width: 480px) {
          .question-section {
            padding: 10px 14px;
            border-radius: 10px;
          }
        }

        .question-text {
          font-size: 15px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
          line-height: 1.4;
        }

        @media (max-width: 380px) {
          .question-text {
            font-size: 14px;
          }
        }

        /* Recommendation Card */
        .recommendation-card {
          padding: 16px;
          border-radius: 16px;
          border: 1px solid;
        }

        @media (max-width: 480px) {
          .recommendation-card {
            padding: 14px;
            border-radius: 14px;
          }
        }

        .recommendation-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        @media (max-width: 380px) {
          .recommendation-header {
            gap: 10px;
          }
        }

        .recommendation-icon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: bold;
          color: #000;
          flex-shrink: 0;
        }

        @media (max-width: 380px) {
          .recommendation-icon {
            width: 32px;
            height: 32px;
            font-size: 16px;
          }
        }

        .recommendation-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .recommendation-label {
          font-size: 14px;
          font-weight: 700;
        }

        .recommendation-desc {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }

        .confidence-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .ai-summary {
          padding: 12px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
          margin-bottom: 10px;
        }

        .ai-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(255, 255, 255, 0.4);
          display: block;
          margin-bottom: 6px;
        }

        .ai-text {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          line-height: 1.5;
        }

        .recommendation-reasoning {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.5;
        }

        /* Facts Section */
        .facts-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .facts-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .fact-item {
          display: flex;
          gap: 8px;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 10px;
        }

        .fact-bullet {
          color: #6366F1;
          font-weight: bold;
        }

        .fact-text {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.4;
        }

        /* Sources */
        .sources-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .sources-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .source-link {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          text-decoration: none;
          transition: background 0.2s;
        }

        .source-link:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .source-icon {
          font-size: 14px;
        }

        .source-title {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Change Decision */
        .change-decision-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .decision-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .decision-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          border: 2px solid transparent;
        }

        .decision-btn.yes {
          background: rgba(0, 230, 118, 0.1);
          color: rgba(0, 230, 118, 0.7);
          border-color: rgba(0, 230, 118, 0.2);
        }

        .decision-btn.yes.active {
          background: rgba(0, 230, 118, 0.2);
          color: #00E676;
          border-color: #00E676;
        }

        .decision-btn.no {
          background: rgba(255, 82, 82, 0.1);
          color: rgba(255, 82, 82, 0.7);
          border-color: rgba(255, 82, 82, 0.2);
        }

        .decision-btn.no.active {
          background: rgba(255, 82, 82, 0.2);
          color: #FF5252;
          border-color: #FF5252;
        }

        .btn-icon {
          font-size: 16px;
        }

        /* Market Context */
        .market-context {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 10px;
        }

        .context-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        .context-value {
          font-size: 13px;
          font-weight: 600;
        }

        .context-value.yes { color: #00E676; }
        .context-value.no { color: #FF5252; }

        .context-divider {
          color: rgba(255, 255, 255, 0.3);
        }

        /* Error Banner */
        .error-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: rgba(255, 193, 7, 0.1);
          border: 1px solid rgba(255, 193, 7, 0.2);
          border-radius: 10px;
        }

        .error-icon {
          font-size: 16px;
        }

        .error-text {
          font-size: 13px;
          color: #FFC107;
        }

        /* Actions */
        .action-buttons {
          display: flex;
          gap: 12px;
          margin-top: auto;
          padding-top: 8px;
          flex-shrink: 0;
        }

        @media (max-width: 480px) {
          .action-buttons {
            gap: 10px;
          }
        }

        .action-btn {
          flex: 1;
          padding: 14px 16px;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          min-height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        @media (max-width: 380px) {
          .action-btn {
            padding: 12px 14px;
            font-size: 14px;
            border-radius: 12px;
          }
        }

        .action-btn.skip {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.7);
        }

        .action-btn.skip:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .action-btn.skip:active {
          transform: scale(0.98);
        }

        .action-btn.confirm {
          border: none;
          color: #000;
        }

        .action-btn.confirm.yes {
          background: linear-gradient(135deg, #00E676, #00C853);
        }

        .action-btn.confirm.no {
          background: linear-gradient(135deg, #FF5252, #D32F2F);
          color: #fff;
        }

        .action-btn.confirm:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }

        .action-btn.confirm:active {
          transform: scale(0.98);
        }
      `}</style>
    </>
  );
}

/**
 * Analyze facts and generate recommendation
 */
function analyzeFactsForRecommendation(
  facts: string[],
  answer: string | undefined,
  marketOdds: number,
  userChoice: 'yes' | 'no',
  confidence: 'high' | 'medium' | 'low'
): {
  recommendation: 'proceed' | 'reconsider' | 'change';
  suggestedDirection: 'yes' | 'no';
  reasoning: string;
} {
  // Analyze sentiment from answer and facts
  const text = (answer || '') + ' ' + facts.join(' ');
  const lowerText = text.toLowerCase();

  // Positive indicators
  const positiveWords = ['likely', 'expected', 'confirmed', 'will', 'approved', 'passed', 'winning', 'rising', 'growth', 'increase', 'success'];
  const negativeWords = ['unlikely', 'rejected', 'failed', 'won\'t', 'declined', 'falling', 'decrease', 'loss', 'cancelled', 'delayed'];

  let positiveScore = 0;
  let negativeScore = 0;

  for (const word of positiveWords) {
    if (lowerText.includes(word)) positiveScore++;
  }
  for (const word of negativeWords) {
    if (lowerText.includes(word)) negativeScore++;
  }

  // Determine suggested direction based on analysis
  const analysisLeanYes = positiveScore > negativeScore;
  const analysisLeanNo = negativeScore > positiveScore;
  const suggestedDirection: 'yes' | 'no' = analysisLeanYes ? 'yes' : 'no';

  // Check if user's choice aligns with evidence
  const userChoseYes = userChoice === 'yes';
  const evidenceSupportsYes = analysisLeanYes || marketOdds > 60;
  const evidenceSupportsNo = analysisLeanNo || marketOdds < 40;

  let recommendation: 'proceed' | 'reconsider' | 'change';
  let reasoning: string;

  if (userChoseYes && evidenceSupportsYes) {
    recommendation = 'proceed';
    reasoning = `Evidence supports YES. Market odds are at ${marketOdds}%, and recent news analysis aligns with your choice.`;
  } else if (!userChoseYes && evidenceSupportsNo) {
    recommendation = 'proceed';
    reasoning = `Evidence supports NO. Market odds show ${100 - marketOdds}% for NO, and recent analysis aligns with your choice.`;
  } else if (confidence === 'low' || (positiveScore === 0 && negativeScore === 0)) {
    recommendation = 'proceed';
    reasoning = 'Limited data available for verification. Your choice is as good as any based on current information.';
  } else if (userChoseYes && evidenceSupportsNo) {
    recommendation = 'reconsider';
    reasoning = `Recent evidence may lean towards NO. Market odds are at ${marketOdds}% for YES. Consider reviewing the facts before confirming.`;
  } else if (!userChoseYes && evidenceSupportsYes) {
    recommendation = 'reconsider';
    reasoning = `Recent evidence may lean towards YES. Market odds are at ${marketOdds}% for YES. Consider reviewing the facts before confirming.`;
  } else {
    recommendation = 'proceed';
    reasoning = 'Evidence is mixed. Your informed judgment is valuable here.';
  }

  return { recommendation, suggestedDirection, reasoning };
}
