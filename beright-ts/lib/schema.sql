-- BeRight Protocol Database Schema
-- For Supabase (PostgreSQL)
-- Run this in your Supabase SQL editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- USERS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT UNIQUE,
  telegram_id TEXT UNIQUE,
  telegram_username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{
    "notifications_enabled": true,
    "daily_brief_enabled": true,
    "alert_threshold_arb": 5,
    "alert_threshold_whale": 50000,
    "timezone": "UTC"
  }'::jsonb
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_id);

-- ========================================
-- PREDICTIONS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'unknown',
  market_id TEXT,
  market_url TEXT,
  predicted_probability DECIMAL(4,3) NOT NULL CHECK (predicted_probability >= 0 AND predicted_probability <= 1),
  direction TEXT NOT NULL CHECK (direction IN ('YES', 'NO')),
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
  reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolves_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  outcome BOOLEAN, -- NULL = pending, TRUE = YES resolved, FALSE = NO resolved
  brier_score DECIMAL(4,4), -- 0.0000 to 1.0000
  tags TEXT[] DEFAULT '{}'
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_predictions_user ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_pending ON predictions(user_id) WHERE outcome IS NULL;
CREATE INDEX IF NOT EXISTS idx_predictions_resolved ON predictions(user_id) WHERE outcome IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_predictions_platform ON predictions(platform);
CREATE INDEX IF NOT EXISTS idx_predictions_created ON predictions(created_at DESC);

-- ========================================
-- ALERTS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('arbitrage', 'whale', 'price', 'resolution')),
  market_id TEXT,
  condition JSONB NOT NULL DEFAULT '{}',
  triggered BOOLEAN DEFAULT FALSE,
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(user_id) WHERE triggered = FALSE;
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);

-- ========================================
-- LEADERBOARD STATS TABLE (Materialized view of user performance)
-- ========================================
CREATE TABLE IF NOT EXISTS leaderboard_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT,
  wallet_address TEXT,
  brier_score DECIMAL(4,4) DEFAULT 1.0,
  accuracy DECIMAL(4,3) DEFAULT 0,
  total_predictions INTEGER DEFAULT 0,
  resolved_predictions INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  streak_type TEXT DEFAULT 'none' CHECK (streak_type IN ('win', 'loss', 'none')),
  best_streak INTEGER DEFAULT 0,
  rank INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_leaderboard_brier ON leaderboard_stats(brier_score ASC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard_stats(rank ASC);

-- ========================================
-- ACHIEVEMENTS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, achievement_type)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);

-- ========================================
-- MARKET SNAPSHOTS TABLE (for tracking price changes over time)
-- ========================================
CREATE TABLE IF NOT EXISTS market_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT NOT NULL,
  market_id TEXT NOT NULL,
  question TEXT NOT NULL,
  yes_price DECIMAL(4,3),
  no_price DECIMAL(4,3),
  volume DECIMAL(18,2),
  liquidity DECIMAL(18,2),
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for time-series queries
CREATE INDEX IF NOT EXISTS idx_snapshots_market ON market_snapshots(platform, market_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_time ON market_snapshots(snapshot_at DESC);

-- ========================================
-- WHALE ACTIVITY TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS whale_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT NOT NULL,
  whale_name TEXT,
  transaction_hash TEXT UNIQUE,
  transaction_type TEXT,
  amount_usd DECIMAL(18,2),
  description TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_whale_wallet ON whale_activity(wallet_address);
CREATE INDEX IF NOT EXISTS idx_whale_time ON whale_activity(detected_at DESC);

-- ========================================
-- BRIEF HISTORY TABLE (track sent briefs)
-- ========================================
CREATE TABLE IF NOT EXISTS brief_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  brief_type TEXT DEFAULT 'morning',
  content_hash TEXT, -- Hash of brief content for deduplication
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  channel TEXT CHECK (channel IN ('telegram', 'web', 'email'))
);

-- Index
CREATE INDEX IF NOT EXISTS idx_brief_user ON brief_history(user_id);
CREATE INDEX IF NOT EXISTS idx_brief_time ON brief_history(sent_at DESC);

-- ========================================
-- FUNCTIONS
-- ========================================

-- Function to update leaderboard ranks
CREATE OR REPLACE FUNCTION update_leaderboard_ranks()
RETURNS void AS $$
BEGIN
  WITH ranked AS (
    SELECT
      user_id,
      ROW_NUMBER() OVER (ORDER BY brier_score ASC, resolved_predictions DESC) as new_rank
    FROM leaderboard_stats
    WHERE resolved_predictions >= 5 -- Minimum predictions to rank
  )
  UPDATE leaderboard_stats ls
  SET rank = r.new_rank
  FROM ranked r
  WHERE ls.user_id = r.user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate user stats and update leaderboard
