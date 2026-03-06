# DFlow Full Integration Plan

> **Goal:** Become a top DFlow router consumer for the best tokenized prediction market experience on Solana.

## Current Status (Updated Feb 2026)

| Component | Status | Notes |
|-----------|--------|-------|
| Metadata API | ✅ Complete | Events, markets, orderbooks, trades, search |
| WebSocket | ✅ Complete | Real-time prices, trades, orderbook |
| Quote API | ✅ Complete | `getDFlowOrderTransaction()` returns tx |
| Transaction Signing | ✅ Complete | `lib/dflow/executor.ts` - Keypair signing |
| Transaction Submission | ✅ Complete | `lib/dflow/executor.ts` - Submit to Solana |
| Position Tracking | ✅ Complete | `lib/dflow/positions.ts` - On-chain tracking |
| Wallet Management | ✅ Complete | `lib/dflow/wallet.ts` - Multi-wallet support |
| USDC Balance | ✅ Complete | `lib/dflow/wallet.ts` - Token account lookup |
| DFlowConnector | ✅ Complete | Real execution mode available |
| Telegram Trading | ✅ Complete | `/trade`, `/wallet`, `/positions` commands |
| Jupiter Integration | ✅ Complete | Smart routing, Jito MEV protection |

## Module Structure

```
lib/dflow/
├── index.ts       # Unified exports
├── api.ts         # (deprecated) Use ../dflow.ts
├── websocket.ts   # Real-time WebSocket
├── executor.ts    # Transaction signing & submission
├── wallet.ts      # Multi-wallet support (Keypair/Privy/Phantom)
├── positions.ts   # On-chain position tracking
├── jupiter.ts     # Jupiter DEX aggregator integration
└── router.ts      # Smart order router (DFlow vs Jupiter)
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    BERIGHT DFLOW ROUTER                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │   WALLET    │     │   ROUTER    │     │  EXECUTOR   │        │
│  │  (Privy/    │────▶│  (Jupiter   │────▶│  (Sign &    │        │
│  │   Phantom)  │     │   + DFlow)  │     │   Submit)   │        │
│  └─────────────┘     └─────────────┘     └─────────────┘        │
│        │                   │                   │                 │
│        │                   │                   │                 │
│        ▼                   ▼                   ▼                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │  POSITION   │     │   MARKET    │     │  REAL-TIME  │        │
│  │  TRACKER    │◀────│    DATA     │◀────│  WEBSOCKET  │        │
│  │  (On-chain) │     │  (Metadata) │     │   (Prices)  │        │
│  └─────────────┘     └─────────────┘     └─────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         DFLOW APIs                               │
├─────────────────────────────────────────────────────────────────┤
│  Metadata: prediction-markets-api.dflow.net                      │
│  Trade:    quote-api.dflow.net                                   │
│  WebSocket: wss://prediction-markets-api.dflow.net/ws            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Transaction Execution (PRIORITY)

### 1.1 Create `lib/dflow/executor.ts`

Complete transaction signing and submission flow:

```typescript
// Key functions needed:
export async function executeOrder(params: {
  market: DFlowMarket;
  side: 'YES' | 'NO';
  amount: number;           // USDC amount
  slippageBps?: number;     // Default 50 (0.5%)
  wallet: Keypair | WalletAdapter;
}): Promise<ExecutionResult>

export async function signAndSubmit(
  transaction: VersionedTransaction,
  wallet: Keypair | WalletAdapter,
  connection: Connection
): Promise<string>  // Returns tx signature

export async function confirmTransaction(
  signature: string,
  connection: Connection
): Promise<boolean>
```

### 1.2 Transaction Flow

```
1. User: "Buy $50 YES on BTC-100K-MAR"
   │
2. Get market details + mint addresses
   │
3. Call DFlow Quote API:
   POST /order
   {
     inputMint: USDC_MINT,
     outputMint: yesMint,
     amount: 50_000_000,  // 50 USDC (6 decimals)
     userPublicKey: wallet.publicKey,
     slippageBps: 50
   }
   │
4. Receive base64 transaction
   │
5. Decode → VersionedTransaction
   │
6. Sign with wallet (Keypair or WalletAdapter)
   │
7. Submit to Solana RPC (Helius)
   │
8. Wait for confirmation
   │
9. Check order status via DFlow API
   │
