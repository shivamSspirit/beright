-- Enable Semantic Memory Search for BeRight
-- Run this in Supabase Dashboard > SQL Editor

-- ===========================================
-- ENABLE PGVECTOR EXTENSION
-- ===========================================

-- Enable the vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ===========================================
-- ADD EMBEDDING COLUMN TO MEMORY_ENTRIES
-- ===========================================

-- Add embedding column (1024 dimensions for Mistral mistral-embed)
ALTER TABLE memory_entries
  ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- ===========================================
-- CREATE SEMANTIC SEARCH FUNCTION
-- ===========================================

-- Function for semantic similarity search
CREATE OR REPLACE FUNCTION match_memories(
  query_embedding vector(1024),
  match_wallet text,
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10,
  filter_types text[] DEFAULT NULL,
  include_expired boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  wallet_address text,
  entry_type text,
  content text,
  agent_source text,
  conversation_id uuid,
  entry_date date,
  importance int,
  last_accessed_at timestamptz,
  access_count int,
  created_at timestamptz,
  expires_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.wallet_address,
    m.entry_type,
    m.content,
    m.agent_source,
    m.conversation_id,
    m.entry_date,
    m.importance,
    m.last_accessed_at,
    m.access_count,
    m.created_at,
    m.expires_at,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM memory_entries m
  WHERE m.wallet_address = match_wallet
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
    AND (filter_types IS NULL OR m.entry_type = ANY(filter_types))
    AND (include_expired OR m.expires_at IS NULL OR m.expires_at > NOW())
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ===========================================
-- CREATE FULL-TEXT SEARCH INDEX
-- ===========================================

-- Add search vector column for full-text search
ALTER TABLE memory_entries
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- Index for full-text search
CREATE INDEX IF NOT EXISTS idx_memory_search_vector
  ON memory_entries USING gin(search_vector);

-- ===========================================
-- CREATE INDEXES FOR PERFORMANCE
-- ===========================================

-- Index for embedding similarity search (using IVFFlat for speed)
-- Note: IVFFlat requires at least 100 rows to be effective
-- For small datasets, use regular btree index instead
DO $$
BEGIN
  -- Check if we have enough rows for IVFFlat
  IF (SELECT COUNT(*) FROM memory_entries WHERE embedding IS NOT NULL) >= 100 THEN
    CREATE INDEX IF NOT EXISTS idx_memory_embedding
      ON memory_entries USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 10);
  ELSE
    -- For small datasets, just use a basic index
    RAISE NOTICE 'Not enough rows for IVFFlat, skipping embedding index';
  END IF;
END $$;

-- Index for wallet + type queries
CREATE INDEX IF NOT EXISTS idx_memory_wallet_type
  ON memory_entries(wallet_address, entry_type, importance DESC);

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_memory_expires
  ON memory_entries(expires_at)
  WHERE expires_at IS NOT NULL;

-- ===========================================
-- INCREMENT ACCESS FUNCTION
-- ===========================================

-- Function to track memory access
CREATE OR REPLACE FUNCTION increment_memory_access(memory_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE memory_entries
  SET
    access_count = access_count + 1,
    last_accessed_at = NOW()
  WHERE id = memory_id;
END;
$$;

-- ===========================================
-- VERIFY SETUP
-- ===========================================

-- Check that everything is set up correctly
SELECT
  'embedding column' as check_item,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'memory_entries' AND column_name = 'embedding'
  ) THEN 'OK' ELSE 'MISSING' END as status

UNION ALL

SELECT
  'search_vector column',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'memory_entries' AND column_name = 'search_vector'
  ) THEN 'OK' ELSE 'MISSING' END

UNION ALL

SELECT
  'match_memories function',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'match_memories'
  ) THEN 'OK' ELSE 'MISSING' END

UNION ALL

SELECT
  'vector extension',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) THEN 'OK' ELSE 'MISSING' END;

-- ===========================================
-- DONE!
-- ===========================================

-- After running this:
-- 1. Memory entries will support semantic search via embeddings
-- 2. Full-text search is available as fallback
-- 3. The match_memories function handles similarity queries
-- 4. Access tracking helps prioritize frequently used memories
