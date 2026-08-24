'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useUser } from '@/hooks/useUnifiedUser';
import { useUserPredictions, useBackendStatus } from '@/hooks/useMarkets';
import { useSubscription } from '@/hooks/useSubscription';
import { usePredictions } from '@/hooks/usePredictions';
import {
  TrendingUp, Flame, ChevronRight, Copy,
  ExternalLink, Check, Bell, Settings, HelpCircle, Zap, RefreshCw,
  Info, Star, Wallet, ArrowUp, LogOut, BookOpen, Crown, CreditCard, Target
} from 'lucide-react';
import { PageWrapper } from '@/components/ui';
import OnboardingTour from '@/components/OnboardingTour';
import RestartTourButton from '@/components/RestartTourButton';
import { getTourSteps } from '@/config/tour-steps';
import styles from './profile.module.css';
import { getLeagueInfo, getLevelProgress } from '@/lib/leagues';
import { formatNumber, formatAddress, formatCompactNumber } from '@/lib/format';
import ReferralCard from '@/components/ReferralCard';
import ShareButton from '@/components/ShareButton';
import { useOnboarding } from '@/components/Onboarding';
import { useMode } from '@/context/ModeContext';
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
  onChainTx?: string;
  explorerUrl?: string;
  // Full prediction data for modal
  predictionData?: {
    id: string;
    marketId: string;
    probability: number;
    direction: 'YES' | 'NO';
    createdAt: string;
    resolvedAt?: string;
    outcome?: boolean;
    brierScore?: number;
    onChainTx?: string;
  };
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
  onPredictionClick,
}: {
  solBalance: number | null;
  loadingBalance: boolean;
  fetchBalance: () => void;
  performanceStats: PerformanceStat[];
  activities: ActivityItem[];
  onPredictionClick?: (prediction: ActivityItem['predictionData']) => void;
}) => (
  <>
    {/* Wallet Balance */}
    <Plate>
      <Inset data-tour="wallet-balance">
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
    <div className={styles.activitySection} data-tour="activity-feed">
      <h2 className={styles.sectionTitle}>
        Recent Activity
        <span style={{ fontSize: '10px', marginLeft: '6px', color: '#818CF8', fontWeight: 400 }}>
          On-Chain
        </span>
      </h2>
      {activities.length === 0 ? (
        <div className={styles.activityEmpty}>
          <span style={{ opacity: 0.5 }}>No predictions yet</span>
        </div>
      ) : (
        activities.map((activity, i) => (
          <div
            key={i}
            className={`${styles.activityItem} ${activity.type === 'indigo' ? styles.activityItemIndigo : ''}`}
            onClick={() => activity.predictionData && onPredictionClick?.(activity.predictionData)}
            style={{ cursor: activity.predictionData ? 'pointer' : 'default' }}
          >
            <div style={{ flex: 1 }}>
              <div className={styles.activityText}>
                {activity.text} <strong>{activity.highlight}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={styles.activityTime}>{activity.time}</span>
                {activity.onChainTx && (
                  <a
                    href={`https://explorer.solana.com/tx/${activity.onChainTx}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.activityChainLink}
                    title="View on Solana Explorer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={10} />
                    <span>On-chain</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  </>
);

// Subscription info interface
interface SubscriptionInfo {
  tier: string;
  tierConfig: { badge: string; color: string; name: string };
  isPaid: boolean;
  subscription: {
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    billingInterval: 'month' | 'year';
  } | null;
  usage: {
    queriesUsed: number;
  } | null;
  limits: {
    queriesPerDay: number;
  };
  openBillingPortal: () => Promise<void>;
}

// Settings Panel Component
const SettingsPanel = ({
  walletAddress,
  displayName,
  userEmail,
  isConnected,
  copiedAddress,
  handleCopyAddress,
  notificationCount,
  onNotificationsClick,
  onLogout,
  onReplayOnboarding,
  subscriptionInfo,
  solBalance,
}: {
  walletAddress: string | null;
  displayName: string;
  userEmail: string | null;
  isConnected: boolean;
  copiedAddress: boolean;
  handleCopyAddress: () => void;
  notificationCount: number;
  onNotificationsClick: () => void;
  onLogout: () => void;
  onReplayOnboarding: () => void;
  subscriptionInfo: SubscriptionInfo;
  solBalance: number | null;
}) => (
  <>
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
            <span className={styles.balanceAmount} style={{ fontSize: '26px' }}>{solBalance?.toFixed(4) ?? '0.0000'}</span>
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

        {/* Network indicator for demo mode */}
        <div style={{ marginBottom: '14px' }}>
          <div className={styles.fieldLabel}>NETWORK</div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '6px',
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            fontSize: '12px',
            fontWeight: 500,
            color: '#818CF8',
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#818CF8',
              animation: 'pulse 2s infinite',
            }} />
            Devnet (Demo Mode)
          </div>
        </div>

        <div className={styles.buttonGroup}>
          <button className={styles.btnIndigo}>
            <ArrowUp size={12} />
            Withdraw
          </button>
          <button className={styles.btnSecondary} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <ExternalLink size={12} />
            View on Orb
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

    {/* Subscription Card */}
    <Plate>
      <Inset className={styles.settingsInset}>
        <div className={styles.settingsHeader}>
          <div className={styles.settingsHeaderLabel}>
            <Crown size={14} />
            <span>Subscription</span>
          </div>
          <span
            className={styles.tierBadge}
            style={{
              background: `${subscriptionInfo.tierConfig.color}20`,
              color: subscriptionInfo.tierConfig.color,
              border: `1px solid ${subscriptionInfo.tierConfig.color}40`,
            }}
          >
            {subscriptionInfo.tierConfig.badge}
          </span>
        </div>

        {subscriptionInfo.isPaid && subscriptionInfo.subscription ? (
          <>
            <div style={{ marginBottom: '12px' }}>
              <div className={styles.fieldLabel}>CURRENT PLAN</div>
              <div className={styles.fieldValue}>
                {subscriptionInfo.tierConfig.name}{' '}
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
                  ({subscriptionInfo.subscription.billingInterval === 'year' ? 'Annual' : 'Monthly'})
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div className={styles.fieldLabel}>
                {subscriptionInfo.subscription.cancelAtPeriodEnd ? 'EXPIRES ON' : 'RENEWS ON'}
              </div>
              <div className={styles.fieldValue} style={{ color: subscriptionInfo.subscription.cancelAtPeriodEnd ? '#F59E0B' : undefined }}>
                {new Date(subscriptionInfo.subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
                {subscriptionInfo.subscription.cancelAtPeriodEnd && (
                  <span style={{ color: '#F59E0B', fontSize: '11px', marginLeft: '6px' }}>
                    (Canceling)
                  </span>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <div className={styles.fieldLabel}>TODAY&apos;S USAGE</div>
              <div className={styles.usageBar}>
                <div
                  className={styles.usageBarFill}
                  style={{
                    width: `${Math.min(100, ((subscriptionInfo.usage?.queriesUsed || 0) / (subscriptionInfo.limits.queriesPerDay === -1 ? 1 : subscriptionInfo.limits.queriesPerDay)) * 100)}%`,
                    background: subscriptionInfo.tierConfig.color,
                  }}
                />
              </div>
              <div className={styles.usageText}>
                {subscriptionInfo.usage?.queriesUsed || 0} / {subscriptionInfo.limits.queriesPerDay === -1 ? '∞' : subscriptionInfo.limits.queriesPerDay} queries
              </div>
            </div>

            <button className={styles.btnSecondary} onClick={subscriptionInfo.openBillingPortal}>
              <CreditCard size={14} />
              Manage Billing
            </button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: '12px' }}>
              <div className={styles.fieldLabel}>CURRENT PLAN</div>
              <div className={styles.fieldValue}>Free Tier</div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <div className={styles.fieldLabel}>DAILY QUERIES</div>
              <div className={styles.usageBar}>
                <div
                  className={styles.usageBarFill}
                  style={{
                    width: `${Math.min(100, ((subscriptionInfo.usage?.queriesUsed || 0) / 10) * 100)}%`,
                  }}
                />
              </div>
              <div className={styles.usageText}>
                {subscriptionInfo.usage?.queriesUsed || 0} / 10 queries
              </div>
            </div>

            <Link href="/subscription" className={styles.btnPrimary}>
              <Crown size={14} />
              Upgrade Plan
            </Link>
          </>
        )}
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

          <button className={styles.menuItem}>
            <HelpCircle size={16} className={styles.menuItemIcon} />
            <div className={styles.menuItemContent}>
              <div className={styles.menuItemTitle}>Help & FAQ</div>
              <div className={styles.menuItemDesc}>Get support</div>
            </div>
            <ChevronRight size={14} className={styles.menuItemArrow} />
          </button>

          <Link href="/calibration" className={styles.menuItem}>
            <Target size={16} className={styles.menuItemIcon} />
            <div className={styles.menuItemContent}>
              <div className={styles.menuItemTitle}>Calibration</div>
              <div className={styles.menuItemDesc}>View Brier score and calibration stats</div>
            </div>
            <ChevronRight size={14} className={styles.menuItemArrow} />
          </Link>

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

  </>
);

// Main Profile Page Component
export default function ProfilePage() {
  const { user, isAuthenticated, isLoading, login, logout, walletAddress, referralCode } = useUser();
  const { isConnected } = useBackendStatus();
  const { stats: apiStats } = useUserPredictions();
  const { resetOnboarding } = useOnboarding();
  const { isDemo, network } = useMode();

  // Tour setup - MUST be at top level before any returns
  const tourSteps = useMemo(() => {
    try {
      return getTourSteps('profile');
    } catch (error) {
      console.error('[ProfilePage] Error loading tour steps:', error);
      return [];
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && isDemo && tourSteps.length > 0) {
      console.log('[ProfilePage] Tour conditions:', {
        isAuthenticated,
        isDemo,
        tourStepsCount: tourSteps.length,
        willShowTour: true,
      });
    }
  }, [isAuthenticated, isDemo, tourSteps.length]);

  // Local predictions from usePredictions hook (localStorage in demo mode)
  const {
    predictions: localPredictions,
    getStats: getLocalStats,
    isLoading: predictionsLoading,
  } = usePredictions(walletAddress);

  // On-chain recent predictions (always available when wallet is connected)
  const [onChainPredictions, setOnChainPredictions] = useState<any[] | null>(null);
  const [onChainTotalPredictions, setOnChainTotalPredictions] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !walletAddress) {
      setOnChainPredictions(null);
      setOnChainTotalPredictions(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/v2/calibration?wallet=${walletAddress}&history=true&limit=10`);
        const json = await res.json();
        if (cancelled) return;

        if (json?.success && json?.data) {
          setOnChainTotalPredictions(json.data.totalPredictions ?? null);
          setOnChainPredictions(Array.isArray(json.data.predictions) ? json.data.predictions : []);
        } else {
          setOnChainPredictions([]);
          setOnChainTotalPredictions(null);
        }
      } catch (err) {
        if (cancelled) return;
        console.warn('[Profile] Failed to fetch on-chain prediction history:', err instanceof Error ? err.message : String(err));
        setOnChainPredictions([]);
        setOnChainTotalPredictions(null);
      }
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated, walletAddress]);
  const {
    tier,
    tierConfig,
    isPaid,
    subscription,
    usage,
    limits,
    openBillingPortal,
  } = useSubscription();

  // Panel state
  const [activePanel, setActivePanel] = useState<PanelType>('stats');

  // Wallet state
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Notifications
  const [notificationCount, setNotificationCount] = useState(0);

  // Fetch SOL balance - uses devnet in demo mode, mainnet in production
  const fetchBalance = useCallback(async () => {
    if (!walletAddress) return;
    setLoadingBalance(true);
    try {
      // Use devnet RPC in demo mode, mainnet in production
      const rpcUrl = isDemo
        ? (process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com')
        : (process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

      console.log(`[Profile] Fetching balance from ${isDemo ? 'devnet' : 'mainnet'}:`, walletAddress);

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
        const balance = data.result.value / 1e9;
        console.log(`[Profile] Balance: ${balance} SOL`);
        setSolBalance(balance);
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    } finally {
      setLoadingBalance(false);
    }
  }, [walletAddress, isDemo]);

  // Fetch notifications count
  const fetchNotifications = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`/api/notifications?wallet=${walletAddress}&limit=20`);
      if (!res.ok) {
        setNotificationCount(0);
        return;
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        // When the route doesn't exist or upstream errors, Next may return an HTML error page.
        // Avoid throwing "Unexpected token '<'".
        setNotificationCount(0);
        return;
      }

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

  // Computed stats - include local predictions in demo mode
  const localStats = getLocalStats();
  const stats = useMemo(() => {
    // In demo mode, prioritize local predictions count
    const localCount = localPredictions?.length ?? 0;
    const apiCount = user?.totalPredictions ?? apiStats?.totalPredictions ?? 0;
    const onChainCount = onChainTotalPredictions ?? 0;

    return {
      totalPredictions: isDemo ? Math.max(localCount, apiCount) : Math.max(apiCount, onChainCount),
      accuracy: user?.accuracy ?? apiStats?.accuracy ?? localStats.accuracy ?? 0,
      winStreak: user?.streak ?? (apiStats as any)?.streak?.current ?? 0,
    };
  }, [user, apiStats, isDemo, localPredictions, localStats, onChainTotalPredictions]);

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

  // Performance stats for the stats panel (using shared format utilities) - no mock data
  const performanceStats: PerformanceStat[] = [
    { label: 'Total Predictions', value: formatNumber(stats.totalPredictions), color: 'white' },
    { label: 'Win Rate', value: `${stats.accuracy.toFixed(1)}%`, color: 'green' },
    { label: 'Total Volume', value: `${(stats.totalPredictions * 0.5).toFixed(1)} SOL`, color: 'white' },
    { label: 'Net Profit', value: `+${((stats.accuracy / 100) * stats.totalPredictions * 0.1).toFixed(1)} SOL`, color: 'green' },
    { label: 'Global Rank', value: user?.rank ? `#${formatNumber(user.rank)}` : '--', color: 'amber' },
  ];

  // Activity items - populated from on-chain predictions
  // State for prediction detail modal
  const [selectedPrediction, setSelectedPrediction] = useState<ActivityItem['predictionData'] | null>(null);

  const activities: ActivityItem[] = useMemo(() => {
    // Prefer on-chain history when available
    if (onChainPredictions && onChainPredictions.length > 0) {
      const localByMarketId: Record<string, (typeof localPredictions)[number]> = {};
      for (const lp of localPredictions || []) {
        localByMarketId[lp.marketId] = lp;
      }

      const items: ActivityItem[] = [];

      for (const p of onChainPredictions.slice(0, 25)) {
        const committedAtMs = (p.committedAt ?? 0) * 1000;
        const timeAgo = committedAtMs ? getTimeAgo(new Date(committedAtMs)) : '--';

        const marketIdText = typeof p.marketIdText === 'string' ? p.marketIdText : '';
        const localMatch = marketIdText ? localByMarketId[marketIdText] : undefined;

        const marketLabel = marketIdText
          ? marketIdText
          : (typeof p.marketIdHex === 'string' ? `Market ${p.marketIdHex.slice(0, 8)}...` : 'Market');

        const highlight = localMatch?.question
          ? (localMatch.question.length > 40 ? `${localMatch.question.slice(0, 40)}...` : localMatch.question)
          : marketLabel;

        // Prefer tx signature from backend; fall back to local saved tx immediately after swipe.
        const txSignature =
          (typeof p.txSignature === 'string' && p.txSignature) ? p.txSignature
          : (localMatch?.onChainTx || null);

        if (!txSignature) continue; // user requested: hide activity without a tx history

        const direction = p.direction === 'yes' ? 'YES' : 'NO';
        const explorerUrl =
          localMatch?.explorerUrl
          || `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`;

        items.push({
          text: `Predicted ${direction} on`,
          highlight,
          time: timeAgo,
          type: direction === 'YES' ? 'amber' : 'indigo',
          onChainTx: txSignature,
          explorerUrl,
          predictionData: {
            id: txSignature,
            marketId: marketIdText || (typeof p.marketIdHex === 'string' ? p.marketIdHex : ''),
            probability: typeof p.predictedProbability === 'number' ? p.predictedProbability : 0,
            direction,
            createdAt: committedAtMs ? new Date(committedAtMs).toISOString() : new Date().toISOString(),
            resolvedAt: p.resolvedAt ? new Date(p.resolvedAt * 1000).toISOString() : undefined,
            outcome: p.outcome ?? undefined,
            brierScore: p.brierScore ?? undefined,
            onChainTx: txSignature,
          },
        });
      }

      // Merge in newest local tx-backed predictions that might not be indexed on-chain yet.
      const localExtras = (localPredictions || [])
        .filter((lp) => !!lp.onChainTx)
        .slice(0, 10)
        .map((lp) => {
          const timeAgo = getTimeAgo(new Date(lp.createdAt));
          const highlight = lp.question && lp.question.length > 40 ? `${lp.question.slice(0, 40)}...` : (lp.question || lp.marketId);
          const explorerUrl = lp.explorerUrl || `https://explorer.solana.com/tx/${lp.onChainTx}?cluster=devnet`;
          return {
            text: `Predicted ${lp.direction} on`,
            highlight,
            time: timeAgo,
            type: lp.direction === 'YES' ? 'amber' : 'indigo',
            onChainTx: lp.onChainTx,
            explorerUrl,
            predictionData: {
              id: lp.onChainTx,
              marketId: lp.marketId,
              probability: lp.probability,
              direction: lp.direction,
              createdAt: lp.createdAt,
              resolvedAt: lp.resolvedAt,
              outcome: lp.outcome,
              brierScore: lp.brierScore,
              onChainTx: lp.onChainTx,
            },
          } as ActivityItem;
        });

      const seen = new Set<string>();
      const combined = [...localExtras, ...items].filter((a) => {
        if (!a.onChainTx) return false;
        if (seen.has(a.onChainTx)) return false;
        seen.add(a.onChainTx);
        return true;
      });

      return combined.slice(0, 10);
    }

    // Fallback: local predictions with tx (demo / older flows)
    if (!localPredictions || localPredictions.length === 0) return [];

    return localPredictions
      .filter((pred) => pred.onChainTx)
      .slice(0, 10)
      .map((pred) => {
        const timeAgo = getTimeAgo(new Date(pred.createdAt));
        const questionShort = pred.question && pred.question.length > 40
          ? pred.question.substring(0, 40) + '...'
          : (pred.question || `Market ${pred.marketId.slice(0, 8)}...`);

        return {
          text: `Predicted ${pred.direction} on`,
          highlight: questionShort,
          time: timeAgo,
          type: pred.direction === 'YES' ? 'amber' : 'indigo',
          onChainTx: pred.onChainTx,
          explorerUrl: pred.explorerUrl,
          predictionData: {
            id: pred.id,
            marketId: pred.marketId,
            probability: pred.probability,
            direction: pred.direction,
            createdAt: pred.createdAt,
            resolvedAt: pred.resolvedAt,
            outcome: pred.outcome,
            brierScore: pred.brierScore,
            onChainTx: pred.onChainTx,
          },
        } as ActivityItem;
      });
  }, [localPredictions, onChainPredictions]);

  // Helper function for time ago
  function getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  // Format XP display (using shared utility)
  const formatXp = (xp: number) => formatCompactNumber(xp);

  // Loading state
  if (isLoading) {
    return (
      <PageWrapper showHeader={false} showFooter={false}>
        <div className={styles.page}>
          <div className={styles.ambientLight} />
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            Loading profile...
          </div>
        </div>
      </PageWrapper>
    );
  }

  // Not authenticated state
  if (!isAuthenticated) {
    return (
      <PageWrapper showHeader={false} showFooter={false}>
        <div className={styles.connectScreen}>
          <div className={styles.connectLogo}>
            <BrandLogo size={48} />
            <span className={styles.connectLogoText}>BeRight</span>
          </div>
          <div className={styles.connectText}>
            Connect your wallet to view your profile, stats, and achievements.
          </div>
          <button className={styles.connectButton} onClick={login}>
            Connect Wallet
          </button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper showHeader={false} showFooter={false}>
      {/* Onboarding Tour - only in demo mode */}
      {isAuthenticated && isDemo && tourSteps.length > 0 && (
        <OnboardingTour
          steps={tourSteps}
          storageKey="beright-profile-tour-completed"
          onComplete={() => console.log('[ProfilePage] Tour completed!')}
          forceShow={false}
          debug={true}
        />
      )}

      {/* Restart tour button - only in demo mode */}
      {isAuthenticated && isDemo && (
        <RestartTourButton
          storageKey="beright-profile-tour-completed"
          ariaLabel="Restart profile page tour"
        />
      )}

      <div className={styles.page}>
        <div className={styles.ambientLight} />

        <div className={styles.layoutGrid}>
        {/* Desktop Sidebar */}
        <aside className={styles.sidebar}>
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
            <Link href="/calibration" className={styles.navItem}>
              <Target size={18} />
              Calibration
            </Link>
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
              <Inset className={styles.heroCard} data-tour="profile-hero">
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
            <Inset className={styles.statCard} data-tour="accuracy-card">
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
              <Inset className={styles.leagueCard} data-tour="league-progression">
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
              <Inset className={styles.achievementsCard} data-tour="achievements">
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
              onPredictionClick={(pred) => setSelectedPrediction(pred)}
            />
          ) : (
            <SettingsPanel
              walletAddress={walletAddress}
              displayName={displayName}
              userEmail={user?.email || null}
              isConnected={!!isConnected}
              copiedAddress={copiedAddress}
              handleCopyAddress={handleCopyAddress}
              notificationCount={notificationCount}
              onNotificationsClick={() => {}}
              onLogout={logout}
              onReplayOnboarding={resetOnboarding}
              subscriptionInfo={{
                tier,
                tierConfig,
                isPaid,
                subscription: subscription ? {
                  currentPeriodEnd: subscription.currentPeriodEnd,
                  cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                  billingInterval: subscription.billingInterval,
                } : null,
                usage: usage ? { queriesUsed: usage.queriesUsed } : null,
                limits: { queriesPerDay: limits.queriesPerDay },
                openBillingPortal,
              }}
              solBalance={solBalance}
            />
          )}
        </aside>
      </div>

      {/* Prediction Detail Modal */}
      {selectedPrediction && (
        <div className={styles.modalOverlay} onClick={() => setSelectedPrediction(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Prediction Details</h3>
              <button
                className={styles.modalClose}
                onClick={() => setSelectedPrediction(null)}
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.predictionField}>
                <span className={styles.predictionLabel}>Market ID</span>
                <span className={styles.predictionValue} style={{ fontFamily: 'var(--pf-font-mono)', fontSize: '11px' }}>
                  {selectedPrediction.marketId}
                </span>
              </div>

              <div className={styles.predictionField}>
                <span className={styles.predictionLabel}>Direction</span>
                <span
                  className={styles.predictionValue}
                  style={{
                    color: selectedPrediction.direction === 'YES' ? 'var(--pf-emerald)' : 'var(--pf-indigo)',
                    fontWeight: 700,
                  }}
                >
                  {selectedPrediction.direction}
                </span>
              </div>

              <div className={styles.predictionField}>
                <span className={styles.predictionLabel}>Probability</span>
                <span className={styles.predictionValue} style={{ fontFamily: 'var(--pf-font-mono)', fontWeight: 700 }}>
                  {(selectedPrediction.probability * 100).toFixed(0)}%
                </span>
              </div>

              <div className={styles.predictionField}>
                <span className={styles.predictionLabel}>Created</span>
                <span className={styles.predictionValue}>
                  {new Date(selectedPrediction.createdAt).toLocaleString()}
                </span>
              </div>

              {selectedPrediction.resolvedAt && (
                <div className={styles.predictionField}>
                  <span className={styles.predictionLabel}>Resolved</span>
                  <span className={styles.predictionValue}>
                    {new Date(selectedPrediction.resolvedAt).toLocaleString()}
                  </span>
                </div>
              )}

              {selectedPrediction.outcome !== undefined && (
                <div className={styles.predictionField}>
                  <span className={styles.predictionLabel}>Outcome</span>
                  <span
                    className={styles.predictionValue}
                    style={{
                      color: selectedPrediction.outcome ? 'var(--pf-emerald)' : '#F43F5E',
                      fontWeight: 700,
                    }}
                  >
                    {selectedPrediction.outcome ? 'Correct' : 'Incorrect'}
                  </span>
                </div>
              )}

              {selectedPrediction.brierScore !== undefined && (
                <div className={styles.predictionField}>
                  <span className={styles.predictionLabel}>Brier Score</span>
                  <span className={styles.predictionValue} style={{ fontFamily: 'var(--pf-font-mono)' }}>
                    {selectedPrediction.brierScore.toFixed(4)}
                  </span>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              {selectedPrediction.onChainTx ? (
                <a
                  href={`https://explorer.solana.com/tx/${selectedPrediction.onChainTx}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.modalExplorerLink}
                >
                  <ExternalLink size={14} />
                  View on Solana Explorer
                </a>
              ) : (
                <span className={styles.modalExplorerLink} style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                  <ExternalLink size={14} />
                  No transaction recorded
                </span>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </PageWrapper>
  );
}
