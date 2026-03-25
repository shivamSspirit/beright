'use client';

import { useState, useCallback } from 'react';
import styles from './InsightCard.module.css';

// ============================================
// TYPES
// ============================================

export interface MarketInsight {
  marketId: string;
  question: string;
  aiProbability: number;
  marketPrice: number;
  edge: number;
  direction: 'YES' | 'NO';
  verdict: string;
  confidence: 'low' | 'medium' | 'high';
  bullishFactors: string[];
  bearishFactors: string[];
  methodology: string;
}

export interface InsightCardProps {
  marketId: string;
  marketQuestion: string;
  currentPrice: number;
  insight: MarketInsight | null;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
}

// ============================================
// COMPONENT
// ============================================

export function InsightCard({
  marketId,
  marketQuestion,
  currentPrice,
  insight,
  isLoading,
  error,
  onRetry,
}: InsightCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleExpand = useCallback(() => {
    if (insight && !isLoading && !error) {
      setIsExpanded(true);
    }
  }, [insight, isLoading, error]);

  const handleClose = useCallback(() => {
    setIsExpanded(false);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.insightCard}>
        <div className={styles.header}>
          <span className={styles.aiIcon}>🤖</span>
          <span className={styles.headerText}>AI INSIGHT</span>
          <span className={styles.loadingDot} />
        </div>
        <div className={styles.content}>
          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <div className={`${styles.skeleton} ${styles.skeletonValue}`} />
              <span className={styles.statLabel}>AI Est.</span>
            </div>
            <div className={styles.stat}>
              <div className={`${styles.skeleton} ${styles.skeletonValue}`} />
              <span className={styles.statLabel}>Market</span>
            </div>
            <div className={styles.stat}>
              <div className={`${styles.skeleton} ${styles.skeletonValue}`} />
              <span className={styles.statLabel}>Edge</span>
            </div>
          </div>
          <div className={`${styles.skeleton} ${styles.skeletonVerdict}`} />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={styles.insightCard}>
        <div className={styles.header}>
          <span className={styles.aiIcon}>🤖</span>
          <span className={styles.headerText}>AI INSIGHT</span>
        </div>
        <div className={styles.errorContent}>
          <span className={styles.errorText}>Unable to load AI insight</span>
          {onRetry && (
            <button className={styles.retryButton} onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  // No insight yet
  if (!insight) {
    return (
      <div className={styles.insightCard}>
        <div className={styles.header}>
          <span className={styles.aiIcon}>🤖</span>
          <span className={styles.headerText}>AI INSIGHT</span>
        </div>
        <div className={styles.content}>
          <span className={styles.noDataText}>Tap to analyze</span>
        </div>
      </div>
    );
  }

  // Format values
  const aiPct = (insight.aiProbability * 100).toFixed(0);
  const marketPct = (insight.marketPrice * 100).toFixed(0);
  const edgePct = insight.edge > 0
    ? `+${(insight.edge * 100).toFixed(0)}`
    : (insight.edge * 100).toFixed(0);
  const edgeClass = insight.edge > 0.03
    ? styles.edgePositive
    : insight.edge < -0.03
      ? styles.edgeNegative
      : styles.edgeNeutral;

  const confidenceClass = {
    low: styles.confidenceLow,
    medium: styles.confidenceMedium,
    high: styles.confidenceHigh,
  }[insight.confidence];

  return (
    <>
      {/* Inline Card */}
      <div
        className={styles.insightCard}
        onClick={handleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleExpand()}
      >
        <div className={styles.header}>
          <span className={styles.aiIcon}>🤖</span>
          <span className={styles.headerText}>AI INSIGHT</span>
          <span className={`${styles.confidenceBadge} ${confidenceClass}`}>
            {insight.confidence.toUpperCase()}
          </span>
        </div>
        <div className={styles.content}>
          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{aiPct}%</span>
              <span className={styles.statLabel}>AI Est.</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{marketPct}%</span>
              <span className={styles.statLabel}>Market</span>
            </div>
            <div className={styles.stat}>
              <span className={`${styles.statValue} ${edgeClass}`}>{edgePct}%</span>
              <span className={styles.statLabel}>Edge</span>
            </div>
          </div>
          <div className={styles.verdictRow}>
            <span className={`${styles.verdictDot} ${edgeClass}`} />
            <span className={styles.verdictText}>{insight.verdict}</span>
          </div>
          <div className={styles.tapHint}>
            <span>👆 Tap for details</span>
          </div>
        </div>
      </div>

      {/* Expanded Modal */}
      {isExpanded && (
        <div className={styles.modalOverlay} onClick={handleClose}>
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <span className={styles.aiIcon}>🤖</span>
                <span>AI ANALYSIS</span>
              </div>
              <button className={styles.closeButton} onClick={handleClose}>
                ✕
              </button>
            </div>

            <div className={styles.modalContent}>
              {/* Stats */}
              <div className={styles.modalStats}>
                <div className={styles.modalStat}>
                  <span className={styles.modalStatValue}>{aiPct}%</span>
                  <span className={styles.modalStatLabel}>AI Estimate</span>
                </div>
                <div className={styles.modalStat}>
                  <span className={styles.modalStatValue}>{marketPct}%</span>
                  <span className={styles.modalStatLabel}>Market Price</span>
                </div>
                <div className={styles.modalStat}>
                  <span className={`${styles.modalStatValue} ${edgeClass}`}>{edgePct}%</span>
                  <span className={styles.modalStatLabel}>Edge</span>
                </div>
              </div>

              <div className={styles.divider} />

              {/* Verdict */}
              <div className={styles.verdictSection}>
                <div className={styles.verdictLabel}>Verdict</div>
                <div className={styles.verdictValue}>{insight.verdict}</div>
                <div className={`${styles.confidenceTag} ${confidenceClass}`}>
                  Confidence: {insight.confidence.toUpperCase()}
                </div>
              </div>

              <div className={styles.divider} />

              {/* Bullish Factors */}
              {insight.bullishFactors.length > 0 && (
                <div className={styles.factorsSection}>
                  <div className={styles.factorsHeader}>
                    <span className={styles.bullishIcon}>✓</span>
                    <span>BULLISH FACTORS</span>
                  </div>
                  <ul className={styles.factorsList}>
                    {insight.bullishFactors.map((factor, idx) => (
                      <li key={idx} className={styles.factorItem}>
                        <span className={styles.bulletBullish}>•</span>
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Bearish Factors */}
              {insight.bearishFactors.length > 0 && (
                <div className={styles.factorsSection}>
                  <div className={styles.factorsHeader}>
                    <span className={styles.bearishIcon}>✗</span>
                    <span>BEARISH FACTORS</span>
                  </div>
                  <ul className={styles.factorsList}>
                    {insight.bearishFactors.map((factor, idx) => (
                      <li key={idx} className={styles.factorItem}>
                        <span className={styles.bulletBearish}>•</span>
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className={styles.divider} />

              {/* Methodology */}
              <div className={styles.methodology}>
                Based on {insight.methodology}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default InsightCard;
