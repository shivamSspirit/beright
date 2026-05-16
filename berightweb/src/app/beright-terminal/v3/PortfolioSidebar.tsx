'use client';

import { useMemo } from 'react';
import { ApiMarket } from '@/lib/api';
import { LiveSignal } from '@/hooks/useSignalStream';
import styles from '../beright.module.css';

interface RiskSummary {
  tradingAllowed?: boolean;
  exposure?: {
    utilizationPct?: number;
    current?: number;
    limit?: number;
  };
  dailyStatus?: {
    currentLoss?: number;
    remainingLossAllowance?: number;
  };
  alerts?: {
    unacknowledged?: number;
    critical?: number;
  };
}

interface PortfolioSidebarProps {
  signals?: LiveSignal[];
  featuredMarket?: ApiMarket | null;
  portfolioValue?: number;
  dailyChange?: number;
  dailyChangePercent?: number;
  openPositions?: number;
  marketExposure?: number;
  tradingAllowed?: boolean;
  risk?: RiskSummary | null;
  dataFreshnessLabel?: string;
  researchAggregation?: {
    query: string;
    marketCount: number;
    articleCount: number;
    postCount: number;
    markets: Array<{
      marketId: string | null;
      platform: string;
      question: string;
      yesPct?: number;
      volume: number;
      liquidity: number;
      url: string;
    }>;
  } | null;
}

interface SignalRow {
  id: string;
  time: string;
  type: string;
  message: string;
  freshness: string;
}

