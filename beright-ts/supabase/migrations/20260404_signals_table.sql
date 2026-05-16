-- BeRight Protocol - Signals Table
-- Core table for signal intelligence engine
-- MUST be created before embeddings/rag migrations

-- ============================================
-- SIGNALS TABLE
-- Stores all detected market signals
-- ============================================
CREATE TABLE IF NOT EXISTS signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Signal type
  type TEXT NOT NULL CHECK (type IN (
    'volume_surge',
    'odds_shift',
    'arb_opportunity',
    'resolution_imminent',
    'new_market',
    'smart_money',
    'narrative_emergence',
    'cross_market',
    'insider_pattern',
    'consensus_flip',
    'whale_entry',
    'social_mention',
    'momentum_breakout'
  )),

  -- Market identification
  market_id TEXT NOT NULL,
  market_title TEXT NOT NULL,
  platform TEXT NOT NULL,

  -- Signal strength (0-1)
  strength FLOAT NOT NULL CHECK (strength >= 0 AND strength <= 1),

  -- Raw detector data
  raw_data JSONB DEFAULT '{}',

  -- LLM Scout evaluation
  llm_verdict JSONB DEFAULT '{}',  -- {action, confidence, reasoning}
  action TEXT CHECK (action IN ('ALERT', 'WATCH', 'SKIP')),
  confidence INT CHECK (confidence >= 0 AND confidence <= 100),
  alert_text TEXT,

  -- Timestamps
  alerted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Recent signals
CREATE INDEX IF NOT EXISTS idx_signals_created
  ON signals(created_at DESC);

-- By action type
CREATE INDEX IF NOT EXISTS idx_signals_action
  ON signals(action, created_at DESC)
  WHERE action IS NOT NULL;

-- By market
CREATE INDEX IF NOT EXISTS idx_signals_market
  ON signals(market_id, created_at DESC);

-- By type
CREATE INDEX IF NOT EXISTS idx_signals_type
  ON signals(type, created_at DESC);

-- ALERT signals only
CREATE INDEX IF NOT EXISTS idx_signals_alerts
  ON signals(created_at DESC)
  WHERE action = 'ALERT';

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "service_signals_all" ON signals
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Public read access for signals
CREATE POLICY "public_signals_read" ON signals
  FOR SELECT USING (true);

-- ============================================
-- VERIFICATION
-- ============================================
SELECT tablename, rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'signals';
