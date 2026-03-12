'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useUser } from '@/context/UserContext';
import { useUserPredictions, useBackendStatus } from '@/hooks/useMarkets';
import {
  TrendingUp, Flame, Share2, ChevronRight, ChevronLeft, Copy,
  ExternalLink, Check, Bell, Settings, HelpCircle, Zap, RefreshCw,
  Info, Star, Wallet, ArrowUp, LogOut, BookOpen
} from 'lucide-react';
import styles from './profile.module.css';
import { computeLeague, getLeagueInfo, getLevelProgress, LEAGUES, type LeagueName } from '@/lib/leagues';
import { formatNumber, formatAddress, formatCurrency, formatCompactNumber } from '@/lib/format';
import ReferralCard from '@/components/ReferralCard';
import ShareButton from '@/components/ShareButton';
import { useOnboarding } from '@/components/Onboarding';
import BrandLogo from '@/components/BrandLogo';

// ═══════════════════════════════════════════════════════════════
// PROFILE PAGE - Industrial Metallic Design
// ═══════════════════════════════════════════════════════════════

// Types
type PanelType = 'stats' | 'settings';

interface Achievement {
  id: string;
  name: string;
  icon: string;
  desc: string;
  unlocked: boolean;
  fill: string;
  filterStyle: string;
}

interface PerformanceStat {
  label: string;
  value: string;
  color: 'white' | 'green' | 'amber';
}

interface ActivityItem {
  text: string;
  highlight: string;
  time: string;
  type: 'amber' | 'indigo';
}

// Achievement definitions
const getAchievements = (stats: { totalPredictions: number; accuracy: number; winStreak: number }): Achievement[] => [
  {
    id: 'first',
    name: 'First Strike',
    icon: '⚡',
    desc: 'Won first bet',
    unlocked: stats.totalPredictions >= 1,
    fill: '#10B981',
    filterStyle: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.4))',
  },
  {
    id: 'streak',
    name: 'Hot Hand',
    icon: '🔥',
    desc: '10 Win Streak',
    unlocked: stats.winStreak >= 10,
    fill: '#FF9500',
    filterStyle: 'drop-shadow(0 0 8px rgba(255, 149, 0, 0.4))',
  },
  {
    id: 'oracle',
    name: 'Oracle',
    icon: '🔮',
    desc: '100 Correct',
    unlocked: stats.totalPredictions >= 100 && stats.accuracy >= 70,
    fill: '#6366F1',
    filterStyle: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.4))',
  },
  {
    id: 'whale',
    name: 'Whale',
    icon: '🐋',
    desc: '100 SOL Vol',
    unlocked: false, // Would need volume tracking
    fill: '#666',
    filterStyle: 'none',
  },
  {
    id: 'sniper',
    name: 'Sniper',
    icon: '🎯',
    desc: 'Last Min Win',
    unlocked: false, // Would need timing tracking
    fill: '#666',
    filterStyle: 'none',
  },
  {
    id: 'expert',
    name: 'Expert',
    icon: '⭐',
    desc: '80% Accuracy',
    unlocked: stats.accuracy >= 80,
    fill: '#FFD700',
    filterStyle: 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.4))',
  },
  {
    id: 'veteran',
    name: 'Veteran',
    icon: '👑',
    desc: '500 Predictions',
    unlocked: stats.totalPredictions >= 500,
    fill: '#666',
    filterStyle: 'none',
  },
  {
    id: 'master',
    name: 'Master',
    icon: '💎',
    desc: 'Diamond League',
    unlocked: false, // Based on XP
    fill: '#666',
    filterStyle: 'none',
  },
];

// Plate Component
const Plate = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`${styles.plate} ${className}`}>{children}</div>
);

// Inset Component
const Inset = ({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
  <div className={`${styles.inset} ${className}`} style={style}>{children}</div>
);

// Progress Ring Component
const ProgressRing = ({ progress, color = '#10B981' }: { progress: number; color?: string }) => {
  const radius = 20;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className={styles.ringContainer}>
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle className={styles.ringBg} cx="24" cy="24" r={radius} />
        <circle
          className={styles.ringProgress}
          cx="24"
          cy="24"
          r={radius}
          style={{
            stroke: color,
            strokeDasharray: circumference,
            strokeDashoffset: offset,
          }}
        />
      </svg>
      <div className={styles.ringValue}>{Math.round(progress)}%</div>
    </div>
  );
};

