# BeRight Protocol - 30% Completion Plan

## Technical Co-Founder Architecture Document

**Author**: Claude (Acting Technical Co-Founder)
**Date**: 2026-03-18
**Goal**: Complete the remaining 30% to achieve revenue-generating product

---
## Executive Summary

The BeRight Protocol is **70% complete** with strong core infrastructure:
- AI agents (Scout, Analyst, Trader, xDegen) - **DONE**
- Multi-platform data aggregation - **DONE**
- On-chain Brier score reputation - **DONE**
- Web UI (Swipe cards, Terminal, Leaderboards) - **DONE**

**The missing 30% is the monetization layer and user activation mechanics.**

This plan is divided into **4 Phases**, each independently testable and deployable.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CURRENT STATE (70%)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Scout     │  │  Analyst    │  │   Trader    │  │   xDegen    │        │
│  │   Agent     │  │   Agent     │  │   Agent     │  │   Agent     │        │
│  │    ✅       │  │    ✅       │  │    ✅       │  │    ✅       │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│         │                │                │                │                │
│         └────────────────┼────────────────┼────────────────┘                │
│                          ▼                ▼                                 │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                    Data Fabric (Unified Markets)                 │       │
│  │  DFlow ✅ | Jupiter ✅ | Polymarket ✅ | Manifold ✅ | Kalshi ✅  │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                      On-Chain Layer (Solana)                     │       │
│  │  Brier Commits ✅ | Calibration Program ✅ | Vault Contract ✅   │       │
│  └─────────────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           MISSING (30%)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: Monetization        PHASE 2: Trading         PHASE 3: Social     │
│  ┌───────────────────┐       ┌───────────────────┐    ┌───────────────────┐│
│  │ Payment Gateway   │       │ Live Execution    │    │ Push Notifications││
│  │ ❌ Stripe         │       │ ⚠️ Enable Live    │    │ ❌ Firebase/Expo  ││
│  │ ❌ Solana Pay     │       │ ⚠️ Wallet Sign UI │    │ ❌ Alert Delivery ││
│  └───────────────────┘       └───────────────────┘    └───────────────────┘│
│  ┌───────────────────┐       ┌───────────────────┐    ┌───────────────────┐│
│  │ Tier Enforcement  │       │ Portfolio UI      │    │ xDegen Auto-Post  ││
│  │ ⚠️ Middleware     │       │ ❌ Positions Page │    │ ⚠️ Enable Live    ││
│  │ ❌ Rate Limits    │       │ ❌ P&L Dashboard  │    │ ❌ Analytics      ││
│  └───────────────────┘       └───────────────────┘    └───────────────────┘│
│                                                                             │
│  PHASE 4: Delegation                                                        │
│  ┌───────────────────┐       ┌───────────────────┐    ┌───────────────────┐│
│  │ Pool UI           │       │ Copy Trading Wire │    │ Yield Automation  ││
│  │ ❌ Create Pool    │       │ ⚠️ Capital Flow   │    │ ❌ Sanctum Hook   ││
│  │ ❌ Delegate UI    │       │ ❌ Performance Fee│    │ ❌ Harvest Cron   ││
│  └───────────────────┘       └───────────────────┘    └───────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Monetization Layer (Revenue Unlock)

**Goal**: Enable payment collection and tier-based access control
**Timeline Estimate**: First priority
**Revenue Impact**: Immediate (SaaS subscriptions)

### 1.1 Payment Processing

#### Files to Create
```
beright-ts/
├── lib/
│   └── payments/
│       ├── stripe.ts           # Stripe SDK wrapper
│       ├── subscriptions.ts    # Subscription management
│       ├── webhooks.ts         # Stripe webhook handlers
│       └── types.ts            # Payment types
└── app/api/
    └── payments/
        ├── checkout/route.ts   # Create checkout session
        ├── portal/route.ts     # Customer portal redirect
        └── webhook/route.ts    # Stripe webhook endpoint

berightweb/
└── src/
    └── app/
        └── pricing/
            └── page.tsx        # Pricing page with Stripe checkout
```

#### Implementation Details

**stripe.ts** - Core Stripe integration:
```typescript
// Key functions to implement:
export async function createCheckoutSession(userId: string, priceId: string)
export async function createCustomerPortalSession(customerId: string)
export async function getSubscriptionStatus(userId: string): Promise<SubscriptionTier>
export async function cancelSubscription(subscriptionId: string)
```

