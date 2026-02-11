# BeRight: Full Stack Prediction Infrastructure

## Vision

BeRight is not just an aggregator — it's the **AI-native prediction intelligence network**. We combine three layers that no one else has:

1. **Aggregation** — Route to best price across 5+ prediction markets
2. **Intelligence** — AI + Human consensus for better forecasting
3. **Social** — Reputation economy where accuracy is currency

---

## The Flywheel

```
                         ┌─────────────────┐
                         │   MORE USERS    │
                         └────────┬────────┘
                                  │
                                  ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   DISTRIBUTION  │      │   PREDICTIONS   │      │  INTELLIGENCE   │
│                 │      │                 │      │                 │
│ Embeds, TG,     │─────▶│ Users make      │─────▶│ AI + Consensus  │
│ API, Social     │      │ predictions     │      │ analysis        │
└─────────────────┘      └────────┬────────┘      └────────┬────────┘
        ▲                         │                         │
        │                         ▼                         │
        │                ┌─────────────────┐                │
        │                │    ACCURACY     │                │
        │                │    TRACKING     │◀───────────────┘
        │                │ Brier scores    │
        │                └────────┬────────┘
        │                         │
        │                         ▼
        │                ┌─────────────────┐
        │                │   REPUTATION    │
        │                │                 │
        │                │ Leaderboards,   │
        │                │ Verified track  │
        │                │ records         │
        │                └────────┬────────┘
        │                         │
        │                         ▼
        │                ┌─────────────────┐
        │                │  MONETIZATION   │
        │                │                 │
        └────────────────│ Signal sales,   │
                         │ Copy trading,   │
                         │ API access      │
                         └─────────────────┘
```

**Each layer feeds the next. Build in order.**

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           BERIGHT INFRASTRUCTURE                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      CLIENT LAYER                                │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│    │
│  │  │ Web App  │  │ Telegram │  │ Embeds   │  │ Mobile (Future)  ││    │
│  │  │ (Next.js)│  │ Bot      │  │ (iframe) │  │                  ││    │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘│    │
│  └───────┼─────────────┼─────────────┼─────────────────┼──────────┘    │
│          │             │             │                 │                │
│          └─────────────┴──────┬──────┴─────────────────┘                │
│                               │                                          │
│                               ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      API GATEWAY                                 │    │
│  │  /api/markets    /api/predict    /api/consensus    /api/signals │    │
│  │  /api/user       /api/leaderboard    /api/embed    /api/agents  │    │
│  └───────────────────────────┬─────────────────────────────────────┘    │
│                               │                                          │
│          ┌───────────────────┬┴───────────────────┐                     │
│          ▼                   ▼                    ▼                     │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐               │
│  │ AGGREGATION  │   │ INTELLIGENCE │   │ SOCIAL/REPUTATION│             │
│  │   ENGINE     │   │    ENGINE    │   │     ENGINE       │             │
│  │              │   │              │   │                  │             │
│  │ • 5 markets  │   │ • AI model   │   │ • User profiles  │             │
│  │ • Arb detect │   │ • Consensus  │   │ • Brier tracking │             │
│  │ • Whale track│   │ • Research   │   │ • Leaderboards   │             │
│  │ • Price feed │   │ • Sentiment  │   │ • Follow/copy    │             │
│  └──────┬───────┘   └──────┬───────┘   └────────┬─────────┘             │
│         │                  │                     │                       │
│         └──────────────────┼─────────────────────┘                       │
│                            ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    AUTONOMOUS AGENT LAYER                        │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ │    │
│  │  │ Heartbeat  │  │ Arb Bot    │  │ Signal Bot │  │ User Agents│ │    │
│  │  │ (5 min)    │  │ (executor) │  │ (notifier) │  │ (custom)   │ │    │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                               │                                          │
│                               ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      DATA LAYER                                  │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │    │
│  │  │Predictions│ │ Users    │  │ Markets  │  │ Agent State      │ │    │
│  │  │(Supabase) │ │          │  │ (Cache)  │  │ (Memory files)   │ │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL INTEGRATIONS                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │Polymarket│ │Kalshi/   │ │Manifold  │ │Limitless │ │Metaculus │      │
│  │          │ │DFlow     │ │          │ │          │ │          │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │Helius RPC│ │Jupiter   │ │News APIs │ │Solana    │                   │
│  │(Whales)  │ │(Swaps)   │ │(Intel)   │ │(On-chain)│                   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## The Three Layers

