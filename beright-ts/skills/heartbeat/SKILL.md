---
name: heartbeat
description: Autonomous agent loop. Runs cognitive cycle (perceive → deliberate → act → reflect) every 5 minutes. Core orchestration skill.
user-invocable: true
emoji: "💓"
agent: orchestrator
requires:
  env: [TELEGRAM_BOT_TOKEN, HELIUS_API_KEY]
  bins: []
---

# Heartbeat - Autonomous Cognitive Loop

You are **BeRight Heartbeat**. The autonomous orchestration loop that keeps the system alive.

## Commands

### /heartbeat once
Run a single heartbeat cycle.
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node skills/heartbeat.ts once
```

### /heartbeat loop [interval]
Start continuous loop (default: 60 seconds).
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node skills/heartbeat.ts loop 60
```

### /heartbeat stats
View agent statistics and performance.
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node skills/heartbeat.ts stats
```

### /heartbeat cognitive
Run cognitive loop only (no trading actions).
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node skills/heartbeat.ts cognitive
```

## Cognitive Loop Phases

```
┌─────────────────────────────────────────────────────────┐
│                    COGNITIVE CYCLE                       │
├─────────────────────────────────────────────────────────┤
│  1. PERCEIVE    → Scan markets, news, whale activity    │
│  2. UPDATE      → Integrate new observations            │
│  3. EVALUATE    → Assess past performance               │
│  4. DELIBERATE  → Decide what to pursue                 │
│  5. PLAN        → Create action steps                   │
│  6. ACT         → Execute skills                        │
│  7. REFLECT     → Learn and improve                     │
└─────────────────────────────────────────────────────────┘
```

## What Runs Each Cycle

| Component | Interval | Description |
|-----------|----------|-------------|
| Arbitrage Scan | 5 min | Cross-platform price check |
| Whale Watch | 5 min | Large wallet movements |
| Price Tracker | 5 min | Record market snapshots |
| Signal Detection | 5 min | News, social, momentum |
| Calibration Check | 30 min | Brier score update |
| Cognitive Loop | 5 min | Goal management |
| Alert Routing | Real-time | Send notifications |

## State Persistence

- `memory/heartbeat-state.json` - Counters, timestamps, cycle stats
- `memory/episodes.json` - Episodic memory for learning
- `memory/goals.json` - Active goals and priorities

## Response Format

```
💓 HEARTBEAT CYCLE #1234

Time: 2024-03-15 10:30:00 UTC
Duration: 2.3s

Scanned:
├─ Markets: 847 across 5 platforms
├─ Whales: 12 tracked wallets
└─ Signals: 3 new detections

Actions:
├─ 🎯 2 arb opportunities found (>2% spread)
├─ 🐋 1 whale alert triggered
└─ 📊 15 price snapshots recorded

Cognitive:
├─ Goals active: 3
├─ Beliefs updated: 2
└─ Lessons learned: 1

Next cycle: 60s
```

## PM2 Deployment

```bash
# Start with PM2
pm2 start ecosystem.config.js --only heartbeat

# View logs
pm2 logs heartbeat

# Restart
pm2 restart heartbeat
```

## Related Skills

- `/arb` - Manual arbitrage scan
- `/whale` - Manual whale check
- `/calibration` - View accuracy stats
- `/brief` - Generate market briefing
