-- Migration: 009_forecaster_pools
-- Description: Tables for forecaster delegation pools
-- Created: 2026-03-21

-- ============================================================================
-- FORECASTER POOLS
-- ============================================================================
-- Mirrors on-chain StakingPoolState with additional metadata

CREATE TABLE IF NOT EXISTS forecaster_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- On-chain references
  pool_pda TEXT UNIQUE NOT NULL,
  pool_mint TEXT NOT NULL,
  forecaster_wallet TEXT NOT NULL,

  -- Pool configuration
  pool_type TEXT NOT NULL DEFAULT 'alpha_vault',
  base_token TEXT NOT NULL,
  min_deposit BIGINT NOT NULL DEFAULT 100000000,
  max_capacity BIGINT NOT NULL,

  -- Fees (basis points)
  performance_fee_bps INT NOT NULL DEFAULT 2000,
  management_fee_bps INT NOT NULL DEFAULT 200,
  entry_fee_bps INT DEFAULT 0,
  exit_fee_bps INT DEFAULT 25,

  -- State (synced from on-chain)
  status TEXT NOT NULL DEFAULT 'open',
  nav_per_share BIGINT NOT NULL DEFAULT 1000000000,
  high_water_mark BIGINT NOT NULL DEFAULT 1000000000,
  total_deposits BIGINT DEFAULT 0,
  total_shares BIGINT DEFAULT 0,
  depositor_count INT DEFAULT 0,
  available_liquidity BIGINT DEFAULT 0,
  pending_withdrawals BIGINT DEFAULT 0,

  -- Forecaster reputation (cached from Brier system)
  forecaster_brier DECIMAL,
  forecaster_predictions INT,
  forecaster_tier TEXT,

  -- Metadata
  name TEXT,
  description TEXT,
  slug TEXT UNIQUE,
  avatar_url TEXT,

  -- DeFi integrations state
  meteora_allocation_bps INT DEFAULT 0,
  meteora_deposited BIGINT DEFAULT 0,
  dlmm_active BOOLEAN DEFAULT FALSE,
  drift_active BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ
);

-- ============================================================================
-- POOL DELEGATIONS
-- ============================================================================
-- Individual depositor positions in pools

CREATE TABLE IF NOT EXISTS pool_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  pool_id UUID REFERENCES forecaster_pools(id) ON DELETE CASCADE,
  depositor_pda TEXT NOT NULL,
  delegator_wallet TEXT NOT NULL,

  -- Position
  shares BIGINT NOT NULL DEFAULT 0,
  deposited_amount BIGINT NOT NULL DEFAULT 0,
  entry_nav BIGINT NOT NULL,
  avg_entry_price BIGINT DEFAULT 0,

  -- P&L tracking
  current_value BIGINT DEFAULT 0,
  unrealized_pnl BIGINT DEFAULT 0,
  realized_pnl BIGINT DEFAULT 0,

  -- Withdrawal queue
  withdrawal_requested BIGINT DEFAULT 0,
  withdrawal_request_ts TIMESTAMPTZ,
  withdrawable_after TIMESTAMPTZ,

  -- Rewards
  claimed_rewards BIGINT DEFAULT 0,
  pending_rewards BIGINT DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'active',

  -- Timestamps
  first_deposit_at TIMESTAMPTZ DEFAULT NOW(),
  last_deposit_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,

  UNIQUE(pool_id, delegator_wallet)
);

-- ============================================================================
-- NAV HISTORY
-- ============================================================================
-- Time series for pool performance charts

CREATE TABLE IF NOT EXISTS pool_nav_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES forecaster_pools(id) ON DELETE CASCADE,

  nav_per_share BIGINT NOT NULL,
  total_value BIGINT NOT NULL,
  total_shares BIGINT NOT NULL,
  depositor_count INT DEFAULT 0,

  -- Source of update
  source TEXT DEFAULT 'sync', -- sync, forecaster_update, fee_collection
  tx_signature TEXT,

  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- POOL TRANSACTIONS
-- ============================================================================
-- Audit log of all pool operations

