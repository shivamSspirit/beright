-- Yield Tracking Schema for BeRight Protocol
-- P2: Outcome-Conditioned Yield + P8: Conviction Pools
-- Status: Historical schema only. Yield/vault routes were retired from active scope.

-- ============================================================================
-- YIELD DEPOSITS
-- ============================================================================

CREATE TABLE IF NOT EXISTS yield_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id TEXT NOT NULL,
  depositor TEXT NOT NULL,               -- Wallet pubkey
  token TEXT NOT NULL,                    -- USDC, SOL, USDT
  protocol TEXT NOT NULL DEFAULT 'meteora',

  -- Amounts (stored as TEXT for bigint precision)
  amount TEXT NOT NULL,
  lp_tokens_received TEXT NOT NULL,
  virtual_price_at_deposit DECIMAL(20, 10) NOT NULL,

  -- Transaction
  tx_signature TEXT,
  block_time TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, failed

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX idx_yield_deposits_pool ON yield_deposits(pool_id);
CREATE INDEX idx_yield_deposits_depositor ON yield_deposits(depositor);
CREATE INDEX idx_yield_deposits_token ON yield_deposits(token);
CREATE INDEX idx_yield_deposits_status ON yield_deposits(status);
CREATE INDEX idx_yield_deposits_created ON yield_deposits(created_at DESC);

-- ============================================================================
-- YIELD WITHDRAWALS
-- ============================================================================

CREATE TABLE IF NOT EXISTS yield_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id TEXT NOT NULL,
  withdrawer TEXT NOT NULL,
  token TEXT NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'meteora',

  -- Amounts
  amount_requested TEXT NOT NULL,
  amount_received TEXT NOT NULL,
  lp_tokens_burned TEXT NOT NULL,
  virtual_price_at_withdrawal DECIMAL(20, 10) NOT NULL,

  -- Yield calculation
  yield_realized TEXT NOT NULL,
  yield_percent DECIMAL(10, 4) NOT NULL DEFAULT 0,

  -- Transaction
  tx_signature TEXT,
  block_time TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX idx_yield_withdrawals_pool ON yield_withdrawals(pool_id);
CREATE INDEX idx_yield_withdrawals_withdrawer ON yield_withdrawals(withdrawer);
CREATE INDEX idx_yield_withdrawals_token ON yield_withdrawals(token);

-- ============================================================================
-- YIELD POSITIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS yield_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id TEXT NOT NULL,
  "user" TEXT NOT NULL,
  token TEXT NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'meteora',

  -- Current state
  total_deposited TEXT NOT NULL DEFAULT '0',
  total_withdrawn TEXT NOT NULL DEFAULT '0',
  current_lp_balance TEXT NOT NULL DEFAULT '0',
  current_value TEXT NOT NULL DEFAULT '0',

  -- Yield metrics
  total_yield_earned TEXT NOT NULL DEFAULT '0',
  unrealized_yield TEXT NOT NULL DEFAULT '0',
  avg_entry_price DECIMAL(20, 10) NOT NULL DEFAULT 1.0,

  -- Stats
  deposit_count INTEGER NOT NULL DEFAULT 0,
  withdrawal_count INTEGER NOT NULL DEFAULT 0,
  first_deposit_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(pool_id, "user", token, protocol)
);

CREATE INDEX idx_yield_positions_pool ON yield_positions(pool_id);
CREATE INDEX idx_yield_positions_user ON yield_positions("user");
CREATE INDEX idx_yield_positions_lp_balance ON yield_positions(current_lp_balance) WHERE current_lp_balance != '0';

-- ============================================================================
-- YIELD SNAPSHOTS (Daily)
-- ============================================================================

CREATE TABLE IF NOT EXISTS yield_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id TEXT NOT NULL,
  token TEXT NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'meteora',
  snapshot_date DATE NOT NULL,

  -- Pool state
  total_deposited TEXT NOT NULL,
  total_lp_supply TEXT NOT NULL,
  virtual_price DECIMAL(20, 10) NOT NULL,

  -- Daily metrics
  daily_yield TEXT NOT NULL DEFAULT '0',
  daily_yield_percent DECIMAL(10, 6) NOT NULL DEFAULT 0,
  cumulative_yield TEXT NOT NULL DEFAULT '0',

  -- APY calculation
  apy_7d DECIMAL(10, 6) NOT NULL DEFAULT 0,
  apy_30d DECIMAL(10, 6) NOT NULL DEFAULT 0,
  apy_all_time DECIMAL(10, 6) NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(pool_id, snapshot_date)
);

CREATE INDEX idx_yield_snapshots_pool_date ON yield_snapshots(pool_id, snapshot_date DESC);

