# Jupiter Prediction API Integration Spec

## Executive Summary

**What**: Integrate Jupiter's Prediction API as a PRIMARY data source and execution layer for BeRight.

**Why**: 
- Aggregated liquidity from Polymarket + Kalshi in ONE API
- On-chain settlement on Solana (native to our stack)
- Zero payout fees (winners get full $1/contract)
- Single API key, no per-platform auth
- Keeper network handles order matching

**Impact**: 10x better execution, unified liquidity, simplified architecture.

---

## Current vs. Proposed Architecture

### Current
```
Polymarket API ─────┐
DFlow/Kalshi API ───┼─→ Data Fabric → Trader Agent → Multiple Connectors
Manifold API ───────┤
Limitless API ──────┘
```

### Proposed (Jupiter as Primary)
```
Jupiter Prediction API ─→ Unified Markets ─→ Trader Agent ─→ Jupiter Execution
         ↓                                                          ↓
   (Polymarket + Kalshi)                                    On-chain Settlement
         
Legacy APIs ─→ Fallback / Additional Coverage
```

---

## Integration Phases

### Phase 1: API Client Library (Day 1)
**File**: `lib/jupiter/prediction.ts`

```typescript
// Core client implementation
interface JupiterPredictionClient {
  // Events
  getEvents(params: EventParams): Promise<JupiterEvent[]>;
  searchEvents(query: string): Promise<JupiterEvent[]>;
  getEvent(eventId: string): Promise<JupiterEvent>;
  
  // Markets  
  getMarket(marketId: string): Promise<JupiterMarket>;
  
  // Trading
  createOrder(params: OrderParams): Promise<CreateOrderResponse>;
  getOrders(ownerPubkey: string): Promise<JupiterOrder[]>;
  getOrderStatus(orderPubkey: string): Promise<OrderStatus>;
  
  // Positions
  getPositions(ownerPubkey: string): Promise<JupiterPosition[]>;
  closePosition(positionPubkey: string): Promise<ClosePositionResponse>;
  closeAllPositions(ownerPubkey: string): Promise<CloseAllResponse>;
  claimWinnings(positionPubkey: string, ownerPubkey: string): Promise<ClaimResponse>;
}
```

**Env var**: `JUPITER_PREDICTION_API_KEY`

### Phase 2: Market Integration (Day 2)
**Files to modify**:
- `lib/dataFabric/types.ts` - Add Jupiter platform type
- `lib/dataFabric/providers/jupiter.ts` - New provider
- `skills/markets.ts` - Add Jupiter to fetchHotMarkets, searchMarkets

**Key changes**:
```typescript
// Add to DataPlatform enum
export type DataPlatform = 
  | 'polymarket' 
  | 'kalshi' 
  | 'manifold' 
  | 'limitless'
  | 'jupiter'  // NEW - aggregates Polymarket + Kalshi

// Jupiter market normalization
function normalizeJupiterMarket(jupMarket: JupiterMarket): UnifiedMarket {
  return {
    id: `jupiter-${jupMarket.marketId}`,
    question: jupMarket.metadata.title,
    platforms: [{
      platform: 'jupiter',
      marketId: jupMarket.marketId,
      yesPrice: jupMarket.pricing.buyYesPriceUsd / 1_000_000, // micro USD
      noPrice: jupMarket.pricing.buyNoPriceUsd / 1_000_000,
      volume: jupMarket.pricing.volume,
      status: jupMarket.status,
    }],
    // Jupiter markets are already on-chain tradeable!
    tradeable: true,
    executionVenue: 'jupiter',
  };
}
```

### Phase 3: Agent Updates (Day 3)

#### Scout Agent
**File**: `agents/scout/index.ts`

