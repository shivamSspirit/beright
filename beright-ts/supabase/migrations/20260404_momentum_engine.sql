-- BeRight Protocol - Momentum Score Engine
-- Creates market_momentum and price_snapshots tables

-- ============================================
-- MARKET MOMENTUM TABLE
-- Stores 0-100 momentum scores per market
-- ============================================
CREATE TABLE IF NOT EXISTS market_momentum (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Market identification
  market_id TEXT NOT NULL,
  market_title TEXT NOT NULL,
  platform TEXT NOT NULL,

  -- Composite momentum score (0-100)
  momentum_score FLOAT NOT NULL DEFAULT 0 CHECK (momentum_score >= 0 AND momentum_score <= 100),
  is_hot BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE if momentum > 70

  -- Component scores (each 0-1, weighted in composite)
  signal_velocity FLOAT DEFAULT 0 CHECK (signal_velocity >= 0 AND signal_velocity <= 1),
  volume_trend FLOAT DEFAULT 0 CHECK (volume_trend >= 0 AND volume_trend <= 1),
  smart_money_score FLOAT DEFAULT 0 CHECK (smart_money_score >= 0 AND smart_money_score <= 1),
  arb_activity FLOAT DEFAULT 0 CHECK (arb_activity >= 0 AND arb_activity <= 1),
  social_score FLOAT DEFAULT 0 CHECK (social_score >= 0 AND social_score <= 1),

  -- Multipliers
  resolution_multiplier FLOAT DEFAULT 1.0 CHECK (resolution_multiplier >= 1.0 AND resolution_multiplier <= 3.0),

  -- Market metadata (cached for fast queries)
  current_price FLOAT,
  volume_24h FLOAT,
  end_date TIMESTAMPTZ,

  -- Waveform time series (30d/90d)
  momentum_history JSONB DEFAULT '[]'::JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint per market per platform
  UNIQUE(market_id, platform)
);

-- ============================================
-- INDEXES FOR MOMENTUM QUERIES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_momentum_score
  ON market_momentum(momentum_score DESC);

CREATE INDEX IF NOT EXISTS idx_momentum_hot
  ON market_momentum(is_hot)
  WHERE is_hot = TRUE;

CREATE INDEX IF NOT EXISTS idx_momentum_platform
  ON market_momentum(platform);

CREATE INDEX IF NOT EXISTS idx_momentum_platform_hot
  ON market_momentum(platform, momentum_score DESC)
  WHERE is_hot = TRUE;

CREATE INDEX IF NOT EXISTS idx_momentum_updated
  ON market_momentum(updated_at DESC);

-- ============================================
-- PRICE SNAPSHOTS TABLE (for velocity calc)
-- ============================================
CREATE TABLE IF NOT EXISTS price_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  yes_price FLOAT NOT NULL,
  no_price FLOAT,
  volume FLOAT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_market
  ON price_snapshots(market_id, platform, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_snapshots_time
  ON price_snapshots(recorded_at DESC);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE market_momentum ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_snapshots ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "service_momentum_all" ON market_momentum
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_snapshots_all" ON price_snapshots
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Public read access for momentum data
CREATE POLICY "public_momentum_read" ON market_momentum
  FOR SELECT USING (true);

-- ============================================
-- AUTO-UPDATE TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS market_momentum_updated_at ON market_momentum;
CREATE TRIGGER market_momentum_updated_at
  BEFORE UPDATE ON market_momentum
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- MOMENTUM HISTORY CLEANUP FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION trim_momentum_history()
RETURNS TRIGGER AS $$
DECLARE
  history_length INT;
BEGIN
  history_length := jsonb_array_length(NEW.momentum_history);
  IF history_length > 90 THEN
    NEW.momentum_history := (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(NEW.momentum_history) elem
        ORDER BY (elem->>'date')::TIMESTAMPTZ DESC
        LIMIT 90
      ) t
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS momentum_history_trim ON market_momentum;
CREATE TRIGGER momentum_history_trim
  BEFORE UPDATE ON market_momentum
  FOR EACH ROW EXECUTE FUNCTION trim_momentum_history();

-- ============================================
-- MOMENTUM LEADERBOARD VIEW
-- ============================================
CREATE OR REPLACE VIEW momentum_leaderboard AS
SELECT
  market_id,
  market_title,
  platform,
  momentum_score,
  is_hot,
  signal_velocity,
  volume_trend,
  smart_money_score,
  arb_activity,
  social_score,
  resolution_multiplier,
  current_price,
  volume_24h,
  end_date,
  updated_at
FROM market_momentum
WHERE momentum_score > 0
ORDER BY momentum_score DESC
LIMIT 100;

-- ============================================
-- VERIFICATION
-- ============================================
SELECT tablename, rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('market_momentum', 'price_snapshots')
ORDER BY tablename;
