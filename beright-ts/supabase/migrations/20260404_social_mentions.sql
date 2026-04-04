-- BeRight Protocol - Social Mentions Table
-- Monitors Twitter/X and Reddit for prediction market mentions

-- ============================================
-- SOCIAL MENTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS social_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source identification
  source TEXT NOT NULL CHECK (source IN ('twitter', 'reddit', 'telegram', 'discord', 'news')),
  source_id TEXT,
  source_url TEXT,

  -- Author info
  author TEXT,
  author_handle TEXT,
  author_followers INT,
  is_verified BOOLEAN DEFAULT FALSE,

  -- Content
  content TEXT NOT NULL,
  content_hash TEXT,

  -- Market linking
  market_id TEXT,
  market_title TEXT,
  platform TEXT,
  match_confidence FLOAT,

  -- Sentiment
  sentiment FLOAT CHECK (sentiment >= -1 AND sentiment <= 1),
  sentiment_label TEXT CHECK (sentiment_label IN ('bullish', 'neutral', 'bearish')),

  -- Engagement
  likes INT DEFAULT 0,
  retweets INT DEFAULT 0,
  comments INT DEFAULT 0,
  engagement_score FLOAT DEFAULT 0,

  -- Timestamps
  posted_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_social_created
  ON social_mentions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_market
  ON social_mentions(market_id, created_at DESC)
  WHERE market_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_source
  ON social_mentions(source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_engagement
  ON social_mentions(engagement_score DESC)
  WHERE engagement_score > 10;

CREATE INDEX IF NOT EXISTS idx_social_hash
  ON social_mentions(content_hash)
  WHERE content_hash IS NOT NULL;

-- ============================================
-- SOCIAL VELOCITY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS social_velocity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  mentions_1h INT DEFAULT 0,
  mentions_24h INT DEFAULT 0,
  mentions_7d INT DEFAULT 0,
  velocity_1h FLOAT DEFAULT 0,
  velocity_24h FLOAT DEFAULT 0,
  avg_sentiment_1h FLOAT DEFAULT 0,
  avg_sentiment_24h FLOAT DEFAULT 0,
  top_mentions JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(market_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_velocity_market
  ON social_velocity(market_id, platform);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE social_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_velocity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_social_mentions_all" ON social_mentions
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_social_velocity_all" ON social_velocity
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "public_social_mentions_read" ON social_mentions
  FOR SELECT USING (true);

CREATE POLICY "public_social_velocity_read" ON social_velocity
  FOR SELECT USING (true);

-- ============================================
-- VERIFICATION
-- ============================================
SELECT tablename, rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('social_mentions', 'social_velocity');
