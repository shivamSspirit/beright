-- ============================================================================
-- BeRight Decaying Brier Score Migration
-- ============================================================================
-- Adds time-weighted Brier scoring for forecaster reputation
-- Formula: BS_decay = Σ (weight_i × brier_i) / Σ weight_i
-- where weight_i = e^(-λ × t_i)
-- ============================================================================

-- ============================================================================
-- PART 1: ADD DECAY COLUMNS TO FORECASTER_PROFILES
-- ============================================================================

-- Decaying Brier scores (time-weighted)
ALTER TABLE forecaster_profiles
  ADD COLUMN IF NOT EXISTS decaying_brier_overall DECIMAL(8,6),
  ADD COLUMN IF NOT EXISTS decaying_brier_politics DECIMAL(8,6),
  ADD COLUMN IF NOT EXISTS decaying_brier_crypto DECIMAL(8,6),
  ADD COLUMN IF NOT EXISTS decaying_brier_sports DECIMAL(8,6),
  ADD COLUMN IF NOT EXISTS decaying_brier_macro DECIMAL(8,6),
  ADD COLUMN IF NOT EXISTS decaying_brier_science DECIMAL(8,6);

-- Decay configuration
ALTER TABLE forecaster_profiles
  ADD COLUMN IF NOT EXISTS decay_lambda DECIMAL(10,8) DEFAULT 0.02,  -- ~35 day half-life
  ADD COLUMN IF NOT EXISTS decay_half_life_days DECIMAL(8,2) DEFAULT 34.66,
  ADD COLUMN IF NOT EXISTS decay_effective_sample_size DECIMAL(12,4),
  ADD COLUMN IF NOT EXISTS decay_improvement DECIMAL(8,6);  -- standard - decaying

-- Decay metadata
ALTER TABLE forecaster_profiles
  ADD COLUMN IF NOT EXISTS decay_last_calculated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decay_oldest_included_days DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS decay_newest_included_days DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS decay_predictions_included INTEGER,
  ADD COLUMN IF NOT EXISTS decay_predictions_excluded INTEGER;

-- ============================================================================
-- PART 2: ADD DECAY CONFIG TABLE
-- ============================================================================

-- Store decay presets and custom configurations
CREATE TABLE IF NOT EXISTS decay_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,

  -- Core parameters
  lambda DECIMAL(10,8) NOT NULL,           -- Decay rate per day
  min_weight DECIMAL(10,8) DEFAULT 0.01,   -- Minimum weight threshold
  max_age_days INTEGER DEFAULT 365,        -- Maximum lookback
  volume_weighted BOOLEAN DEFAULT TRUE,

  -- Computed values
  half_life_days DECIMAL(8,2) GENERATED ALWAYS AS (0.693147 / lambda) STORED,

  -- Usage
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default presets
INSERT INTO decay_configs (name, description, lambda, min_weight, max_age_days, volume_weighted, is_default)
VALUES
  ('slow', 'Slow decay - good for long-term reputation (~69 day half-life)', 0.01, 0.001, 730, TRUE, FALSE),
  ('moderate', 'Moderate decay - balanced approach (~35 day half-life)', 0.02, 0.01, 365, TRUE, TRUE),
  ('fast', 'Fast decay - emphasizes recent performance (~14 day half-life)', 0.05, 0.05, 180, TRUE, FALSE),
  ('slashing', 'Very fast decay for accountability (~7 day half-life)', 0.1, 0.1, 90, FALSE, FALSE)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- PART 3: DECAY HISTORY TABLE
-- ============================================================================

-- Track decay score history for charts and analysis
CREATE TABLE IF NOT EXISTS forecaster_decay_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecaster_pubkey TEXT NOT NULL REFERENCES forecaster_profiles(pubkey) ON DELETE CASCADE,

  -- Scores at this point
  decaying_brier DECIMAL(8,6) NOT NULL,
  standard_brier DECIMAL(8,6) NOT NULL,
  decay_improvement DECIMAL(8,6),

  -- Metadata
  effective_sample_size DECIMAL(12,4),
  predictions_included INTEGER,
  decay_config_name TEXT DEFAULT 'moderate',

  -- Timestamp
  recorded_at TIMESTAMPTZ DEFAULT NOW(),

  -- For rolling window analysis
  window_start_date DATE,
  window_end_date DATE
);

