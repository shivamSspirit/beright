# BeRight Capital architecture

The thesis-vault release prepares wallet-signed Solana devnet transactions. The
isolated Anchor program controls custody, shares, lockups, fee accounting, and
redemption state; external trading adapters remain disabled.

Program `F2WkXzns4p5pe8NAuK6V5NhZ4bdpXxAE9h5kLAMtxqCT` is deployed on devnet. A
wallet-signed open-ended vault creation has executed successfully against the
deployed artifact. Deposit/cancel runtime testing remains gated on test-wallet
devnet USDC; the program is unaudited and must not hold real-value assets.

## API surface

- `GET /api/v2/capital/positions/:wallet` — discover supported outcome tokens
- `GET /api/v2/capital/eligibility` — deterministic market and liquidity checks
- `GET /api/v2/capital/yield-rates` — variable USDC reference rate
- `POST /api/v2/capital/simulate` — non-custodial matched-pair yield model
- `POST /api/v2/capital/route` — deterministic hold/yield/borrow/exit recommendation
- `POST /api/v2/capital/theses` — prepare a creator-signed devnet vault transaction
- `PATCH /api/v2/capital/theses` — confirm the created program account
- `POST /api/v2/capital/theses/:slug/deposit` — quote or prepare a signed deposit
- `POST /api/v2/capital/theses/:slug/redemptions` — prepare funding cancellation or redemption
- `POST /api/v2/capital/theses/:slug/fees` — prepare curator fee collection

Legacy matching and routing endpoints remain simulations. Thesis-vault endpoints
return unsigned transactions; the server never signs or submits them. The browser
simulates the signed transaction, submits it to devnet, and waits for confirmation.

## On-chain state flow

```text
ProtocolConfig
  └─ MarketVault + PriceSnapshot
       ├─ UserPosition (one per owner)
       │    └─ AgentIntent (owner + executor + nonce + expiry)
       └─ LendingPool
            ├─ LenderPosition
            └─ LoanPosition
```

Prediction tokens stay in market PDA vaults. Matching changes only deterministic
accounting. Yield is credited through a Q64 reward index only after settlement
tokens enter the market vault. Lending cash is isolated per market and cannot be
borrowed above the lower executable-bid/TWAP value after haircut.

## External integrations

DFlow describes outcome positions as SPL tokens and describes mint/burn behavior,
but its public API documentation does not currently expose an on-chain complete-set
merge CPI. Therefore the strategy adapter remains disabled rather than pretending
that matched YES+NO custody already creates USDC.

Jupiter Earn documents lending CPIs, but that adapter is deliberately excluded
until complete-set redemption produces real settlement liquidity and the exact CPI
account path is integration-tested and audited.

References:

- <https://dflow.net/blog/prediction-markets-api>
- <https://pond.dflow.net/llms.txt>
- <https://developers.jup.ag/docs/lend/earn/cpi>
