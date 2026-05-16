-- =============================================================================
-- BeRight Protocol: Signal Quality Feedback Loop
-- =============================================================================
-- Phase 5: Track signal accuracy and self-calibrate
--
-- Tables:
--   - signal_feedback: Tracks signal outcomes
--   - signal_quality_scores: Aggregated quality metrics per signal type
--   - calibration_history: Historical calibration scores
-- =============================================================================

-- Signal feedback table
-- Links signals to their market outcomes
CREATE TABLE IF NOT EXISTS signal_feedback (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  signal_id         UUID REFERENCES signals(id) ON DELETE CASCADE,
  signal_type       TEXT NOT NULL,

  -- Original signal data
  market_id         TEXT NOT NULL,
  market_title      TEXT NOT NULL,
  platform          TEXT NOT NULL,
  original_action   TEXT NOT NULL,  -- ALERT, WATCH, SKIP
  original_confidence INT NOT NULL,
  original_strength FLOAT NOT NULL,

  -- Outcome tracking
  outcome           TEXT,           -- 'correct', 'incorrect', 'partial', 'pending'
  outcome_notes     TEXT,

  -- Market resolution data
  resolution_price  FLOAT,          -- Final probability (0-1)
  price_at_signal   FLOAT,          -- Probability when signal was generated
  price_change      FLOAT,          -- Resolution - signal price

  -- Feedback quality
  feedback_source   TEXT NOT NULL DEFAULT 'auto',  -- 'auto', 'manual', 'resolution'
  feedback_confidence FLOAT DEFAULT 1.0,  -- How confident we are in this feedback

  -- Timestamps
  signal_at         TIMESTAMPTZ NOT NULL,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Signal quality scores (aggregated per signal type)
CREATE TABLE IF NOT EXISTS signal_quality_scores (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  signal_type       TEXT NOT NULL UNIQUE,

  -- Accuracy metrics
  total_signals     INT DEFAULT 0,
  correct_signals   INT DEFAULT 0,
  incorrect_signals INT DEFAULT 0,
  pending_signals   INT DEFAULT 0,

  -- Quality scores (0-1)
  accuracy_score    FLOAT DEFAULT 0.5,  -- correct / (correct + incorrect)
  precision_score   FLOAT DEFAULT 0.5,  -- true positives / predicted positives
  recall_score      FLOAT DEFAULT 0.5,  -- true positives / actual positives

  -- Brier-style calibration
  brier_score       FLOAT DEFAULT 0.25,  -- Lower is better
  calibration_error FLOAT DEFAULT 0.1,   -- Expected vs observed accuracy

  -- Confidence metrics
  avg_confidence    FLOAT DEFAULT 50,
  confidence_std    FLOAT DEFAULT 20,

  -- Signal-specific adjustments
  weight_modifier   FLOAT DEFAULT 1.0,  -- Applied to future signals
  recommended_threshold FLOAT DEFAULT 0.7,

  -- Timestamps
  last_updated      TIMESTAMPTZ DEFAULT NOW(),
  last_calibration  TIMESTAMPTZ DEFAULT NOW()
);

-- Calibration history for tracking improvement over time
CREATE TABLE IF NOT EXISTS calibration_history (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recorded_at       TIMESTAMPTZ DEFAULT NOW(),

  -- Overall metrics
  overall_accuracy  FLOAT NOT NULL,
  overall_brier     FLOAT NOT NULL,

  -- Per-type breakdown
  type_scores       JSONB DEFAULT '{}',

  -- Period covered
  period_start      TIMESTAMPTZ NOT NULL,
  period_end        TIMESTAMPTZ NOT NULL,
  signals_evaluated INT DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_signal_feedback_signal_id ON signal_feedback(signal_id);
CREATE INDEX IF NOT EXISTS idx_signal_feedback_signal_type ON signal_feedback(signal_type);
CREATE INDEX IF NOT EXISTS idx_signal_feedback_outcome ON signal_feedback(outcome);
CREATE INDEX IF NOT EXISTS idx_signal_feedback_created ON signal_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_calibration_history_recorded ON calibration_history(recorded_at);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to update quality scores after feedback
CREATE OR REPLACE FUNCTION update_signal_quality_scores(p_signal_type TEXT)
RETURNS void AS $$
DECLARE
  v_total INT;
  v_correct INT;
  v_incorrect INT;
  v_pending INT;
  v_accuracy FLOAT;
  v_brier FLOAT;
  v_avg_conf FLOAT;
BEGIN
  -- Count signals by outcome
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE outcome = 'correct'),
    COUNT(*) FILTER (WHERE outcome = 'incorrect'),
    COUNT(*) FILTER (WHERE outcome = 'pending')
  INTO v_total, v_correct, v_incorrect, v_pending
  FROM signal_feedback
  WHERE signal_type = p_signal_type;

  -- Calculate accuracy
  IF (v_correct + v_incorrect) > 0 THEN
    v_accuracy := v_correct::FLOAT / (v_correct + v_incorrect)::FLOAT;
  ELSE
    v_accuracy := 0.5;
  END IF;

  -- Calculate average confidence
  SELECT AVG(original_confidence)
  INTO v_avg_conf
  FROM signal_feedback
  WHERE signal_type = p_signal_type;

  -- Calculate Brier score (simplified: for binary outcomes)
  SELECT AVG(
    CASE
      WHEN outcome = 'correct' THEN POWER(1 - original_strength, 2)
      WHEN outcome = 'incorrect' THEN POWER(original_strength, 2)
      ELSE 0.25  -- Neutral for pending
    END
  )
  INTO v_brier
  FROM signal_feedback
  WHERE signal_type = p_signal_type
    AND outcome IN ('correct', 'incorrect');

  IF v_brier IS NULL THEN
    v_brier := 0.25;
  END IF;

  -- Upsert quality scores
  INSERT INTO signal_quality_scores (
    signal_type, total_signals, correct_signals, incorrect_signals,
    pending_signals, accuracy_score, brier_score, avg_confidence,
    weight_modifier, last_updated
  ) VALUES (
    p_signal_type, v_total, v_correct, v_incorrect,
    v_pending, v_accuracy, v_brier, COALESCE(v_avg_conf, 50),
    -- Weight modifier: boost accurate signals, penalize inaccurate
    GREATEST(0.5, LEAST(1.5, 0.5 + v_accuracy)),
    NOW()
  )
  ON CONFLICT (signal_type) DO UPDATE SET
    total_signals = EXCLUDED.total_signals,
    correct_signals = EXCLUDED.correct_signals,
    incorrect_signals = EXCLUDED.incorrect_signals,
    pending_signals = EXCLUDED.pending_signals,
    accuracy_score = EXCLUDED.accuracy_score,
    brier_score = EXCLUDED.brier_score,
    avg_confidence = EXCLUDED.avg_confidence,
    weight_modifier = EXCLUDED.weight_modifier,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update quality scores
CREATE OR REPLACE FUNCTION trigger_update_quality_scores()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_signal_quality_scores(NEW.signal_type);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_quality_scores ON signal_feedback;
CREATE TRIGGER trg_update_quality_scores
  AFTER INSERT OR UPDATE ON signal_feedback
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_quality_scores();

-- Initialize quality scores for existing signal types
INSERT INTO signal_quality_scores (signal_type)
SELECT DISTINCT type FROM signals
ON CONFLICT (signal_type) DO NOTHING;
