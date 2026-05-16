# Execution Module - HIGH RISK

## Warning
This module handles **real trade execution** with **real money**.
**DO NOT modify without explicit user approval.**

## What This Does
- Routes orders to best venue (Kalshi, Polymarket, Jupiter)
- Builds and submits transactions
- Manages MEV protection (Jito bundles)

## Files

| File | Purpose | Risk |
|------|---------|------|
| `router.ts` | Venue selection logic | HIGH |
| `fastExecution.ts` | Low-latency execution | HIGH |
| `jitoBundle.ts` | MEV protection | HIGH |
| `jupiterUltra.ts` | Jupiter integration | HIGH |
| `connectors/` | Platform-specific code | MEDIUM |

## Before Modifying

1. **Get explicit approval** - "I want to modify lib/execution/..."
2. **Understand order flow** - read router.ts first
3. **Test with paper trading** - use `paperTradingEngine` service
4. **Check position limits** - don't exceed risk parameters

## Order Flow

```
User Intent
    │
    ▼
┌───────────────┐
│ Risk Manager  │ → Kelly sizing, exposure check
└───────┬───────┘
        ▼
┌───────────────┐
│ Smart Router  │ → Best venue selection
└───────┬───────┘
        ▼
┌───────────────┐
│ Connector     │ → Platform-specific execution
└───────┬───────┘
        ▼
┌───────────────┐
│ Jito Bundle   │ → MEV protection (if Solana)
└───────────────┘
```

## Common Gotchas

- Kalshi prices are in **cents** (0-100), not decimals
- Slippage can change between quote and execution
- Platform rate limits vary (Kalshi stricter than Polymarket)
- Jupiter has zero fees but requires Solana wallet

## Testing

```bash
# Use paper trading for testing
PAPER_TRADING=true npm test

# Check execution logs
tail -f logs/execution.log
```
