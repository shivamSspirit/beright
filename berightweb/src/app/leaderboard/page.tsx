'use client';

import { useState, useMemo } from 'react';
import { useLeaderboard, useOnChainLeaderboard, useBackendStatus } from '@/hooks/useMarkets';
import { useRealLeaderboard } from '@/hooks/useRealLeaderboard';
import { useUser } from '@/hooks/useUnifiedUser';
import { Layers, Shield } from 'lucide-react';
import { PageWrapper } from '@/components/ui';
import styles from './leaderboard.module.css';
import { computeLeague, computeLevel, computeLeagueFromAccuracy, getXpToNextLeague } from '@/lib/leagues';
import { formatCurrency, formatAddress } from '@/lib/format';
import ShareButton from '@/components/ShareButton';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface LeaderboardEntry {
  rank: number;
  username: string;
  walletAddress?: string;
  avatar?: string;
  initials?: string;
  profit: string;
  accuracy: number;
  streak: number;
  vaultScore?: number;
  trend: 'up' | 'down' | 'neutral';
  change: number | null;
  league?: string;
  predictions?: number;
  // On-chain fields
  isOnChainVerified?: boolean;
  brierScore?: number;
  tier?: string;
  status?: string;
}

type MetricTab = 'PROFIT' | 'STREAK' | 'ALPHA';
type TimeFilter = 'TODAY' | 'THIS WK' | 'THIS MO' | 'ALL TIME';
type DesktopMetric = 'Profit' | 'Win Streak' | 'Alpha Score';
type DesktopTime = 'Today' | 'This Week' | 'This Month' | 'All Time';

// ═══════════════════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════════════════

const TrendUpIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 19V5M5 12l7-7 7 7"/>
  </svg>
);

const TrendDownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M19 12l-7 7-7-7"/>
  </svg>
);

const TrendFlatIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14"/>
  </svg>
);

const StarIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const CrownIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
  </svg>
);

const LoadMoreIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M19 12l-7 7-7-7"/>
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════
// AVATAR HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const demoAvatars = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=100&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=100&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=100&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=100&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=100&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=100&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=100&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=100&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1036623067313-46276b5f99e5?q=80&w=100&auto=format&fit=crop',
];