Add tool:
```typescript
{
  name: 'get_jupiter_markets',
  description: 'Get prediction markets from Jupiter (aggregated Polymarket + Kalshi liquidity). Best for finding markets with real liquidity on Solana.',
  parameters: {
    category: { type: 'string', enum: ['crypto', 'sports', 'politics', 'all'] },
    filter: { type: 'string', enum: ['trending', 'new', 'live'] }
  },
  execute: async (params) => {
    const client = getJupiterClient();
    return client.getEvents({ 
      category: params.category,
      filter: params.filter,
      includeMarkets: true 
    });
  }
}
```

#### Analyst Agent
**File**: `agents/analyst/index.ts`

Add Jupiter market research capability - already has `research_market` tool, enhance to prefer Jupiter when available.

#### Trader Agent (Critical)
**File**: `agents/trader/index.ts`

Update `execute_trade` tool:
```typescript
{
  name: 'execute_trade',
  description: 'Execute a trade on a prediction market. Prefers Jupiter for best execution.',
  parameters: {
    marketId: { type: 'string' },
    side: { type: 'string', enum: ['YES', 'NO'] },
    amount: { type: 'number', description: 'Amount in USD' },
    venue: { type: 'string', enum: ['jupiter', 'auto'], default: 'auto' }
  },
  execute: async (params) => {
    // 1. Check if market is on Jupiter
    // 2. If yes, use Jupiter API for best execution
    // 3. Create unsigned tx, sign with user wallet, submit
    // 4. Track position
  }
}
```

### Phase 4: Position Tracking (Day 4)
**File**: `services/portfolioManager.ts`

Add Jupiter position sync:
```typescript
async function syncJupiterPositions(walletPubkey: string) {
  const client = getJupiterClient();
  const positions = await client.getPositions(walletPubkey);
  
  for (const pos of positions) {
    await upsertPosition({
      platform: 'jupiter',
      marketId: pos.marketId,
      side: pos.isYes ? 'YES' : 'NO',
      contracts: parseInt(pos.contracts),
      avgPrice: parseInt(pos.avgPriceUsd) / 1_000_000,
      currentValue: pos.valueUsd ? parseInt(pos.valueUsd) / 1_000_000 : null,
      pnl: pos.pnlUsd ? parseInt(pos.pnlUsd) / 1_000_000 : null,
      claimable: pos.claimable,
    });
  }
}
```

### Phase 5: Claim Winnings (Day 5)
**File**: `skills/portfolio.ts`

Add claim functionality:
```typescript
export async function claimJupiterWinnings(
  positionPubkey: string, 
  wallet: Keypair
): Promise<{ signature: string; amountUsd: number }> {
  const client = getJupiterClient();
  const { transaction } = await client.claimWinnings(
    positionPubkey, 
    wallet.publicKey.toString()
  );
  
  // Deserialize, sign, send
  const tx = VersionedTransaction.deserialize(Buffer.from(transaction, 'base64'));
  tx.sign([wallet]);
  
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
  });
  
  return { signature: sig, amountUsd: ... };
}
```

---

## Frontend Integration (berightweb)

### New Components Needed

1. **JupiterMarketCard** - Display Jupiter markets with live pricing
2. **JupiterTradeModal** - Execute trades with wallet signing
3. **JupiterPositions** - Show open positions + P&L
4. **ClaimWinningsButton** - Claim settled positions

### API Routes (beright-ts)

```
GET  /api/v2/jupiter/events        → List events
GET  /api/v2/jupiter/events/:id    → Event details
POST /api/v2/jupiter/orders        → Create order (returns unsigned tx)
GET  /api/v2/jupiter/positions     → User positions
POST /api/v2/jupiter/claim/:id     → Claim winnings (returns unsigned tx)
```

---

## Configuration

### Environment Variables
```bash
# Jupiter Prediction API (portal.jup.ag)
JUPITER_PREDICTION_API_KEY=your_key_here

# Optional: Preferred provider filter
JUPITER_PREDICTION_PROVIDER=polymarket  # or kalshi
```

