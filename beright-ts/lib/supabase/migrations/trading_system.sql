-- ============================================
-- BeRight Trading System Database Schema
-- ============================================
-- Run this migration to add trading tables
-- Execute via Supabase SQL Editor or CLI

-- ============================================
-- TRADES TABLE
-- Stores all paper and live trades
-- ============================================
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('paper', 'live')),

  -- Market information
  platform TEXT NOT NULL,
  market_id TEXT NOT NULL,
  market_ticker TEXT NOT NULL,
  market_title TEXT NOT NULL,
  category TEXT DEFAULT 'general',

  -- Trade details
  direction TEXT NOT NULL CHECK (direction IN ('YES', 'NO')),
  order_type TEXT DEFAULT 'market' CHECK (order_type IN ('market', 'limit', 'stop_loss', 'take_profit')),
  entry_price DECIMAL(10, 6) NOT NULL,
  exit_price DECIMAL(10, 6),
  quantity DECIMAL(18, 8) NOT NULL,
  quantity_filled DECIMAL(18, 8) DEFAULT 0,

  -- USD values
  entry_value_usd DECIMAL(18, 2) NOT NULL,
  exit_value_usd DECIMAL(18, 2),

  -- P&L tracking
  unrealized_pnl DECIMAL(18, 6) DEFAULT 0,
  realized_pnl DECIMAL(18, 6),
  pnl_percent DECIMAL(10, 6),
  fees DECIMAL(18, 6) DEFAULT 0,

  -- Strategy info
  strategy TEXT DEFAULT 'manual',
  signal_id TEXT,
  signal_confidence DECIMAL(5, 2),

  -- Risk management
  stop_loss_price DECIMAL(10, 6),
  take_profit_price DECIMAL(10, 6),
  max_loss_usd DECIMAL(18, 2),

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'open', 'filled', 'partial', 'cancelled', 'rejected', 'closed')),
  close_reason TEXT CHECK (close_reason IN ('take_profit', 'stop_loss', 'manual', 'expiry', 'liquidation') OR close_reason IS NULL),

  -- Execution details
  execution_latency_ms INTEGER,
  slippage DECIMAL(10, 6),
  order_id TEXT,
  tx_signature TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  filled_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- Indexes for trades
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_mode ON trades(user_id, mode);
CREATE INDEX IF NOT EXISTS idx_trades_user_status ON trades(user_id, status);
CREATE INDEX IF NOT EXISTS idx_trades_market_ticker ON trades(market_ticker);
CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(strategy);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at DESC);

-- ============================================
-- TRADING SETTINGS TABLE
-- User-specific trading configuration
-- ============================================
CREATE TABLE IF NOT EXISTS trading_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Mode settings
  mode TEXT DEFAULT 'paper' CHECK (mode IN ('paper', 'live')),
  auto_execute BOOLEAN DEFAULT FALSE,

  -- Strategy configuration
  enabled_strategies TEXT[] DEFAULT ARRAY['arbitrage', 'information_speed', 'mean_reversion', 'resolution_timing', 'consensus_flip'],
  strategy_configs JSONB DEFAULT '{}',

  -- Risk configuration
  risk_config JSONB DEFAULT '{
    "maxPositionSizeUsd": 100,
    "maxPositionSizePct": 0.05,
    "maxTotalExposureUsd": 1000,
    "maxTotalExposurePct": 0.80,
    "maxCategoryExposurePct": 0.30,
    "maxDailyLossUsd": 50,
    "maxDailyLossPct": 0.03,
    "maxDrawdownPct": 0.20,
    "defaultStopLossPct": 0.20,
    "defaultTakeProfitPct": 0.30,
    "circuitBreakerEnabled": true,
    "circuitBreakerLossPct": 0.05
  }',

  -- Portfolio settings
  initial_balance DECIMAL(18, 2) DEFAULT 1000.00,

  -- Notification settings
  notify_on_trade BOOLEAN DEFAULT TRUE,
  notify_on_alert BOOLEAN DEFAULT TRUE,
  telegram_chat_id BIGINT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STRATEGY PERFORMANCE TABLE
