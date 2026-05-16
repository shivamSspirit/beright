-- ============================================================================
-- BeRight Oracle Forecasts Migration
-- ============================================================================
-- Autonomous Oracle forecaster - discovers markets, generates predictions,
-- tracks calibration to prove BeRight's forecasting credibility.
-- ============================================================================

-- ============================================================================
-- PART 1: ORACLE FORECASTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS oracle_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Market identification
  market_id TEXT NOT NULL,
  platform TEXT NOT NULL,  -- polymarket, jupiter, kalshi
  question TEXT NOT NULL,
  category TEXT NOT NULL,  -- politics, crypto, sports, economics, science, technology

  -- Forecast core
  probability DECIMAL(4,3) NOT NULL,  -- Oracle's estimate (0.000 - 1.000)
  confidence TEXT NOT NULL,           -- high, medium, low
  confidence_low DECIMAL(4,3),        -- Lower bound of interval
  confidence_high DECIMAL(4,3),       -- Upper bound of interval

  -- Market comparison
  market_price DECIMAL(4,3),          -- Consensus price at time of forecast
  edge DECIMAL(4,3),                  -- Oracle estimate - market price
  edge_direction TEXT,                -- bullish, bearish, neutral

  -- Trading recommendation
  action TEXT NOT NULL,               -- BUY_YES, BUY_NO, WAIT, NO_TRADE
  suggested_size TEXT,                -- small, medium, large
  risk_level TEXT,                    -- low, medium, high
  best_platform TEXT,                 -- Where to trade

  -- Full methodology (JSONB for flexibility)
  methodology JSONB,
  /* Structure:
  {
    "outsideView": "Historical base rate analysis...",
    "insideView": "Current specific factors...",
    "synthesis": "Final reasoning...",
    "bullishFactors": ["Factor 1", "Factor 2"],
    "bearishFactors": ["Factor 1", "Factor 2"],
    "assumptions": ["Assumption 1", "Assumption 2"],
    "model": "claude-opus-4-5",
    "temperature": 0.3,
    "tokensUsed": 2500
  }
  */

  -- Uncertainties and triggers
  uncertainties JSONB,
  /* Structure:
  [
    { "factor": "Name", "impact": "Could shift +/- 10%" },
    { "factor": "Name", "impact": "Binary outcome dependency" }
  ]
  */

  update_triggers JSONB,
  /* Structure:
  [
    { "event": "If X happens", "action": "Revise up to Y%" },
    { "event": "If Y happens", "action": "Revise down to Z%" }
  ]
  */

  -- Source data
  sources JSONB,
  /* Structure:
  [
    { "platform": "polymarket", "price": 0.65, "volume": 150000 },
    { "platform": "kalshi", "price": 0.68, "volume": 80000 }
  ]
  */

  -- Market metadata (cached at forecast time)
  market_volume DECIMAL(18,2),
  market_end_date TIMESTAMPTZ,
  market_description TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  forecasted_for_date DATE DEFAULT CURRENT_DATE,  -- For dedup

  -- Resolution tracking
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  actual_outcome BOOLEAN,                         -- TRUE = yes, FALSE = no
  brier_score DECIMAL(5,4),                       -- (probability - outcome)^2

  -- Constraints
  CONSTRAINT valid_probability CHECK (probability >= 0 AND probability <= 1),
  CONSTRAINT valid_confidence_bounds CHECK (
    confidence_low IS NULL OR (confidence_low >= 0 AND confidence_low <= probability)
  ),
  CONSTRAINT valid_confidence_upper CHECK (
    confidence_high IS NULL OR (confidence_high >= probability AND confidence_high <= 1)
  ),
  CONSTRAINT valid_brier CHECK (brier_score IS NULL OR (brier_score >= 0 AND brier_score <= 1)),

  -- Unique per market per day (can update same market daily)
  UNIQUE(market_id, forecasted_for_date)
);

