-- ============================================================================
-- Security Events Audit Table
-- BeRight Protocol - Security Hardening Day 3
-- ============================================================================
--
-- Tracks security-relevant events for audit and monitoring:
-- - Authentication attempts (success/failure)
-- - Rate limit violations
-- - Prompt injection attempts
-- - Secret scrubbing events
-- - Admin command usage
-- - Transaction signing events
-- - Kill switch activations
--
-- Retention: Events older than 90 days are automatically cleaned up
-- ============================================================================

-- =====================
-- SECURITY_EVENTS TABLE
-- =====================

CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event metadata
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  
  -- Actor information
  wallet_address TEXT,
  telegram_id TEXT,
  user_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  
  -- Event details
  action TEXT NOT NULL,
  resource TEXT,
  details JSONB DEFAULT '{}',
  
  -- Request context
  request_id TEXT,
  session_id TEXT,
  
  -- Outcome
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexing
  CONSTRAINT valid_event_type CHECK (event_type IN (
    'auth_attempt',
    'auth_success',
    'auth_failure',
    'rate_limit',
    'injection_attempt',
    'secret_scrubbed',
    'admin_command',
    'transaction_sign',
    'transaction_send',
    'kill_switch',
    'config_change',
    'api_access',
    'suspicious_activity'
  )),
  
  CONSTRAINT valid_severity CHECK (severity IN (
    'debug',
    'info',
    'warning',
    'error',
    'critical'
  ))
);

-- =====================
-- INDEXES
-- =====================

-- Time-based queries (most common)
CREATE INDEX IF NOT EXISTS idx_security_events_created_at 
  ON security_events(created_at DESC);

-- Filter by event type
CREATE INDEX IF NOT EXISTS idx_security_events_type 
  ON security_events(event_type);

-- Filter by severity
CREATE INDEX IF NOT EXISTS idx_security_events_severity 
  ON security_events(severity);

-- Filter by wallet
CREATE INDEX IF NOT EXISTS idx_security_events_wallet 
  ON security_events(wallet_address) 
  WHERE wallet_address IS NOT NULL;

-- Filter by telegram ID
CREATE INDEX IF NOT EXISTS idx_security_events_telegram 
  ON security_events(telegram_id) 
  WHERE telegram_id IS NOT NULL;

-- Combined filter for common queries
CREATE INDEX IF NOT EXISTS idx_security_events_type_created 
  ON security_events(event_type, created_at DESC);

-- =====================
-- RLS POLICIES
-- =====================

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Only service role can access security events
DROP POLICY IF EXISTS "service_security_events_all" ON security_events;
CREATE POLICY "service_security_events_all" ON security_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =====================
-- HELPER FUNCTIONS
-- =====================

-- Function to log security event
CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type TEXT,
  p_action TEXT,
  p_severity TEXT DEFAULT 'info',
  p_wallet_address TEXT DEFAULT NULL,
  p_telegram_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO security_events (
    event_type,
    action,
    severity,
    wallet_address,
    telegram_id,
    details
  ) VALUES (
    p_event_type,
    p_action,
    p_severity,
    p_wallet_address,
    p_telegram_id,
    p_details
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- Function to get recent security events (for monitoring)
CREATE OR REPLACE FUNCTION get_recent_security_events(
  p_hours INT DEFAULT 24,
  p_severity TEXT DEFAULT NULL,
  p_event_type TEXT DEFAULT NULL,
  p_limit INT DEFAULT 100
)
RETURNS SETOF security_events
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM security_events
  WHERE created_at > NOW() - (p_hours || ' hours')::INTERVAL
    AND (p_severity IS NULL OR severity = p_severity)
    AND (p_event_type IS NULL OR event_type = p_event_type)
  ORDER BY created_at DESC
  LIMIT p_limit;
END;
$$;

-- Function to get security stats
CREATE OR REPLACE FUNCTION get_security_stats(p_hours INT DEFAULT 24)
RETURNS TABLE (
  event_type TEXT,
  total_count BIGINT,
  success_count BIGINT,
  failure_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    se.event_type,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE se.success = true) as success_count,
    COUNT(*) FILTER (WHERE se.success = false) as failure_count
  FROM security_events se
  WHERE se.created_at > NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY se.event_type
  ORDER BY total_count DESC;
END;
$$;

-- =====================
-- CLEANUP FUNCTION
-- =====================

-- Function to cleanup old events (run daily via cron)
CREATE OR REPLACE FUNCTION cleanup_old_security_events(p_days INT DEFAULT 90)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM security_events
  WHERE created_at < NOW() - (p_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  -- Log the cleanup itself
  INSERT INTO security_events (
    event_type,
    action,
    severity,
    details
  ) VALUES (
    'config_change',
    'cleanup_security_events',
    'info',
    jsonb_build_object('deleted_count', v_deleted, 'retention_days', p_days)
  );
  
  RETURN v_deleted;
END;
$$;

-- =====================
-- TRANSACTION AUDITS TABLE
-- =====================

CREATE TABLE IF NOT EXISTS transaction_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Transaction info
  tx_type TEXT NOT NULL,
  signature TEXT,
  
  -- Wallets
  from_wallet TEXT NOT NULL,
  to_wallet TEXT,
  
  -- Amount
  amount_lamports BIGINT,
  amount_usd NUMERIC(20, 6),
  
  -- Program
  program_id TEXT,
  instruction_name TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  
  -- User context
  user_id TEXT,
  session_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  
  CONSTRAINT valid_tx_type CHECK (tx_type IN (
    'sign',
    'send',
    'confirm',
    'swap',
    'transfer',
    'stake',
    'unstake',
    'trade'
  )),
  
  CONSTRAINT valid_status CHECK (status IN (
    'pending',
    'signed',
    'sent',
    'confirmed',
    'failed',
    'timeout'
  ))
);

-- Indexes for transaction audits
CREATE INDEX IF NOT EXISTS idx_tx_audits_created 
  ON transaction_audits(created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_tx_audits_from_wallet 
  ON transaction_audits(from_wallet);
  
CREATE INDEX IF NOT EXISTS idx_tx_audits_signature 
  ON transaction_audits(signature) 
  WHERE signature IS NOT NULL;

-- RLS for transaction audits
ALTER TABLE transaction_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_tx_audits_all" ON transaction_audits;
CREATE POLICY "service_tx_audits_all" ON transaction_audits
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =====================
-- VERIFICATION
-- =====================

SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('security_events', 'transaction_audits')
ORDER BY tablename;