-- Tracks performance metrics by strategy
-- ============================================
CREATE TABLE IF NOT EXISTS strategy_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Strategy identification
  strategy TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('paper', 'live')),
  period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'all_time')),

  -- Trade statistics
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  win_rate DECIMAL(5, 4) DEFAULT 0,

  -- P&L metrics
  total_pnl DECIMAL(18, 6) DEFAULT 0,
  avg_pnl DECIMAL(18, 6) DEFAULT 0,
  avg_win DECIMAL(18, 6) DEFAULT 0,
  avg_loss DECIMAL(18, 6) DEFAULT 0,
  profit_factor DECIMAL(10, 4) DEFAULT 0,

  -- Risk-adjusted metrics
  sharpe_ratio DECIMAL(10, 4),
  sortino_ratio DECIMAL(10, 4),
  max_drawdown DECIMAL(18, 6) DEFAULT 0,
  calmar_ratio DECIMAL(10, 4),

  -- Execution metrics
  avg_slippage DECIMAL(10, 6) DEFAULT 0,
  avg_latency_ms INTEGER DEFAULT 0,

  -- Period boundaries
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for strategy_performance
CREATE INDEX IF NOT EXISTS idx_strategy_perf_user ON strategy_performance(user_id);
CREATE INDEX IF NOT EXISTS idx_strategy_perf_strategy ON strategy_performance(strategy);
CREATE INDEX IF NOT EXISTS idx_strategy_perf_period ON strategy_performance(period);
CREATE UNIQUE INDEX IF NOT EXISTS idx_strategy_perf_unique ON strategy_performance(user_id, strategy, mode, period, start_date, end_date);

-- ============================================
-- PORTFOLIO SNAPSHOTS TABLE
-- Historical portfolio state for analytics
-- ============================================
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('paper', 'live')),

  -- Balance state
  cash_balance DECIMAL(18, 2) NOT NULL,
  portfolio_value DECIMAL(18, 2) NOT NULL,
  total_value DECIMAL(18, 2) NOT NULL,

  -- P&L
  total_pnl DECIMAL(18, 6) NOT NULL,
  total_pnl_percent DECIMAL(10, 6) NOT NULL,
  realized_pnl DECIMAL(18, 6) NOT NULL,
  unrealized_pnl DECIMAL(18, 6) NOT NULL,

  -- Trade stats
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  win_rate DECIMAL(5, 4) DEFAULT 0,

  -- Risk metrics
  sharpe_ratio DECIMAL(10, 4),
  max_drawdown DECIMAL(18, 6) DEFAULT 0,
  max_drawdown_percent DECIMAL(10, 6) DEFAULT 0,

  -- Position count
  position_count INTEGER DEFAULT 0,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for portfolio_snapshots
CREATE INDEX IF NOT EXISTS idx_portfolio_snap_user ON portfolio_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_snap_user_mode ON portfolio_snapshots(user_id, mode);
CREATE INDEX IF NOT EXISTS idx_portfolio_snap_created ON portfolio_snapshots(created_at DESC);

-- ============================================
-- TRADING SIGNALS TABLE
-- Stores generated signals for analysis
-- ============================================
CREATE TABLE IF NOT EXISTS trading_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Signal details
  strategy_type TEXT NOT NULL,
  platform TEXT NOT NULL,
  market_id TEXT NOT NULL,
  market_ticker TEXT NOT NULL,
  market_title TEXT NOT NULL,
  category TEXT DEFAULT 'general',

  -- Signal data
  direction TEXT NOT NULL CHECK (direction IN ('YES', 'NO')),
  confidence DECIMAL(5, 2) NOT NULL,
  edge DECIMAL(10, 6) NOT NULL,
  current_price DECIMAL(10, 6) NOT NULL,
  target_price DECIMAL(10, 6) NOT NULL,

  -- Recommendation
  recommended_action TEXT NOT NULL CHECK (recommended_action IN ('buy', 'sell', 'hold', 'skip')),
  recommended_size DECIMAL(10, 6) NOT NULL,
  urgency TEXT DEFAULT 'optional' CHECK (urgency IN ('immediate', 'soon', 'optional')),

  -- Analysis
  reasoning TEXT,
  factors JSONB DEFAULT '[]',

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'expired', 'skipped')),
  executed_trade_id UUID REFERENCES trades(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ
);

