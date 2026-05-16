-- ============================================================================
-- RLS Policies for Chat System Tables (Fixed)
-- BeRight Protocol - Security Hardening
-- ============================================================================
--
-- This migration:
-- 1. Creates prediction_conversation_links table if missing
-- 2. Enables RLS on all chat tables
-- 3. Creates policies for secure access
-- ============================================================================

-- =====================
-- CREATE MISSING TABLE: prediction_conversation_links
-- =====================

CREATE TABLE IF NOT EXISTS prediction_conversation_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  prediction_id TEXT NOT NULL,
  market_id TEXT NOT NULL,
  predicted_probability NUMERIC(5, 4) NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('YES', 'NO')),
  tx_signature TEXT,
  on_chain_pda TEXT,
  resolved BOOLEAN DEFAULT false,
  resolution_tx TEXT,
  brier_contribution NUMERIC(10, 6),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Indexes for prediction_conversation_links
CREATE INDEX IF NOT EXISTS idx_pred_links_conversation
  ON prediction_conversation_links(conversation_id);
CREATE INDEX IF NOT EXISTS idx_pred_links_prediction
  ON prediction_conversation_links(prediction_id);
CREATE INDEX IF NOT EXISTS idx_pred_links_market
  ON prediction_conversation_links(market_id);

-- =====================
-- CONVERSATIONS RLS
-- =====================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_conversations_all" ON conversations;
DROP POLICY IF EXISTS "users_own_conversations" ON conversations;

CREATE POLICY "service_conversations_all" ON conversations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

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
-- MESSAGES RLS
-- =====================

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_messages_all" ON messages;
DROP POLICY IF EXISTS "users_own_messages" ON messages;

CREATE POLICY "service_messages_all" ON messages
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

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
-- MEMORY_ENTRIES RLS
-- =====================

ALTER TABLE memory_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_memory_all" ON memory_entries;
DROP POLICY IF EXISTS "users_own_memory" ON memory_entries;

CREATE POLICY "service_memory_all" ON memory_entries
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

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
-- PREDICTION_CONVERSATION_LINKS RLS
-- =====================

ALTER TABLE prediction_conversation_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_pred_links_all" ON prediction_conversation_links;
DROP POLICY IF EXISTS "users_own_pred_links" ON prediction_conversation_links;

CREATE POLICY "service_pred_links_all" ON prediction_conversation_links
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

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
-- ASYNC_JOBS RLS
-- =====================

ALTER TABLE async_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_jobs_all" ON async_jobs;
DROP POLICY IF EXISTS "users_own_jobs" ON async_jobs;

CREATE POLICY "service_jobs_all" ON async_jobs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

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