### Layer 1: Aggregation Engine

**Purpose**: Single source of truth for all prediction market data

| Platform | Integration | Status |
|----------|-------------|--------|
| Polymarket | `gamma-api.polymarket.com` | ✅ Live |
| Kalshi/DFlow | `dev-prediction-markets-api.dflow.net` | ✅ Live |
| Manifold | `api.manifold.markets/v0` | ✅ Live |
| Limitless | `api.limitless.exchange` | ✅ Live |
| Metaculus | `www.metaculus.com/api2` | ✅ Live |

**Capabilities**:
- Cross-platform market search
- Real-time price comparison
- Arbitrage opportunity detection
- Whale activity tracking (Helius RPC)
- Trade routing to best price

### Layer 2: Intelligence Engine

**Purpose**: Not just "what's the price" but "what's the TRUTH"

```
┌────────────────────────────────────────────────────────┐
│  BERIGHT CONSENSUS: Bitcoin $150K by EOY 2026         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                        │
│  Market Average    ████████████░░░░░  67%             │
│  Polymarket        ████████████░░░░░  65%             │
│  Kalshi            █████████████░░░░  72%             │
│  Manifold          ███████████░░░░░░  62%             │
│                                                        │
│  BeRight AI        █████████████████░  78%  ← Bullish │
│  Top Forecasters   ████████████░░░░░  68%             │
│                                                        │
│  CONSENSUS         ████████████░░░░░  69%             │
│  Confidence: HIGH (sources agree within 10%)          │
└────────────────────────────────────────────────────────┘
```

**Components**:
- AI forecaster (Claude-powered analysis)
- Multi-platform price aggregation
- Top forecaster consensus
- News sentiment analysis
- Confidence scoring

### Layer 3: Social/Reputation Engine

**Purpose**: Build the forecaster economy

**User Profile**:
```
┌─────────────────────────────────────────────────────┐
│  @cryptoforecaster                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                     │
│  Brier Score: 0.12 (Top 3%)                        │
│  Predictions: 847                                   │
│  Accuracy: 71%                                      │
│  Specialty: Crypto, Fed Policy                      │
│  Followers: 2,341                                   │
│  Monthly Signal Revenue: $4,200                     │
│                                                     │
│  [Follow] [Copy Trades] [View History]              │
└─────────────────────────────────────────────────────┘
```

**Features**:
- Brier score tracking per user
- Category-specific leaderboards
- Follow/copy trading system
- Verifiable prediction history
- Signal monetization

---

## Build Phases

### Phase 0: Foundation (Current)
**Goal**: Turn demo into working product

- [ ] Wire berightweb → beright-ts APIs
- [ ] Deploy Telegram bot
- [ ] Basic user identity (Telegram ID ↔ predictions)

**Output**: Real product, real users, real predictions

---

### Phase 1: Aggregator
**Goal**: Best UX to access all markets

- [ ] Market explorer page (browse all 5 platforms)
- [ ] Cross-platform comparison view
- [ ] Arbitrage alerts (Telegram notifications)
- [ ] Wallet connect (Privy integration)
- [ ] Trade routing (auto-route to best price)

**Output**: Users can discover and trade any market

---

### Phase 2: Intelligence
**Goal**: Become authoritative source for predictions

- [ ] Consensus view (Market avg + AI + Top forecasters)
- [ ] AI reasoning display ("72% because...")
- [ ] Confidence indicators (high/low agreement)
- [ ] Research command (/research topic)
- [ ] Daily briefing (morning Telegram summary)

**Output**: Users trust BeRight more than any single platform

---

### Phase 3: Social
**Goal**: Build reputation economy

- [ ] Forecaster profiles (track record, Brier score)
- [ ] Follow system (notifications when top forecasters predict)
- [ ] Copy trading (auto-mirror positions)
- [ ] Category leaderboards (top crypto, politics, etc.)
- [ ] Public prediction history (shareable)

