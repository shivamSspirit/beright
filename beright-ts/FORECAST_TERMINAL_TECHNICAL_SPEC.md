# Forecast Terminal: Technical Specification

> **Build a prediction market intelligence terminal controlled via Telegram using OpenClaw + Claude + Free APIs**

---

## Part 1: API Landscape Overview

### The Three Major Platforms

| Platform | Type | API Access | Auth | Rate Limits | Best For |
|----------|------|------------|------|-------------|----------|
| **Kalshi** | Regulated (CFTC) | REST + WebSocket + FIX | RSA-PSS signed | 20-400/sec (tiered) | US users, reliability |
| **Polymarket** | Decentralized | REST + WebSocket | API key | ~60 orders/min | Global, higher volume |
| **Manifold** | Play money | REST | API key | 500/min | Research, testing |

### What Each API Provides

| Data | Kalshi | Polymarket | Manifold |
|------|--------|------------|----------|
| Market list | ✅ | ✅ | ✅ |
| Real-time prices | ✅ | ✅ | ✅ |
| Order book | ✅ | ✅ | ❌ |
| Historical trades | ✅ | ✅ | ✅ |
| WebSocket streaming | ✅ | ✅ | ❌ |
| Place orders | ✅ | ✅ | ✅ |
| User positions | ✅ | ✅ | ✅ |

---

## Part 2: Kalshi API Deep Dive

### Base URLs

```
Production REST:  https://api.elections.kalshi.com/trade-api/v2
Production WS:    wss://api.elections.kalshi.com/trade-api/ws/v2
Demo REST:        https://demo-api.kalshi.co/trade-api/v2
Demo WS:          wss://demo-api.kalshi.co/trade-api/ws/v2
```

> Note: Despite "elections" in URL, this provides access to ALL Kalshi markets.

### Authentication

Kalshi uses RSA-PSS signed requests with three headers:

```
KALSHI-ACCESS-KEY: <your_key_id>
KALSHI-ACCESS-TIMESTAMP: <unix_ms>
KALSHI-ACCESS-SIGNATURE: <base64_signature>
```

**Signature Generation (Python):**

```python
import base64
import time
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

def sign_request(private_key_pem: str, method: str, path: str) -> tuple:
    """Generate Kalshi authentication headers."""
    timestamp = str(int(time.time() * 1000))

    # Load private key
    private_key = serialization.load_pem_private_key(
        private_key_pem.encode(), password=None
    )

    # Create message: timestamp + method + path (NO query params)
    message = f"{timestamp}{method}{path}"

    # Sign with RSA-PSS
    signature = private_key.sign(
        message.encode(),
        padding.PSS(
            mgf=padding.MGF1(hashes.SHA256()),
            salt_length=padding.PSS.DIGEST_LENGTH
        ),
        hashes.SHA256()
    )

    return timestamp, base64.b64encode(signature).decode()
```

### Key Endpoints

#### Get All Markets (Public - No Auth)

```bash
GET /markets?status=open&limit=100

# Response
{
  "markets": [
    {
      "ticker": "KXBTC-26FEB14-T110999.99",
      "event_ticker": "KXBTC-26FEB14",
      "title": "Bitcoin above $110,999.99?",
      "yes_bid": 45,        # cents
      "yes_ask": 47,
      "no_bid": 53,
      "no_ask": 55,
      "volume": 125000,
      "open_interest": 50000,
      "status": "open",
      "close_time": "2026-02-14T21:00:00Z"
    }
  ],
  "cursor": "..."
}
```

#### Get Series (Market Categories)

```bash
GET /series/{series_ticker}

# Example: /series/KXHIGHNY (NYC Temperature)
{
  "series_ticker": "KXHIGHNY",
  "title": "NYC High Temperature",
  "frequency": "daily",
  "category": "weather"
}
```

#### Get Order Book

