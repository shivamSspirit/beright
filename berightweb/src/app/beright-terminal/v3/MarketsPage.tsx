'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getFeed, FeedMarket, FeedType } from '@/lib/api';
import { ArbOpportunitiesFeed } from '../components';
import styles from '../beright.module.css';

// Extended feed type to include CrossOdds arb view
type ExtendedFeedType = FeedType | 'crossodds';

/**
 * MarketsPage - ML-powered markets feed
 * Displays cross-platform matched markets with confidence scores
 * ARB tab shows CrossOdds-style detailed arbitrage opportunities
 */
export default function MarketsPage() {
  const [feedType, setFeedType] = useState<ExtendedFeedType>('hot');
  const [markets, setMarkets] = useState<FeedMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ total: number; latencyMs: number; cacheHit: boolean } | null>(null);

  useEffect(() => {
    // Skip loading ML feed when showing CrossOdds arb view
    if (feedType === 'crossodds') {
      setLoading(false);
      return;
    }

    async function loadFeed() {
      setLoading(true);
      setError(null);
      try {
        const response = await getFeed({ type: feedType as FeedType, limit: 20 });
        if (response.success) {
          setMarkets(response.data);
          setMeta({
            total: response.meta.total,
            latencyMs: response.meta.latencyMs,
            cacheHit: response.meta.cacheHit,
          });
        } else {
          setError('Failed to load feed');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load feed');
      } finally {
        setLoading(false);
      }
    }
    loadFeed();
  }, [feedType]);

  const feedTypes: { type: ExtendedFeedType; label: string; icon?: string }[] = [
    { type: 'hot', label: 'HOT', icon: '🔥' },
    { type: 'crossodds', label: 'ARB', icon: '⚡' },
    { type: 'closing_soon', label: 'CLOSING', icon: '⏰' },
    { type: 'trending', label: 'TRENDING', icon: '📈' },
  ];

  return (
    <div className={styles.fullPageView}>
      <div className={styles.fullPageHeader}>
        <span>ML FEED</span>
        <div className={styles.feedTabs}>
          {feedTypes.map(({ type, label, icon }) => (
            <button
              key={type}
              className={`${styles.feedTab} ${feedType === type ? styles.feedTabActive : ''}`}
              onClick={() => setFeedType(type)}
            >
              {icon && <span style={{ marginRight: '4px' }}>{icon}</span>}
              {label}
            </button>
          ))}
        </div>
        {meta && feedType !== 'crossodds' && (
          <span className={styles.feedMeta}>
            {meta.total} markets | {meta.latencyMs}ms {meta.cacheHit && '(cached)'}
          </span>
        )}
      </div>

      {/* CrossOdds Arbitrage View */}
      {feedType === 'crossodds' ? (
        <ArbOpportunitiesFeed
          minProfit={2}
          limit={10}
          autoRefresh={true}
          refreshInterval={30000}
        />
      ) : loading ? (
        <div className={styles.loadingState}>Loading ML feed...</div>
      ) : error ? (
        <div className={styles.errorState}>{error}</div>
      ) : (
        <MLFeedTable markets={markets} />
      )}
    </div>
  );
}

/**
 * MLFeedTable - Enhanced table with ML matching data and trading actions
 */
