-- BeRight Protocol - Supabase Database Schema
-- This schema defines the complete database structure for BeRight

-- ============================================
-- ENABLE UUID EXTENSION
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT UNIQUE,
  telegram_id BIGINT UNIQUE,
  telegram_username TEXT,
  username TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);

-- ============================================
-- PREDICTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  platform TEXT,
  market_id TEXT,
  market_url TEXT,
  predicted_probability NUMERIC(5,4) NOT NULL CHECK (predicted_probability >= 0 AND predicted_probability <= 1),
  direction TEXT CHECK (direction IN ('YES', 'NO')),
  confidence TEXT CHECK (confidence IN ('low', 'medium', 'high')),
  reasoning TEXT,
  stake_amount NUMERIC(20,8),
  stake_currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolves_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  outcome BOOLEAN,
  brier_score NUMERIC(5,4),
  on_chain_tx TEXT,
  on_chain_confirmed BOOLEAN DEFAULT FALSE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_platform ON predictions(platform);
CREATE INDEX IF NOT EXISTS idx_predictions_resolved_at ON predictions(resolved_at);
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at DESC);

-- ============================================
-- ALERTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  market_id TEXT,
  market_title TEXT,
  platform TEXT,
  condition_type TEXT CHECK (condition_type IN ('price_above', 'price_below', 'arb_spread', 'volume_spike')),
  threshold NUMERIC(10,4),
  is_active BOOLEAN DEFAULT TRUE,
  triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  notify_telegram BOOLEAN DEFAULT TRUE,
  notify_email BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_active ON alerts(is_active) WHERE is_active = TRUE;

-- ============================================
-- WATCHLIST TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  market_id TEXT NOT NULL,
  market_title TEXT,
  platform TEXT,
  price_when_added NUMERIC(5,4),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, market_id, platform)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);

-- ============================================
-- WHALE WALLETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS whale_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT UNIQUE NOT NULL,
  label TEXT,
  platform TEXT,
  total_volume NUMERIC(20,8) DEFAULT 0,
  win_rate NUMERIC(5,4),
  avg_position_size NUMERIC(20,8),
  is_tracked BOOLEAN DEFAULT TRUE,
  last_activity TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whale_wallets_address ON whale_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_whale_wallets_tracked ON whale_wallets(is_tracked) WHERE is_tracked = TRUE;