// ═══════════════════════════════════════════════════════════════════════════
// EMPTY STATE - No mock data, real data only from API
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// LEADERBOARD PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function LeaderboardPage() {
  const { user, walletAddress, referralCode } = useUser();
  const { data } = useLeaderboard({ limit: 50 });
  const { forecasters: onChainForecasters, network, loading: onChainLoading } = useOnChainLeaderboard();
  const { data: realLeaderboard, loading: realLoading } = useRealLeaderboard();

  // Mobile state
  const [activeTab, setActiveTab] = useState<MetricTab>('ALPHA');
  const [activePill, setActivePill] = useState<TimeFilter>('THIS MO');

  // Desktop state
  const [activeMetric, setActiveMetric] = useState<DesktopMetric>('Profit');
  const [activeTime, setActiveTime] = useState<DesktopTime>('This Month');

  const normalizeAccuracy = (value: unknown): number => {
    const v = typeof value === 'number' ? value : 0;
    // Some sources return 0-1, others 0-100.
    return v <= 1 ? Number((v * 100).toFixed(1)) : Number(v.toFixed(1));
  };

  // Merge real leaderboard, on-chain data, and API data
  const leaderboardData: LeaderboardEntry[] = useMemo(() => {
    // Priority 1: Real leaderboard from Metaculus & Polymarket (V3 scores)
    const realEntries: LeaderboardEntry[] = realLeaderboard.map((entry, index) => ({
      rank: entry.rank,
      username: entry.username,
      walletAddress: entry.walletAddress,
      avatar: demoAvatars[index % demoAvatars.length],
      profit: entry.profit,
      accuracy: entry.accuracy,
      streak: entry.streak,
      vaultScore: entry.vaultScore,
      trend: 'neutral' as const,
      change: null,
      league: entry.tier,
      predictions: entry.predictions,
      // V3 scoring fields
      isOnChainVerified: entry.isOnChainVerified,
      tier: entry.tier,
      status: entry.status,
    }));

    // Priority 2: On-chain forecasters (these are verified on-chain)
    const onChainEntries: LeaderboardEntry[] = onChainForecasters.map((forecaster, index) => ({
      rank: forecaster.rank || index + 1,
      username: forecaster.displayName || formatAddress(forecaster.walletAddress),
      walletAddress: forecaster.walletAddress,
      avatar: demoAvatars[index % demoAvatars.length],
      profit: '-', // On-chain doesn't track profit
      accuracy: normalizeAccuracy(forecaster.accuracy),
      streak: forecaster.streak || 0,
      vaultScore: forecaster.vaultScore,
      trend: 'neutral' as const,
      change: null,
      league: forecaster.tier?.toUpperCase() || 'RESTRICTED',
      predictions: forecaster.totalPredictions || 0,
      // On-chain specific fields
      isOnChainVerified: true,
      brierScore: forecaster.brierScore,
      tier: forecaster.tier,
      status: forecaster.status,
    }));

    // Then, map API data (off-chain)
    const apiEntries: LeaderboardEntry[] = (data?.leaderboard || []).map((entry: any, index: number) => {
      // Check if this wallet is already in on-chain data
      const onChainMatch = onChainForecasters.find(f =>
        f.walletAddress?.toLowerCase() === entry.walletAddress?.toLowerCase()
      );

      return {
        rank: entry.rank || index + 1,
        username: entry.username || entry.displayName || formatAddress(entry.walletAddress || ''),
        walletAddress: entry.walletAddress,
        avatar: demoAvatars[(onChainEntries.length + index) % demoAvatars.length],
        profit: entry.profit ? formatCurrency(entry.profit, { compact: true, showSign: true }) : '-',
        accuracy: normalizeAccuracy(onChainMatch?.accuracy ?? entry.accuracy),
        streak: onChainMatch?.streak || entry.streak || 0,
        vaultScore: onChainMatch?.vaultScore || entry.vaultScore || 0,
        trend: entry.change > 0 ? 'up' : entry.change < 0 ? 'down' : 'neutral',
        change: entry.change || null,
        league: onChainMatch?.tier?.toUpperCase() || computeLeagueFromAccuracy(entry.accuracy || 0),
        predictions: onChainMatch?.totalPredictions || entry.predictions || 0,
        isOnChainVerified: !!onChainMatch,
        brierScore: onChainMatch?.brierScore,
        tier: onChainMatch?.tier,
        status: onChainMatch?.status,
      };
    });

    // Merge all sources with priority: Real > On-chain > API
    // Filter out duplicates (prefer real leaderboard entries)
    const realWallets = new Set(realEntries.map(e => e.walletAddress?.toLowerCase()).filter(Boolean));
    const realUsernames = new Set(realEntries.map(e => e.username?.toLowerCase()).filter(Boolean));

    const uniqueOnChainEntries = onChainEntries.filter(e =>
      !realWallets.has(e.walletAddress?.toLowerCase() || '') &&
      !realUsernames.has(e.username?.toLowerCase() || '')
    );

    const uniqueApiEntries = apiEntries.filter(e =>
      !realWallets.has(e.walletAddress?.toLowerCase() || '') &&
      !realUsernames.has(e.username?.toLowerCase() || '') &&
      !onChainForecasters.some(f => f.walletAddress?.toLowerCase() === e.walletAddress?.toLowerCase())
    );

    // Combine all sources
    const combined = [...realEntries, ...uniqueOnChainEntries, ...uniqueApiEntries];

    // Re-rank
    return combined.map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [data?.leaderboard, onChainForecasters, realLeaderboard]);

  // User stats (using shared league utilities) - no fake defaults
  const userRank = user?.rank || data?.userRank || 0;
  const userXp = (user as any)?.xp || 0;
  const userXpTarget = 20000;
  const userLeague = computeLeague(userXp);
  const userLevel = computeLevel(userXp);
  const { xpNeeded: xpToNextLeague, nextLeague } = getXpToNextLeague(userXp);

  const mobileTabs: MetricTab[] = ['PROFIT', 'STREAK', 'ALPHA'];
  const mobilePills: TimeFilter[] = ['TODAY', 'THIS WK', 'THIS MO', 'ALL TIME'];
  const desktopMetrics: DesktopMetric[] = ['Profit', 'Win Streak', 'Alpha Score'];
  const desktopTimes: DesktopTime[] = ['Today', 'This Week', 'This Month', 'All Time'];

  // Get top 3 for podium
  const top3 = leaderboardData.slice(0, 3);
  const restOfList = leaderboardData.slice(3);

  // Format display name
  const getDisplayName = (entry: LeaderboardEntry) => entry.username || 'Anonymous';

  // Get user display (using shared format utility)
  const getUserDisplay = () => {
    if (user?.username) return user.username;
    if (walletAddress) return formatAddress(walletAddress);
    return 'YOU';
  };

  return (
    <PageWrapper showHeader={false} showFooter={false}>
      <div className={styles.pageContainer}>

      {/* DESKTOP USER BAR - Full width, ABOVE filters, below global header */}
      <div className={styles.desktopUserBar}>
        <div className={styles.userBarContent}>
          <div className={styles.userBarInfo}>
            <div className={styles.userBarAvatar}>
              {user?.username?.charAt(0) || 'Y'}
            </div>
            <div className={styles.userBarMeta}>
              <span className={styles.userBarName}>{getUserDisplay()}</span>
              <span className={styles.userBarLeague}>{userLeague} League</span>
            </div>
          </div>
          <div className={styles.userBarStats}>
            <div className={styles.userBarStat}>
              <span className={styles.userBarStatLabel}>Rank</span>
              <span className={styles.userBarStatValue}>#{userRank}</span>
            </div>
            <div className={styles.userBarStat}>
              <span className={styles.userBarStatLabel}>Level</span>
              <span className={styles.userBarStatValue}>{userLevel}</span>
            </div>
            <div className={styles.userBarStat}>
              <span className={styles.userBarStatLabel}>XP</span>
              <span className={styles.userBarStatValue}>{(userXp / 1000).toFixed(1)}K</span>
            </div>
          </div>
          <ShareButton
            context={{
              type: 'leaderboard',
              data: { rank: userRank, username: user?.username || 'Anon', xp: userXp },
            }}
            referralCode={referralCode || undefined}
            variant="button"
            size="sm"
          />
        </div>
      </div>

      {/* DESKTOP FILTERS - Single row with all filters */}
      <header className={styles.desktopHeader}>
        <div className={styles.headerFilters}>
          <div className={styles.filterRow}>
            {desktopMetrics.map((metric) => (
              <button
                key={metric}
                className={`${styles.filterBtn} ${activeMetric === metric ? styles.filterBtnActive : ''}`}
                onClick={() => setActiveMetric(metric)}
              >
                {metric}
              </button>
            ))}
            <span className={styles.filterDivider} />
            {desktopTimes.map((time) => (
              <button
                key={time}
                className={`${styles.filterBtn} ${activeTime === time ? styles.filterBtnActive : ''}`}
                onClick={() => setActiveTime(time)}
              >
                {time}
              </button>
            ))}
            <button className={`${styles.filterBtn} ${styles.filterBtnLast}`}>
              Rules & Payouts
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE HEADER - Title only, navigation handled by global header */}
      <header className={styles.mobileHeader}>
        <h1 className={styles.mobileTitle}>LEADERBOARD</h1>
      </header>

      {/* MOBILE FILTERS */}
      <div className={styles.mobileFilters}>
        <div className={styles.hardwareTabs}>
          {mobileTabs.map((tab) => (
            <button
              key={tab}
              className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className={styles.pillFilters}>
          {mobilePills.map((pill) => (
            <button
              key={pill}
              className={`${styles.pill} ${activePill === pill ? styles.pillActive : ''}`}
              onClick={() => setActivePill(pill)}
            >
              {pill}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN GRID */}
      <main className={styles.mainGrid}>
        {/* DESKTOP LEFT PANEL */}
        <aside className={styles.leftPanel}>
          <div className={styles.panelHero}>
            <span className={styles.panelHeroBg}>LEAD</span>
            <div className={styles.panelLabel}>Global Ranking</div>
            <h2 className={styles.panelTitle}>The<br />Alpha<br />Board.</h2>
          </div>

          {top3[0] && (
            <div className={styles.rank1Card}>
              <span className={styles.rank1Number}>1</span>
              <div className={styles.avatarWrapper}>
                {top3[0].avatar ? (
                  <img src={top3[0].avatar} alt={top3[0].username} className={styles.avatarLarge} />
                ) : (
                  <div className={styles.avatarLarge} style={{ background: '#0a0f16', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: '#fff' }}>
                    {top3[0].initials || top3[0].username?.charAt(0) || '?'}
                  </div>
                )}
                <div className={styles.starBadge}><StarIcon /></div>
              </div>
              <div className={styles.rank1Info}>
                <div className={styles.panelLabel}>Current Leader</div>
                <h3 className={styles.rank1Name}>{getDisplayName(top3[0])}</h3>
                <div className={styles.rank1Stats}>
                  <div className={styles.statBlock}>
                    <span className={styles.statLabel}>Net Profit</span>
                    <span className={`${styles.statValue} ${styles.statValueGreen}`}>{top3[0].profit}</span>
                  </div>
                  <div className={styles.statBlock}>
                    <span className={styles.statLabel}>Accuracy</span>
                    <span className={styles.statValue}>{top3[0].accuracy}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className={styles.runnersGrid}>
            {top3.slice(1).map((entry, idx) => (
              <div key={entry.rank} className={`${styles.runnerCard} ${idx === 0 ? styles.runnerCardBorder : ''}`}>
                <span className={styles.runnerRank}>{entry.rank}</span>
                {entry.avatar ? (
                  <img src={entry.avatar} alt={entry.username} className={styles.avatarMedium} />
                ) : (
                  <div className={styles.avatarMedium} style={{ background: '#0a0f16', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: '#fff' }}>
                    {entry.initials || entry.username?.charAt(0) || '?'}
                  </div>
                )}
                <div>
                  <h3 className={styles.runnerName}>{getDisplayName(entry)}</h3>
                  <div className={styles.runnerProfit}>{entry.profit}</div>
                </div>
                <span className={styles.medalBadge}>P{entry.rank}</span>
              </div>
            ))}
          </div>

          <div className={styles.userStandingCard}>
            <div className={styles.standingHeader}>
              <div>
                <div className={styles.panelLabel}>Your Standing</div>
                <h3 className={styles.standingRank}>Rank #{userRank.toLocaleString()}</h3>
              </div>
              <div className={styles.leagueBadge}>
                <Layers size={14} />
                {userLeague} League
              </div>
            </div>
            <div className={styles.xpProgress}>
              <div className={styles.xpLabels}>
                <span>Lvl {userLevel}</span>
                <span>{userXp.toLocaleString()} / {(userXpTarget / 1000).toFixed(0)}K XP to Silver</span>
              </div>
              <div className={styles.xpBar}>
                <div className={styles.xpFill} style={{ width: `${(userXp / userXpTarget) * 100}%` }} />
              </div>
            </div>
          </div>
        </aside>

        {/* MOBILE PODIUM - Show podium first */}
        <div className={styles.mobilePodium}>
          {top3[1] && (
            <div className={styles.podiumColumn}>
              <div className={`${styles.sliderTrack} ${styles.sliderTrackPos2}`}>
                <div className={`${styles.sliderFill} ${styles.sliderFillPos2}`} />
                <div className={styles.avatarKnob}>
                  <div className={styles.rankBadge}>2ND</div>
                  {top3[1].avatar ? (
                    <img src={top3[1].avatar} alt={top3[1].username} className={styles.knobImg} />
                  ) : (
                    <span style={{ fontSize: '1.25rem' }}>{top3[1].initials || top3[1].username?.charAt(0)}</span>
                  )}
                </div>
              </div>
              <div className={styles.podiumData}>
                <div className={styles.podiumName}>{top3[1].username?.slice(0, 10)}</div>
                <div className={styles.podiumValue}>{top3[1].profit}</div>
              </div>
            </div>
          )}

          {top3[0] && (
            <div className={styles.podiumColumn}>
              <div className={`${styles.sliderTrack} ${styles.sliderTrackPos1}`}>
                <div className={`${styles.sliderFill} ${styles.sliderFillPos1}`} />
                <div className={`${styles.avatarKnob} ${styles.avatarKnobPos1}`}>
                  <div className={`${styles.rankBadge} ${styles.rankBadgeGold}`}>
                    <CrownIcon /> 1ST
                  </div>
                  {top3[0].avatar ? (
                    <img src={top3[0].avatar} alt={top3[0].username} className={styles.knobImg} />
                  ) : (
                    <span style={{ fontSize: '1.5rem' }}>{top3[0].initials || top3[0].username?.charAt(0)}</span>
                  )}
                </div>
              </div>
              <div className={styles.podiumData}>
                <div className={styles.podiumName}>{top3[0].username?.slice(0, 10)}</div>
                <div className={`${styles.podiumValue} ${styles.podiumValueGold}`}>{top3[0].profit}</div>
              </div>
            </div>
          )}

          {top3[2] && (
            <div className={styles.podiumColumn}>
              <div className={`${styles.sliderTrack} ${styles.sliderTrackPos3}`}>
                <div className={`${styles.sliderFill} ${styles.sliderFillPos3}`} />
                <div className={styles.avatarKnob}>
                  <div className={styles.rankBadge}>3RD</div>
                  {top3[2].avatar ? (
                    <img src={top3[2].avatar} alt={top3[2].username} className={styles.knobImg} />
                  ) : (
                    <span style={{ fontSize: '1.25rem' }}>{top3[2].initials || top3[2].username?.charAt(0)}</span>
                  )}
                </div>
              </div>
              <div className={styles.podiumData}>
                <div className={styles.podiumName}>{top3[2].username?.slice(0, 10)}</div>
                <div className={styles.podiumValue}>{top3[2].profit}</div>
              </div>
            </div>
          )}
        </div>

        {/* MOBILE USER MODULE - Below podium */}
        <div className={styles.mobileUserModule}>
          <div className={styles.userModuleCard}>
            <div className={styles.userModuleStripe} />
            <div className={styles.moduleHeader}>
              <div className={styles.userId}>
                <div className={styles.userAvatarSmall} style={{ background: '#1e212b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', color: '#f4f4f5' }}>
                  {user?.username?.charAt(0) || 'Y'}
                </div>
                <div className={styles.userMeta}>
                  <span className={styles.metaLabel}>SYS.USER</span>
                  <span className={styles.metaValue}>
                    {getUserDisplay()}
                    <span className={styles.inlineBadge}>{userLeague}</span>
                  </span>
                </div>
              </div>
              <div className={styles.rankDisplay}>
                <span className={styles.metaLabel}>CURRENT RANK</span>
                <div className={styles.rankNum}>{userRank}</div>
                <ShareButton
                  context={{
                    type: 'leaderboard',
                    data: {
                      rank: userRank,
                      username: user?.username || 'Anon',
                      xp: userXp,
                    },
                  }}
                  referralCode={referralCode || undefined}
                  size="sm"
                />
              </div>
            </div>
            <div className={styles.mobileXpBar}>
              <div className={styles.mobileXpFill} style={{ width: `${(userXp / userXpTarget) * 100}%` }} />
              <div className={styles.mobileXpLabels}>
                <span>LVL {userLevel}</span>
                <span>{(userXp / 1000).toFixed(1)}K / {(userXpTarget / 1000).toFixed(0)}K XP</span>
              </div>
            </div>
          </div>
        </div>

        {/* DESKTOP RIGHT PANEL */}
        <section className={styles.rightPanel}>
          <div className={styles.listHeader}>
            <div>Rnk</div>
            <div>Trader</div>
            <div>Net Profit</div>
            <div className={styles.hideTablet}>Accuracy</div>
            <div className={styles.hideTablet}>Streak</div>
            <div className={styles.listHeaderRight}>Chg</div>
          </div>

          {restOfList.map((entry) => (
            <div key={entry.rank} className={styles.listRow}>
              <div className={styles.rowRank}>{String(entry.rank).padStart(2, '0')}</div>
              <div className={styles.rowUser}>
                <div className={styles.rowAvatarCircle}>
                  {entry.avatar ? (
                    <img src={entry.avatar} alt={entry.username} className={styles.rowAvatarImg} />
                  ) : (
                    <span>{entry.initials || entry.username?.charAt(0) || '?'}</span>
                  )}
                </div>
                <span className={styles.rowName}>
                  {getDisplayName(entry)}
                  {entry.isOnChainVerified && (
                    <span title={`On-chain verified (Brier: ${entry.brierScore?.toFixed(3)})`}>
                      <Shield size={12} style={{ marginLeft: '4px', color: '#10B981' }} />
                    </span>
                  )}
                </span>
              </div>
              <div className={styles.rowProfit}>
                {entry.isOnChainVerified && entry.brierScore !== undefined
                  ? `B: ${entry.brierScore.toFixed(3)}`
                  : entry.profit}
              </div>
              <div className={`${styles.rowAccuracy} ${styles.hideTablet}`}>{entry.accuracy}%</div>
              <div className={`${styles.rowStreak} ${styles.hideTablet}`}>{entry.streak > 0 ? `${entry.streak}W` : '-'}</div>
              <div className={`${styles.rowChange} ${entry.trend === 'up' ? styles.changeUp : entry.trend === 'down' ? styles.changeDown : styles.changeNeutral}`}>
                {entry.trend === 'up' && <><TrendUpIcon />{entry.change}</>}
                {entry.trend === 'down' && <><TrendDownIcon />{entry.change}</>}
                {entry.trend === 'neutral' && '-'}
              </div>
            </div>
          ))}

          <div className={styles.loadMore}>
            <button className={styles.loadMoreBtn}>
              <LoadMoreIcon />
              Scroll to Load More
            </button>
          </div>
        </section>

        {/* MOBILE LIST */}
        <div className={styles.mobileList}>
          <h2 className={styles.mobileListTitle}>All Rankings</h2>
          <div className={styles.mobileListHeader}>
            <span>TRADER</span>
            <span>ALPHA / ACC.</span>
          </div>

          {restOfList.map((entry) => (
            <div key={entry.rank} className={styles.mobileListRow}>
              <div className={styles.mobileRowRank}>{String(entry.rank).padStart(2, '0')}</div>
              <div className={styles.mobileRowUser}>
                <div className={styles.mobileRowAvatar}>
                  {entry.avatar ? (
                    <img src={entry.avatar} alt={entry.username} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  ) : (
                    <span>{entry.initials || entry.username?.charAt(0) || '?'}</span>
                  )}
                </div>
                <div className={styles.mobileRowName}>
                  {getDisplayName(entry).slice(0, 12)}
                  {entry.isOnChainVerified && (
                    <Shield size={10} style={{ marginLeft: '4px', color: '#10B981' }} />
                  )}
                  {entry.league && <span className={styles.inlineBadge}>{entry.league}</span>}
                </div>
              </div>
              <div className={styles.mobileRowStats}>
                <div className={styles.mobileStatPrimary}>
                  {entry.isOnChainVerified && entry.brierScore !== undefined
                    ? `B: ${entry.brierScore.toFixed(3)}`
                    : entry.profit}
                </div>
                <div className={`${styles.mobileStatChange} ${entry.trend === 'up' ? styles.changeUp : entry.trend === 'down' ? styles.changeDown : styles.changeNeutral}`}>
                  {entry.trend === 'up' && <TrendUpIcon />}
                  {entry.trend === 'down' && <TrendDownIcon />}
                  {entry.trend === 'neutral' && <TrendFlatIcon />}
                  {entry.accuracy}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      </div>
    </PageWrapper>
  );
}