-- Indexes for trading_signals
CREATE INDEX IF NOT EXISTS idx_signals_user ON trading_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_signals_status ON trading_signals(status);
CREATE INDEX IF NOT EXISTS idx_signals_strategy ON trading_signals(strategy_type);
CREATE INDEX IF NOT EXISTS idx_signals_created ON trading_signals(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_signals ENABLE ROW LEVEL SECURITY;

-- Trades policies
CREATE POLICY "Users can view own trades"
  ON trades FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trades"
  ON trades FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trades"
  ON trades FOR UPDATE
  USING (auth.uid() = user_id);

-- Trading settings policies
CREATE POLICY "Users can view own settings"
  ON trading_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own settings"
  ON trading_settings FOR ALL
  USING (auth.uid() = user_id);

-- Strategy performance policies
CREATE POLICY "Users can view own performance"
  ON strategy_performance FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own performance"
  ON strategy_performance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Portfolio snapshots policies
CREATE POLICY "Users can view own snapshots"
  ON portfolio_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own snapshots"
  ON portfolio_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Trading signals policies
CREATE POLICY "Users can view own signals"
  ON trading_signals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own signals"
  ON trading_signals FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- SERVICE ROLE ACCESS (for autonomous trading)
-- ============================================

-- Allow service role full access (for autonomous agent)
CREATE POLICY "Service role has full access to trades"
  ON trades FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to settings"
  ON trading_settings FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to performance"
  ON strategy_performance FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to snapshots"
  ON portfolio_snapshots FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to signals"
  ON trading_signals FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to calculate Sharpe ratio
CREATE OR REPLACE FUNCTION calculate_sharpe_ratio(
  returns DECIMAL[],
  risk_free_rate DECIMAL DEFAULT 0.0
)
RETURNS DECIMAL AS $$
DECLARE
  avg_return DECIMAL;
  std_dev DECIMAL;
BEGIN
  IF array_length(returns, 1) < 2 THEN
    RETURN NULL;
  END IF;

  avg_return := (SELECT AVG(r) FROM unnest(returns) r);
  std_dev := (SELECT STDDEV(r) FROM unnest(returns) r);

  IF std_dev = 0 THEN
    RETURN NULL;
  END IF;

  RETURN (avg_return - risk_free_rate) / std_dev;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update strategy performance
CREATE OR REPLACE FUNCTION update_strategy_performance()
RETURNS TRIGGER AS $$
BEGIN
  -- When a trade is closed, update the strategy performance
  IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
    INSERT INTO strategy_performance (
      user_id, strategy, mode, period,
      total_trades, winning_trades, losing_trades, win_rate,
      total_pnl, avg_pnl, start_date, end_date
    )
    VALUES (
      NEW.user_id, NEW.strategy, NEW.mode, 'all_time',
      1,
      CASE WHEN COALESCE(NEW.realized_pnl, 0) > 0 THEN 1 ELSE 0 END,
      CASE WHEN COALESCE(NEW.realized_pnl, 0) <= 0 THEN 1 ELSE 0 END,
      CASE WHEN COALESCE(NEW.realized_pnl, 0) > 0 THEN 1.0 ELSE 0.0 END,
      COALESCE(NEW.realized_pnl, 0),
      COALESCE(NEW.realized_pnl, 0),
      CURRENT_DATE, CURRENT_DATE
    )
    ON CONFLICT (user_id, strategy, mode, period, start_date, end_date)
    DO UPDATE SET
      total_trades = strategy_performance.total_trades + 1,
      winning_trades = strategy_performance.winning_trades + CASE WHEN COALESCE(NEW.realized_pnl, 0) > 0 THEN 1 ELSE 0 END,
      losing_trades = strategy_performance.losing_trades + CASE WHEN COALESCE(NEW.realized_pnl, 0) <= 0 THEN 1 ELSE 0 END,
      total_pnl = strategy_performance.total_pnl + COALESCE(NEW.realized_pnl, 0),
      win_rate = (strategy_performance.winning_trades + CASE WHEN COALESCE(NEW.realized_pnl, 0) > 0 THEN 1 ELSE 0 END)::DECIMAL /
                 (strategy_performance.total_trades + 1),
      avg_pnl = (strategy_performance.total_pnl + COALESCE(NEW.realized_pnl, 0)) / (strategy_performance.total_trades + 1);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic performance tracking
DROP TRIGGER IF EXISTS trg_update_strategy_performance ON trades;
CREATE TRIGGER trg_update_strategy_performance
  AFTER UPDATE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION update_strategy_performance();

-- ============================================
-- DONE
-- ============================================
-- Migration complete. Tables created:
-- - trades
-- - trading_settings
-- - strategy_performance
-- - portfolio_snapshots
-- - trading_signals
