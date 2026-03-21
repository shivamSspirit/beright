-- ============================================================================
-- BeRight Protocol: Subscription Management
-- ============================================================================
-- Stripe-integrated subscription system with tier-based access control.
-- ============================================================================

-- Subscription tiers enum
CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'alpha', 'whale', 'enterprise');

-- Subscription status enum
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'trialing', 'incomplete', 'unpaid');

-- Billing interval enum
CREATE TYPE billing_interval AS ENUM ('month', 'year');

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT UNIQUE NOT NULL,
    tier subscription_tier NOT NULL DEFAULT 'free',
    status subscription_status NOT NULL DEFAULT 'active',
    stripe_customer_id TEXT NOT NULL,
    stripe_subscription_id TEXT,
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 month',
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    billing_interval billing_interval NOT NULL DEFAULT 'month',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_tier ON subscriptions(tier);

-- ============================================================================
-- SUBSCRIPTION USAGE TABLE
-- ============================================================================
-- Tracks daily usage for rate limiting and billing

CREATE TABLE IF NOT EXISTS subscription_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    queries_used INTEGER NOT NULL DEFAULT 0,
    scout_calls_used INTEGER NOT NULL DEFAULT 0,
    analyst_calls_used INTEGER NOT NULL DEFAULT 0,
    trader_calls_used INTEGER NOT NULL DEFAULT 0,
    alerts_sent INTEGER NOT NULL DEFAULT 0,
    api_calls_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Indexes
CREATE INDEX idx_subscription_usage_user_date ON subscription_usage(user_id, date);
CREATE INDEX idx_subscription_usage_date ON subscription_usage(date);

-- ============================================================================
-- STRIPE EVENTS TABLE
-- ============================================================================
-- Stores webhook events for idempotency and debugging

CREATE TABLE IF NOT EXISTS stripe_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stripe_events_stripe_id ON stripe_events(stripe_event_id);
CREATE INDEX idx_stripe_events_type ON stripe_events(event_type);
CREATE INDEX idx_stripe_events_processed ON stripe_events(processed_at);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Increment usage counter atomically
CREATE OR REPLACE FUNCTION increment_usage(
    p_user_id TEXT,
    p_date DATE,
    p_field TEXT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO subscription_usage (user_id, date)
    VALUES (p_user_id, p_date)
    ON CONFLICT (user_id, date) DO NOTHING;

    EXECUTE format(
        'UPDATE subscription_usage SET %I = %I + 1, updated_at = NOW() WHERE user_id = $1 AND date = $2',
        p_field, p_field
    ) USING p_user_id, p_date;
END;
$$ LANGUAGE plpgsql;

-- Get user's current tier
CREATE OR REPLACE FUNCTION get_user_tier(p_user_id TEXT)
RETURNS subscription_tier AS $$
DECLARE
    v_tier subscription_tier;
    v_status subscription_status;
BEGIN
    SELECT tier, status INTO v_tier, v_status
    FROM subscriptions
    WHERE user_id = p_user_id;

    IF v_tier IS NULL THEN
        RETURN 'free'::subscription_tier;
    END IF;

    IF v_status NOT IN ('active', 'trialing') THEN
        RETURN 'free'::subscription_tier;
    END IF;

    RETURN v_tier;
END;
$$ LANGUAGE plpgsql;

-- Check if user is within daily limit
CREATE OR REPLACE FUNCTION check_usage_limit(
    p_user_id TEXT,
    p_field TEXT,
    p_limit INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current INTEGER;
BEGIN
    -- Unlimited
    IF p_limit < 0 THEN
        RETURN TRUE;
    END IF;

    EXECUTE format(
        'SELECT COALESCE(%I, 0) FROM subscription_usage WHERE user_id = $1 AND date = CURRENT_DATE',
        p_field
    ) INTO v_current USING p_user_id;

    IF v_current IS NULL THEN
        v_current := 0;
    END IF;

    RETURN v_current < p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

-- Subscriptions: users can only read their own
CREATE POLICY subscriptions_select_own ON subscriptions
    FOR SELECT USING (user_id = current_setting('app.user_id', true));

-- Usage: users can only read their own
CREATE POLICY subscription_usage_select_own ON subscription_usage
    FOR SELECT USING (user_id = current_setting('app.user_id', true));

-- Stripe events: admin only (service role)
CREATE POLICY stripe_events_admin_only ON stripe_events
    FOR ALL USING (current_setting('role', true) = 'service_role');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE subscriptions IS 'User subscription data synced with Stripe';
COMMENT ON TABLE subscription_usage IS 'Daily usage tracking for rate limiting';
COMMENT ON TABLE stripe_events IS 'Stripe webhook events for idempotency';

COMMENT ON COLUMN subscriptions.tier IS 'Current subscription tier (free, pro, alpha, whale, enterprise)';
COMMENT ON COLUMN subscriptions.status IS 'Stripe subscription status';
COMMENT ON COLUMN subscriptions.cancel_at_period_end IS 'If true, subscription will not renew';