export default function PortfolioSidebar({
  signals = [],
  featuredMarket,
  portfolioValue,
  dailyChange,
  dailyChangePercent,
  openPositions = 0,
  marketExposure = 0,
  tradingAllowed = true,
  risk,
  dataFreshnessLabel = '--',
  researchAggregation,
}: PortfolioSidebarProps) {
  const displaySignals = useMemo<SignalRow[]>(() => {
    return signals.slice(0, 6).map((signal) => ({
      id: signal.id,
      time: new Date(signal.createdAt).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      }),
      type: signal.signalType.replaceAll('_', ' '),
      message: signal.marketTitle || signal.reasoning || 'Signal received',
      freshness: formatAge(signal.createdAt),
    }));
  }, [signals]);

  const isPositive = (dailyChange ?? 0) >= 0;
  const riskExposure = risk?.exposure?.utilizationPct ?? marketExposure ?? 0;

  return (
    <>
      <div className={styles.pnlBlock}>
        <div className={styles.pnlLabel}>TOTAL PORTFOLIO VALUE</div>
        <div className={styles.pnlValue}>
          {portfolioValue !== undefined ? formatCurrency(portfolioValue) : '--'}
        </div>
        {portfolioValue !== undefined && dailyChange !== undefined ? (
          <div className={`${styles.pnlChange} ${!isPositive ? styles.pnlChangeNegative : ''}`}>
            <span>{isPositive ? '▲' : '▼'} {formatSignedCurrency(dailyChange)}</span>
            <span className={styles.pnlPercent}>({(dailyChangePercent ?? 0).toFixed(2)}%) today</span>
          </div>
        ) : (
          <div className={styles.pnlChange}>
            <span style={{ opacity: 0.55 }}>Connect wallet to view live PnL</span>
          </div>
        )}
      </div>

      <div className={styles.sidebarSectionCard}>
        <div className={styles.panelHeader}>
          <span className={styles.panelLabel}>SYSTEM SNAPSHOT</span>
          <span className={styles.panelBadge}>{dataFreshnessLabel}</span>
        </div>
        <div className={styles.compactMetricGrid}>
          <SidebarMetric label="Trading" value={tradingAllowed ? 'enabled' : 'blocked'} tone={tradingAllowed ? 'good' : 'bad'} />
          <SidebarMetric label="Exposure" value={`${Math.round(riskExposure)}%`} tone={riskExposure >= 70 ? 'warn' : 'neutral'} />
          <SidebarMetric label="Open positions" value={String(openPositions)} tone="neutral" />
          <SidebarMetric label="Critical alerts" value={String(risk?.alerts?.critical ?? 0)} tone={(risk?.alerts?.critical ?? 0) > 0 ? 'bad' : 'good'} />
        </div>
      </div>

      {featuredMarket ? (
        <div className={styles.sidebarSectionCard}>
          <div className={styles.panelHeader}>
            <span className={styles.panelLabel}>MARKET SNAPSHOT</span>
            <span className={styles.dataSourceBadge}>{featuredMarket.platform}</span>
          </div>
          <h3 className={styles.sidebarFeatureTitle}>{featuredMarket.question}</h3>
          <div className={styles.compactMetricGrid}>
            <SidebarMetric label="YES" value={`${featuredMarket.yesPct}c`} tone="good" />
            <SidebarMetric label="Volume" value={formatCurrencyCompact(featuredMarket.volume)} tone="neutral" />
            <SidebarMetric label="Liquidity" value={formatCurrencyCompact(featuredMarket.liquidity)} tone="neutral" />
            <SidebarMetric label="Platform" value={featuredMarket.platform.toUpperCase()} tone="neutral" />
          </div>
          <button
            type="button"
            className={styles.primaryAction}
            disabled={!featuredMarket.url || featuredMarket.url === '#'}
            onClick={() => {
              if (featuredMarket.url && featuredMarket.url !== '#') {
                window.open(featuredMarket.url, '_blank', 'noopener,noreferrer');
              }
            }}
          >
            {featuredMarket.url && featuredMarket.url !== '#' ? 'Open venue' : 'Venue unavailable'}
          </button>
        </div>
      ) : null}

      {researchAggregation ? (
        <div className={styles.sidebarSectionCard}>
          <div className={styles.panelHeader}>
            <span className={styles.panelLabel}>RESEARCH MARKETS</span>
            <span className={styles.panelBadge}>{researchAggregation.marketCount}</span>
          </div>
          <h3 className={styles.sidebarFeatureTitle}>{researchAggregation.query}</h3>
          <div className={styles.compactMetricGrid}>
            <SidebarMetric label="Markets" value={String(researchAggregation.marketCount)} tone="good" />
            <SidebarMetric label="Articles" value={String(researchAggregation.articleCount)} tone="neutral" />
            <SidebarMetric label="Posts" value={String(researchAggregation.postCount)} tone="neutral" />
            <SidebarMetric label="Mode" value="aggregated" tone="good" />
          </div>
          <div className={styles.researchMarketList}>
            {researchAggregation.markets.map((market, index) => (
              <div key={`${market.platform}-${market.marketId || index}`} className={styles.researchMarketCard}>
                <div className={styles.researchMarketTop}>
                  <span className={styles.marketCategoryBadge}>{market.platform}</span>
                  <span className={styles.dataSourceBadge}>{market.yesPct ?? '--'}c yes</span>
                </div>
                <div className={styles.researchMarketTitle}>{market.question}</div>
                <div className={styles.researchMarketMeta}>
                  <span>Vol {formatCurrencyCompact(market.volume)}</span>
                  <span>Liq {formatCurrencyCompact(market.liquidity)}</span>
                </div>
                <div className={styles.researchMarketActions}>
                  <button
                    type="button"
                    className={styles.primaryAction}
                    disabled={!market.url}
                    onClick={() => {
                      if (market.url) {
                        window.open(market.url, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  >
                    {market.url ? 'Participate' : 'Venue unavailable'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.panelHeader} style={{ marginTop: 'auto' }}>
        <span className={styles.panelLabel}>LIVE SIGNALS</span>
        <span className={styles.panelBadge}>{displaySignals.length}</span>
      </div>

      <div className={styles.signalFeed} data-tour="signals-feed">
        {displaySignals.length > 0 ? (
          displaySignals.map((signal, index) => (
            <div
              key={signal.id}
              className={index === 0 ? styles.signalItemFirst : styles.signalItem}
            >
              <div className={styles.signalMetaRow}>
                <span className={styles.signalTime}>[{signal.time}]</span>
                <span className={styles.signalTypeAnalysis}>{signal.type}</span>
                <span className={styles.signalFreshness}>{signal.freshness}</span>
              </div>
              <span className={styles.signalMessage}>{signal.message}</span>
            </div>
          ))
        ) : (
          <div className={styles.signalItem} style={{ opacity: 0.55 }}>
            <span className={styles.signalMessage}>Awaiting live signals from the intelligence layer...</span>
          </div>
        )}
      </div>
    </>
  );
}

function SidebarMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
}) {
  return (
    <div className={styles.sidebarMetricCard}>
      <span className={styles.sidebarMetricLabel}>{label}</span>
      <span className={`${styles.sidebarMetricValue} ${styles[`sidebarMetric${capitalize(tone)}`]}`}>{value}</span>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSignedCurrency(value: number) {
  const prefix = value >= 0 ? '+' : '-';
  return `${prefix}${formatCurrency(Math.abs(value))}`;
}

function formatCurrencyCompact(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${Math.round(value)}`;
}

function formatAge(timestamp: string) {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(Math.round(diffMs / 60_000), 0);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
