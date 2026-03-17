---
paths: beright-ts/lib/dataFabric/**/*
---
# Data Fabric Rules

## Purpose
Data Fabric provides unified access to all prediction market platforms.
It abstracts platform-specific APIs into a common interface.

## Supported Platforms
- Polymarket (gamma-api.polymarket.com)
- Kalshi (api.elections.kalshi.com)
- Manifold (api.manifold.markets)
- Limitless (api.limitless.exchange)
- DFlow (pond.dflow.net)

## Caching Strategy
- Default TTL: 30 seconds
- Hot markets: 10 seconds
- Historical data: 5 minutes
- Use LRU cache with max 1000 entries

## Data Normalization
All markets must be normalized to common schema:
```typescript
interface NormalizedMarket {
  id: string;
  platform: Platform;
  question: string;
  probability: number;
  volume24h: number;
  liquidity: number;
  closeTime: Date;
  outcomes: Outcome[];
}
```

## Error Handling
- Graceful degradation if one platform fails
- Return partial data with platform status
- Log API failures with response codes
- Implement circuit breaker for repeated failures

## Rate Limiting
- Respect each platform's rate limits
- Implement request queuing if needed
- Log rate limit hits for monitoring