CREATE TABLE IF NOT EXISTS pool_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES forecaster_pools(id) ON DELETE CASCADE,
  delegator_wallet TEXT,

  tx_type TEXT NOT NULL, -- deposit, withdrawal_request, withdrawal_process, nav_update, fee_collection, meteora_deposit, meteora_withdraw

  -- Transaction details
  amount BIGINT,
  shares BIGINT,
  nav_at_tx BIGINT,
  fee_amount BIGINT,

  -- On-chain reference
  tx_signature TEXT,
  slot BIGINT,

  -- Status
  status TEXT DEFAULT 'confirmed', -- pending, confirmed, failed
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Pools
CREATE INDEX IF NOT EXISTS idx_pools_forecaster ON forecaster_pools(forecaster_wallet);
CREATE INDEX IF NOT EXISTS idx_pools_status ON forecaster_pools(status);
CREATE INDEX IF NOT EXISTS idx_pools_tier ON forecaster_pools(forecaster_tier);
CREATE INDEX IF NOT EXISTS idx_pools_slug ON forecaster_pools(slug);
CREATE INDEX IF NOT EXISTS idx_pools_total_deposits ON forecaster_pools(total_deposits DESC);

-- Delegations
CREATE INDEX IF NOT EXISTS idx_delegations_pool ON pool_delegations(pool_id);
CREATE INDEX IF NOT EXISTS idx_delegations_delegator ON pool_delegations(delegator_wallet);
CREATE INDEX IF NOT EXISTS idx_delegations_status ON pool_delegations(status);

-- NAV History
CREATE INDEX IF NOT EXISTS idx_nav_history_pool ON pool_nav_history(pool_id);
CREATE INDEX IF NOT EXISTS idx_nav_history_time ON pool_nav_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_nav_history_pool_time ON pool_nav_history(pool_id, recorded_at DESC);

-- Transactions
CREATE INDEX IF NOT EXISTS idx_transactions_pool ON pool_transactions(pool_id);
CREATE INDEX IF NOT EXISTS idx_transactions_delegator ON pool_transactions(delegator_wallet);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON pool_transactions(tx_type);
CREATE INDEX IF NOT EXISTS idx_transactions_time ON pool_transactions(created_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_forecaster_pools_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_forecaster_pools_updated_at
  BEFORE UPDATE ON forecaster_pools
  FOR EACH ROW
  EXECUTE FUNCTION update_forecaster_pools_updated_at();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Pool leaderboard view
CREATE OR REPLACE VIEW pool_leaderboard AS
SELECT
  p.id,
  p.slug,
  p.name,
  p.forecaster_wallet,
  p.forecaster_tier,
  p.forecaster_brier,
  p.total_deposits,
  p.nav_per_share,
  p.depositor_count,
  p.performance_fee_bps,
  p.management_fee_bps,
  p.status,
  p.created_at,
  -- Calculate returns
  CASE
    WHEN p.nav_per_share > 1000000000
    THEN ((p.nav_per_share::DECIMAL / 1000000000) - 1) * 100
    ELSE ((p.nav_per_share::DECIMAL / 1000000000) - 1) * 100
  END AS return_pct,
  -- TVL in human readable (assuming 6 decimal base token)
  p.total_deposits::DECIMAL / 1000000 AS tvl_usd
FROM forecaster_pools p
WHERE p.status IN ('open', 'active')
ORDER BY p.total_deposits DESC;

-- Delegator portfolio view
CREATE OR REPLACE VIEW delegator_portfolio AS
SELECT
  d.delegator_wallet,
  d.pool_id,
  p.slug AS pool_slug,
  p.name AS pool_name,
  p.forecaster_wallet,
  d.shares,
  d.deposited_amount,
  d.entry_nav,
  d.current_value,
  d.unrealized_pnl,
  d.realized_pnl,
  d.withdrawal_requested,
  d.withdrawable_after,
  d.status,
  -- Calculate current P&L percentage
  CASE
    WHEN d.deposited_amount > 0
    THEN ((d.current_value::DECIMAL / d.deposited_amount) - 1) * 100
    ELSE 0
  END AS pnl_pct
FROM pool_delegations d
JOIN forecaster_pools p ON p.id = d.pool_id
WHERE d.status = 'active' AND d.shares > 0;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE forecaster_pools IS 'Forecaster-managed delegation pools mirroring on-chain StakingPoolState';
COMMENT ON TABLE pool_delegations IS 'Individual delegator positions in pools';
COMMENT ON TABLE pool_nav_history IS 'NAV time series for performance charts';
COMMENT ON TABLE pool_transactions IS 'Audit log of all pool operations';

COMMENT ON COLUMN forecaster_pools.nav_per_share IS 'NAV per share scaled to 1e9 (1.0 = 1000000000)';
COMMENT ON COLUMN forecaster_pools.forecaster_tier IS 'unranked, rookie, verified, elite, super';
COMMENT ON COLUMN pool_delegations.entry_nav IS 'NAV at time of first deposit, for P&L calculation';
