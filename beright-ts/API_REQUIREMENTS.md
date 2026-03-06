# BeRight API & Integration Requirements

## Current Status vs Required

### Already Integrated (Working)
| Service | API Key Env Var | Status | Notes |
|---------|-----------------|--------|-------|
| Groq LLM | `GROQ_API_KEY` | Active | Fast inference |
| Supabase | `SUPABASE_*` | Active | Database + pgvector |
| Telegram | `TELEGRAM_BOT_TOKEN` | Active | Bot gateway |
| Tavily | `TAVILY_API_KEY` | Active | Web search |
| Helius | `HELIUS_API_KEY` | Active | Solana RPC |
| Kalshi | `KALSHI_API_*` | Active | Trading API |

### Partially Integrated (Need Enhancement)
| Service | Current | Required | Priority |
|---------|---------|----------|----------|
| Polymarket | Read-only via aggregator | CLOB trading API | High |
| Manifold | Basic read | Full API integration | Medium |
| DFlow | Basic client | Enhanced trading | Low |

---

## NEW API INTEGRATIONS REQUIRED

### Tier 1: Critical (Phase 1-2)

#### 1. Polymarket CLOB API
```
Endpoint: https://clob.polymarket.com
Docs: https://docs.polymarket.com/
Auth: API Key + Signature (ECDSA)

Required for:
- Real-time orderbook data
- Trade execution
- Position management
- Market creation events

Env vars needed:
POLYMARKET_API_KEY=
POLYMARKET_PRIVATE_KEY=
POLYMARKET_FUNDER=
```

#### 2. Gamma Markets API (Polymarket Orderbook)
```
Endpoint: https://gamma-api.polymarket.com
Docs: https://github.com/Polymarket/py-clob-client

Required for:
- Order placement
- Cancel orders
- Order status
- Fill history

No additional auth - uses same Polymarket credentials
```

#### 3. Arkham Intelligence API
```
Endpoint: https://api.arkhamintelligence.com
Docs: https://docs.arkhamintelligence.com/
Auth: API Key

Required for:
- Whale wallet tracking
- Large transaction alerts
- Entity identification
- Smart money flow

Env vars needed:
ARKHAM_API_KEY=

Pricing: $300/month for API access
Alternative: Scrape public interface (rate limited)
```

### Tier 2: Important (Phase 2-3)

#### 4. Twitter/X API v2
```
Endpoint: https://api.twitter.com/2
Docs: https://developer.twitter.com/en/docs/twitter-api

Required for:
- Real-time sentiment
- Breaking news detection
- Influencer tracking
- Social volume metrics

Env vars needed:
TWITTER_BEARER_TOKEN=
TWITTER_API_KEY=
TWITTER_API_SECRET=

Pricing: Basic $100/month, Pro $5000/month
Alternative: Nitter scraping, Social Blade
```

#### 5. Kalshi Trading API (Enhanced)
```
Endpoint: https://trading-api.kalshi.com
Docs: https://trading-api.kalshi.com/docs/
Auth: Email/Password + API Key

Already have basic integration. Need:
- Websocket for real-time
- Order placement
- Position sync
- Auto-settlement detection

Env vars (already have):
KALSHI_API_KEY=
KALSHI_API_SECRET=
KALSHI_EMAIL=
```

#### 6. Manifold API
```
Endpoint: https://api.manifold.markets/v0
Docs: https://docs.manifold.markets/api

Required for:
- Market data (free)
- Trading (requires auth)
- User portfolio
- Leaderboard data

Env vars needed:
MANIFOLD_API_KEY= (from profile settings)

Pricing: Free
```

### Tier 3: Nice to Have (Phase 4+)

#### 7. Metaculus API
```
Endpoint: https://www.metaculus.com/api/v2
Docs: https://www.metaculus.com/api-docs/

Required for:
- Expert forecasts
- Resolution data
- Calibration benchmarks

Auth: Session token
Env vars needed:
METACULUS_TOKEN=

Pricing: Free for read, contact for write
```

#### 8. Dune Analytics API
```
Endpoint: https://api.dune.com/api/v1
Docs: https://dune.com/docs/api/

Required for:
- On-chain metrics
- Historical volume
- Wallet analytics
- Custom queries

Env vars needed:
DUNE_API_KEY=

Pricing: Free tier available, Pro $349/month
```

#### 9. Perplexity API
```
Endpoint: https://api.perplexity.ai
Docs: https://docs.perplexity.ai/

Required for:
- Real-time web search
- News synthesis
- Fact checking

Env vars needed:
PERPLEXITY_API_KEY=

Pricing: $0.005/query
Alternative: Already have Tavily
```