**Output**: Forecasters build reputation, followers copy them

---

### Phase 4: Distribution
**Goal**: BeRight everywhere

- [ ] Embed widget (React component for publishers)
- [ ] Publisher dashboard (analytics, revenue)
- [ ] Twitter card integration
- [ ] Public API (developers build on BeRight)
- [ ] Revenue share (publishers earn % of trades)

**Output**: BeRight on every news article about future events

---

### Phase 5: Autonomous Agents
**Goal**: 24/7 intelligent automation

- [ ] User-configurable agents (custom rules)
- [ ] Arb execution agent (auto-capture opportunities)
- [ ] Signal agent (generate/sell trading signals)
- [ ] Resolution agent (track outcomes, update Brier)
- [ ] Agent marketplace (share/sell strategies)

**Output**: Hands-off prediction market trading

---

## Revenue Model

### Phase 1-2 (Aggregator + Intelligence)
| Stream | Model |
|--------|-------|
| Trade routing fees | 0.1% of volume |
| Premium features | $10/mo for advanced analytics |

### Phase 3 (Social)
| Stream | Model |
|--------|-------|
| Signal subscriptions | $X/mo to follow top forecasters |
| Copy trading fees | % of copied trades |
| Verified badge | $50/mo for institutions |

### Phase 4 (Distribution)
| Stream | Model |
|--------|-------|
| Publisher revenue share | Keep 30% of embed trades |
| API access | Usage-based pricing |
| White-label licensing | Custom deployments |

### Phase 5 (Agents)
| Stream | Model |
|--------|-------|
| Agent hosting | $20/mo per agent |
| Strategy marketplace | % of sales |
| Institutional agent API | Enterprise pricing |

---

## Competitive Moats

| Moat | How Built | Why Hard to Copy |
|------|-----------|------------------|
| Forecaster reputation data | Every prediction tracked with Brier | Years of history |
| AI + Human consensus | Proprietary signal blend | Training data + methodology |
| Distribution network | Embeds on news sites | Relationships + integration |
| Agent infrastructure | Autonomous trading framework | Technical complexity |
| Network effects | Forecasters → Followers → More forecasters | Classic social moat |

---

## Differentiation vs. Pure Aggregation

| Pure Aggregation | BeRight Full Stack |
|------------------|-------------------|
| Routes to best price | Routes to best *outcome* |
| Shows odds | Shows intelligence |
| Users trade | Users build reputation |
| Widget embeds | Content + widget embeds |
| Platform | Protocol + Platform + Network |
| One revenue stream | Five revenue streams |
| Liquidity moat | Reputation + Intelligence moat |

---

## Current State

### beright-ts (Backend) — 90% Complete
- ✅ 5 market integrations (live)
- ✅ 21 skills, 30+ commands
- ✅ Arbitrage detection
- ✅ Whale tracking
- ✅ Autonomous heartbeat
- ✅ API routes (7 endpoints)
- ✅ Telegram bot (needs token)

### berightweb (Frontend) — 60% Complete
- ✅ Swipe UI (Tinder-style)
- ✅ AI vs Human modal
- ✅ Leaderboard page
- ✅ Stats/Calibration page
- ✅ Profile page
- ❌ Uses mock data (not connected to backend)

---

## Immediate Priorities

1. **Wire frontend to backend** — Replace mock data with real APIs
2. **Deploy Telegram bot** — Immediate distribution channel
3. **Build consensus view** — Intelligence layer MVP
4. **Add forecaster profiles** — Social layer MVP
5. **Build embed widget** — Distribution MVP

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind 4, Framer Motion |
| Backend | Node.js, TypeScript, Express API routes |
| Agent | OpenClaw + Claude Sonnet 4 |
| Database | JSON files → Supabase (migration ready) |
| Blockchain | Solana Mainnet, Helius RPC |
| Markets | Polymarket, Kalshi/DFlow, Manifold, Limitless, Metaculus |
| Swaps | Jupiter V6 Lite API |
| Chat | Telegram (grammY) |
| Auth | Privy (configured, not wired) |

---

## Key Insight

> **Umang's vision builds pipes. BeRight builds a brain.**