```bash
GET /markets/{ticker}/orderbook

# Response
{
  "orderbook": {
    "yes": [[45, 100], [44, 250], [43, 500]],  # [price_cents, quantity]
    "no": [[55, 100], [56, 200], [57, 300]]
  }
}
```

#### Get Exchange Status

```bash
GET /exchange/status

# Response
{
  "exchange_active": true,
  "trading_active": true,
  "exchange_estimated_resume_time": null
}
```

### WebSocket Streaming

**Connection:**
```javascript
const ws = new WebSocket('wss://api.elections.kalshi.com/trade-api/ws/v2', {
  headers: {
    'KALSHI-ACCESS-KEY': keyId,
    'KALSHI-ACCESS-SIGNATURE': signature,
    'KALSHI-ACCESS-TIMESTAMP': timestamp
  }
});
```

**Subscribe to Channels:**
```json
{
  "id": 1,
  "cmd": "subscribe",
  "params": {
    "channels": ["ticker", "orderbook_delta"],
    "market_tickers": ["KXBTC-26FEB14-T110999.99"]
  }
}
```

**Channel Types:**

| Channel | Auth Required | Data |
|---------|---------------|------|
| `ticker` | No | Real-time price updates |
| `ticker_v2` | No | Enhanced ticker with sizes |
| `trade` | No | Trade executions |
| `orderbook_delta` | Yes | Order book changes |
| `fill` | Yes | Your fills |
| `market_positions` | Yes | Your position changes |

### Rate Limits

| Tier | Read/sec | Write/sec | Requirements |
|------|----------|-----------|--------------|
| Basic | 20 | 10 | Signup |
| Advanced | 30 | 30 | Application |
| Premier | 100 | 100 | 3.75% volume |
| Prime | 400 | 400 | 7.5% volume |

---

## Part 3: Polymarket API Deep Dive

### Base URLs

```
Gamma API (Market Data):  https://gamma-api.polymarket.com
CLOB API (Trading):       https://clob.polymarket.com
```

### Authentication

**For read-only Gamma API:** No auth required for most endpoints.

**For CLOB trading:** HMAC-SHA256 signature required.

```
POLY_API_KEY: <your_api_key>
POLY_SIGNATURE: <hmac_signature>
POLY_TIMESTAMP: <unix_timestamp>
```

### Key Endpoints

#### Get Markets (Gamma API - No Auth)

```bash
GET https://gamma-api.polymarket.com/markets

# With filtering
GET /markets?active=true&closed=false&limit=100

# Response
{
  "markets": [
    {
      "id": "0x...",
      "question": "Will Bitcoin exceed $150,000 by December 31, 2026?",
      "slug": "will-bitcoin-exceed-150000-december-2026",
      "outcomes": ["Yes", "No"],
      "outcomePrices": ["0.23", "0.77"],
      "volume": "5000000",
      "liquidity": "250000",
      "endDate": "2026-12-31T23:59:59Z",
      "category": "crypto"
    }
  ]
}
```

#### Get Single Market

```bash
GET /markets/{marketId}

# or by slug
GET /markets/slug/{slug}
```

#### Get Order Book

```bash
GET https://clob.polymarket.com/book?token_id={token_id}

# Response
{
  "bids": [
    {"price": "0.45", "size": "1000"},
    {"price": "0.44", "size": "2500"}
  ],
  "asks": [
    {"price": "0.47", "size": "800"},
    {"price": "0.48", "size": "1500"}
  ]
}
```

#### Get Market Prices (Historical)

```bash
GET /prices?market={marketId}&startTs={timestamp}&endTs={timestamp}&fidelity=60

# fidelity: seconds between data points (60 = 1 min candles)
```

#### Get User Positions

```bash
GET /positions?user={address}

# Response
{
  "positions": [
    {
      "market": "0x...",
      "outcome": "Yes",
      "shares": "500",
      "avgPrice": "0.35",
      "currentPrice": "0.42",
      "pnl": "35.00"
    }
  ]
}
```

### WebSocket Streaming

