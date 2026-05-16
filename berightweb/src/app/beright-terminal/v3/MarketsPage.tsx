'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArbOpportunitiesFeed } from '../components';
import { FeedMarket, FeedType, getFeed, Platform } from '@/lib/api';
import styles from '../beright.module.css';

type MarketView = FeedType | 'crossodds' | 'digital';

const VIEW_CONFIG: Array<{
  type: MarketView;
  label: string;
  subtitle: string;
}> = [
  { type: 'hot', label: 'OPPORTUNITIES', subtitle: 'Highest-conviction matched markets' },
  { type: 'crossodds', label: 'ARBITRAGE', subtitle: 'Executable cross-venue spreads' },
  { type: 'digital', label: 'DIGITAL', subtitle: 'Crypto-native and faster-cycle markets' },
  { type: 'closing_soon', label: 'CLOSING', subtitle: 'Markets with shrinking time to react' },
  { type: 'trending', label: 'TRENDING', subtitle: 'Narrative and volume acceleration' },
];

interface SummaryMetric {
  label: string;
  value: string;
  detail: string;
}

export default function MarketsPage() {
  const [view, setView] = useState<MarketView>('hot');
  const [markets, setMarkets] = useState<FeedMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ total: number; latencyMs: number; cacheHit: boolean } | null>(null);

  useEffect(() => {
    if (view === 'crossodds') {
      setLoading(false);
      setError(null);
      return;
    }

    async function loadFeed() {
      setLoading(true);
      setError(null);

      try {
        const response = await getFeed(
          view === 'digital'
            ? { type: 'category', category: 'crypto', limit: 20 }
            : { type: view as FeedType, limit: 20 }
        );

        if (!response.success) {
          setError('Failed to load matched markets');
          return;
        }

        setMarkets(response.data);
        setMeta({
          total: response.meta.total,
          latencyMs: response.meta.latencyMs,
          cacheHit: response.meta.cacheHit,
        });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load matched markets');
      } finally {
        setLoading(false);
      }
    }

    loadFeed();
  }, [view]);

  const summary = useMemo<SummaryMetric[]>(() => {
    if (markets.length === 0) {
      return [
        { label: 'MATCHED', value: '0', detail: 'No canonical events loaded' },
        { label: 'LIQUIDITY', value: '$0', detail: 'No executable depth yet' },
        { label: 'ARB READY', value: '0', detail: 'No spread above threshold' },
        { label: 'AVG CONF', value: '0%', detail: 'No confidence data' },
      ];
    }

    const totalLiquidity = markets.reduce((sum, market) => sum + market.totalLiquidity, 0);
    const arbReady = markets.filter((market) => (market.arbitrage?.profitPct ?? 0) >= 2).length;
    const avgConfidence = markets.reduce((sum, market) => sum + market.matchConfidence, 0) / markets.length;
    const totalVolume = markets.reduce((sum, market) => sum + market.totalVolume24h, 0);

    return [
      { label: 'MATCHED', value: String(meta?.total ?? markets.length), detail: `${formatCurrencyCompact(totalVolume)} 24h volume` },
      { label: 'LIQUIDITY', value: formatCurrencyCompact(totalLiquidity), detail: 'Across surfaced opportunities' },
      { label: 'ARB READY', value: String(arbReady), detail: 'Net spread above 2%' },
      { label: 'AVG CONF', value: `${Math.round(avgConfidence * 100)}%`, detail: meta?.cacheHit ? 'Served from warm cache' : 'Freshly recomputed' },
    ];
  }, [markets, meta]);

  const activeView = VIEW_CONFIG.find((entry) => entry.type === view) ?? VIEW_CONFIG[0];

  return (
    <div className={styles.fullPageView}>
      <div className={styles.fullPageHeader}>
        <span>OPPORTUNITY BOARD</span>
        <div className={styles.feedTabs}>
          {VIEW_CONFIG.map(({ type, label }) => (
            <button
              key={type}
              className={`${styles.feedTab} ${view === type ? styles.feedTabActive : ''}`}
              onClick={() => setView(type)}
            >
              {label}
            </button>
          ))}
        </div>
        {meta && view !== 'crossodds' && (
          <span className={styles.feedMeta}>
            {meta.latencyMs}ms scan {meta.cacheHit ? 'cached' : 'live'}
          </span>
        )}
      </div>

      <div className={styles.terminalIntroBlock}>
        <div>
          <div className={styles.terminalIntroEyebrow}>{activeView.label}</div>
          <h2 className={styles.terminalIntroTitle}>{activeView.subtitle}</h2>
        </div>
        <div className={styles.terminalIntroMeta}>
          <span>Truth source: unified feed + platform matching</span>
          <span>One tap: venue jump or market detail</span>
        </div>
      </div>

      <div className={styles.metricStrip}>
        {summary.map((metric) => (
          <div key={metric.label} className={styles.metricCard}>
            <span className={styles.metricCardLabel}>{metric.label}</span>
            <strong className={styles.metricCardValue}>{metric.value}</strong>
            <span className={styles.metricCardDetail}>{metric.detail}</span>
          </div>
        ))}
      </div>

      {view === 'crossodds' ? (
        <ArbOpportunitiesFeed minProfit={2} limit={10} autoRefresh refreshInterval={30000} />
      ) : loading ? (
        <div className={styles.loadingState}>Loading canonical markets...</div>
      ) : error ? (
        <div className={styles.errorState}>{error}</div>
      ) : markets.length === 0 ? (
        <div className={styles.emptyState}>No markets matched this filter yet.</div>
      ) : (
        <OpportunityBoard markets={markets} />
      )}
    </div>
  );
}