The aggregation layer is table stakes. The intelligence + social + distribution layers create defensible moats that compound over time.

Every prediction made on BeRight:
1. Trains better AI models
2. Builds user reputation
3. Creates data no one else has
4. Strengthens network effects

This is the full stack prediction infrastructure.

---

## Development Log

### 2026-02-08: Phase 0 - Frontend/Backend Integration

**Completed:**

1. **Created API Client** (`src/lib/api.ts`)
   - Full API client connecting to beright-ts backend
   - Endpoints: markets, leaderboard, predictions, brief
   - Automatic data transformation from API format to frontend format
   - AI prediction generation for display
   - Error handling with mock data fallback

2. **Created React Hooks** (`src/hooks/useMarkets.ts`)
   - `useBackendStatus()` - Real-time connection monitoring
   - `useMarkets()` - Fetch hot/search markets with auto-fallback
   - `useLeaderboard()` - Leaderboard with live data
   - `useBrief()` - Morning briefing
   - `useUserPredictions()` - User prediction tracking

3. **Updated Home Page** (`src/app/page.tsx`)
   - Live connection status indicator (green/yellow/red)
   - Real-time market data from 5 platforms
   - Loading states with platform list
   - Retry functionality
   - Graceful fallback to mock data

4. **Updated Leaderboard** (`src/app/leaderboard/page.tsx`)
   - Live rankings from backend
   - Brier score display
   - Connection status indicator
   - Demo data fallback

5. **Environment Config**
   - `.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:3001`
   - beright-ts configured to run on port 3001

**Files Created/Modified:**
```
berightweb/
├── src/
│   ├── lib/
│   │   ├── api.ts          # NEW - API client
│   │   └── types.ts        # UPDATED - Extended types
│   ├── hooks/
│   │   └── useMarkets.ts   # NEW - React data hooks
│   ├── app/
│   │   ├── page.tsx        # UPDATED - Live data
│   │   └── leaderboard/
│   │       └── page.tsx    # UPDATED - Live data
│   └── components/
│       └── CardStack.tsx   # UPDATED - Dynamic updates
├── .env.local              # NEW - API config

beright-ts/
└── package.json            # UPDATED - Port 3001
```

**To Run:**
```bash
# Terminal 1: Start backend
cd beright-ts
npm run dev
# Runs on http://localhost:3001

# Terminal 2: Start frontend
cd berightweb
npm run dev
# Runs on http://localhost:3000
```

**Status:** Both projects build successfully. Ready for testing.

---

### 2026-02-08: Phase 1 - Market Explorer

**Completed:**

1. **Market Explorer Page** (`src/app/markets/page.tsx`)
   - Browse all 5 platforms (Polymarket, Kalshi, Manifold, Limitless, Metaculus)
   - Real-time search with debouncing
   - Platform filter pills
   - Volume sorting
   - Market cards with odds visualization
   - Direct links to trading platforms

2. **Updated Bottom Navigation**
   - Added Markets tab with Globe icon
   - 5-item navigation: Home, Markets, Ranks, Stats, Profile

**Files Created:**
```
berightweb/src/app/markets/page.tsx    # NEW - Market explorer
berightweb/src/components/BottomNav.tsx # UPDATED - Added Markets
```

---

### 2026-02-08: Phase 2 - Intelligence Layer

**Completed:**

1. **Consensus View Component** (`src/components/ConsensusView.tsx`)
   - Market + AI + Top Forecasters consensus display
   - Confidence level indicators (High/Medium/Low)
   - AI sentiment analysis (Bullish/Bearish/Aligned)
   - Platform breakdown view
   - Animated progress bars

2. **Enhanced AI Debate Modal**
   - Added Consensus Mini View section
   - Shows Market, AI, and Top Forecaster predictions
   - Visual breakdown in modal

3. **Updated Stats Page**
   - Connected to API for live data
   - Added pending predictions tracker
   - Connection status indicator
   - Fallback to mock data when offline

**Files Created/Modified:**
```
berightweb/src/components/ConsensusView.tsx  # NEW - Consensus component
berightweb/src/components/AIDebateModal.tsx  # UPDATED - Added consensus
berightweb/src/app/stats/page.tsx            # UPDATED - Live data
```

