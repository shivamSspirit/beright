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
 * MLFeedTable - Enhanced table with ML matching data
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
    if (q.length > 50) return q.slice(0, 47) + '...';
    return q;
  };

  if (markets.length === 0) {
    return <div className={styles.emptyState}>No markets found</div>;
  }

  return (
    <table className={styles.marketTable}>
      <thead>
        <tr>
          <th>Question</th>
          <th>Prob</th>
          <th>Platforms</th>
          <th>Confidence</th>
          <th>Vol (24H)</th>
          <th>Arb</th>
        </tr>
      </thead>
      <tbody>
        {markets.map((market, index) => {
          const prob = Math.round(market.consensusPrice * 100);
          const arbSpread = market.arbitrage ? (market.arbitrage.spread * 100).toFixed(1) : null;

          // Get DFlow platform ID for navigation (only DFlow markets are supported for detail view)
          const dflowPlatform = market.platforms.find(p => p.platform === 'dflow');
          const marketDetailId = dflowPlatform?.platformId || null;

          return (
            <tr
              key={market.id}
              onMouseEnter={() => setHoveredRow(index)}
              onMouseLeave={() => setHoveredRow(null)}
              onClick={() => marketDetailId && router.push(`/market/${encodeURIComponent(marketDetailId)}`)}
              style={{
                background: hoveredRow === index ? 'rgba(255,255,255,0.02)' : 'transparent',
                cursor: marketDetailId ? 'pointer' : 'default'
              }}
            >
              <td>
                <div className={styles.marketQuestion}>
                  <span className={styles.questionText}>{formatQuestion(market.question)}</span>
                  {market.entities.people.length > 0 && (
                    <span className={styles.entityTag}>{market.entities.people[0]}</span>
                  )}
                </div>
              </td>
              <td>
                <span className={`${styles.marketProb} ${getProbClass(prob)}`}>
                  {prob}%
                </span>
              </td>
              <td>
                <div className={styles.platformBadges}>
                  {market.platforms.slice(0, 3).map((p, i) => (
                    <span key={i} className={styles.platformBadge}>
                      {p.platform.slice(0, 3).toUpperCase()}
                    </span>
                  ))}
                  {market.platformCount > 3 && (
                    <span className={styles.platformMore}>+{market.platformCount - 3}</span>
                  )}
                </div>
              </td>
              <td>
                <span className={`${styles.confidence} ${getConfidenceClass(market.matchConfidence)}`}>
                  {(market.matchConfidence * 100).toFixed(0)}%
                </span>
              </td>
              <td className={styles.marketVol}>{formatVolume(market.totalVolume24h)}</td>
              <td>
                {arbSpread ? (
                  <span className={styles.arbBadge}>+{arbSpread}%</span>
                ) : (
                  <span className={styles.noArb}>-</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
