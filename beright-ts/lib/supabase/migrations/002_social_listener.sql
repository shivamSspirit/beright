-- BeRight Protocol - Migration 002: Social Listener
-- Monitors Twitter/X and Reddit for prediction market mentions

-- ============================================
-- SOCIAL MENTIONS TABLE
-- Raw social media mentions linked to markets
-- ============================================
CREATE TABLE IF NOT EXISTS social_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source identification
  source TEXT NOT NULL CHECK (source IN ('twitter', 'reddit', 'telegram', 'discord', 'news')),
  source_id TEXT,                    -- Tweet ID, Reddit post ID, etc.
  source_url TEXT,                   -- Direct link to the post

  -- Author info
  author TEXT,
  author_handle TEXT,
  author_followers INT,
  is_verified BOOLEAN DEFAULT FALSE,

  -- Content
  content TEXT NOT NULL,
  content_hash TEXT,                 -- For deduplication

  -- Market linking (nullable if no market matched)
  market_id TEXT,
  market_title TEXT,
  platform TEXT,
  match_confidence FLOAT,            -- 0-1 confidence of market match

  -- Sentiment analysis
  sentiment FLOAT CHECK (sentiment >= -1 AND sentiment <= 1),  -- -1 bearish, 0 neutral, 1 bullish
  sentiment_label TEXT CHECK (sentiment_label IN ('bullish', 'neutral', 'bearish')),

  -- Engagement metrics
  likes INT DEFAULT 0,
  retweets INT DEFAULT 0,            -- or shares/upvotes
  comments INT DEFAULT 0,
  engagement_score FLOAT DEFAULT 0,  -- computed: likes + 2*retweets + 3*comments

  -- Timestamps
  posted_at TIMESTAMPTZ,             -- when the post was created
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR SOCIAL QUERIES
-- ============================================

-- Recent mentions
CREATE INDEX IF NOT EXISTS idx_social_created
  ON social_mentions(created_at DESC);

-- By market
CREATE INDEX IF NOT EXISTS idx_social_market
  ON social_mentions(market_id, created_at DESC)
  WHERE market_id IS NOT NULL;

-- By source
CREATE INDEX IF NOT EXISTS idx_social_source
  ON social_mentions(source, created_at DESC);

-- High engagement
CREATE INDEX IF NOT EXISTS idx_social_engagement
  ON social_mentions(engagement_score DESC)
  WHERE engagement_score > 10;

-- Deduplication
CREATE INDEX IF NOT EXISTS idx_social_hash
  ON social_mentions(content_hash)
  WHERE content_hash IS NOT NULL;

-- ============================================
-- SOCIAL VELOCITY TABLE
-- Aggregated social metrics per market (updated every 5 min)
-- ============================================
CREATE TABLE IF NOT EXISTS social_velocity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  market_id TEXT NOT NULL,
  platform TEXT NOT NULL,

  -- Mention counts
  mentions_1h INT DEFAULT 0,
  mentions_24h INT DEFAULT 0,
  mentions_7d INT DEFAULT 0,

  -- Velocity (change rate)
  velocity_1h FLOAT DEFAULT 0,       -- mentions_1h / avg_hourly_7d
  velocity_24h FLOAT DEFAULT 0,      -- mentions_24h / avg_daily_7d

  -- Sentiment aggregates
  avg_sentiment_1h FLOAT DEFAULT 0,
  avg_sentiment_24h FLOAT DEFAULT 0,

  -- Top mentions (for display)
  top_mentions JSONB DEFAULT '[]',   -- [{source, author, content, engagement}]

  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(market_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_velocity_market
  ON social_velocity(market_id, platform);

CREATE INDEX IF NOT EXISTS idx_velocity_updated
  ON social_velocity(updated_at DESC);

-- ============================================
-- TRACKED KEYWORDS TABLE
-- Keywords to monitor for market matching
-- ============================================
CREATE TABLE IF NOT EXISTS social_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  keyword TEXT NOT NULL,
  keyword_type TEXT CHECK (keyword_type IN ('market_title', 'entity', 'ticker', 'hashtag', 'custom')),

  -- Market association
  market_id TEXT,
  platform TEXT,

  -- Priority (higher = more important)
  priority INT DEFAULT 1,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(keyword, market_id)
);

CREATE INDEX IF NOT EXISTS idx_keywords_active
  ON social_keywords(keyword)
  WHERE is_active = TRUE;

-- ============================================
-- SOCIAL ACCOUNTS TO TRACK
-- Elite forecasters and influencers on social
-- ============================================
CREATE TABLE IF NOT EXISTS tracked_social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  source TEXT NOT NULL CHECK (source IN ('twitter', 'reddit')),
  account_handle TEXT NOT NULL,
  display_name TEXT,

  -- Why we track them
  account_type TEXT CHECK (account_type IN ('forecaster', 'analyst', 'news', 'influencer', 'official')),

  -- Link to forecaster profile if applicable
  forecaster_telegram_id BIGINT,

  -- Stats
  followers INT,
  post_count INT DEFAULT 0,
  avg_engagement FLOAT DEFAULT 0,

  -- Priority
  priority INT DEFAULT 1,            -- 1-10, higher = more important
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source, account_handle)
);

CREATE INDEX IF NOT EXISTS idx_tracked_accounts_active
  ON tracked_social_accounts(source)
  WHERE is_active = TRUE;

-- ============================================
-- SOCIAL INGESTION STATE
-- Track last fetch timestamps per source
-- ============================================
CREATE TABLE IF NOT EXISTS social_ingestion_state (
  source TEXT PRIMARY KEY,
  last_fetch_at TIMESTAMPTZ,
  last_post_id TEXT,                 -- Cursor for pagination
  posts_fetched_total INT DEFAULT 0,
  errors_count INT DEFAULT 0,
  last_error TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize default states
INSERT INTO social_ingestion_state (source) VALUES
  ('twitter'),
  ('reddit'),
  ('telegram'),
  ('discord'),
  ('news')
ON CONFLICT (source) DO NOTHING;

-- ============================================
-- UPDATE TRIGGERS
-- ============================================
CREATE TRIGGER social_velocity_updated_at
  BEFORE UPDATE ON social_velocity
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tracked_accounts_updated_at
  BEFORE UPDATE ON tracked_social_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- COMPUTED ENGAGEMENT SCORE FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION compute_engagement_score(
  p_likes INT,
  p_retweets INT,
  p_comments INT
) RETURNS FLOAT AS $$
BEGIN
  -- Weighted engagement: comments > retweets > likes
  RETURN COALESCE(p_likes, 0) + COALESCE(p_retweets, 0) * 2 + COALESCE(p_comments, 0) * 3;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ADD SOCIAL SCORE TO MOMENTUM TABLE
-- ============================================
-- Already added in momentum migration, but ensure columns exist:
-- ALTER TABLE market_momentum
--   ADD COLUMN IF NOT EXISTS social_mentions_1h INT DEFAULT 0,
--   ADD COLUMN IF NOT EXISTS social_mentions_24h INT DEFAULT 0,
--   ADD COLUMN IF NOT EXISTS social_sentiment FLOAT DEFAULT 0;
