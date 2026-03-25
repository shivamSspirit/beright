/**
 * Pool Detail Page
 *
 * Shows pool information, stats, and actions (stake/unstake/manage).
 *
 * @author BeRight Protocol
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/hooks/useUnifiedUser';
import { useMode } from '@/context/ModeContext';
import { StakeModal } from '@/components/StakeModal';
import { UnstakeModal } from '@/components/UnstakeModal';

// ============================================================================
// Types
// ============================================================================

interface PoolDetails {
  id: string;
  poolPda: string;
  name: string;
  forecasterWallet: string;
  forecasterTier: string;
  forecasterBrier: number | null;
  status: string;
  tvl: number;
  navPerShare: number;
  delegatorCount: number;
  performanceFeeBps: number;
  managementFeeBps?: number;
  minDeposit?: number;
  maxCapacity?: number;
  baseToken?: 'SOL' | 'USDC'; // Actual token from on-chain state
  createdAt: string;
}

interface UserDelegation {
  shares: number;
  value: number;
  pnl: number;
  pnlPercent: number;
  depositedAt: string;
  lockupComplete: boolean;
}

// ============================================================================
// Icons
// ============================================================================

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const TrendUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 6l-9.5 9.5-5-5L1 18" />
    <path d="M17 6h6v6" />
  </svg>
);

const UsersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

// ============================================================================
// Helpers
// ============================================================================

function formatTvl(tvl: number, token: 'SOL' | 'USDC' = 'USDC'): string {
  if (token === 'SOL') {
    // Display as SOL
    if (tvl >= 1_000) return `${(tvl / 1_000).toFixed(2)}K SOL`;
    return `${tvl.toFixed(4)} SOL`;
  }
  // Display as USD
  if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(2)}M`;
  if (tvl >= 1_000) return `$${(tvl / 1_000).toFixed(1)}K`;
  return `$${tvl.toFixed(2)}`;
}

function formatPercent(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

const TIER_COLORS: Record<string, string> = {
  super: '#FFD700',
  elite: '#C0C0C0',
  verified: '#4CAF50',
  rookie: '#2196F3',
  unranked: '#9E9E9E',
};

const TIER_LABELS: Record<string, string> = {
  super: 'Super Forecaster',
  elite: 'Elite',
  verified: 'Verified',
  rookie: 'Rookie',
  unranked: 'Unranked',
};

// ============================================================================
// Main Component
// ============================================================================

export default function PoolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const poolId = params.poolId as string;

  const { isAuthenticated, walletAddress } = useUser();
  const { isDemo } = useMode();

  const [pool, setPool] = useState<PoolDetails | null>(null);
  const [userDelegation, setUserDelegation] = useState<UserDelegation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [showUnstakeModal, setShowUnstakeModal] = useState(false);

  // Check if current user is the pool owner
  const isOwner = walletAddress && pool?.forecasterWallet === walletAddress;

  // Fetch pool details
  const fetchPool = useCallback(async () => {
    if (!poolId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch pool from delegation API
      const res = await fetch(`/api/v2/delegation/pools/${poolId}`);
      const data = await res.json();

      if (data.success && data.data) {
        setPool(data.data);
      } else {
        // Try fetching from forecast-pools API as fallback
        const res2 = await fetch(`/api/v2/forecast-pools?address=${poolId}`);
        const data2 = await res2.json();

        if (data2.success && data2.data?.pools?.length > 0) {
          const p = data2.data.pools[0];
          setPool({
            id: p.address,
            poolPda: p.address,
            name: p.tier?.name || `Pool ${p.address.slice(0, 8)}...`,
            forecasterWallet: p.forecaster,
            forecasterTier: p.tier?.isPro ? 'verified' : 'rookie',
            forecasterBrier: null,
            status: p.status || 'open',
            tvl: p.tvl || 0,
            navPerShare: p.sharePrice ? p.sharePrice / 1_000_000 : 1,
            delegatorCount: p.delegatorCount || 0,
            performanceFeeBps: 2000,
            createdAt: p.createdAt || new Date().toISOString(),
          });
        } else {
          setError('Pool not found');
        }
      }
    } catch (err) {
      console.error('Failed to fetch pool:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch pool');
    } finally {
      setLoading(false);
    }
  }, [poolId]);

  useEffect(() => {
    fetchPool();
  }, [fetchPool]);

  // Fetch user delegation if authenticated
  useEffect(() => {
    if (!isAuthenticated || !walletAddress || !pool) {
      setUserDelegation(null);
      return;
    }

    // TODO: Fetch user's delegation from on-chain
    // For now, set to null (no delegation)
    setUserDelegation(null);
  }, [isAuthenticated, walletAddress, pool]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0f16', padding: '120px 24px 48px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Loading pool...</div>
        </div>
      </div>
    );
  }

  if (error || !pool) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0f16', padding: '120px 24px 48px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>404</div>
          <h1 style={{ fontSize: '24px', color: '#fff', marginBottom: '8px' }}>Pool Not Found</h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.5)', marginBottom: '24px' }}>
            {error || 'The pool you are looking for does not exist.'}
          </p>
          <Link
            href="/pools"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: '#3B82F6',
              borderRadius: '12px',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            <BackIcon />
            Back to Pools
          </Link>
        </div>
      </div>
    );
  }

  const tierColor = TIER_COLORS[pool.forecasterTier] || '#9E9E9E';
  const tierLabel = TIER_LABELS[pool.forecasterTier] || 'Unknown';
  const returnPercent = (pool.navPerShare - 1) * 100;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f16', padding: '120px 24px 48px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Back Link */}
        <Link
          href="/pools"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: 'rgba(255, 255, 255, 0.6)',
            textDecoration: 'none',
            marginBottom: '24px',
            fontSize: '14px',
          }}
        >
          <BackIcon />
          Back to Pools
        </Link>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>{pool.name}</h1>
            <span
              style={{
                fontSize: '12px',
                padding: '4px 10px',
                borderRadius: '6px',
                background: pool.status === 'open' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.1)',
                color: pool.status === 'open' ? '#10B981' : 'rgba(255, 255, 255, 0.6)',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              {pool.status}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {/* Tier Badge */}
            <span
              style={{
                fontSize: '13px',
                padding: '4px 12px',
                borderRadius: '6px',
                background: `${tierColor}20`,
                color: tierColor,
                fontWeight: 500,
              }}
            >
              {tierLabel}
            </span>

            {/* Forecaster Address */}
            <a
              href={`https://explorer.solana.com/address/${pool.forecasterWallet}?cluster=${isDemo ? 'devnet' : 'mainnet'}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                color: 'rgba(255, 255, 255, 0.5)',
                textDecoration: 'none',
              }}
            >
              Forecaster: {pool.forecasterWallet.slice(0, 8)}...{pool.forecasterWallet.slice(-4)}
              <ExternalLinkIcon />
            </a>

            {/* Pool Address */}
            <a
              href={`https://explorer.solana.com/address/${pool.poolPda}?cluster=${isDemo ? 'devnet' : 'mainnet'}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                color: 'rgba(255, 255, 255, 0.5)',
                textDecoration: 'none',
              }}
            >
              Pool: {pool.poolPda.slice(0, 8)}...{pool.poolPda.slice(-4)}
              <ExternalLinkIcon />
            </a>
          </div>
        </div>

        {/* Owner Badge */}
        {isOwner && (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.1))',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '14px', color: '#8B5CF6', fontWeight: 500 }}>
              You own this pool
            </span>
          </div>
        )}

        {/* Stats Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          <StatCard
            label="Total Value Locked"
            value={formatTvl(pool.tvl, pool.baseToken || 'USDC')}
            icon={<TrendUpIcon />}
          />
          <StatCard
            label="NAV per Share"
            value={pool.navPerShare.toFixed(4)}
            subValue={formatPercent(returnPercent)}
            subColor={returnPercent >= 0 ? '#10B981' : '#EF4444'}
          />
          <StatCard
            label="Delegators"
            value={pool.delegatorCount.toString()}
            icon={<UsersIcon />}
          />
          <StatCard
            label="Performance Fee"
            value={`${pool.performanceFeeBps / 100}%`}
          />
          {pool.forecasterBrier !== null && (
            <StatCard
              label="Brier Score"
              value={pool.forecasterBrier.toFixed(3)}
            />
          )}
        </div>

        {/* User Delegation Section */}
        {isAuthenticated && userDelegation && (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.05))',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '32px',
            }}
          >
            <h3 style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '16px', textTransform: 'uppercase' }}>
              Your Position
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '24px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '4px' }}>Shares</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#fff' }}>{userDelegation.shares.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '4px' }}>Value</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#fff' }}>{formatTvl(userDelegation.value, pool.baseToken || 'USDC')}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '4px' }}>P&L</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: userDelegation.pnl >= 0 ? '#10B981' : '#EF4444' }}>
                  {formatTvl(userDelegation.pnl, pool.baseToken || 'USDC')} ({formatPercent(userDelegation.pnlPercent)})
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {!isOwner && pool.status === 'open' && (
            <button
              onClick={() => setShowStakeModal(true)}
              disabled={!isAuthenticated}
              style={{
                flex: 1,
                minWidth: '200px',
                padding: '16px 24px',
                background: isAuthenticated ? 'linear-gradient(135deg, #3B82F6, #8B5CF6)' : 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '16px',
                fontWeight: 600,
                cursor: isAuthenticated ? 'pointer' : 'not-allowed',
                opacity: isAuthenticated ? 1 : 0.5,
              }}
            >
              {isAuthenticated ? 'Stake to Pool' : 'Connect Wallet to Stake'}
            </button>
          )}

          {userDelegation && userDelegation.shares > 0 && (
            <button
              onClick={() => setShowUnstakeModal(true)}
              style={{
                flex: 1,
                minWidth: '200px',
                padding: '16px 24px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                color: '#EF4444',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Withdraw
            </button>
          )}

          {isOwner && (
            <>
              <button
                style={{
                  flex: 1,
                  minWidth: '200px',
                  padding: '16px 24px',
                  background: 'rgba(139, 92, 246, 0.1)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '12px',
                  color: '#8B5CF6',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Update NAV
              </button>
              <button
                style={{
                  flex: 1,
                  minWidth: '200px',
                  padding: '16px 24px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '12px',
                  color: '#10B981',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Collect Fees
              </button>
            </>
          )}
        </div>

        {/* Pool Info */}
        <div
          style={{
            marginTop: '32px',
            padding: '24px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
          }}
        >
          <h3 style={{ fontSize: '16px', color: '#fff', marginBottom: '16px' }}>Pool Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <InfoRow label="Created" value={new Date(pool.createdAt).toLocaleDateString()} />
            <InfoRow label="Lock Period" value="7 days" />
            <InfoRow label="Withdrawal Fee" value="0.5%" />
            <InfoRow label="Early Withdrawal Fee" value="2%" />
            {pool.minDeposit && <InfoRow label="Min Deposit" value={formatTvl(pool.minDeposit, pool.baseToken || 'USDC')} />}
            {pool.maxCapacity && <InfoRow label="Max Capacity" value={formatTvl(pool.maxCapacity, pool.baseToken || 'USDC')} />}
            {pool.baseToken && <InfoRow label="Base Token" value={pool.baseToken} />}
          </div>
        </div>
      </div>

      {/* Stake Modal */}
      <StakeModal
        isOpen={showStakeModal}
        onClose={() => setShowStakeModal(false)}
        poolAddress={pool.poolPda}
        poolName={pool.name}
        token={pool.baseToken || 'USDC'}
        minDeposit={(pool.baseToken === 'SOL') ? (pool.minDeposit || 0.1) * 1e9 : (pool.minDeposit || 5) * 1e6}
        currentTvl={(pool.baseToken === 'SOL') ? pool.tvl * 1e9 : pool.tvl * 1e6}
        maxCapacity={(pool.baseToken === 'SOL') ? (pool.maxCapacity || 100) * 1e9 : (pool.maxCapacity || 100000) * 1e6}
        onSuccess={(signature) => {
          console.log('Stake success:', signature);
          setShowStakeModal(false);
          fetchPool();
        }}
      />

      {/* Unstake Modal */}
      <UnstakeModal
        isOpen={showUnstakeModal}
        onClose={() => setShowUnstakeModal(false)}
        poolAddress={pool.poolPda}
        poolName={pool.name}
        token={pool.baseToken || 'USDC'}
        delegation={userDelegation ? {
          poolAddress: pool.poolPda,
          shares: userDelegation.shares * 1e6,
          value: userDelegation.value * 1e6,
          valueDisplay: formatTvl(userDelegation.value, pool.baseToken || 'USDC'),
          pnl: userDelegation.pnl * 1e6,
          pnlPct: userDelegation.pnlPercent,
          pnlDisplay: `${userDelegation.pnl >= 0 ? '+' : ''}${formatTvl(userDelegation.pnl, pool.baseToken || 'USDC')}`,
          depositedAt: new Date(userDelegation.depositedAt),
          lockupComplete: userDelegation.lockupComplete,
          withdrawalFeeRate: userDelegation.lockupComplete ? 50 : 200,
        } : null}
        onSuccess={(signature) => {
          console.log('Unstake success:', signature);
          setShowUnstakeModal(false);
          fetchPool();
        }}
      />
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({
  label,
  value,
  subValue,
  subColor,
  icon,
}: {
  label: string;
  value: string;
  subValue?: string;
  subColor?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(20, 25, 35, 0.9), rgba(15, 20, 30, 0.95))',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '20px',
      }}
    >
      <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '8px', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {icon && <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>{icon}</span>}
        <span style={{ fontSize: '24px', fontWeight: 600, color: '#fff' }}>{value}</span>
      </div>
      {subValue && (
        <div style={{ fontSize: '14px', color: subColor || '#10B981', marginTop: '4px' }}>
          {subValue}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.5)' }}>{label}</span>
      <span style={{ fontSize: '14px', color: '#fff' }}>{value}</span>
    </div>
  );
}
