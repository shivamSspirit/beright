-- ============================================================================
-- RLS Policies for BeRight Protocol
-- Only for existing tables: alerts, beright_events, portfolio_snapshots,
-- predictions, strategy_performance, trades, trading_settings,
-- trading_signals, users, watchlist
-- ============================================================================

-- =====================
-- USERS
-- =====================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_users_all" ON users;
DROP POLICY IF EXISTS "public_users_read" ON users;
CREATE POLICY "service_users_all" ON users FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_users_read" ON users FOR SELECT USING (true);

-- =====================
-- PREDICTIONS
-- =====================
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_predictions_all" ON predictions;
DROP POLICY IF EXISTS "public_predictions_read" ON predictions;
CREATE POLICY "service_predictions_all" ON predictions FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_predictions_read" ON predictions FOR SELECT USING (true);

-- =====================
-- ALERTS
-- =====================
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_alerts_all" ON alerts;
CREATE POLICY "service_alerts_all" ON alerts FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- =====================
-- WATCHLIST
-- =====================
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_watchlist_all" ON watchlist;
CREATE POLICY "service_watchlist_all" ON watchlist FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- =====================
-- BERIGHT_EVENTS
-- =====================
ALTER TABLE beright_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_events_all" ON beright_events;
DROP POLICY IF EXISTS "public_events_read" ON beright_events;
CREATE POLICY "service_events_all" ON beright_events FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_events_read" ON beright_events FOR SELECT USING (true);

-- =====================
-- TRADES
-- =====================
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_trades_all" ON trades;
DROP POLICY IF EXISTS "public_trades_read" ON trades;
CREATE POLICY "service_trades_all" ON trades FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_trades_read" ON trades FOR SELECT USING (true);

-- =====================
-- TRADING_SIGNALS
-- =====================
ALTER TABLE trading_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_trading_signals_all" ON trading_signals;
DROP POLICY IF EXISTS "public_trading_signals_read" ON trading_signals;
CREATE POLICY "service_trading_signals_all" ON trading_signals FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_trading_signals_read" ON trading_signals FOR SELECT USING (true);

-- =====================
-- TRADING_SETTINGS (private - service only)
-- =====================
ALTER TABLE trading_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_trading_settings_all" ON trading_settings;
CREATE POLICY "service_trading_settings_all" ON trading_settings FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- =====================
-- PORTFOLIO_SNAPSHOTS
-- =====================
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_portfolio_all" ON portfolio_snapshots;
DROP POLICY IF EXISTS "public_portfolio_read" ON portfolio_snapshots;
CREATE POLICY "service_portfolio_all" ON portfolio_snapshots FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_portfolio_read" ON portfolio_snapshots FOR SELECT USING (true);

-- =====================
-- STRATEGY_PERFORMANCE
-- =====================
ALTER TABLE strategy_performance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_strategy_all" ON strategy_performance;
DROP POLICY IF EXISTS "public_strategy_read" ON strategy_performance;
CREATE POLICY "service_strategy_all" ON strategy_performance FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_strategy_read" ON strategy_performance FOR SELECT USING (true);

-- =====================
-- VERIFICATION
-- =====================
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
