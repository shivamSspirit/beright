# BeRight Capital

An isolated Anchor program for making prediction-market positions productive
without giving an AI agent custody or standing transaction authority.

## What is implemented

| Phase | Capability | Status |
| --- | --- | --- |
| 1 | Read-only eligibility, risk-price, and yield simulator | Implemented in `beright-ts` and `berightweb` |
| 2 | SPL YES/NO custody, user position PDAs, caps, pause controls | Implemented; local verification only |
| 3 | Permissionless opposite-side matching and Q64 time-of-participation reward accounting | Implemented |
| 4 | External strategy boundary and physically-backed yield crediting | Wallet-signed Jupiter Earn path implemented; protocol-owned deployment remains disabled without atomic DFlow redemption |
| 5 | Resolution, pair unmatching, unmatched withdrawals, and yield claims | Implemented |
| 6 | Isolated USDC lending, conservative signed prices, low-LTV borrow/repay/liquidation | Implemented |
| 7 | Deterministic routing plus owner-signed, expiring, one-shot intent receipts | Implemented; action-specific keeper execution remains gated |
| 8 | Tokenized thesis registry, closed/open-ended PDA USDC vaults, Token-2022 shares, signed NAV, lockups, performance fees, and epoch redemption | Deployed and create-vault smoke-tested on devnet; not audited |

## Tokenized thesis vault MVP

The program now contains a second, isolated capital primitive for the first
`Solana Growth Index` thesis. It does not replace the matched-pair market vault.

Implemented on-chain:

- permissionless thesis submission with creator-or-curator-controlled vault initialization;
- machine-readable risk parameters and immutable thesis metadata hash;
- one-thesis-one-vault PDA topology with a legacy SPL USDC custody account;
- a PDA-minted, non-transferable Token-2022 share receipt;
- checked pro-rata deposit math with user-provided minimum-share protection;
- closed-ended fundraising with capital and contributor graduation thresholds;
- open-ended launch at zero AUM, `Dormant` to `Active` activation on the first
  deposit, ongoing deposits, and return to `Dormant` after the final redemption;
- structure-specific guards so closed-ended vaults reject post-graduation deposits
  and open-ended vaults reject fundraising/yield configuration;
- a hard 25% prediction ceiling, 5% per-market cap, 10% reserve floor, and
  configurable active-position limit;
- prediction and DeFi allocation targets stored as immutable risk terms, while
  external execution stays disabled until an audited PDA-compatible adapter exists;
- monotonic, signed NAV checkpoints that include liquid, DeFi, prediction,
  resolved-unclaimed, fee, and liability components;
- NAV freshness, checkpoint-change review threshold, per-share high-water mark,
  max-drawdown auto-pause, and deposit cap;
- profit-only curator and protocol performance-fee accrual above the per-share
  high-water mark, with collection limited to physically liquid PDA custody;
- program-enforced lockups: closed-ended lockups start at graduation, while an
  open-ended investor's latest deposit restarts that investor's lockup;
- burn-to-lock redemption requests, cancellation before the next checkpoint,
  and permissionless settlement after a newer NAV epoch;
- post-redemption allocation validation so a withdrawal cannot leave the vault
  above its configured risk limits.

The TypeScript capital library mirrors every new PDA seed, uses `bigint` for
share/NAV arithmetic, builds deterministic checkpoint hashes, and exposes the
devnet blueprint at `GET /api/v2/capital/thesis-vault`.

### Devnet execution boundary

All test USDC remains in the program-controlled liquid vault. The public program
surface contains no simulated thesis-allocation instructions. Prediction and DeFi
targets are configuration only until a venue adapter can move PDA-controlled assets
and return them atomically. A configured oracle signer or multisig reports
conservative NAV components; fee collection fails unless the liquid vault holds the
corresponding devnet USDC.

This is deliberate: the MVP proves custody, share math, risk limits, NAV epochs,
and redemption state transitions without implying that Jupiter Prediction or a
DeFi venue already supports the required PDA execution path.

## Security boundaries

- The program never accepts a model-generated price. Only the configured oracle
  authority can publish monotonic price snapshots, and borrowing rejects stale or
  wide-confidence data. Oracle observations cannot claim future slots.
- Deposits and withdrawals use checked legacy SPL transfers. Token-2022 mints are
  rejected because transfer-fee extensions could desynchronize accounting. Vault
  authority is the market or lending-pool PDA.
- Matching is accounting-only until an audited venue CPI can atomically redeem a
  complete YES+NO set. The strategy adapter starts disabled.
- Direct USDC deposits and withdrawals can be prepared through the official
  Jupiter Lend SDK. The API validates every top-level program and signer, returns
  an unsigned v0 transaction, and never submits it. This user-wallet strategy is
  deliberately separate from matched-pair custody.
