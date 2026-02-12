# DFlow Research - OpenClaw Integration

This document details the DFlow API capabilities and integration plan for OpenClaw/BeRight Protocol.

## Overview

DFlow provides a unified API for tokenized prediction markets on Solana. It wraps Kalshi markets as SPL tokens, enabling:
- **On-chain trading** via wallet signing (no API keys for users)
- **Free API access** for data fetching (no auth needed for dev endpoints)
- **Live orderbook data** with real-time WebSocket updates
- **Direct trading** from any spot token (SOL, USDC) to outcome tokens

## API Endpoints

### Base URLs

| Service | URL | Auth | Purpose |
|---------|-----|------|---------|
| **Trade API** | `https://quote-api.dflow.net` | x-api-key (optional) | Trading, swaps, orders |
| **Dev Trade API** | `https://dev-quote-api.dflow.net` | None (rate limited) | Dev/testing trading |
| **Metadata API** | `https://dev-prediction-markets-api.dflow.net` | x-api-key (optional) | Market data, events, trades |

### Authentication

- **Dev endpoints**: No auth required (rate limited, suitable for testing)
- **Production**: Request API key via form, use header `x-api-key: YOUR_KEY`
- **User trading**: No API key needed - users sign transactions with their wallet

---

## Metadata API Endpoints

### Events

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/events` | GET | List all events with markets |
| `/api/v1/events?withNestedMarkets=true` | GET | Include full market data |
| `/api/v1/event/{ticker}` | GET | Single event details |
| `/api/v1/event/{ticker}/candlesticks` | GET | OHLCV price history |
| `/api/v1/forecast_percentile_history/{ticker}` | GET | Forecast percentiles |
| `/api/v1/forecast_percentile_history/by-mint/{mint}` | GET | By outcome mint |

**Query Params** (events):
- `limit` (int): Max results
- `cursor` (int): Pagination offset
- `withNestedMarkets` (bool): Include markets
- `isInitialized` (bool): Filter by initialization
- `status`: initialized, active, inactive, closed, determined
- `seriesTickers`: Comma-separated series filter
- `sort`: volume, volume24h, liquidity, openInterest, startDate
- `order`: asc, desc

### Markets

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/markets` | GET | List markets |
| `/api/v1/market/{ticker}` | GET | Single market |
| `/api/v1/market/by-mint/{mint}` | GET | Market by outcome mint |
| `/api/v1/markets/batch` | POST | Batch fetch by mints |
| `/api/v1/market/{ticker}/candlesticks` | GET | OHLCV data |
| `/api/v1/outcome_mints/{ticker}` | GET | Get outcome token addresses |
| `/api/v1/filter_outcome_mints` | POST | Filter wallet tokens |

**Query Params** (markets):
- `limit`, `cursor`: Pagination
- `isInitialized`, `status`: Filters
- `sort`, `order`: Sorting

### Search

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/search?q={query}` | GET | Search events by title/ticker |

**Query Params**:
- `q` (required): Search query
- `withNestedMarkets` (bool): Include markets
- `withMarketAccounts` (bool): Include token addresses
- `sort`, `order`, `limit`, `cursor`

### Orderbook

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/orderbook/{market_ticker}` | GET | By market ticker |
| `/api/v1/orderbook/by-mint/{mint}` | GET | By outcome mint |

### Trades

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/trades` | GET | Recent trades |
| `/api/v1/trades/by-mint/{mint}` | GET | Trades for specific mint |

**Query Params**:
- `ticker`: Filter by market
- `limit` (1-1000, default 100)
- `cursor`: Pagination
- `minTs`, `maxTs`: Time range (Unix)

### Live Data (from Kalshi)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/live_data?milestoneIds=[]` | GET | Live Kalshi data |
| `/api/v1/live_data/by-event/{ticker}` | GET | By event |
| `/api/v1/live_data/by-mint/{mint}` | GET | By mint |

### Series & Tags

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/series` | GET | List event templates |
| `/api/v1/series/{ticker}` | GET | Single series |
| `/api/v1/tags_by_categories` | GET | All categories/tags |
| `/api/v1/filters_by_sports` | GET | Sports filtering |

---

## Trading API Endpoints

### Order (Primary - Recommended)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/order` | GET | Get swap transaction |
| `/order-status?signature={sig}` | GET | Check order status |

