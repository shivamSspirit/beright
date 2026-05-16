-- ============================================================================
-- BeRight Forecaster Network Migration
-- ============================================================================
-- Phase 1: ForecasterProfile + Advanced Scoring + Merkle Commitments
-- Phase 2: Tournament Pools + Token Backing
-- ============================================================================

-- ============================================================================
-- PHASE 1: FORECASTER PROFILES
-- ============================================================================

-- Create forecaster_profiles table (extends users with forecaster data)
CREATE TABLE IF NOT EXISTS forecaster_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pubkey TEXT UNIQUE NOT NULL,                    -- Wallet address (PDA seed)
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  telegram_id BIGINT UNIQUE,
  twitter_handle TEXT,

  -- Authority
  manager_pubkey TEXT NOT NULL,                   -- Primary authority (usually same as pubkey)
  delegate_pubkey TEXT,                           -- Hot key for trading

  -- Token (via Meteora DBC)
  token_mint TEXT,                                -- SPL token mint address
  token_created_at TIMESTAMPTZ,

  -- Standard Brier Scores
  brier_overall DECIMAL(8,6),
  brier_politics DECIMAL(8,6),
  brier_crypto DECIMAL(8,6),
  brier_sports DECIMAL(8,6),
  brier_macro DECIMAL(8,6),
  brier_science DECIMAL(8,6),

  -- Advanced Scores
  volume_weighted_brier DECIMAL(8,6),
  accuracy DECIMAL(6,4),                          -- 0-1, directional accuracy
  roi DECIMAL(12,4),                              -- Total return on investment (can be negative)
  sharpe_ratio DECIMAL(8,4),                      -- Risk-adjusted returns
  kelly_compliance DECIMAL(6,4),                  -- Position sizing discipline 0-1
  skill_rating INTEGER DEFAULT 1000,              -- Elo-style, baseline 1000
  composite_score INTEGER DEFAULT 0,              -- 0-10000, weighted blend

  -- Metrics
  prediction_count INTEGER DEFAULT 0,
  resolved_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  cumulative_volume_usd DECIMAL(18,2) DEFAULT 0,
  profit_volume_usd DECIMAL(18,2) DEFAULT 0,
  total_aum_usd DECIMAL(18,2) DEFAULT 0,
  total_fees_earned_usd DECIMAL(18,2) DEFAULT 0,
  active_tournament_count INTEGER DEFAULT 0,
  total_tournaments_created INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,                       -- Current win/loss streak (positive = wins)
  max_streak INTEGER DEFAULT 0,                   -- Best streak ever

  -- Ranking
  global_rank INTEGER,
  percentile DECIMAL(5,2),                        -- 0-100
  tier TEXT DEFAULT 'unranked' CHECK (tier IN ('unranked', 'rookie', 'verified', 'elite', 'superforecaster')),
  badges TEXT[] DEFAULT '{}',
  can_create_tournament BOOLEAN DEFAULT FALSE,

  -- On-chain commitment
  predictions_root TEXT,                          -- Merkle root (32 bytes hex)
  last_on_chain_sync TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_prediction_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PHASE 1: MERKLE STATE
-- ============================================================================

-- Store merkle tree state for each forecaster
CREATE TABLE IF NOT EXISTS forecaster_merkle_state (
  forecaster_pubkey TEXT PRIMARY KEY REFERENCES forecaster_profiles(pubkey) ON DELETE CASCADE,
  current_root TEXT NOT NULL,                     -- Current merkle root
  leaf_count INTEGER DEFAULT 0,
  leaves TEXT[] DEFAULT '{}',                     -- Array of leaf hashes
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_root TEXT,                          -- Last root synced to chain
  last_synced_at TIMESTAMPTZ
);

-- ============================================================================
-- PHASE 1: ENHANCED PREDICTIONS
-- ============================================================================

-- Add new columns to predictions table
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS forecaster_pubkey TEXT;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS domain TEXT DEFAULT 'general' CHECK (domain IN ('politics', 'crypto', 'sports', 'macro', 'science', 'general'));
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS entry_price DECIMAL(8,6);
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS contracts INTEGER DEFAULT 0;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS exit_price DECIMAL(8,6);
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS pnl_usd DECIMAL(18,2);
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS brier_contribution DECIMAL(8,6);
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS tournament_id UUID;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS tournament_round INTEGER;