-- ============================================================================
-- PART 2: ORACLE STATS TABLE (Aggregate Performance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS oracle_stats (
  id INTEGER PRIMARY KEY DEFAULT 1,

  -- Prediction counts
  total_predictions INTEGER DEFAULT 0,
  resolved_predictions INTEGER DEFAULT 0,
  pending_predictions INTEGER DEFAULT 0,

  -- Accuracy metrics
  correct_predictions INTEGER DEFAULT 0,         -- Where outcome matched >50% direction
  brier_score_sum DECIMAL(10,4) DEFAULT 0,
  brier_score_avg DECIMAL(5,4),
  log_score_sum DECIMAL(12,4) DEFAULT 0,
  log_score_avg DECIMAL(6,4),

  -- Category breakdown (JSONB for flexibility)
  category_stats JSONB,
  /* Structure:
  {
    "politics": { "count": 15, "resolved": 10, "brierAvg": 0.12 },
    "crypto": { "count": 20, "resolved": 12, "brierAvg": 0.18 }
  }
  */

  -- Time-series tracking
  weekly_brier JSONB,
  /* Structure:
  [
    { "week": "2024-W15", "brier": 0.15, "count": 8 },
    { "week": "2024-W16", "brier": 0.12, "count": 10 }
  ]
  */

  -- Edge tracking
  total_edge_value DECIMAL(12,4) DEFAULT 0,
  avg_edge_magnitude DECIMAL(5,4),

  -- Timestamps
  last_forecast_at TIMESTAMPTZ,
  last_resolution_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure single row
  CONSTRAINT oracle_stats_singleton CHECK (id = 1)
);

-- Insert initial row
INSERT INTO oracle_stats (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============================================================================
-- PART 3: ORACLE RUN LOG (Track each cron execution)
-- ============================================================================

CREATE TABLE IF NOT EXISTS oracle_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Run metadata
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',  -- running, completed, failed, partial

  -- Discovery stats
  markets_scanned INTEGER DEFAULT 0,
  markets_eligible INTEGER DEFAULT 0,
  markets_skipped_existing INTEGER DEFAULT 0,

  -- Forecast stats
  forecasts_generated INTEGER DEFAULT 0,
  forecasts_saved INTEGER DEFAULT 0,
  forecasts_failed INTEGER DEFAULT 0,

  -- Performance
  duration_ms INTEGER,
  llm_tokens_used INTEGER,
  llm_cost_usd DECIMAL(10,4),

  -- Errors (if any)
  error_message TEXT,
  error_stack TEXT,

  -- Sources
  platforms_queried JSONB,
  /* ["polymarket", "jupiter", "kalshi"] */

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 4: INDEXES
-- ============================================================================

-- Main query patterns
CREATE INDEX IF NOT EXISTS idx_oracle_forecasts_category
  ON oracle_forecasts(category);

CREATE INDEX IF NOT EXISTS idx_oracle_forecasts_created
  ON oracle_forecasts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oracle_forecasts_resolved
  ON oracle_forecasts(resolved, resolved_at DESC);

CREATE INDEX IF NOT EXISTS idx_oracle_forecasts_market
  ON oracle_forecasts(market_id);

CREATE INDEX IF NOT EXISTS idx_oracle_forecasts_platform
  ON oracle_forecasts(platform);

CREATE INDEX IF NOT EXISTS idx_oracle_forecasts_date
  ON oracle_forecasts(forecasted_for_date DESC);

-- Active forecasts (not resolved, recent)
CREATE INDEX IF NOT EXISTS idx_oracle_forecasts_active
  ON oracle_forecasts(created_at DESC)
  WHERE resolved = FALSE;

-- High edge opportunities
CREATE INDEX IF NOT EXISTS idx_oracle_forecasts_edge
  ON oracle_forecasts(ABS(edge) DESC)
  WHERE resolved = FALSE;

-- Run log
CREATE INDEX IF NOT EXISTS idx_oracle_runs_status
  ON oracle_runs(status, started_at DESC);

-- ============================================================================
-- PART 5: HELPER FUNCTIONS
-- ============================================================================

-- Calculate Brier score
CREATE OR REPLACE FUNCTION oracle_calculate_brier(
  p_probability DECIMAL,
  p_outcome BOOLEAN
) RETURNS DECIMAL AS $$
BEGIN
  IF p_outcome THEN
    RETURN POWER(1.0 - p_probability, 2);
  ELSE
    RETURN POWER(p_probability, 2);
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate log score (for better discrimination)
CREATE OR REPLACE FUNCTION oracle_calculate_log_score(
  p_probability DECIMAL,
  p_outcome BOOLEAN
) RETURNS DECIMAL AS $$
DECLARE
  v_prob DECIMAL;
BEGIN
  -- Clamp probability to avoid log(0)
  IF p_outcome THEN
    v_prob := GREATEST(p_probability, 0.001);
    RETURN LN(v_prob);
  ELSE
    v_prob := GREATEST(1.0 - p_probability, 0.001);
    RETURN LN(v_prob);
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- PART 6: RESOLUTION TRIGGER
-- ============================================================================

-- Auto-update oracle_stats when a forecast is resolved
CREATE OR REPLACE FUNCTION update_oracle_stats_on_resolution()
RETURNS TRIGGER AS $$
DECLARE
  v_category_stats JSONB;
  v_brier DECIMAL;
BEGIN
  -- Only trigger when resolved changes to TRUE
  IF NEW.resolved = TRUE AND (OLD.resolved IS NULL OR OLD.resolved = FALSE) THEN

    -- Calculate Brier score
    v_brier := oracle_calculate_brier(NEW.probability, NEW.actual_outcome);

    -- Update the forecast record with Brier score
    NEW.brier_score := v_brier;

    -- Update aggregate stats
    UPDATE oracle_stats
    SET
      resolved_predictions = resolved_predictions + 1,
      pending_predictions = GREATEST(0, pending_predictions - 1),
      correct_predictions = correct_predictions + CASE
        WHEN (NEW.probability > 0.5 AND NEW.actual_outcome = TRUE) OR
             (NEW.probability < 0.5 AND NEW.actual_outcome = FALSE) THEN 1
        ELSE 0
      END,
      brier_score_sum = brier_score_sum + v_brier,
      brier_score_avg = (brier_score_sum + v_brier) / (resolved_predictions + 1),
      last_resolution_at = NOW(),
      updated_at = NOW()
    WHERE id = 1;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_oracle_stats_resolution ON oracle_forecasts;
CREATE TRIGGER trigger_oracle_stats_resolution
  BEFORE UPDATE OF resolved, actual_outcome ON oracle_forecasts
  FOR EACH ROW
  EXECUTE FUNCTION update_oracle_stats_on_resolution();

-- ============================================================================
-- PART 7: INSERT TRIGGER (Track new forecasts)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_oracle_stats_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE oracle_stats
  SET
    total_predictions = total_predictions + 1,
    pending_predictions = pending_predictions + 1,
    last_forecast_at = NOW(),
    updated_at = NOW()
  WHERE id = 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_oracle_stats_insert ON oracle_forecasts;
CREATE TRIGGER trigger_oracle_stats_insert
  AFTER INSERT ON oracle_forecasts
  FOR EACH ROW
  EXECUTE FUNCTION update_oracle_stats_on_insert();

-- ============================================================================
-- PART 8: VIEWS
-- ============================================================================

-- Active forecasts view (for dashboard)
CREATE OR REPLACE VIEW oracle_active_forecasts AS
SELECT
  id,
  market_id,
  platform,
  question,
  category,
  probability,
  confidence,
  confidence_low,
  confidence_high,
  market_price,
  edge,
  edge_direction,
  action,
  suggested_size,
  risk_level,
  methodology,
  uncertainties,
  update_triggers,
  market_end_date,
  created_at,
  -- Calculated fields
  EXTRACT(DAY FROM (market_end_date - NOW())) AS days_until_resolution,
  ABS(edge) AS edge_magnitude
FROM oracle_forecasts
WHERE resolved = FALSE
ORDER BY created_at DESC;

-- Performance summary view
CREATE OR REPLACE VIEW oracle_performance AS
SELECT
  os.total_predictions,
  os.resolved_predictions,
  os.pending_predictions,
  os.correct_predictions,
  os.brier_score_avg,
  CASE
    WHEN os.resolved_predictions > 0
    THEN ROUND((os.correct_predictions::DECIMAL / os.resolved_predictions * 100), 1)
    ELSE 0
  END AS accuracy_percentage,
  -- Brier interpretation
  CASE
    WHEN os.brier_score_avg IS NULL THEN 'No data'
    WHEN os.brier_score_avg < 0.10 THEN 'Elite (Superforecaster)'
    WHEN os.brier_score_avg < 0.15 THEN 'Excellent'
    WHEN os.brier_score_avg < 0.20 THEN 'Good'
    WHEN os.brier_score_avg < 0.25 THEN 'Average'
    ELSE 'Below Average'
  END AS calibration_rating,
  os.last_forecast_at,
  os.last_resolution_at,
  os.updated_at
FROM oracle_stats os
WHERE os.id = 1;

-- ============================================================================
-- PART 9: COMMENTS
-- ============================================================================

COMMENT ON TABLE oracle_forecasts IS
  'Autonomous Oracle forecasts - predictions generated by BeRight AI every 6 hours';

COMMENT ON COLUMN oracle_forecasts.probability IS
  'Oracle probability estimate (0-1). Higher = more likely YES outcome';

COMMENT ON COLUMN oracle_forecasts.edge IS
  'Difference between Oracle estimate and market consensus. Positive = bullish';

COMMENT ON COLUMN oracle_forecasts.methodology IS
  'Full reasoning: outside view, inside view, synthesis, factors';

COMMENT ON COLUMN oracle_forecasts.brier_score IS
  'Calibration score: (prediction - outcome)^2. Lower is better. <0.15 is elite';

COMMENT ON TABLE oracle_stats IS
  'Aggregate performance metrics for Oracle. Single row table';

COMMENT ON TABLE oracle_runs IS
  'Log of each Oracle cron run for debugging and monitoring';

COMMENT ON VIEW oracle_active_forecasts IS
  'Active (unresolved) forecasts for dashboard display';

COMMENT ON VIEW oracle_performance IS
  'Summary statistics for Oracle track record';

-- ============================================================================
-- Done!
-- ============================================================================
