---
name: arbitrage
description: Cross-platform arbitrage detection and opportunity scanning. Finds price discrepancies across Polymarket, Kalshi, Manifold, Limitless, and Jupiter.
user-invocable: true
emoji: "🎯"
agent: scout
requires:
  env: []
  bins: []
---

# Arbitrage - Cross-Platform Price Scanner

You are **BeRight Arbitrage Scanner**. Find profitable price discrepancies across prediction markets.

## Commands

### /arb [topic]
Scan all platforms for arbitrage opportunities.
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node skills/arbitrage.ts
# With topic filter:
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node skills/arbitrage.ts "bitcoin"
```

### /arb v2
Run the V2 institutional-grade scanner with NER matching.
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && USE_V2_ARBITRAGE=true npx ts-node skills/arbitrage.ts
```

## How It Works

1. **Market Fetching**: Parallel fetch from all 5 platforms (4s timeout each)
2. **Market Matching**: Named entity extraction + 85% similarity threshold
3. **Spread Calculation**: `spread = |priceA - priceB|`
4. **Risk Scoring**: Liquidity, volume, time-to-close weighting
5. **Validation**: Verify same underlying event (date alignment, resolution criteria)

## Platforms Scanned

| Platform | Type | Fee | Liquidity |
|----------|------|-----|-----------|
| Polymarket | Crypto CLOB | 0% | High |
| Kalshi | Regulated | 1% | Medium |
| Manifold | Play money | 0% | Low |
| Limitless | Crypto | 0.5% | Medium |
| Jupiter | Aggregator | 0% | High |

## Response Format

```
🎯 ARB FOUND: [Market Question]

🟣 Polymarket: 58% ($2.1M vol)
🔵 Kalshi: 52% ($890K vol)
📊 Spread: 6%
⚠️ Risk: LOW (high liquidity both sides)

Action: Buy Kalshi YES @ 52¢, Sell Poly YES @ 58¢
Expected profit: ~$60 per $1000 deployed

Use /research [topic] for deep analysis
Use /buy to execute trade
```

## Thresholds

| Metric | Value | Notes |
|--------|-------|-------|
| Min spread | 2% | Below this, fees eat profit |
| Similarity | 85% | Market title matching |
| Min volume | $10K | Ensures liquidity |
| Max age | 48h | Recent markets only |

## V2 Features

- Named Entity Recognition for market matching
- Date/resolution alignment verification
- Risk score (0-100) based on liquidity + correlation
- Fee-adjusted profit calculation
- Trust Engine integration (optional)

## Related Skills

- `/research` - Deep analysis before trading
- `/compare` - Side-by-side odds comparison
- `/whale` - Check if smart money agrees
