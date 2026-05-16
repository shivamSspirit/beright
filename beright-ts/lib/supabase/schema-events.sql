-- BeRight Events Table for Realtime Sync
-- This table enables realtime sync between Telegram and Web UI

-- Create events table
CREATE TABLE IF NOT EXISTS beright_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event metadata
  event_type TEXT NOT NULL, -- 'telegram_message', 'agent_response', 'arb_alert', 'whale_alert', 'prediction', 'heartbeat'

  -- Session/User context
  session_id TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  telegram_id BIGINT,
  telegram_username TEXT,

  -- Agent info
  agent TEXT, -- 'scout', 'analyst', 'trader', 'commander'

  -- Content
  command TEXT,           -- User's input command
  response TEXT,          -- Agent's response
  mood TEXT,              -- Response mood: BULLISH, BEARISH, NEUTRAL, ALERT, EDUCATIONAL, ERROR

  -- Structured data (JSON for flexibility)
  data JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes for querying
  CONSTRAINT valid_event_type CHECK (event_type IN (
    'telegram_message',
    'agent_response',
    'arb_alert',
    'whale_alert',
    'prediction',
    'heartbeat',
    'error'
  ))
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_events_type ON beright_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON beright_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_session ON beright_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_telegram ON beright_events(telegram_id);
CREATE INDEX IF NOT EXISTS idx_events_agent ON beright_events(agent);

-- Enable Row Level Security (RLS)
ALTER TABLE beright_events ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read events (for realtime subscription)
CREATE POLICY "Events are publicly readable" ON beright_events
  FOR SELECT USING (true);

-- Policy: Only authenticated service can insert
CREATE POLICY "Service can insert events" ON beright_events
  FOR INSERT WITH CHECK (true);

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE beright_events;

-- Auto-cleanup old events (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_events()
RETURNS void AS $$
BEGIN
  DELETE FROM beright_events WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Optional: Schedule cleanup (run daily via pg_cron if available)
-- SELECT cron.schedule('cleanup-events', '0 3 * * *', 'SELECT cleanup_old_events()');

COMMENT ON TABLE beright_events IS 'Realtime event stream for BeRight - syncs Telegram and Web UI';
