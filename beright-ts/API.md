# BeRight Protocol API Documentation

## Overview

BeRight Protocol exposes a REST + SSE API for the berightweb frontend.

**Base URL**: `http://localhost:3001/api` (dev) or `https://your-domain.com/api` (prod)

## Authentication

Requests can be authenticated via:
- `Authorization: Bearer <supabase_jwt>` - Supabase auth token
- `X-Wallet-Address: <solana_address>` - Wallet address
- `X-Telegram-ID: <telegram_id>` - Telegram user ID

Anonymous requests are allowed for read-only endpoints but rate-limited more strictly.

## Rate Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Markets (read) | 60/min | 60s |
| Predictions (write) | 10/min | 60s |
| Research | 5/min | 60s |
| Arbitrage | 10/min | 60s |
| Trading | 5/min | 60s |

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Max requests
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp when limit resets

---

## Endpoints

### Health Check

```
GET /api/health
```

Returns system health status.

**Response:**
```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "version": "1.0.0",
  "environment": "production",
  "features": {
    "onchain": true,
    "kalshi": true,
    "telegram": true,
    "supabase": true,
    "agents": true,
    "rateLimit": true
  },
  "checks": {
    "supabase": { "status": "ok", "latency": 45 },
    "redis": { "status": "ok", "latency": 12 },
    "solana": { "status": "ok", "latency": 89 }
  }
}
```

---

### Markets

```
GET /api/markets
GET /api/markets?q=bitcoin
GET /api/markets?hot=true
GET /api/markets?compare=true
```

**Query Parameters:**
- `q` - Search query (optional)
- `hot` - Get trending markets (boolean)
- `compare` - Include arbitrage data (boolean)
- `limit` - Max results (default: 20)
- `platform` - Filter by platform (polymarket, kalshi, manifold)

**Response:**
```json
{
  "count": 10,
  "markets": [
    {
      "id": "will-bitcoin-100k",
      "platform": "polymarket",
      "title": "Will Bitcoin reach $100K?",
      "question": "Will Bitcoin reach $100,000 by Dec 31, 2026?",
      "yesPrice": 0.68,
      "noPrice": 0.32,
      "yesPct": 68,
      "noPct": 32,
      "volume": 2500000,
      "liquidity": 500000,
      "endDate": "2026-12-31T23:59:59Z",
      "status": "open",
      "url": "https://polymarket.com/..."
    }
  ],
  "arbitrage": [
    {
      "topic": "Bitcoin $100K",
      "platformA": "polymarket",
      "platformB": "kalshi",
      "priceA": 0.68,
      "priceB": 0.72,
      "spread": 0.04,
      "profitPercent": 4.0,
      "strategy": "Buy YES on Polymarket, sell on Kalshi",
      "confidence": 0.85
    }
  ]
}
```

---

### Arbitrage

```
GET /api/arbitrage
GET /api/arbitrage?q=election
GET /api/arbitrage?minSpread=0.03
```

**Query Parameters:**
- `q` - Search topic (optional)
- `minSpread` - Minimum spread to include (default: 0.02)
- `limit` - Max results (default: 10)

**Response:**
```json
{
  "success": true,
  "query": "election",
  "count": 5,
  "opportunities": [
    {
      "topic": "2028 Presidential Election",
      "platformA": "polymarket",
      "platformB": "kalshi",
      "marketA": "will-trump-win-2028",
      "marketB": "PRES-2028-TRUMP",
      "priceAYes": 0.45,
      "priceBYes": 0.52,
      "spread": 0.07,
      "profitPercent": 7.0,
      "strategy": "Buy YES on Polymarket @ 45%, sell on Kalshi @ 52%",
      "confidence": 0.92,
      "urlA": "https://polymarket.com/...",
      "urlB": "https://kalshi.com/..."
    }
  ],
  "scannedAt": "2026-02-10T10:30:00Z"
}
```

---

### Research

```
POST /api/research
GET /api/research?q=your+question
```

**POST Body:**
```json
{
  "question": "Will the Fed cut rates in March 2026?",
  "includeNews": true,
  "includeSocial": true,
  "depth": "standard"
}
```

**Response:**
```json
{
  "success": true,
  "question": "Will the Fed cut rates in March 2026?",
  "analysis": {
    "summary": "Based on current economic indicators...",
    "mood": "NEUTRAL",
    "confidence": "medium",
    "sources": ["Federal Reserve", "Reuters", "Bloomberg"],
    "marketData": [...],
    "baseRate": 0.65,
    "recommendation": "Consider YES at prices below 60%"
  },
  "analyzedAt": "2026-02-10T10:30:00Z"
}
```

---

### Whale Tracking

```
GET /api/whale
GET /api/whale?wallet=<address>
```

**Query Parameters:**
- `wallet` - Specific wallet to track (optional)
- `limit` - Max results (default: 20)
- `minAmount` - Minimum trade amount in USD (default: 1000)

