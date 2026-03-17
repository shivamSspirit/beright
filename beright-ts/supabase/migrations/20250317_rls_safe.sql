-- ============================================================================
-- RLS Policies for BeRight Protocol (Safe - skips missing tables)
-- ============================================================================

-- USERS (always exists)
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Anyone can view leaderboard" ON users;
DROP POLICY IF EXISTS "service_users_all" ON users;
DROP POLICY IF EXISTS "public_users_read" ON users;
CREATE POLICY "service_users_all" ON users FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_users_read" ON users FOR SELECT USING (true);

-- PREDICTIONS (always exists)
ALTER TABLE IF EXISTS predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own predictions" ON predictions;
DROP POLICY IF EXISTS "Users can insert own predictions" ON predictions;
DROP POLICY IF EXISTS "Users can update own predictions" ON predictions;
DROP POLICY IF EXISTS "service_predictions_all" ON predictions;
DROP POLICY IF EXISTS "public_predictions_read" ON predictions;
CREATE POLICY "service_predictions_all" ON predictions FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_predictions_read" ON predictions FOR SELECT USING (true);

-- ALERTS
ALTER TABLE IF EXISTS alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own alerts" ON alerts;
DROP POLICY IF EXISTS "service_alerts_all" ON alerts;
CREATE POLICY "service_alerts_all" ON alerts FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- WATCHLIST
ALTER TABLE IF EXISTS watchlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own watchlist" ON watchlist;
DROP POLICY IF EXISTS "service_watchlist_all" ON watchlist;
CREATE POLICY "service_watchlist_all" ON watchlist FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- WHALE WALLETS
ALTER TABLE IF EXISTS whale_wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_whale_wallets_all" ON whale_wallets;
DROP POLICY IF EXISTS "public_whale_wallets_read" ON whale_wallets;
CREATE POLICY "service_whale_wallets_all" ON whale_wallets FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_whale_wallets_read" ON whale_wallets FOR SELECT USING (true);

-- WHALE TRADES
ALTER TABLE IF EXISTS whale_trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_whale_trades_all" ON whale_trades;
DROP POLICY IF EXISTS "public_whale_trades_read" ON whale_trades;
CREATE POLICY "service_whale_trades_all" ON whale_trades FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_whale_trades_read" ON whale_trades FOR SELECT USING (true);

-- ARBITRAGE HISTORY
ALTER TABLE IF EXISTS arbitrage_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_arbitrage_all" ON arbitrage_history;
DROP POLICY IF EXISTS "public_arbitrage_read" ON arbitrage_history;
CREATE POLICY "service_arbitrage_all" ON arbitrage_history FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_arbitrage_read" ON arbitrage_history FOR SELECT USING (true);

-- SIGNALS
ALTER TABLE IF EXISTS signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_signals_all" ON signals;
DROP POLICY IF EXISTS "public_signals_read" ON signals;
CREATE POLICY "service_signals_all" ON signals FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_signals_read" ON signals FOR SELECT USING (true);

-- SIGNAL SUBSCRIPTIONS
ALTER TABLE IF EXISTS signal_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_signal_subs_all" ON signal_subscriptions;
CREATE POLICY "service_signal_subs_all" ON signal_subscriptions FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- FORECASTER PROFILES
ALTER TABLE IF EXISTS forecaster_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_forecaster_all" ON forecaster_profiles;
DROP POLICY IF EXISTS "public_forecaster_read" ON forecaster_profiles;
CREATE POLICY "service_forecaster_all" ON forecaster_profiles FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_forecaster_read" ON forecaster_profiles FOR SELECT USING (true);

-- SIGNAL CHANNELS
ALTER TABLE IF EXISTS signal_channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_channels_all" ON signal_channels;
DROP POLICY IF EXISTS "public_channels_read" ON signal_channels;
CREATE POLICY "service_channels_all" ON signal_channels FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_channels_read" ON signal_channels FOR SELECT USING (true);

-- CHANNEL SUBSCRIPTIONS
ALTER TABLE IF EXISTS channel_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_channel_subs_all" ON channel_subscriptions;
CREATE POLICY "service_channel_subs_all" ON channel_subscriptions FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- CHANNEL SIGNALS
ALTER TABLE IF EXISTS channel_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_channel_signals_all" ON channel_signals;
DROP POLICY IF EXISTS "public_channel_signals_read" ON channel_signals;
CREATE POLICY "service_channel_signals_all" ON channel_signals FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_channel_signals_read" ON channel_signals FOR SELECT USING (true);

-- YIELD TABLES (from today's migration)
ALTER TABLE IF EXISTS yield_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS yield_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS yield_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS yield_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vault_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rebalance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS affiliate_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS affiliate_partnerships ENABLE ROW LEVEL SECURITY;
