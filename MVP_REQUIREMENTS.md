# BeRight Protocol - MVP Requirements

## What is MVP?

Minimum Viable Product for hackathon demo: **Show autonomous AI agent making predictions on-chain.**

---

## Core MVP Features

### 1. Market Aggregation
**Status: DONE**

| Platform | API | Status |
|----------|-----|--------|
| Polymarket | `gamma-api.polymarket.com` | Working |
| Kalshi/DFlow | `dev-prediction-markets-api.dflow.net` | Working |
| Manifold | `api.manifold.markets` | Working |
| Limitless | `api.limitless.exchange` | Working |
| Metaculus | `metaculus.com/api2` | Working |

**Files:**
- `beright-ts/skills/markets.ts`
- `beright-ts/skills/metaculus.ts`

---

### 2. Telegram Bot
**Status: 95% DONE (needs bot token deployment)**

**Must-Have Commands:**
| Command | Purpose | Status |
|---------|---------|--------|
| `/start` | Onboarding | Done |
| `/predict` | Make prediction | Done |
| `/research` | AI analysis | Done |
| `/arb` | Arbitrage finder | Done |
| `/calibration` | Brier score | Done |
| `/leaderboard` | Rankings | Done |
| `/brief` | Daily summary | Done |

**Files:**
- `beright-ts/skills/telegramHandler.ts` (1600+ lines, 30+ commands)

---

### 3. On-Chain Verification
**Status: 50% DONE (module exists, needs wiring)**

**Required:**
- [ ] `/predict` command commits to Solana
- [ ] TX signature stored in database
- [ ] Verifiable on Solscan

**Format:**
```
BERIGHT:PREDICT:v1|pubkey|market|prob|dir|ts|hash
```

**Files:**
- `beright-ts/lib/onchain/memo.ts`
- `beright-ts/lib/onchain/commit.ts`
- `beright-ts/lib/onchain/verify.ts`

---

### 4. Autonomous Operation
**Status: DONE**

**Heartbeat Loop (every 5 min):**
1. Scan markets for changes
2. Check arbitrage opportunities
3. Monitor whale wallets
4. Send alerts if thresholds met

**Files:**
- `beright-ts/skills/heartbeat.ts`

---

### 5. Multi-Agent Architecture
**Status: 90% DONE (config fixed, testing needed)**

**Agent Routing:**
```typescript
// Fast tasks → Sonnet (cheap)
scout: markets, arb, news, whale

// Deep tasks → Opus (quality)
analyst: research, calibration, base rates

// Execution → Sonnet (safe)
trader: swap, buy, quotes
```

**Files:**
- `beright-ts/lib/agentSpawner.ts`
- `beright-ts/config/agents.ts`

---

### 6. Database Storage
**Status: 60% DONE (Supabase configured, needs wiring)**

**Required Tables:**
| Table | Purpose | Status |
|-------|---------|--------|
| `users` | Wallet, Telegram ID | Configured |
| `predictions` | Question, prob, outcome | Configured |
| `leaderboard_view` | Computed Brier | Configured |

**Fallback:** JSON files in `beright-ts/memory/`

**Files:**
- `beright-ts/lib/supabase/client.ts`
- `beright-ts/lib/supabase/types.ts`

---

### 7. Web Dashboard
**Status: 60% DONE (core pages built)**

**Required Pages:**
| Page | Purpose | Status |
|------|---------|--------|
| `/` | Swipe predictions | Built |
| `/markets` | Market explorer | Built |
| `/leaderboard` | Top forecasters | Built |
| `/stats` | User calibration | Built |
| `/profile` | Wallet connect | Built |

**Files:**
- `berightweb/src/app/` (all pages)
- `berightweb/src/components/` (UI components)

---

## MVP Checklist

### Critical (Must Complete)
- [x] 5-platform market aggregation
- [x] 30+ Telegram commands
- [x] Autonomous heartbeat loop
- [x] Superforecaster research skill
- [x] Arbitrage detection
- [x] Whale tracking (Helius)
- [x] Brier score calibration
- [ ] On-chain prediction commits
- [ ] Supabase storage wiring
- [ ] Demo video recording

### Important (Should Complete)
- [x] Multi-agent config fixed
- [ ] Multi-agent spawn testing
- [ ] Telegram bot deployment
- [ ] Web UI polish
- [ ] Resolution automation

### Nice-to-Have
- [ ] Privy wallet integration
- [ ] Social sharing
- [ ] Achievement badges

---

## Progress Summary

```
BACKEND      [====================] 100%
TELEGRAM     [=================== ]  95%
ON-CHAIN     [==========          ]  50%
DATABASE     [============        ]  60%
WEB UI       [============        ]  60%
MULTI-AGENT  [==================  ]  90%
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js, TypeScript, Next.js API |
| Frontend | Next.js 16, React 19, Tailwind 4 |
| AI | Claude (Sonnet 4.5 + Opus 4.5) |
| Auth | Privy (wallet-first) |
| Database | Supabase (PostgreSQL) |
| Blockchain | Solana (Memo Program) |
| RPC | Helius |
| Swaps | Jupiter V6 |

---

## Key Dependencies

```json
// beright-ts
"@solana/web3.js": "^1.98.0"
"@supabase/supabase-js": "^2.47.10"
"typescript": "^5.7"

// berightweb
"next": "^16.0.0"
"react": "^19.0.0"
"@privy-io/react-auth": "latest"
```

---

## Environment Variables

### Backend (beright-ts/.env)
```
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
HELIUS_API_KEY=<required>
SUPABASE_URL=<required>
SUPABASE_ANON_KEY=<required>
TELEGRAM_BOT_TOKEN=<required for deployment>
```

### Frontend (berightweb/.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=<required>
NEXT_PUBLIC_PRIVY_APP_ID=<required>
```
