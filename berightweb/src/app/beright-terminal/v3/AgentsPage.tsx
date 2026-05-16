'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CompositeScoreData,
  Forecaster,
  LinkedPlatformSummary,
  getLeaderboard,
  getForecasterCompositeScore,
  getForecasterLinkedPlatforms,
  getForecasters,
  getOnChainLeaderboard,
} from '@/lib/api';
import styles from '../beright.module.css';

interface ForecasterDetails {
  composite?: CompositeScoreData;
  linkedPlatforms?: LinkedPlatformSummary[];
}

export default function AgentsPage() {
  const [forecasters, setForecasters] = useState<Forecaster[]>([]);
  const [details, setDetails] = useState<Record<string, ForecasterDetails>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadForecasters() {
      setLoading(true);
      setError(null);

      try {
        const [forecasterResponse, leaderboardResponse, onChainResponse] = await Promise.all([
          getForecasters({ limit: 12, sortBy: 'accuracy' }).catch(() => ({ forecasters: [], total: 0 })),
          getLeaderboard({ limit: 12 }).catch(() => ({ leaderboard: [], count: 0, userRank: null })),
          getOnChainLeaderboard().catch(() => ({ success: false, data: { forecasters: [], totalOnChain: 0, network: 'devnet' as const } })),
        ]);

        const ranked = mergeForecasterSources(
          forecasterResponse.forecasters || [],
          leaderboardResponse.leaderboard || [],
          onChainResponse.success ? onChainResponse.data.forecasters : []
        );

        setForecasters(ranked);

        const walletForecasters = ranked
          .filter((forecaster) => Boolean(forecaster.walletAddress))
          .slice(0, 6);

        const detailEntries = await Promise.all(
          walletForecasters.map(async (forecaster) => {
            const pubkey = forecaster.walletAddress!;

            const [composite, linkedPlatforms] = await Promise.all([
              getForecasterCompositeScore(pubkey).catch(() => null),
              getForecasterLinkedPlatforms(pubkey).catch(() => null),
            ]);

            return [
              forecaster.id,
              {
                composite: composite?.success ? composite.data : undefined,
                linkedPlatforms: linkedPlatforms?.success ? linkedPlatforms.data.platforms : undefined,
              },
            ] as const;
          })
        );

        setDetails(Object.fromEntries(detailEntries));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load forecasters');
      } finally {
        setLoading(false);
      }
    }

    loadForecasters();
  }, []);

  const summary = useMemo(() => {
    if (forecasters.length === 0) {
      return [
        { label: 'TRACKED', value: '0', detail: 'No forecasters loaded' },
        { label: 'AVG ACC', value: '0%', detail: 'No verified predictions' },
        { label: 'ON-CHAIN', value: '0', detail: 'No calibration records' },
        { label: 'LINKED', value: '0', detail: 'No external platforms imported' },
      ];
    }

    const avgAccuracy = forecasters.reduce((sum, forecaster) => sum + forecaster.accuracy, 0) / forecasters.length;
    const onChain = forecasters.reduce((sum, forecaster) => sum + (forecaster.onChainCount || 0), 0);
    const linked = Object.values(details).reduce((sum, detail) => sum + (detail.linkedPlatforms?.length || 0), 0);
    const verifiedWallets = forecasters.filter((forecaster) => Boolean(forecaster.walletAddress)).length;

    return [
      { label: 'TRACKED', value: String(forecasters.length), detail: `${verifiedWallets} with wallet identity` },
      { label: 'AVG ACC', value: `${avgAccuracy.toFixed(1)}%`, detail: 'Across surfaced forecasters' },
      { label: 'ON-CHAIN', value: String(onChain), detail: 'Calibration-linked predictions' },
      { label: 'LINKED', value: String(linked), detail: 'Imported external profiles' },
    ];
  }, [details, forecasters]);

  return (
    <div className={styles.fullPageView}>
      <div className={styles.fullPageHeader}>
        <span>TRADER + FORECASTER GRAPH</span>
        <span className={styles.feedMeta}>Truth source: reputation + calibration + linked platforms</span>
      </div>

      <div className={styles.terminalIntroBlock}>
        <div>
          <div className={styles.terminalIntroEyebrow}>QUALITY RANKING</div>
          <h2 className={styles.terminalIntroTitle}>Find signal you can actually trust and follow.</h2>
        </div>
        <div className={styles.terminalIntroMeta}>
          <span>`quality` uses accuracy, streak, sample size, and on-chain activity</span>
          <span>`copyability` is derived from your existing scoring layer</span>
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

      {loading ? (
        <div className={styles.loadingState}>Loading forecaster graph...</div>
      ) : error ? (
        <div className={styles.errorState}>{error}</div>
      ) : forecasters.length === 0 ? (
        <div className={styles.emptyState}>No forecasters are available yet.</div>
      ) : (
        <div className={styles.forecasterGrid}>
          {forecasters.map((forecaster) => {
            const detail = details[forecaster.id];
            const composite = detail?.composite;
            const linkedPlatforms = detail?.linkedPlatforms || [];
            const quality = getQualityTier(forecaster, composite);
            const copyability = getCopyabilityTier(forecaster, composite);

            return (
              <article key={forecaster.id} className={styles.forecasterCard}>
                <div className={styles.forecasterHeader}>
                  <div className={styles.forecasterRank}>#{forecaster.rank}</div>
                  <div className={styles.forecasterIdentity}>
                    <h3>{forecaster.displayName || forecaster.username}</h3>
                    <span>@{forecaster.username || forecaster.id}</span>
                  </div>
                  <div className={styles.forecasterScoreBlock}>
                    <span className={styles.forecasterScoreLabel}>quality</span>
                    <strong className={styles.forecasterScoreValue}>{quality.label}</strong>
                  </div>
                </div>

                <div className={styles.forecasterMetaRow}>
                  <span className={`${styles.executionBadge} ${styles[`executionBadge${quality.tone}`]}`}>
                    {quality.detail}
                  </span>
                  <span className={`${styles.executionBadge} ${styles[`executionBadge${copyability.tone}`]}`}>
                    {copyability.label}
                  </span>
                  {composite?.onChainVerified ? <span className={styles.dataSourceBadge}>verified</span> : null}
                </div>

                <div className={styles.forecasterStats}>
                  <StatCell label="Accuracy" value={`${forecaster.accuracy.toFixed(1)}%`} />
                  <StatCell label="Brier" value={forecaster.brierScore.toFixed(3)} />
                  <StatCell label="Predictions" value={String(forecaster.predictions)} />
                  <StatCell label="Resolved" value={String(forecaster.resolvedPredictions)} />
                  <StatCell label="Streak" value={String(forecaster.streak)} />
                  <StatCell label="On-chain" value={String(forecaster.onChainCount || 0)} />
                </div>

                <div className={styles.forecasterFootnote}>
                  <span>
                    Composite: {composite ? `${composite.scorePercent?.toFixed(1) || 0}% ${composite.tier}` : 'pending'}
                  </span>
                  <span>
                    Linked platforms: {linkedPlatforms.length}
                  </span>
                </div>

                {forecaster.expertise?.length ? (
                  <div className={styles.tagRow}>
                    {forecaster.expertise.slice(0, 4).map((tag) => (
                      <span key={tag} className={styles.marketCategoryBadge}>{tag}</span>
                    ))}
                  </div>
                ) : null}

                {linkedPlatforms.length > 0 ? (
                  <div className={styles.linkedPlatformRow}>
                    {linkedPlatforms.slice(0, 3).map((platform) => (
                      <span key={platform.id} className={styles.linkedPlatformChip}>
                        {platform.platform}
                        {platform.importedStats?.roi !== undefined && platform.importedStats?.roi !== null
                          ? ` ${platform.importedStats.roi > 0 ? '+' : ''}${platform.importedStats.roi.toFixed(1)}%`
                          : ''}
                      </span>
                    ))}
                  </div>
                ) : null}

                {linkedPlatforms.length > 0 && linkedPlatforms[0].platformProfileUrl ? (
                  <div className={styles.opportunityActions}>
                    <button
                      type="button"
                      className={styles.primaryAction}
                      onClick={() => window.open(linkedPlatforms[0].platformProfileUrl, '_blank', 'noopener,noreferrer')}
                    >
                      Open profile
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
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

function getQualityTier(
  forecaster: Forecaster,
  composite?: CompositeScoreData
): { label: string; detail: string; tone: 'Live' | 'Watch' | 'Thin' } {
  const score = (forecaster.accuracy * 0.45)
    + ((1 - forecaster.brierScore) * 100 * 0.25)
    + (Math.min(forecaster.predictions, 100) * 0.15)
    + ((composite?.scorePercent || 0) * 0.15);

  if (score >= 72) {
    return { label: 'A', detail: 'high trust', tone: 'Live' };
  }

  if (score >= 58) {
    return { label: 'B', detail: 'watch closely', tone: 'Watch' };
  }

  return { label: 'C', detail: 'small sample or unstable edge', tone: 'Thin' };
}

function getCopyabilityTier(
  forecaster: Forecaster,
  composite?: CompositeScoreData
): { label: string; tone: 'Live' | 'Watch' | 'Thin' } {
  const linkedCount = composite?.breakdown?.length || 0;
  const score = (forecaster.resolvedPredictions * 0.2)
    + (forecaster.streak * 1.5)
    + (forecaster.onChainCount * 1.25)
    + (linkedCount * 8);

  if (score >= 70) return { label: 'copyable', tone: 'Live' };
  if (score >= 35) return { label: 'selective', tone: 'Watch' };
  return { label: 'research only', tone: 'Thin' };
}

function mergeForecasterSources(
  forecasters: Forecaster[],
  leaderboardEntries: Array<any>,
  onChainEntries: Array<any>
): Forecaster[] {
  const merged = new Map<string, Forecaster>();

  const upsert = (entry: Forecaster) => {
    const key = entry.walletAddress || entry.username || entry.id;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, entry);
      return;
    }

    merged.set(key, {
      ...existing,
      ...entry,
      accuracy: Math.max(existing.accuracy || 0, entry.accuracy || 0),
      predictions: Math.max(existing.predictions || 0, entry.predictions || 0),
      resolvedPredictions: Math.max(existing.resolvedPredictions || 0, entry.resolvedPredictions || 0),
      onChainCount: Math.max(existing.onChainCount || 0, entry.onChainCount || 0),
      expertise: existing.expertise?.length ? existing.expertise : entry.expertise,
    });
  };

  forecasters.forEach(upsert);

  leaderboardEntries.forEach((entry: any, index: number) => {
    upsert({
      id: String(entry.userId || entry.walletAddress || entry.wallet_address || entry.username || index),
      username: entry.username || entry.displayName || `leaderboard-${index + 1}`,
      displayName: entry.displayName || entry.username || `Leaderboard ${index + 1}`,
      avatarUrl: entry.avatarUrl || entry.avatar_url,
      brierScore: entry.brierScore ?? 0.25,
      accuracy: entry.accuracy ?? 0,
      predictions: entry.predictions ?? 0,
      resolvedPredictions: entry.predictions ?? 0,
      streak: entry.streak ?? 0,
      rank: entry.rank ?? index + 1,
      onChainCount: entry.onChainCount ?? 0,
      walletAddress: entry.walletAddress || entry.wallet_address,
      expertise: [],
    });
  });

  onChainEntries.forEach((entry: any, index: number) => {
    upsert({
      id: String(entry.walletAddress || entry.forecasterPda || `onchain-${index}`),
      username: entry.displayName || `wallet-${index + 1}`,
      displayName: entry.displayName || entry.walletAddress || `On-chain ${index + 1}`,
      brierScore: entry.brierScore ?? 0.25,
      accuracy: entry.accuracy ?? 0,
      predictions: entry.totalPredictions ?? 0,
      resolvedPredictions: entry.resolvedPredictions ?? 0,
      streak: entry.streak ?? 0,
      rank: entry.rank ?? index + 1,
      onChainCount: entry.totalPredictions ?? 0,
      walletAddress: entry.walletAddress,
      expertise: entry.tier ? [entry.tier] : [],
    });
  });

  return [...merged.values()]
    .sort((left, right) => {
      const leftScore = (left.accuracy || 0) + (left.onChainCount || 0) * 0.2 - (left.brierScore || 0) * 100;
      const rightScore = (right.accuracy || 0) + (right.onChainCount || 0) * 0.2 - (right.brierScore || 0) * 100;
      return rightScore - leftScore;
    })
    .slice(0, 12)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}
