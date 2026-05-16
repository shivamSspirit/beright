-- ============================================================================
-- BeRight Forecaster Network - External Platform Import Migration
-- ============================================================================
-- Adds tables for cross-platform reputation aggregation:
-- 1. external_platform_links - Links to external forecasting platforms
-- 2. verification_codes - Temporary codes for ownership verification
-- 3. forecaster_composite_scores - Cached composite scores
-- ============================================================================

-- ============================================================================
-- EXTERNAL PLATFORM LINKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS external_platform_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecaster_pubkey TEXT NOT NULL REFERENCES forecaster_profiles(pubkey) ON DELETE CASCADE,

  -- Platform identity
  platform TEXT NOT NULL CHECK (platform IN (
    'metaculus', 'manifold', 'goodjudgment', 'polymarket',
    'kalshi', 'infer', 'hypermind', 'predictit'
  )),
  platform_user_id TEXT NOT NULL,
  platform_profile_url TEXT,

  -- Verification
  verified_at TIMESTAMPTZ,
  verification_method TEXT CHECK (verification_method IN (
    'oauth', 'signature', 'profile_code', 'manual_review'
  )),
  verification_proof TEXT,

  -- Imported stats (JSONB for flexibility)
  imported_stats JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Refresh tracking
  last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  refresh_interval_days INTEGER NOT NULL DEFAULT 7,
  auto_refresh_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE (forecaster_pubkey, platform)
);

-- ============================================================================
-- VERIFICATION CODES
-- ============================================================================

CREATE TABLE IF NOT EXISTS verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecaster_pubkey TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN (
    'metaculus', 'manifold', 'goodjudgment', 'polymarket',
    'kalshi', 'infer', 'hypermind', 'predictit'
  )),
  platform_user_id TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One pending code per forecaster per platform
  UNIQUE (forecaster_pubkey, platform, platform_user_id)
);

-- ============================================================================
-- COMPOSITE SCORES CACHE
-- ============================================================================