-- ============================================================================
-- VAULT HEALTH METRICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS vault_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'meteora',

  -- Health indicators
  status TEXT NOT NULL, -- healthy, degraded, critical
  withdrawable_amount TEXT NOT NULL,
  total_tvl TEXT NOT NULL,
  utilization_rate DECIMAL(10, 6) NOT NULL DEFAULT 0,

  -- Risk metrics
  largest_strategy_allocation DECIMAL(10, 6) NOT NULL DEFAULT 0,
  strategy_count INTEGER NOT NULL DEFAULT 0,
  staleness_seconds INTEGER NOT NULL DEFAULT 0,

  -- Performance
  current_apy DECIMAL(10, 6) NOT NULL DEFAULT 0,
  virtual_price DECIMAL(20, 10) NOT NULL DEFAULT 1.0,
  price_change_24h DECIMAL(10, 6) NOT NULL DEFAULT 0,

  -- Alerts
  alerts TEXT[] DEFAULT '{}',

  -- Timestamps
  checked_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vault_health_token ON vault_health_metrics(token);
CREATE INDEX idx_vault_health_checked ON vault_health_metrics(checked_at DESC);

-- ============================================================================
-- REBALANCE EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS rebalance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id TEXT NOT NULL,
  token TEXT NOT NULL,

  -- Before state
  yield_bps_before INTEGER NOT NULL,
  reserve_bps_before INTEGER NOT NULL,
  active_bps_before INTEGER NOT NULL,

  -- After state
  yield_bps_after INTEGER NOT NULL,
  reserve_bps_after INTEGER NOT NULL,
  active_bps_after INTEGER NOT NULL,

  -- Actions taken (JSON array)
  actions JSONB NOT NULL DEFAULT '[]',

  -- Trigger
  trigger_reason TEXT NOT NULL, -- drift, withdrawal, deposit, manual
  triggered_by TEXT,

  -- Transaction
  tx_signature TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_rebalance_pool ON rebalance_events(pool_id);
CREATE INDEX idx_rebalance_created ON rebalance_events(created_at DESC);

-- ============================================================================
-- AFFILIATE FEES
-- ============================================================================

CREATE TABLE IF NOT EXISTS affiliate_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_signature TEXT NOT NULL,
  vault_token TEXT NOT NULL,
  volume_routed TEXT NOT NULL,
  fee_earned TEXT NOT NULL,
  "user" TEXT NOT NULL,
  partner_id TEXT NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_affiliate_fees_partner ON affiliate_fees(partner_id);
CREATE INDEX idx_affiliate_fees_created ON affiliate_fees(created_at DESC);

-- ============================================================================
-- AFFILIATE PARTNERSHIPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS affiliate_partnerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol TEXT NOT NULL UNIQUE,
  affiliate_id TEXT NOT NULL,
  partner_name TEXT NOT NULL,

  -- Fee sharing
  fee_share_bps INTEGER NOT NULL DEFAULT 0,
  total_fees_earned TEXT NOT NULL DEFAULT '0',
  total_volume_routed TEXT NOT NULL DEFAULT '0',

  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, paused
  verified_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE yield_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE yield_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE yield_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE yield_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebalance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_partnerships ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access on yield_deposits"
  ON yield_deposits FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on yield_withdrawals"
  ON yield_withdrawals FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on yield_positions"
  ON yield_positions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on yield_snapshots"
  ON yield_snapshots FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on vault_health_metrics"
  ON vault_health_metrics FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on rebalance_events"
  ON rebalance_events FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on affiliate_fees"
  ON affiliate_fees FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on affiliate_partnerships"
  ON affiliate_partnerships FOR ALL
  USING (auth.role() = 'service_role');

-- Public read access for health metrics and snapshots
CREATE POLICY "Public read access on vault_health_metrics"
  ON vault_health_metrics FOR SELECT
  USING (true);

CREATE POLICY "Public read access on yield_snapshots"
  ON yield_snapshots FOR SELECT
  USING (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE yield_deposits IS 'Tracks all deposits into Meteora vaults via BeRight';
COMMENT ON TABLE yield_withdrawals IS 'Tracks all withdrawals from Meteora vaults';
COMMENT ON TABLE yield_positions IS 'Aggregated position state per user per pool';
COMMENT ON TABLE yield_snapshots IS 'Daily snapshots for APY calculation and analytics';
COMMENT ON TABLE vault_health_metrics IS 'Health monitoring data for vaults';
COMMENT ON TABLE rebalance_events IS 'Record of rebalancing actions';
COMMENT ON TABLE affiliate_fees IS 'Fee tracking for Meteora affiliate program';
COMMENT ON TABLE affiliate_partnerships IS 'Partner configuration for affiliate programs';