---

### 2026-02-08: Phase 4 - Distribution (Embed Widget)

**Completed:**

1. **Embed Widget Component** (`src/components/EmbedWidget.tsx`)
   - Standalone embeddable prediction widget
   - Dark/Light theme support
   - Compact and full modes
   - Consensus breakdown display
   - "Powered by BeRight" attribution
   - Trade CTA linking to source platform

2. **Embed Page** (`src/app/embed/page.tsx`)
   - Serves iframe content for external embeds
   - URL parameter configuration
   - Suspense boundary for loading

3. **Embed Demo Page** (`src/app/embed/demo/page.tsx`)
   - Publisher-facing configuration tool
   - Live preview with real-time updates
   - Theme, AI, and compact mode toggles
   - Copy-to-clipboard embed code
   - Use case examples
   - Revenue share CTA

**Files Created:**
```
berightweb/src/components/EmbedWidget.tsx     # NEW - Embeddable widget
berightweb/src/app/embed/page.tsx             # NEW - Iframe content
berightweb/src/app/embed/demo/page.tsx        # NEW - Publisher demo
```

**Embed Usage:**
```html
<!-- Basic embed -->
<iframe
  src="https://beright.xyz/embed?id=btc-150k"
  width="400"
  height="320"
  frameborder="0"
></iframe>

<!-- Compact embed -->
<iframe
  src="https://beright.xyz/embed?id=btc-150k&compact=true"
  width="400"
  height="80"
  frameborder="0"
></iframe>

<!-- Light theme, no AI -->
<iframe
  src="https://beright.xyz/embed?id=btc-150k&theme=light&ai=false"
  width="400"
  height="320"
  frameborder="0"
></iframe>
```

---

## Current Build Status

```
Route (app)
├ ○ /              # Home - Swipe predictions
├ ○ /markets       # Market Explorer
├ ○ /leaderboard   # Rankings
├ ○ /stats         # User Statistics
├ ○ /profile       # User Profile
├ ○ /embed         # Iframe content
└ ○ /embed/demo    # Publisher demo
```

**All routes build successfully.**

---

## What's Been Built (Summary)

### Phase 0: Foundation ✅
- [x] API client connecting to beright-ts
- [x] React hooks for data fetching
- [x] Backend status monitoring
- [x] Graceful fallback to mock data

### Phase 1: Aggregator ✅
- [x] Market Explorer with 5-platform search
- [x] Platform filtering
- [x] Volume-based sorting
- [x] Real-time market data

### Phase 2: Intelligence ✅
- [x] Consensus View component
- [x] AI sentiment analysis
- [x] Confidence indicators
- [x] Stats page with live data

### Phase 4: Distribution ✅
- [x] Embeddable widget component
- [x] Iframe embed page
- [x] Publisher demo/configuration
- [x] Dark/Light themes
- [x] Compact mode

---

---

### 2026-02-08: Privy Wallet Integration & User Identity Sync

**Completed:**

1. **Privy Authentication Provider** (`src/providers/PrivyProvider.tsx`)
   - Wallet-first authentication flow
   - Email and SMS login support
   - Embedded wallet creation for new users
   - Dark theme matching app design

2. **User Context** (`src/context/UserContext.tsx`)
   - Global user state management
   - Wallet address tracking
   - Profile fetch/create on auth
   - Telegram account linking
   - Automatic profile refresh

3. **Updated Profile Page** (`src/app/profile/page.tsx`)
   - Connect/Disconnect wallet UI
   - Copy wallet address functionality
   - Telegram linking modal
   - Dynamic achievements based on user data
   - Link to public profile page

4. **Forecaster Profile Pages** (`src/app/forecaster/[address]/page.tsx`)
   - Public profile view by wallet address
   - Stats display (accuracy, Brier, streak, vs AI)
   - Category breakdown with accuracy per category
   - Recent predictions list
   - Follow/Share buttons
   - Mock data generation for unknown addresses

5. **Backend User APIs** (beright-ts)
   - `/api/users/profile` - Get/create profile for web auth
   - `/api/users/link-telegram` - Link Telegram to web account
   - `/api/users/[address]` - Public profile by wallet address
   - Local file storage fallback when no Supabase
   - Proper Brier score and accuracy calculation

