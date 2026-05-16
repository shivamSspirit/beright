-- ============================================================================
-- RLS Policies for BeRight Protocol (Simplified)
-- ============================================================================

-- Enable RLS on core tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whale_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE whale_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE arbitrage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecaster_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_signals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Anyone can view leaderboard" ON users;
DROP POLICY IF EXISTS "Users can view own predictions" ON predictions;
DROP POLICY IF EXISTS "Users can insert own predictions" ON predictions;
DROP POLICY IF EXISTS "Users can update own predictions" ON predictions;
DROP POLICY IF EXISTS "Users can manage own alerts" ON alerts;
DROP POLICY IF EXISTS "Users can manage own watchlist" ON watchlist;

-- USERS
CREATE POLICY "service_users_all" ON users FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_users_read" ON users FOR SELECT USING (true);

-- PREDICTIONS
CREATE POLICY "service_predictions_all" ON predictions FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_predictions_read" ON predictions FOR SELECT
  USING (resolved_at IS NOT NULL);

-- ALERTS (service only)
CREATE POLICY "service_alerts_all" ON alerts FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- WATCHLIST (service only)
CREATE POLICY "service_watchlist_all" ON watchlist FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- SESSIONS (service only)
CREATE POLICY "service_sessions_all" ON sessions FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- WHALE WALLETS
CREATE POLICY "service_whale_wallets_all" ON whale_wallets FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_whale_wallets_read" ON whale_wallets FOR SELECT USING (true);

-- WHALE TRADES
CREATE POLICY "service_whale_trades_all" ON whale_trades FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_whale_trades_read" ON whale_trades FOR SELECT USING (true);

-- ARBITRAGE HISTORY
CREATE POLICY "service_arbitrage_all" ON arbitrage_history FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_arbitrage_read" ON arbitrage_history FOR SELECT USING (true);

-- SIGNALS
CREATE POLICY "service_signals_all" ON signals FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_signals_read" ON signals FOR SELECT USING (action != 'SKIP');

-- SIGNAL SUBSCRIPTIONS (service only)
CREATE POLICY "service_signal_subs_all" ON signal_subscriptions FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- FORECASTER PROFILES
CREATE POLICY "service_forecaster_all" ON forecaster_profiles FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_forecaster_read" ON forecaster_profiles FOR SELECT USING (is_public = true);

-- SIGNAL CHANNELS
CREATE POLICY "service_channels_all" ON signal_channels FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_channels_read" ON signal_channels FOR SELECT USING (is_active = true);

-- CHANNEL SUBSCRIPTIONS (service only)
CREATE POLICY "service_channel_subs_all" ON channel_subscriptions FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- CHANNEL SIGNALS
CREATE POLICY "service_channel_signals_all" ON channel_signals FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "public_channel_signals_read" ON channel_signals FOR SELECT USING (true);