#### 10. CoinGecko API
```
Endpoint: https://api.coingecko.com/api/v3
Docs: https://www.coingecko.com/en/api/documentation

Required for:
- Crypto price feeds
- Market cap data
- Volume metrics

Env vars needed:
COINGECKO_API_KEY= (optional, free tier available)

Pricing: Free tier, Pro $129/month
```

---

## WEBSOCKET CONNECTIONS REQUIRED

### Real-time Data Feeds

| Service | Endpoint | Purpose |
|---------|----------|---------|
| Polymarket | wss://ws-subscriptions-clob.polymarket.com | Orderbook, trades |
| Kalshi | wss://trading-api.kalshi.com/trade-api/ws/v2 | Orders, positions |
| Pyth | wss://hermes.pyth.network/ws | Price oracle |

---

## AGGREGATOR APIs (No Auth Required)

These public APIs can be used immediately:

| Service | Endpoint | Data |
|---------|----------|------|
| Polymarket Markets | https://polymarket.com/api/markets | Market list |
| Polymarket Events | https://polymarket.com/api/events | Events |
| PMXT | Internal aggregator | Cross-platform |
| PolyRouter | Internal aggregator | Best prices |
| CoinGecko (free) | https://api.coingecko.com/api/v3 | Crypto prices |

---

## ALTERNATIVE/BACKUP SOURCES

If primary APIs are unavailable:

| Primary | Backup | Notes |
|---------|--------|-------|
| Arkham | Etherscan + heuristics | Less accurate |
| Twitter | Nitter + Reddit | Slower |
| Tavily | Perplexity or Bing | Similar cost |
| Polymarket CLOB | Public REST API | Read-only |

---

## ENV FILE TEMPLATE

Add these to `.env`:

```bash
# === EXISTING (WORKING) ===
GROQ_API_KEY=your_key_here
SUPABASE_URL=your_url_here
SUPABASE_ANON_KEY=your_key_here
SUPABASE_SERVICE_ROLE_KEY=your_key_here
TELEGRAM_BOT_TOKEN=your_token_here
TAVILY_API_KEY=your_key_here
HELIUS_API_KEY=your_key_here
KALSHI_API_KEY=your_key_here
KALSHI_API_SECRET=your_secret_here

# === NEW - TIER 1 (CRITICAL) ===
POLYMARKET_API_KEY=
POLYMARKET_PRIVATE_KEY=
POLYMARKET_FUNDER=

ARKHAM_API_KEY=

# === NEW - TIER 2 (IMPORTANT) ===
TWITTER_BEARER_TOKEN=
TWITTER_API_KEY=
TWITTER_API_SECRET=

MANIFOLD_API_KEY=

# === NEW - TIER 3 (NICE TO HAVE) ===
METACULUS_TOKEN=
DUNE_API_KEY=
PERPLEXITY_API_KEY=
COINGECKO_API_KEY=
```

---

## COST ESTIMATES (Monthly)

| Service | Tier | Monthly Cost | Notes |
|---------|------|--------------|-------|
| Groq | Free | $0 | Generous free tier |
| Supabase | Pro | $25 | Current plan |
| Tavily | Starter | $0-100 | Depends on volume |
| Arkham | API | $300 | If needed |
| Twitter | Basic | $100 | Minimum for real-time |
| Dune | Free | $0 | Start with free |
| **Total** | | **$425-525** | Core infrastructure |

---

## REGISTRATION LINKS

| Service | Sign Up URL |
|---------|-------------|
| Polymarket | https://polymarket.com/ (need wallet) |
| Arkham | https://www.arkhamintelligence.com/ |
| Twitter Dev | https://developer.twitter.com/ |
| Manifold | https://manifold.markets/ |
| Metaculus | https://www.metaculus.com/ |
| Dune | https://dune.com/ |
| Perplexity | https://www.perplexity.ai/api |
| CoinGecko | https://www.coingecko.com/en/api |

---

## SDK/CLIENT LIBRARIES

### NPM Packages to Add

```bash
# Polymarket CLOB
npm install @polymarket/clob-client

# Twitter (already may have)
npm install twitter-api-v2

# Dune (if needed)
npm install @duneanalytics/client-sdk

# WebSocket handling (probably have)
npm install ws

# Rate limiting
npm install bottleneck
```

---

## NOTES

1. **Start without waiting for keys** - Build with fallbacks and mock data
2. **Use existing aggregators** - `lib/data/aggregators/` already has good coverage
3. **Progressive enhancement** - Each API adds capability, nothing breaks without it
4. **Cache aggressively** - Reduce API calls, most market data is fine with 30s delay
5. **Webhook-first** - Prefer webhooks over polling where available
