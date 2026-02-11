# BeRight Protocol - Winning Strategy & Architecture

## The Core Differentiator

**BeRight runs 24/7 without human prompts.** No competitor does this.

---

## Architecture Overview

```
                    ┌─────────────────────────────────────┐
                    │         OPENCLAW CRON               │
                    │    (Every 5 minutes, autonomous)    │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │         BERIGHT-TS (Backend)        │
                    │      Claude Opus 4.5 Orchestrator   │
                    └─────────────────┬───────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
    ┌─────▼─────┐              ┌──────▼──────┐             ┌──────▼──────┐
    │   SCOUT   │              │   ANALYST   │             │   TRADER    │
    │  (Sonnet) │              │   (Opus)    │             │  (Sonnet)   │
    │   Fast    │              │    Deep     │             │    Safe     │
    └─────┬─────┘              └──────┬──────┘             └──────┬──────┘
          │                           │                           │
          └───────────────────────────┼───────────────────────────┘
                                      │
    ┌─────────────────────────────────┼─────────────────────────────────┐
    │                                 │                                 │
    ▼                                 ▼                                 ▼
┌────────────┐                ┌──────────────┐                ┌─────────────┐
│  TELEGRAM  │                │   WEB (UI)   │                │   SOLANA    │
│    BOT     │                │  Next.js 16  │                │  ON-CHAIN   │
│  30+ cmds  │                │  React 19    │                │   VERIFY    │
└────────────┘                └──────────────┘                └─────────────┘
```

---

## Why We Win

### 1. Scheduled Autonomy (UNIQUE)
- Heartbeat runs every 5 minutes via OpenClaw cron
- Scans markets, detects arbitrage, alerts users
- **No other competitor has 24/7 autonomous operation**

### 2. Multi-Agent Architecture
| Agent | Model | Purpose | Cost |
|-------|-------|---------|------|
| Scout | Sonnet | Fast scans, news, arbitrage | Cheap |
| Analyst | Opus | Deep research, base rates | Quality |
| Trader | Sonnet | Execution, quotes | Safe |

**80% of queries use cheaper Sonnet = cost optimized**

### 3. Superforecaster Methodology
- Tetlock's calibration framework (scientific)
- Brier score tracking (0 = perfect, 0.25 = random)
- Base rate analysis before every prediction
- **No competitor does scientific forecasting**

### 4. On-Chain Verification
```
BERIGHT:PREDICT:v1|pubkey|market|prob|dir|ts|hash
```
- Every prediction committed to Solana Memo Program
- Verifiable on Solscan
- Gaming-resistant leaderboard
- Cost: ~$0.00075 per prediction

### 5. Five Platform Integration
- Polymarket (largest)
- Kalshi/DFlow (regulated)
- Manifold (play money)
- Limitless (crypto-native)
- Metaculus (forecasting community)

**Cross-platform arbitrage = unique opportunity detection**

---

## Web + Telegram Architecture

### Telegram (Primary Interface)
```
/start         → Onboarding
/predict       → Make prediction (commits on-chain)
/research      → Deep analysis with base rates
/arb           → Arbitrage opportunities
/whale         → Track big wallets
/calibration   → Your Brier score
/leaderboard   → Top forecasters
/brief         → Morning market summary
```

**30+ commands implemented**

### Web (Visual Dashboard)
```
Home           → Swipe predictions (Tinder-style)
Markets        → 5-platform explorer
Leaderboard    → Forecaster rankings
Stats          → Your calibration metrics
Profile        → Wallet + Telegram link
```

**Privy wallet auth (web3-native)**

---

## Data Flow

```
User Input
    │
    ▼
Telegram / Web
    │
    ▼
beright-ts API (7 endpoints)
    │
    ├── /markets      → 5-platform aggregation
    ├── /research     → AI analysis
    ├── /arbitrage    → Cross-platform spreads
    ├── /whale        → Helius wallet tracking
    ├── /predictions  → User history
    ├── /leaderboard  → Rankings
    └── /brief        → Daily summary
    │
    ▼
┌────────────────────────┐
│   DUAL STORAGE         │
│   Supabase (SQL)       │
│   + Solana (verify)    │
└────────────────────────┘
```

---

## Competitive Position

| Feature | BeRight | Clodds | Predly | SOLPRISM |
|---------|---------|--------|--------|----------|
| 24/7 Autonomous | YES | NO | NO | NO |
| Multi-Agent | YES | NO | NO | NO |
| Brier Scores | YES | NO | NO | NO |
| On-Chain | YES | NO | NO | YES |
| 5 Platforms | YES | 2 | 1 | 1 |

**We have everything. They have pieces.**

---

## Target Award: "Most Agentic" ($5,000)

Why we qualify:
1. Runs without human prompts (cron-based)
2. Multi-agent delegation (scout/analyst/trader)
3. Autonomous decision-making engine
4. Self-healing with fallback mechanisms

**Strong position for Top 3 ($15K-$50K)**

---

## Key Files

| Component | Path |
|-----------|------|
| Orchestrator | `beright-ts/skills/telegramHandler.ts` |
| Multi-Agent | `beright-ts/lib/agentSpawner.ts` |
| Heartbeat | `beright-ts/skills/heartbeat.ts` |
| On-Chain | `beright-ts/lib/onchain/` |
| API Routes | `beright-ts/app/api/` |
| Web UI | `berightweb/src/app/` |