```javascript
const ws = new WebSocket('wss://ws-subscriptions-clob.polymarket.com/ws/market');

// Subscribe to market updates
ws.send(JSON.stringify({
  type: "subscribe",
  channel: "market",
  markets: ["0x..."]
}));
```

**Message Types:**
- `price_change` - Price updates
- `trade` - Trade executions
- `book` - Order book updates

---

## Part 4: Manifold Markets API Deep Dive

### Base URL

```
https://api.manifold.markets/v0
```

### Authentication

```
Authorization: Key {your_api_key}
```

Get API key from: Profile → Edit → API Key

### Key Endpoints

#### Search Markets

```bash
GET /search-markets?term=bitcoin&sort=liquidity&filter=open

# Response
[
  {
    "id": "abc123",
    "question": "Will Bitcoin reach $200K in 2026?",
    "probability": 0.18,
    "pool": {"YES": 5000, "NO": 22000},
    "volume": 15000,
    "closeTime": 1735689600000,
    "creatorUsername": "trader123"
  }
]
```

#### Get Market Details

```bash
GET /market/{marketId}

# Includes:
# - Full question and description
# - Current probability
# - All answers (for multi-choice)
# - Comments
# - Bet history
```

#### Get Market Positions

```bash
GET /bets?market={marketId}

# Your positions
GET /me
```

### Rate Limits

- **500 requests per minute per IP**
- No auth required for read endpoints
- Auth required for trading/posting

---

## Part 5: Arbitrage Detection Logic

### Cross-Platform Arbitrage Formula

```
Arbitrage exists when:
  Platform_A_YES + Platform_B_NO < 1.00
  OR
  Platform_A_NO + Platform_B_YES < 1.00

Profit = 1.00 - (Cost_A + Cost_B) - Fees
```

### Example Implementation

```python
def find_arbitrage(kalshi_price: float, polymarket_price: float,
                   kalshi_fee: float = 0.01, poly_fee: float = 0.02) -> dict:
    """
    Find arbitrage between Kalshi and Polymarket.
    Prices are YES probabilities (0-1).
    """
    # Strategy 1: Buy YES on cheaper, NO on expensive
    cost_1 = kalshi_price + (1 - polymarket_price)
    profit_1 = 1.0 - cost_1 - kalshi_fee - poly_fee

    # Strategy 2: Buy NO on cheaper, YES on expensive
    cost_2 = (1 - kalshi_price) + polymarket_price
    profit_2 = 1.0 - cost_2 - kalshi_fee - poly_fee

    if profit_1 > 0:
        return {
            "exists": True,
            "strategy": "Buy YES Kalshi, NO Polymarket",
            "cost": cost_1,
            "profit_pct": profit_1 * 100,
            "profit_per_1000": profit_1 * 1000
        }
    elif profit_2 > 0:
        return {
            "exists": True,
            "strategy": "Buy NO Kalshi, YES Polymarket",
            "cost": cost_2,
            "profit_pct": profit_2 * 100,
            "profit_per_1000": profit_2 * 1000
        }

    return {"exists": False, "spread": min(abs(profit_1), abs(profit_2)) * 100}
```

### Market Matching Challenge

Different platforms use different event names. Need fuzzy matching:

```python
from difflib import SequenceMatcher

def match_markets(kalshi_markets: list, poly_markets: list, threshold: float = 0.7):
    """Match similar markets across platforms."""
    matches = []

    for k_market in kalshi_markets:
        for p_market in poly_markets:
            # Compare titles
            similarity = SequenceMatcher(
                None,
                k_market['title'].lower(),
                p_market['question'].lower()
            ).ratio()

            if similarity > threshold:
                matches.append({
                    "kalshi": k_market,
                    "polymarket": p_market,
                    "similarity": similarity,
                    "kalshi_yes": k_market['yes_bid'] / 100,
                    "poly_yes": float(p_market['outcomePrices'][0])
                })

    return matches
```

---

