# Security model

## Protected assets

- YES and NO prediction tokens in market PDA vaults
- settlement tokens representing realized yield
- USDC lenders' assets in isolated pool PDAs
- owner authorization encoded in agent-intent PDAs
- test USDC and Token-2022 share supply in tokenized thesis vault PDAs
- pending redemption claims and signed thesis NAV checkpoints

## Trust boundaries

- Market resolution is trusted to the per-market resolution authority until a
  verified venue-resolution CPI is available.
- Executable-bid and TWAP snapshots are trusted to a configured oracle authority,
  but the program enforces freshness, confidence, monotonicity, and haircuts.
- Protocol-owned strategy deployment is trusted to a separately configured
  strategy authority and timelocked adapter. It is disabled by default.
- Direct Jupiter Earn operations are user-wallet transactions. The server can
  construct and validate them but cannot sign or submit them.
- AI output is untrusted. It can prepare a recommendation or exact intent payload,
  but only the user's signature creates authorization.
- The singleton config can only be initialized by the program's current upgrade
  authority, preventing public initialization front-running.
- Thesis creators choose a fixed risk envelope when creating a vault. Deposits are
  wallet-signed, and the curator has no withdrawal authority over investor custody.
- Thesis NAV checkpoints are trusted to the configured oracle authority. The
  program enforces monotonic epochs and timestamps, freshness, component
  reconciliation, reserve and prediction ceilings, and a maximum checkpoint
  delta. This is a signed-accounting trust boundary, not an on-chain oracle.

## Invariants

1. Matched pairs never exceed either side's deposited balance.
2. Locked collateral cannot be withdrawn or matched.
3. Credited yield cannot exceed settlement tokens transferred into custody.
4. Total lender assets equal cash plus borrows less bad debt, subject to rounding.
5. Borrowing uses the lower of executable bid and TWAP after haircut.
6. Intent nonces are monotonic; only the owner-selected executor can consume an
   intent, and each intent is consumed at most once.
7. Tokenized-vault mint supply equals economic shares less shares burned into
   pending redemption claims.
8. Pending redemption shares never exceed total economic shares.
9. Prediction and combined simulated allocations remain within thesis limits,
   including after a redemption.
10. A redemption uses a newer NAV epoch, rounds assets down, and cannot pay more
    USDC than the PDA custody account holds.
11. Performance fees accrue only on net per-share value above the prior high-water
    mark; the curator/protocol split always equals total accrued fees.
12. Active redemptions cannot be requested before the applicable on-chain lockup.

## Known limitations

- No DFlow complete-set CPI is integrated. Matching does not itself create USDC.
- The production Jupiter SDK is integrated for direct user-wallet USDC actions,
  not for deploying PDA-custodied matched-pair assets.
- Kamino and Loopscale are registry-gated until a specific vault, allocation cap,
  transaction policy, and partner approval are configured.
- The dependency audit currently reports unresolved advisories. Strategy
  preparation must remain disabled until the production dependency tree is
  reviewed and remediated or explicitly accepted by security reviewers.
- Interest accrual is intentionally excluded from the first isolated lending
  implementation; lender shares account for cash, borrows, and bad debt only.
- Intent receipts do not provide generic CPI authority. Each future automated
  action must consume and validate the intent inside that exact action handler.
- Formal verification is an aggregate accounting model; Anchor constraints and
  Rust tests cover account topology and token custody boundaries.
- Thesis-vault external execution is disabled. Physical Jupiter Prediction and
  DeFi PDA adapters are not implemented; allocation targets cannot move custody.
- Thesis metadata is currently stored by the application process. Program
  accounts remain authoritative for custody, shares, lockups, fees, and lifecycle.
- The devnet program upgrade authority and initial protocol authorities are a
  single signer until a user-selected Squads address completes the handoff.
- The initial NAV authority can be a single signer on devnet. Production needs
  independent reporters or a multisig, published inputs, and dispute handling.
