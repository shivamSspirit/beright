# BeRight Protocol Product Spec

## Status

This document covers the current BeRight protocol design across three layers:

1. `Scoring Layer`
2. `Calibration Layer`
3. `DeFi Layer`

It also explains:

- how the system works end to end
- how forecasters earn money
- how delegators earn money
- how the protocol earns money
- where product-market fit likely exists

Important distinction:

- some parts are already implemented in code
- some parts are product and protocol design targets for the next build phases

This spec explicitly calls that out.

## Product Thesis

BeRight turns forecasting skill into investable onchain credit.

The core user promise is:

`Stop betting on markets. Start backing the forecasters who beat them.`

Instead of asking retail users to trade event markets directly, BeRight lets public capital back verified forecasters through a managed Solana-native vault system.

The protocol is built around three layers:

- `Scoring` determines who is actually good
- `Calibration` anchors reputation and score state onchain
- `DeFi` allocates public capital under strict custody and risk controls

## Layer 1: Scoring

### Purpose

The scoring layer is the offchain decision engine.

It computes:

- `IScore`: imported historical score
- `NScore`: BeRight-native score
- `VScore`: unified vault score

The scoring layer exists to answer:

`Should this forecaster be trusted with public capital, and how much?`

### Inputs

The scoring engine consumes two categories of data:

- imported forecast history from external venues
- native forecast history from BeRight itself

Imported history is used to bootstrap forecasters with prior track record.
Native history is used to build durable BeRight reputation.

### Core scoring model

The V3 scoring engine computes source scores from:

- decayed Brier quality
- decayed log-score quality
- calibration quality by buckets
- difficulty quality
- consensus edge quality
- consistency quality
- ESS-based confidence adjustment
- anti-gaming penalties

Then it composes imported and native scores into a unified vault score.

### Current implementation

Implemented in:

- [forecaster-scoring-engine/SCORING_V3.md](/Users/shivamsoni/Desktop/beright/forecaster-scoring-engine/SCORING_V3.md)
- [forecaster-scoring-engine/src/v3/calculator.ts](/Users/shivamsoni/Desktop/beright/forecaster-scoring-engine/src/v3/calculator.ts)
- [forecaster-scoring-engine/src/v3/handoff.ts](/Users/shivamsoni/Desktop/beright/forecaster-scoring-engine/src/v3/handoff.ts)
- [forecaster-scoring-engine/src/cli/calculate-v3-snapshots.ts](/Users/shivamsoni/Desktop/beright/forecaster-scoring-engine/src/cli/calculate-v3-snapshots.ts)

The scoring engine now emits:

- `snapshotHash`
- `scoreEpochHash`
- `confidenceBps`
- `penaltyFlags`
- a compact calibration-ready summary

That means the scoring layer is already in a usable handoff shape for onchain sync.

### Why this matters

This layer prevents the protocol from doing the naive thing:

`raw leaderboard score = direct capital`

Instead, it supports:

`verified score + confidence + penalties + policy = capital access`

That is the correct underwriting model for a forecaster network.

## Layer 2: Calibration

### Purpose

The calibration layer is the onchain reputation anchor.

It does two jobs:

1. record and resolve BeRight-native forecasts
2. anchor accepted score snapshots from the scoring engine

The calibration layer exists to answer:

`What is this forecaster's verifiable onchain reputation state?`

### Native reputation

BeRight-native predictions are recorded and resolved through the calibration program.

This keeps:

- prediction history
- bucket calibration
- recent performance
- streak and aggregate metrics

inside a public onchain account model.

### Score anchoring

The scoring engine remains offchain, but its accepted output is now anchored onchain through:

- `ScoreConfig` PDA
- `ScoreSnapshotV3` PDA

This is the crucial bridge between offchain intelligence and onchain capital policy.

### Current implementation

Implemented in:

- [calibration-program/programs/calibration/src/state/score_v3.rs](/Users/shivamsoni/Desktop/beright/calibration-program/programs/calibration/src/state/score_v3.rs)
- [calibration-program/programs/calibration/src/instructions/manage_score_config.rs](/Users/shivamsoni/Desktop/beright/calibration-program/programs/calibration/src/instructions/manage_score_config.rs)
- [calibration-program/programs/calibration/src/instructions/sync_score_snapshot_v3.rs](/Users/shivamsoni/Desktop/beright/calibration-program/programs/calibration/src/instructions/sync_score_snapshot_v3.rs)
- [calibration-program/programs/calibration/src/lib.rs](/Users/shivamsoni/Desktop/beright/calibration-program/programs/calibration/src/lib.rs)
- [calibration-program/app/client.ts](/Users/shivamsoni/Desktop/beright/calibration-program/app/client.ts)

The calibration layer now supports:

- protocol-owned score-sync config
- onchain storage of latest accepted imported/native/unified score summary
- score versioning
- confidence and cap anchoring
- snapshot and epoch hashing

### Why this matters

Without calibration, score is only a backend output.

With calibration, score becomes:

- auditable
- versioned
- composable
- enforceable by other Solana programs

This is what lets the DeFi layer trust score state without re-running the math.

## Layer 3: DeFi

### Purpose

The DeFi layer is the capital-management system.

It takes public deposits, issues vault shares, allocates sleeve exposure, and allows forecasters to use only the risk budget they have earned.

The DeFi layer exists to answer:

`How does public capital get deployed safely behind verified forecasting talent?`

### Product structure

At the product level, BeRight is a managed vault protocol.

Delegators deposit `USDC`.

The vault allocates capital into:

- `Reserve sleeve`
- `Yield sleeve`
- `Prediction sleeve`

Target model:

- `10%` reserve
- `65%` core yield
- `25%` prediction sleeve

That `25%` is the active forecaster-managed sleeve.
It is a ceiling, not an unconditional allocation.

### DeFi strategy stack

The DeFi layer is not a generic yield aggregator.
It is a controlled capital allocator for forecasting talent.

At the strategy level, BeRight combines four distinct strategy classes:

- `Base yield strategies`
- `Directional forecasting strategies`
- `Matched carry strategies`
- `Execution-efficiency strategies`

Each of these plays a different role in the vault.

### Base yield strategies

The base-yield role of the DeFi layer is simple:

- keep idle treasury capital productive
- keep neutralized stablecoin productive
- keep risk conservative in `v1`

Initial target integrations remain:

- Kamino Lend
- marginfi
- Drift Lend/Borrow

These are treasury-routing tools, not excuses to add leverage.

The intended policy is:

- no volatile LP in `v1`
- no leveraged basis in `v1`
- no generic degen yield routing
- no forecaster-controlled adapter selection

### Directional forecasting strategies

The prediction sleeve exists to express forecast edge, not to run unmanaged speculation.

Its job is to let verified forecasters and BeRight-native AI-assisted workflows take capped directional exposure when score, confidence, and policy justify it.

This directional sleeve should support:

- single-market conviction
- basket-level positioning
- multiple forecasters operating inside separate caps
- multiple venue adapters over time

The core design rule is:

`forecasting alpha can take risk, but only inside a budget envelope derived from score state`

### Prediction sleeve

The prediction sleeve is designed to support:

- multiple forecasters
- multiple baskets
- multiple markets
- score-gated budget caps

Forecasters never get custody.
They only get execution rights inside a locked budget envelope.

### Robin-style matched carry

The intended economic edge of the prediction sleeve is:

- directional outcome-token exposure captures forecasting alpha
- matched `YES/NO` exposure can be neutralized
- neutralized notional can be routed into low-risk yield

This means the prediction sleeve can eventually earn from:

- directional alpha
- matched carry

This is not fully implemented yet.
It is the next major product primitive after the current vault base.