-- On-chain proof columns
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS intent_tx_signature TEXT;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS execution_tx_signature TEXT;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS resolution_tx_signature TEXT;

-- Merkle proof columns
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS leaf_hash TEXT;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS merkle_proof TEXT[];

-- ============================================================================
-- PHASE 2: FORECASTER TOKENS (Meteora DBC)
-- ============================================================================

CREATE TABLE IF NOT EXISTS forecaster_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecaster_pubkey TEXT REFERENCES forecaster_profiles(pubkey) ON DELETE CASCADE,

  -- Token identity
  mint TEXT UNIQUE NOT NULL,
  symbol TEXT NOT NULL,                           -- 3-5 chars, uppercase
  name TEXT NOT NULL,
  decimals INTEGER DEFAULT 6,
  uri TEXT,                                       -- Metadata URI

  -- Bonding curve config
  curve_address TEXT NOT NULL,                    -- DBC pool address
  curve_type TEXT DEFAULT 'linear' CHECK (curve_type IN ('linear', 'exponential', 'sigmoid', 'sqrt')),
  base_token TEXT NOT NULL,                       -- Quote token (USDC)
  initial_price DECIMAL(18,8) NOT NULL,
  slope DECIMAL(18,8) NOT NULL,
  max_supply DECIMAL(38,0) NOT NULL,              -- bigint
  reserve_balance DECIMAL(38,0) DEFAULT 0,

  -- Fees
  buy_fee_bps INTEGER DEFAULT 100,                -- 1%
  sell_fee_bps INTEGER DEFAULT 100,
  forecaster_fee_bps INTEGER DEFAULT 5000,        -- 50% of fees to forecaster

  -- Supply
  total_supply DECIMAL(38,0) DEFAULT 0,
  circulating_supply DECIMAL(38,0) DEFAULT 0,
  forecaster_holding DECIMAL(38,0) DEFAULT 0,
  locked_until TIMESTAMPTZ,

  -- Market data
  current_price DECIMAL(18,8),
  price_change_24h DECIMAL(8,4),
  volume_24h DECIMAL(18,2),
  market_cap_usd DECIMAL(18,2),

  -- Revenue
  fees_earned_24h DECIMAL(18,2) DEFAULT 0,
  total_fees_earned DECIMAL(18,2) DEFAULT 0,

  -- Metadata
  holder_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PHASE 2: TOKEN HOLDERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS token_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_mint TEXT REFERENCES forecaster_tokens(mint) ON DELETE CASCADE,
  wallet TEXT NOT NULL,
  balance DECIMAL(38,0) DEFAULT 0,
  avg_entry_price DECIMAL(18,8),
  total_bought DECIMAL(38,0) DEFAULT 0,
  total_sold DECIMAL(38,0) DEFAULT 0,
  realized_pnl_usd DECIMAL(18,2) DEFAULT 0,
  first_buy_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(token_mint, wallet)
);