CREATE OR REPLACE FUNCTION refresh_user_stats(target_user_id UUID)
RETURNS void AS $$
DECLARE
  v_brier DECIMAL(4,4);
  v_accuracy DECIMAL(4,3);
  v_total INTEGER;
  v_resolved INTEGER;
  v_streak INTEGER;
  v_streak_type TEXT;
  v_name TEXT;
  v_wallet TEXT;
BEGIN
  -- Get user info
  SELECT display_name, wallet_address INTO v_name, v_wallet
  FROM users WHERE id = target_user_id;

  -- Calculate stats from predictions
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE outcome IS NOT NULL),
    COALESCE(AVG(brier_score) FILTER (WHERE outcome IS NOT NULL), 1.0),
    COALESCE(
      COUNT(*) FILTER (WHERE outcome IS NOT NULL AND ((direction = 'YES' AND outcome = TRUE) OR (direction = 'NO' AND outcome = FALSE)))::DECIMAL /
      NULLIF(COUNT(*) FILTER (WHERE outcome IS NOT NULL), 0),
      0
    )
  INTO v_total, v_resolved, v_brier, v_accuracy
  FROM predictions
  WHERE user_id = target_user_id;

  -- Calculate streak (simplified)
  SELECT
    COUNT(*),
    CASE
      WHEN bool_and((direction = 'YES' AND outcome = TRUE) OR (direction = 'NO' AND outcome = FALSE)) THEN 'win'
      ELSE 'loss'
    END
  INTO v_streak, v_streak_type
  FROM (
    SELECT direction, outcome
    FROM predictions
    WHERE user_id = target_user_id AND outcome IS NOT NULL
    ORDER BY resolved_at DESC
    LIMIT 10
  ) recent;

  -- Upsert leaderboard stats
  INSERT INTO leaderboard_stats (
    user_id, display_name, wallet_address, brier_score, accuracy,
    total_predictions, resolved_predictions, current_streak, streak_type, updated_at
  ) VALUES (
    target_user_id, v_name, v_wallet, v_brier, v_accuracy,
    v_total, v_resolved, COALESCE(v_streak, 0), COALESCE(v_streak_type, 'none'), NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    wallet_address = EXCLUDED.wallet_address,
    brier_score = EXCLUDED.brier_score,
    accuracy = EXCLUDED.accuracy,
    total_predictions = EXCLUDED.total_predictions,
    resolved_predictions = EXCLUDED.resolved_predictions,
    current_streak = EXCLUDED.current_streak,
    streak_type = EXCLUDED.streak_type,
    updated_at = NOW();

  -- Update ranks
  PERFORM update_leaderboard_ranks();
END;
$$ LANGUAGE plpgsql;

-- Trigger to refresh stats when prediction is resolved
CREATE OR REPLACE FUNCTION on_prediction_resolved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.outcome IS NOT NULL AND OLD.outcome IS NULL THEN
    PERFORM refresh_user_stats(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prediction_resolved ON predictions;
CREATE TRIGGER trigger_prediction_resolved
  AFTER UPDATE ON predictions
  FOR EACH ROW
  EXECUTE FUNCTION on_prediction_resolved();

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

-- Policies for users (users can only see/edit their own data)
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = id::text OR auth.uid() IS NULL);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

-- Policies for predictions
CREATE POLICY "Anyone can view predictions" ON predictions
  FOR SELECT USING (true);

CREATE POLICY "Users can create own predictions" ON predictions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own predictions" ON predictions
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Policies for alerts
CREATE POLICY "Users can view own alerts" ON alerts
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create own alerts" ON alerts
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own alerts" ON alerts
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- Policies for achievements
CREATE POLICY "Anyone can view achievements" ON achievements
  FOR SELECT USING (true);

-- Leaderboard is public
ALTER TABLE leaderboard_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leaderboard is public" ON leaderboard_stats
  FOR SELECT USING (true);

-- ========================================
-- INITIAL DATA
-- ========================================

-- Create a test user (optional)
-- INSERT INTO users (telegram_id, display_name) VALUES ('test_user', 'Test Forecaster');

-- ========================================
-- COMMENTS
-- ========================================

COMMENT ON TABLE users IS 'BeRight user accounts - can have wallet and/or telegram';
COMMENT ON TABLE predictions IS 'User predictions with Brier score tracking';
COMMENT ON TABLE alerts IS 'User-configured price and activity alerts';
COMMENT ON TABLE leaderboard_stats IS 'Cached leaderboard rankings, updated on prediction resolution';
COMMENT ON TABLE achievements IS 'Gamification achievements earned by users';
COMMENT ON TABLE market_snapshots IS 'Historical market price data for change tracking';
COMMENT ON TABLE whale_activity IS 'Detected large wallet movements';
COMMENT ON TABLE brief_history IS 'Track sent morning briefs';
