# BeRight Arbitrage API Verification Report

**Generated**: 2026-02-12
**Status**: All APIs Working

---

## API Endpoints Summary

| Platform | API Endpoint | Status | Auth Required |
|----------|-------------|--------|---------------|
| Polymarket | `https://gamma-api.polymarket.com` | ✅ Working | No |
| Kalshi | `https://api.elections.kalshi.com/trade-api/v2` | ✅ Working | No (read) |
| DFlow | `https://dev-prediction-markets-api.dflow.net/api/v1` | ✅ Working | No |
| Manifold | `https://api.manifold.markets/v0` | ✅ Working | No |
| Metaculus | `https://www.metaculus.com/api2` | ✅ Working | No |

---

## 1. Polymarket API

**Endpoint**: `https://gamma-api.polymarket.com/markets`

**Sample Request**:
```bash
curl "https://gamma-api.polymarket.com/markets?closed=false&limit=3&order=volume&ascending=false"
```

**Sample Response**:
```json
{
  "id": "1349991",
  "question": "Will Elon Musk post 200-219 tweets from February 10 to February 17, 2026?",
  "conditionId": "0x00b9ee910ab3f57cb442d775a41fa8af33e8de6b7658c94d27ef6286e7c4f3c7",
  "slug": "elon-musk-of-tweets-february-10-february-17-200-219",
  "endDate": "2026-02-17T17:00:00Z",
  "liquidity": "59115.44856",
  "outcomes": "[\"Yes\", \"No\"]",
  "outcomePrices": "[\"0.0075\", \"0.9925\"]",
  "volume": "99950.751569",
  "active": true,
  "closed": false,
  "volume24hr": 26874.629835,
  "volumeNum": 99950.751569,
  "liquidityNum": 59115.44856
}
```

**Key Fields for Arbitrage**:
- `question` - Market title for matching
- `outcomePrices[0]` - YES price (0-1)
- `outcomePrices[1]` - NO price (0-1)
- `volume` - Total volume in USD
- `liquidity` - Current liquidity

---

## 2. Kalshi API

**Endpoint**: `https://api.elections.kalshi.com/trade-api/v2/markets`

**Sample Request**:
```bash
curl "https://api.elections.kalshi.com/trade-api/v2/markets?limit=3"
```

**Sample Response**:
```json
{
  "cursor": "CgwI5_61zAYQiMyNtwI...",
  "markets": [
    {
      "ticker": "KXMVESPORTSMULTIGAMEEXTENDED-S2026901320F6369-0013B1A3442",
      "title": "yes Chet Holmgren: 3+,yes Chet Holmgren: 10+,yes Over 215.5 points scored",
      "event_ticker": "KXMVESPORTSMULTIGAMEEXTENDED-S2026901320F6369",
      "close_time": "2026-02-27T00:30:00Z",
      "status": "active",
      "last_price": 0,
      "last_price_dollars": "0.0000",
      "yes_bid": 0,
      "yes_bid_dollars": "0.0000",
      "yes_ask": 0,
      "yes_ask_dollars": "0.0000",
      "no_bid": 100,
      "no_bid_dollars": "1.0000",
      "no_ask": 100,
      "no_ask_dollars": "1.0000",
      "volume": 0,
      "volume_24h": 0,
      "open_interest": 0,
      "liquidity": 0
    }
  ]
}
```

**Key Fields for Arbitrage**:
- `title` - Market title for matching
- `yes_bid` / `yes_ask` - YES prices in cents (0-100)
- `no_bid` / `no_ask` - NO prices in cents (0-100)
- `volume` - Total volume
- `ticker` - Unique market identifier

---

## 3. DFlow API (Tokenized Kalshi on Solana)

**Endpoint**: `https://dev-prediction-markets-api.dflow.net/api/v1/events`

**Sample Request**:
```bash
curl "https://dev-prediction-markets-api.dflow.net/api/v1/events?limit=3&sort=volume24h&withNestedMarkets=true"
```

