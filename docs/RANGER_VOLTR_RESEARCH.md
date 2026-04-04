# Ranger Finance Ecosystem & Voltr API Research Summary

## Executive Summary
Ranger Finance is a decentralized finance infrastructure organization providing:
- Open-source SDKs and tools for Solana protocols
- Multi-protocol integration (Drift, Jupiter, Kalshi, Polymarket)
- Agent kits for automated trading (perps, vaults, prediction markets)
- Specialized libraries for DeFi operations

**Voltr** is Ranger's vault aggregation API providing unified access to Solana-based vaults with real-time metrics and standardized data structures.

---

## 1. RANGER FINANCE GITHUB ORGANIZATION

### Core Repositories (45+ total)

#### **Vault & Yield Infrastructure**
- **`protocol-v2`** (Rust) - On-chain perpetuals dex with multiple liquidity mechanisms
  - Full protocol implementation with CLI tools
  - Multiple instruction types (deposit, withdraw, rebalance)
  - Comprehensive test coverage

#### **Liquidity & AMM SDKs**
- **`dlmm-sdk`** (TypeScript) - SDK for building on Dynamic CLMM
  - Quote testing via `cargo test-bpf`
  - SDK testing with `anchor localnet`
  - Example implementations available

- **`raydium-clmm`** (Rust) - Open-source Concentrated Liquidity Market Maker
- **`whirlpools`** (TypeScript) - Concentrated liquidity AMM contract

#### **Agent & Automation**
- **`ranger-agent-kit`** (Python) - Toolkit for building modular trading agents
  - Model Context Protocol (MCP) server
  - Examples: mean reversion, orchestrator, planner agents
  - Support for Perps, portfolio management, liquidation tracking

- **`solana-agent-kit`** (TypeScript) - AI agents for Solana protocols
- **`sor-ts-demo`** (TypeScript) - Smart Order Router demo (TS, Rust, Python SDKs)

#### **Protocol Integrations**
- **`mango-v4`** (Rust) - Mango Markets monorepo (program + SDK)
- **`openbook-v2`** (Rust) - Order book (program + TS client)
- **`phoenix-v1`** (Rust) - On-chain order book with atomic settlement
- **`drift-labs/protocol-v2`** (via fork) - Drift perpetuals dex

#### **Developer Tools**
- **`anchor-gen`** (Rust) - Generates Anchor CPI crates from JSON IDL
- **`anchor-decoder`** (Rust) - IDL decoder utility
- **`cargo-chef`** (Rust) - Docker build optimization tool
- **`graphql-ws-client`** (Rust) - GraphQL WebSocket implementation
- **`jsonrpc`** (Rust) - JSON-RPC implementation

#### **Infrastructure**
- **`clickhouse-pool`** (Rust) - Connection pooling for ClickHouse DB
- **`clickhouse-rs`** (Rust) - Official ClickHouse client
- **`pyth-crosschain`** (TypeScript) - Pyth oracle crosschain programs
- **`hyperliquid-rust-sdk`** (Rust) - Hyperliquid protocol SDK
- **`orderly-connector-rs`** (Rust) - Orderly connector SDK
- **`flash-sdk-rust`** - Flash Trade SDK for accurate on-chain data

#### **Documentation**
- **`docs`** (MDX) - Mintlify documentation site
- **`.github`** - Organization templates

---

## 2. VOLTR API STRUCTURE

### Base URL
```
https://api.voltr.xyz/
```

### Endpoints & Data Models

#### **Vaults List Endpoint**
```http
GET /vaults
```

