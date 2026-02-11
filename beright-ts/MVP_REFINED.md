# BeRight MVP - Refined Plan

> **Goal:** Build the daily prediction intelligence platform that people ACTUALLY use
> **Timeline:** 7 days to demo-ready MVP
> **Deadline:** February 12, 2026

---

## The Core Loop We're Building

```
┌─────────────────────────────────────────────────────────────┐
│                    DAILY USER JOURNEY                        │
│                                                              │
│  8am: Morning Brief arrives → User opens Telegram/Web        │
│           ↓                                                  │
│  User sees hot markets, makes predictions                    │
│           ↓                                                  │
│  Alpha alert: "Arb detected!" → User investigates            │
│           ↓                                                  │
│  Evening: "You're up 2 correct today, streak: 5 🔥"          │
│           ↓                                                  │
│  User checks leaderboard → "I'm #127, beating 94%!"          │
│           ↓                                                  │
│  REPEAT TOMORROW                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## What We Already Have ✅

| Skill | Status | Quality |
|-------|--------|---------|
| `markets.ts` | ✅ Working | Cross-platform odds (Poly/Kalshi/Manifold) |
| `arbitrage.ts` | ✅ Working | Arb detection |
| `research.ts` | ✅ Working | Superforecaster analysis |
| `whale.ts` | ✅ Working | Wallet tracking |
| `intel.ts` | ✅ Working | News + Reddit sentiment |
| `swap.ts` | ✅ Working | Jupiter quotes |
| `calibration.ts` | ✅ Working | Brier score tracking |

**We have the engine. Now we need the experience.**

---

## MVP Features (Prioritized)

### 🔴 MUST HAVE (Days 1-4)

| # | Feature | Why Critical | Time |
|---|---------|--------------|------|
| 1 | **Morning Brief Generator** | The HOOK that starts daily usage | 4h |
| 2 | **Telegram Bot Core** | Primary interface | 6h |
| 3 | **Prediction Tracking API** | Core gamification | 4h |
| 4 | **Web Dashboard (Home)** | Visual wow factor | 8h |
| 5 | **Leaderboard** | Competition drives retention | 4h |
| 6 | **User Auth (Wallet)** | Identity for tracking | 4h |

### 🟡 SHOULD HAVE (Days 5-6)

| # | Feature | Why Important | Time |
|---|---------|---------------|------|
| 7 | **Alpha Alerts** | Real-time value | 4h |
| 8 | **Streaks + Achievements** | Gamification | 3h |
| 9 | **Markets Explorer Page** | Discovery | 4h |
| 10 | **Portfolio Tracker** | Utility | 4h |

### 🟢 NICE TO HAVE (Day 7)

| # | Feature | Why | Time |
|---|---------|-----|------|
| 11 | **Social Sharing** | Viral loop | 2h |
| 12 | **Research Page** | Deep dives | 3h |
| 13 | **Copy Trading Signals** | Advanced feature | 4h |

---

## Day-by-Day Build Plan

### DAY 1: Foundation + Morning Brief
**Focus:** The hook that gets users in the door

#### Tasks
- [ ] **1.1** Create `skills/brief.ts` - Morning brief generator
  - Aggregate overnight market movements
  - Top 3 hot markets
  - Any arb opportunities
  - Whale activity summary
  - Format for Telegram + Web

- [ ] **1.2** Set up database schema (Postgres/Supabase)
  ```sql
  users (id, wallet, telegram_id, created_at)
  predictions (id, user_id, question, probability, direction, created_at, resolved_at, outcome, brier_score)
  alerts (id, user_id, market_id, condition, triggered)
  ```

- [ ] **1.3** Create API routes structure
  ```
  /api/brief          GET  - Get today's brief
  /api/markets        GET  - List markets
  /api/predictions    POST - Create prediction
  /api/predictions    GET  - User's predictions
  /api/leaderboard    GET  - Top forecasters
  ```

#### Deliverable
```
Morning brief working:
"🌅 BERIGHT MORNING BRIEF - Feb 5, 2026

🔥 HOT MARKETS
1. Fed Rate Cut March: 67% (+12% overnight)
2. Trump Approval >50%: 34% (-5%)
3. BTC >$150K 2026: 45% (stable)

🚨 ALPHA ALERT
8% spread on "Fed Rate Cut" - Poly 67% vs Kalshi 59%

🐋 WHALE WATCH
@smartmoney bought $50K YES on Trump popular vote

📊 YOUR STATS
Streak: 5 days 🔥 | Pending: 3 | Rank: #127

