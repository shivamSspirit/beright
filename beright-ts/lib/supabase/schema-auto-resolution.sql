-- BeRight Protocol - Auto-Resolution Schema Migration
-- Run this in Supabase SQL Editor to enable automation features

-- ============================================
-- PREDICTIONS TABLE EXTENSIONS
-- ============================================

-- Add new columns for DFlow integration and auto-resolution
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS market_ticker TEXT;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS dflow_event_ticker TEXT;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS auto_resolved BOOLEAN DEFAULT FALSE;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS resolution_tx TEXT;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS probability DECIMAL(5,4);
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS tx_signature TEXT;

-- Update column if it uses different name
UPDATE predictions SET probability = predicted_probability WHERE probability IS NULL AND predicted_probability IS NOT NULL;

-- Create index for market ticker lookups
CREATE INDEX IF NOT EXISTS idx_predictions_market_ticker ON predictions(market_ticker);
CREATE INDEX IF NOT EXISTS idx_predictions_pending ON predictions(resolved_at) WHERE resolved_at IS NULL;

-- ============================================
-- MARKET WATCHES TABLE
-- Tracks which markets we're monitoring for resolution
-- ============================================
CREATE TABLE IF NOT EXISTS market_watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Market identification
  market_ticker TEXT NOT NULL,
  dflow_event_ticker TEXT,

  -- Current status
  status TEXT DEFAULT 'watching' CHECK (status IN ('watching', 'resolved', 'error', 'cancelled')),
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),

  -- Resolution info
  resolved_at TIMESTAMPTZ,
  outcome TEXT CHECK (outcome IN ('yes', 'no')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(market_ticker)
);

CREATE INDEX IF NOT EXISTS idx_market_watches_status ON market_watches(status) WHERE status = 'watching';
CREATE INDEX IF NOT EXISTS idx_market_watches_ticker ON market_watches(market_ticker);

-- ============================================
-- PREDICTION MARKET LINK TABLE
-- Links predictions to watched markets
-- ============================================
CREATE TABLE IF NOT EXISTS prediction_market_links (
  prediction_id UUID REFERENCES predictions(id) ON DELETE CASCADE,
  market_watch_id UUID REFERENCES market_watches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (prediction_id, market_watch_id)
);

-- ============================================
-- MATERIALIZED VIEW FOR LEADERBOARD
-- Auto-refreshes on prediction resolution
-- ============================================
DROP MATERIALIZED VIEW IF EXISTS leaderboard_v2;
CREATE MATERIALIZED VIEW leaderboard_v2 AS
SELECT
  u.id,
  u.username,
  u.telegram_username,
  u.wallet_address,
  u.avatar_url,
  COUNT(p.id) as total_predictions,
  COUNT(p.id) FILTER (WHERE p.brier_score IS NOT NULL) as resolved_predictions,
  AVG(p.brier_score) FILTER (WHERE p.brier_score IS NOT NULL) as avg_brier,
  MIN(p.brier_score) FILTER (WHERE p.brier_score IS NOT NULL) as best_brier,
  MAX(p.brier_score) FILTER (WHERE p.brier_score IS NOT NULL) as worst_brier,
  -- Accuracy rate
  CASE
    WHEN COUNT(p.id) FILTER (WHERE p.outcome IS NOT NULL) > 0 THEN
      COUNT(p.id) FILTER (WHERE
        (p.direction = 'YES' AND p.outcome = TRUE) OR
        (p.direction = 'NO' AND p.outcome = FALSE)
      )::DECIMAL / COUNT(p.id) FILTER (WHERE p.outcome IS NOT NULL)
    ELSE NULL
  END as accuracy,
  -- Tier classification based on avg Brier
  CASE
    WHEN AVG(p.brier_score) FILTER (WHERE p.brier_score IS NOT NULL) <= 0.10 THEN 'diamond'
    WHEN AVG(p.brier_score) FILTER (WHERE p.brier_score IS NOT NULL) <= 0.15 THEN 'platinum'
    WHEN AVG(p.brier_score) FILTER (WHERE p.brier_score IS NOT NULL) <= 0.20 THEN 'gold'
    WHEN AVG(p.brier_score) FILTER (WHERE p.brier_score IS NOT NULL) <= 0.25 THEN 'silver'
    ELSE 'bronze'
  END as tier,
  -- Rank
  RANK() OVER (
    ORDER BY AVG(p.brier_score) FILTER (WHERE p.brier_score IS NOT NULL) ASC NULLS LAST
  ) as rank,
  MAX(p.created_at) as last_prediction_at,
  MAX(p.resolved_at) as last_resolved_at
