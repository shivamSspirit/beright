-- Enable Supabase Realtime for BeRight Conversations
-- Run this in Supabase Dashboard > SQL Editor

-- ===========================================
-- ENABLE REALTIME ON TABLES
-- ===========================================

-- Enable realtime for messages table
-- This allows clients to subscribe to new/updated messages
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Enable realtime for conversations table
-- This allows sidebar to update when conversations change
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- ===========================================
-- VERIFY REALTIME IS ENABLED
-- ===========================================

-- Check which tables have realtime enabled
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- ===========================================
-- ROW LEVEL SECURITY (RLS) FOR REALTIME
-- ===========================================

-- Ensure RLS policies allow SELECT for authenticated users
-- (These should already exist from the initial schema)

-- Policy: Users can only see their own conversations
-- CREATE POLICY IF NOT EXISTS "Users can view own conversations"
--   ON conversations FOR SELECT
--   USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Policy: Users can view messages in their conversations
-- CREATE POLICY IF NOT EXISTS "Users can view messages in own conversations"
--   ON messages FOR SELECT
--   USING (
--     conversation_id IN (
--       SELECT id FROM conversations
--       WHERE wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
--     )
--   );

-- ===========================================
-- PERFORMANCE INDEXES FOR REALTIME FILTERS
-- ===========================================

-- Index for filtering messages by conversation_id (used in realtime filter)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON messages(conversation_id);

-- Index for filtering conversations by wallet_address (used in realtime filter)
CREATE INDEX IF NOT EXISTS idx_conversations_wallet_address
  ON conversations(wallet_address);

-- Composite index for efficient message ordering
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages(conversation_id, created_at ASC);

-- ===========================================
-- DONE!
-- ===========================================

-- After running this:
-- 1. Go to Supabase Dashboard > Database > Replication
-- 2. Verify 'messages' and 'conversations' appear in the list
-- 3. Test by opening two browser tabs and sending a message
