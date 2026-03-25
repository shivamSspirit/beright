'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useUser } from '@/hooks/useUnifiedUser';
import { useMode } from '@/context/ModeContext';
import {
  usePools,
  usePoolEligibility,
  useDelegatorPortfolio,
  formatTvl,
  formatNav,
  formatPnl,
  formatPercent,
  TIER_COLORS,
  TIER_LABELS,
  ForecasterTier,
  PoolStatus,
} from '@/hooks/useDelegation';
import { CreatePoolModal } from '@/components/CreatePoolModal';

// ============================================================================
// Icons
// ============================================================================

const TrendUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 6l-9.5 9.5-5-5L1 18" />
    <path d="M17 6h6v6" />
  </svg>
);

const UsersIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const WalletIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M22 10h-4a2 2 0 0 0 0 4h4" />
  </svg>
);

// ============================================================================
// Pool Card Component
// ============================================================================

interface PoolCardProps {
  pool: {
    id: string;
    poolPda: string;
    slug: string | null;
    name: string | null;
    forecasterWallet: string;
    forecasterTier: ForecasterTier;
    forecasterBrier: number | null;
    status: PoolStatus;
    tvl: number;
    navPerShare: number;
    delegatorCount: number;
    performanceFeeBps: number;
    createdAt: string;
  };
  isDemo?: boolean;
}

function PoolCard({ pool, isDemo = false }: PoolCardProps) {
  const tierColor = TIER_COLORS[pool.forecasterTier] || '#9E9E9E';
  const tierLabel = TIER_LABELS[pool.forecasterTier] || 'Unknown';
  const returnPercent = ((pool.navPerShare - 1) * 100);

  return (
    <Link
      href={`/pools/${pool.slug || pool.id}`}
      style={{
        display: 'block',
        background: 'linear-gradient(135deg, rgba(20, 25, 35, 0.9), rgba(15, 20, 30, 0.95))',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '24px',
        textDecoration: 'none',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
            {pool.name || `Pool ${pool.poolPda.slice(0, 8)}...`}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '12px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: `${tierColor}20`,
                color: tierColor,
                fontWeight: 500,
              }}
            >
              {tierLabel}
            </span>
            {pool.forecasterBrier !== null && (
              <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                Brier: {pool.forecasterBrier.toFixed(3)}
              </span>
            )}
          </div>
        </div>
        <span
          style={{
            fontSize: '11px',
            padding: '4px 8px',
            borderRadius: '4px',
            background: pool.status === 'open' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.1)',
            color: pool.status === 'open' ? '#10B981' : 'rgba(255, 255, 255, 0.6)',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          {pool.status}
        </span>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '4px', textTransform: 'uppercase' }}>
            TVL
          </div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#fff' }}>
            {formatTvl(pool.tvl, isDemo)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '4px', textTransform: 'uppercase' }}>
            Return
          </div>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: returnPercent >= 0 ? '#10B981' : '#EF4444',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <TrendUpIcon />
            {formatPercent(returnPercent)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '4px', textTransform: 'uppercase' }}>
            Delegators
          </div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <UsersIcon />
            {pool.delegatorCount}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)' }}>
          {pool.performanceFeeBps / 100}% performance fee
        </span>
        <span style={{ fontSize: '12px', color: '#3B82F6', fontWeight: 500 }}>
          View Pool →
        </span>
      </div>
    </Link>
  );
}

// ============================================================================
// Filters Component
// ============================================================================

interface FiltersProps {
  status: PoolStatus | 'all';
  setStatus: (s: PoolStatus | 'all') => void;
  tier: ForecasterTier | 'all';
  setTier: (t: ForecasterTier | 'all') => void;
  sortBy: string;
  setSortBy: (s: string) => void;
}