6. **Calibration Skill Update**
   - Added `calculateStreak()` export function
   - Used by user profile APIs

**Files Created/Modified:**
```
berightweb/
├── src/
│   ├── providers/
│   │   └── PrivyProvider.tsx      # NEW - Privy auth wrapper
│   ├── context/
│   │   └── UserContext.tsx        # NEW - User state management
│   ├── app/
│   │   ├── layout.tsx             # UPDATED - Wrapped with providers
│   │   ├── providers.tsx          # NEW - Combined providers
│   │   ├── profile/page.tsx       # UPDATED - Privy integration
│   │   └── forecaster/
│   │       └── [address]/page.tsx # NEW - Public profiles
├── .env.local                     # UPDATED - Added Privy config

beright-ts/
├── app/api/users/
│   ├── profile/route.ts           # NEW - Profile API
│   ├── link-telegram/route.ts     # NEW - Telegram linking
│   └── [address]/route.ts         # NEW - Public profile
├── skills/calibration.ts          # UPDATED - Added calculateStreak
```

**Environment Variables:**
```env
# berightweb/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_PRIVY_APP_ID=***REMOVED***
PRIVY_APP_SECRET=<secret>
```

**User Identity Flow:**
```
Web User                    Backend                  Telegram Bot
    │                          │                          │
    ├─ Connect Wallet ────────▶│                          │
    │  (Privy)                 │                          │
    │                          ├─ Create/Get Profile      │
    │                          │                          │
    │◀─ Profile Data ──────────┤                          │
    │                          │                          │
    ├─ Link Telegram ─────────▶│                          │
    │  (enter @username)       │                          │
    │                          ├─ Store Link ────────────▶│
    │                          │                          │
    │                          │◀─ Verify & Sync ─────────┤
    │                          │                          │
    │◀─ "Telegram Linked" ─────┤                          │
    │                          │                          │
  Same user, unified predictions across both platforms
```

---

## Current Build Status

```
Route (app)
├ ○ /                      # Home - Swipe predictions
├ ○ /markets               # Market Explorer
├ ○ /leaderboard           # Rankings
├ ○ /stats                 # User Statistics
├ ○ /profile               # User Profile (with Privy)
├ ƒ /forecaster/[address]  # Public Forecaster Profiles
├ ○ /embed                 # Iframe content
└ ○ /embed/demo            # Publisher demo
```

**All routes build successfully.**

---

## What's Been Built (Summary)

### Phase 0: Foundation ✅
- [x] API client connecting to beright-ts
- [x] React hooks for data fetching
- [x] Backend status monitoring
- [x] Graceful fallback to mock data

### Phase 1: Aggregator ✅
- [x] Market Explorer with 5-platform search
- [x] Platform filtering
- [x] Volume-based sorting
- [x] Real-time market data

### Phase 2: Intelligence ✅
- [x] Consensus View component
- [x] AI sentiment analysis
- [x] Confidence indicators
- [x] Stats page with live data

### Phase 3: Social Layer ✅
- [x] Wallet connect (Privy)
- [x] User context with global state
- [x] Forecaster profile pages
- [x] Public prediction history (mock for now)
- [x] Follow/share buttons (UI ready)
- [x] Telegram account linking
- [x] Backend user sync APIs

### Phase 4: Distribution ✅
- [x] Embeddable widget component
- [x] Iframe embed page
- [x] Publisher demo/configuration
- [x] Dark/Light themes
- [x] Compact mode

---

## Remaining Features (Phase 5+)

### Social Layer Enhancements
- [ ] Real follow/copy trading backend
- [ ] Signal subscription payments
- [ ] Real-time notifications
- [ ] Copy trade execution

### Infrastructure
- [ ] Telegram bot deployment
- [ ] Supabase database migration
- [ ] Real-time price updates (SSE)
- [ ] Mobile PWA optimization
- [ ] Production deployment

### Autonomous Agents
- [ ] User-configurable agents
- [ ] Arb execution agent
- [ ] Signal generation agent
- [ ] Resolution tracking agent