function OpportunityBoard({ markets }: { markets: FeedMarket[] }) {
  return (
    <div className={styles.opportunityBoard}>
      {markets.map((market) => {
        const primaryPlatform = market.platforms[0];
        const platformUrl = primaryPlatform ? getPlatformUrl(primaryPlatform.platform, primaryPlatform.platformId) : null;
        const copyability = getExecutionTier(market);
        const decay = getDecayLabel(market.closeDate);
        const signalLine = market.arbitrage
          ? `Cross-venue spread ${market.arbitrage.profitPct.toFixed(1)}% with ${market.platformCount} venues matched`
          : `Consensus ${Math.round(market.consensusPrice * 100)}c with ${market.platformCount} venues matched`;

        return (
          <article key={market.id} className={styles.opportunityCard}>
            <div className={styles.opportunityCardHeader}>
              <div className={styles.opportunityCardTitleWrap}>
                <div className={styles.opportunityCardBadges}>
                  <span className={styles.marketCategoryBadge}>{market.category}</span>
                  <span className={`${styles.executionBadge} ${styles[`executionBadge${copyability.tone}`]}`}>
                    {copyability.label}
                  </span>
                  <span className={styles.dataSourceBadge}>derived</span>
                </div>
                <h3 className={styles.opportunityCardTitle}>{market.question}</h3>
              </div>
              <div className={styles.opportunityPriceBlock}>
                <span className={styles.opportunityPrice}>{Math.round(market.consensusPrice * 100)}c</span>
                <span className={styles.opportunityPriceSub}>YES midpoint</span>
              </div>
            </div>

            <p className={styles.opportunityReason}>{signalLine}</p>

            <div className={styles.opportunityStats}>
              <StatCell label="Liquidity" value={formatCurrencyCompact(market.totalLiquidity)} />
              <StatCell label="24h Volume" value={formatCurrencyCompact(market.totalVolume24h)} />
              <StatCell label="Match Conf" value={`${Math.round(market.matchConfidence * 100)}%`} />
              <StatCell label="Spread" value={`${(market.priceSpread * 100).toFixed(1)} pts`} />
              <StatCell label="Decay" value={decay} />
              <StatCell label="Age" value={formatRelativeTime(market.matchedAt)} />
            </div>

            <div className={styles.opportunityFootnote}>
              <span>Platforms: {market.platforms.map((platform) => platform.platform.toUpperCase()).join(' · ')}</span>
              {market.arbitrage ? (
                <span>
                  Arb path: buy {market.arbitrage.buyPlatform.toUpperCase()} / sell {market.arbitrage.sellPlatform.toUpperCase()}
                </span>
              ) : (
                <span>No direct arbitrage edge flagged on current scan.</span>
              )}
            </div>

            <div className={styles.opportunityActions}>
              <button
                type="button"
                className={styles.primaryAction}
                disabled={!platformUrl || platformUrl === '#'}
                onClick={() => {
                  if (platformUrl && platformUrl !== '#') {
                    window.open(platformUrl, '_blank', 'noopener,noreferrer');
                  }
                }}
              >
                {platformUrl && platformUrl !== '#' ? 'Open venue' : 'Venue unavailable'}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.opportunityStatCell}>
      <span className={styles.opportunityStatLabel}>{label}</span>
      <span className={styles.opportunityStatValue}>{value}</span>
    </div>
  );
}

function getExecutionTier(market: FeedMarket): { label: string; tone: 'Live' | 'Watch' | 'Thin' } {
  if (market.totalLiquidity >= 250_000 && market.matchConfidence >= 0.9) {
    return { label: 'LIVE', tone: 'Live' };
  }

  if (market.totalLiquidity >= 75_000 && market.matchConfidence >= 0.75) {
    return { label: 'WATCH', tone: 'Watch' };
  }

  return { label: 'THIN', tone: 'Thin' };
}

function getDecayLabel(closeDate: string | null): string {
  if (!closeDate) return 'Open';

  const remainingMs = new Date(closeDate).getTime() - Date.now();
  if (remainingMs <= 0) return 'Closing';

  const hours = Math.round(remainingMs / 3_600_000);
  if (hours < 6) return `<${Math.max(hours, 1)}h`;
  if (hours < 48) return `${hours}h`;

  return `${Math.round(hours / 24)}d`;
}

function formatRelativeTime(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(Math.round(diffMs / 60_000), 0);

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  return `${Math.round(hours / 24)}d`;
}

function formatCurrencyCompact(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${Math.round(value)}`;
}

function getPlatformUrl(platform: Platform, platformId: string): string {
  switch (platform) {
    case 'dflow':
      return `https://dflow.net/market/${platformId}`;
    case 'kalshi':
      return `https://kalshi.com/markets/${platformId}`;
    case 'polymarket':
      return `https://polymarket.com/event/${platformId}`;
    case 'manifold':
      return `https://manifold.markets/${platformId}`;
    case 'limitless':
      return `https://limitless.exchange/markets/${platformId}`;
    case 'metaculus':
      return `https://www.metaculus.com/questions/${platformId}`;
    default:
      return '#';
  }
}