10. Return ExecutionResult
```

### 1.3 Files to Create

| File | Purpose |
|------|---------|
| `lib/dflow/executor.ts` | Transaction signing & submission |
| `lib/dflow/wallet.ts` | Wallet management (Keypair, Privy, Phantom) |
| `lib/dflow/transaction.ts` | Transaction building utilities |

---

## Phase 2: Position Tracking

### 2.1 Create `lib/dflow/positions.ts`

Track on-chain positions via token accounts:

```typescript
export interface DFlowPosition {
  market: DFlowMarket;
  side: 'YES' | 'NO';
  shares: number;
  costBasis: number;
  currentValue: number;
  unrealizedPnL: number;
  mintAddress: string;
  tokenAccount: string;
}

export async function getPositions(
  walletAddress: string
): Promise<DFlowPosition[]>

export async function syncPositions(
  walletAddress: string,
  connection: Connection
): Promise<void>
```

### 2.2 Position Tracking Flow

```
1. Get all token accounts for wallet (Helius/RPC)
   │
2. Filter to DFlow outcome mints:
   POST /filter-outcome-mints
   { mints: [...tokenAccountMints] }
   │
3. Batch fetch market details:
   POST /markets/batch
   { mints: [...outcomeMints] }
   │
4. Calculate position values using current prices
   │
5. Return structured positions
```

---

## Phase 3: Jupiter Integration

### 3.1 Why Jupiter?

- **Best execution** - Routes through multiple DEXs
- **Jito MEV protection** - Front-running protection
- **Fee optimization** - Priority fee estimation
- **Phantom/Jupiter integration** - Already connected to DFlow

### 3.2 Create `lib/dflow/jupiter.ts`

```typescript
export async function getJupiterQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
}): Promise<JupiterQuote>

export async function executeViaJupiter(params: {
  quote: JupiterQuote;
  wallet: Keypair | WalletAdapter;
}): Promise<string>  // tx signature
```

### 3.3 Smart Order Router

```typescript
// Compares DFlow direct vs Jupiter routing
export async function getBestRoute(params: {
  market: DFlowMarket;
  side: 'YES' | 'NO';
  amount: number;
}): Promise<{
  route: 'dflow' | 'jupiter';
  price: number;
  fees: number;
  slippage: number;
}>
```

---

## Phase 4: Wallet Integration

### 4.1 Multi-Wallet Support

| Wallet | Type | Priority |
|--------|------|----------|
| Privy Embedded | Server-side keypair | P0 - Terminal |
| Phantom | Browser extension | P0 - Web |
| Keypair (env) | For agents/bots | P1 - Automation |
| Turnkey | Enterprise MPC | P2 - Future |

### 4.2 Create `lib/dflow/wallet.ts`

```typescript
export interface WalletProvider {
  publicKey: PublicKey;
  signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction>;
  signAllTransactions(txs: VersionedTransaction[]): Promise<VersionedTransaction[]>;
}

export function createKeypairWallet(keypair: Keypair): WalletProvider
export function createPrivyWallet(privyUser: PrivyUser): WalletProvider
export function createPhantomWallet(): WalletProvider  // Browser only
```

---

## Phase 5: Real-Time Updates

### 5.1 Enhanced WebSocket

Already have `DFlowWebSocket` class. Need to:

1. **Auto-reconnect** with exponential backoff
2. **Heartbeat** to detect disconnections
3. **Price caching** for instant quotes
4. **Position updates** when trades fill

### 5.2 Server-Sent Events for Terminal

```typescript
// API route: /api/v2/dflow/stream
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Subscribe to DFlow WebSocket
      // Push updates as SSE
    }
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    }
  });
}
```

---

## Phase 6: API Endpoints

### 6.1 New Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/dflow/markets` | GET | Hot markets, search |
| `/api/v2/dflow/market/:ticker` | GET | Single market details |
| `/api/v2/dflow/quote` | POST | Get trade quote |
| `/api/v2/dflow/execute` | POST | Execute trade |
| `/api/v2/dflow/positions` | GET | User positions |
| `/api/v2/dflow/orders` | GET | Order history |
| `/api/v2/dflow/stream` | GET | SSE price stream |

### 6.2 Trade Execution Endpoint

```typescript
// POST /api/v2/dflow/execute
{
  marketTicker: "INXD-26MAR28-B5100",
  side: "YES",
  amount: 50,           // USDC
  slippageBps: 50,      // 0.5%
  walletType: "privy"   // or "phantom", "keypair"
}

// Response
{
  success: true,
  data: {
    orderId: "...",
    txSignature: "...",
    filledAmount: 49.75,
    avgPrice: 0.65,
    fees: 0.25,
    position: { ... }
  }
}
```

