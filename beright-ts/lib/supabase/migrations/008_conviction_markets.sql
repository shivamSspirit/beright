-- ============================================================================
-- BeRight Conviction Markets - Database Migration
-- ============================================================================
--
-- Creates tables for the conviction market system where crypto projects
-- stake real money on their own milestones.
--
-- Run with: supabase db push
-- ============================================================================

-- ============================================================================
-- PROJECTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS conviction_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'defi', 'nft', 'gaming', 'infrastructure', 'dao', 'social', 'prediction_market', 'other'
  )),

  -- Links
  website TEXT,
  twitter TEXT,
  github TEXT,
  discord TEXT,

  -- On-chain
  token_mint TEXT,
  treasury_wallet TEXT NOT NULL,

  -- Metrics
  conviction_score DECIMAL DEFAULT 0 CHECK (conviction_score >= 0 AND conviction_score <= 100),
  total_staked DECIMAL DEFAULT 0 CHECK (total_staked >= 0),
  markets_created INT DEFAULT 0 CHECK (markets_created >= 0),
  markets_resolved INT DEFAULT 0 CHECK (markets_resolved >= 0),
  success_rate DECIMAL DEFAULT 0 CHECK (success_rate >= 0 AND success_rate <= 100),

  -- AI Visibility
  geo_score DECIMAL CHECK (geo_score IS NULL OR (geo_score >= 0 AND geo_score <= 100)),
  last_citation_check TIMESTAMPTZ,

  -- Verification
  verified BOOLEAN DEFAULT FALSE,
  verification_method TEXT CHECK (verification_method IS NULL OR verification_method IN ('tweet', 'dns', 'wallet_sign')),
  verified_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for projects
CREATE INDEX IF NOT EXISTS idx_conviction_projects_slug ON conviction_projects(slug);
CREATE INDEX IF NOT EXISTS idx_conviction_projects_category ON conviction_projects(category);
CREATE INDEX IF NOT EXISTS idx_conviction_projects_wallet ON conviction_projects(treasury_wallet);
CREATE INDEX IF NOT EXISTS idx_conviction_projects_score ON conviction_projects(conviction_score DESC);
CREATE INDEX IF NOT EXISTS idx_conviction_projects_verified ON conviction_projects(verified) WHERE verified = TRUE;

-- ============================================================================
-- MARKETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS conviction_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES conviction_projects(id) ON DELETE CASCADE,

  -- Market details
  question TEXT NOT NULL,
  description TEXT,
  milestone_type TEXT NOT NULL CHECK (milestone_type IN (
    'mainnet_launch', 'user_milestone', 'tvl_milestone', 'token_launch',
    'partnership', 'audit_completion', 'feature_release', 'revenue_milestone',
    'funding_round', 'ai_visibility', 'custom'
  )),

  -- Resolution
  resolution_criteria TEXT NOT NULL,
  resolution_source TEXT NOT NULL CHECK (resolution_source IN (
    'on_chain', 'api', 'manual', 'oracle', 'ai_query'
  )),
  resolution_date TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  outcome TEXT CHECK (outcome IS NULL OR outcome IN ('yes', 'no', 'invalid')),
  resolution_evidence TEXT,

  -- Staking
  project_stake_amount DECIMAL NOT NULL CHECK (project_stake_amount > 0),
  project_stake_position TEXT DEFAULT 'yes' CHECK (project_stake_position IN ('yes', 'no')),
  project_stake_tx TEXT,
  project_stake_at TIMESTAMPTZ,

  -- Trading
  yes_price DECIMAL DEFAULT 0.5 CHECK (yes_price >= 0 AND yes_price <= 1),
  no_price DECIMAL DEFAULT 0.5 CHECK (no_price >= 0 AND no_price <= 1),
  volume DECIMAL DEFAULT 0 CHECK (volume >= 0),
  liquidity DECIMAL DEFAULT 0 CHECK (liquidity >= 0),
  trade_count INT DEFAULT 0 CHECK (trade_count >= 0),

  -- Platform
  platform TEXT NOT NULL DEFAULT 'beright' CHECK (platform IN ('beright', 'manifold', 'polymarket')),
  external_id TEXT,
  external_url TEXT,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending_stake', 'active', 'closed', 'resolved', 'disputed'
  )),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for markets