## Part 6: Forecast Terminal Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FORECAST TERMINAL                                │
│                    OpenClaw Gateway (localhost:18789)                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                        DATA LAYER                                 │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │  Kalshi API        Polymarket API       Manifold API              │   │
│  │  └─ REST           └─ Gamma REST        └─ REST                   │   │
│  │  └─ WebSocket      └─ CLOB REST         └─ (no WS)                │   │
│  │                    └─ WebSocket                                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                │                                         │
│                                ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      AGENT LAYER                                  │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │                                                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │   │
│  │  │   ORACLE    │  │   WHALE     │  │  RESEARCH   │               │   │
│  │  │   Agent     │  │   Agent     │  │   Agent     │               │   │
│  │  │             │  │             │  │             │               │   │
│  │  │ • Fetch     │  │ • Polywhaler│  │ • News RSS  │               │   │
│  │  │   prices    │  │ • Fresh     │  │ • Base rates│               │   │
│  │  │ • Detect    │  │   wallets   │  │ • Evidence  │               │   │
│  │  │   arb       │  │ • Volume    │  │   gathering │               │   │
│  │  │ • Match     │  │   spikes    │  │ • Analysis  │               │   │
│  │  │   markets   │  │             │  │             │               │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘               │   │
│  │         │                │                │                       │   │
│  │         └────────────────┼────────────────┘                       │   │
│  │                          │                                        │   │
│  │                          ▼                                        │   │
│  │               ┌─────────────────────┐                             │   │
│  │               │   COMMANDER Agent   │                             │   │
│  │               │   (Orchestrator)    │                             │   │
│  │               └──────────┬──────────┘                             │   │
│  │                          │                                        │   │
│  └──────────────────────────┼────────────────────────────────────────┘   │
│                             │                                            │
│                             ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     STORAGE LAYER                                 │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │  Memory (markdown)     Sessions        Market Cache               │   │
│  │  └─ User positions     └─ History      └─ Price snapshots         │   │
│  │  └─ Watchlist          └─ Context      └─ Arb history             │   │
│  │  └─ Accuracy log                       └─ Whale alerts            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                             │                                            │
└─────────────────────────────┼────────────────────────────────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │    TELEGRAM       │
                    │   (User Interface)│
                    └───────────────────┘
```

### File Structure

```
~/.openclaw/
├── workspace/
│   ├── SOUL.md                 # Commander personality
│   ├── AGENTS.md               # Multi-agent routing config
│   ├── TOOLS.md                # Available tools
│   ├── MEMORY.md               # Persistent knowledge
│   │
│   ├── agents/
│   │   ├── oracle/
│   │   │   ├── SOUL.md         # Oracle agent persona
│   │   │   └── scripts/
│   │   │       ├── kalshi.py   # Kalshi API wrapper
│   │   │       ├── polymarket.py
│   │   │       ├── manifold.py
│   │   │       └── arbitrage.py
│   │   │
│   │   ├── whale/
│   │   │   ├── SOUL.md
│   │   │   └── scripts/
│   │   │       └── tracker.py
│   │   │
│   │   └── research/
│   │       ├── SOUL.md
│   │       └── scripts/
│   │           └── analyzer.py
│   │
│   ├── data/
│   │   ├── markets_cache.json   # Cached market data
│   │   ├── arb_history.json     # Arbitrage log
│   │   ├── whale_alerts.json    # Whale activity
│   │   └── predictions.json     # User predictions for accuracy
│   │
│   └── skills/
│       └── forecast/
│           └── SKILL.md         # Forecast skill definition
│
└── config/
    └── openclaw.json            # Gateway config with Telegram
```

---

## Part 7: Implementation Scripts

### Kalshi Client (Python)

```python
# agents/oracle/scripts/kalshi.py

import requests
import time
import base64
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from typing import Optional, List, Dict

