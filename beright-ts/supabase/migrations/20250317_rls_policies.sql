-- ============================================================================
-- Row Level Security (RLS) Policies for BeRight Protocol
-- ============================================================================
-- This migration configures comprehensive RLS policies for all tables.
-- BeRight uses wallet-based auth (Privy), so we use service_role for
-- backend operations and anon for public read access.

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

-- Core tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Whale tracking
ALTER TABLE whale_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE whale_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE arbitrage_history ENABLE ROW LEVEL SECURITY;

-- Signals
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_subscriptions ENABLE ROW LEVEL SECURITY;

-- Forecaster profiles
ALTER TABLE forecaster_profiles ENABLE ROW LEVEL SECURITY;

-- Channels
ALTER TABLE signal_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_signals ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DROP EXISTING POLICIES (to avoid conflicts)
-- ============================================================================

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename, schemaname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
            pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- ============================================================================
-- USERS TABLE
-- ============================================================================

-- Service role has full access (backend operations)
CREATE POLICY "Service role full access on users"
  ON users FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Public can read basic user profiles (for leaderboard)
CREATE POLICY "Public read on users"
  ON users FOR SELECT
  USING (true);

-- ============================================================================
-- PREDICTIONS TABLE
-- ============================================================================

-- Service role has full access
CREATE POLICY "Service role full access on predictions"
  ON predictions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Public can read resolved predictions (for leaderboard/profiles)
CREATE POLICY "Public read resolved predictions"
  ON predictions FOR SELECT
  USING (resolved_at IS NOT NULL);

-- ============================================================================
-- ALERTS TABLE
-- ============================================================================

-- Service role only (user-specific, no public access)
CREATE POLICY "Service role full access on alerts"
  ON alerts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- WATCHLIST TABLE
-- ============================================================================

-- Service role only (user-specific, no public access)
CREATE POLICY "Service role full access on watchlist"
  ON watchlist FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- SESSIONS TABLE
-- ============================================================================

-- Service role only (sensitive session data)
CREATE POLICY "Service role full access on sessions"
  ON sessions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- WHALE WALLETS TABLE
-- ============================================================================

-- Service role has full access
CREATE POLICY "Service role full access on whale_wallets"
  ON whale_wallets FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Public can read whale wallet data
CREATE POLICY "Public read on whale_wallets"
  ON whale_wallets FOR SELECT
  USING (true);

-- ============================================================================
-- WHALE TRADES TABLE
-- ============================================================================

-- Service role has full access
CREATE POLICY "Service role full access on whale_trades"
  ON whale_trades FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Public can read whale trades
CREATE POLICY "Public read on whale_trades"
  ON whale_trades FOR SELECT
  USING (true);

-- ============================================================================
-- ARBITRAGE HISTORY TABLE
-- ============================================================================

-- Service role has full access
CREATE POLICY "Service role full access on arbitrage_history"
  ON arbitrage_history FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Public can read arbitrage history
CREATE POLICY "Public read on arbitrage_history"
  ON arbitrage_history FOR SELECT
  USING (true);

-- ============================================================================
-- SIGNALS TABLE
-- ============================================================================

-- Service role has full access
CREATE POLICY "Service role full access on signals"
  ON signals FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Public can read actionable signals (not skipped)
CREATE POLICY "Public read actionable signals"
  ON signals FOR SELECT
  USING (action != 'SKIP');

-- ============================================================================
-- SIGNAL SUBSCRIPTIONS TABLE
-- ============================================================================

-- Service role only (user-specific subscriptions)
CREATE POLICY "Service role full access on signal_subscriptions"
  ON signal_subscriptions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- FORECASTER PROFILES TABLE
-- ============================================================================

-- Service role has full access
CREATE POLICY "Service role full access on forecaster_profiles"
  ON forecaster_profiles FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Public can read public profiles
CREATE POLICY "Public read public forecaster profiles"
  ON forecaster_profiles FOR SELECT
  USING (is_public = true);

-- ============================================================================
-- SIGNAL CHANNELS TABLE
-- ============================================================================

-- Service role has full access
CREATE POLICY "Service role full access on signal_channels"
  ON signal_channels FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Public can read active channels
CREATE POLICY "Public read active signal channels"
  ON signal_channels FOR SELECT
  USING (is_active = true);

-- ============================================================================
-- CHANNEL SUBSCRIPTIONS TABLE
-- ============================================================================

-- Service role only (user-specific)
CREATE POLICY "Service role full access on channel_subscriptions"
  ON channel_subscriptions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- CHANNEL SIGNALS TABLE
-- ============================================================================

-- Service role has full access
CREATE POLICY "Service role full access on channel_signals"
  ON channel_signals FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Public can read channel signals (forecasts are public once published)
CREATE POLICY "Public read channel signals"
  ON channel_signals FOR SELECT
  USING (true);

-- ============================================================================
-- ADDITIONAL TABLES FROM MIGRATIONS
-- ============================================================================

-- Enable RLS on tables from other migrations (if they exist)
DO $$
BEGIN
  -- Momentum engine tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'momentum_signals') THEN
    ALTER TABLE momentum_signals ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Service role full access on momentum_signals"
      ON momentum_signals FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
    CREATE POLICY "Public read on momentum_signals"
      ON momentum_signals FOR SELECT
      USING (true);
  END IF;

  -- Social listener tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'social_mentions') THEN
    ALTER TABLE social_mentions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Service role full access on social_mentions"
      ON social_mentions FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
    CREATE POLICY "Public read on social_mentions"
      ON social_mentions FOR SELECT
      USING (true);
  END IF;

  -- Synthesis reports tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'synthesis_reports') THEN
    ALTER TABLE synthesis_reports ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Service role full access on synthesis_reports"
      ON synthesis_reports FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
    CREATE POLICY "Public read on synthesis_reports"
      ON synthesis_reports FOR SELECT
      USING (true);
  END IF;

  -- Forecaster network tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'forecaster_calibration') THEN
    ALTER TABLE forecaster_calibration ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Service role full access on forecaster_calibration"
      ON forecaster_calibration FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
    CREATE POLICY "Public read on forecaster_calibration"
      ON forecaster_calibration FOR SELECT
      USING (true);
  END IF;

  -- Platform imports tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_imports') THEN
    ALTER TABLE platform_imports ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Service role full access on platform_imports"
      ON platform_imports FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  -- Credit profiles tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_profiles') THEN
    ALTER TABLE credit_profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Service role full access on credit_profiles"
      ON credit_profiles FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
    CREATE POLICY "Public read on credit_profiles"
      ON credit_profiles FOR SELECT
      USING (true);
  END IF;

  -- Conviction pools tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conviction_pools') THEN
    ALTER TABLE conviction_pools ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Service role full access on conviction_pools"
      ON conviction_pools FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
    CREATE POLICY "Public read active pools"
      ON conviction_pools FOR SELECT
      USING (status = 'active');
  END IF;

  -- Historical delegation table retained for old deployments only.
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pool_delegations') THEN
    ALTER TABLE pool_delegations ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Service role full access on pool_delegations"
      ON pool_delegations FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Create a function to verify RLS is enabled on all tables
CREATE OR REPLACE FUNCTION verify_rls_enabled()
RETURNS TABLE(table_name text, rls_enabled boolean) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.relname::text as table_name,
    t.relrowsecurity as rls_enabled
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relkind = 'r'  -- regular tables only
  ORDER BY t.relname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run verification
-- SELECT * FROM verify_rls_enabled();

COMMENT ON FUNCTION verify_rls_enabled IS 'Returns all public tables and their RLS status. Run: SELECT * FROM verify_rls_enabled();';
