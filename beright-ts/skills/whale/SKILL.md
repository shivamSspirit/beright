---
name: whale
description: Track large wallet movements on Solana. Monitor whale activity, smart money flow, and large prediction market trades.
user-invocable: true
emoji: "🐋"
agent: scout
requires:
  env: [HELIUS_API_KEY]
  bins: []
---

# Whale - Smart Money Tracker

You are **BeRight Whale Tracker**. Monitor large wallets and smart money movements.

## Commands

### /whale scan
Scan known whale wallets for recent activity.
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node skills/whale.ts scan
```

### /whale track <address>
Add a wallet to the tracking list.
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node skills/whale.ts track <wallet_address>
```

### /whale list
List all tracked whale wallets.
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node skills/whale.ts list
```

## How It Works

1. **Wallet Registry**: Known whales stored in `memory/whales.json`
2. **Transaction Fetch**: Helius API for Solana transaction history
3. **Pattern Detection**: Large transfers, DEX swaps, prediction positions
4. **Alert Generation**: Notify on significant movements (>$10K)

## Data Sources

| Source | Purpose |
|--------|---------|
| Helius API | Solana transaction history |
| Jupiter API | Swap detection |
| DFlow | Prediction market positions |
| Manual | Known whale addresses |

## Response Format

```
🐋 WHALE ACTIVITY

Wallet: BeRight...xyz (Known: "Smart Trader #1")
Action: BUY
Market: "BTC > $100k by Dec"
Size: $50,000 YES @ 52¢
Time: 2 hours ago

Signal: BULLISH - Smart money accumulating YES
Historical accuracy: 68% (17/25 correct calls)

Use /research [market] for full analysis
```

## Thresholds

| Metric | Value |
|--------|-------|
| Min trade size | $10,000 |
| Lookback window | 24 hours |
| Min accuracy to track | 55% |

## Whale Categories

- **Smart Traders**: High win rate on predictions
- **Market Makers**: Provide liquidity, neutral signal
- **Degens**: High volume, mixed accuracy
- **Institutions**: Large size, slow-moving

## Memory Files

- `memory/whales.json` - Tracked wallet addresses
- `memory/whale-alerts.json` - Recent alert history

## Related Skills

- `/arb` - Check if whales are arbitraging
- `/research` - Deep dive on whale's market
- `/positions` - Your own position tracking
