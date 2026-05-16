-- =============================================================================
-- BeRight Protocol: Signal Embeddings + RAG
-- =============================================================================
-- Phase 3: Vector embeddings for semantic search and context-aware evaluation
--
-- Tables:
--   - market_embeddings: Vector representations of market descriptions
--   - signal_embeddings: Vector representations of signal contexts
--   - knowledge_chunks: Parsed knowledge base for RAG retrieval
--   - rag_queries: Query log for debugging and improvement
--
-- Dependencies:
--   - Requires pgvector extension (enable in Supabase dashboard)
--   - Uses 1536-dim vectors (OpenAI ada-002 / compatible models)
-- =============================================================================

-- Enable pgvector extension (run once in Supabase SQL editor if not already enabled)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Market embeddings table
-- Stores vector representations of market titles + descriptions
CREATE TABLE IF NOT EXISTS market_embeddings (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  market_id     TEXT NOT NULL,
  platform      TEXT NOT NULL DEFAULT 'polymarket',
  market_title  TEXT NOT NULL,
  description   TEXT,
  category      TEXT,

  -- Vector embedding (1536 dimensions for OpenAI ada-002)
  embedding     vector(1536) NOT NULL,

  -- Model metadata
  model_id      TEXT NOT NULL DEFAULT 'text-embedding-ada-002',
  tokens_used   INT DEFAULT 0,

  -- Timestamps
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(market_id, platform)
);

-- Signal embeddings table
-- Stores vector representations of signal contexts for similar signal lookup
CREATE TABLE IF NOT EXISTS signal_embeddings (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  signal_id     UUID REFERENCES signals(id) ON DELETE CASCADE,
  signal_type   TEXT NOT NULL,

  -- Full context that was embedded
  context_text  TEXT NOT NULL,

  -- Vector embedding
  embedding     vector(1536) NOT NULL,

  -- Model metadata
  model_id      TEXT NOT NULL DEFAULT 'text-embedding-ada-002',

  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge chunks for RAG
-- Stores parsed knowledge base chunks (platform docs, market mechanics, etc.)
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source        TEXT NOT NULL,  -- 'polymarket_docs', 'kalshi_docs', 'market_mechanics', etc.
  chunk_index   INT NOT NULL,

  -- Content
  content       TEXT NOT NULL,
  metadata      JSONB DEFAULT '{}',  -- { section, subsection, url, etc. }

  -- Vector embedding
  embedding     vector(1536) NOT NULL,

  -- Model metadata
  model_id      TEXT NOT NULL DEFAULT 'text-embedding-ada-002',
  tokens        INT DEFAULT 0,

  created_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source, chunk_index)
);

-- RAG query log for debugging and improvement
CREATE TABLE IF NOT EXISTS rag_queries (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Query details
  query_text    TEXT NOT NULL,
  query_embedding vector(1536),

  -- Retrieved chunks
  retrieved_ids UUID[] DEFAULT '{}',
  retrieved_scores FLOAT[] DEFAULT '{}',

  -- Context used
  context_text  TEXT,
  context_tokens INT DEFAULT 0,

  -- Response
  response_text TEXT,
  response_tokens INT DEFAULT 0,

  -- Metadata
  model_id      TEXT,
  latency_ms    INT DEFAULT 0,
  signal_id     UUID,

  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Vector similarity search indexes (IVFFlat for speed)
-- Note: Requires pgvector extension and significant data before creating
-- Run these manually once you have >1000 embeddings for optimal performance
-- CREATE INDEX IF NOT EXISTS idx_market_embeddings_vector
--   ON market_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- CREATE INDEX IF NOT EXISTS idx_signal_embeddings_vector
--   ON signal_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_vector
--   ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Standard indexes
CREATE INDEX IF NOT EXISTS idx_market_embeddings_platform ON market_embeddings(platform);
CREATE INDEX IF NOT EXISTS idx_market_embeddings_category ON market_embeddings(category);
CREATE INDEX IF NOT EXISTS idx_signal_embeddings_type ON signal_embeddings(signal_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source ON knowledge_chunks(source);
CREATE INDEX IF NOT EXISTS idx_rag_queries_created ON rag_queries(created_at);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to find similar markets by embedding
CREATE OR REPLACE FUNCTION find_similar_markets(
  query_embedding vector(1536),
  match_count INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  market_id TEXT,
  platform TEXT,
  market_title TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    me.market_id,
    me.platform,
    me.market_title,
    1 - (me.embedding <=> query_embedding) AS similarity
  FROM market_embeddings me
  WHERE 1 - (me.embedding <=> query_embedding) >= match_threshold
  ORDER BY me.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to find similar signals by embedding
CREATE OR REPLACE FUNCTION find_similar_signals(
  query_embedding vector(1536),
  match_count INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  signal_id UUID,
  signal_type TEXT,
  context_text TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.signal_id,
    se.signal_type,
    se.context_text,
    1 - (se.embedding <=> query_embedding) AS similarity
  FROM signal_embeddings se
  WHERE 1 - (se.embedding <=> query_embedding) >= match_threshold
  ORDER BY se.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to retrieve knowledge chunks for RAG
CREATE OR REPLACE FUNCTION retrieve_knowledge(
  query_embedding vector(1536),
  match_count INT DEFAULT 3,
  source_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  chunk_id UUID,
  source TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id AS chunk_id,
    kc.source,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks kc
  WHERE source_filter IS NULL OR kc.source = source_filter
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =============================================================================
-- TRIGGER: Update timestamps
-- =============================================================================

CREATE OR REPLACE FUNCTION update_embedding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_market_embeddings_updated ON market_embeddings;
CREATE TRIGGER trg_market_embeddings_updated
  BEFORE UPDATE ON market_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_embedding_updated_at();
