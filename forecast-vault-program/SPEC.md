# BeRight Forecast Vault Protocol Spec

## Summary

`forecast-vault-program` is the Solana program for BeRight's managed forecaster vaults.

It should sit beside, not inside, the existing `calibration-program`.

- `calibration-program`: score, calibration, forecaster reputation
- `forecast-vault-program`: custody policy, active sleeve budgets, matching, routing, and fee accounting

The protocol product is:

- a single-asset `USDC` allocator vault
- score-gated forecaster baskets
- a Robin-style matched-outcome carry engine for the active sleeve
- a conservative Solana yield router for the treasury sleeve

## Product Thesis

Stop betting on markets. Start backing the forecasters who beat them.

LPs deposit `USDC`.

The vault allocates capital into three sleeves:

- `Reserve sleeve`: liquidity buffer for withdrawals and emergency unwind
- `Yield sleeve`: base yield via approved Solana lending adapters
- `Prediction sleeve`: score-gated forecaster baskets trading approved `YES/NO` outcome tokens

Inside the prediction sleeve:

- unmatched outcome-token exposure remains directional
- matched opposite-side exposure is neutralized into stablecoin
- neutralized stablecoin is routed into the same approved yield adapters

## Design Goals

1. Keep only three human actors: `Protocol`, `Forecaster`, `Delegator`
2. Keep the program policy-driven, not role-heavy
3. Ensure forecasters never have withdrawal authority
4. Separate reputation from capital management
5. Support multiple forecasters and multiple baskets per vault
6. Keep the treasury sleeve conservative in `v1`

## Non-Goals For V1

- permissionless vault creation
- leveraged prediction trading
- rehypothecation of unmatched outcome tokens
- options strategies
- synthetic stablecoin issuance
- generic credit lines against score

## Product Surface

### 1. Core Vault

Single-asset `USDC` vault with share accounting.

Depositor flow:

1. Deposit `USDC`
2. Receive vault shares
3. Earn:
   - base treasury yield from the yield sleeve
   - active alpha from the prediction sleeve
   - matched carry from the neutralized part of prediction exposure

### 2. Forecaster Basket

A forecaster receives a capped execution budget from the vault.

The forecaster can:

- submit market intents
- open positions
- reduce positions
- close positions

The forecaster cannot:

- withdraw
- change adapters
- exceed budget
- exceed per-market or per-theme caps

### 3. Matching Engine

For each approved market:

- aggregate `YES` and `NO` exposure across all baskets in the vault
- compute matched notional
- neutralize the matched portion into stablecoin through a venue adapter
- route only that stablecoin back into yield

### 4. Yield Router

`v1` approved strategies:

- Kamino Lend
- marginfi
- Drift Lend / Borrow

No CLMM, volatile LP, or leveraged basis strategies in `v1`.

## Capital Policy

Default target allocation:

- `10%` reserve
- `65%` yield sleeve
- `25%` prediction sleeve

The prediction sleeve is a ceiling, not a guarantee.

Actual prediction allocation is bounded by:

- forecaster score tier
- investability tier
- venue liquidity
- current withdrawal pressure
- global match ratio

### Prediction Sleeve Curve

- `BRS < 700`: `0%`
- `700-749`: up to `10%`
- `750-799`: up to `15%`
- `800-849`: up to `20%`
- `850+`: up to `25%`

## Fee Policy

Recommended `v1` fees:

- management fee: `0.75%` annualized on total AUM
- prediction alpha performance fee: `20%` on net new active alpha only
- yield sleeve fee: protocol-only, small, inside reported net APY

Recommended performance-fee split:

- `60%` forecaster
- `20%` protocol
- `20%` insurance reserve

Recommended treasury-yield split:

- `90%` LP
- `5%` protocol
- `5%` insurance reserve

Forecasters should not receive treasury-yield revenue unless they actively manage that sleeve.

## Authority Model

### Protocol

Represented by a multisig.

Protocol can:

- initialize global config
- whitelist adapters
- whitelist venues
- set fee params
- set allocation ceilings
- set pause flags
- rotate protocol authority

### Forecaster

Forecaster can:

- submit signed trade intents inside basket policy
- cancel active intents
- close or reduce positions

Forecaster cannot:

- withdraw assets
- mint shares
- alter fee config
- alter adapter config
- transfer custody

### Delegator

Delegator can:

- deposit into vault
- redeem shares
- claim settlement proceeds and fee-adjusted yield

### Keeper

Not a trusted governance role.

Keepers can:

- crank rebalances
- harvest adapter yield
- settle matched notional
- refresh score snapshots
- process withdraw queues

Every keeper action must be validated by program policy.

## Program Architecture

## Program Split

### Existing Program

`calibration-program`

Used for:

- BeRight score
- calibration buckets
- confidence-weighted performance
- forecaster reputation and tier data

### New Program

`forecast-vault-program`

Used for:

- vault custody and share accounting
- forecaster budget allocation
- trade-intent policy enforcement
- yield-router allocations
- matching and neutralization accounting
- fee accrual
- pause and emergency controls

## Core Accounts

### `GlobalConfig`

Protocol-wide configuration.

Fields:

- protocol authority
- treasury recipient
- insurance recipient
- base asset mint
- paused flags
- global fee params
- max adapters
- max vaults

### `VaultConfig`

Immutable or semi-static vault definition.

Fields:

- vault authority
- base asset mint
- share mint
- reserve target bps
- max yield sleeve bps
- max prediction sleeve bps
- management fee bps
- performance fee bps
- enabled flag

### `VaultState`

Live vault accounting.

Fields:

