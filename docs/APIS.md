# Prediction Market APIs

> Last verified: March 2026

## Quick Reference

| Platform | Auth | Real Money | Best For |
|----------|------|------------|----------|
| Polymarket | None | Crypto | Politics, sports, high volume |
| Kalshi | None (reads) | USD | Regulated US events |
| Manifold | None | Play-money | Wide variety, experimentation |
| Jupiter | None | Solana | Aggregated Poly+Kalshi (ZERO fees) |
| Limitless | None | USDC | Crypto price predictions |
| Metaculus | Token | No | Long-range forecasting |

---

## Polymarket (No Auth)

```
Base: https://gamma-api.polymarket.com

GET /markets?closed=false&limit=30&order=volume&ascending=false
GET /events?closed=false&limit=20
GET /markets/{conditionId}

Response: {
  id, question,
  outcomePrices: "[\"0.65\",\"0.35\"]",  // JSON string!
  volume, slug
}
```

**Gotcha**: `outcomePrices` is a JSON string, must parse it.

---

## Kalshi (No Auth for reads)

```
Base: https://api.elections.kalshi.com/trade-api/v2

GET /markets?limit=30&status=open
GET /markets/{ticker}
GET /markets/{ticker}/orderbook

Response: {
  ticker, title,
  yes_bid, yes_ask  // CENTS (0-100), not decimals!
}
```

**Gotcha**: Prices are in CENTS (0-100), divide by 100 for probability.

---

## Manifold (No Auth)

```
Base: https://api.manifold.markets/v0

GET /search-markets?term=&limit=20&sort=liquidity&filter=open
GET /market/{id}

Response: {
  id, question,
  probability,  // Already 0-1
  volume, url
}
```

---

## Jupiter Prediction Markets (No Auth)

```
Base: https://api.jup.ag/prediction/v1

GET /events                      # All active prediction events
GET /events/{eventId}            # Event details
GET /events/{eventId}/orderbook
POST /orders                     # Requires wallet signature

Benefits:
- Aggregates Polymarket + Kalshi
- ZERO payout fees (vs 2% on native)
- Native Solana wallet
- SOL/USDC settlement
```

---

## Limitless (No Auth)

```
Base: https://api.limitless.exchange

GET /markets/active?limit=20&sortBy=newest  # NOT /markets!
GET /markets/{slug}
GET /markets/{slug}/orderbook
GET /markets/search?query=bitcoin&limit=10

Notes:
- USDC has 6 decimals
- deadline is Unix seconds
```

**Gotcha**: Use `/markets/active` NOT `/markets`.

---

## Metaculus (Token Required)

```
Base: https://www.metaculus.com/api2
Header: Authorization: Token YOUR_TOKEN

GET /questions/?format=json&limit=20&status=open&type=forecast
```

---

## Code Examples

```typescript
// Polymarket
const markets = await fetch(
  'https://gamma-api.polymarket.com/markets?closed=false&limit=20&order=volume'
).then(r => r.json());
const yesPrice = parseFloat(JSON.parse(m.outcomePrices)[0]);

// Kalshi (prices in cents!)
const { markets } = await fetch(
  'https://api.elections.kalshi.com/trade-api/v2/markets?limit=20&status=open'
).then(r => r.json());
const yesPrice = ((m.yes_bid + m.yes_ask) / 2) / 100;

// Manifold
const markets = await fetch(
  'https://api.manifold.markets/v0/search-markets?limit=20&filter=open'
).then(r => r.json());
const yesPrice = m.probability; // Already 0-1

// Jupiter
const events = await fetch(
  'https://api.jup.ag/prediction/v1/events'
).then(r => r.json());
```

---

## Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=...     # Claude API (agents)

# Optional platform integrations
KALSHI_API_KEY=...        # Kalshi trading (if needed)
METACULUS_TOKEN=...       # Metaculus access
TAVILY_API_KEY=...        # Web search for research

# Solana
SOLANA_RPC_URL=...        # Helius/Quicknode RPC
WALLET_PRIVATE_KEY=...    # For on-chain commits (CAREFUL!)
```

---

## Rate Limits

| Platform | Limit | Notes |
|----------|-------|-------|
| Polymarket | ~100/min | Generous, rarely hit |
| Kalshi | ~60/min | More restrictive |
| Manifold | ~100/min | Generous |
| Jupiter | Unknown | New API, monitor |
| Limitless | ~30/min | Conservative |

---

## Common Errors

| Error | Platform | Fix |
|-------|----------|-----|
| 429 Too Many Requests | All | Back off, implement retry with exponential backoff |
| Empty `outcomePrices` | Polymarket | Market might be closed, check `closed` field |
| `yes_bid: 0` | Kalshi | No liquidity, skip market |
| 404 on `/markets` | Limitless | Use `/markets/active` instead |