function MLFeedTable({ markets }: { markets: FeedMarket[] }) {
  const router = useRouter();
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const getProbClass = (prob: number) => {
    if (prob >= 70) return styles.probGreen;
    if (prob >= 40) return styles.probCyan;
    if (prob <= 20) return styles.probRed;
    return styles.probNeutral;
  };

  const getConfidenceClass = (confidence: number) => {
    if (confidence >= 0.9) return styles.confHigh;
    if (confidence >= 0.7) return styles.confMedium;
    return styles.confLow;
  };

  const formatVolume = (vol: number) => {
    if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
    if (vol >= 1_000) return `$${Math.round(vol / 1_000)}K`;
    return `$${Math.round(vol)}`;
  };

  const formatQuestion = (q: string) => {
    if (q.length > 45) return q.slice(0, 42) + '...';
    return q;
  };

  // Get platform trading URL
  const getPlatformUrl = (platform: string, platformId: string): string => {
    switch (platform) {
      case 'dflow':
        return `https://dflow.net/market/${platformId}`;
      case 'kalshi':
        return `https://kalshi.com/markets/${platformId}`;
      case 'polymarket':
        return `https://polymarket.com/event/${platformId}`;
      default:
        return '#';
    }
  };

  if (markets.length === 0) {
    return <div className={styles.emptyState}>No markets found</div>;
  }

  return (
    <div className={styles.mlFeedContainer}>
      {markets.map((market, index) => {
        const prob = Math.round(market.consensusPrice * 100);
        const arbSpread = market.arbitrage ? (market.arbitrage.spread * 100).toFixed(1) : null;
        const dflowPlatform = market.platforms.find(p => p.platform === 'dflow');
        const primaryPlatform = dflowPlatform || market.platforms[0];
        const marketDetailUrl = dflowPlatform?.platformId
          ? `/market/${encodeURIComponent(dflowPlatform.platformId)}`
          : null;
        const tradingUrl = primaryPlatform
          ? getPlatformUrl(primaryPlatform.platform, primaryPlatform.platformId)
          : null;

        return (
          <div
            key={market.id}
            className={styles.mlFeedCard}
            onMouseEnter={() => setHoveredRow(index)}
            onMouseLeave={() => setHoveredRow(null)}
            style={{
              borderColor: hoveredRow === index ? 'rgba(0, 255, 178, 0.3)' : undefined,
            }}
          >
            {/* Question and metadata row */}
            <div className={styles.mlFeedHeader}>
              <div className={styles.mlFeedQuestion}>
                <span
                  className={styles.questionText}
                  onClick={() => marketDetailUrl && router.push(marketDetailUrl)}
                  style={{ cursor: marketDetailUrl ? 'pointer' : 'default' }}
                >
                  {formatQuestion(market.question)}
                </span>
                {market.entities.people.length > 0 && (
                  <span className={styles.entityTag}>{market.entities.people[0]}</span>
                )}
              </div>
              {arbSpread && (
                <span className={styles.arbBadgeInline}>ARB +{arbSpread}%</span>
              )}
            </div>

            {/* Stats row */}
            <div className={styles.mlFeedStats}>
              <div className={styles.mlFeedStat}>
                <span className={`${styles.mlFeedProb} ${getProbClass(prob)}`}>{prob}%</span>
                <span className={styles.mlFeedStatLabel}>YES</span>
              </div>
              <div className={styles.mlFeedStat}>
                <span className={styles.mlFeedVol}>{formatVolume(market.totalVolume24h)}</span>
                <span className={styles.mlFeedStatLabel}>24h Vol</span>
              </div>
              <div className={styles.mlFeedStat}>
                <span className={`${styles.mlFeedConf} ${getConfidenceClass(market.matchConfidence)}`}>
                  {(market.matchConfidence * 100).toFixed(0)}%
                </span>
                <span className={styles.mlFeedStatLabel}>Conf</span>
              </div>
              <div className={styles.mlFeedPlatforms}>
                {market.platforms.slice(0, 2).map((p, i) => (
                  <span key={i} className={styles.platformBadge}>
                    {p.platform.slice(0, 3).toUpperCase()}
                  </span>
                ))}
                {market.platformCount > 2 && (
                  <span className={styles.platformMore}>+{market.platformCount - 2}</span>
                )}
              </div>
            </div>

            {/* Action buttons row */}
            <div className={styles.mlFeedActions}>
              <button
                className={styles.mlFeedBtnYes}
                onClick={(e) => {
                  e.stopPropagation();
                  if (tradingUrl) window.open(tradingUrl, '_blank');
                }}
              >
                <span className={styles.mlFeedBtnSide}>YES</span>
                <span className={styles.mlFeedBtnPrice}>{prob}c</span>
              </button>
              <button
                className={styles.mlFeedBtnNo}
                onClick={(e) => {
                  e.stopPropagation();
                  if (tradingUrl) window.open(tradingUrl, '_blank');
                }}
              >
                <span className={styles.mlFeedBtnSide}>NO</span>
                <span className={styles.mlFeedBtnPrice}>{100 - prob}c</span>
              </button>
              {marketDetailUrl && (
                <button
                  className={styles.mlFeedBtnView}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(marketDetailUrl);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15,3 21,3 21,9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