function Filters({ status, setStatus, tier, setTier, sortBy, setSortBy }: FiltersProps) {
  const statusOptions: (PoolStatus | 'all')[] = ['all', 'open', 'active', 'paused', 'closed'];
  const tierOptions: (ForecasterTier | 'all')[] = ['all', 'super', 'elite', 'verified', 'rookie'];
  const sortOptions = [
    { value: 'tvl', label: 'TVL' },
    { value: 'nav', label: 'Returns' },
    { value: 'delegators', label: 'Delegators' },
    { value: 'brier', label: 'Brier Score' },
    { value: 'created', label: 'Newest' },
  ];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
      {/* Status Filter */}
      <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '4px' }}>
        {statusOptions.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              background: status === s ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              color: status === s ? '#3B82F6' : 'rgba(255, 255, 255, 0.6)',
              fontWeight: status === s ? 600 : 400,
              textTransform: 'capitalize',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Tier Filter */}
      <select
        value={tier}
        onChange={(e) => setTier(e.target.value as ForecasterTier | 'all')}
        style={{
          padding: '8px 12px',
          fontSize: '13px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          color: '#fff',
          cursor: 'pointer',
        }}
      >
        {tierOptions.map((t) => (
          <option key={t} value={t} style={{ background: '#1a1f2e' }}>
            {t === 'all' ? 'All Tiers' : TIER_LABELS[t]}
          </option>
        ))}
      </select>

      {/* Sort */}
      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value)}
        style={{
          padding: '8px 12px',
          fontSize: '13px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          color: '#fff',
          cursor: 'pointer',
          marginLeft: 'auto',
        }}
      >
        {sortOptions.map((opt) => (
          <option key={opt.value} value={opt.value} style={{ background: '#1a1f2e' }}>
            Sort by {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ============================================================================
// Portfolio Summary Component
// ============================================================================

interface PortfolioSummaryProps {
  isDemo?: boolean;
}

function PortfolioSummary({ isDemo = false }: PortfolioSummaryProps) {
  const { portfolio, loading } = useDelegatorPortfolio();

  if (loading || !portfolio) return null;

  const { summary } = portfolio;

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.1))',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '32px',
      }}
    >
      <h2 style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Your Delegations
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '24px' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '4px' }}>Total Value</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: '#fff' }}>
            {formatTvl(summary.totalCurrentValue, isDemo)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '4px' }}>Total P&L</div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 600,
              color: summary.totalPnl >= 0 ? '#10B981' : '#EF4444',
            }}
          >
            {formatPnl(summary.totalPnl, true, isDemo)} ({formatPercent(summary.totalPnlPercent)})
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '4px' }}>Active Pools</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: '#fff' }}>
            {summary.activePools}
          </div>
        </div>
        {summary.pendingWithdrawals > 0 && (
          <div>
            <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '4px' }}>Pending Withdrawals</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#F59E0B' }}>
              {summary.pendingWithdrawals}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function PoolsPage() {
  const { isAuthenticated, walletAddress } = useUser();
  const { isDemo } = useMode();
  const { eligibility, loading: eligibilityLoading, error: eligibilityError } = usePoolEligibility();

  // Filter state
  const [status, setStatus] = useState<PoolStatus | 'all'>('all');
  const [tier, setTier] = useState<ForecasterTier | 'all'>('all');
  const [sortBy, setSortBy] = useState('tvl');

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);

  // In demo mode, allow creating pools even if eligibility API fails (for testing)
  const canCreatePool = isDemo
    ? isAuthenticated && walletAddress // Demo: just need to be connected
    : isAuthenticated && eligibility?.eligible; // Production: need eligibility check

  // Fetch pools
  const { pools, loading, error, refetch: refetchPools } = usePools({
    status: status === 'all' ? undefined : status,
    tier: tier === 'all' ? undefined : tier,
    sortBy: sortBy as any,
    sortOrder: 'desc',
    limit: 50,
  });

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f16', padding: '120px 24px 48px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
              Forecaster Pools
            </h1>
            <p style={{ fontSize: '16px', color: 'rgba(255, 255, 255, 0.6)', maxWidth: '500px' }}>
              Delegate capital to skilled forecasters and earn returns based on their prediction accuracy.
            </p>
          </div>

          {canCreatePool && (
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
                border: 'none',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <PlusIcon />
              Create Pool
            </button>
          )}
        </div>

        {/* Eligibility Banner (if not eligible) - only show in production mode */}
        {!isDemo && isAuthenticated && eligibility && !eligibility.eligible && (
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <ShieldIcon />
            <div>
              <div style={{ color: '#F59E0B', fontWeight: 500, marginBottom: '4px' }}>
                Not eligible to create a pool yet
              </div>
              <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>
                {eligibility.reason}
              </div>
            </div>
          </div>
        )}

        {/* Debug Banner for Demo Mode */}
        {isDemo && (
          <div
            style={{
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '16px',
              fontSize: '12px',
              fontFamily: 'monospace',
              color: 'rgba(255, 255, 255, 0.7)',
            }}
          >
            <strong style={{ color: '#8B5CF6' }}>Demo Mode</strong> |
            Wallet: {isAuthenticated ? walletAddress?.slice(0, 8) + '...' : 'Not connected'} |
            canCreatePool: {canCreatePool ? 'true' : 'false'}
          </div>
        )}

        {/* Connect Wallet Banner */}
        {!isAuthenticated && (
          <div
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <WalletIcon />
            <div style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
              Connect your wallet to delegate to pools or check your eligibility to create one.
            </div>
          </div>
        )}

        {/* Portfolio Summary */}
        {isAuthenticated && <PortfolioSummary isDemo={isDemo} />}

        {/* Filters */}
        <Filters
          status={status}
          setStatus={setStatus}
          tier={tier}
          setTier={setTier}
          sortBy={sortBy}
          setSortBy={setSortBy}
        />

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '48px', color: 'rgba(255, 255, 255, 0.5)' }}>
            Loading pools...
          </div>
        )}

        {/* Error State */}
        {error && (
          <div
            style={{
              textAlign: 'center',
              padding: '48px',
              color: '#EF4444',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '12px',
            }}
          >
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && pools.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '64px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <h3 style={{ fontSize: '20px', color: '#fff', marginBottom: '8px' }}>No pools found</h3>
            <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '24px' }}>
              Be the first to create a forecaster pool and start earning performance fees.
            </p>
            {canCreatePool && (
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <PlusIcon />
                Create Pool
              </button>
            )}
          </div>
        )}

        {/* Pool Grid */}
        {!loading && !error && pools.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              gap: '20px',
            }}
          >
            {pools.map((pool) => (
              <PoolCard key={pool.id} pool={pool} isDemo={isDemo} />
            ))}
          </div>
        )}
      </div>

      {/* Create Pool Modal */}
      <CreatePoolModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(signature) => {
          console.log('Pool created:', signature);
          setShowCreateModal(false);
          // Refresh the pools list after successful creation
          // Small delay to ensure blockchain has confirmed
          setTimeout(() => {
            refetchPools();
          }, 1000);
        }}
      />
    </div>
  );
}