FROM users u
LEFT JOIN predictions p ON u.id = p.user_id
GROUP BY u.id, u.username, u.telegram_username, u.wallet_address, u.avatar_url
WITH DATA;

-- Unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_v2_id ON leaderboard_v2(id);

-- ============================================
-- AUTO-REFRESH FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION refresh_leaderboard_v2()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_v2;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Auto-refresh leaderboard on resolution
-- ============================================
CREATE OR REPLACE FUNCTION trigger_refresh_leaderboard()
RETURNS TRIGGER AS $$
BEGIN
  -- Only refresh if brier_score was just set (resolution happened)
  IF NEW.brier_score IS NOT NULL AND (OLD.brier_score IS NULL OR OLD.brier_score != NEW.brier_score) THEN
    PERFORM refresh_leaderboard_v2();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS refresh_leaderboard_on_resolve ON predictions;
CREATE TRIGGER refresh_leaderboard_on_resolve
AFTER UPDATE OF brier_score ON predictions
FOR EACH ROW
EXECUTE FUNCTION trigger_refresh_leaderboard();

-- ============================================
-- RESOLUTION EVENTS TABLE
-- Audit log for all resolutions
-- ============================================
CREATE TABLE IF NOT EXISTS resolution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  prediction_id UUID REFERENCES predictions(id),
  user_id UUID REFERENCES users(id),

  -- Resolution details
  market_ticker TEXT,
  predicted_direction TEXT,
  predicted_probability DECIMAL(5,4),
  outcome TEXT CHECK (outcome IN ('YES', 'NO')),
  brier_score DECIMAL(6,4),

  -- Method
  resolution_method TEXT CHECK (resolution_method IN ('auto', 'manual', 'oracle')),

  -- On-chain
  commit_tx TEXT,
  resolution_tx TEXT,

  -- Timestamps
  predicted_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resolution_events_user ON resolution_events(user_id);
CREATE INDEX IF NOT EXISTS idx_resolution_events_time ON resolution_events(resolved_at DESC);

-- ============================================
-- CALIBRATION BUCKETS VIEW
-- For calibration analysis
-- ============================================
CREATE OR REPLACE VIEW calibration_buckets AS
WITH bucket_data AS (
  SELECT
    user_id,
    CASE
      WHEN COALESCE(probability, predicted_probability) < 0.1 THEN '0-10%'
      WHEN COALESCE(probability, predicted_probability) < 0.2 THEN '10-20%'
      WHEN COALESCE(probability, predicted_probability) < 0.3 THEN '20-30%'
      WHEN COALESCE(probability, predicted_probability) < 0.4 THEN '30-40%'
      WHEN COALESCE(probability, predicted_probability) < 0.5 THEN '40-50%'
      WHEN COALESCE(probability, predicted_probability) < 0.6 THEN '50-60%'
      WHEN COALESCE(probability, predicted_probability) < 0.7 THEN '60-70%'
      WHEN COALESCE(probability, predicted_probability) < 0.8 THEN '70-80%'
      WHEN COALESCE(probability, predicted_probability) < 0.9 THEN '80-90%'
      ELSE '90-100%'
    END as bucket,
    COALESCE(probability, predicted_probability) as prob,
    CASE WHEN direction = 'YES' THEN outcome ELSE NOT outcome END as outcome_for_yes
  FROM predictions
  WHERE outcome IS NOT NULL
)
SELECT
  user_id,
  bucket,
  COUNT(*) as prediction_count,
  AVG(prob) as avg_predicted_probability,
  AVG(CASE WHEN outcome_for_yes THEN 1 ELSE 0 END) as actual_rate,
  ABS(AVG(prob) - AVG(CASE WHEN outcome_for_yes THEN 1 ELSE 0 END)) as calibration_error
FROM bucket_data
GROUP BY user_id, bucket
ORDER BY user_id, bucket;