### Execution-efficiency strategies

BeRight also needs a capital-efficiency layer inside DeFi.

That layer should improve:

- venue selection
- order routing
- slippage control
- partial-fill handling
- basket rebalancing
- correlated-exposure awareness

This is where the AI execution layer matters.

The AI execution layer is the automation surface of the DeFi layer.
It does not replace score-based underwriting.
It operates inside the policy envelope created by scoring, calibration, and vault controls.

Its role is to help with:

- ranking candidate markets
- suggesting better entry and exit timing
- routing across approved venues
- avoiding low-liquidity traps
- clustering related exposures
- identifying natural offsetting flow
- improving the match ratio of the prediction sleeve

In other words:

`AI helps the vault deploy capital more intelligently, but never with uncapped authority`

### Yield sleeve

The yield sleeve is intended to route capital into conservative Solana yield adapters.

Initial target integrations:

- Kamino Lend
- marginfi
- Drift Lend/Borrow

This should remain conservative in v1.
No volatile LP, no leveraged basis, no generic degen routing.

### Strategy policy

The DeFi layer should make policy explicit.

Forecasters can control:

- market selection
- side selection
- sizing inside cap
- basket composition
- reduce / close decisions

Forecasters cannot control:

- vault withdrawals
- treasury routing
- adapter configuration
- protocol fees
- leverage permissions
- risk ceilings

The protocol should also enforce:

- no forecaster custody
- no uncapped prediction exposure
- no direct score-to-capital mapping without policy checks
- prediction-sleeve access gated by `ScoreSnapshotV3`
- neutralized capital preferred over idle capital for treasury routing
- treasury sleeve conservatism even as the prediction sleeve expands

### Concrete protocol surface

The intended first-wave DeFi stack is:

- `USDC` as the base vault asset
- `ScoreSnapshotV3` as the canonical policy input
- Kamino / marginfi / Drift for conservative stablecoin routing
- Jupiter Prediction as a Solana-native prediction venue and routing surface
- approved adapters for external prediction venues where policy and execution quality justify them

This gives BeRight a coherent DeFi strategy:

- treasury capital earns base yield
- forecast edge earns directional alpha
- matched exposure earns carry through capital efficiency
- AI improves routing and execution inside strict vault policy

### Current implementation

Implemented in:

- [forecast-vault-program/programs/forecast-vault/src/state/mod.rs](/Users/shivamsoni/Desktop/beright/forecast-vault-program/programs/forecast-vault/src/state/mod.rs)
- [forecast-vault-program/programs/forecast-vault/src/instructions/initialize_global_config.rs](/Users/shivamsoni/Desktop/beright/forecast-vault-program/programs/forecast-vault/src/instructions/initialize_global_config.rs)
- [forecast-vault-program/programs/forecast-vault/src/instructions/initialize_vault.rs](/Users/shivamsoni/Desktop/beright/forecast-vault-program/programs/forecast-vault/src/instructions/initialize_vault.rs)
- [forecast-vault-program/programs/forecast-vault/src/instructions/deposit.rs](/Users/shivamsoni/Desktop/beright/forecast-vault-program/programs/forecast-vault/src/instructions/deposit.rs)
- [forecast-vault-program/programs/forecast-vault/src/instructions/withdraw.rs](/Users/shivamsoni/Desktop/beright/forecast-vault-program/programs/forecast-vault/src/instructions/withdraw.rs)
- [forecast-vault-program/programs/forecast-vault/src/instructions/sync_forecaster_policy.rs](/Users/shivamsoni/Desktop/beright/forecast-vault-program/programs/forecast-vault/src/instructions/sync_forecaster_policy.rs)
- [forecast-vault-program/programs/forecast-vault/src/instructions/submit_trade_intent.rs](/Users/shivamsoni/Desktop/beright/forecast-vault-program/programs/forecast-vault/src/instructions/submit_trade_intent.rs)
- [forecast-vault-program/programs/forecast-vault/src/instructions/cancel_trade_intent.rs](/Users/shivamsoni/Desktop/beright/forecast-vault-program/programs/forecast-vault/src/instructions/cancel_trade_intent.rs)

