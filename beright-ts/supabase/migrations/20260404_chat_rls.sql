-- ============================================================================
-- RLS Policies for Chat System Tables
-- BeRight Protocol - Security Hardening Day 3
-- ============================================================================
-- 
-- Tables covered:
-- - conversations (wallet-scoped)
-- - messages (conversation-scoped)
-- - memory_entries (wallet-scoped)
-- - prediction_conversation_links (conversation-scoped)
-- - async_jobs (wallet-scoped)
--
-- Policy Strategy:
-- - service_role: Full access (backend operations)
-- - authenticated users: Access own data via wallet_address
-- - anon: No access to chat data
-- ============================================================================

-- =====================
-- CONVERSATIONS
-- =====================
-- Users can only see their own conversations (by wallet_address)

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_conversations_all" ON conversations;
DROP POLICY IF EXISTS "users_own_conversations" ON conversations;

-- Service role has full access
CREATE POLICY "service_conversations_all" ON conversations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users can only access their own conversations
-- Note: For web app, we use service_role from backend
-- This policy is for future direct client access
CREATE POLICY "users_own_conversations" ON conversations
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND wallet_address = auth.jwt() ->> 'wallet_address')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND wallet_address = auth.jwt() ->> 'wallet_address')
  );

-- =====================
-- MESSAGES
-- =====================
-- Messages are scoped to conversations (which are wallet-scoped)

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_messages_all" ON messages;
DROP POLICY IF EXISTS "users_own_messages" ON messages;

-- Service role has full access
CREATE POLICY "service_messages_all" ON messages
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users can access messages in their conversations
CREATE POLICY "users_own_messages" ON messages
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR (
      auth.role() = 'authenticated'
      AND EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = messages.conversation_id
        AND c.wallet_address = auth.jwt() ->> 'wallet_address'
      )
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (
      auth.role() = 'authenticated'
      AND EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = messages.conversation_id
        AND c.wallet_address = auth.jwt() ->> 'wallet_address'
      )
    )
  );

-- =====================
-- MEMORY_ENTRIES
-- =====================
-- Memory entries are wallet-scoped

ALTER TABLE memory_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_memory_all" ON memory_entries;
DROP POLICY IF EXISTS "users_own_memory" ON memory_entries;

-- Service role has full access
CREATE POLICY "service_memory_all" ON memory_entries
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users can access their own memory entries
CREATE POLICY "users_own_memory" ON memory_entries
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND wallet_address = auth.jwt() ->> 'wallet_address')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND wallet_address = auth.jwt() ->> 'wallet_address')
  );

-- =====================
-- PREDICTION_CONVERSATION_LINKS
-- =====================
-- Links are scoped to conversations

ALTER TABLE prediction_conversation_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_pred_links_all" ON prediction_conversation_links;
DROP POLICY IF EXISTS "users_own_pred_links" ON prediction_conversation_links;

-- Service role has full access
CREATE POLICY "service_pred_links_all" ON prediction_conversation_links
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users can access links in their conversations
CREATE POLICY "users_own_pred_links" ON prediction_conversation_links
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR (
      auth.role() = 'authenticated'
      AND EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = prediction_conversation_links.conversation_id
        AND c.wallet_address = auth.jwt() ->> 'wallet_address'
      )
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (
      auth.role() = 'authenticated'
      AND EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = prediction_conversation_links.conversation_id
        AND c.wallet_address = auth.jwt() ->> 'wallet_address'
      )
    )
  );

-- =====================
-- ASYNC_JOBS
-- =====================
-- Jobs are wallet-scoped

ALTER TABLE async_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_jobs_all" ON async_jobs;
DROP POLICY IF EXISTS "users_own_jobs" ON async_jobs;

-- Service role has full access
CREATE POLICY "service_jobs_all" ON async_jobs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users can access their own jobs
CREATE POLICY "users_own_jobs" ON async_jobs
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND wallet_address = auth.jwt() ->> 'wallet_address')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND wallet_address = auth.jwt() ->> 'wallet_address')
  );

-- =====================
-- VERIFICATION
-- =====================
-- Check RLS status for all chat tables

SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'conversations',
    'messages',
    'memory_entries',
    'prediction_conversation_links',
    'async_jobs'
  )
ORDER BY tablename;