**Response Structure:**
```json
{
  "success": true,
  "vaults": [
    {
      "pubkey": "9VTUJwN8paqF679yeMpDG6x6imtagCisYUSTCm1J8pXe",
      "name": "Ranger USD",
      "theme": "Hybrid Lending",
      "strategies": ["Lending"],
      "age": 128,
      "tvl": 249738954641,
      "capacity": 1000000000000,
      "apy": 5.01817706108569,
      "icon": "https://...",
      
      "org": {
        "name": "Ranger",
        "icon": "https://..."
      },
      
      "asset": {
        "name": "USDC",
        "icon": "https://...",
        "decimals": 6,
        "pythFeedId": "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
        "price": 0.9998508500000001
      },
      
      "allocations": [
        {
          "orgName": "Kamino",
          "orgIcon": "https://..."
        },
        {
          "orgName": "Drift",
          "orgIcon": "https://..."
        },
        {
          "orgName": "Jupiter",
          "orgIcon": "https://..."
        }
      ]
    }
  ]
}
```

### Key Data Points

| Field | Type | Purpose |
|-------|------|---------|
| `pubkey` | string | Solana vault address (on-chain PDA) |
| `name` | string | Vault display name |
| `theme` | string | Strategy category (e.g., "Hybrid Lending") |
| `strategies` | string[] | List of active strategies |
| `age` | number | Days since vault creation |
| `tvl` | u64 | Total value locked (in token base units) |
| `capacity` | u64 | Maximum vault capacity |
| `apy` | number | Current APY percentage |
| `asset.decimals` | number | Token decimals (6 for USDC, 9 for SOL) |
| `pythFeedId` | string | Pyth oracle feed ID for price feeds |
| `allocations[]` | object[] | Child protocols/managers handling capital |

### Known Vaults (Sample Data)

1. **Ranger USD** (Hybrid Lending)
   - USDC vault with Kamino, Drift, Jupiter allocations
   - TVL: ~$250M | APY: 5.02%

2. **Hubra Copilot USDG** (Agent-Driven)
   - USDG vault with Kamino, Jupiter allocations
   - TVL: ~$6.2M | APY: 8.29%

3. **Elemental USDG Lending**
   - USDG vault with Kamino allocations
   - TVL: ~$597M | APY: 7.84%

---

## 3. BERIGHT FORECASTER POOL ARCHITECTURE

Our staking pool shares similar patterns with Voltr:

### Pool Structure (`ForecastPool`)
```rust
pub struct ForecastPool {
    pub bump: u8,
    pub forecaster: Pubkey,           // Pool owner
    pub tier: PoolTier,               // Determines capacity & requirements
    pub token_mint: Pubkey,           // SOL or USDC
    pub vault: Pubkey,                // Token vault
    pub total_value: u64,             // TVL
    pub total_shares: u64,            // Share accounting
    pub share_price: u64,             // Price per share (1e9)
    pub capacity: u64,                // Max TVL (from tier)
    pub available_liquidity: u64,     // Unused capital
    pub revenue_split: RevenueSplit,  // 50/30/20 default
    pub delegator_count: u32,         // # of delegators
    pub prediction_count: u32,        // # of predictions
    pub status: ForecastPoolStatus,   // Active/Paused/Closed
}
```

### Pool Tiers (8 variants)
- **Starter SOL**: 5 SOL, Brier < 0.35, 10+ predictions
- **Basic SOL**: 10 SOL, Brier < 0.30, 25+ predictions
- **Pro SOL**: 100 SOL, Brier < 0.25, 100+ predictions
- **Elite SOL**: 500 SOL, Brier < 0.20, 250+ predictions
- *(Same tiers for USDC with larger capacities)*

