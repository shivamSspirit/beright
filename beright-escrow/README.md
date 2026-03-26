<p align="center">
  <img src="../berightweb/public/beright-logo.svg" alt="BeRight Logo" width="120" />
</p>

# BeRight Conviction Escrow

Anchor program for conviction markets where crypto projects stake SOL on their own milestones.

## Overview

Projects create markets, stake SOL, and get it back if they hit their milestones.
Binary resolution: **YES** (milestone achieved) or **NO** (milestone missed).

```
Project creates market → Stakes SOL → Resolution date arrives →
Resolver resolves (YES/NO) → Winner claims funds
```

## Program ID

| Network | Program ID |
|---------|------------|
| Localnet | `E6Gp6fzaPM6y1k3wLYBFno1oMZjZvNbaFszVGzvXaZX9` |
| Devnet | `E6Gp6fzaPM6y1k3wLYBFno1oMZjZvNbaFszVGzvXaZX9` |
| Mainnet | TBD |

## Instructions

| Instruction | Description |
|-------------|-------------|
| `create_market` | Create new market PDA, set resolver and resolution date |
| `stake` | Project deposits SOL to vault PDA |
| `resolve` | Resolver sets outcome (YES/NO/Invalid) |
| `claim` | Winner withdraws funds from vault |

## Account Structure

```rust
pub struct ConvictionMarket {
    pub bump: u8,
    pub vault_bump: u8,
    pub project_wallet: Pubkey,
    pub resolver: Pubkey,
    pub stake_amount: u64,
    pub stake_position: StakePosition,  // Yes or No
    pub resolution_date: i64,
    pub status: MarketStatus,           // PendingStake, Active, Resolved, Claimed
    pub outcome: MarketOutcome,         // None, Yes, No, Invalid
    pub created_at: i64,
}
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Build
anchor build

# Test
anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

## Development

```bash
# Build
just build

# Test
just test

# Deploy
just deploy-devnet
```

## Integration with BeRight

The program integrates with `beright-ts/lib/conviction/`:

```typescript
import { conviction } from '../lib/conviction';

// Create market off-chain
const { market } = await conviction.markets.create({
  projectId: 'xyz',
  question: 'Will we launch mainnet by Q2?',
  stakeAmount: 100,
  resolutionDate: new Date('2024-06-30'),
});

// Create escrow on-chain
const tx = await program.methods
  .createMarket(stakePosition, resolutionDate, stakeAmount)
  .accounts({ market, vault, project, resolver })
  .rpc();
```

## Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   CREATE    │────▶│    STAKE    │────▶│   RESOLVE   │────▶│    CLAIM    │
│   MARKET    │     │             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                  │                   │                   │
       ▼                  ▼                   ▼                   ▼
  Market PDA         SOL → Vault        YES/NO/Invalid      Vault → Winner
  created            transferred        outcome set         funds sent
```

## License

MIT