**Response:**
```json
{
  "success": true,
  "mode": "scan",
  "activity": [
    {
      "wallet": "4xK8...",
      "action": "BUY",
      "market": "Bitcoin $100K",
      "amount": 50000,
      "direction": "YES",
      "timestamp": "2026-02-10T10:15:00Z"
    }
  ],
  "summary": "2 whale movements detected...",
  "mood": "BULLISH",
  "scannedAt": "2026-02-10T10:30:00Z"
}
```

---

### Intel (News & Social)

```
GET /api/intel
GET /api/intel?q=crypto&type=news
```

**Query Parameters:**
- `q` - Search topic (optional)
- `type` - Filter type: `news`, `social`, or `all` (default: all)
- `limit` - Max results (default: 20)

**Response:**
```json
{
  "success": true,
  "query": "crypto",
  "type": "all",
  "news": [
    {
      "title": "Bitcoin Surges Past $95K",
      "source": "Reuters",
      "url": "https://...",
      "publishedAt": "2026-02-10T09:00:00Z",
      "summary": "...",
      "sentiment": "bullish",
      "relevance": 0.95
    }
  ],
  "social": [
    {
      "platform": "reddit",
      "author": "crypto_whale",
      "content": "Just bought more BTC...",
      "sentiment": "bullish",
      "engagement": 1500,
      "url": "https://reddit.com/..."
    }
  ],
  "totalNews": 15,
  "totalSocial": 25,
  "fetchedAt": "2026-02-10T10:30:00Z"
}
```

---

### Portfolio

```
GET /api/portfolio
GET /api/portfolio?userId=telegram:123456
```

**Query Parameters:**
- `userId` - User identifier (optional if authenticated)

**Response:**
```json
{
  "success": true,
  "userId": "telegram:123456",
  "portfolio": {
    "totalValue": 5000,
    "cashBalance": 2000,
    "positionsValue": 3000,
    "totalPnL": 500,
    "dayChange": 50,
    "positionCount": 5
  },
  "positions": [
    {
      "id": "pos_123",
      "market": "Bitcoin $100K",
      "platform": "polymarket",
      "direction": "YES",
      "size": 100,
      "entryPrice": 0.55,
      "currentPrice": 0.68,
      "pnl": 13,
      "pnlPercent": 23.6,
      "status": "open"
    }
  ],
  "calibration": {
    "totalPredictions": 50,
    "resolvedPredictions": 35,
    "pendingPredictions": 15,
    "brierScore": 0.18,
    "accuracy": 0.72,
    "streak": 5
  },
  "pendingPredictions": [...],
  "updatedAt": "2026-02-10T10:30:00Z"
}
```

---

### Predictions

```
GET /api/predictions
POST /api/predictions
PATCH /api/predictions
```

**POST Body (create prediction):**
```json
{
  "question": "Will Bitcoin reach $100K by Dec 2026?",
  "probability": 0.68,
  "direction": "YES",
  "reasoning": "Based on current momentum...",
  "platform": "polymarket",
  "marketId": "will-bitcoin-100k",
  "marketUrl": "https://polymarket.com/...",
  "confidence": "high",
  "tags": ["crypto", "bitcoin"],
  "telegramId": "123456"
}
```

**PATCH Body (resolve prediction):**
```json
{
  "predictionId": "pred_abc123",
  "outcome": true
}
```

---

### Real-time Stream (SSE)

```
GET /api/stream
GET /api/stream?types=arbitrage,whale
```

**Query Parameters:**
- `types` - Comma-separated event types to filter (optional)

**Event Types:**
- `connected` - Initial connection confirmation
- `arbitrage` - New arbitrage opportunity
- `whale` - Whale movement detected
- `price` - Significant price change
- `heartbeat` - Keep-alive (every 30s)

**Example Usage (JavaScript):**
```javascript
const eventSource = new EventSource('/api/stream?types=arbitrage,whale');

eventSource.addEventListener('connected', (e) => {
  console.log('Connected:', JSON.parse(e.data));
});

eventSource.addEventListener('arbitrage', (e) => {
  const arb = JSON.parse(e.data);
  console.log('Arbitrage:', arb);
});

eventSource.addEventListener('whale', (e) => {
  const whale = JSON.parse(e.data);
  console.log('Whale:', whale);
});

eventSource.onerror = (e) => {
  console.error('Stream error:', e);
};
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error Type",
  "message": "Human-readable error message"
}
```

**Status Codes:**
- `400` - Bad Request (validation error)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

---

## Integration Example

```typescript
// berightweb/lib/api.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function fetchMarkets(query?: string) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);

  const res = await fetch(`${API_BASE}/markets?${params}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

export function subscribeToStream(
  onEvent: (type: string, data: unknown) => void,
  types?: string[]
) {
  const params = types ? `?types=${types.join(',')}` : '';
  const eventSource = new EventSource(`${API_BASE}/stream${params}`);

  eventSource.onmessage = (e) => {
    const data = JSON.parse(e.data);
    onEvent(data.type, data);
  };

  return () => eventSource.close();
}
```

---

## Environment Variables for berightweb

```env
# API Connection
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# Supabase (shared with beright-ts)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Optional
NEXT_PUBLIC_STREAM_ENABLED=true
```