CREATE INDEX IF NOT EXISTS idx_conviction_markets_project ON conviction_markets(project_id);
CREATE INDEX IF NOT EXISTS idx_conviction_markets_status ON conviction_markets(status);
CREATE INDEX IF NOT EXISTS idx_conviction_markets_resolution ON conviction_markets(resolution_date);
CREATE INDEX IF NOT EXISTS idx_conviction_markets_type ON conviction_markets(milestone_type);
CREATE INDEX IF NOT EXISTS idx_conviction_markets_active ON conviction_markets(status, resolution_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_conviction_markets_volume ON conviction_markets(volume DESC) WHERE status = 'active';

-- ============================================================================
-- AI VISIBILITY TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS conviction_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES conviction_projects(id) ON DELETE CASCADE,

  llm TEXT NOT NULL CHECK (llm IN ('chatgpt', 'gemini', 'perplexity', 'claude', 'deepseek')),
  query TEXT NOT NULL,
  mentioned BOOLEAN NOT NULL,
  position INT CHECK (position IS NULL OR position > 0),
  context TEXT,

  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for visibility
CREATE INDEX IF NOT EXISTS idx_conviction_visibility_project ON conviction_visibility(project_id);
CREATE INDEX IF NOT EXISTS idx_conviction_visibility_llm ON conviction_visibility(llm);
CREATE INDEX IF NOT EXISTS idx_conviction_visibility_mentioned ON conviction_visibility(project_id, mentioned) WHERE mentioned = TRUE;
CREATE INDEX IF NOT EXISTS idx_conviction_visibility_recent ON conviction_visibility(checked_at DESC);

-- ============================================================================
-- SCORE HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS conviction_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES conviction_projects(id) ON DELETE CASCADE,

  score DECIMAL NOT NULL CHECK (score >= 0 AND score <= 100),
  components JSONB,

  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for score history
CREATE INDEX IF NOT EXISTS idx_conviction_score_history_project ON conviction_score_history(project_id);
CREATE INDEX IF NOT EXISTS idx_conviction_score_history_date ON conviction_score_history(calculated_at DESC);

-- ============================================================================
-- TRADES TABLE (for tracking community trades on conviction markets)
-- ============================================================================

CREATE TABLE IF NOT EXISTS conviction_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES conviction_markets(id) ON DELETE CASCADE,

  trader_wallet TEXT NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('yes', 'no')),
  amount DECIMAL NOT NULL CHECK (amount > 0),
  price DECIMAL NOT NULL CHECK (price >= 0 AND price <= 1),
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),

  tx_signature TEXT,
  platform TEXT DEFAULT 'beright',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for trades
CREATE INDEX IF NOT EXISTS idx_conviction_trades_market ON conviction_trades(market_id);
CREATE INDEX IF NOT EXISTS idx_conviction_trades_wallet ON conviction_trades(trader_wallet);
CREATE INDEX IF NOT EXISTS idx_conviction_trades_recent ON conviction_trades(created_at DESC);

-- ============================================================================
-- VERIFICATION CODES
-- ============================================================================

CREATE TABLE IF NOT EXISTS conviction_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES conviction_projects(id) ON DELETE CASCADE,

  code TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('tweet', 'dns', 'wallet_sign')),
  challenge TEXT NOT NULL,

  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for verification codes
CREATE INDEX IF NOT EXISTS idx_conviction_verification_project ON conviction_verification_codes(project_id);
CREATE INDEX IF NOT EXISTS idx_conviction_verification_code ON conviction_verification_codes(code);
CREATE INDEX IF NOT EXISTS idx_conviction_verification_active ON conviction_verification_codes(project_id, expires_at)
  WHERE used_at IS NULL;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at on projects
CREATE OR REPLACE FUNCTION update_conviction_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_conviction_projects_updated_at ON conviction_projects;
CREATE TRIGGER trigger_conviction_projects_updated_at
  BEFORE UPDATE ON conviction_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_conviction_projects_updated_at();

-- Update updated_at on markets
CREATE OR REPLACE FUNCTION update_conviction_markets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_conviction_markets_updated_at ON conviction_markets;
CREATE TRIGGER trigger_conviction_markets_updated_at
  BEFORE UPDATE ON conviction_markets
  FOR EACH ROW
  EXECUTE FUNCTION update_conviction_markets_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE conviction_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE conviction_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE conviction_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE conviction_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE conviction_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE conviction_verification_codes ENABLE ROW LEVEL SECURITY;

-- Public read access for projects and markets
CREATE POLICY "conviction_projects_select" ON conviction_projects
  FOR SELECT USING (true);

CREATE POLICY "conviction_markets_select" ON conviction_markets
  FOR SELECT USING (true);

CREATE POLICY "conviction_visibility_select" ON conviction_visibility
  FOR SELECT USING (true);

CREATE POLICY "conviction_score_history_select" ON conviction_score_history
  FOR SELECT USING (true);

CREATE POLICY "conviction_trades_select" ON conviction_trades
  FOR SELECT USING (true);

-- Service role has full access
CREATE POLICY "conviction_projects_service" ON conviction_projects
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "conviction_markets_service" ON conviction_markets
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "conviction_visibility_service" ON conviction_visibility
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "conviction_score_history_service" ON conviction_score_history
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "conviction_trades_service" ON conviction_trades
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "conviction_verification_codes_service" ON conviction_verification_codes
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE conviction_projects IS 'Crypto projects that create conviction markets';
COMMENT ON TABLE conviction_markets IS 'Prediction markets where projects stake on their milestones';
COMMENT ON TABLE conviction_visibility IS 'AI LLM citation tracking for projects';
COMMENT ON TABLE conviction_score_history IS 'Historical conviction scores for trend analysis';
COMMENT ON TABLE conviction_trades IS 'Community trades on conviction markets';
COMMENT ON TABLE conviction_verification_codes IS 'Verification codes for project ownership';

COMMENT ON COLUMN conviction_projects.conviction_score IS 'Overall conviction score (0-100)';
COMMENT ON COLUMN conviction_projects.geo_score IS 'AI visibility / GEO score (0-100)';
COMMENT ON COLUMN conviction_markets.project_stake_amount IS 'SOL staked by project';
COMMENT ON COLUMN conviction_markets.yes_price IS 'Current YES price (0-1)';
