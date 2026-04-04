# BeRight Solana Stack Reference

Complete reference for BeRight's Solana prediction market infrastructure.

## RPC Infrastructure

### Helius (Primary)

| Endpoint | Environment Variable | Purpose |
|----------|---------------------|---------|
| Mainnet RPC | `HELIUS_RPC_MAINNET` | Production transactions |
| Devnet RPC | `HELIUS_RPC_DEVNET` | Testing |
| WebSocket | `HELIUS_WEBSOCKET_URL` | Real-time feeds |
| Fallback | `api.mainnet-beta.solana.com` | Emergency fallback |

**Configuration** (`config/execution.ts`):
- Max connections: 10 per host
- Keep-alive timeout: 60s
- Request timeout: 5s
- Blockhash refresh: 400ms

### JITO MEV Protection

| Setting | Default | Purpose |
|---------|---------|---------|
| Block Engine | `mainnet.block-engine.jito.wtf` | Bundle submission |
| Default Tip | 10,000 lamports | Priority fee |
| Max Tip | 100,000 lamports | Ceiling |
| Confirmation | 30s timeout | Wait for landing |

**Regions**: mainnet, Amsterdam, Frankfurt, NY, Tokyo

---

## Prediction Market Providers

### Jupiter Prediction (Recommended)

**API**: `https://api.jup.ag/prediction/v1`

| Feature | Value |
|---------|-------|
| Payout Fee | **0%** (winners get full $1) |
| Platform Fee | Configurable via referral |
| Settlement | On-chain via keeper network |
| Aggregates | Polymarket + Kalshi |

**Environment Variables**:
```bash
JUPITER_PREDICTION_API_KEY=         # Optional
JUPITER_PREDICTION_REFERRAL_ACCOUNT= # Fee collection wallet
JUPITER_PREDICTION_FEE_BPS=100      # 1% default
```

**Capabilities**:
- Events API (categories, status, search)
- Markets API (by event, active, all)
- Orders API (create, cancel, signed txs)
- Positions API (open, closed, claimable)
- Claims API (redeem winnings)

### DFlow (Tokenized Markets)

**API**: `https://pond.dflow.net`

| Feature | Value |
|---------|-------|
| Platform Fee | 0.5% (50 bps) |
| Auth | Wallet signing (no API key needed) |
| Markets | Tokenized Kalshi (SPL tokens) |
| Data | Free (rate limited without key) |

**Environment Variables**:
```bash
DFLOW_API_KEY=                      # Optional for higher limits
DFLOW_FEE_ACCOUNT=                  # Fee collection wallet
DFLOW_PLATFORM_FEE_BPS=50           # 0.5% default
```

**Capabilities**:
- Market data and orderbooks
- WebSocket price feeds
- Transaction building
- Multi-wallet support (Keypair, Privy, Phantom)

### Polymarket

**API**: `https://gamma-api.polymarket.com`

| Feature | Value |
|---------|-------|
| Taker Fee | 2% |
| Maker Fee | 0% |
| Auth | API key + secret + passphrase |
| Order Types | Market, Limit (CLOB) |

**Environment Variables**:
```bash
POLYMARKET_API_KEY=
POLYMARKET_API_SECRET=
POLYMARKET_PASSPHRASE=
```

### Kalshi (Direct)

**API**: `https://api.elections.kalshi.com/trade-api/v2`

| Feature | Value |
|---------|-------|
| Fee | 1% on profits (at settlement) |
| Regulation | CFTC-regulated |
| Region | US only |
| Prices | Cents (0-100) |

**Environment Variables**:
```bash
KALSHI_API_KEY=
KALSHI_API_SECRET=
KALSHI_BUILDER_CODE=BERIGHT_PROTOCOL
```

> **Note**: DFlow is recommended over direct Kalshi for Solana-native trading.

---

## Provider Priority (Smart Router)

The execution router selects venues in this priority:

1. **Jupiter Prediction** - Zero payout fees, best for winners
2. **DFlow** - Tokenized, Solana-native, 0.5% fee
3. **Polymarket** - High liquidity, 2% taker
4. **Kalshi** - Regulated, 1% profit fee

**Routing Logic** (`lib/execution/router.ts`):
- Minimum routing edge: 1%
- Multi-venue order splitting supported
- Platform priority scoring

---

## Aggregation Methods

### Extremized Log-Odds (Default)

State-of-the-art aggregation per Satopää et al. 2014.

**Formula**: `P = 1 / (1 + exp(-1.5 × weighted_log_odds))`

**Platform Calibration Weights**:
| Platform | Weight |
|----------|--------|
| Kalshi | 0.88 |
| Polymarket | 0.85 |
| Jupiter | 0.84 |
| Manifold | 0.78 |