**Database Schema** (Supabase):
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,          -- wallet address or Privy ID
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  tier TEXT NOT NULL DEFAULT 'free',     -- free, pro, whale
  status TEXT NOT NULL DEFAULT 'active', -- active, canceled, past_due
  current_period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_customer_id);
```

**Environment Variables** (add to .env):
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_WHALE=price_...
```

#### Test Plan
```bash
# 1. Unit tests for Stripe wrapper
npm test -- lib/payments/stripe.test.ts

# 2. Integration test: Create checkout session
curl -X POST http://localhost:3000/api/payments/checkout \
  -H "Content-Type: application/json" \
  -d '{"userId": "test_user", "tier": "pro"}'
# Expected: { "url": "https://checkout.stripe.com/..." }

# 3. Webhook test: Simulate subscription.created
stripe trigger checkout.session.completed

# 4. E2E: Complete checkout flow in browser
# - Go to /pricing
# - Click "Subscribe to Pro"
# - Complete Stripe checkout (use test card 4242...)
# - Verify subscription in database
```

---

### 1.2 Tier Enforcement Middleware

#### Files to Modify
```
beright-ts/lib/
├── apiMiddleware.ts    # ADD: Subscription check
└── tierEnforcement.ts  # NEW: Tier checking logic
```

#### Files to Update (Add Tier Checks)
```
beright-ts/app/api/
├── v2/agent/route.ts           # Gate Analyst agent to Pro+
├── v2/execution/route.ts       # Gate trading to Pro+
├── v2/pools/route.ts           # Gate pool creation to Whale
├── v2/pools/[poolId]/delegate/route.ts  # Gate delegation to Pro+
└── v2/research/route.ts        # Gate deep research to Pro+
```

#### Implementation Details

**tierEnforcement.ts**:
```typescript
export type Tier = 'free' | 'pro' | 'whale';

export const TIER_LIMITS = {
  free: {
    predictionsPerDay: 5,
    agents: ['scout'],
    features: ['markets', 'leaderboard'],
    apiCallsPerMinute: 10,
  },
  pro: {
    predictionsPerDay: 50,
    agents: ['scout', 'analyst', 'trader'],
    features: ['markets', 'leaderboard', 'arbitrage', 'alerts', 'trading'],
    apiCallsPerMinute: 60,
  },
  whale: {
    predictionsPerDay: Infinity,
    agents: ['scout', 'analyst', 'trader', 'xdegen'],
    features: ['*'],
    apiCallsPerMinute: 200,
  },
};

export async function checkTierAccess(
  userId: string,
  requiredTier: Tier,
  feature?: string
): Promise<{ allowed: boolean; reason?: string; upgradeUrl?: string }>

export async function checkRateLimit(
  userId: string,
  limitType: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }>

export async function incrementUsage(
  userId: string,
  usageType: 'prediction' | 'api_call' | 'agent_call'
): Promise<void>
```

**Middleware Integration** (apiMiddleware.ts):
```typescript
// Add to withMiddleware options:
interface MiddlewareOptions {
  // ... existing options
  requireTier?: Tier;           // NEW: Minimum tier required
  feature?: string;             // NEW: Feature name for granular access
  countAs?: 'prediction' | 'api_call' | 'agent_call';  // NEW: Usage tracking
}
```

#### Test Plan
```bash
# 1. Unit test tier checking
npm test -- lib/tierEnforcement.test.ts

# 2. Test free user hitting Pro feature
curl -X POST http://localhost:3000/api/v2/agent \
  -H "X-Wallet-Address: free_user_wallet" \
  -H "Content-Type: application/json" \
  -d '{"agent": "analyst", "message": "research question"}'
# Expected: 403 { "error": "Upgrade to Pro for Analyst access", "upgradeUrl": "/pricing" }

# 3. Test Pro user accessing Analyst
curl -X POST http://localhost:3000/api/v2/agent \
  -H "X-Wallet-Address: pro_user_wallet" \
  -H "Content-Type: application/json" \
  -d '{"agent": "analyst", "message": "research question"}'
# Expected: 200 with agent response

# 4. Test rate limiting
for i in {1..15}; do
  curl -X GET http://localhost:3000/api/v2/markets \
    -H "X-Wallet-Address: free_user_wallet"
done
# Expected: 429 after 10 requests
```

