-- BeRight Protocol - Supabase Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/zmpsqixstjmtftuqstnd/sql

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE,
  telegram_id BIGINT UNIQUE,
  telegram_username TEXT,
  username TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PREDICTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Market info
  question TEXT NOT NULL,
  platform TEXT, -- polymarket, kalshi, manifold
  market_id TEXT,
  market_url TEXT,

  -- Prediction details
  predicted_probability DECIMAL(5,4) NOT NULL CHECK (predicted_probability >= 0 AND predicted_probability <= 1),
  direction TEXT CHECK (direction IN ('YES', 'NO')),
  confidence TEXT CHECK (confidence IN ('low', 'medium', 'high')),
  reasoning TEXT,

  -- Stake (optional)
  stake_amount DECIMAL(18,6),
  stake_currency TEXT DEFAULT 'USD',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolves_at TIMESTAMPTZ,

  -- Resolution
  resolved_at TIMESTAMPTZ,
  outcome BOOLEAN, -- true = YES won, false = NO won
  brier_score DECIMAL(6,4),

  -- On-chain verification
  on_chain_tx TEXT, -- Solana tx signature
  on_chain_confirmed BOOLEAN DEFAULT FALSE
);

-- ============================================
-- ALERTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Market reference
  market_id TEXT,
  market_title TEXT,
  platform TEXT,

  -- Alert conditions
  condition_type TEXT CHECK (condition_type IN ('price_above', 'price_below', 'arb_spread', 'volume_spike')),
  threshold DECIMAL(5,4),

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,

  -- Notification
  notify_telegram BOOLEAN DEFAULT TRUE,
  notify_email BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WATCHLIST TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  market_id TEXT NOT NULL,
  market_title TEXT,
  platform TEXT,

  -- Snapshot at time of adding
  price_when_added DECIMAL(5,4),

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, market_id, platform)
);

-- ============================================
-- WHALE WALLETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS whale_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  wallet_address TEXT UNIQUE NOT NULL,
  label TEXT, -- "polymarket_whale_1", "smart_money_xyz"
  platform TEXT, -- which platform they're known for

  -- Stats
  total_volume DECIMAL(18,2),
  win_rate DECIMAL(5,4),
  avg_position_size DECIMAL(18,2),

  -- Tracking
  is_tracked BOOLEAN DEFAULT TRUE,
  last_activity TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WHALE TRADES TABLE (for tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS whale_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  wallet_id UUID REFERENCES whale_wallets(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,

  -- Trade details
  market_id TEXT,
  market_title TEXT,
  platform TEXT,
  direction TEXT CHECK (direction IN ('YES', 'NO', 'BUY', 'SELL')),
  amount DECIMAL(18,6),
  price DECIMAL(5,4),

  -- On-chain
  tx_signature TEXT,
  block_time TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ARBITRAGE OPPORTUNITIES (historical)
-- ============================================
CREATE TABLE IF NOT EXISTS arbitrage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Market info
  market_title TEXT,
  market_id_platform1 TEXT,
  market_id_platform2 TEXT,
  platform1 TEXT,
  platform2 TEXT,

  -- Prices at detection
  price_platform1 DECIMAL(5,4),
  price_platform2 DECIMAL(5,4),
  spread_percent DECIMAL(5,2),

  -- Status
  was_traded BOOLEAN DEFAULT FALSE,
  profit_if_traded DECIMAL(18,6),

  detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SESSIONS TABLE (for telegram sessions)
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT,

  -- Session data
  context JSONB DEFAULT '{}',
  last_command TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LEADERBOARD VIEW
-- ============================================
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  u.id,
  u.username,
  u.telegram_username,
  u.wallet_address,
  u.avatar_url,
  COUNT(p.id) as total_predictions,
  COUNT(p.id) FILTER (WHERE p.outcome IS NOT NULL) as resolved_predictions,
  AVG(p.brier_score) FILTER (WHERE p.brier_score IS NOT NULL) as avg_brier_score,
  COUNT(p.id) FILTER (WHERE
    (p.direction = 'YES' AND p.outcome = TRUE) OR
    (p.direction = 'NO' AND p.outcome = FALSE)
  ) as correct_predictions,
  CASE
    WHEN COUNT(p.id) FILTER (WHERE p.outcome IS NOT NULL) > 0
    THEN COUNT(p.id) FILTER (WHERE
      (p.direction = 'YES' AND p.outcome = TRUE) OR
      (p.direction = 'NO' AND p.outcome = FALSE)
    )::DECIMAL / COUNT(p.id) FILTER (WHERE p.outcome IS NOT NULL)
    ELSE NULL
  END as accuracy,
  MAX(p.created_at) as last_prediction_at
FROM users u
LEFT JOIN predictions p ON u.id = p.user_id
GROUP BY u.id, u.username, u.telegram_username, u.wallet_address, u.avatar_url
ORDER BY avg_brier_score ASC NULLS LAST;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_platform ON predictions(platform);
CREATE INDEX IF NOT EXISTS idx_predictions_resolved ON predictions(resolved_at) WHERE resolved_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alerts_user_active ON alerts(user_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_alerts_market ON alerts(market_id);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);

CREATE INDEX IF NOT EXISTS idx_whale_trades_wallet ON whale_trades(wallet_address);
CREATE INDEX IF NOT EXISTS idx_whale_trades_time ON whale_trades(block_time DESC);

CREATE INDEX IF NOT EXISTS idx_arbitrage_detected ON arbitrage_history(detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_telegram ON sessions(telegram_chat_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Predictions: users can manage their own
CREATE POLICY "Users can view own predictions" ON predictions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own predictions" ON predictions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own predictions" ON predictions
  FOR UPDATE USING (auth.uid() = user_id);

-- Public leaderboard (anyone can view)
CREATE POLICY "Anyone can view leaderboard" ON users
  FOR SELECT USING (TRUE);

-- Alerts: users manage their own
CREATE POLICY "Users can manage own alerts" ON alerts
  FOR ALL USING (auth.uid() = user_id);

-- Watchlist: users manage their own
CREATE POLICY "Users can manage own watchlist" ON watchlist
  FOR ALL USING (auth.uid() = user_id);

-- Whale data is public (read-only for users)
-- whale_wallets and whale_trades don't need RLS - they're public data

-- ============================================
-- FUNCTIONS
-- ============================================

-- Calculate Brier score when prediction resolves
CREATE OR REPLACE FUNCTION calculate_brier_score(
  predicted_prob DECIMAL,
  direction TEXT,
  outcome BOOLEAN
) RETURNS DECIMAL AS $$
DECLARE
  forecast DECIMAL;
  actual DECIMAL;
BEGIN
  -- Convert direction + probability to forecast (probability of YES)
  IF direction = 'YES' THEN
    forecast := predicted_prob;
  ELSE
    forecast := 1 - predicted_prob;
  END IF;

  -- Actual outcome (1 if YES won, 0 if NO won)
  actual := CASE WHEN outcome THEN 1 ELSE 0 END;

  -- Brier score = (forecast - actual)^2
  RETURN POWER(forecast - actual, 2);
END;
$$ LANGUAGE plpgsql;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER whale_wallets_updated_at
  BEFORE UPDATE ON whale_wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SEED DATA (Optional - known whale wallets)
-- ============================================
INSERT INTO whale_wallets (wallet_address, label, platform) VALUES
  ('0x1234...', 'Polymarket Whale #1', 'polymarket'),
  ('0x5678...', 'Smart Money Alpha', 'polymarket')
ON CONFLICT (wallet_address) DO NOTHING;
