-- BeRight Memory & Conversations Schema
-- BeRight-compatible memory architecture with wallet-first identity
-- Run after schema-core.sql

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";  -- pgvector for semantic search

-- ========================================
-- CONVERSATIONS TABLE
-- ========================================
-- Each conversation is wallet-scoped and tracks agent interactions
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,

  -- Metadata
  title TEXT,  -- Auto-generated or user-set
  summary TEXT,  -- Compacted summary for long conversations

  -- Tracking
  agents_used TEXT[] DEFAULT '{}',  -- ['SCOUT', 'ANALYST', 'TRADER']
  markets_discussed TEXT[] DEFAULT '{}',  -- Market IDs referenced
  tags TEXT[] DEFAULT '{}',  -- User tags

  -- State
  bookmarked BOOLEAN DEFAULT FALSE,
  archived BOOLEAN DEFAULT FALSE,
  pinned BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),

  -- Gateway session link (for context continuity)
  gateway_session_id TEXT,

  -- Full-text search
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(summary, '')), 'B')
  ) STORED
);

-- Indexes for conversations
CREATE INDEX IF NOT EXISTS idx_conversations_wallet ON conversations(wallet_address);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_bookmarked ON conversations(wallet_address) WHERE bookmarked = TRUE;
CREATE INDEX IF NOT EXISTS idx_conversations_search ON conversations USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_conversations_markets ON conversations USING GIN(markets_discussed);
CREATE INDEX IF NOT EXISTS idx_conversations_agents ON conversations USING GIN(agents_used);

-- ========================================
-- MESSAGES TABLE
-- ========================================
-- Individual messages within conversations
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'agent', 'system')),
  agent_type TEXT,  -- 'SCOUT', 'ANALYST', 'TRADER', 'SYSTEM'
  content TEXT NOT NULL,

  -- Agent metadata
  mood TEXT,  -- 'BULLISH', 'BEARISH', 'NEUTRAL', 'CAUTIOUS'
  tool_calls JSONB DEFAULT '[]',  -- Tool invocations

  -- References
  market_ids TEXT[] DEFAULT '{}',  -- Markets mentioned
  prediction_ids TEXT[] DEFAULT '{}',  -- Linked predictions

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Embedding for semantic search (1536 dims for OpenAI, 1024 for Voyage)
  embedding VECTOR(1536),

  -- Full-text search
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', content)
  ) STORED
);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_search ON messages USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_agent ON messages(agent_type) WHERE agent_type IS NOT NULL;

-- Vector similarity search index (IVFFlat for large datasets)
CREATE INDEX IF NOT EXISTS idx_messages_embedding ON messages
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ========================================
-- MEMORY TABLE
-- ========================================
-- Persistent memory entries (BeRight-compatible)
-- Like MEMORY.md but structured
CREATE TABLE IF NOT EXISTS memory_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,

  -- Memory type
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'fact',           -- Persistent fact about user
    'preference',     -- User preference
    'decision',       -- Important decision made
    'insight',        -- Market insight
    'strategy',       -- Trading strategy
    'daily_note'      -- Daily observation (like memory/YYYY-MM-DD.md)
  )),

  -- Content
  content TEXT NOT NULL,

  -- Context
  agent_source TEXT,  -- Which agent created this
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  -- Date scope (for daily notes)
  entry_date DATE,  -- For daily_note type

  -- Importance and retrieval
  importance SMALLINT DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
  last_accessed_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,  -- Optional TTL

  -- Embedding for semantic search
  embedding VECTOR(1536),

  -- Full-text search
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', content)
  ) STORED
);

-- Indexes for memory
CREATE INDEX IF NOT EXISTS idx_memory_wallet ON memory_entries(wallet_address);
CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_entries(wallet_address, entry_type);
CREATE INDEX IF NOT EXISTS idx_memory_date ON memory_entries(entry_date DESC) WHERE entry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_memory_importance ON memory_entries(importance DESC);
CREATE INDEX IF NOT EXISTS idx_memory_search ON memory_entries USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_memory_embedding ON memory_entries
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ========================================
-- PREDICTION LINKS TABLE
-- ========================================
-- Links conversations to on-chain predictions (calibration)
CREATE TABLE IF NOT EXISTS prediction_conversation_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  prediction_id UUID REFERENCES predictions(id) ON DELETE CASCADE,

  -- On-chain reference
  market_id TEXT NOT NULL,
  predicted_probability DECIMAL(5,4) NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('YES', 'NO')),
  tx_signature TEXT,
  on_chain_pda TEXT,  -- Calibration program PDA

  -- Resolution (updated when market resolves)
  resolved BOOLEAN,
  resolution_tx TEXT,
  brier_contribution DECIMAL(6,4),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,

  UNIQUE(conversation_id, prediction_id)
);

-- Indexes for prediction links
CREATE INDEX IF NOT EXISTS idx_prediction_links_conversation ON prediction_conversation_links(conversation_id);
CREATE INDEX IF NOT EXISTS idx_prediction_links_prediction ON prediction_conversation_links(prediction_id);
CREATE INDEX IF NOT EXISTS idx_prediction_links_market ON prediction_conversation_links(market_id);
CREATE INDEX IF NOT EXISTS idx_prediction_links_pending ON prediction_conversation_links(conversation_id) WHERE resolved IS NULL;

-- ========================================
-- ASYNC JOBS TABLE
-- ========================================
-- Track async jobs that survive navigation
CREATE TABLE IF NOT EXISTS async_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,

  -- Job info
  job_type TEXT NOT NULL,  -- 'research', 'analysis', 'trade', etc.
  gateway_job_id TEXT,  -- External job ID from gateway

  -- State
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  progress_message TEXT,

  -- Result
  result JSONB,
  error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- TTL (cleanup old jobs)
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes for async jobs
CREATE INDEX IF NOT EXISTS idx_async_jobs_wallet ON async_jobs(wallet_address);
CREATE INDEX IF NOT EXISTS idx_async_jobs_pending ON async_jobs(wallet_address) WHERE status IN ('pending', 'running');
CREATE INDEX IF NOT EXISTS idx_async_jobs_expires ON async_jobs(expires_at);