**Sample Response**:
```json
{
  "events": [
    {
      "ticker": "KXFIRSTSUPERBOWLSONG-26FEB09",
      "seriesTicker": "KXFIRSTSUPERBOWLSONG",
      "title": "Bad Bunny's halftime opener?",
      "subtitle": "Bad Bunny setlist",
      "imageUrl": "https://kalshi-public-docs.s3.amazonaws.com/series-images-webp/KXFIRSTSUPERBOWLSONG.webp",
      "volume": 113517455,
      "volume24h": 74127035,
      "liquidity": 0,
      "openInterest": 103540367,
      "settlementSources": [
        {"name": "NBC", "url": "https://www.nbc.com/"},
        {"name": "NFL Superbowl Halftime", "url": "https://www.nfl.com/super-bowl/halftime-show"}
      ],
      "markets": [
        {
          "ticker": "KXFIRSTSUPERBOWLSONG-26FEB09-VOY",
          "eventTicker": "KXFIRSTSUPERBOWLSONG-26FEB09",
          "title": "Will VOY A LLeVARTE PA PR be the first song...",
          "status": "finalized",
          "result": "no",
          "volume": 6339049,
          "openInterest": 6149381
        }
      ]
    }
  ]
}
```

**Key Fields for Arbitrage**:
- `title` - Event title for matching
- `volume24h` - 24-hour volume (high liquidity indicator)
- `markets[].yesBid` / `yesAsk` - Prices for trading
- `markets[].accounts` - SPL token addresses for on-chain trading

---

## 4. Manifold API

**Endpoint**: `https://api.manifold.markets/v0/markets`

**Sample Request**:
```bash
curl "https://api.manifold.markets/v0/markets?limit=3"
```

**Sample Response**:
```json
[
  {
    "id": "CRgsddzPl2",
    "creatorUsername": "DaleKirkwood",
    "question": "Will the UK Produce more Solar Energy In February 2026 than February 2025?",
    "slug": "will-the-uk-produce-more-solar-ener-tgsq8C2s9C",
    "url": "https://manifold.markets/DaleKirkwood/will-the-uk-produce-more-solar-ener-tgsq8C2s9C",
    "pool": {"NO": 1000, "YES": 1000},
    "probability": 0.5,
    "totalLiquidity": 1000,
    "outcomeType": "BINARY",
    "mechanism": "cpmm-1",
    "volume": 0,
    "volume24Hours": 0,
    "isResolved": false,
    "uniqueBettorCount": 0
  }
]
```

**Key Fields for Arbitrage**:
- `question` - Market title for matching
- `probability` - YES price (0-1)
- `volume` - Total volume (note: Manifold uses play money)
- `totalLiquidity` - Available liquidity
- `url` - Direct link to market

**Note**: Manifold uses play money (mana), not real USD. Useful for price discovery but not real arbitrage.

---

## 5. Metaculus API

**Endpoint**: `https://www.metaculus.com/api2/questions`

**Sample Request**:
```bash
curl "https://www.metaculus.com/api2/questions/?limit=3&status=open"
```

**Sample Response**:
```json
{
  "count": 1198,
  "results": [
    {
      "id": 42088,
      "title": "Will the U.S. Supreme Court further cut back campaign finance limitations in NRSC v. FEC?",
      "short_title": "SCOTUS cut campaign finance limitations in NRSC v. FEC?",
      "slug": "scotus-cut-campaign-finance-limitations-in-nrsc-v-fec",
      "created_at": "2026-02-09T18:45:09.861028Z",
      "status": "open",
      "resolved": false,
      "scheduled_close_time": "2027-01-01T04:59:00Z",
      "nr_forecasters": 1,
      "projects": {
        "category": [
          {"name": "Politics", "slug": "politics"},
          {"name": "Law", "slug": "law"}
        ]
      }
    }
  ]
}
```

**Key Fields for Arbitrage**:
- `title` - Question for matching
- `nr_forecasters` - Number of forecasters (credibility indicator)
- `status` - open/closed/resolved

**Note**: Metaculus is a forecasting platform without real money. Used for research/calibration, not trading.

---

## Arbitrage Detection Algorithm

### How Markets Are Matched