---

### 1.3 Usage Tracking & Quotas

#### Database Schema
```sql
CREATE TABLE usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  usage_type TEXT NOT NULL,  -- prediction, api_call, agent_call
  count INTEGER DEFAULT 0,
  period_start DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, usage_type, period_start)
);

CREATE INDEX idx_usage_user_period ON usage(user_id, period_start);
```

#### Test Plan
```bash
# 1. Verify usage increments
# Make 5 predictions as free user
# Check usage table: SELECT * FROM usage WHERE user_id = 'test'
# Expected: count = 5

# 2. Verify quota enforcement
# Make 6th prediction
# Expected: 429 { "error": "Daily prediction limit reached", "upgradeUrl": "/pricing" }

# 3. Verify quota reset
# Wait for midnight UTC (or mock time)
# Make prediction
# Expected: 200 success
```

---

## Phase 2: Trading Execution (Core Product Value)

**Goal**: Enable live trading with proper UX and risk controls
**Timeline Estimate**: After Phase 1
**Revenue Impact**: Platform fees (0.5% per trade)

### 2.1 Enable Live Trading Mode

#### Files to Modify
```
beright-ts/
├── services/tradeExecutionLayer.ts  # Change default mode
├── lib/execution/fastExecution.ts   # Verify production config
└── lib/dflow/executor.ts            # Verify mainnet config
```

#### Implementation Details

**tradeExecutionLayer.ts** - Mode configuration:
```typescript
// BEFORE:
const DEFAULT_EXECUTION_CONFIG = {
  mode: 'paper',  // Simulation
  autoExecute: false,
  // ...
};

// AFTER:
const DEFAULT_EXECUTION_CONFIG = {
  mode: process.env.TRADING_MODE || 'paper',  // Configurable
  autoExecute: false,  // Keep false - require user confirmation
  maxConcurrentTrades: 3,  // Reduce for safety
  cooldownBetweenTradesMs: 120000,  // 2 min cooldown
  circuitBreakerThreshold: 0.3,  // 30% loss triggers halt
};
```

**Environment Variables**:
```
TRADING_MODE=live           # Enable live trading
TRADING_MAX_SIZE_USDC=100   # Max single trade size
TRADING_DAILY_LIMIT_USDC=500  # Daily volume limit per user
```

#### Test Plan
```bash
# 1. Paper trading works (default)
TRADING_MODE=paper npm run dev
# Execute trade via UI → Verify no real tx submitted

# 2. Live mode on testnet first
TRADING_MODE=live SOLANA_RPC_URL=devnet npm run dev
# Execute small trade → Verify devnet tx

# 3. Live mode mainnet (staged rollout)
TRADING_MODE=live npm run dev
# Execute $1 trade → Verify mainnet tx on Solscan
```

---

### 2.2 Trading UI Components

#### Files to Create/Modify
```
berightweb/src/
├── app/
│   └── portfolio/
│       └── page.tsx           # NEW: Portfolio dashboard
├── components/
│   ├── TradingModal.tsx       # MODIFY: Add wallet signing flow
│   ├── PortfolioView.tsx      # NEW: Positions + P&L display
│   ├── TradeConfirmation.tsx  # NEW: Pre-trade confirmation
│   └── TransactionStatus.tsx  # NEW: Real-time tx status
└── hooks/
    ├── useTrading.ts          # NEW: Trading state management
    └── usePortfolio.ts        # NEW: Portfolio data fetching
```

#### Implementation Details

**TradingModal.tsx** - Wallet signing flow:
```typescript
// Flow:
// 1. User clicks "Buy YES"
// 2. Modal shows: Market, Side, Size, Est. Price, Est. Payout
// 3. "Confirm Trade" button
// 4. Call /api/dflow POST { action: 'order', ... }
// 5. Receive unsigned tx (base64)
// 6. Prompt wallet signature (Privy/Phantom)
// 7. Submit signed tx
// 8. Show pending → confirmed → success states
// 9. Update portfolio display

interface TradingModalProps {
  market: Market;
  side: 'YES' | 'NO';
  onClose: () => void;
}

// Key states:
// - 'idle' → 'quoting' → 'confirming' → 'signing' → 'submitting' → 'success/error'
```