CREATE TABLE IF NOT EXISTS forecaster_composite_scores (
  forecaster_pubkey TEXT PRIMARY KEY REFERENCES forecaster_profiles(pubkey) ON DELETE CASCADE,
  composite_score INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'unranked' CHECK (tier IN (
    'unranked', 'rookie', 'verified', 'elite', 'superforecaster'
  )),
  breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_predictions INTEGER NOT NULL DEFAULT 0,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- On-chain calibration program metadata
  calibration_multiplier DECIMAL(4,2) DEFAULT 1.0,  -- 0.90-1.10
  streak_bonus DECIMAL(4,2) DEFAULT 1.0,            -- 1.00-1.08
  on_chain_verified BOOLEAN DEFAULT false           -- True if from Solana calibration program
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- External platform links
CREATE INDEX IF NOT EXISTS idx_platform_links_forecaster
  ON external_platform_links(forecaster_pubkey);

CREATE INDEX IF NOT EXISTS idx_platform_links_platform
  ON external_platform_links(platform);

CREATE INDEX IF NOT EXISTS idx_platform_links_verified
  ON external_platform_links(verified_at)
  WHERE verified_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_platform_links_refresh
  ON external_platform_links(last_refreshed_at)
  WHERE auto_refresh_enabled = true;

-- Verification codes
CREATE INDEX IF NOT EXISTS idx_verification_codes_lookup
  ON verification_codes(forecaster_pubkey, platform, code)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_verification_codes_expiry
  ON verification_codes(expires_at)
  WHERE used_at IS NULL;

-- Composite scores
CREATE INDEX IF NOT EXISTS idx_composite_scores_score
  ON forecaster_composite_scores(composite_score DESC);

CREATE INDEX IF NOT EXISTS idx_composite_scores_tier
  ON forecaster_composite_scores(tier);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at on external_platform_links
DROP TRIGGER IF EXISTS update_external_platform_links_updated_at ON external_platform_links;
CREATE TRIGGER update_external_platform_links_updated_at
    BEFORE UPDATE ON external_platform_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Mark composite score as stale when platform links change
CREATE OR REPLACE FUNCTION mark_composite_score_stale()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE forecaster_composite_scores
  SET last_calculated_at = '1970-01-01'::TIMESTAMPTZ
  WHERE forecaster_pubkey = COALESCE(NEW.forecaster_pubkey, OLD.forecaster_pubkey);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_mark_composite_stale_insert ON external_platform_links;
CREATE TRIGGER trigger_mark_composite_stale_insert
  AFTER INSERT ON external_platform_links
  FOR EACH ROW EXECUTE FUNCTION mark_composite_score_stale();

DROP TRIGGER IF EXISTS trigger_mark_composite_stale_update ON external_platform_links;
CREATE TRIGGER trigger_mark_composite_stale_update
  AFTER UPDATE ON external_platform_links
  FOR EACH ROW EXECUTE FUNCTION mark_composite_score_stale();

DROP TRIGGER IF EXISTS trigger_mark_composite_stale_delete ON external_platform_links;
CREATE TRIGGER trigger_mark_composite_stale_delete
  AFTER DELETE ON external_platform_links
  FOR EACH ROW EXECUTE FUNCTION mark_composite_score_stale();

-- ============================================================================
-- AUTO-CLEANUP: Delete expired verification codes
-- ============================================================================

-- Function to clean expired codes (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM verification_codes
  WHERE expires_at < NOW() AND used_at IS NULL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Allow authenticated users to read platform links
GRANT SELECT ON external_platform_links TO authenticated;
GRANT SELECT ON forecaster_composite_scores TO authenticated;

-- Service role has full access
GRANT ALL ON external_platform_links TO service_role;
GRANT ALL ON verification_codes TO service_role;
GRANT ALL ON forecaster_composite_scores TO service_role;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Enhanced leaderboard with composite scores, platform badges, and on-chain verification
CREATE OR REPLACE VIEW forecaster_leaderboard_v2 AS
SELECT
  fp.pubkey,
  fp.display_name,
  fp.avatar_url,
  fp.tier,
  fp.global_rank,
  fp.percentile,
  COALESCE(fcs.composite_score, fp.composite_score) as composite_score,
  fp.brier_overall,
  fp.accuracy,
  fp.prediction_count,
  fp.resolved_count,
  fp.cumulative_volume_usd,
  fp.badges,
  -- On-chain calibration metadata
  COALESCE(fcs.on_chain_verified, false) as on_chain_verified,
  COALESCE(fcs.calibration_multiplier, 1.0) as calibration_multiplier,
  COALESCE(fcs.streak_bonus, 1.0) as streak_bonus,
  -- Linked platforms array
  (
    SELECT COALESCE(array_agg(epl.platform ORDER BY epl.platform), '{}')
    FROM external_platform_links epl
    WHERE epl.forecaster_pubkey = fp.pubkey
    AND epl.verified_at IS NOT NULL
  ) as linked_platforms,
  -- Platform count
  (
    SELECT COUNT(*)
    FROM external_platform_links epl
    WHERE epl.forecaster_pubkey = fp.pubkey
    AND epl.verified_at IS NOT NULL
  ) as linked_platform_count,
  -- Score breakdown
  fcs.breakdown as score_breakdown,
  fcs.total_predictions as total_cross_platform_predictions,
  fp.last_prediction_at,
  fp.updated_at
FROM forecaster_profiles fp
LEFT JOIN forecaster_composite_scores fcs ON fp.pubkey = fcs.forecaster_pubkey
WHERE fp.resolved_count >= 5
ORDER BY COALESCE(fcs.composite_score, fp.composite_score) DESC NULLS LAST;

GRANT SELECT ON forecaster_leaderboard_v2 TO authenticated;
