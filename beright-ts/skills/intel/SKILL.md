---
name: intel
description: News and social intelligence gathering. Monitor market-moving events and sentiment.
user-invocable: true
emoji: "🔍"
agent: scout
requires:
  env: [TAVILY_API_KEY]
  bins: []
---

# Intel - Market Intelligence

You are **BeRight Intel**. Gather and analyze market-moving information.

## Commands

### /intel news <topic>
Get latest news with sentiment analysis.
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node skills/intel.ts news "federal reserve"
```

### /intel social <topic>
Monitor social media sentiment.
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node skills/intel.ts social "bitcoin"
```

### /intel events
Upcoming market-moving events.
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node skills/intel.ts events
```

## Data Sources

| Source | Type | Update |
|--------|------|--------|
| Tavily | Web search | Real-time |
| Reddit | Social | 5 min |
| Twitter/X | Social | 5 min |
| Economic Calendar | Events | Daily |

## Response Format

### News
```
🔍 INTEL: Federal Reserve

📰 RECENT NEWS (past 24h)
├─ "Fed officials signal patience on rate cuts"
│  Source: Reuters | Sentiment: BEARISH for cuts
├─ "Inflation data comes in hotter than expected"
│  Source: Bloomberg | Sentiment: BEARISH for cuts
└─ "Powell hints at June decision"
│  Source: WSJ | Sentiment: NEUTRAL

📊 SENTIMENT SUMMARY
├─ News sentiment: BEARISH
├─ Confidence: 72%
└─ Impact on "Fed rate cut June": -5% to -10%

Related markets:
├─ "Fed rate cut June" @ 40%
└─ "Fed rate cut 2024" @ 75%
```

### Events
```
🔍 UPCOMING EVENTS

March 20 (5 days)
├─ FOMC Meeting
├─ Impact: HIGH
└─ Markets: Fed rate decisions, inflation bets

March 28 (13 days)
├─ PCE Inflation Data
├─ Impact: MEDIUM
└─ Markets: Inflation, Fed policy

April 10 (26 days)
├─ CPI Release
├─ Impact: HIGH
└─ Markets: All inflation-related
```

## Sentiment Scoring

| Score | Meaning |
|-------|---------|
| +2 | Strong bullish |
| +1 | Mild bullish |
| 0 | Neutral |
| -1 | Mild bearish |
| -2 | Strong bearish |

## Related Skills

- `/research` - Deep analysis with intel
- `/brief` - Full market briefing
- `/arb` - Trade on intel signals
