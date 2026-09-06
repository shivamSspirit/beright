# Forecaster Passport attestation v1

The calibration program exposes an isolated Passport attestation path with no custody, token, staking, capital allocation, or trading instruction. The former V3 score snapshot instruction has been removed.

## Stable PDAs

- configuration: `["passport_config"]`
- subject snapshot: `["passport_v1", subject_pubkey]`

The program ID, Rust constraints, TypeScript derivation helpers, IDL, and tests share these seeds.

`PassportConfig` holds an issuer authority, accepted schema version (`1`), pause flag, update slot, and intentional reserved space. `PassportSnapshotV1` stores issuer-published SHA-256 roots for the reproducible off-chain passport and evidence bundle, plus topic-vector/scoring-code commitments, fixed-point confidence bps, date window, expiry, revocation, and a strictly monotonic epoch.

## Trust model

An account proves only that the configured issuer published or revoked a particular commitment. Independent verification additionally requires the referenced evidence bundle to be accessible and replayable through the scoring-engine verifier. The product must surface unavailable, stale, disputed, or revoked evidence; a PDA alone is not independent proof of the underlying data.

Only the configured authority can initialize, update, publish, or revoke. The subject is used solely as a PDA seed and cannot authorize their own score. A revoked snapshot can be superseded only by a newer issuer epoch. Production should replace the development authority with a governed multisig before any production deployment; no multisig is configured here.

## Validation

`upsert_passport_snapshot` rejects a wrong authority/PDA, paused config, schema mismatch, zero commitments, confidence outside 0–10,000 bps, invalid status, invalid time ordering, expired issuance, and equal or stale epochs. `revoke_passport_snapshot` requires the authority and a nonzero reason hash. Account lengths include the Anchor discriminator and reserved bytes.

Localnet deployment is the first permitted deployment target. Devnet requires an already-configured development authority, RPC, and funds. Mainnet deployment is intentionally out of scope.