**Order Params** (required):
- `inputMint`: Source token (e.g., SOL, USDC)
- `outputMint`: Destination token (outcome or settlement mint)
- `amount`: Amount in atomic units (scaled by decimals)

**Order Params** (optional):
- `userPublicKey`: Wallet address (enables transaction in response)
- `slippageBps`: Max slippage (or "auto")
- `predictionMarketSlippageBps`: PM-specific slippage
- `platformFeeBps`, `platformFeeScale`, `feeAccount`: Fee config
- `prioritizationFeeLamports`: Transaction priority
- `destinationTokenAccount`: Custom output destination

**Response**:
```typescript
{
  inputMint: string,
  inAmount: string,
  outputMint: string,
  outAmount: string,
  otherAmountThreshold: string,
  slippageBps: number,
  priceImpactPct: string,
  routePlan: Array<{...}>,
  transaction: string, // Base64 encoded, sign & send
  executionMode: string,
  contextSlot: number
}
```

### Order Status

**Response**:
```typescript
{
  status: 'pending' | 'expired' | 'failed' | 'open' | 'pendingClose' | 'closed',
  inAmount: string,
  outAmount: string,
  fills: Array<{ signature, inputMint, inAmount, outputMint, outAmount }>,
  reverts: Array<{ signature, mint, amount }>
}
```

### Market Initialization

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/prediction-market-init` | GET | Initialize market for trading |

**Params**: `payer` (wallet), `outcomeMint` (token address)

---

## WebSocket API

### Connection

```typescript
const ws = new WebSocket('wss://dev-prediction-markets-api.dflow.net/ws', {
  headers: { 'x-api-key': API_KEY }
});
```

### Channels

#### Prices
```typescript
// Subscribe
{ "type": "subscribe", "channel": "prices", "tickers": ["BTCD-25DEC0313-T92749.99"] }
{ "type": "subscribe", "channel": "prices", "all": true }

// Message
{
  "channel": "prices",
  "type": "ticker",
  "market_ticker": "BTCD-25DEC0313-T92749.99",
  "yes_bid": "0.45",
  "yes_ask": "0.47",
  "no_bid": "0.53",
  "no_ask": "0.55"
}
```

#### Trades
```typescript
// Subscribe
{ "type": "subscribe", "channel": "trades", "tickers": ["..."] }

// Message contains trade execution details
```

#### Orderbook
```typescript
// Subscribe
{ "type": "subscribe", "channel": "orderbook", "tickers": ["..."] }

// Message contains bid/ask ladders
```

---

## Data Models

### Event
```typescript
interface DFlowEvent {
  ticker: string;
  seriesTicker: string;
  title: string;
  subtitle?: string;
  competition?: string;
  competitionScope?: string;
  imageUrl?: string;
  liquidity?: number;
  volume?: number;
  volume24h?: number;
  openInterest?: number;
  strikeDate?: number;
  strikePeriod?: string;
  settlementSources?: Array<{ name: string; url: string }>;
  markets?: DFlowMarket[];
}
```

### Market
```typescript
interface DFlowMarket {
  ticker: string;
  eventTicker: string;
  marketType: string;
  title: string;
  subtitle?: string;
  yesSubTitle?: string;
  noSubTitle?: string;
  openTime: number;  // Unix timestamp
  closeTime: number;
  expirationTime: number;
  status: 'initialized' | 'active' | 'inactive' | 'closed' | 'determined' | 'finalized';
  result?: 'yes' | 'no' | '';
  volume: number;
  openInterest: number;
  yesBid?: string;  // e.g., "0.45"
  yesAsk?: string;
  noBid?: string;
  noAsk?: string;
  canCloseEarly: boolean;
  earlyCloseCondition?: string;
  rulesPrimary?: string;
  rulesSecondary?: string;
  accounts: Record<string, MarketAccountInfo>;
}