Make a prediction: /predict <question> <probability> YES|NO"
```

---

### DAY 2: Telegram Bot
**Focus:** Primary interface that users interact with

#### Tasks
- [ ] **2.1** Set up Telegram bot with BotFather
  - Bot name: @BeRightBot
  - Commands registered

- [ ] **2.2** Implement core commands
  ```
  /start      → Welcome + onboarding
  /brief      → Morning brief
  /hot        → Top 5 trending markets
  /predict    → Make a prediction
  /me         → Your stats
  /leaderboard → Top 10 forecasters
  ```

- [ ] **2.3** Connect to skills
  - `/brief` → `brief.ts`
  - `/hot` → `markets.ts` (getHotMarkets)
  - `/predict` → `calibration.ts` (addPrediction)
  - `/research` → `research.ts`

- [ ] **2.4** Add inline keyboards for easy interaction
  ```
  [Make Prediction] [View Markets] [My Stats]
  ```

#### Deliverable
```
Telegram bot responding to all core commands
Users can make predictions directly in chat
```

---

### DAY 3: Web Dashboard (Home Page)
**Focus:** Visual experience that wows

#### Tasks
- [ ] **3.1** Set up Next.js app structure
  ```
  /app
    /page.tsx           → Dashboard home
    /markets/page.tsx   → Markets explorer
    /leaderboard/page.tsx
    /research/[topic]/page.tsx
    /api/...
  ```

- [ ] **3.2** Build Dashboard Home components
  - `<UserStats />` - Brier score, accuracy, streak, rank
  - `<HotMarkets />` - Top 5 trending
  - `<AlphaAlerts />` - Arb + whale alerts
  - `<RecentPredictions />` - User's last 5

- [ ] **3.3** Implement wallet connect (Privy or RainbowKit)
  - Connect Solana wallet
  - Create/link user account

- [ ] **3.4** Style with Tailwind (dark mode, clean UI)

#### Deliverable
```
Dashboard showing:
- User's stats prominently
- Hot markets at a glance
- Alpha alerts
- Quick prediction button
```

---

### DAY 4: Prediction System + Leaderboard
**Focus:** The gamification core

#### Tasks
- [ ] **4.1** Build prediction flow (Web)
  - Search/select market
  - Set probability + direction
  - Add reasoning (optional)
  - Submit → stored in DB

- [ ] **4.2** Build prediction flow (Telegram)
  - `/predict "Will X happen?" 70 YES`
  - Confirmation message
  - Stored in DB

- [ ] **4.3** Implement auto-resolution
  - Cron job checks resolved markets
  - Updates predictions with outcomes
  - Calculates Brier scores

- [ ] **4.4** Build Leaderboard
  - Aggregate user stats
  - Rank by Brier score (lower = better)
  - Show top 100
  - Highlight user's position

#### Deliverable
```
Leaderboard page:
🏆 BERIGHT LEADERBOARD