**PortfolioView.tsx** - Positions display:
```typescript
// Fetch from /api/v2/execution/balances
// Display:
// - Total portfolio value
// - Open positions (market, side, size, entry price, current price, P&L)
// - Resolved positions (won/lost, payout)
// - Pending transactions
```

#### Test Plan
```bash
# 1. UI renders without wallet
# - Open /portfolio
# - Expected: "Connect wallet to view positions"

# 2. UI renders with wallet
# - Connect Phantom/Privy wallet
# - Expected: Portfolio loads, shows positions or "No positions"

# 3. Trade flow E2E
# - Go to market detail
# - Click "Buy YES $10"
# - Confirm in modal
# - Sign in wallet
# - Verify:
#   a. Transaction submitted (toast notification)
#   b. Transaction confirmed (success state)
#   c. Position appears in portfolio
#   d. Balance updated

# 4. Error handling
# - Reject wallet signature
# - Expected: "Transaction cancelled" message
# - Insufficient balance
# - Expected: "Insufficient USDC balance"
```

---

### 2.3 Risk Controls UI

#### Files to Create
```
berightweb/src/components/
├── RiskWarning.tsx        # Trade size warnings
├── ExposureIndicator.tsx  # Portfolio exposure meter
└── CircuitBreakerBanner.tsx  # Trading halted notification
```

#### Implementation Details
```typescript
// RiskWarning.tsx
// Show when:
// - Trade > 20% of portfolio
// - Trade would exceed daily limit
// - Market has low liquidity

// ExposureIndicator.tsx
// Visual meter: 0-100% of portfolio at risk
// Color: green < 50%, yellow 50-80%, red > 80%

// CircuitBreakerBanner.tsx
// Show when trading halted due to:
// - Session loss > 30%
// - System maintenance
// - Market irregularities
```

#### Test Plan
```bash
# 1. Risk warning triggers
# - Set portfolio to $100
# - Attempt $30 trade
# - Expected: Warning "This trade is 30% of your portfolio"

# 2. Circuit breaker
# - Trigger 30% loss in paper mode
# - Expected: Banner "Trading paused - Risk limit reached"
# - Verify trades are blocked
```

---

## Phase 3: Social & Viral Mechanics

**Goal**: Enable organic growth through social features
**Timeline Estimate**: After Phase 2
**Revenue Impact**: User acquisition, engagement

### 3.1 Push Notifications

#### Files to Create
```
beright-ts/
├── lib/
│   └── notifications/
│       ├── firebase.ts        # Firebase Cloud Messaging
│       ├── expo.ts            # Expo push (mobile)
│       ├── telegram.ts        # Telegram notifications (existing)
│       ├── dispatcher.ts      # Multi-channel dispatcher
│       └── types.ts           # Notification types
└── app/api/
    └── notifications/
        ├── register/route.ts  # Register device token
        ├── preferences/route.ts  # Get/set preferences
        └── test/route.ts      # Send test notification

berightweb/
└── src/
    └── lib/
        └── notifications.ts   # Client-side registration
```

#### Implementation Details

**dispatcher.ts**:
```typescript
export type NotificationChannel = 'push' | 'telegram' | 'email';
export type NotificationType =
  | 'prediction_resolved'
  | 'followed_user_predicted'
  | 'price_alert'
  | 'arbitrage_opportunity'
  | 'daily_brief';

export async function sendNotification(
  userId: string,
  type: NotificationType,
  payload: NotificationPayload,
  channels?: NotificationChannel[]
): Promise<void>

// Default channel selection by type:
// - prediction_resolved → push + telegram
// - followed_user_predicted → push
// - price_alert → push + telegram
// - arbitrage_opportunity → push (Pro+)
// - daily_brief → email
```

