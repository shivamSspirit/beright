# BeRight Protocol - Claude Code Instructions

## Overview
Prediction market intelligence platform with Telegram bot, arbitrage monitoring, and AI forecasting.

---

## Core Philosophy

> **AI replaces work, not just assists. Users feel smart without manual effort.**

| Anti-Pattern | BeRight Way |
|--------------|-------------|
| Show data for analysis | Deliver actionable insights |
| List opportunities | Find, evaluate, execute |
| Manual alerts | Proactive notifications |
| Raw research | Synthesized conclusions |

**10x Test**: Does this make users 10x more effective? Can they get value passively? Do they feel like they have a team?

---

## Vision: Bloomberg Terminal for AI-Native Traders

**Flywheel**: Forecasters build Brier-scored reputation → Delegators stake on top callers → 80/20 profit split (skill/capital) → 20% platform fee

| Phase | Focus |
|-------|-------|
| V1 | Telegram Bot - AI signals, Brier tracking |
| V2 | Dashboard - Alpha feeds, delegation UI |
| V3 | Protocol - On-chain PDAs, cross-platform rep |

**Build Priorities**:
1. Track/display Brier scores (portable reputation)
2. AI delivers alpha (users don't research)
3. Make staking as easy as following
4. Screenshot-worthy, shareable outputs
5. Architecture supports real stakes

---

## Development Workflow

### Spec-First (70% Less Rework)
```
1. "Write a spec for [feature]"
2. Review together
3. "Go build it"
```

Spec covers: behavior, technical approach, edge cases, testing, out of scope.

### Commit Habits
- Commit after every working milestone
- Format: `feat:`, `fix:`, `refactor:` with WHY
- Never batch features

### Session Hygiene
**Start**: Read CURRENT_TASK.md, check git status, run tests
**End**: Commit, update CURRENT_TASK.md, note blockers

### Context Management
Use `/compact` for long sessions. Track progress in CURRENT_TASK.md:
```markdown
## Current Task | ## Progress | ## Decisions | ## Files Modified | ## Blockers
```

---

## OpenClaw Architecture

### Core Files
| File | Purpose |
|------|---------|
| SOUL.md | Personality, voice, values |
| HEARTBEAT.md | Dynamic status, goals (auto-updated) |
| MEMORY.md | Lessons, episodic memory |

### Message Flow
```
Telegram → telegramHandler → semanticAgent (Groq) → Scout/Analyst/Trader → Response
```

### Two-Tier Pattern
```
Tier 1 (fast, free): Fetch data, calculate, aggregate
Tier 2 (LLM): Synthesize, reason, estimate probabilities
```
**Rule**: Always Tier 1 first. LLM only when reasoning needed.

### Agent Routing
| Agent | When |
|-------|------|
| Scout | Quick scans, trends, arb detection |
| Analyst | Deep research, probability, synthesis |
| Trader | Execution, risk, position sizing |

### Cognitive Loop (every 30 min)
PERCEIVE → UPDATE BELIEFS → DELIBERATE → ACT → REFLECT

### Common Issues
| Problem | Fix |
|---------|-----|
| "Didn't catch that" for everything | Check GROQ_API_KEY in .env |
| PM2 ignores new env vars | `pm2 restart <app> --update-env` |
| No synthesis, just raw data | Ensure Tier 2 synthesizeResearch() called |
| Working memory lost | 30 min TTL - check cognitiveMemory.ts |

---

## Viral Product Principles (Nikita Bier)

- Reproducible testing > any single idea
- Narrow audience is fine (obsessive traders = ideal)
- Core needs: love, money, play → BeRight = money
- Can they use it from the toilet? Keep it simple
- 7 new opens per session = escape velocity
- Build shareable outputs

**Feature Checklist**:
- [ ] Test in one community first
- [ ] Helps make/save money
- [ ] Creates feedback loop
- [ ] Shareable on other platforms

---

## Prediction Market APIs (Verified Feb 2026)

### Quick Reference
| Platform | Auth | Real Money | Best For |
|----------|------|------------|----------|
| Polymarket | None | Crypto | Politics, sports |
| Kalshi | None (reads) | USD | Regulated US events |
| Manifold | None | Play-money | Wide variety |
| PolyRouter | Free key | Aggregated | Multi-platform |
| Metaculus | Free key | No | Long-range forecasts |
| Limitless | None | USDC | Crypto price predictions |

### Polymarket (No Auth)
```
Base: https://gamma-api.polymarket.com

GET /markets?closed=false&limit=30&order=volume&ascending=false
GET /events?closed=false&limit=20

Response: { id, question, outcomePrices: "[\"0.65\",\"0.35\"]", volume, slug }
```

### Kalshi (No Auth for reads)
```
Base: https://api.elections.kalshi.com/trade-api/v2

GET /markets?limit=30&status=open
GET /markets/{ticker}/orderbook

Response: { ticker, title, yes_bid, yes_ask } // Prices in CENTS (0-100)
```

### Manifold (No Auth)
```
Base: https://api.manifold.markets/v0

GET /search-markets?term=&limit=20&sort=liquidity&filter=open

Response: { id, question, probability, volume, url }
```

### PolyRouter (Free Key Required)
```
Base: https://api-v2.polyrouter.io
Header: X-API-Key: pk_...

GET /markets?platform=polymarket&limit=20
Platforms: polymarket, kalshi, manifold, limitless, prophetx
```

### Metaculus (Free Key Required)
```
Base: https://www.metaculus.com/api2
Header: Authorization: Token YOUR_TOKEN

GET /questions/?format=json&limit=20&status=open&type=forecast
```

### Limitless (No Auth)
```
Base: https://api.limitless.exchange
IMPORTANT: Use /markets/active NOT /markets

GET /markets/active?limit=20&sortBy=newest
GET /markets/{slug}/orderbook
GET /markets/search?query=bitcoin&limit=10

Notes: USDC has 6 decimals, deadline is Unix seconds
```

### Code Examples
```typescript
// Polymarket
const markets = await fetch('https://gamma-api.polymarket.com/markets?closed=false&limit=20&order=volume').then(r => r.json());
const yesPrice = parseFloat(JSON.parse(m.outcomePrices)[0]);

// Kalshi (prices in cents!)
const { markets } = await fetch('https://api.elections.kalshi.com/trade-api/v2/markets?limit=20&status=open').then(r => r.json());
const yesPrice = ((m.yes_bid + m.yes_ask) / 2) / 100;

// Manifold
const markets = await fetch('https://api.manifold.markets/v0/search-markets?limit=20&filter=open').then(r => r.json());
const yesPrice = m.probability; // Already 0-1
```

### Env Vars
```bash
GROQ_API_KEY=...           # Required for semantic agent
POLYROUTER_API_KEY=pk_...  # Optional aggregator
METACULUS_TOKEN=...        # Optional long-range
```

---

## /pitch Skill

12-slide pitch deck generator. Slides: Hook → Problem → Solution → Features → Tech → Market → Business Model → Traction → Roadmap → Team → CTA

Ask for: company name, one-liner, problem, target market, business model, traction, team.

---

## Key Principles

1. **Authenticity > Performance**: Skip "Great question!" — just help
2. **Proactive**: Try to figure it out before asking
3. **Concise/thorough**: Match depth to complexity
4. **Two-tier**: Deterministic first, LLM reasoning only when needed
5. **Spec-first**: Plan before coding
6. **Commit often**: Working milestone = commit