```javascript
// Similarity matching: 40% sequence + 60% Jaccard
function calculateSimilarity(titleA, titleB) {
  const sequenceSim = longestCommonSubsequence(titleA, titleB);
  const jaccardSim = jaccardIndex(tokenize(titleA), tokenize(titleB));
  return 0.4 * sequenceSim + 0.6 * jaccardSim;
}

// Match threshold: 35% similarity minimum
const MATCH_THRESHOLD = 0.35;
```

### Arbitrage Calculation

```javascript
// Spread = |priceA - priceB|
// Profit % = spread / lower_price * 100

// Example:
// Polymarket: "Trump Epstein files" → YES @ 29.5%
// Kalshi: "Trump Epstein docs" → YES @ 1.0%
// Spread: 28.5%
// Strategy: Buy YES @ Kalshi (1.0%), Sell @ Polymarket (29.5%)
// Profit: 28.5% (minus fees)
```

---

## Live Arbitrage Opportunities Found

**Query**: "trump"
**Scan Time**: 2026-02-12T07:20:00Z

### Opportunity #1
| Field | Value |
|-------|-------|
| Topic | Will Trump deport 2,000,000 or more people? |
| Platform A | Polymarket |
| Platform B | Manifold |
| Price A (YES) | 0.2% |
| Price B (YES) | 77.0% |
| Spread | 76.8% |
| Profit Potential | 384% |
| Volume A | $363,934 |
| Volume B | $997,753 (play money) |
| Match Confidence | 50.7% |

**Note**: Low match confidence - these are different questions!

### Opportunity #2 (Better Match)
| Field | Value |
|-------|-------|
| Topic | Will Trump be named in Epstein files? |
| Platform A | Polymarket |
| Platform B | Kalshi |
| Price A (YES) | 29.5% |
| Price B (YES) | 1.0% |
| Spread | 28.5% |
| Profit Potential | 28.5% |
| Volume A | $10,000 |
| Volume B | $378,300 |
| Match Confidence | 41.8% |

**Strategy**: Buy YES @ Kalshi ($1.00), Sell @ Polymarket ($29.50)

---

## Platform Comparison

| Platform | Real Money | Fees | Liquidity | Best For |
|----------|-----------|------|-----------|----------|
| Polymarket | Yes (USDC) | 0.5% | High | Crypto events |
| Kalshi | Yes (USD) | 1% | Very High | US events, macro |
| DFlow | Yes (USDC/SOL) | 0.09% | Medium | On-chain trading |
| Manifold | No (Mana) | 0% | Low | Price discovery |
| Metaculus | No | 0% | N/A | Forecasting calibration |

---

## API Rate Limits

| Platform | Rate Limit | Auth for Higher Limits |
|----------|------------|------------------------|
| Polymarket | ~100/min | No |
| Kalshi | ~100/min | Yes (API key) |
| DFlow | 100/min | Yes (production key) |
| Manifold | ~60/min | No |
| Metaculus | ~60/min | No |

---

## Code Location

- **Arbitrage Skill**: `beright-ts/skills/arbitrage.ts`
- **Market Fetchers**: `beright-ts/skills/markets.ts`
- **Platform Config**: `beright-ts/config/platforms.ts`
- **Similarity Utils**: `beright-ts/skills/utils.ts`

---

## How to Run Arbitrage Scan

```bash
# Via CLI
npx ts-node skills/arbitrage.ts "fed rate"
npx ts-node skills/arbitrage.ts "trump"
npx ts-node skills/arbitrage.ts "bitcoin"

# Via Telegram Bot
/arb fed rate
/arb trump
/arb bitcoin

# Via API
GET /api/arbitrage?q=trump
```

---

## Limitations & Caveats

1. **Match Confidence**: Low confidence (<50%) means markets may not be the same question
2. **Manifold**: Play money only - can't execute real arbitrage
3. **Metaculus**: No trading - forecasting only
4. **Execution Risk**: Prices change fast; slippage may eat profits
5. **Fees**: Account for platform fees (0.5-1%) in profit calculations
6. **Liquidity**: Check volume before large trades