-- ============================================
-- WHALE TRADES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS whale_trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID REFERENCES whale_wallets(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  market_id TEXT,
  market_title TEXT,
  platform TEXT,
  direction TEXT CHECK (direction IN ('YES', 'NO', 'BUY', 'SELL')),
  amount NUMERIC(20,8),
  price NUMERIC(5,4),
  tx_signature TEXT UNIQUE,
  block_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whale_trades_wallet_id ON whale_trades(wallet_id);
CREATE INDEX IF NOT EXISTS idx_whale_trades_wallet_address ON whale_trades(wallet_address);
CREATE INDEX IF NOT EXISTS idx_whale_trades_block_time ON whale_trades(block_time DESC);
CREATE INDEX IF NOT EXISTS idx_whale_trades_tx_signature ON whale_trades(tx_signature);

-- ============================================
-- ARBITRAGE HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS arbitrage_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  market_title TEXT,
  market_id_platform1 TEXT,
  market_id_platform2 TEXT,
  platform1 TEXT,
  platform2 TEXT,
  price_platform1 NUMERIC(5,4),
  price_platform2 NUMERIC(5,4),
  spread_percent NUMERIC(6,2),
  was_traded BOOLEAN DEFAULT FALSE,
  profit_if_traded NUMERIC(20,8),
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_arbitrage_detected_at ON arbitrage_history(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_arbitrage_spread ON arbitrage_history(spread_percent DESC);

-- ============================================
-- SESSIONS TABLE (for context tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT,
  context JSONB,
  last_command TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_telegram_chat_id ON sessions(telegram_chat_id);

-- ============================================
-- BERIGHT EVENTS TABLE (for realtime sync)
-- ============================================
CREATE TABLE IF NOT EXISTS beright_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL CHECK (event_type IN ('telegram_message', 'agent_response', 'arb_alert', 'whale_alert', 'prediction', 'heartbeat', 'error')),
  session_id UUID,
  telegram_id BIGINT,
  telegram_username TEXT,
  agent TEXT CHECK (agent IN ('scout', 'analyst', 'trader', 'commander')),
  command TEXT,
  response TEXT,
  mood TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_beright_events_created_at ON beright_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beright_events_event_type ON beright_events(event_type);
CREATE INDEX IF NOT EXISTS idx_beright_events_session_id ON beright_events(session_id);
CREATE INDEX IF NOT EXISTS idx_beright_events_telegram_id ON beright_events(telegram_id);

-- ============================================
-- LEADERBOARD VIEW
-- ============================================
CREATE OR REPLACE VIEW leaderboard AS
SELECT 
  u.id,
  u.username,
  u.telegram_id,
  u.telegram_username,
  u.wallet_address,
  u.avatar_url,
  COUNT(p.id) AS total_predictions,
  COUNT(p.id) AS prediction_count,
  COUNT(p.id) FILTER (WHERE p.resolved_at IS NOT NULL) AS resolved_predictions,
  AVG(p.brier_score) AS avg_brier_score,
  COUNT(p.id) FILTER (WHERE p.outcome = TRUE AND p.direction = 'YES' OR p.outcome = FALSE AND p.direction = 'NO') AS correct_predictions,
  CASE 
    WHEN COUNT(p.id) FILTER (WHERE p.resolved_at IS NOT NULL) > 0 
    THEN CAST(COUNT(p.id) FILTER (WHERE p.outcome = TRUE AND p.direction = 'YES' OR p.outcome = FALSE AND p.direction = 'NO') AS NUMERIC) / COUNT(p.id) FILTER (WHERE p.resolved_at IS NOT NULL)
    ELSE 0
  END AS accuracy,
  MAX(p.created_at) AS last_prediction_at
FROM users u
LEFT JOIN predictions p ON p.user_id = u.id
GROUP BY u.id
HAVING COUNT(p.id) > 0
ORDER BY avg_brier_score ASC NULLS LAST, total_predictions DESC;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Calculate Brier Score
CREATE OR REPLACE FUNCTION calculate_brier_score(
  predicted_prob NUMERIC,
  direction TEXT,
  outcome BOOLEAN
) RETURNS NUMERIC AS $$
DECLARE
  forecast NUMERIC;
  actual INTEGER;
BEGIN
  -- Convert prediction to forecast (0-1)
  IF direction = 'YES' THEN
    forecast := predicted_prob;
  ELSE
    forecast := 1 - predicted_prob;
  END IF;
  
  -- Convert outcome to 0 or 1
  IF outcome THEN
    actual := 1;
  ELSE
    actual := 0;
  END IF;
  
  -- Brier score = (forecast - actual)^2
  RETURN POWER(forecast - actual, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whale_wallets_updated_at BEFORE UPDATE ON whale_wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE beright_events ENABLE ROW LEVEL SECURITY;

-- Public read access for leaderboard data
CREATE POLICY "Public read access for users" ON users
  FOR SELECT USING (true);

CREATE POLICY "Public read access for predictions" ON predictions
  FOR SELECT USING (true);

-- Users can manage their own data
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = id);

-- Service role has full access (used by backend)
CREATE POLICY "Service role has full access to predictions" ON predictions
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role has full access to alerts" ON alerts
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role has full access to watchlist" ON watchlist
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role has full access to sessions" ON sessions
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role has full access to beright_events" ON beright_events
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- REALTIME PUBLICATION
-- ============================================

-- Enable realtime for beright_events table
ALTER PUBLICATION supabase_realtime ADD TABLE beright_events;

-- ============================================
-- INITIAL DATA
-- ============================================

-- No initial data required, populated by the application

-- ============================================
-- SCHEMA VERSION
-- ============================================

COMMENT ON SCHEMA public IS 'BeRight Protocol Database Schema v1.0.0';
