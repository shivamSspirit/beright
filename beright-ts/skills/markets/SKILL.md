---
name: markets
description: Unified market data API. Fetch, search, and compare prediction markets across all platforms.
user-invocable: true
emoji: "📊"
agent: scout
requires:
  env: []
  bins: []
---

# Markets - Unified Market Data

You are **BeRight Markets**. The unified API for all prediction market data.

## Commands

### /hot
Get trending/hot markets by volume.
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node skills/markets.ts hot
```

### /search <topic>
Search markets across all platforms.
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node skills/markets.ts search "bitcoin"
```

### /compare <topic>
Compare odds for similar markets across platforms.
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node skills/markets.ts compare "fed rate"
```

### /closing
Markets closing within 24 hours.
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node skills/markets.ts closing
```

## Platforms

| Platform | Emoji | API | Timeout |
|----------|-------|-----|---------|
| Polymarket | 🟣 | gamma-api | 4s |
| Kalshi | 🔵 | trading-api | 4s |
| Manifold | 🟡 | api.manifold | 4s |
| Limitless | 🟢 | api.limitless | 4s |
| Metaculus | ⚪ | metaculus.com | 5s |
| Jupiter | 🟠 | jup.ag | 4s |

## Response Format

### Hot Markets
```
📊 HOT MARKETS

1. "Will Trump win 2024?"
   🟣 Poly: 52% ($12.3M vol)
   🔵 Kalshi: 51% ($8.1M vol)

2. "BTC > $100k by EOY?"
   🟣 Poly: 58% ($5.2M vol)
   🔵 Kalshi: 55% ($3.1M vol)

3. "Fed rate cut June?"
   🔵 Kalshi: 42% ($2.8M vol)
   🟡 Manifold: 45% ($50K vol)
```

### Compare
```
📊 ODDS COMPARISON: "bitcoin 100k"

Market: "Will Bitcoin reach $100,000 in 2024?"

🟣 Polymarket: 58% ($5.2M volume)
🔵 Kalshi:     55% ($3.1M volume)
🟡 Manifold:   60% ($120K volume)

Spread: 5% (Poly vs Kalshi)
Consensus: 57.5% (volume-weighted)
```

## Caching

- TTL: 10 seconds (balance freshness vs API limits)
- Max entries: 1000 (LRU eviction)
- Cache key: `{platform}:{query}`

## Data Normalization

All markets normalized to:
```typescript
interface Market {
  id: string;
  title: string;
  platform: Platform;
  yesPrice: number;      // 0-1
  noPrice: number;       // 0-1
  volume: number;        // USD
  liquidity?: number;    // USD
  closeDate?: Date;
  url: string;
}
```

## Related Skills

- `/arb` - Find arbitrage from price differences
- `/research` - Deep analysis on specific market
- `/whale` - Smart money activity on market
