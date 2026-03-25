---
paths: beright-ts/lib/dataFabric/**/*
---
# Data Fabric Rules

Unified access to: Polymarket, Kalshi, Manifold, Limitless, DFlow

## Caching
- Default: 30s TTL | Hot markets: 10s | Historical: 5min
- LRU cache, max 1000 entries

## Normalize to
```typescript
interface NormalizedMarket {
  id: string; platform: Platform; question: string;
  probability: number; volume24h: number; closeTime: Date;
}
```

## Error Handling
- Graceful degradation if platform fails
- Return partial data with status
- Circuit breaker on repeated failures
