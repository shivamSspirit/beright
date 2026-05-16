-- BeRight Protocol - Migration 001: Momentum Score Engine
-- Run this in Supabase SQL Editor after the base schema

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
  -- Array of {date: string, score: number, components: {...}}
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

-- Primary ranking index (sorted by momentum DESC)
CREATE INDEX IF NOT EXISTS idx_momentum_score
  ON market_momentum(momentum_score DESC);

-- Hot markets filter
CREATE INDEX IF NOT EXISTS idx_momentum_hot
  ON market_momentum(is_hot)
  WHERE is_hot = TRUE;

-- Platform filter
CREATE INDEX IF NOT EXISTS idx_momentum_platform
  ON market_momentum(platform);

-- Composite: hot markets by platform
CREATE INDEX IF NOT EXISTS idx_momentum_platform_hot
  ON market_momentum(platform, momentum_score DESC)
  WHERE is_hot = TRUE;

-- Update timestamp for staleness check
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

-- Keep only last 7 days of snapshots (cleanup can be scheduled)
-- DELETE FROM price_snapshots WHERE recorded_at < NOW() - INTERVAL '7 days';

-- ============================================
-- MOMENTUM HISTORY CLEANUP FUNCTION
-- Keeps only 90 days of history per market
-- ============================================
CREATE OR REPLACE FUNCTION trim_momentum_history()
RETURNS TRIGGER AS $$
DECLARE
  history_length INT;
BEGIN
  -- Get current history length
  history_length := jsonb_array_length(NEW.momentum_history);

  -- Keep only last 90 entries (daily snapshots)
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

CREATE TRIGGER momentum_history_trim
  BEFORE UPDATE ON market_momentum
  FOR EACH ROW EXECUTE FUNCTION trim_momentum_history();

-- ============================================
-- AUTO-UPDATE updated_at
-- ============================================
CREATE TRIGGER market_momentum_updated_at
  BEFORE UPDATE ON market_momentum
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SIGNAL TYPE EXPANSION
-- Add new signal types for momentum/social
-- ============================================
ALTER TABLE signals
  DROP CONSTRAINT IF EXISTS signals_type_check;

ALTER TABLE signals
  ADD CONSTRAINT signals_type_check
  CHECK (type IN (
    'volume_surge', 'odds_shift', 'arb_opportunity', 'resolution_imminent',
    'new_market', 'smart_money', 'narrative_emergence', 'cross_market',
    'insider_pattern', 'consensus_flip', 'whale_entry',
    'social_mention', 'momentum_breakout'  -- NEW types
  ));

-- ============================================
-- MOMENTUM LEADERBOARD VIEW
-- Quick access to top markets
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
