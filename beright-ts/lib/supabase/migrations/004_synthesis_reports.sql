-- =============================================================================
-- BeRight Protocol: Synthesis Reports
-- =============================================================================
-- Phase 4: Synthesis Agent - Stores generated intelligence reports
-- =============================================================================

CREATE TABLE IF NOT EXISTS synthesis_reports (
  id                TEXT PRIMARY KEY,
  created_at        TIMESTAMPTZ DEFAULT NOW(),

  -- Time range covered
  time_range_start  TIMESTAMPTZ NOT NULL,
  time_range_end    TIMESTAMPTZ NOT NULL,

  -- Report content
  headline          TEXT NOT NULL,
  summary           TEXT NOT NULL,

  -- Structured data (JSONB)
  themes            JSONB DEFAULT '[]',
  top_signals       JSONB DEFAULT '[]',
  recommendations   JSONB DEFAULT '[]',

  -- Sentiment
  overall_sentiment TEXT NOT NULL DEFAULT 'neutral',
  sentiment_score   FLOAT DEFAULT 0,

  -- Metadata
  signals_processed INT DEFAULT 0,
  tokens_used       INT DEFAULT 0,
  model_id          TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_synthesis_reports_created ON synthesis_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_synthesis_reports_sentiment ON synthesis_reports(overall_sentiment);

-- Trigger to cleanup old reports (keep last 100)
CREATE OR REPLACE FUNCTION cleanup_old_synthesis_reports()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM synthesis_reports
  WHERE id IN (
    SELECT id FROM synthesis_reports
    ORDER BY created_at DESC
    OFFSET 100
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cleanup_synthesis_reports ON synthesis_reports;
CREATE TRIGGER trg_cleanup_synthesis_reports
  AFTER INSERT ON synthesis_reports
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_old_synthesis_reports();
