# BeRight Calibration / Passport Program

This Anchor program keeps two narrowly separated responsibilities:

1. Record wallet-signed forecasts and resolve those records through a configured
   protocol authority.
2. Publish or revoke issuer-authorized Passport v1 root commitments.

The former V3 score snapshot, vault score, and risk-cap synchronization surface
has been removed. The remaining forecast-record account fields are retained for
deployed account compatibility; they are not the active reputation output.

## Active PDAs

- `ForecasterState`: `[b"forecaster_v2", forecaster]`
- `PredictionRecord`: `[b"prediction", forecaster, market_id, timestamp]`
- resolution authority configuration (legacy account name): `[b"score_config"]`
- `PassportConfig`: `[b"passport_config"]`
- `PassportSnapshotV1`: `[b"passport_v1", subject]`

The Passport instruction source is in `programs/calibration/src/instructions/manage_passport.rs`.
Its account layout and trust boundary are documented in `PASSPORT_V1.md`.

## Verification

```bash
cargo check
npx tsc --noEmit
anchor test
```

`cargo check` validates the native Rust target. An Anchor SBF build and localnet
tests are still required before deploying a changed program.