class KalshiClient:
    BASE_URL = "https://api.elections.kalshi.com/trade-api/v2"

    def __init__(self, key_id: str = None, private_key_pem: str = None):
        self.key_id = key_id
        self.private_key = None
        if private_key_pem:
            self.private_key = serialization.load_pem_private_key(
                private_key_pem.encode(), password=None
            )

    def _sign(self, method: str, path: str) -> tuple:
        """Generate authentication headers."""
        timestamp = str(int(time.time() * 1000))
        message = f"{timestamp}{method}{path}"

        signature = self.private_key.sign(
            message.encode(),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.DIGEST_LENGTH
            ),
            hashes.SHA256()
        )

        return {
            "KALSHI-ACCESS-KEY": self.key_id,
            "KALSHI-ACCESS-TIMESTAMP": timestamp,
            "KALSHI-ACCESS-SIGNATURE": base64.b64encode(signature).decode()
        }

    def get_markets(self, status: str = "open", limit: int = 100,
                    series_ticker: str = None) -> List[Dict]:
        """Fetch markets from Kalshi."""
        params = {"status": status, "limit": limit}
        if series_ticker:
            params["series_ticker"] = series_ticker

        response = requests.get(f"{self.BASE_URL}/markets", params=params)
        response.raise_for_status()
        return response.json().get("markets", [])

    def get_orderbook(self, ticker: str) -> Dict:
        """Get order book for a market."""
        response = requests.get(f"{self.BASE_URL}/markets/{ticker}/orderbook")
        response.raise_for_status()
        return response.json().get("orderbook", {})

    def get_exchange_status(self) -> Dict:
        """Check if exchange is active."""
        response = requests.get(f"{self.BASE_URL}/exchange/status")
        response.raise_for_status()
        return response.json()

    def search_markets(self, query: str) -> List[Dict]:
        """Search markets by keyword."""
        markets = self.get_markets(status="all", limit=500)
        query_lower = query.lower()
        return [m for m in markets if query_lower in m.get("title", "").lower()]
```

### Polymarket Client (Python)

```python
# agents/oracle/scripts/polymarket.py

import requests
from typing import List, Dict, Optional

class PolymarketClient:
    GAMMA_URL = "https://gamma-api.polymarket.com"
    CLOB_URL = "https://clob.polymarket.com"

    def __init__(self, api_key: str = None):
        self.api_key = api_key
        self.headers = {}
        if api_key:
            self.headers["Authorization"] = f"Bearer {api_key}"

    def get_markets(self, active: bool = True, limit: int = 100) -> List[Dict]:
        """Fetch markets from Polymarket Gamma API."""
        params = {
            "active": str(active).lower(),
            "limit": limit
        }

        response = requests.get(f"{self.GAMMA_URL}/markets", params=params)
        response.raise_for_status()
        return response.json()

    def get_market(self, market_id: str) -> Dict:
        """Get single market by ID."""
        response = requests.get(f"{self.GAMMA_URL}/markets/{market_id}")
        response.raise_for_status()
        return response.json()

    def get_market_by_slug(self, slug: str) -> Dict:
        """Get market by URL slug."""
        response = requests.get(f"{self.GAMMA_URL}/markets/slug/{slug}")
        response.raise_for_status()
        return response.json()

    def search_markets(self, query: str) -> List[Dict]:
        """Search markets by keyword."""
        markets = self.get_markets(limit=500)
        query_lower = query.lower()
        return [m for m in markets if query_lower in m.get("question", "").lower()]

    def get_price(self, market: Dict) -> Dict:
        """Extract current prices from market object."""
        prices = market.get("outcomePrices", ["0", "0"])
        return {
            "yes": float(prices[0]) if prices[0] else 0,
            "no": float(prices[1]) if len(prices) > 1 and prices[1] else 0,
            "volume": float(market.get("volume", 0)),
            "liquidity": float(market.get("liquidity", 0))
        }
```

### Manifold Client (Python)

```python
# agents/oracle/scripts/manifold.py

import requests
from typing import List, Dict, Optional