### Feature Flags
```typescript
// config/features.ts
export const FEATURES = {
  jupiterPrediction: {
    enabled: true,
    priorityOverDFlow: true,  // Use Jupiter instead of DFlow when available
    enableTrading: true,
    enableClaims: true,
  }
};
```

---

## Data Model Changes

### Add Jupiter to Platform enum
```typescript
// types/market.ts
export type Platform = 
  | 'polymarket' 
  | 'kalshi' 
  | 'manifold' 
  | 'limitless' 
  | 'metaculus'
  | 'dflow'
  | 'jupiter';  // NEW
```

### Jupiter-specific types
```typescript
// types/jupiter.ts
export interface JupiterPosition {
  pubkey: string;
  ownerPubkey: string;
  marketId: string;
  isYes: boolean;
  contracts: string;  // u64 as string
  avgPriceUsd: string; // micro USD
  pnlUsd: string | null;
  claimable: boolean;
  claimed: boolean;
}

export interface JupiterOrderResponse {
  transaction: string;  // base64 unsigned tx
  txMeta: {
    blockhash: string;
    lastValidBlockHeight: number;
  };
  order: {
    orderPubkey: string;
    positionPubkey: string;
    contracts: string;
  };
}
```

---

## Arbitrage Enhancement

Jupiter gives us BETTER arbitrage because:
1. Aggregates Polymarket + Kalshi in one place
2. Cross-platform price discovery built-in
3. Can execute on Solana instantly

### New Arbitrage Flow
```
1. Scout detects spread: Polymarket 65% YES, Kalshi 62% YES
2. Jupiter has both → spread visible in single API
3. Trader executes: Buy Kalshi YES @ 62¢ via Jupiter
4. Wait for convergence or settlement
5. Winner gets $1/contract (zero fees!)
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `lib/jupiter/prediction.ts` | API client |
| `lib/jupiter/types.ts` | TypeScript types |
| `lib/dataFabric/providers/jupiter.ts` | Data fabric provider |
| `app/api/v2/jupiter/events/route.ts` | Events API route |
| `app/api/v2/jupiter/orders/route.ts` | Orders API route |
| `app/api/v2/jupiter/positions/route.ts` | Positions API route |
| `app/api/v2/jupiter/claim/[id]/route.ts` | Claim API route |

## Files to Modify

| File | Changes |
|------|---------|
| `types/market.ts` | Add Jupiter platform |
| `lib/dataFabric/types.ts` | Add Jupiter to DataPlatform |
| `skills/markets.ts` | Add Jupiter fetching |
| `agents/scout/index.ts` | Add Jupiter scanning tool |
| `agents/trader/index.ts` | Add Jupiter execution |
| `services/portfolioManager.ts` | Jupiter position sync |
| `.env.example` | Add JUPITER_PREDICTION_API_KEY |

---

## Success Metrics

1. **Latency**: Order creation < 200ms
2. **Coverage**: 80%+ of Polymarket/Kalshi markets available
3. **Execution**: 95%+ fill rate on market orders
4. **P&L Tracking**: Real-time position updates

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| API beta/breaking changes | Version lock, fallback to DFlow |
| Rate limits | Caching, request batching |
| Keeper delays | Monitor fill times, alert if > 5s |
| Position desync | Periodic full sync, on-chain verification |

---

## Timeline

- **Day 1**: API client library + types
- **Day 2**: Data fabric integration + market fetching
- **Day 3**: Agent updates (Scout, Trader)
- **Day 4**: Position tracking + portfolio sync
- **Day 5**: Claim winnings + testing
- **Day 6**: Frontend components (if needed)
- **Day 7**: Production deploy + monitoring

---

## Questions for Team

1. Do we have a Jupiter portal API key already?
2. Priority: Trading first or market display first?
3. Should Jupiter replace DFlow or complement it?
4. Frontend: Build new trading UI or integrate into existing?

---

*Created: $(date)*
*Author: Claude (Technical Co-founder)*