interface MarketAccountInfo {
  marketLedger: string;
  yesMint: string;  // SPL token address
  noMint: string;   // SPL token address
  isInitialized: boolean;
  redemptionStatus: 'open' | 'closed';
  scalarOutcomePct?: number;  // For scalar markets
}
```

### Trade
```typescript
interface DFlowTrade {
  tradeId: string;
  ticker: string;
  price: number;      // 0-10000 scale
  count: number;
  yesPrice: number;
  noPrice: number;
  yesPriceDollars: string;
  noPriceDollars: string;
  takerSide: 'yes' | 'no';
  createdTime: number;  // Unix timestamp
}
```

### Orderbook
```typescript
interface DFlowOrderbook {
  sequence: number;
  yesBids: Record<string, number>;  // price -> size
  yesAsks: Record<string, number>;
  noBids: Record<string, number>;
  noAsks: Record<string, number>;
}
```

---

## Market Lifecycle

```
initialized → active → inactive → closed → determined → finalized
     ↓           ↓         ↓
   (market    (trading   (paused,
    created)   open)     can resume)
```

- **initialized**: Market exists, trading not started
- **active**: **Only state allowing trades**
- **inactive**: Paused (can return to active)
- **closed**: Trading ended, outcome pending
- **determined**: Outcome set on-chain, redemption may be open
- **finalized**: Complete, redemption available

---

## Fee Structure

### Trading Fees

Formula: `fees = roundup(0.07 × c × p × (1 − p)) + (0.01 × c × p × (1 − p))`

Where:
- `c` = contract quantity
- `p` = fill price (0-1)

### Volume Tiers (30-day outcome token volume)

| Tier | Volume | Taker Scale | Maker Scale |
|------|--------|-------------|-------------|
| Frost | <$50M | 9% | 2.25% |
| Glacier | $50-150M | 8.75% | 2.1875% |
| Steel | $150-300M | 8.5% | 2.125% |
| Obsidian | >$300M | 8% | 2% |

### Rebates

Builders with >$100k monthly volume receive:
- Greater of 3% of trading fees OR tiered incremental rebates (10-30%)

---

## Integration Recipes

### 1. Discover Markets
```typescript
const DFLOW_API = 'https://dev-prediction-markets-api.dflow.net';

// Hot markets by 24h volume
const events = await fetch(`${DFLOW_API}/api/v1/events?limit=20&sort=volume24h&withNestedMarkets=true`);

// Search markets
const search = await fetch(`${DFLOW_API}/api/v1/search?q=bitcoin&withNestedMarkets=true`);

// Filter by category
const tags = await fetch(`${DFLOW_API}/api/v1/tags_by_categories`);
const series = await fetch(`${DFLOW_API}/api/v1/series?category=Politics`);
```

### 2. Get Market Details
```typescript
// By ticker
const market = await fetch(`${DFLOW_API}/api/v1/market/${ticker}`);

// By outcome mint
const byMint = await fetch(`${DFLOW_API}/api/v1/market/by-mint/${yesMint}`);

// Get orderbook
const orderbook = await fetch(`${DFLOW_API}/api/v1/orderbook/${ticker}`);
```

### 3. Trade Into Position
```typescript
import { Connection, VersionedTransaction } from '@solana/web3.js';

const TRADE_API = 'https://dev-quote-api.dflow.net';

// Get swap transaction
const params = new URLSearchParams({
  inputMint: 'So11111111111111111111111111111111111111112', // SOL
  outputMint: yesMint,  // Outcome token
  amount: (1 * 1e9).toString(),  // 1 SOL in lamports
  userPublicKey: wallet.publicKey.toBase58(),
  slippageBps: '50'
});

const order = await fetch(`${TRADE_API}/order?${params}`).then(r => r.json());

// Sign and send
const tx = VersionedTransaction.deserialize(Buffer.from(order.transaction, 'base64'));
tx.sign([wallet]);
const sig = await connection.sendTransaction(tx);

// Check status
const status = await fetch(`${TRADE_API}/order-status?signature=${sig}`);
```

### 4. Track Positions
```typescript
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