-- Index for efficient history queries
CREATE INDEX IF NOT EXISTS idx_decay_history_forecaster_time
  ON forecaster_decay_history(forecaster_pubkey, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_decay_history_window
  ON forecaster_decay_history(forecaster_pubkey, window_end_date DESC);

-- ============================================================================
-- PART 4: UPDATE POOL ELIGIBILITY VIEW
-- ============================================================================

-- Drop and recreate the pool eligibility view with decay
DROP VIEW IF EXISTS forecaster_pool_eligibility;

CREATE OR REPLACE VIEW forecaster_pool_eligibility AS
SELECT
  fp.pubkey,
  fp.display_name,
  fp.tier,
  fp.prediction_count,
  fp.resolved_count,
  fp.brier_overall,
  fp.decaying_brier_overall,
  fp.composite_score,
  fp.percentile,
  fp.created_at,

  -- Eligibility checks
  (fp.prediction_count >= 20) AS has_min_predictions,
  (fp.resolved_count >= 10) AS has_min_resolved,
  (COALESCE(fp.brier_overall, 1.0) <= 0.35) AS has_good_brier,
  (COALESCE(fp.decaying_brier_overall, 1.0) <= 0.30) AS has_good_decaying_brier,
  (fp.tier IN ('verified', 'elite', 'superforecaster')) AS has_min_tier,
  (COALESCE(fp.composite_score, 0) >= 6000) AS has_min_composite,
  (EXTRACT(DAY FROM NOW() - fp.created_at) >= 7) AS has_min_age,

  -- Overall eligibility
  (
    fp.prediction_count >= 20 AND
    fp.resolved_count >= 10 AND
    COALESCE(fp.brier_overall, 1.0) <= 0.35 AND
    COALESCE(fp.decaying_brier_overall, 1.0) <= 0.30 AND
    fp.tier IN ('verified', 'elite', 'superforecaster') AND
    COALESCE(fp.composite_score, 0) >= 6000 AND
    EXTRACT(DAY FROM NOW() - fp.created_at) >= 7
  ) AS is_eligible,

  -- Days until eligible (based on account age if that's the blocker)
  GREATEST(0, 7 - EXTRACT(DAY FROM NOW() - fp.created_at))::INTEGER AS days_until_eligible

FROM forecaster_profiles fp;

-- ============================================================================
-- PART 5: SLASHING THRESHOLD VIEW
-- ============================================================================

-- View for identifying forecasters at risk of slashing
CREATE OR REPLACE VIEW forecaster_slashing_risk AS
SELECT
  fp.pubkey,
  fp.display_name,
  fp.tier,
  fp.decaying_brier_overall,
  fp.brier_overall,
  fp.decay_effective_sample_size,

  -- Slashing threshold (0.35 for standard config)
  0.35 AS slashing_threshold,

  -- Margin to threshold (negative = should slash)
  (0.35 - COALESCE(fp.decaying_brier_overall, 0.25)) AS margin_to_slash,

  -- Risk level
  CASE
    WHEN COALESCE(fp.decaying_brier_overall, 0.25) > 0.35 THEN 'critical'
    WHEN COALESCE(fp.decaying_brier_overall, 0.25) > 0.30 THEN 'warning'
    WHEN COALESCE(fp.decaying_brier_overall, 0.25) > 0.25 THEN 'moderate'
    ELSE 'good'
  END AS risk_level,

  -- Should trigger slash
  (COALESCE(fp.decaying_brier_overall, 0.25) > 0.35) AS should_slash,

  fp.decay_last_calculated_at,
  fp.updated_at

FROM forecaster_profiles fp
WHERE fp.tier IN ('verified', 'elite', 'superforecaster');

-- ============================================================================
-- PART 6: FUNCTION TO CALCULATE DECAY WEIGHT
-- ============================================================================

-- PostgreSQL function to calculate exponential decay weight
CREATE OR REPLACE FUNCTION calculate_decay_weight(
  days_elapsed DECIMAL,
  lambda DECIMAL DEFAULT 0.02
) RETURNS DECIMAL AS $$
BEGIN
  IF days_elapsed < 0 THEN
    RETURN 1.0;
  END IF;
  RETURN EXP(-lambda * days_elapsed);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate half-life from lambda
CREATE OR REPLACE FUNCTION calculate_half_life(lambda DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
  IF lambda <= 0 THEN
    RETURN 999999.0;  -- "Infinity"
  END IF;
  RETURN 0.693147 / lambda;  -- ln(2) / lambda
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- PART 7: FUNCTION TO RECALCULATE DECAYING BRIER
-- ============================================================================

-- Function to recalculate decaying Brier for a forecaster
CREATE OR REPLACE FUNCTION recalculate_decaying_brier(
  p_forecaster_pubkey TEXT,
  p_lambda DECIMAL DEFAULT 0.02,
  p_min_weight DECIMAL DEFAULT 0.01,
  p_max_age_days INTEGER DEFAULT 365
) RETURNS TABLE (
  decaying_brier DECIMAL,
  standard_brier DECIMAL,
  improvement DECIMAL,
  effective_sample_size DECIMAL,
  predictions_included INTEGER,
  predictions_excluded INTEGER
) AS $$
DECLARE
  v_total_weight DECIMAL := 0;
  v_weighted_brier_sum DECIMAL := 0;
  v_standard_brier_sum DECIMAL := 0;
  v_predictions_included INTEGER := 0;
  v_predictions_excluded INTEGER := 0;
  v_prediction RECORD;
  v_days_elapsed DECIMAL;
  v_weight DECIMAL;
  v_brier DECIMAL;
BEGIN
  -- Loop through resolved predictions
  FOR v_prediction IN
    SELECT
      predicted_probability,
      direction,
      outcome,
      resolved_at,
      stake_usd
    FROM predictions
    WHERE forecaster_pubkey = p_forecaster_pubkey
      AND resolved_at IS NOT NULL
      AND outcome IS NOT NULL
    ORDER BY resolved_at DESC
  LOOP
    -- Calculate days elapsed
    v_days_elapsed := EXTRACT(EPOCH FROM (NOW() - v_prediction.resolved_at)) / 86400.0;

    -- Skip if too old
    IF v_days_elapsed > p_max_age_days THEN
      v_predictions_excluded := v_predictions_excluded + 1;
      CONTINUE;
    END IF;

    -- Calculate decay weight
    v_weight := calculate_decay_weight(v_days_elapsed, p_lambda);

    -- Skip if below minimum weight
    IF v_weight < p_min_weight THEN
      v_predictions_excluded := v_predictions_excluded + 1;
      CONTINUE;
    END IF;

    -- Calculate Brier score: (forecast - actual)^2
    v_brier := POWER(
      CASE
        WHEN v_prediction.direction = 'YES' THEN v_prediction.predicted_probability
        ELSE 1.0 - v_prediction.predicted_probability
      END
      - CASE WHEN v_prediction.outcome THEN 1.0 ELSE 0.0 END,
      2
    );

    -- Accumulate
    v_weighted_brier_sum := v_weighted_brier_sum + (v_weight * v_brier);
    v_total_weight := v_total_weight + v_weight;
    v_standard_brier_sum := v_standard_brier_sum + v_brier;
    v_predictions_included := v_predictions_included + 1;
  END LOOP;

  -- Calculate final scores
  IF v_predictions_included > 0 AND v_total_weight > 0 THEN
    decaying_brier := v_weighted_brier_sum / v_total_weight;
    standard_brier := v_standard_brier_sum / v_predictions_included;
    improvement := standard_brier - decaying_brier;
    effective_sample_size := v_total_weight;
  ELSE
    decaying_brier := 0.25;  -- Neutral prior
    standard_brier := 0.25;
    improvement := 0;
    effective_sample_size := 0;
  END IF;

  predictions_included := v_predictions_included;
  predictions_excluded := v_predictions_excluded;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 8: TRIGGER TO UPDATE DECAY ON PREDICTION RESOLUTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_forecaster_decay_on_resolution()
RETURNS TRIGGER AS $$
DECLARE
  v_result RECORD;
BEGIN
  -- Only run when a prediction is resolved
  IF NEW.resolved_at IS NOT NULL AND NEW.outcome IS NOT NULL AND NEW.forecaster_pubkey IS NOT NULL THEN
    -- Recalculate decaying Brier
    SELECT * INTO v_result FROM recalculate_decaying_brier(NEW.forecaster_pubkey);

    -- Update forecaster profile
    UPDATE forecaster_profiles
    SET
      decaying_brier_overall = v_result.decaying_brier,
      decay_improvement = v_result.improvement,
      decay_effective_sample_size = v_result.effective_sample_size,
      decay_predictions_included = v_result.predictions_included,
      decay_predictions_excluded = v_result.predictions_excluded,
      decay_last_calculated_at = NOW(),
      updated_at = NOW()
    WHERE pubkey = NEW.forecaster_pubkey;

    -- Insert into history (daily granularity)
    INSERT INTO forecaster_decay_history (
      forecaster_pubkey,
      decaying_brier,
      standard_brier,
      decay_improvement,
      effective_sample_size,
      predictions_included,
      window_end_date
    ) VALUES (
      NEW.forecaster_pubkey,
      v_result.decaying_brier,
      v_result.standard_brier,
      v_result.improvement,
      v_result.effective_sample_size,
      v_result.predictions_included,
      CURRENT_DATE
    )
    ON CONFLICT DO NOTHING;  -- Don't duplicate daily entries
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (if not exists)
DROP TRIGGER IF EXISTS trigger_update_forecaster_decay ON predictions;
CREATE TRIGGER trigger_update_forecaster_decay
  AFTER UPDATE OF resolved_at, outcome ON predictions
  FOR EACH ROW
  EXECUTE FUNCTION update_forecaster_decay_on_resolution();

-- ============================================================================
-- PART 9: INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_forecaster_decaying_brier
  ON forecaster_profiles(decaying_brier_overall);

CREATE INDEX IF NOT EXISTS idx_forecaster_tier_decay
  ON forecaster_profiles(tier, decaying_brier_overall);

CREATE INDEX IF NOT EXISTS idx_predictions_forecaster_resolved
  ON predictions(forecaster_pubkey, resolved_at DESC)
  WHERE resolved_at IS NOT NULL;

-- ============================================================================
-- PART 10: COMMENTS
-- ============================================================================

COMMENT ON COLUMN forecaster_profiles.decaying_brier_overall IS
  'Time-weighted Brier score using exponential decay. Formula: Σ(e^(-λt) × brier) / Σ(e^(-λt))';

COMMENT ON COLUMN forecaster_profiles.decay_lambda IS
  'Decay rate per day (λ). Default 0.02 gives ~35 day half-life';

COMMENT ON COLUMN forecaster_profiles.decay_effective_sample_size IS
  'Sum of decay weights - represents "effective" number of recent predictions';

COMMENT ON COLUMN forecaster_profiles.decay_improvement IS
  'Difference between standard and decaying Brier. Positive = improving recently';

COMMENT ON TABLE decay_configs IS
  'Preset configurations for decay calculation. "moderate" is default';

COMMENT ON TABLE forecaster_decay_history IS
  'Historical decay scores for trend analysis and charts';

COMMENT ON VIEW forecaster_slashing_risk IS
  'Identifies forecasters at risk of slashing based on decaying Brier threshold';

-- Done!
