'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCrossOddsArbitrage, ArbOpportunity } from '@/lib/api';
import styles from './ArbFeed.module.css';

interface ArbOpportunitiesFeedProps {
  minProfit?: number;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

/**
 * ArbOpportunitiesFeed - BeRight-style arbitrage scanner
 * Unique design focused on actionable opportunities
 */
export default function ArbOpportunitiesFeed({
  minProfit = 2,
  limit = 10,
  autoRefresh = true,
  refreshInterval = 30000,
}: ArbOpportunitiesFeedProps) {
  const [opportunities, setOpportunities] = useState<ArbOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [meta, setMeta] = useState<{
    totalScanned: number;
    pairsEvaluated: number;
    scanDurationMs: number;
    platforms: string[];
    source: 'demo' | 'live';
  } | null>(null);

  const fetchOpportunities = useCallback(async () => {
    try {
      setError(null);
      const response = await getCrossOddsArbitrage({ minProfit, limit });

      if (response.success) {
        setOpportunities(response.data.opportunities);
        setMeta({
          ...response.data.meta,
          source: response.meta.source,
        });
        setLastUpdated(new Date());
      } else {
        setError('Failed to fetch opportunities');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [minProfit, limit]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchOpportunities, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchOpportunities]);

  // Loading state
  if (loading && opportunities.length === 0) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.scannerIcon}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeDasharray="4 4" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
        <p className={styles.loadingText}>Scanning markets...</p>
        <p className={styles.loadingSubtext}>Analyzing price discrepancies</p>
      </div>
    );
  }

  // Error state
  if (error && opportunities.length === 0) {
    return (
      <div className={styles.errorState}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <p className={styles.errorText}>{error}</p>
        <button className={styles.retryBtn} onClick={fetchOpportunities}>
          Retry Scan
        </button>
      </div>
    );
  }

  const bestProfit = opportunities.length > 0
    ? Math.max(...opportunities.map(o => o.trade.profitPercent))
    : 0;
  const avgProfit = opportunities.length > 0
    ? opportunities.reduce((sum, o) => sum + o.trade.profitPercent, 0) / opportunities.length
    : 0;