The current DeFi layer already supports:

- protocol config
- vault initialization
- SPL-token custody
- deposit and withdrawal accounting
- share mint / burn flow
- calibration-driven forecaster policy sync
- prediction-budget locking via trade intents
- protocol and vault pause controls

Not implemented yet:

- yield adapter CPIs
- matching engine
- execution settlement against prediction venues
- fee accrual and distribution
- keeper-driven rebalancing

## How The System Works End To End

### Forecaster onboarding flow

1. A forecaster links external history or starts forecasting on BeRight.
2. The scoring engine computes `IScore`, `NScore`, and `VScore`.
3. The scoring worker emits a deterministic snapshot.
4. The calibration program anchors the accepted score snapshot onchain.
5. The DeFi layer reads the onchain score snapshot.
6. The vault syncs a forecaster policy and derives budget caps.
7. The forecaster can submit prediction intents within their allowed budget.

### Delegator flow

1. A delegator deposits `USDC`.
2. The vault mints receipt shares.
3. Capital is split across reserve, yield, and prediction sleeves.
4. The delegator's share value rises if the vault earns net yield and alpha.
5. The delegator burns shares to withdraw `USDC`.

### Protocol control model

There are only three real actors:

- `Protocol`
- `Forecaster`
- `Delegator`

Everything else should be encoded in:

- PDAs
- keepers
- strict program policy

That is the correct simplification for this product.

## How Forecasters Earn Money

### Core mechanism

Forecasters should earn from active alpha, not from custody.

Their economic role is:

- produce profitable prediction decisions
- use only approved budget
- earn a share of performance fees or alpha-linked payouts

### Intended forecaster revenue streams

1. `Prediction alpha share`
   A portion of net new active sleeve alpha should flow to the forecaster.

2. `Performance fee share`
   The cleanest structure is:
   - vault earns active alpha
   - protocol charges performance fee on net new high-water-mark gains
   - part of that fee goes to forecaster

3. `Optional matched-carry share`
   If the protocol wants forecasters to benefit from capital efficiency in their basket, a small share of matched carry can be routed to them.

### Recommended economics

The strongest v1 fee design is:

- `0.75%` management fee on AUM
- `20%` performance fee on net new active alpha

Recommended split of the performance fee:

- `60%` forecaster
- `20%` protocol
- `20%` insurance / reserve

This is superior to giving forecasters a large direct cut of gross vault yield because:

- it aligns pay with actual forecasting alpha
- it reduces overpayment for passive capital
- it keeps LP economics credible

### What is implemented vs planned

Implemented:

- forecaster budget rights
- forecaster policy sync from score state
- forecaster intent locking

Planned:

- fee crystallization
- alpha accounting
- forecaster payout distribution

## How Delegators Earn Money

Delegators are the LP side of the system.

They should earn from two economic engines:

1. `Base yield`
   From the yield sleeve and later from neutralized matched prediction notional.

2. `Active alpha`
   From profitable forecaster-managed prediction exposure.

### Intended delegator revenue streams

1. `Yield sleeve return`
   Generated by conservative Solana lending adapters.

2. `Prediction sleeve alpha`
   Net PnL from forecaster-managed active positions.

3. `Matched carry`
   If the protocol neutralizes opposite-side positions and redeploys the stable value into lenders.

### Recommended LP economics

LPs should keep the majority of both sleeves.

Recommended:

- `80%` of net active alpha after performance fee
- `90%+` of treasury yield net of protocol fee

If LP share gets pushed too low, PMF weakens quickly.

### What is implemented vs planned

Implemented:

- deposit and withdrawal
- share accounting
- sleeve accounting model