#1  @superforecaster  Brier: 0.12  Acc: 78%  n=234
#2  @polymarketpro    Brier: 0.14  Acc: 75%  n=189
...
#127 @you             Brier: 0.18  Acc: 72%  n=47 ← YOU
```

---

### DAY 5: Alpha Alerts + Notifications
**Focus:** Real-time value delivery

#### Tasks
- [ ] **5.1** Build alert system
  - Arb alerts (>5% spread detected)
  - Whale alerts (>$50K moves)
  - Price alerts (user-set thresholds)
  - Resolution alerts (your prediction resolved)

- [ ] **5.2** Implement push notifications
  - Telegram: Send message to user
  - Web: Browser notifications (if permitted)

- [ ] **5.3** Create `/alert` command
  - `/alert "Fed Rate Cut" 70` → Notify when hits 70%
  - Store in DB, check periodically

- [ ] **5.4** Build cron job for scheduled tasks
  - 8am: Send morning brief to all subscribers
  - Every 5min: Check for arb opportunities
  - Every 15min: Check whale activity
  - Hourly: Check price alerts

#### Deliverable
```
User receives in Telegram:
"🚨 ALPHA ALERT
8% arb detected on "Fed Rate Cut March"
Polymarket: 67% | Kalshi: 59%
[View Details] [Dismiss]"
```

---

### DAY 6: Streaks, Achievements, Markets Page
**Focus:** Retention mechanics

#### Tasks
- [ ] **6.1** Implement streak tracking
  - Track daily prediction activity
  - Show streak in `/me` and dashboard
  - Send streak warning at 8pm if no prediction

- [ ] **6.2** Build achievement system
  ```
  achievements:
    - first_prediction: "Baby Forecaster"
    - streak_7: "Week Warrior"
    - streak_30: "Consistent"
    - accuracy_70: "Sharp Shooter"
    - brier_under_20: "Calibrated"
    - brier_under_15: "Superforecaster"
    - top_10_percent: "Elite"
  ```

- [ ] **6.3** Build Markets Explorer page
  - List all markets across platforms
  - Filter by category (Politics, Crypto, Sports)
  - Sort by volume, movement, ending soon
  - Show cross-platform odds comparison

- [ ] **6.4** Add "Quick Predict" from markets page
  - Click market → Modal to make prediction
  - Pre-filled with current odds

#### Deliverable
```
Markets page with filters + sorting
User profile showing achievements
Streak counter prominent in UI
```

---

### DAY 7: Polish + Demo Prep
**Focus:** Make it demo-ready

#### Tasks
- [ ] **7.1** UI polish
  - Consistent styling
  - Loading states
  - Error handling
  - Mobile responsive

- [ ] **7.2** Add social sharing
  - Share prediction to Twitter
  - Share profile/stats
  - Referral tracking

- [ ] **7.3** Create demo flow
  - Record video walkthrough
  - Show 24h autonomous operation
  - Highlight key features

- [ ] **7.4** Write documentation
  - README with setup instructions
  - API documentation
  - Feature overview

- [ ] **7.5** Deploy
  - Web app on Vercel
  - Telegram bot running
  - Database live

#### Deliverable
```
Complete MVP:
✅ Morning briefs automated
✅ Telegram bot live
✅ Web dashboard deployed
✅ Predictions tracked
✅ Leaderboard working
✅ Alerts firing
✅ Demo video recorded
```

---

## Success Metrics for MVP

| Metric | Target |
|--------|--------|
| Morning brief sends | Daily at 8am |
| Telegram commands | All 6 core commands working |
| Web pages | Home, Markets, Leaderboard live |
| Predictions tracked | System storing + resolving |
| Leaderboard | Calculating + displaying |
| Alerts | Arb + whale alerts firing |
| Demo video | 3-5 minutes showcasing all |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14, Tailwind, shadcn/ui |
| **Backend** | Next.js API routes |
| **Database** | Supabase (Postgres) |
| **Auth** | Privy (wallet connect) |
| **Bot** | node-telegram-bot-api |
| **Cron** | Vercel Cron or node-cron |
| **Hosting** | Vercel |
| **Blockchain** | Solana (via Helius) |

---

## File Structure

```
beright-ts/
├── app/                      # Next.js app
│   ├── page.tsx              # Dashboard home
│   ├── markets/page.tsx      # Markets explorer
│   ├── leaderboard/page.tsx  # Leaderboard
│   ├── research/[topic]/page.tsx
│   ├── api/
│   │   ├── brief/route.ts
│   │   ├── markets/route.ts
│   │   ├── predictions/route.ts
│   │   ├── leaderboard/route.ts
│   │   └── alerts/route.ts
│   └── components/
│       ├── UserStats.tsx
│       ├── HotMarkets.tsx
│       ├── AlphaAlerts.tsx
│       ├── PredictionCard.tsx
│       └── Leaderboard.tsx
├── skills/                   # Existing skills
│   ├── markets.ts           ✅
│   ├── arbitrage.ts         ✅
│   ├── research.ts          ✅
│   ├── whale.ts             ✅
│   ├── calibration.ts       ✅
│   ├── swap.ts              ✅
│   ├── brief.ts             🔨 NEW
│   └── telegram.ts          🔨 NEW
├── lib/
│   ├── db.ts                # Database client
│   ├── auth.ts              # Auth helpers
│   └── notifications.ts     # Push notifications
└── cron/
    ├── morning-brief.ts     # 8am daily
    ├── arb-scanner.ts       # Every 5min
    └── resolution.ts        # Hourly
```

---

## Daily Standup Template

```
DATE: ___________

YESTERDAY:
- Completed: ___________
- Blockers: ___________

TODAY:
- Focus: Day ___ tasks
- Priority 1: ___________
- Priority 2: ___________

BLOCKERS:
- ___________

PROGRESS: [████████░░] 80%
```

---

## Launch Checklist

### Before Demo
- [ ] Morning brief sends automatically
- [ ] Telegram bot responds to all commands
- [ ] Web dashboard loads fast
- [ ] Predictions save correctly
- [ ] Leaderboard updates
- [ ] At least 1 alert has fired
- [ ] 24h autonomous run completed
- [ ] Demo video recorded

### Submission
- [ ] GitHub repo clean
- [ ] README complete
- [ ] Demo video uploaded
- [ ] Hackathon form submitted
- [ ] Social posts ready

---

*"Ship fast, iterate faster. The best MVP is the one that exists."*