**Database Schema**:
```sql
CREATE TABLE notification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL,        -- push, telegram, email
  token TEXT NOT NULL,          -- FCM token, Telegram ID, email
  device_info JSONB,            -- platform, model, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, channel, token)
);

CREATE TABLE notification_preferences (
  user_id TEXT PRIMARY KEY,
  prediction_resolved BOOLEAN DEFAULT TRUE,
  followed_user_predicted BOOLEAN DEFAULT TRUE,
  price_alert BOOLEAN DEFAULT TRUE,
  arbitrage_opportunity BOOLEAN DEFAULT TRUE,
  daily_brief BOOLEAN DEFAULT TRUE,
  quiet_hours_start INTEGER,    -- Hour (0-23)
  quiet_hours_end INTEGER,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Test Plan
```bash
# 1. Token registration
curl -X POST http://localhost:3000/api/notifications/register \
  -H "X-Wallet-Address: test_wallet" \
  -H "Content-Type: application/json" \
  -d '{"channel": "push", "token": "fcm_token_here"}'
# Expected: 200 { "success": true }

# 2. Test notification
curl -X POST http://localhost:3000/api/notifications/test \
  -H "X-Wallet-Address: test_wallet" \
  -H "Content-Type: application/json" \
  -d '{"type": "prediction_resolved"}'
# Expected: Push notification received on device

# 3. Preference update
curl -X PATCH http://localhost:3000/api/notifications/preferences \
  -H "X-Wallet-Address: test_wallet" \
  -H "Content-Type: application/json" \
  -d '{"arbitrage_opportunity": false}'
# Expected: 200, no more arb notifications
```

---

### 3.2 Enable xDegen Auto-Posting

#### Files to Modify
```
beright-ts/
├── agents/xdegen/autoPost.ts   # Enable live posting
└── services/xdegenRunner.ts    # NEW: Cron job runner
```

#### Implementation Details

**xdegenRunner.ts**:
```typescript
// Cron job to run xDegen auto-posting
// Schedule: Every 60 minutes (configurable)
// Features:
// - Respects rate limits (3/hour, 10/day)
// - Respects quiet hours (2-7 AM)
// - Tracks engagement (likes, retweets, replies)
// - A/B tests content templates

export async function runXDegenCycle(): Promise<void> {
  // 1. Check rate limits
  // 2. Get market alpha (hot markets, arbitrage)
  // 3. Generate content based on template distribution
  // 4. Post to Twitter
  // 5. Log engagement metrics
}
```

**Environment Variables**:
```
TWITTER_API_KEY=...
TWITTER_API_SECRET=...
TWITTER_ACCESS_TOKEN=...
TWITTER_ACCESS_SECRET=...
XDEGEN_ENABLED=true
XDEGEN_INTERVAL_MINUTES=60
```

#### Test Plan
```bash
# 1. Dry run (no actual posting)
XDEGEN_ENABLED=false npm run xdegen:test
# Expected: Generated content logged, no tweets sent

# 2. Single post test
XDEGEN_ENABLED=true npm run xdegen:single
# Expected: One tweet posted, visible on @BeRightProtocol

# 3. Rate limit test
# Run 4 posts within 1 hour
# Expected: 4th post blocked with "Rate limit reached"

# 4. Quiet hours test
# Set system time to 3 AM
# Run xdegen cycle
# Expected: "Quiet hours - skipping post"
```

---

### 3.3 Referral Tracking & Rewards

#### Files to Modify
```
beright-ts/
└── app/api/
    └── referrals/
        ├── track/route.ts     # NEW: Track referral attribution
        ├── stats/route.ts     # NEW: Get referral stats
        └── claim/route.ts     # NEW: Claim referral rewards

berightweb/
└── src/
    └── app/
        └── referrals/
            └── page.tsx       # NEW: Referral dashboard
```

#### Database Schema
```sql
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id TEXT NOT NULL,
  referee_id TEXT NOT NULL UNIQUE,
  referral_code TEXT NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending, converted, rewarded
  reward_xp INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  converted_at TIMESTAMP
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_code ON referrals(referral_code);
```

#### Test Plan
```bash
# 1. Referral attribution
# Visit beright.ai?ref=BR1a3b7z
# Sign up new account
# Check database: referee attributed to referrer

# 2. Conversion tracking
# New user makes first prediction
# Check referral status: 'converted'
# Check referrer XP: +100

# 3. Tier rewards
# Referrer reaches 5 referrals
# Check XP: +500 bonus
# Check badge: "Recruiter" unlocked
```

---

## Phase 4: Delegation & Staking

**Goal**: Enable copy trading with capital delegation
**Timeline Estimate**: After Phase 3
**Revenue Impact**: 20% performance fee on delegated gains

### 4.1 Pool Management UI

#### Files to Create
```
berightweb/src/app/
└── pools/
    ├── page.tsx              # Pool discovery
    ├── create/page.tsx       # Create new pool
    └── [poolId]/
        ├── page.tsx          # Pool detail
        ├── delegate/page.tsx # Delegate capital
        └── manage/page.tsx   # Pool manager dashboard