-- ============================================================================
-- PHASE 2: TOURNAMENT POOLS (Meteora DAMM v2)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tournament_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pubkey TEXT UNIQUE NOT NULL,                    -- DAMM v2 pool address
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,

  -- Forecaster (tournament creator)
  forecaster_pubkey TEXT REFERENCES forecaster_profiles(pubkey),

  -- Meteora DAMM v2 config
  lp_mint TEXT NOT NULL,
  token_a_mint TEXT NOT NULL,                     -- Usually USDC
  token_b_mint TEXT NOT NULL,
  fee_rate INTEGER DEFAULT 30,                    -- 0.3%
  bin_step INTEGER DEFAULT 10,
  base_factor INTEGER DEFAULT 10000,
  activation_type TEXT DEFAULT 'timestamp' CHECK (activation_type IN ('timestamp', 'slot', 'baseFeeQuote')),
  activation_point BIGINT,

  -- Tournament rules
  category TEXT DEFAULT 'mixed' CHECK (category IN ('politics', 'crypto', 'sports', 'macro', 'science', 'general', 'mixed')),
  target_markets TEXT[],
  min_predictions INTEGER DEFAULT 5,
  max_leverage INTEGER DEFAULT 10,                -- Max position % of pool
  allowed_platforms TEXT[] DEFAULT ARRAY['polymarket', 'kalshi', 'jupiter', 'dflow', 'manifold', 'limitless'],

  -- Entry config
  min_deposit_usd DECIMAL(18,2) DEFAULT 10,
  max_deposit_usd DECIMAL(18,2),
  max_participants INTEGER,
  max_tvl_usd DECIMAL(18,2),
  entry_deadline TIMESTAMPTZ NOT NULL,

  -- Fees (basis points)
  entry_fee_bps INTEGER DEFAULT 50,               -- 0.5%
  management_fee_bps INTEGER DEFAULT 200,         -- 2% annualized
  performance_fee_bps INTEGER DEFAULT 2000,       -- 20%
  hurdle_rate_bps INTEGER,

  -- Fee split (of performance fee)
  forecaster_fee_split_bps INTEGER DEFAULT 2000,  -- 20% to forecaster
  platform_fee_split_bps INTEGER DEFAULT 1600,    -- 16% to BeRight
  participants_fee_split_bps INTEGER DEFAULT 6400,-- 64% to pool

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'upcoming', 'active', 'settling', 'settled', 'cancelled')),

  -- Capital allocation
  total_value_usd DECIMAL(18,2) DEFAULT 0,
  active_positions DECIMAL(18,2) DEFAULT 0,
  sanctum_yield DECIMAL(18,2) DEFAULT 0,
  liquid_reserve DECIMAL(18,2) DEFAULT 0,

  -- Sanctum integration
  inf_balance DECIMAL(38,0) DEFAULT 0,
  inf_value_usd DECIMAL(18,2) DEFAULT 0,
  yield_earned DECIMAL(18,2) DEFAULT 0,
  last_harvest TIMESTAMPTZ,

  -- Performance
  nav_per_share DECIMAL(18,8) DEFAULT 1,
  cumulative_pnl_usd DECIMAL(18,2) DEFAULT 0,
  predictions_made INTEGER DEFAULT 0,
  predictions_resolved INTEGER DEFAULT 0,
  win_rate DECIMAL(6,4) DEFAULT 0,
  avg_return_pct DECIMAL(8,4) DEFAULT 0,
  sharpe_ratio DECIMAL(8,4),
  max_drawdown DECIMAL(8,4) DEFAULT 0,
  current_drawdown DECIMAL(8,4) DEFAULT 0,

  -- Participants
  participant_count INTEGER DEFAULT 0,
  total_lp_tokens DECIMAL(38,0) DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  settles_at TIMESTAMPTZ NOT NULL,
  settled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PHASE 2: TOURNAMENT PARTICIPANTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournament_pools(id) ON DELETE CASCADE,
  participant_pubkey TEXT NOT NULL,

  -- Position
  lp_token_balance DECIMAL(38,0) DEFAULT 0,
  deposited_usd DECIMAL(18,2) NOT NULL,
  current_value_usd DECIMAL(18,2),
  share_percent DECIMAL(8,4),

  -- Entry
  entry_price DECIMAL(18,8),                      -- NAV at entry
  deposited_at TIMESTAMPTZ DEFAULT NOW(),

  -- Performance
  rank INTEGER,
  pnl_usd DECIMAL(18,2) DEFAULT 0,
  pnl_percent DECIMAL(8,4) DEFAULT 0,

  -- Withdrawal
  withdraw_requested_at TIMESTAMPTZ,
  withdrawable_at TIMESTAMPTZ,

  -- Claim
  claimed BOOLEAN DEFAULT FALSE,
  claimed_amount_usd DECIMAL(18,2),
  claimed_at TIMESTAMPTZ,

  UNIQUE(tournament_id, participant_pubkey)
);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Enhanced leaderboard view
CREATE OR REPLACE VIEW forecaster_leaderboard AS
SELECT
  fp.pubkey,
  fp.display_name,
  fp.avatar_url,
  fp.tier,
  fp.global_rank,
  fp.percentile,
  fp.composite_score,
  fp.brier_overall,
  fp.volume_weighted_brier,
  fp.skill_rating,
  fp.roi,
  fp.sharpe_ratio,
  fp.accuracy,
  fp.prediction_count,
  fp.resolved_count,
  fp.cumulative_volume_usd,
  fp.badges,
  fp.can_create_tournament,
  ft.mint as token_mint,
  ft.current_price as token_price,
  ft.price_change_24h as token_change_24h,
  ft.market_cap_usd as token_market_cap,
  (
    SELECT COUNT(*)
    FROM tournament_pools tp
    WHERE tp.forecaster_pubkey = fp.pubkey
    AND tp.status IN ('upcoming', 'active')
  ) as active_tournaments,
  (
    SELECT COALESCE(SUM(total_value_usd), 0)
    FROM tournament_pools tp
    WHERE tp.forecaster_pubkey = fp.pubkey
  ) as tournament_tvl,
  fp.last_prediction_at,
  fp.updated_at