Planned:

- actual adapter yield generation
- active alpha settlement
- matched-carry realization

## How The Protocol Earns Money

The protocol should earn from infrastructure and coordination, not from extractive spread-taking.

### Intended protocol revenue streams

1. `Management fee`
   Small annualized fee on AUM.

2. `Performance fee share`
   A cut of active sleeve gains.

3. `Yield sleeve fee`
   Small protocol fee on treasury-routing yield.

4. `Future execution / routing fee`
   Possible small fee on venue execution or settlement once adapters exist.

### Recommended protocol fee profile

Good:

- low visible management fee
- moderate performance participation
- minimal routing take

Bad:

- heavy gross-alpha tax
- high flat fees
- charging too much on the yield sleeve

This protocol only works if LPs still feel like the product is investable after fees.

## Revenue Model Summary

### Forecaster

Best fit:

- gets paid for active skill
- not for passive treasury exposure

### Delegator

Best fit:

- earns most of the net economics
- gets diversified managed exposure to forecasting alpha plus base yield

### Protocol

Best fit:

- earns a moderate coordination fee
- compounds value through scale, trust, and capital efficiency

## Current Build Summary

### Already built

#### Scoring

- canonical V3 score engine
- imported/native/unified score model
- deterministic snapshot handoff

#### Calibration

- native reputation state
- versioned score snapshot anchoring
- onchain score config

#### DeFi

- vault config and custody structure
- deposit / withdraw
- share accounting
- score-driven forecaster policy sync
- intent budget locking

### Not yet built

- yield adapters
- prediction venue adapters
- matched neutralization engine
- fee crystallization
- rebalancing keepers
- end-to-end indexer / orchestrator for live vault operations

## Is There Product-Market Fit?

### Short answer

Yes, there is plausible product-market fit, but it is conditional.

The product has a real wedge if it becomes:

- the best place to prove forecasting skill
- the best place to unlock capital from forecasting skill
- the safest place for public capital to back forecasters

### Why there may be PMF

There are three real market needs here:

1. `Good forecasters lack scalable capital access`
   Many people can forecast well, but they do not have pooled capital, infrastructure, or a trusted public reputation layer.

2. `Prediction market capital is capital-inefficient`
   Open interest often sits idle until resolution.
   Your thesis attacks that inefficiency directly.

3. `Delegators want talent-backed strategies, not raw market clicking`
   Copy-trading and managed-vault products prove this demand pattern already exists in adjacent markets.

### Why PMF is not automatic

This can still fail if:

- score quality is weak
- forecasters can game the system
- LP economics are too thin
- venue liquidity is too small
- legal structure is wrong

The hardest problem is not technical.
It is:

`Can BeRight become the trusted underwriting layer for forecaster talent?`

If yes, the protocol can be very strong.
If not, it becomes just another managed vault.

### Most likely early PMF wedge

The strongest initial wedge is:

- high-signal forecasters with external track record
- BeRight-native reputation building
- capped public vaults with strict score-gated access

That is much more credible than trying to launch a broad retail “prediction DeFi super app” immediately.

### PMF verdict

Best current framing:

`Promising wedge with real market demand, but PMF depends on trust, score quality, and disciplined LP economics.`

## Strategic Recommendation

The best next protocol path is:

1. finish yield-router adapters
2. finish prediction execution adapters
3. finish fee accounting and forecaster payouts
4. implement matched neutralization
5. add orchestrator / keeper infrastructure
6. launch with capped, permissioned forecaster vaults first

That gives BeRight the highest chance of becoming:

- a forecaster reputation network
- a capital allocator for prediction talent
- a new DeFi primitive around event-market alpha

## One-Line Product Summary

BeRight is a Solana protocol that turns verified forecasting reputation into controlled access to public capital, combining onchain score anchoring, managed vault custody, and eventually capital-efficient prediction-market yield.