-- ============================================
-- USER STATS VIEW
-- Comprehensive user statistics
-- ============================================
CREATE OR REPLACE VIEW user_stats AS
SELECT
  u.id,
  u.username,
  u.telegram_username,
  u.wallet_address,

  -- Prediction counts
  COUNT(p.id) as total_predictions,
  COUNT(p.id) FILTER (WHERE p.resolved_at IS NOT NULL) as resolved_predictions,
  COUNT(p.id) FILTER (WHERE p.resolved_at IS NULL) as pending_predictions,

  -- Accuracy metrics
  AVG(p.brier_score) as avg_brier_score,
  STDDEV(p.brier_score) as brier_stddev,
  MIN(p.brier_score) as best_prediction,
  MAX(p.brier_score) as worst_prediction,

  -- Win rate
  COUNT(p.id) FILTER (WHERE
    (p.direction = 'YES' AND p.outcome = TRUE) OR
    (p.direction = 'NO' AND p.outcome = FALSE)
  ) as correct_predictions,

  -- By platform
  COUNT(p.id) FILTER (WHERE p.platform = 'dflow') as dflow_predictions,
  COUNT(p.id) FILTER (WHERE p.platform = 'polymarket') as polymarket_predictions,
  COUNT(p.id) FILTER (WHERE p.platform = 'kalshi') as kalshi_predictions,

  -- Activity
  MIN(p.created_at) as first_prediction,
  MAX(p.created_at) as last_prediction,
  COUNT(DISTINCT DATE(p.created_at)) as active_days,

  -- On-chain stats
  COUNT(p.id) FILTER (WHERE p.on_chain_tx IS NOT NULL) as onchain_predictions,
  COUNT(p.id) FILTER (WHERE p.auto_resolved = TRUE) as auto_resolved_count

FROM users u
LEFT JOIN predictions p ON u.id = p.user_id
GROUP BY u.id, u.username, u.telegram_username, u.wallet_address;

-- ============================================
-- HELPER FUNCTION: Get user calibration
-- ============================================
CREATE OR REPLACE FUNCTION get_user_calibration(p_user_id UUID)
RETURNS TABLE (
  bucket TEXT,
  prediction_count BIGINT,
  expected_rate DECIMAL,
  actual_rate DECIMAL,
  calibration_error DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cb.bucket,
    cb.prediction_count,
    cb.avg_predicted_probability as expected_rate,
    cb.actual_rate,
    cb.calibration_error
  FROM calibration_buckets cb
  WHERE cb.user_id = p_user_id
  ORDER BY cb.bucket;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- NOTIFICATION QUEUE TABLE
-- For async notification delivery
-- ============================================
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID REFERENCES users(id),

  -- Notification details
  notification_type TEXT CHECK (notification_type IN (
    'prediction_resolved',
    'leaderboard_change',
    'market_closing_soon',
    'weekly_summary',
    'calibration_insight'
  )),

  -- Content
  title TEXT,
  body TEXT,
  data JSONB,

  -- Delivery
  channels TEXT[] DEFAULT ARRAY['telegram'],
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_pending
ON notification_queue(created_at)
WHERE status = 'pending';

-- ============================================
-- TRIGGER: Queue notification on resolution
-- ============================================
CREATE OR REPLACE FUNCTION queue_resolution_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_quality TEXT;
BEGIN
  -- Only notify if just resolved
  IF NEW.brier_score IS NOT NULL AND OLD.brier_score IS NULL THEN
    -- Determine quality
    v_quality := CASE
      WHEN NEW.brier_score <= 0.10 THEN 'Excellent!'
      WHEN NEW.brier_score <= 0.20 THEN 'Good'
      WHEN NEW.brier_score <= 0.30 THEN 'Fair'
      ELSE 'Needs improvement'
    END;

    INSERT INTO notification_queue (user_id, notification_type, title, body, data)
    VALUES (
      NEW.user_id,
      'prediction_resolved',
      'Prediction Resolved!',
      format('%s resolved. Brier Score: %s (%s)',
        LEFT(NEW.question, 50),
        ROUND(NEW.brier_score::numeric, 4),
        v_quality
      ),
      jsonb_build_object(
        'prediction_id', NEW.id,
        'question', NEW.question,
        'direction', NEW.direction,
        'probability', COALESCE(NEW.probability, NEW.predicted_probability),
        'outcome', NEW.outcome,
        'brier_score', NEW.brier_score
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notify_on_resolution ON predictions;
CREATE TRIGGER notify_on_resolution
AFTER UPDATE OF brier_score ON predictions
FOR EACH ROW
EXECUTE FUNCTION queue_resolution_notification();

-- ============================================
-- GRANT PERMISSIONS (for RLS bypass on service role)
-- ============================================
GRANT ALL ON market_watches TO service_role;
GRANT ALL ON prediction_market_links TO service_role;
GRANT ALL ON resolution_events TO service_role;
GRANT ALL ON notification_queue TO service_role;
GRANT SELECT ON leaderboard_v2 TO anon, authenticated;
GRANT SELECT ON calibration_buckets TO anon, authenticated;
GRANT SELECT ON user_stats TO anon, authenticated;

-- ============================================
-- FINAL: Refresh materialized view
-- ============================================
SELECT refresh_leaderboard_v2();

-- Output success
SELECT 'Auto-resolution schema migration complete!' as status;