```

#### Implementation Details

**Pool Discovery Page**:
```typescript
// List all pools with:
// - Manager name, Brier score, accuracy
// - Pool size (AUM), performance (7d, 30d, all-time)
// - Fee structure (management %, performance %)
// - Minimum delegation
// - Filter/sort by performance, size, fees
```

**Create Pool Page** (Whale tier only):
```typescript
// Form fields:
// - Pool name
// - Strategy description
// - Management fee (0-5%)
// - Performance fee (0-30%)
// - Minimum delegation ($10-$1000)
// - Maximum pool size (optional)
// - Lockup period (7-90 days)
```

**Delegate Page**:
```typescript
// Flow:
// 1. Select amount to delegate
// 2. Review terms (fees, lockup)
// 3. Sign delegation transaction
// 4. Capital transferred to pool
// 5. Receive pool shares (LP tokens)
```

#### Test Plan
```bash
# 1. Pool creation
# - Login as Whale user
# - Go to /pools/create
# - Fill form and submit
# - Verify pool appears in discovery
# - Verify on-chain pool account created

# 2. Delegation
# - Login as Pro user
# - Go to pool detail page
# - Click "Delegate $100"
# - Sign transaction
# - Verify balance deducted
# - Verify pool shares received
# - Verify AUM increased

# 3. Undelegation
# - Go to pool detail
# - Click "Undelegate"
# - Wait for lockup period
# - Claim funds
# - Verify balance returned + gains/losses
```

---

### 4.2 Copy Trading Wire

#### Files to Modify
```
beright-ts/
├── skills/copyTrading.ts           # Wire capital flow
├── lib/orchestrator/handlers/follow.ts  # Add delegation option
└── services/copyTradingEngine.ts   # NEW: Auto-copy execution
```

#### Implementation Details

**copyTradingEngine.ts**:
```typescript
// When followed user makes trade:
// 1. Receive signal (via WebSocket or polling)
// 2. Check follower's delegation to that user
// 3. Calculate proportional size
// 4. Apply follower's risk preferences (max %, stop loss)
// 5. Execute trade on behalf of follower
// 6. Track performance attribution

export class CopyTradingEngine {
  async onLeaderTrade(leaderId: string, trade: Trade): Promise<void> {
    const followers = await getFollowersWithDelegation(leaderId);

    for (const follower of followers) {
      const size = calculateProportionalSize(trade, follower.delegation);
      if (size < MIN_TRADE_SIZE) continue;

      await executeCopyTrade(follower.id, {
        ...trade,
        size,
        source: 'copy',
        leaderId,
      });
    }
  }
}
```

#### Test Plan
```bash
# 1. Follow without delegation
# - Follow a forecaster
# - Forecaster makes prediction
# - Expected: Alert notification, no trade executed

# 2. Follow with delegation
# - Delegate $100 to forecaster
# - Forecaster makes $50 trade (50% of their portfolio)
# - Expected: $50 trade executed for you (proportional)

# 3. Risk controls
# - Set max position to 10%
# - Forecaster makes 30% trade
# - Expected: Your trade capped at 10%
```

---

### 4.3 Yield Automation (Sanctum Integration)

#### Files to Create
```
beright-ts/
├── lib/
│   └── yield/
│       ├── sanctum.ts         # Sanctum LST integration
│       ├── harvester.ts       # Yield harvesting cron
│       └── distributor.ts     # Yield distribution to delegators
└── services/
    └── yieldAutomation.ts     # Scheduled yield operations
```

#### Implementation Details

**sanctum.ts**:
```typescript
// Sanctum integration for LST yield
export async function depositToSanctum(poolId: string, amount: number): Promise<void>
export async function harvestYield(poolId: string): Promise<number>
export async function getApyEstimate(): Promise<number>
```

**harvester.ts**:
```typescript
// Cron job: Daily at 00:00 UTC
// 1. For each pool with idle USDC > threshold
// 2. Swap USDC → SOL → LST (Sanctum)
// 3. Track yield accrual
// 4. Distribute to pool shares proportionally
```

#### Test Plan
```bash
# 1. Sanctum deposit (testnet)
# - Create pool with $1000
# - Run harvest cron
# - Expected: $900 deposited to Sanctum (keep $100 liquid)