**Other Methods Available**:
- Adaptive Extremized (auto-adjusts by diversity)
- LMSR (logarithmic market scoring)
- Bayesian / Hierarchical Bayesian
- Volume-Weighted (legacy)

---

## Deployed Programs

### Calibration Program
- **Address**: `GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ`
- **Purpose**: On-chain Brier score tracking
- **Features**: Forecaster profiles, prediction records, resolution
- **Location**: `/calibration-program/`

### Conviction Escrow
- **Address**: `E6Gp6fzaPM6y1k3wLYBFno1oMZjZvNbaFszVGzvXaZX9`
- **Purpose**: Manage conviction/collateral for predictions
- **Location**: `/beright-escrow/`

### BeRight Vault
- **Address**: `EhU2oz3LKPDCVRhRW5TXMeraqVFoSJ3L42cyeC6Ns2eL`
- **Purpose**: Vault for staking and yield
- **Location**: `/beright-vault/`

### Staking Pool
- **Address**: `Fkb7q8pbMa4Wko4u1DYZMXBrXvq8ECFnSqze2TYMm4pM`
- **Purpose**: Meteora vault, DLMM, Drift integration
- **Location**: `/staking-pool/`

---

## Architecture

### File Structure

```
lib/
├── dataFabric/
│   ├── providers/
│   │   ├── polymarket.ts    # Gamma API
│   │   ├── kalshi.ts        # Trade API v2
│   │   ├── jupiter.ts       # Prediction v1
│   │   └── manifold.ts      # Manifold API
│   ├── deduplication.ts     # Market matching
│   └── cache.ts             # Redis + in-memory
├── jupiter/
│   └── prediction.ts        # Full Jupiter client
├── dflow/
│   ├── api.ts               # Market data
│   ├── executor.ts          # Transaction building
│   └── websocket.ts         # Price feeds
├── execution/
│   ├── connectors/          # Platform-specific
│   ├── router.ts            # Venue selection
│   ├── fastConnection.ts    # Connection pooling
│   ├── jitoBundle.ts        # MEV protection
│   └── jupiterUltra.ts      # Ultra-fast quotes
└── aggregation/
    ├── extremizedLogOdds.ts # Default method
    ├── bayesian.ts
    └── lmsr.ts
```

### Data Flow

```
Market Query
    ↓
DataFabric (aggregates all providers)
    ↓
Deduplication (Jaccard + ML matching)
    ↓
Price Aggregation (Extremized Log-Odds)
    ↓
Arbitrage Detection (cross-platform spreads)
    ↓
Smart Router (venue selection)
    ↓
Execution Connector (platform-specific)
    ↓
JITO Bundle (MEV protection)
```

---

## Fee Collection

### Revenue Streams

| Source | Fee | Collected Via |
|--------|-----|---------------|
| Jupiter trades | 1% (100 bps) | `JUPITER_PREDICTION_REFERRAL_ACCOUNT` |
| DFlow trades | 0.5% (50 bps) | `DFLOW_FEE_ACCOUNT` |
| Kalshi trades | Builder code | `KALSHI_BUILDER_CODE` |

### Fee Wallet Setup

```bash
# Generate dedicated fee wallets
solana-keygen grind --starts-with BRF:1  # BeRight Fee
solana-keygen grind --starts-with FEE:1  # Generic
```

---

## Security

### Key Management
- Private keys via `SOLANA_PRIVATE_KEY` env only
- Network validation (devnet vs mainnet mismatch detection)
- Public key caching (no private key exposure)
- Keypair only loaded when needed

### Kill Switches
- Auto-arbitrage: DISABLED by default
- Daily loss limits: Configurable
- Confirmation thresholds: Required for large trades

### Latency Targets
| Operation | Target |
|-----------|--------|
| Quote | 100ms |
| Build | 50ms |
| Submit | 200ms |
| Confirm | 5s |

---

## Testing

```bash
# Type check
npx tsc --noEmit

# Test APIs
npm run test:apis

# Paper trading mode
PAPER_TRADING=true npm test
```

---

## Not Integrated (From Original Prompt)

These were mentioned in the setup prompt but are **not used** in BeRight:

| Component | Status | Reason |
|-----------|--------|--------|
| Switchboard oracle | Not integrated | Custom oracle from market aggregation |
| Pyth oracle | Not integrated | Not needed for prediction markets |
| QuickNode RPC | Not used | Helius is primary |
| Triton RPC | Not used | Helius is primary |
| Alchemy RPC | Not used | Helius is primary |
| DFlow Proof (identity) | Not integrated | Using Privy instead |
| Provider AI skill packs | Not used | Custom agent system |
