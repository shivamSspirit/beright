# BeRight Protocol - Hackathon Submission Guide

## Hackathon Details

**Event:** Colosseum Agent Hackathon (Solana)
**Timeline:** Feb 2-12, 2026
**Prize Pool:** $100,000 USDC

| Place | Prize |
|-------|-------|
| 1st | $50,000 |
| 2nd | $30,000 |
| 3rd | $15,000 |
| Most Agentic | $5,000 |

**Competitors:** 299+ projects

---

## Submission Requirements

### 1. Code Repository
- [x] Public GitHub repo
- [x] All code written by AI (Claude)
- [x] Humans only configure and run
- [x] Solana integration required

### 2. Demo Video (3-5 minutes)
**Must show:**
- [ ] Autonomous operation (no human prompts)
- [ ] Multi-agent delegation
- [ ] On-chain prediction commits
- [ ] Real market data integration

### 3. Documentation
- [x] README with setup instructions
- [x] Architecture explanation
- [x] Feature list

---

## Demo Video Script (4 minutes)

### [0:00-0:30] HOOK
```
"BeRight runs 24/7 without a single human prompt.
 Watch what happened while I was asleep."
```
- Show terminal with heartbeat logs
- Timestamp proving overnight operation

### [0:30-1:30] AUTONOMOUS OPERATION
Show in order:
1. Heartbeat scanning (5-min intervals)
2. Arbitrage alert triggered
3. Whale movement detected
4. Decision engine confidence score

```
Key phrase: "No human typed anything. This happened automatically."
```

### [1:30-2:30] MULTI-AGENT DEMO
Live Telegram interaction:
```
/arb bitcoin         → Scout responds (fast)
/research fed rate   → Analyst responds (deep)
/calibration         → Full Brier report
```
Show agent switching in logs.

### [2:30-3:30] ON-CHAIN VERIFICATION
```
/predict "BTC 200K by 2027" 25 NO because macro conditions
```
Show:
1. Prediction committed to Solana
2. TX hash on Solscan
3. Brier score update
4. Leaderboard position

### [3:30-4:00] CLOSE
```
"This is what autonomous looks like.
 Not a chatbot. Not a dashboard.
 An agent that trades while you sleep.
 BeRight Protocol."
```

---

## What Judges Look For

### "Most Agentic" Award ($5,000)
| Criterion | BeRight Evidence |
|-----------|------------------|
| Autonomous | Heartbeat runs 24/7 without prompts |
| Decision-making | Confidence scoring + thresholds |
| Multi-agent | Scout/Analyst/Trader delegation |
| Self-healing | Fallback mechanisms built-in |

### Top 3 Criteria
| Criterion | BeRight Evidence |
|-----------|------------------|
| Solana integration | Memo program commits |
| Innovation | Superforecaster methodology |
| Completeness | 21 skills, 30+ commands |
| Real utility | Arbitrage, whale tracking |

---

## Remaining Tasks (Priority Order)

### Day 1 - Critical Path
| Task | Time | Status |
|------|------|--------|
| Wire `/predict` to Solana | 2h | TODO |
| Wire `/predict` to Supabase | 2h | TODO |
| Test multi-agent spawning | 1h | TODO |

### Day 2 - Polish
| Task | Time | Status |
|------|------|--------|
| Deploy Telegram bot | 2h | TODO |
| Wire leaderboard to Supabase | 2h | TODO |
| Add resolution automation | 2h | TODO |

### Day 3 - Submission
| Task | Time | Status |
|------|------|--------|
| Record demo video | 3h | TODO |
| Write submission text | 1h | TODO |
| Final testing | 1h | TODO |
| Submit before deadline | - | TODO |

---

## Submission Checklist

### Before Recording Demo
- [ ] On-chain commits working
- [ ] Multi-agent spawning tested
- [ ] Telegram bot deployed with token
- [ ] At least 5 predictions on-chain
- [ ] Arbitrage finding working
- [ ] Heartbeat logs showing overnight run

### Demo Recording
- [ ] 4 minutes or less
- [ ] Show autonomous operation proof
- [ ] Show multi-agent delegation
- [ ] Show on-chain TX verification
- [ ] Clear audio explanation

### Final Submission
- [ ] GitHub repo public
- [ ] README updated
- [ ] Demo video uploaded
- [ ] Submission form completed
- [ ] Verify all links work

---

## Competitive Advantages to Highlight

### 1. "Only Agent That Never Sleeps"
- OpenClaw cron runs every 5 minutes
- No competitor has scheduled autonomy
- Show overnight logs as proof

### 2. "Scientific Forecasting"
- Tetlock's superforecaster methodology
- Brier score calibration tracking
- Base rate analysis before predictions

### 3. "Five Markets, One Interface"
- Polymarket + Kalshi + Manifold + Limitless + Metaculus
- Cross-platform arbitrage detection
- Unique in competition

### 4. "Verifiable On-Chain"
- Every prediction on Solana
- Gaming-resistant leaderboard
- Trustless verification

---

## Submission Text Template

```
BeRight Protocol - AI Prediction Market Intelligence

BeRight is an autonomous AI agent that runs 24/7 without human prompts,
making predictions and tracking calibration across 5 prediction markets.

KEY FEATURES:
- Scheduled autonomy via OpenClaw cron (every 5 min)
- Multi-agent architecture (Scout/Analyst/Trader)
- Superforecaster methodology with Brier scores
- On-chain verification via Solana Memo Program
- 5 platform integration (Polymarket, Kalshi, Manifold, Limitless, Metaculus)

TECH STACK:
- Claude (Sonnet 4.5 + Opus 4.5)
- Solana (Memo Program)
- Next.js + React + TypeScript
- Supabase + Helius RPC

DEMO: [video link]
REPO: [github link]

This is what autonomous AI looks like.
Not a chatbot. An agent that trades while you sleep.
```

---

## Links to Prepare

| Item | URL | Status |
|------|-----|--------|
| GitHub Repo | github.com/... | TODO |
| Demo Video | youtube.com/... | TODO |
| Live Demo | beright.app/... | Optional |
| Solscan TX | solscan.io/tx/... | TODO |

---

## Emergency Fixes

If something breaks before submission:

### On-Chain Not Working
```bash
# Test Solana connection
cd beright-ts && npx ts-node -e "
import { commitPrediction } from './lib/onchain/commit';
commitPrediction({ market: 'test', probability: 50, direction: 'YES' });
"
```

### Multi-Agent Not Spawning
Check `beright-ts/config/agents.ts` - ensure `allowAgents: true`

### Telegram Not Responding
1. Verify bot token in `.env`
2. Check webhook/polling mode
3. Test with `/start` command

---

## Final Message

**You have everything built. Now ship it.**

1. Wire on-chain (2 hours)
2. Test multi-agent (1 hour)
3. Record video (3 hours)
4. Submit (30 minutes)

**Target: Most Agentic Award ($5,000) + Top 3 ($15K-$50K)**