FROM forecaster_profiles fp
LEFT JOIN forecaster_tokens ft ON fp.token_mint = ft.mint
WHERE fp.resolved_count >= 5
ORDER BY fp.composite_score DESC NULLS LAST;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Forecaster profiles
CREATE INDEX IF NOT EXISTS idx_forecaster_profiles_pubkey ON forecaster_profiles(pubkey);
CREATE INDEX IF NOT EXISTS idx_forecaster_profiles_tier ON forecaster_profiles(tier);
CREATE INDEX IF NOT EXISTS idx_forecaster_profiles_composite ON forecaster_profiles(composite_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_forecaster_profiles_brier ON forecaster_profiles(brier_overall ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_forecaster_profiles_rank ON forecaster_profiles(global_rank ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_forecaster_profiles_telegram ON forecaster_profiles(telegram_id);

-- Predictions
CREATE INDEX IF NOT EXISTS idx_predictions_forecaster ON predictions(forecaster_pubkey);
CREATE INDEX IF NOT EXISTS idx_predictions_domain ON predictions(domain);
CREATE INDEX IF NOT EXISTS idx_predictions_tournament ON predictions(tournament_id);
CREATE INDEX IF NOT EXISTS idx_predictions_leaf_hash ON predictions(leaf_hash);

-- Tokens
CREATE INDEX IF NOT EXISTS idx_forecaster_tokens_forecaster ON forecaster_tokens(forecaster_pubkey);
CREATE INDEX IF NOT EXISTS idx_forecaster_tokens_mint ON forecaster_tokens(mint);

-- Token holdings
CREATE INDEX IF NOT EXISTS idx_token_holdings_wallet ON token_holdings(wallet);
CREATE INDEX IF NOT EXISTS idx_token_holdings_mint ON token_holdings(token_mint);

-- Tournament pools
CREATE INDEX IF NOT EXISTS idx_tournament_pools_forecaster ON tournament_pools(forecaster_pubkey);
CREATE INDEX IF NOT EXISTS idx_tournament_pools_status ON tournament_pools(status);
CREATE INDEX IF NOT EXISTS idx_tournament_pools_category ON tournament_pools(category);
CREATE INDEX IF NOT EXISTS idx_tournament_pools_ends_at ON tournament_pools(ends_at);

-- Tournament participants
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_wallet ON tournament_participants(participant_pubkey);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_rank ON tournament_participants(tournament_id, rank);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_forecaster_profiles_updated_at ON forecaster_profiles;
CREATE TRIGGER update_forecaster_profiles_updated_at
    BEFORE UPDATE ON forecaster_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_forecaster_tokens_updated_at ON forecaster_tokens;
CREATE TRIGGER update_forecaster_tokens_updated_at
    BEFORE UPDATE ON forecaster_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tournament_pools_updated_at ON tournament_pools;
CREATE TRIGGER update_tournament_pools_updated_at
    BEFORE UPDATE ON tournament_pools
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (Optional - enable as needed)
-- ============================================================================

-- ALTER TABLE forecaster_profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE forecaster_tokens ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tournament_pools ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- GRANTS (adjust based on your Supabase roles)
-- ============================================================================

-- Allow authenticated users to read all forecaster data
GRANT SELECT ON forecaster_profiles TO authenticated;
GRANT SELECT ON forecaster_tokens TO authenticated;
GRANT SELECT ON token_holdings TO authenticated;
GRANT SELECT ON tournament_pools TO authenticated;
GRANT SELECT ON tournament_participants TO authenticated;
GRANT SELECT ON forecaster_leaderboard TO authenticated;

-- Allow service role full access
GRANT ALL ON forecaster_profiles TO service_role;
GRANT ALL ON forecaster_tokens TO service_role;
GRANT ALL ON token_holdings TO service_role;
GRANT ALL ON tournament_pools TO service_role;
GRANT ALL ON tournament_participants TO service_role;
GRANT ALL ON forecaster_merkle_state TO service_role;