### Key Similarities to Voltr
- ✅ On-chain PDAs for pool identity
- ✅ Token-agnostic (SOL/USDC support like Voltr's USDC/USDG)
- ✅ Multiple allocations/strategies
- ✅ TVL and capacity tracking
- ✅ APY calculation (profit-based for forecasters)
- ✅ Multiple users (delegators) per pool

---

## 4. INTEGRATION PATTERNS

### SDK Usage Pattern (From ranger-agent-kit)
```python
# 1. Install dependencies
pip install mcp-agent numpy

# 2. Start MCP server (handles protocol communication)
# Default: http://localhost:8000

# 3. Define agent with LLM
from ranger_mcp_agent.examples import run_mean_reversion_agent
asyncio.run(run_mean_reversion_agent())

# 4. Agent can then:
# - Fetch market data
# - Get trade quotes
# - Prepare transactions
# - Manage positions
```

### Vault Data Fetching Pattern
```typescript
// From our codebase
const response = await fetch('https://api.voltr.xyz/vaults');
const { vaults } = await response.json();

// Normalize vault data
vaults.forEach(vault => {
  // Access: vault.pubkey, vault.tvl, vault.apy, vault.allocations
  // Calculate yields, track allocations
});
```

---

## 5. CODE PATTERNS & REUSABLE COMPONENTS

### A. On-Chain Account Pattern (Rust/Anchor)
**From our ForecastPool:**
```rust
#[account]
pub struct ForecastPool {
    pub bump: u8,                    // PDA bump
    pub forecaster: Pubkey,          // Authority
    pub tier: PoolTier,              // Configuration enum
    pub token_mint: Pubkey,          // Token reference
    pub vault: Pubkey,               // Associated token account
    pub total_value: u64,            // State tracking
    pub share_price: u64,            // Normalized pricing (1e9)
    // ... more state fields
}

impl ForecastPool {
    pub const LEN: usize = /* calculated */;  // Space allocation
    pub const VERSION: u8 = 1;                 // Schema versioning
    
    // Pure functions for calculations
    pub fn calculate_shares(&self, amount: u64) -> u64 { ... }
    pub fn calculate_profit_distribution(&self, profit: u64) -> (u64, u64, u64) { ... }
}
```

**Applicable to Voltr Integration:**
- Define `VoltrVaultPosition` account for tracking positions
- Implement normalized calculations (APY, yield distribution)
- Use enums for strategy types

### B. Share-Based Accounting Pattern
**Our formula:**
```
Deposit → Shares = amount / share_price
Withdrawal = shares * share_price / SHARE_DECIMALS

Share price updates when pool value changes:
share_price = total_value * 1e9 / total_shares
```

**Why it works:**
- Proportional ownership independent of pool size
- Accurate yield distribution (no need to track individual balances)
- Easy to implement on-chain

### C. CPI Integration Pattern
**For cross-program calls to Voltr adaptor:**
```rust
// Future pattern (once Voltr exposes on-chain adaptor)
#[derive(Accounts)]
pub struct DepositToVault<'info> {
    pub pool: Account<'info, ForecastPool>,
    pub vault: Account<'info, VoltrVault>,  // Voltr program
    // ... instruction-specific accounts
}
```

### D. Delegation & Multi-Tier Pattern
**Our approach:**
```rust
#[account]
pub struct Delegation {
    pub pool: Pubkey,
    pub delegator: Pubkey,
    pub shares: u64,           // What they own
    pub deposited_amount: u64, // Original amount
    pub deposited_at: i64,     // For lockup enforcement
}

// PDA: seeds = [b"delegation", pool.key(), delegator.key()]
```

**For Voltr:**
- Create `VoltrPosition` with similar structure
- Track allocation split across multiple underlying vaults
- Handle partial withdrawals via fee calculation

---

## 6. RANGER FINANCE TOOLS WE CAN LEVERAGE

### A. **DLMM SDK** (TypeScript)
- **Use case**: If Voltr uses DLMM for concentrated liquidity
- **Pattern**: `yarn add @meteora-ag/dlmm`
- **Reference**: Testing via `anchor localnet`

### B. **Solana Agent Kit** (TypeScript)
- **Use case**: Build autonomous agents that interact with vaults
- **Capabilities**: 
  - Query vault balances
  - Execute deposits/withdrawals
  - Monitor APY changes
- **Reference**: Can fork/integrate examples

### C. **Anchor Decoder** (Rust)
- **Use case**: Parse Voltr vault IDLs if not publicly exposed
- **Pattern**: CLI tool to generate Rust bindings from JSON IDL

### D. **Pyth Oracle Integration**
- **Available via**: `pythFeedId` in vault data
- **Use case**: Real-time price feeds for yield calculations
- **Pattern**: Already used in vault structure (see `asset.pythFeedId`)

---

## 7. INTEGRATION ROADMAP FOR BERIGHT

### Phase 1: API Integration (TypeScript)
```typescript
// beright-ts/lib/voltr/index.ts
import { VoltrClient } from './client';

const client = new VoltrClient('https://api.voltr.xyz');
const vaults = await client.getVaults();

// Query strategies matching our forecaster pool tier
const usdcVaults = vaults.filter(v => v.asset.name === 'USDC');
```

### Phase 2: On-Chain Adaptor (Rust)
```rust
// staking-pool/programs/staking-pool/src/instructions/voltr/
pub mod deposit;   // Deposit pool capital to Voltr
pub mod harvest;   // Claim yields
pub mod rebalance; // Shift allocations between strategies
```

### Phase 3: Agent Automation
```python
# Use ranger-agent-kit pattern for autonomous rebalancing
# Agent monitors:
# - Pool yield vs target APY
# - Vault allocation health
# - Liquidity needs
```

---

## 8. DATA STRUCTURES TO IMPLEMENT

### TypeScript (beright-ts/lib/voltr/)
```typescript
interface VoltrVault {
  pubkey: string;
  name: string;
  theme: string;
  strategies: string[];
  tvl: number;
  capacity: number;
  apy: number;
  asset: {
    name: string;
    decimals: number;
    price: number;
  };
  allocations: Array<{
    orgName: string;
  }>;
}

interface VoltrPosition {
  vaultAddress: string;
  amount: u64;
  shares: u64;
  entryPrice: number;
  currentValue: number;
  yieldEarned: number;
}
```

### Rust (staking-pool)
```rust
#[account]
pub struct VoltrPosition {
    pub pool: Pubkey,
    pub vault: Pubkey,        // Voltr vault address
    pub amount: u64,          // Deposited amount
    pub shares: u64,          // Vault shares received
    pub entry_price: u64,     // Entry APY (1e6)
    pub last_harvest: i64,    // Timestamp
}

#[derive(Accounts)]
pub struct DepositToVoltr<'info> {
    pub pool: Account<'info, ForecastPool>,
    pub position: Account<'info, VoltrPosition>,
    pub vault_account: UncheckedAccount<'info>, // Voltr vault
    // ... token accounts
}
```

---

## 9. REFERENCES & RESOURCES

### Documentation
- [Ranger Docs Repository](https://github.com/ranger-finance/docs) - MDX docs
- [Voltr API Docs](https://api.voltr.xyz/docs/) - Swagger UI
- Ranger Agent Kit [USER_MANUAL.md](https://github.com/ranger-finance/ranger-agent-kit/blob/main/ranger_perps_mcp/USER_MANUAL.md)

### SDK Examples
- [Solana Agent Kit Examples](https://github.com/ranger-finance/solana-agent-kit)
- [DLMM SDK Tests](https://github.com/ranger-finance/dlmm-sdk/tree/main/ts-client)
- [Mean Reversion Agent](https://github.com/ranger-finance/ranger-agent-kit/blob/main/examples/mean_reversion_agent.py)

### Key Addresses
- Voltr most active vaults:
  - Ranger USD: `9VTUJwN8paqF679yeMpDG6x6imtagCisYUSTCm1J8pXe`
  - Elemental USDG: `4jZ2NzER3hjm5ENf2HVMzGXqiiXDVXH59uo65BXdvuCu`

---

## 10. NEXT STEPS

1. **API Integration**: Build TypeScript client for Voltr REST API
2. **Data Normalization**: Map Voltr vault data to our PoolTier model
3. **Yield Calculation**: Implement APY estimation for forecaster earnings
4. **On-Chain Adaptor**: Create CPI instructions for vault interaction
5. **Agent Automation**: Use ranger-agent-kit to build yield-optimizing agents