  return (
    <div className={styles.arbFeed}>
      {/* Scanner Header */}
      <div className={styles.scannerHeader}>
        <div className={styles.scannerTitle}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <span>Arbitrage Scanner</span>
          {meta?.source === 'demo' && <span className={styles.demoBadge}>DEMO</span>}
        </div>
        <div className={styles.scannerMeta}>
          {meta && (
            <span className={styles.scanInfo}>
              {meta.totalScanned} markets scanned
            </span>
          )}
          <button
            className={`${styles.refreshBtn} ${loading ? styles.refreshBtnLoading : ''}`}
            onClick={fetchOpportunities}
            disabled={loading}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {opportunities.length > 0 && (
        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{opportunities.length}</span>
            <span className={styles.statLabel}>Active</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={`${styles.statValue} ${styles.statValueGreen}`}>
              +{bestProfit.toFixed(1)}%
            </span>
            <span className={styles.statLabel}>Best</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={styles.statValue}>+{avgProfit.toFixed(1)}%</span>
            <span className={styles.statLabel}>Avg</span>
          </div>
          {lastUpdated && (
            <>
              <div className={styles.statDivider} />
              <div className={styles.statItem}>
                <span className={styles.statValueSmall}>
                  {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={styles.statLabel}>Updated</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Opportunities List */}
      {opportunities.length === 0 ? (
        <div className={styles.emptyState}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12h8M12 8v8" />
          </svg>
          <h3>No Opportunities Found</h3>
          <p>Markets are efficiently priced. Check back soon.</p>
          <span className={styles.refreshNote}>
            Auto-refreshing every {refreshInterval / 1000}s
          </span>
        </div>
      ) : (
        <div className={styles.opportunitiesList}>
          {opportunities.map((opp) => (
            <ArbCard
              key={opp.id}
              opportunity={opp}
              isExpanded={expandedId === opp.id}
              onToggle={() => setExpandedId(expandedId === opp.id ? null : opp.id)}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className={styles.feedFooter}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
        <span>Verify prices before executing. Prices shown at scan time.</span>
      </div>
    </div>
  );
}

/**
 * ArbCard - Individual arbitrage opportunity card
 */
function ArbCard({
  opportunity,
  isExpanded,
  onToggle,
}: {
  opportunity: ArbOpportunity;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { trade, market, risk, sizing } = opportunity;
  const [positionSize, setPositionSize] = useState(sizing.recommended);
  const calculatedProfit = (positionSize * trade.profitPercent / 100).toFixed(2);

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return '#10B981';
      case 'good': return '#3B82F6';
      case 'fair': return '#F59E0B';
      default: return '#EF4444';
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return '#10B981';
      case 'medium': return '#F59E0B';
      default: return '#EF4444';
    }
  };

  return (
    <div
      className={`${styles.arbCard} ${isExpanded ? styles.arbCardExpanded : ''}`}
      style={{ '--quality-color': getQualityColor(opportunity.quality) } as React.CSSProperties}
    >
      {/* Card Header */}
      <div className={styles.arbCardHeader} onClick={onToggle}>
        <div className={styles.arbCardLeft}>
          <div className={styles.profitBadge}>
            <span className={styles.profitValue}>+{trade.profitPercent.toFixed(1)}%</span>
            <span className={styles.profitLabel}>profit</span>
          </div>
          <div className={styles.qualityIndicator}>
            <span
              className={styles.qualityDot}
              style={{ background: getQualityColor(opportunity.quality) }}
            />
            <span className={styles.qualityText}>{opportunity.quality}</span>
          </div>
        </div>
        <div className={styles.arbCardRight}>
          <span className={styles.categoryTag}>{market.category}</span>
          <svg
            className={`${styles.expandIcon} ${isExpanded ? styles.expandIconRotated : ''}`}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>

      {/* Question */}
      <div className={styles.arbQuestion}>{market.question}</div>

      {/* Trade Legs Summary */}
      <div className={styles.tradeLegs}>
        <div className={styles.tradeLeg}>
          <span className={styles.legPlatform}>{trade.leg1.platformDisplayName}</span>
          <span className={styles.legAction}>
            Buy <span className={trade.leg1.side === 'YES' ? styles.sideYes : styles.sideNo}>
              {trade.leg1.side}
            </span>
          </span>
          <span className={styles.legPrice}>{trade.leg1.priceDisplay}</span>
        </div>
        <div className={styles.legConnector}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </svg>
        </div>
        <div className={styles.tradeLeg}>
          <span className={styles.legPlatform}>{trade.leg2.platformDisplayName}</span>
          <span className={styles.legAction}>
            Buy <span className={trade.leg2.side === 'YES' ? styles.sideYes : styles.sideNo}>
              {trade.leg2.side}
            </span>
          </span>
          <span className={styles.legPrice}>{trade.leg2.priceDisplay}</span>
        </div>
      </div>

      {/* Cost Summary */}
      <div className={styles.costSummary}>
        <div className={styles.costItem}>
          <span className={styles.costLabel}>Cost</span>
          <span className={styles.costValue}>{trade.totalCostDisplay}</span>
        </div>
        <div className={styles.costArrow}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
        <div className={styles.costItem}>
          <span className={styles.costLabel}>Return</span>
          <span className={styles.costValue}>$1.00</span>
        </div>
        <div className={styles.costArrow}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
        <div className={styles.costItem}>
          <span className={styles.costLabel}>Profit</span>
          <span className={styles.costValueGreen}>{trade.profitDisplay}</span>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className={styles.expandedContent}>
          {/* Risk Section */}
          <div className={styles.riskSection}>
            <div className={styles.sectionHeader}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v2M12 15h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              </svg>
              <span>Risk Assessment</span>
            </div>
            <div className={styles.riskDetails}>
              <div className={styles.riskBadge} style={{ color: getRiskColor(risk.level) }}>
                {risk.level.toUpperCase()} RISK
              </div>
              <span className={styles.riskScore}>Score: {risk.score}/100</span>
              <span className={styles.gradeTag}>Grade {opportunity.confidenceGrade}</span>
            </div>
            {risk.executionWarnings.length > 0 && (
              <ul className={styles.warningList}>
                {risk.executionWarnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Calculator Section */}
          <div className={styles.calculatorSection}>
            <div className={styles.sectionHeader}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <line x1="8" y1="6" x2="16" y2="6" />
                <line x1="8" y1="10" x2="16" y2="10" />
                <line x1="8" y1="14" x2="12" y2="14" />
                <line x1="8" y1="18" x2="12" y2="18" />
              </svg>
              <span>Profit Calculator</span>
            </div>
            <div className={styles.calculatorRow}>
              <div className={styles.inputGroup}>
                <label>Position Size (USD)</label>
                <input
                  type="number"
                  value={positionSize}
                  onChange={(e) => setPositionSize(Number(e.target.value))}
                  min={sizing.minimum}
                  max={sizing.maximum}
                  className={styles.sizeInput}
                />
              </div>
              <div className={styles.profitResult}>
                <span className={styles.profitResultLabel}>Profit</span>
                <span className={styles.profitResultValue}>${calculatedProfit}</span>
              </div>
            </div>
            <div className={styles.sizingHint}>
              Recommended: ${sizing.recommended} | Max: ${sizing.maximum}
            </div>
          </div>

          {/* Trade Buttons */}
          <div className={styles.tradeButtons}>
            <a
              href={trade.leg1.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.tradeBtn}
            >
              Trade on {trade.leg1.platformDisplayName}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
            <a
              href={trade.leg2.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.tradeBtn}
            >
              Trade on {trade.leg2.platformDisplayName}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>

          {/* Meta Footer */}
          <div className={styles.metaFooter}>
            <span>Detected: {new Date(opportunity.detectedAt).toLocaleTimeString()}</span>
            <span>Age: {opportunity.priceAge}s</span>
          </div>
        </div>
      )}
    </div>
  );
}