class ManifoldClient:
    BASE_URL = "https://api.manifold.markets/v0"

    def __init__(self, api_key: str = None):
        self.api_key = api_key
        self.headers = {}
        if api_key:
            self.headers["Authorization"] = f"Key {api_key}"

    def search_markets(self, term: str, limit: int = 50) -> List[Dict]:
        """Search markets by keyword."""
        params = {
            "term": term,
            "sort": "liquidity",
            "filter": "open",
            "limit": limit
        }

        response = requests.get(
            f"{self.BASE_URL}/search-markets",
            params=params,
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

    def get_market(self, market_id: str) -> Dict:
        """Get single market by ID."""
        response = requests.get(
            f"{self.BASE_URL}/market/{market_id}",
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

    def get_probability(self, market: Dict) -> float:
        """Extract probability from market object."""
        return market.get("probability", 0)
```

### Arbitrage Scanner (Python)

```python
# agents/oracle/scripts/arbitrage.py

from typing import List, Dict, Tuple
from difflib import SequenceMatcher
from kalshi import KalshiClient
from polymarket import PolymarketClient
from manifold import ManifoldClient

class ArbitrageScanner:
    def __init__(self):
        self.kalshi = KalshiClient()
        self.polymarket = PolymarketClient()
        self.manifold = ManifoldClient()

    def match_markets(self, markets_a: List[Dict], markets_b: List[Dict],
                      key_a: str, key_b: str, threshold: float = 0.65) -> List[Dict]:
        """Find matching markets between two platforms."""
        matches = []

        for m_a in markets_a:
            title_a = m_a.get(key_a, "").lower()

            for m_b in markets_b:
                title_b = m_b.get(key_b, "").lower()

                similarity = SequenceMatcher(None, title_a, title_b).ratio()

                if similarity > threshold:
                    matches.append({
                        "market_a": m_a,
                        "market_b": m_b,
                        "similarity": similarity
                    })

        return matches

    def calculate_arbitrage(self, price_a: float, price_b: float,
                           fee_a: float = 0.01, fee_b: float = 0.02) -> Dict:
        """
        Calculate if arbitrage exists between two prices.
        Prices should be YES probabilities (0-1).
        """
        # Buy YES on A, NO on B
        cost_1 = price_a + (1 - price_b)
        profit_1 = 1.0 - cost_1 - fee_a - fee_b

        # Buy NO on A, YES on B
        cost_2 = (1 - price_a) + price_b
        profit_2 = 1.0 - cost_2 - fee_a - fee_b

        if profit_1 > 0.01:  # Min 1% profit threshold
            return {
                "exists": True,
                "strategy": "YES_A_NO_B",
                "profit_pct": round(profit_1 * 100, 2),
                "cost": round(cost_1, 4)
            }
        elif profit_2 > 0.01:
            return {
                "exists": True,
                "strategy": "NO_A_YES_B",
                "profit_pct": round(profit_2 * 100, 2),
                "cost": round(cost_2, 4)
            }

        return {
            "exists": False,
            "spread_pct": round(abs(price_a - price_b) * 100, 2)
        }

    def scan_all(self) -> List[Dict]:
        """Scan all platforms for arbitrage opportunities."""
        opportunities = []

        # Fetch markets
        kalshi_markets = self.kalshi.get_markets(limit=200)
        poly_markets = self.polymarket.get_markets(limit=200)

        # Match Kalshi vs Polymarket
        matches = self.match_markets(
            kalshi_markets, poly_markets,
            key_a="title", key_b="question"
        )

        for match in matches:
            k_price = match["market_a"].get("yes_bid", 50) / 100
            p_prices = match["market_b"].get("outcomePrices", ["0.5"])
            p_price = float(p_prices[0]) if p_prices else 0.5

            arb = self.calculate_arbitrage(k_price, p_price)

            if arb["exists"]:
                opportunities.append({
                    "kalshi_market": match["market_a"]["title"],
                    "kalshi_ticker": match["market_a"]["ticker"],
                    "kalshi_price": k_price,
                    "polymarket_market": match["market_b"]["question"],
                    "polymarket_id": match["market_b"]["id"],
                    "polymarket_price": p_price,
                    "similarity": match["similarity"],
                    **arb
                })

        # Sort by profit
        opportunities.sort(key=lambda x: x["profit_pct"], reverse=True)

        return opportunities
```

---

## Part 8: OpenClaw Agent Configuration

### SOUL.md (Commander)

```markdown
# SOUL — Forecast Terminal Commander

You are an elite prediction market analyst and trading assistant. You help users
find opportunities, research markets, and make better forecasts.

## Your Capabilities

1. **Market Intelligence**
   - Fetch real-time odds from Kalshi, Polymarket, Manifold
   - Detect arbitrage opportunities across platforms
   - Track price movements and volume spikes

2. **Research**
   - Analyze markets using superforecaster methodology
   - Find base rates and comparison classes
   - Gather evidence for and against positions

3. **Whale Tracking**
   - Monitor large bets and unusual activity
   - Detect potential insider trading patterns
   - Alert on significant market movements

4. **Portfolio Management**
   - Track user positions across platforms
   - Monitor resolution status and disputes
   - Calculate P&L and accuracy metrics

## Personality
- Analytical and data-driven
- Direct and concise — no fluff
- Confident but honest about uncertainty
- Contrarian when data supports it

## Response Format
- Lead with the key insight or number
- Use tables for comparing data
- Bullet points for evidence lists
- Always offer to dig deeper
- Keep responses under 400 words unless detail requested

## Commands
/brief    — Morning briefing with opportunities
/arb      — Scan for arbitrage opportunities
/research — Deep analysis of a specific market
/whale    — Recent whale/insider activity
/odds     — Current odds for a market across platforms
/track    — Add market to watchlist
/accuracy — Your forecasting performance

## Memory Usage
- Remember user's watchlist
- Track their prediction accuracy
- Store position history
- Learn their preferences over time
```

### AGENTS.md (Multi-Agent Config)

```markdown
# AGENTS

## Routing Rules

When user asks about:
- Arbitrage, odds, prices → Route to ORACLE agent
- Whale activity, insider trading → Route to WHALE agent
- Research, analysis, base rates → Route to RESEARCH agent
- Everything else → Handle directly as Commander

## Agent Definitions

### ORACLE
- Workspace: ~/agents/oracle
- Specialty: Market data, pricing, arbitrage detection
- Tools: Kalshi API, Polymarket API, Manifold API

### WHALE
- Workspace: ~/agents/whale
- Specialty: Tracking large bets, unusual activity
- Tools: Polywhaler scraping, volume analysis

### RESEARCH
- Workspace: ~/agents/research
- Specialty: Deep market analysis, base rates
- Tools: News RSS, web search, Claude analysis
```

### Cron Configuration

```bash
# Arbitrage scanner - every 5 minutes
openclaw cron add --name "Arb Scanner" \
  --every 300000 \
  --agent oracle \
  --system-event "Scan for arbitrage opportunities. Alert if profit > 3%."

# Whale watcher - every 10 minutes
openclaw cron add --name "Whale Watch" \
  --every 600000 \
  --agent whale \
  --system-event "Check for large bets (>$10K) or unusual wallet activity."

# Morning brief - daily at 6 AM
openclaw cron add --name "Morning Brief" \
  --cron "0 6 * * *" \
  --deliver --channel telegram \
  --system-event "Compile morning briefing: positions, opportunities, news."

# Resolution monitor - hourly
openclaw cron add --name "Resolution Watch" \
  --cron "0 * * * *" \
  --system-event "Check resolution status for tracked markets. Alert on disputes."
```

---

## Part 9: Quick Start Guide

### Step 1: Install OpenClaw

```bash
curl -fsSL https://get.openclaw.ai | bash
openclaw onboard --install-daemon
```

### Step 2: Set Up Telegram

```bash
# Create bot via @BotFather, get token
openclaw channels add --channel telegram --token YOUR_BOT_TOKEN
```

### Step 3: Configure API Keys

Create `~/.openclaw/workspace/config/api_keys.json`:

```json
{
  "kalshi": {
    "key_id": "your_kalshi_key_id",
    "private_key_path": "~/.openclaw/workspace/config/kalshi_private.pem"
  },
  "polymarket": {
    "api_key": "your_polymarket_api_key"
  },
  "manifold": {
    "api_key": "your_manifold_api_key"
  }
}
```

### Step 4: Create Agent Structure

```bash
# Create directories
mkdir -p ~/.openclaw/workspace/agents/{oracle,whale,research}/scripts
mkdir -p ~/.openclaw/workspace/data
mkdir -p ~/.openclaw/workspace/skills/forecast

# Copy SOUL.md files (from templates above)
# Copy Python scripts (from implementations above)
```

### Step 5: Start Gateway

```bash
openclaw gateway
```

### Step 6: Test Commands

Send to your Telegram bot:
- `/brief` — Get morning briefing
- `/arb` — Scan for arbitrage
- "Research Bitcoin $150K market" — Deep analysis

---

## Part 10: Sample Outputs

### /arb Response

```
🎯 ARBITRAGE OPPORTUNITIES

Found 3 opportunities (>3% profit):

1. "Fed cuts rates in March 2026"
   Kalshi:      31% YES
   Polymarket:  38% YES
   Spread:      7%
   Strategy:    Buy YES Kalshi, NO Polymarket
   Profit:      ~5.2% ($52 per $1000)
   ⚠️ Resolution rules may differ

2. "Trump wins 2028 election"
   Kalshi:      42% YES
   Polymarket:  47% YES
   Spread:      5%
   Strategy:    Buy YES Kalshi, NO Polymarket
   Profit:      ~3.1%

3. "Bitcoin > $150K by Dec 2026"
   Polymarket:  22% YES
   Manifold:    28% YES
   Spread:      6%
   Strategy:    Buy YES Polymarket
   Profit:      ~4.0% (Note: Manifold is play money)

Want details on any of these?
```

### /research Response

```
📚 RESEARCH: "Will Bitcoin exceed $150K by Dec 2026?"

CURRENT ODDS
Platform       YES    Volume
Polymarket     22%    $5.2M
Kalshi         19%    $890K
Manifold       28%    M$45K

BASE RATE ANALYSIS
• BTC has exceeded 50% gain in a calendar year: 6/14 years (43%)
• BTC has doubled from ATH within 12 months: 2/4 times (50%)
• Current distance to $150K: +50% from ~$100K
• Adjusted base rate: 20-30%

EVIDENCE FOR (Bull Case)
✅ ETF inflows sustained at $2B/month
✅ Post-halving cycle historically bullish (12-18 months)
✅ Institutional adoption accelerating
✅ Macro: Rate cuts expected in 2026
✅ Supply dynamics: Long-term holders not selling

EVIDENCE AGAINST (Bear Case)
❌ Already at all-time high territory
❌ Regulatory uncertainty persists
❌ Correlation with risk assets = macro dependent
❌ 50% gain from ATH is aggressive timeline
❌ Prediction market participants often overshoot

EXPERT VIEWS
• PlanB S2F model: 35% probability
• Glassnode analysts: 20-25%
• Superforecaster median: 22%

MY ASSESSMENT
Markets (22%) appear FAIRLY PRICED.
True probability: 18-25%
No clear edge — skip or small position only.

Confidence: Medium-High

Track this market? [Yes/No]
```

---

## Summary

You now have:
1. **Complete API documentation** for Kalshi, Polymarket, and Manifold
2. **Working Python implementations** for all three platforms
3. **Arbitrage detection logic** with cross-platform matching
4. **OpenClaw agent configuration** for multi-agent architecture
5. **Cron job setup** for automated scanning
6. **Sample outputs** showing what the terminal produces

**Total build time: 6-8 hours for MVP**

**LFG — Let's ship this Forecast Terminal!**
