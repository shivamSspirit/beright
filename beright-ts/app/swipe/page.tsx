'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// =============================================================================
// TYPES
// =============================================================================

interface Market {
  id: string;
  question: string;
  platform: string;
  yesPrice: number;
  volume: number;
  url?: string;
  category?: string;
  endDate?: string;
  participants?: number;
}

interface FactCheckInsight {
  summary: string;
  supportingFacts: string[];
  challengingFacts: string[];
  recommendation: 'CONFIRMS' | 'CHALLENGES' | 'NEUTRAL';
  confidence: 'low' | 'medium' | 'high';
  sources: Array<{ title: string; url: string }>;
  aiAnalysis: string;
}

interface SwipeState {
  currentIndex: number;
  markets: Market[];
  isLoading: boolean;
  factCheckResult: FactCheckInsight | null;
  isFactChecking: boolean;
  pendingChoice: 'YES' | 'NO' | null;
  showConfirmation: boolean;
}

// =============================================================================
// SWIPE CARD COMPONENT
// =============================================================================

interface SwipeCardProps {
  market: Market;
  onSwipe: (direction: 'YES' | 'NO') => void;
  isActive: boolean;
}

function SwipeCard({ market, onSwipe, isActive }: SwipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isActive) return;
    const point = 'touches' in e ? e.touches[0] : e;
    setDragStart({ x: point.clientX, y: point.clientY });
    setIsDragging(true);
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragStart || !isDragging) return;
    const point = 'touches' in e ? e.touches[0] : e;
    const offsetX = point.clientX - dragStart.x;
    const offsetY = point.clientY - dragStart.y;
    setDragOffset({ x: offsetX, y: offsetY });
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = 100;
    if (dragOffset.x > threshold) {
      onSwipe('YES');
    } else if (dragOffset.x < -threshold) {
      onSwipe('NO');
    }

    setDragStart(null);
    setDragOffset({ x: 0, y: 0 });
  };

  const rotation = dragOffset.x * 0.1;
  const opacity = Math.max(0.5, 1 - Math.abs(dragOffset.x) / 300);

  // Format volume
  const formatVolume = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  };

  // Platform colors
  const platformColors: Record<string, string> = {
    polymarket: '#7C3AED',
    kalshi: '#F97316',
    manifold: '#10B981',
    metaculus: '#3B82F6',
    jupiter: '#9333EA',
  };

  const platformColor = platformColors[market.platform?.toLowerCase()] || '#6B7280';

  return (
    <div
      ref={cardRef}
      className={`swipe-card ${isActive ? 'active' : 'stacked'}`}
      style={{
        transform: isActive
          ? `translateX(${dragOffset.x}px) translateY(${dragOffset.y * 0.3}px) rotate(${rotation}deg)`
          : 'scale(0.95) translateY(20px)',
        opacity: isActive ? opacity : 0.7,
        zIndex: isActive ? 10 : 1,
        cursor: isActive ? 'grab' : 'default',
      }}
      onMouseDown={handleDragStart}
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
      onTouchStart={handleDragStart}
      onTouchMove={handleDragMove}
      onTouchEnd={handleDragEnd}
    >
      {/* Swipe indicators */}
      {isActive && dragOffset.x !== 0 && (
        <>
          {dragOffset.x > 50 && (
            <div className="swipe-indicator yes">
              <span>YES</span>
            </div>
          )}
          {dragOffset.x < -50 && (
            <div className="swipe-indicator no">
              <span>NO</span>
            </div>
          )}
        </>
      )}

      {/* Platform badge */}
      <div className="card-platform" style={{ backgroundColor: platformColor }}>
        {market.platform?.toUpperCase()}
      </div>

      {/* Main content */}
      <div className="card-content">
        <h2 className="card-question">{market.question}</h2>

        {/* Probability bar */}
        <div className="card-probability">
          <div className="probability-bar">
            <div
              className="probability-fill"
              style={{ width: `${market.yesPrice * 100}%` }}
            />
          </div>
          <div className="probability-labels">
            <span className="yes-label">{(market.yesPrice * 100).toFixed(0)}% YES</span>
            <span className="no-label">{((1 - market.yesPrice) * 100).toFixed(0)}% NO</span>
          </div>
        </div>

        {/* Stats */}
        <div className="card-stats">
          <div className="stat">
            <span className="stat-label">Volume</span>
            <span className="stat-value">{formatVolume(market.volume || 0)}</span>
          </div>
          {market.participants && (
            <div className="stat">
              <span className="stat-label">Traders</span>
              <span className="stat-value">{market.participants.toLocaleString()}</span>
            </div>
          )}
          {market.category && (
            <div className="stat">
              <span className="stat-label">Category</span>
              <span className="stat-value">{market.category}</span>
            </div>
          )}
        </div>
      </div>

      {/* Swipe buttons */}
      {isActive && (
        <div className="card-actions">
          <button
            className="swipe-btn no-btn"
            onClick={(e) => { e.stopPropagation(); onSwipe('NO'); }}
          >
            <span>NO</span>
          </button>
          <button
            className="swipe-btn yes-btn"
            onClick={(e) => { e.stopPropagation(); onSwipe('YES'); }}
          >
            <span>YES</span>
          </button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// FACT CHECK MODAL
// =============================================================================

interface FactCheckModalProps {
  market: Market;
  userChoice: 'YES' | 'NO';
  insight: FactCheckInsight | null;
  isLoading: boolean;
  onConfirm: () => void;
  onChangeDecision: () => void;
  onClose: () => void;
}

function FactCheckModal({
  market,
  userChoice,
  insight,
  isLoading,
  onConfirm,
  onChangeDecision,
  onClose,
}: FactCheckModalProps) {
  const recommendationColors = {
    CONFIRMS: '#10B981',
    CHALLENGES: '#EF4444',
    NEUTRAL: '#6B7280',
  };

  const confidenceColors = {
    high: '#10B981',
    medium: '#F59E0B',
    low: '#6B7280',
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h3>AI Fact-Check</h3>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>

        {/* User choice */}
        <div className="modal-choice">
          <span>Your choice:</span>
          <span className={`choice-badge ${userChoice.toLowerCase()}`}>{userChoice}</span>
        </div>

        {/* Market question */}
        <p className="modal-question">{market.question}</p>

        {/* Loading state */}
        {isLoading && (
          <div className="modal-loading">
            <div className="spinner" />
            <p>AI is searching for facts...</p>
          </div>
        )}

        {/* Insight */}
        {insight && !isLoading && (
          <div className="modal-insight">
            {/* Summary */}
            <div className="insight-summary">
              <p>{insight.summary}</p>
            </div>

            {/* Recommendation badge */}
            <div
              className="insight-recommendation"
              style={{ backgroundColor: recommendationColors[insight.recommendation] }}
            >
              AI {insight.recommendation === 'CONFIRMS' ? 'supports' : insight.recommendation === 'CHALLENGES' ? 'challenges' : 'is neutral on'} your {userChoice}
              <span className="confidence" style={{ color: confidenceColors[insight.confidence] }}>
                ({insight.confidence} confidence)
              </span>
            </div>

            {/* Supporting facts */}
            {insight.supportingFacts.length > 0 && (
              <div className="fact-section supporting">
                <h4>Supporting Facts</h4>
                <ul>
                  {insight.supportingFacts.map((fact, i) => (
                    <li key={i}>{fact}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Challenging facts */}
            {insight.challengingFacts.length > 0 && (
              <div className="fact-section challenging">
                <h4>Challenging Facts</h4>
                <ul>
                  {insight.challengingFacts.map((fact, i) => (
                    <li key={i}>{fact}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* AI Analysis */}
            <div className="insight-analysis">
              <h4>AI Analysis</h4>
              <p>{insight.aiAnalysis}</p>
            </div>

            {/* Sources */}
            {insight.sources.length > 0 && (
              <div className="insight-sources">
                <h4>Sources</h4>
                <ul>
                  {insight.sources.slice(0, 3).map((source, i) => (
                    <li key={i}>
                      <a href={source.url} target="_blank" rel="noopener noreferrer">
                        {source.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onChangeDecision}>
            Change Decision
          </button>
          <button className="btn-primary" onClick={onConfirm}>
            Confirm {userChoice}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN SWIPE PAGE
// =============================================================================

export default function SwipePage() {
  const [state, setState] = useState<SwipeState>({
    currentIndex: 0,
    markets: [],
    isLoading: true,
    factCheckResult: null,
    isFactChecking: false,
    pendingChoice: null,
    showConfirmation: false,
  });

  // Fetch markets on mount
  useEffect(() => {
    fetchMarkets();
  }, []);

  const fetchMarkets = async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      const res = await fetch('/api/v2/markets/trending?limit=20');
      if (!res.ok) throw new Error('Failed to fetch markets');

      const data = await res.json();
      const markets: Market[] = (data.data || data.markets || []).map((m: any) => ({
        id: m.id || m.marketId || `market-${Date.now()}`,
        question: m.title || m.question || 'Unknown Market',
        platform: m.platform || 'unknown',
        yesPrice: m.yesPrice || m.probability || 0.5,
        volume: m.volume || 0,
        url: m.url,
        category: m.category,
        participants: m.uniqueTraders || m.participants,
      }));

      setState((prev) => ({
        ...prev,
        markets,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to fetch markets:', error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  // Handle swipe
  const handleSwipe = useCallback(async (choice: 'YES' | 'NO') => {
    const currentMarket = state.markets[state.currentIndex];
    if (!currentMarket) return;

    // Set pending choice and trigger fact-check
    setState((prev) => ({
      ...prev,
      pendingChoice: choice,
      isFactChecking: true,
      showConfirmation: true,
      factCheckResult: null,
    }));

    // Call fact-check API
    try {
      const res = await fetch('/api/v2/fact-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: currentMarket.id,
          question: currentMarket.question,
          userChoice: choice,
          currentProbability: currentMarket.yesPrice,
          platform: currentMarket.platform,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          factCheckResult: data.data?.insight || null,
          isFactChecking: false,
        }));
      } else {
        throw new Error('Fact-check failed');
      }
    } catch (error) {
      console.error('Fact-check error:', error);
      setState((prev) => ({
        ...prev,
        isFactChecking: false,
        factCheckResult: {
          summary: 'Unable to fetch AI insights. Make your decision based on available data.',
          supportingFacts: [],
          challengingFacts: [],
          recommendation: 'NEUTRAL',
          confidence: 'low',
          sources: [],
          aiAnalysis: 'AI fact-checking is temporarily unavailable.',
        },
      }));
    }
  }, [state.currentIndex, state.markets]);

  // Confirm prediction
  const handleConfirm = useCallback(() => {
    const currentMarket = state.markets[state.currentIndex];

    // In a real implementation, this would submit the prediction
    console.log('Prediction confirmed:', {
      market: currentMarket,
      choice: state.pendingChoice,
    });

    // Move to next card
    setState((prev) => ({
      ...prev,
      currentIndex: prev.currentIndex + 1,
      showConfirmation: false,
      pendingChoice: null,
      factCheckResult: null,
    }));
  }, [state.currentIndex, state.markets, state.pendingChoice]);

  // Change decision (go back to swiping)
  const handleChangeDecision = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showConfirmation: false,
      pendingChoice: null,
      factCheckResult: null,
      isFactChecking: false,
    }));
  }, []);

  // Close modal
  const handleCloseModal = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showConfirmation: false,
    }));
  }, []);

  const currentMarket = state.markets[state.currentIndex];
  const nextMarket = state.markets[state.currentIndex + 1];

  return (
    <div className="swipe-container">
      {/* Header */}
      <header className="swipe-header">
        <h1>BeRight</h1>
        <p>Swipe to predict. AI verifies.</p>
      </header>

      {/* Loading state */}
      {state.isLoading && (
        <div className="swipe-loading">
          <div className="spinner" />
          <p>Loading markets...</p>
        </div>
      )}

      {/* No more cards */}
      {!state.isLoading && !currentMarket && (
        <div className="swipe-empty">
          <h2>No more markets</h2>
          <p>Check back later for new prediction opportunities.</p>
          <button onClick={fetchMarkets}>Refresh</button>
        </div>
      )}

      {/* Card stack */}
      {!state.isLoading && currentMarket && (
        <div className="card-stack">
          {nextMarket && (
            <SwipeCard
              key={nextMarket.id}
              market={nextMarket}
              onSwipe={() => {}}
              isActive={false}
            />
          )}
          <SwipeCard
            key={currentMarket.id}
            market={currentMarket}
            onSwipe={handleSwipe}
            isActive={!state.showConfirmation}
          />
        </div>
      )}

      {/* Progress indicator */}
      {!state.isLoading && state.markets.length > 0 && (
        <div className="swipe-progress">
          <span>{state.currentIndex + 1} / {state.markets.length}</span>
        </div>
      )}

      {/* Fact-check modal */}
      {state.showConfirmation && currentMarket && state.pendingChoice && (
        <FactCheckModal
          market={currentMarket}
          userChoice={state.pendingChoice}
          insight={state.factCheckResult}
          isLoading={state.isFactChecking}
          onConfirm={handleConfirm}
          onChangeDecision={handleChangeDecision}
          onClose={handleCloseModal}
        />
      )}

      {/* Styles */}
      <style jsx>{`
        .swipe-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%);
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .swipe-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .swipe-header h1 {
          font-size: 2rem;
          color: #10b981;
          margin: 0;
        }

        .swipe-header p {
          color: #6b7280;
          margin: 5px 0 0;
        }

        .swipe-loading, .swipe-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 60vh;
          color: #9ca3af;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #374151;
          border-top-color: #10b981;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .swipe-empty button {
          margin-top: 20px;
          padding: 10px 30px;
          background: #10b981;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }

        .card-stack {
          position: relative;
          width: 100%;
          max-width: 400px;
          height: 500px;
        }

        .swipe-card {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          width: 100%;
          height: 100%;
          background: #1f2937;
          border-radius: 20px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          overflow: hidden;
          user-select: none;
          transition: transform 0.1s, opacity 0.1s;
        }

        .swipe-card.stacked {
          pointer-events: none;
        }

        .swipe-indicator {
          position: absolute;
          top: 20px;
          padding: 8px 20px;
          border-radius: 8px;
          font-weight: bold;
          font-size: 1.5rem;
          z-index: 20;
          border: 3px solid;
        }

        .swipe-indicator.yes {
          right: 20px;
          color: #10b981;
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.1);
        }

        .swipe-indicator.no {
          left: 20px;
          color: #ef4444;
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }

        .card-platform {
          position: absolute;
          top: 15px;
          left: 15px;
          padding: 5px 12px;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: bold;
          color: white;
          text-transform: uppercase;
        }

        .card-content {
          padding: 60px 20px 20px;
          height: calc(100% - 80px);
          display: flex;
          flex-direction: column;
        }

        .card-question {
          font-size: 1.3rem;
          color: white;
          margin: 0 0 20px;
          line-height: 1.4;
          flex-grow: 1;
        }

        .card-probability {
          margin-bottom: 20px;
        }

        .probability-bar {
          height: 12px;
          background: #374151;
          border-radius: 6px;
          overflow: hidden;
        }

        .probability-fill {
          height: 100%;
          background: linear-gradient(90deg, #10b981, #34d399);
          transition: width 0.3s;
        }

        .probability-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 8px;
          font-size: 0.9rem;
        }

        .yes-label { color: #10b981; }
        .no-label { color: #ef4444; }

        .card-stats {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }

        .stat {
          display: flex;
          flex-direction: column;
        }

        .stat-label {
          font-size: 0.7rem;
          color: #6b7280;
          text-transform: uppercase;
        }

        .stat-value {
          font-size: 1rem;
          color: white;
          font-weight: 600;
        }

        .card-actions {
          position: absolute;
          bottom: 20px;
          left: 20px;
          right: 20px;
          display: flex;
          justify-content: space-between;
          gap: 20px;
        }

        .swipe-btn {
          flex: 1;
          padding: 15px;
          border: none;
          border-radius: 12px;
          font-size: 1.1rem;
          font-weight: bold;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .swipe-btn:hover {
          transform: scale(1.05);
        }

        .yes-btn {
          background: linear-gradient(135deg, #10b981, #34d399);
          color: white;
        }

        .no-btn {
          background: linear-gradient(135deg, #ef4444, #f87171);
          color: white;
        }

        .swipe-progress {
          margin-top: 20px;
          color: #6b7280;
          font-size: 0.9rem;
        }

        /* Modal styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 20px;
        }

        .modal-content {
          background: #1f2937;
          border-radius: 16px;
          max-width: 500px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          padding: 20px;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .modal-header h3 {
          color: white;
          margin: 0;
        }

        .modal-close {
          background: none;
          border: none;
          color: #6b7280;
          font-size: 1.5rem;
          cursor: pointer;
        }

        .modal-choice {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
          color: #9ca3af;
        }

        .choice-badge {
          padding: 4px 12px;
          border-radius: 6px;
          font-weight: bold;
        }

        .choice-badge.yes {
          background: #10b981;
          color: white;
        }

        .choice-badge.no {
          background: #ef4444;
          color: white;
        }

        .modal-question {
          color: white;
          font-size: 1.1rem;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid #374151;
        }

        .modal-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 0;
          color: #9ca3af;
        }

        .modal-insight {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .insight-summary {
          background: #374151;
          padding: 12px;
          border-radius: 8px;
          color: white;
        }

        .insight-recommendation {
          padding: 12px;
          border-radius: 8px;
          color: white;
          text-align: center;
          font-weight: 500;
        }

        .insight-recommendation .confidence {
          display: block;
          font-size: 0.8rem;
          margin-top: 5px;
        }

        .fact-section {
          background: #374151;
          padding: 12px;
          border-radius: 8px;
        }

        .fact-section h4 {
          margin: 0 0 10px;
          font-size: 0.9rem;
        }

        .fact-section.supporting h4 { color: #10b981; }
        .fact-section.challenging h4 { color: #ef4444; }

        .fact-section ul {
          margin: 0;
          padding-left: 20px;
          color: #d1d5db;
        }

        .fact-section li {
          margin-bottom: 5px;
          font-size: 0.9rem;
        }

        .insight-analysis {
          background: #374151;
          padding: 12px;
          border-radius: 8px;
        }

        .insight-analysis h4 {
          color: #9ca3af;
          margin: 0 0 8px;
          font-size: 0.9rem;
        }

        .insight-analysis p {
          color: #d1d5db;
          margin: 0;
          font-size: 0.9rem;
        }

        .insight-sources {
          font-size: 0.8rem;
        }

        .insight-sources h4 {
          color: #6b7280;
          margin: 0 0 8px;
        }

        .insight-sources ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .insight-sources a {
          color: #60a5fa;
          text-decoration: none;
        }

        .insight-sources a:hover {
          text-decoration: underline;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 20px;
          padding-top: 15px;
          border-top: 1px solid #374151;
        }

        .btn-primary, .btn-secondary {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-primary {
          background: #10b981;
          color: white;
        }

        .btn-secondary {
          background: #374151;
          color: white;
        }
      `}</style>
    </div>
  );
}