- total deposits
- total shares
- total reserve value
- total yield sleeve value
- total prediction sleeve value
- pending withdrawal amount
- last rebalance slot
- current high-water mark
- total matched notional
- total unmatched notional

### `ForecasterPolicy`

Per-forecaster permissions inside a vault.

Fields:

- forecaster pubkey
- linked vault
- score snapshot
- investability tier
- max active budget bps
- max per-market exposure bps
- max per-theme exposure bps
- active flag
- last score sync slot

### `BasketState`

Per-forecaster execution bucket.

Fields:

- forecaster pubkey
- vault pubkey
- approved venue
- approved niche or theme
- budget allocated
- budget consumed
- realized pnl
- unrealized pnl
- matched contribution
- unmatched exposure

## Implemented V1 Surface

The current program implementation covers:

- `initialize_global_config`
  Initializes protocol authority, treasury recipients, calibration-program binding, fee params, and minimum vault score threshold.
- `initialize_vault`
  Registers a vault against a pre-created SPL share mint and program-controlled base-asset vault.
- `deposit`
  Transfers base asset into custody, mints vault shares, and updates virtual reserve / yield / prediction sleeve accounting.
- `withdraw`
  Burns shares, returns base asset, and reduces sleeve accounting pro rata.
- `sync_forecaster_policy`
  Reads the canonical `ScoreSnapshotV3` account from `calibration-program` and derives the forecaster's active budget cap inside the vault.
- `submit_trade_intent`
  Locks prediction-sleeve capacity and forecaster budget against an intent before any venue execution happens.
- `cancel_trade_intent`
  Releases locked budget back to the forecaster policy and vault prediction sleeve.
- `set_pause`
  Supports protocol-wide and vault-local pause flags.

This is the correct base for the next phase: adapter routing, matching, and settlement.

### `MarketExposure`

Vault-level market exposure tracker.

Fields:

- venue market id hash
- total yes notional
- total no notional
- matched notional
- unmatched yes
- unmatched no
- neutralized stablecoin balance
- last settlement slot

### `AdapterAllocation`

Per-vault strategy weight and cap record.

Fields:

- adapter id
- target weight bps
- current allocation
- max allocation bps
- max utilization guard
- enabled flag

### `TradeIntent`

Intent-based execution primitive.

Fields:

- basket pubkey
- forecaster pubkey
- market id hash
- side
- max size
- limit price
- expiry slot
- status
- created slot

### `WithdrawalQueueEntry`

Used when immediate liquidity is insufficient.

Fields:

- vault pubkey
- user pubkey
- shares burned
- assets owed
- request slot
- status

## Instruction Set

### Governance / Config

- `initialize_global_config`
- `update_global_config`
- `initialize_vault`
- `update_vault_config`
- `set_pause`
- `register_adapter`
- `update_adapter_allocation`

### Forecaster Lifecycle

- `initialize_forecaster_policy`
- `sync_forecaster_score`
- `set_forecaster_limits`
- `disable_forecaster_policy`

### Deposits / Withdrawals

- `deposit`
- `request_withdraw`
- `process_withdraw`
- `cancel_withdraw_request`

### Basket / Trading

- `initialize_basket`
- `submit_trade_intent`
- `cancel_trade_intent`
- `execute_trade_intent`
- `close_position`
- `record_position_settlement`

### Matching / Neutralization

- `refresh_market_exposure`
- `settle_matched_notional`
- `route_neutralized_stable`

### Yield Routing

- `rebalance_yield_sleeve`
- `harvest_adapter_yield`
- `sync_adapter_position`

### Accounting / Fees

- `accrue_management_fee`
- `crystallize_performance_fee`
- `update_high_water_mark`

## Safety Rules

1. Vault custody must always live in PDA-controlled token accounts
2. Forecaster authority must never be able to transfer vault assets directly
3. Every CPI adapter must be whitelisted by protocol config
4. Per-market and per-theme caps must be enforced on chain
5. Prediction allocation must shrink automatically if withdraw pressure rises
6. Matching should never assume a venue-specific neutralization path without an adapter assertion
7. Yield router must maintain a hard reserve floor
8. Pause must support:
   - global pause
   - per-vault pause
   - prediction-sleeve-only pause

## Integration Plan

### External Programs

`v1` target adapters:

- Kamino Lend
- marginfi
- Drift Lend / Borrow

`v1` prediction venue target:

- tokenized yes/no SPL outcome rails through a dedicated adapter

The adapter layer should abstract:

- deposit
- withdraw
- sync position value
- guard by utilization or health metric

## Suggested Build Order

### Milestone 1

- global config
- vault config
- vault state
- deposit
- request withdraw
- pause controls

### Milestone 2

- forecaster policy
- basket state
- score sync from calibration program
- trade intent flow

### Milestone 3

- yield adapter framework
- Kamino / marginfi / Drift lending CPIs
- reserve and yield-sleeve rebalance

### Milestone 4

- market exposure tracking
- matching and neutralization
- matched carry accounting

### Milestone 5

- performance-fee crystallization
- withdraw queue processing
- full end-to-end tests

## V1 Success Criteria

- users deposit `USDC` and receive shares
- protocol enforces a configurable prediction sleeve ceiling
- forecasters can express views without custody rights
- treasury sleeve earns base yield through approved Solana adapters
- matched `YES/NO` notional is tracked explicitly
- all critical actions can be paused safely

## Naming

Suggested public product names:

- `BeRight Forecaster Vaults`
- `BeRight Allocator Vaults`
- `BeRight Backed Forecasters`

Suggested technical program name:

- `forecast-vault`