// Stats Panel Component
const StatsPanel = ({
  solBalance,
  loadingBalance,
  fetchBalance,
  performanceStats,
  activities,
}: {
  solBalance: number | null;
  loadingBalance: boolean;
  fetchBalance: () => void;
  performanceStats: PerformanceStat[];
  activities: ActivityItem[];
}) => (
  <div className={styles.rightPanel}>
    {/* Wallet Balance */}
    <Plate>
      <Inset>
        <h2 className={styles.sectionTitle}>Wallet Balance</h2>
        <div className={styles.balanceValue}>
          <span className={styles.balanceAmount}>
            {loadingBalance ? '...' : solBalance?.toFixed(2) ?? '0.00'}
          </span>
          <span className={styles.balanceUnit}>SOL</span>
          <button
            onClick={fetchBalance}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <RefreshCw size={14} color="#5A6662" className={loadingBalance ? styles.spinner : ''} />
          </button>
        </div>
        <div className={styles.balanceUsd}>
          ≈ ${((solBalance ?? 0) * 127).toFixed(2)} USD
        </div>
        <div className={styles.buttonGroup}>
          <button className={styles.btnPrimary}>Deposit</button>
          <button className={styles.btnSecondary}>Withdraw</button>
        </div>
      </Inset>
    </Plate>

    {/* Performance Stats */}
    <Plate>
      <Inset>
        <h2 className={styles.sectionTitle}>Performance</h2>
        <div className={styles.perfList}>
          {performanceStats.map((stat, i) => (
            <div key={i} className={styles.perfItem}>
              <span className={styles.perfLabel}>{stat.label}</span>
              <span
                className={`${styles.perfValue} ${
                  stat.color === 'green' ? styles.perfValueGreen :
                  stat.color === 'amber' ? styles.perfValueAmber : ''
                }`}
              >
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </Inset>
    </Plate>

    {/* Recent Activity */}
    <div className={styles.activitySection}>
      <h2 className={styles.sectionTitle}>Recent Activity</h2>
      {activities.map((activity, i) => (
        <div
          key={i}
          className={`${styles.activityItem} ${activity.type === 'indigo' ? styles.activityItemIndigo : ''}`}
        >
          <div>
            <div className={styles.activityText}>
              {activity.text} <strong>{activity.highlight}</strong>
            </div>
            <span className={styles.activityTime}>{activity.time}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Settings Panel Component
const SettingsPanel = ({
  walletAddress,
  displayName,
  userEmail,
  isConnected,
  copiedAddress,
  handleCopyAddress,
  telegramConnected,
  onTelegramLink,
  notificationCount,
  onNotificationsClick,
  onLogout,
  onReplayOnboarding,
}: {
  walletAddress: string | null;
  displayName: string;
  userEmail: string | null;
  isConnected: boolean;
  copiedAddress: boolean;
  handleCopyAddress: () => void;
  telegramConnected: boolean;
  onTelegramLink: () => void;
  notificationCount: number;
  onNotificationsClick: () => void;
  onLogout: () => void;
  onReplayOnboarding: () => void;
}) => (
  <div className={styles.rightPanel}>
    {/* Wallet Card */}
    <Plate>
      <Inset className={styles.settingsInset}>
        <div className={styles.settingsHeader}>
          <div className={styles.settingsHeaderLabel}>
            <Wallet size={14} />
            <span>Wallet</span>
          </div>
          {isConnected && (
            <span className={styles.connectedBadge}>● Connected</span>
          )}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div className={styles.fieldLabel}>PARA FREE BALANCE</div>
          <div className={styles.balanceValue}>
            <span className={styles.balanceAmount} style={{ fontSize: '26px' }}>0.0000</span>
            <span className={styles.balanceUnit} style={{ fontSize: '13px' }}>SOL</span>
          </div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <div className={styles.fieldLabel}>SOLANA ADDRESS</div>
          <div className={styles.addressBox}>
            <span className={styles.addressText}>
              {walletAddress
                ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-12)}`
                : 'Not connected'}
            </span>
            <button className={styles.addressCopyBtn} onClick={handleCopyAddress}>
              {copiedAddress ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
          <div className={styles.addressHint}>Send SOL to this address to connect funds</div>
        </div>

        <div className={styles.buttonGroup}>
          <button className={styles.btnIndigo}>
            <ArrowUp size={12} />
            Withdraw
          </button>
          <button className={styles.btnSecondary} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <ExternalLink size={12} />
            View on Solscan
          </button>
        </div>

        <div className={styles.linkCenter}>
          <a href="#" className={styles.link}>Request more funds →</a>
        </div>
      </Inset>
    </Plate>

    {/* Profile Info */}
    <Plate>
      <Inset className={styles.settingsInset}>
        <div className={styles.settingsHeader}>
          <span className={styles.settingsHeaderLabel}>Profile Information</span>
          <button className={styles.editBtn}>Edit</button>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <div className={styles.fieldLabel}>USERNAME</div>
          <div className={styles.fieldValue}>{displayName}</div>
        </div>
        <div>
          <div className={styles.fieldLabel}>EMAIL</div>
          <div className={styles.fieldValueMuted}>{userEmail || 'Not set'}</div>
        </div>
      </Inset>
    </Plate>

    {/* Menu Items */}
    <Plate>
      <Inset style={{ padding: '8px 0' }}>
        <div className={styles.menuList}>
          <button className={styles.menuItem} onClick={onNotificationsClick}>
            <Bell size={16} className={styles.menuItemIcon} />
            <div className={styles.menuItemContent}>
              <div className={styles.menuItemTitle}>
                Notifications
                {notificationCount > 0 && (
                  <span className={styles.menuItemBadge}>{notificationCount}</span>
                )}
              </div>
              <div className={styles.menuItemDesc}>Manage alerts</div>
            </div>
            <ChevronRight size={14} className={styles.menuItemArrow} />
          </button>

          <button className={styles.menuItem}>
            <Settings size={16} className={styles.menuItemIcon} />
            <div className={styles.menuItemContent}>
              <div className={styles.menuItemTitle}>Privacy</div>
              <div className={styles.menuItemDesc}>Data and visibility</div>
            </div>
            <ChevronRight size={14} className={styles.menuItemArrow} />
          </button>

          <button className={styles.menuItem} onClick={onTelegramLink}>
            <Zap size={16} className={styles.menuItemIcon} />
            <div className={styles.menuItemContent}>
              <div className={styles.menuItemTitle}>Telegram Bot</div>
              <div className={styles.menuItemDesc}>
                {telegramConnected ? 'Connected' : 'Chat integration'}
              </div>
            </div>
            <ChevronRight size={14} className={styles.menuItemArrow} />
          </button>

          <button className={styles.menuItem}>
            <HelpCircle size={16} className={styles.menuItemIcon} />
            <div className={styles.menuItemContent}>
              <div className={styles.menuItemTitle}>Help & FAQ</div>
              <div className={styles.menuItemDesc}>Get support</div>
            </div>
            <ChevronRight size={14} className={styles.menuItemArrow} />
          </button>

          <button className={styles.menuItem} onClick={onReplayOnboarding}>
            <BookOpen size={16} className={styles.menuItemIcon} />
            <div className={styles.menuItemContent}>
              <div className={styles.menuItemTitle}>App Tour</div>
              <div className={styles.menuItemDesc}>Replay onboarding</div>
            </div>
            <ChevronRight size={14} className={styles.menuItemArrow} />
          </button>

          <div className={styles.menuDivider} />

          <button className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={onLogout}>
            <LogOut size={16} className={styles.menuItemIcon} />
            <div className={styles.menuItemContent}>
              <div className={styles.menuItemTitle}>Log Out</div>
              <div className={styles.menuItemDesc}>Disconnect wallet</div>
            </div>
          </button>
        </div>
      </Inset>
    </Plate>

    <div className={styles.profileLink}>
      <a href="#" className={styles.link}>View public profile →</a>
    </div>
  </div>
);

// Main Profile Page Component
export default function ProfilePage() {
  const { user, isAuthenticated, isLoading, login, logout, walletAddress, linkTelegram, referralCode } = useUser();
  const { isConnected } = useBackendStatus();
  const { stats: apiStats } = useUserPredictions();
  const { resetOnboarding } = useOnboarding();

  // Panel state
  const [activePanel, setActivePanel] = useState<PanelType>('stats');

  // Wallet state
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Notifications
  const [notificationCount, setNotificationCount] = useState(0);

  // Telegram linking
  const [showTelegramLink, setShowTelegramLink] = useState(false);

  // Fetch SOL balance
  const fetchBalance = useCallback(async () => {
    if (!walletAddress) return;
    setLoadingBalance(true);
    try {
      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [walletAddress],
        }),
      });
      const data = await response.json();
      if (data.result?.value !== undefined) {
        setSolBalance(data.result.value / 1e9);
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    } finally {
      setLoadingBalance(false);
    }
  }, [walletAddress]);

  // Fetch notifications count
  const fetchNotifications = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`/api/notifications?wallet=${walletAddress}&limit=20`);
      const data = await res.json();
      setNotificationCount(data.notifications?.filter((n: any) => n.status === 'pending').length || 0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (walletAddress && isAuthenticated) {
      fetchBalance();
      fetchNotifications();
    }
  }, [walletAddress, isAuthenticated, fetchBalance, fetchNotifications]);

  // Copy wallet address
  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Computed stats
  const stats = {
    totalPredictions: user?.totalPredictions ?? apiStats?.totalPredictions ?? 0,
    accuracy: user?.accuracy ?? apiStats?.accuracy ?? 0,
    winStreak: user?.streak ?? (apiStats as any)?.streak?.current ?? 0,
  };

  // Calculate XP and league (using shared utilities)
  const xp = Math.floor(stats.totalPredictions * 10 + stats.accuracy * 5);
  const leagueInfo = getLeagueInfo(xp);
  const { percentage: leagueProgress } = getLevelProgress(xp);
  const league = {
    name: leagueInfo.name,
    progress: leagueProgress,
  };

  const displayName = user?.username || (walletAddress
    ? formatAddress(walletAddress)
    : 'Anonymous');

  const achievements = getAchievements(stats);

  // Performance stats for the stats panel (using shared format utilities)
  const performanceStats: PerformanceStat[] = [
    { label: 'Total Predictions', value: formatNumber(stats.totalPredictions), color: 'white' },
    { label: 'Win Rate', value: `${stats.accuracy.toFixed(1)}%`, color: 'green' },
    { label: 'Total Volume', value: `${(stats.totalPredictions * 0.5).toFixed(1)} SOL`, color: 'white' },
    { label: 'Net Profit', value: `+${((stats.accuracy / 100) * stats.totalPredictions * 0.1).toFixed(1)} SOL`, color: 'green' },
    { label: 'Global Rank', value: `#${formatNumber(user?.rank || 342)}`, color: 'amber' },
  ];

  // Activity items (mock data - would come from API)
  const activities: ActivityItem[] = [
    { text: 'Market resolved:', highlight: 'BTC > $65k. You won 1.2 SOL.', time: '2 mins ago', type: 'amber' },
    { text: 'You ranked up to', highlight: `${league.name}. +500 XP earned.`, time: '1 hour ago', type: 'indigo' },
  ];

  // Format XP display (using shared utility)
  const formatXp = (xp: number) => formatCompactNumber(xp);

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.ambientLight} />
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          Loading profile...
        </div>
      </div>
    );
  }

  // Not authenticated state
  if (!isAuthenticated) {
    return (
      <div className={styles.page}>
        <div className={styles.ambientLight} />
        <div className={styles.layoutGrid}>
          <div className={styles.fullWidth}>
            <Plate>
              <Inset className={styles.connectState}>
                <h2 className={styles.connectTitle}>Connect Your Wallet</h2>
                <p className={styles.connectDesc}>
                  Connect your wallet to view your profile, stats, and achievements.
                </p>
                <button className={styles.connectBtn} onClick={login}>
                  Connect Wallet
                </button>
              </Inset>
            </Plate>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.ambientLight} />

      <div className={styles.layoutGrid}>
        {/* Mobile Header */}
        <div className={styles.mobileHeader} style={{ gridColumn: '1 / -1' }}>
          <Link href="/" className={styles.backBtn}>
            <ChevronLeft size={20} />
          </Link>
          <h1 className={styles.headerTitle}>Profile</h1>
          <button className={styles.shareBtn}>
            <Share2 size={18} />
          </button>
        </div>

        {/* Desktop Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.logo}>
            <BrandLogo size={28} />
            <span className={styles.logoText}>BeRight</span>
          </div>

          <nav className={styles.nav}>
            <button
              className={`${styles.navItem} ${activePanel === 'stats' ? styles.navItemActive : ''}`}
              onClick={() => setActivePanel('stats')}
            >
              <TrendingUp size={18} />
              Stats
            </button>
            <button
              className={`${styles.navItem} ${activePanel === 'settings' ? styles.navItemActive : ''}`}
              onClick={() => setActivePanel('settings')}
            >
              <Settings size={18} />
              Settings
            </button>
          </nav>

          <ReferralCard walletAddress={walletAddress || undefined} referralCount={0} />
        </aside>

        {/* Main Content */}
        <main className={styles.mainContent}>
          {/* Mobile Tab Switch */}
          <div className={styles.mobileTabSwitch}>
            <button
              className={`${styles.mobileTab} ${activePanel === 'stats' ? styles.mobileTabActive : ''}`}
              onClick={() => setActivePanel('stats')}
            >
              Stats
            </button>
            <button
              className={`${styles.mobileTab} ${activePanel === 'settings' ? styles.mobileTabActive : ''}`}
              onClick={() => setActivePanel('settings')}
            >
              Settings
            </button>
          </div>

          {/* Hero Card */}
          <div className={styles.fullWidth}>
            <Plate>
              <Inset className={styles.heroCard}>
                <div className={styles.avatarOuter}>
                  <div className={styles.avatarInner}>
                    {user?.avatar || user?.avatarUrl ? (
                      <img
                        src={user.avatar || user.avatarUrl || ''}
                        alt="Avatar"
                        className={styles.avatarImage}
                      />
                    ) : (
                      <span className={styles.avatarLetter}>
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className={styles.leagueBadge}>{league.name}</div>
                </div>

                <div className={styles.heroInfo}>
                  <div className={styles.heroTop}>
                    <div>
                      <h1 className={styles.heroUsername}>{displayName}</h1>
                      <button className={styles.walletPill} onClick={handleCopyAddress}>
                        {copiedAddress ? <Check size={12} /> : <Copy size={12} />}
                        {walletAddress
                          ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
                          : 'Connect'}
                      </button>
                    </div>
                    <div className={styles.heroStats}>
                      <div className={styles.heroPredictions}>
                        {stats.totalPredictions.toLocaleString()}
                      </div>
                      <div className={styles.heroPredictionsLabel}>Correct Predictions</div>
                      <ShareButton
                        context={{
                          type: 'profile',
                          data: {
                            username: displayName,
                            accuracy: stats.accuracy,
                            totalPredictions: stats.totalPredictions,
                          },
                        }}
                        referralCode={referralCode || undefined}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>
              </Inset>
            </Plate>
          </div>

          {/* Stat Cards */}
          <Plate>
            <Inset className={styles.statCard}>
              <div className={styles.statCardHeader}>
                Accuracy
                <Info size={16} />
              </div>
              <div className={styles.statCardBody}>
                <ProgressRing progress={stats.accuracy} />
                <div className={styles.statSubtext}>Last 30 Days</div>
              </div>
            </Inset>
          </Plate>

          <Plate>
            <Inset className={styles.statCard}>
              <div className={styles.statCardHeader}>
                Current Streak
                <Flame size={16} />
              </div>
              <div className={styles.statCardBody}>
                <div className={styles.statIconBox}>
                  <Flame size={20} color="#FF9500" />
                </div>
                <div className={`${styles.statValue} ${styles.statValueAmber}`}>
                  {stats.winStreak}
                </div>
                <div className={styles.statUnit}>Days</div>
              </div>
            </Inset>
          </Plate>

          <Plate>
            <Inset className={styles.statCard}>
              <div className={styles.statCardHeader}>
                Experience (XP)
                <Star size={16} />
              </div>
              <div className={styles.statCardBody}>
                <div className={styles.statIconBox}>
                  <Star size={20} color="#6366F1" />
                </div>
                <div className={`${styles.statValue} ${styles.statValueIndigo}`}>
                  {formatXp(xp)}
                </div>
              </div>
            </Inset>
          </Plate>

          {/* League Progression */}
          <div className={styles.fullWidth}>
            <Plate>
              <Inset className={styles.leagueCard}>
                <div className={styles.leagueHeader}>
                  <h2 className={styles.leagueTitle}>League Progression</h2>
                  <div className={styles.leagueBadgeLarge}>{league.name} Tier</div>
                </div>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${league.progress}%` }} />
                </div>
                <div className={styles.progressLabels}>
                  <span className={league.name === 'BRONZE' ? styles.progressLabelActive : ''}>Bronze</span>
                  <span className={league.name === 'SILVER' ? styles.progressLabelActive : ''}>Silver</span>
                  <span className={league.name === 'GOLD' ? styles.progressLabelActive : ''}>Gold</span>
                  <span className={league.name === 'PLATINUM' ? styles.progressLabelActive : ''}>Platinum</span>
                  <span className={league.name === 'DIAMOND' ? styles.progressLabelActive : ''}>Diamond</span>
                </div>
              </Inset>
            </Plate>
          </div>

          {/* Achievements */}
          <div className={styles.fullWidth}>
            <Plate>
              <Inset className={styles.achievementsCard}>
                <h2 className={styles.achievementsTitle}>Achievements</h2>
                <div className={styles.achievementsGrid}>
                  {achievements.map((achievement) => (
                    <div key={achievement.id} className={styles.achievement}>
                      <div
                        className={`${styles.badgeOuter} ${!achievement.unlocked ? styles.badgeLocked : ''}`}
                      >
                        <div className={styles.badgeInner}>
                          <span
                            className={styles.badgeIcon}
                            style={{
                              filter: achievement.unlocked ? achievement.filterStyle : 'none',
                              opacity: achievement.unlocked ? 1 : 0.3,
                            }}
                          >
                            {achievement.icon}
                          </span>
                        </div>
                      </div>
                      <div className={styles.badgeInfo}>
                        <div className={`${styles.badgeName} ${!achievement.unlocked ? styles.badgeNameLocked : ''}`}>
                          {achievement.name}
                        </div>
                        <div className={styles.badgeDesc}>{achievement.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Inset>
            </Plate>
          </div>
        </main>

        {/* Right Panel - Desktop only shows one panel, mobile shows via tabs */}
        <aside className={styles.rightPanel}>
          {activePanel === 'stats' ? (
            <StatsPanel
              solBalance={solBalance}
              loadingBalance={loadingBalance}
              fetchBalance={fetchBalance}
              performanceStats={performanceStats}
              activities={activities}
            />
          ) : (
            <SettingsPanel
              walletAddress={walletAddress}
              displayName={displayName}
              userEmail={user?.email || null}
              isConnected={!!isConnected}
              copiedAddress={copiedAddress}
              handleCopyAddress={handleCopyAddress}
              telegramConnected={!!user?.telegramId}
              onTelegramLink={() => setShowTelegramLink(true)}
              notificationCount={notificationCount}
              onNotificationsClick={() => {}}
              onLogout={logout}
              onReplayOnboarding={resetOnboarding}
            />
          )}
        </aside>
      </div>

      {/* Bottom Nav Spacer for Mobile */}
      <div className={styles.bottomNavSpacer} />
    </div>
  );
}