- `harvest_yield` credits rewards only after settlement tokens are physically
  transferred into the market vault.
- Agent intents bind owner, executor, market, action, amount, minimum output,
  nonce, and expiry. They grant no custody and no open-ended delegate authority.
- Emergency pause blocks new deposits, matches, harvests, lending deposits, and
  borrows. Repayment and safe exits remain available.
- Every market configures an on-chain borrow cutoff before resolution. A full
  repayment releases all remaining collateral automatically, preventing a
  zero-debt loan from stranding position tokens.
- Strategy changes have an immutable minimum 24-hour activation delay. Admin
  rotation is a two-step propose/accept flow so a Squads vault can safely take
  control without sharing a deployer key.

## Jupiter Earn transaction boundary

Set these only after reviewing the production RPC and transaction cap:

```bash
CAPITAL_STRATEGY_PREPARE_ENABLED=true
CAPITAL_STRATEGY_RPC_URL=https://your-mainnet-rpc
CAPITAL_STRATEGY_MAX_USDC_ATOMIC=10000000000
```

The preparation endpoint supports USDC deposits, underlying-amount withdrawals,
and share redemptions. It permits only Jupiter Lend plus the required Solana
system, compute-budget, SPL Token, associated-token, and memo programs. Any
unexpected signer or program causes the request to fail closed.

Borrowed principal is debt, not yield. BeRight never distributes borrowed USDC
as APY. Prediction-token holders can receive only physically realized strategy
income or explicitly defined borrower interest after the corresponding accounting
is implemented and audited.

## Local verification

```bash
cargo check --manifest-path capital-program/Cargo.toml
cargo test --manifest-path capital-program/Cargo.toml
cd capital-program
../.agents/skills/qedgen/tools/qedgen check --coverage
../.agents/skills/qedgen/tools/qedgen probe --spec beright-capital.qedspec
npx tsx scripts/initialize-devnet.ts
npx tsx scripts/smoke-test-devnet.ts
```

The devnet program address is
`F2WkXzns4p5pe8NAuK6V5NhZ4bdpXxAE9h5kLAMtxqCT`. Its ignored deployment keypair
and upgrade-authority keypair are local-only and must never be committed. The
deployed artifact has SHA-256
`54f769c0fb5d4b3ff828d7ce272c8d7b5afe7a8f9f840cc5d2dd0ad759cc288f`.
The upgrade transaction was verified on Solana devnet; its signature is
intentionally omitted from the repository.

The wallet-signed open-ended create-vault smoke transaction was also verified on
devnet; its signature is intentionally omitted from the repository.
It verified the thesis and vault program owners, the Token-2022 share-mint owner,
the legacy SPL liquid-vault owner, zero initial AUM, and the expected `Dormant`
status. A deposit/cancel smoke cycle still requires devnet USDC for the deployer;
SOL must not be substituted for the configured USDC settlement mint.

Deploy upgrades with an explicit program keypair so a stale build-artifact
keypair cannot select a different address:

```bash
solana program deploy \
  --program-id ./target/deploy/beright_capital-keypair.json \
  ./target/deploy/berightcapital.so \
  --keypair ./devnet-deployer.keypair.json \
  --url devnet
```

QEDGen currently validates handler/effect alignment and aggregate property
coverage (41/41 instructions, zero warnings) and the spec-aware probe reports no
findings. Lean source is generated,
but theorem obligations have not been discharged because Lean/Elan is not
installed in this workspace; do not describe the program as formally proven.

## Multisig handoff

The program supports two-step protocol-admin rotation (`propose_admin`, then
`accept_admin`) and admin-controlled rotation of the emergency, strategy, and
oracle authorities. After a Squads vault address is selected and verified:

1. the current admin proposes the Squads vault;
2. Squads accepts admin authority and rotates the three operating roles;
3. the current upgrade authority transfers the program upgrade authority with
   `solana program set-upgrade-authority` through Squads' Safe Authority Transfer
   flow;
4. all four authorities are re-read from devnet before the deployer key is retired.

Do not substitute an unverified address or perform the transfer before Squads can
execute the acceptance transaction; a wrong upgrade-authority transfer can make
the program permanently unupgradable.

## Mainnet gate

This code is not audited and must not hold real value yet. Mainnet requires:

1. an official DFlow complete-set merge/redeem CPI or another audited venue adapter
   before protocol-owned prediction tokens can produce external USDC yield;
2. Surfpool/mainnet-fork tests for the pinned Jupiter program and USDC accounts;
3. resolution of production dependency advisories and an independent security and
   economic review;
4. Squads-controlled admin/strategy authorities, deployment-key rotation,
   monitoring, and a capped rollout.