-- ========================================
-- FUNCTIONS
-- ========================================

-- Update conversation timestamp when new message added
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET
    updated_at = NOW(),
    last_message_at = NOW(),
    agents_used = CASE
      WHEN NEW.agent_type IS NOT NULL AND NOT (NEW.agent_type = ANY(agents_used))
      THEN array_append(agents_used, NEW.agent_type)
      ELSE agents_used
    END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_message_update_conversation ON messages;
CREATE TRIGGER trigger_message_update_conversation
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();

-- Auto-generate conversation title from first user message
CREATE OR REPLACE FUNCTION generate_conversation_title()
RETURNS TRIGGER AS $$
BEGIN
  -- Only for first user message in a conversation without title
  IF NEW.role = 'user' THEN
    UPDATE conversations
    SET title = CASE
      WHEN title IS NULL OR title = ''
      THEN LEFT(NEW.content, 100)
      ELSE title
    END
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_title ON messages;
CREATE TRIGGER trigger_auto_title
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION generate_conversation_title();

-- Semantic search function
CREATE OR REPLACE FUNCTION search_messages_semantic(
  p_wallet TEXT,
  p_query_embedding VECTOR(1536),
  p_limit INTEGER DEFAULT 10,
  p_min_similarity FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  message_id UUID,
  conversation_id UUID,
  content TEXT,
  role TEXT,
  agent_type TEXT,
  created_at TIMESTAMPTZ,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.conversation_id,
    m.content,
    m.role,
    m.agent_type,
    m.created_at,
    1 - (m.embedding <=> p_query_embedding) AS similarity
  FROM messages m
  JOIN conversations c ON c.id = m.conversation_id
  WHERE c.wallet_address = p_wallet
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> p_query_embedding) >= p_min_similarity
  ORDER BY m.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Hybrid search (semantic + keyword)
CREATE OR REPLACE FUNCTION search_messages_hybrid(
  p_wallet TEXT,
  p_query TEXT,
  p_query_embedding VECTOR(1536) DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  message_id UUID,
  conversation_id UUID,
  content TEXT,
  role TEXT,
  agent_type TEXT,
  created_at TIMESTAMPTZ,
  score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.conversation_id,
    m.content,
    m.role,
    m.agent_type,
    m.created_at,
    CASE
      WHEN p_query_embedding IS NOT NULL AND m.embedding IS NOT NULL
      THEN (
        -- Combine FTS rank and vector similarity
        ts_rank(m.search_vector, plainto_tsquery('english', p_query)) * 0.3 +
        (1 - (m.embedding <=> p_query_embedding)) * 0.7
      )
      ELSE ts_rank(m.search_vector, plainto_tsquery('english', p_query))
    END AS score
  FROM messages m
  JOIN conversations c ON c.id = m.conversation_id
  WHERE c.wallet_address = p_wallet
    AND (
      m.search_vector @@ plainto_tsquery('english', p_query)
      OR (p_query_embedding IS NOT NULL AND m.embedding IS NOT NULL AND
          1 - (m.embedding <=> p_query_embedding) >= 0.5)
    )
  ORDER BY score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Cleanup expired jobs
CREATE OR REPLACE FUNCTION cleanup_expired_jobs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM async_jobs WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- RLS POLICIES
-- ========================================

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_conversation_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE async_jobs ENABLE ROW LEVEL SECURITY;

-- Conversations: users see only their own
CREATE POLICY "Users view own conversations" ON conversations
  FOR SELECT USING (true);  -- Server-side, will filter by wallet in API

CREATE POLICY "Users create own conversations" ON conversations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users update own conversations" ON conversations
  FOR UPDATE USING (true);

CREATE POLICY "Users delete own conversations" ON conversations
  FOR DELETE USING (true);

-- Messages: same pattern
CREATE POLICY "Users view messages" ON messages
  FOR SELECT USING (true);

CREATE POLICY "Users create messages" ON messages
  FOR INSERT WITH CHECK (true);

-- Memory: wallet-scoped
CREATE POLICY "Users view own memory" ON memory_entries
  FOR SELECT USING (true);

CREATE POLICY "Users manage own memory" ON memory_entries
  FOR ALL USING (true);

-- Prediction links
CREATE POLICY "Users view prediction links" ON prediction_conversation_links
  FOR SELECT USING (true);

CREATE POLICY "Users create prediction links" ON prediction_conversation_links
  FOR INSERT WITH CHECK (true);

-- Async jobs
CREATE POLICY "Users view own jobs" ON async_jobs
  FOR SELECT USING (true);

CREATE POLICY "Users manage own jobs" ON async_jobs
  FOR ALL USING (true);

-- ========================================
-- COMMENTS
-- ========================================

COMMENT ON TABLE conversations IS 'Chat conversations scoped to wallet address';
COMMENT ON TABLE messages IS 'Individual messages with semantic search support';
COMMENT ON TABLE memory_entries IS 'BeRight-compatible persistent memory';
COMMENT ON TABLE prediction_conversation_links IS 'Links research conversations to on-chain predictions';
COMMENT ON TABLE async_jobs IS 'Track async jobs for navigation resilience';
COMMENT ON FUNCTION search_messages_semantic IS 'Vector similarity search on message embeddings';
COMMENT ON FUNCTION search_messages_hybrid IS 'Combined FTS + vector search';
