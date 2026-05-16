-- Migration: Add pgvector support for semantic search
-- Run this in your Supabase SQL editor

-- Step 1: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Add embedding columns to tables
-- Memory entries embedding (1536 dimensions for OpenAI text-embedding-3-small)
ALTER TABLE memory_entries
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Messages embedding
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Step 3: Create indexes for fast similarity search
CREATE INDEX IF NOT EXISTS memory_entries_embedding_idx
ON memory_entries
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS messages_embedding_idx
ON messages
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Step 4: Function to update memory entry embedding
CREATE OR REPLACE FUNCTION update_memory_embedding(
  p_entry_id UUID,
  p_embedding vector(1536)
)
RETURNS void AS $$
BEGIN
  UPDATE memory_entries
  SET embedding = p_embedding
  WHERE id = p_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Function to update message embedding
CREATE OR REPLACE FUNCTION update_message_embedding(
  p_message_id UUID,
  p_embedding vector(1536)
)
RETURNS void AS $$
BEGIN
  UPDATE messages
  SET embedding = p_embedding
  WHERE id = p_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Semantic search function for memory entries
CREATE OR REPLACE FUNCTION semantic_search_memory(
  p_wallet_address TEXT,
  p_query_embedding vector(1536),
  p_match_threshold FLOAT DEFAULT 0.5,
  p_match_count INT DEFAULT 10,
  p_entry_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  entry_type TEXT,
  agent_source TEXT,
  created_at TIMESTAMPTZ,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.entry_type,
    m.agent_source::TEXT,
    m.created_at,
    1 - (m.embedding <=> p_query_embedding) AS similarity
  FROM memory_entries m
  WHERE
    m.wallet_address = p_wallet_address
    AND m.embedding IS NOT NULL
    AND (p_entry_type IS NULL OR m.entry_type = p_entry_type)
    AND 1 - (m.embedding <=> p_query_embedding) > p_match_threshold
  ORDER BY m.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Semantic search function for conversations (via messages)
CREATE OR REPLACE FUNCTION semantic_search_conversations(
  p_wallet_address TEXT,
  p_query_embedding vector(1536),
  p_match_threshold FLOAT DEFAULT 0.4,
  p_match_count INT DEFAULT 10
)
RETURNS TABLE (
  conversation_id UUID,
  title TEXT,
  matched_content TEXT,
  similarity FLOAT,
  message_count INT
) AS $$
BEGIN
  RETURN QUERY
  WITH matched_messages AS (
    SELECT
      msg.conversation_id,
      msg.content,
      1 - (msg.embedding <=> p_query_embedding) AS similarity,
      ROW_NUMBER() OVER (PARTITION BY msg.conversation_id ORDER BY msg.embedding <=> p_query_embedding) AS rn
    FROM messages msg
    INNER JOIN conversations conv ON msg.conversation_id = conv.id
    WHERE
      conv.wallet_address = p_wallet_address
      AND msg.embedding IS NOT NULL
      AND 1 - (msg.embedding <=> p_query_embedding) > p_match_threshold
  ),
  conversation_matches AS (
    SELECT
      mm.conversation_id,
      MAX(mm.similarity) AS max_similarity,
      COUNT(*)::INT AS match_count
    FROM matched_messages mm
    GROUP BY mm.conversation_id
  )
  SELECT
    cm.conversation_id,
    conv.title,
    LEFT(best_msg.content, 200) AS matched_content,
    cm.max_similarity AS similarity,
    cm.match_count AS message_count
  FROM conversation_matches cm
  INNER JOIN conversations conv ON cm.conversation_id = conv.id
  INNER JOIN matched_messages best_msg ON best_msg.conversation_id = cm.conversation_id AND best_msg.rn = 1
  ORDER BY cm.max_similarity DESC
  LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Create trigger to auto-embed on insert (optional - for production)
-- Uncomment if you want automatic embedding generation via edge function
/*
CREATE OR REPLACE FUNCTION notify_embedding_needed()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'embedding_needed',
    json_build_object(
      'table', TG_TABLE_NAME,
      'id', NEW.id,
      'content', NEW.content
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memory_embedding_trigger
AFTER INSERT ON memory_entries
FOR EACH ROW
WHEN (NEW.embedding IS NULL)
EXECUTE FUNCTION notify_embedding_needed();

CREATE TRIGGER message_embedding_trigger
AFTER INSERT ON messages
FOR EACH ROW
WHEN (NEW.embedding IS NULL)
EXECUTE FUNCTION notify_embedding_needed();
*/

-- Verification query (run after migration)
-- SELECT * FROM semantic_search_memory('your_wallet_address', '[your_embedding_vector]');