# 2. Yield distribution
# - Wait 1 day (or mock)
# - Run harvest
# - Expected: Yield distributed to delegators proportionally

# 3. Withdrawal with yield
# - Delegator withdraws
# - Expected: Principal + accumulated yield returned
```

---

## Testing Strategy

### Unit Tests
Each new module should have corresponding tests:
```
beright-ts/
└── __tests__/
    ├── lib/
    │   ├── payments/
    │   │   ├── stripe.test.ts
    │   │   └── subscriptions.test.ts
    │   ├── tierEnforcement.test.ts
    │   ├── notifications/
    │   │   └── dispatcher.test.ts
    │   └── yield/
    │       └── sanctum.test.ts
    └── services/
        ├── copyTradingEngine.test.ts
        └── yieldAutomation.test.ts
```

### Integration Tests
```bash
# Run all integration tests
npm run test:integration

# Test specific phase
npm run test:integration -- --grep "Phase 1"
```

### E2E Tests (Playwright)
```
berightweb/
└── e2e/
    ├── pricing.spec.ts       # Checkout flow
    ├── trading.spec.ts       # Trade execution
    ├── portfolio.spec.ts     # Portfolio management
    ├── pools.spec.ts         # Pool creation/delegation
    └── notifications.spec.ts # Notification preferences
```

### Staging Environment
Before each phase goes live:
1. Deploy to staging (separate Supabase, Stripe test mode)
2. Run full E2E suite
3. Manual QA checklist
4. Gradual rollout (10% → 50% → 100%)

---

## Deployment Checklist

### Phase 1 (Monetization)
- [ ] Stripe account setup (production)
- [ ] Webhook endpoint verified
- [ ] Database migrations applied
- [ ] Tier middleware deployed
- [ ] Pricing page live
- [ ] Rate limiting active

### Phase 2 (Trading)
- [ ] TRADING_MODE=live in production
- [ ] Daily limits configured
- [ ] Circuit breaker tested
- [ ] Portfolio UI deployed
- [ ] Wallet signing E2E verified

### Phase 3 (Social)
- [ ] Firebase project setup
- [ ] Push notifications tested
- [ ] Twitter API credentials configured
- [ ] xDegen runner deployed
- [ ] Referral tracking active

### Phase 4 (Delegation)
- [ ] Pool contracts audited (if modified)
- [ ] Pool UI deployed
- [ ] Copy trading engine tested
- [ ] Sanctum integration verified
- [ ] Fee collection automated

---

## Success Metrics

| Phase | Metric | Target |
|-------|--------|--------|
| 1 | Paid conversion rate | >5% of active users |
| 1 | MRR | $5K within 30 days |
| 2 | Trading volume | $10K/day within 60 days |
| 2 | Platform fee revenue | $50/day |
| 3 | DAU growth | 20% week-over-week |
| 3 | Referral rate | 1.5 referrals per user |
| 4 | AUM delegated | $100K within 90 days |
| 4 | Performance fee revenue | $500/month |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Payment fraud | Stripe Radar, 3D Secure |
| Trading losses | Daily limits, circuit breaker, paper mode default |
| Wallet hacks | No server-side key storage, client signing only |
| Pool manager rug | Lockup periods, slashing on bad performance |
| API abuse | Tier-based rate limiting, request signing |
| Regulatory | Geo-blocking (if needed), compliance review |

---

## Summary

The 30% completion requires:

1. **Phase 1**: Wire payments → Enforce tiers → Track usage
2. **Phase 2**: Enable live trading → Build portfolio UI → Add risk controls
3. **Phase 3**: Add push notifications → Enable xDegen → Track referrals
4. **Phase 4**: Build pool UI → Wire copy trading → Automate yield

Each phase is independently valuable:
- Phase 1 alone enables SaaS revenue
- Phase 2 alone enables trading fee revenue
- Phase 3 alone enables growth
- Phase 4 alone enables delegation fee revenue

**Recommended order**: 1 → 2 → 3 → 4 (monetization first, then product, then growth, then advanced features)