---

## Phase 7: Terminal Integration

### 7.1 Trading Panel

Add to `berightweb/src/app/beright-terminal/components/`:

```
TradingPanel.tsx
├── MarketSearch.tsx      - Search DFlow markets
├── MarketCard.tsx        - Market details + orderbook
├── OrderForm.tsx         - Buy/Sell form
├── PositionList.tsx      - Open positions
├── OrderHistory.tsx      - Recent orders
└── PriceChart.tsx        - Candlestick chart
```

### 7.2 Key Features

- **One-click trading** - Quick buy/sell buttons
- **Size presets** - $10, $25, $50, $100, Custom
- **Price alerts** - Notify when price hits target
- **P&L tracking** - Real-time unrealized P&L
- **Position management** - Close, add, reduce

---

## Phase 8: Telegram Commands

### 8.1 Enhanced Commands

| Command | Description |
|---------|-------------|
| `/wallet` | View/create wallet, balances |
| `/dflow [query]` | Search markets |
| `/buy <ticker> <amount>` | Buy YES |
| `/sell <ticker> <amount>` | Sell position |
| `/positions` | View open positions |
| `/pnl` | Portfolio P&L summary |
| `/alert <ticker> <price>` | Set price alert |

### 8.2 Inline Trading

```
User: /buy BTC-100K $50

Bot: 📊 *Buy YES: BTC above $100K by Mar 28*

  Price: $0.65 → 76.9 shares
  Est. Cost: $50.00
  Max Payout: $76.92 (+53.8%)

  ⚠️ Slippage: 0.5%

  [Confirm] [Cancel] [Change Amount]
```

---

## Implementation Order

### Week 1: Core Execution
1. [ ] `lib/dflow/executor.ts` - Sign & submit
2. [ ] `lib/dflow/wallet.ts` - Keypair support first
3. [ ] Test with small trades on dev API

### Week 2: Position Tracking
4. [ ] `lib/dflow/positions.ts` - Fetch positions
5. [ ] Token account balance checking
6. [ ] Sync with portfolio manager

### Week 3: API Routes
7. [ ] `/api/v2/dflow/quote`
8. [ ] `/api/v2/dflow/execute`
9. [ ] `/api/v2/dflow/positions`
10. [ ] `/api/v2/dflow/stream` (SSE)

### Week 4: Jupiter + Smart Routing
11. [ ] Jupiter quote integration
12. [ ] Smart order router (DFlow vs Jupiter)
13. [ ] Jito MEV protection

### Week 5: Terminal UI
14. [ ] TradingPanel component
15. [ ] OrderForm with wallet connection
16. [ ] PositionList with real-time updates
17. [ ] PriceChart component

### Week 6: Telegram + Polish
18. [ ] Enhanced /buy, /sell commands
19. [ ] Inline confirmations
20. [ ] Price alerts
21. [ ] Error handling & edge cases

---

## Environment Variables Needed

```bash
# Solana RPC (Helius recommended)
HELIUS_API_KEY=xxx
HELIUS_RPC_MAINNET=https://mainnet.helius-rpc.com/?api-key=xxx

# DFlow (optional - higher rate limits)
DFLOW_API_KEY=xxx  # Get from https://pond.dflow.net/build/api-key

# Jupiter
JUPITER_API_URL=https://lite-api.jup.ag/swap/v1

# Wallet (for bot/agent trading)
SOLANA_PRIVATE_KEY=[...64 bytes...]

# Privy (for terminal users)
NEXT_PUBLIC_PRIVY_APP_ID=xxx
PRIVY_APP_SECRET=xxx
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Trade execution latency | < 3 seconds |
| Position sync accuracy | 100% |
| WebSocket uptime | > 99.5% |
| Failed transaction rate | < 1% |
| Daily active traders | Track growth |
| Volume through BeRight | Track & report |

---

## Resources

- [DFlow Documentation](https://pond.dflow.net)
- [DFlow API Key Request](https://pond.dflow.net/build/api-key)
- [Jupiter Docs](https://docs.jup.ag)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [Privy Docs](https://docs.privy.io)

---

## Next Steps

1. **Get DFlow API key** for production rate limits
2. **Start with Phase 1** - Transaction execution is the blocker
3. **Test on dev API** with small amounts
4. **Iterate on UI** based on user feedback

*Let's become the top DFlow consumer!* 🚀