// Get user token accounts
const accounts = await connection.getParsedTokenAccountsByOwner(
  wallet.publicKey,
  { programId: TOKEN_2022_PROGRAM_ID }
);

const mints = accounts.value.map(a => a.account.data.parsed.info.mint);

// Filter for outcome mints
const outcome = await fetch(`${DFLOW_API}/api/v1/filter_outcome_mints`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ addresses: mints })
});

// Get market details for positions
const markets = await fetch(`${DFLOW_API}/api/v1/markets/batch`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mints: outcome.outcomeMints })
});
```

### 5. Redeem Winning Positions
```typescript
// Check market status
const market = await fetch(`${DFLOW_API}/api/v1/market/by-mint/${winningMint}`);

if (market.status === 'determined' || market.status === 'finalized') {
  // Swap outcome token back to USDC
  const params = new URLSearchParams({
    inputMint: winningMint,
    outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    amount: positionSize.toString(),
    userPublicKey: wallet.publicKey.toBase58()
  });

  const order = await fetch(`${TRADE_API}/order?${params}`).then(r => r.json());
  // Sign and send...
}
```

---

## What We Can Build with DFlow

### Data Features (Free, No Auth)
- [x] Market search and discovery
- [x] Hot/trending markets by volume
- [x] Real-time price feeds (WebSocket)
- [x] Orderbook depth visualization
- [x] Trade history and analytics
- [x] Market lifecycle monitoring
- [x] Cross-platform arbitrage detection
- [x] Historical candlestick charts

### Trading Features (User Wallet)
- [x] Buy/sell outcome tokens from any spot token
- [x] Position tracking via wallet balances
- [x] Automatic market initialization
- [x] Position increase/decrease
- [x] Redemption of winning positions
- [x] Gas-efficient batched transactions

### Advanced Features
- [x] Platform fee collection for builders
- [x] Priority fee optimization
- [x] JIT routing for best execution
- [x] Jito bundle integration
- [x] Sponsored/gasless swaps
- [x] Custom slippage per trade

### Intelligence Features
- [x] Live data from Kalshi milestones
- [x] Settlement source tracking
- [x] Category/tag-based filtering
- [x] Series templates for recurring events
- [x] Sports-specific filters

---

## Implementation Priority for OpenClaw

### Phase 1: Data Integration (Immediate)
1. Replace Kalshi data with DFlow Metadata API
2. Add DFlow search endpoint
3. Enable orderbook display
4. Add 24h volume tracking

### Phase 2: Trading (High Priority)
1. Implement `/order` endpoint integration
2. Add wallet connection (Phantom/Privy)
3. Create trade execution flow
4. Build position tracking

### Phase 3: Real-time (Medium Priority)
1. WebSocket price feeds
2. Trade notifications
3. Orderbook updates
4. Position value changes

### Phase 4: Advanced (Future)
1. Arbitrage execution
2. Portfolio analytics
3. Automated trading strategies
4. Fee optimization

---

## Environment Variables

```bash
# DFlow API (optional - for production rate limits)
DFLOW_API_KEY=your_key_here

# Solana connection
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
# or use Helius for better performance
HELIUS_API_KEY=your_helius_key

# Wallet (for backend trading)
SOLANA_PRIVATE_KEY=base58_encoded_key
```

---

## Error Codes

### HTTP Errors
- `429`: Rate limit exceeded - add backoff or use API key

### Trading API Errors
- `route_not_found`: Wrong mint, units, or no liquidity
- `invalid_payer`: Bad wallet address
- `prediction_market_already_initialized`: Market ready
- `unknown_outcome_mint`: Invalid outcome token

### IDL Errors (On-chain)
| Code | Error | Meaning |
|------|-------|---------|
| 16 | MarketNotOpen | Market closed |
| 17 | MarketOutcomeDetermined | Already settled |
| 64 | InvalidQuantity | Bad trade amount |
| 83 | FillUnderproduced | Output below minimum |
| 84 | FillOverconsumed | Input exceeds max |

---

## Resources

- **Docs**: https://pond.dflow.net
- **API Reference**: https://pond.dflow.net/llms.txt
- **Support**: hello@dflow.net
- **API Key Request**: Form in documentation
