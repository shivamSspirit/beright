-- BeRight Core Schema (Minimal)
-- Run this first, then add more tables as needed

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE,
  telegram_id BIGINT UNIQUE,
  telegram_username TEXT,
  username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Predictions
CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  platform TEXT,
  market_id TEXT,
  market_url TEXT,
  predicted_probability DECIMAL(5,4) NOT NULL,
  direction TEXT CHECK (direction IN ('YES', 'NO')),
  confidence TEXT CHECK (confidence IN ('low', 'medium', 'high')),
  reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolves_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  outcome BOOLEAN,
  brier_score DECIMAL(6,4),
  on_chain_tx TEXT,
  on_chain_confirmed BOOLEAN DEFAULT FALSE,
  stake_amount DECIMAL(18,8),
  stake_currency TEXT
);

-- Watchlist
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  market_id TEXT NOT NULL,
  market_title TEXT,
  platform TEXT,
  price_when_added DECIMAL(5,4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, market_id, platform)
);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  market_id TEXT,
  market_title TEXT,
  platform TEXT,
  condition_type TEXT CHECK (condition_type IN ('price_above', 'price_below', 'arb_spread')),
  threshold DECIMAL(5,4),
  is_active BOOLEAN DEFAULT TRUE,
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leaderboard View
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  u.id,
  u.username,
  u.telegram_id,
  u.telegram_username,
  u.wallet_address,
  COUNT(p.id) as total_predictions,
  COUNT(p.id) as prediction_count,
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
    ELSE 0
  END as accuracy,
  MAX(p.created_at) as last_prediction_at
FROM users u
LEFT JOIN predictions p ON u.id = p.user_id
GROUP BY u.id, u.username, u.telegram_id, u.telegram_username, u.wallet_address
HAVING COUNT(p.id) FILTER (WHERE p.outcome IS NOT NULL) >= 5
ORDER BY avg_brier_score ASC NULLS LAST;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_predictions_user ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_created ON predictions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(user_id) WHERE is_active = TRUE;
