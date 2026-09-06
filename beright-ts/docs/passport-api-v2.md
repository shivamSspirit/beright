# Forecaster Passport API v2

The Passport API exposes reproducible prediction reputation. It does not execute trades, custody funds, allocate capital, or grant withdrawal rights.

## Public endpoints

- `GET /api/v2/passports/{subject}` returns a versioned identity summary, active/revoked claims, score status, source freshness, and optional published attestation metadata.
- `GET /api/v2/passports/{subject}/topics` returns isolated topic/subtopic/horizon score vectors.
- `GET /api/v2/passports/{subject}/evidence` returns normalized receipts, canonical markets, and resolution records. It never returns signatures, provider credentials, or private proof payloads.
- `GET /api/v2/passports/{subject}/evidence-bundle` downloads the public data needed for local replay. It returns `409 EVIDENCE_UNAVAILABLE` if an issuer has not made source evidence accessible.
- `POST /api/v2/passports/{subject}/verify` performs a read-only replay of a published bundle. A caller may submit a bundle to check a locally modified copy.
- `GET /api/v2/passports/{subject}/underwriting` returns a deterministic, expiring, read-only recommendation.
- `GET /api/v2/markets/{canonicalEvent}/equivalents` returns venue members and equivalence review fields.
- `GET /api/v2/passports/metrics` returns measurement only; it always reports `launchGoalsAchieved: false` until real measured results support a claim.

All responses include `reputation-protocol/v1`. Errors have an `error.code` and a safe user-facing message. Public responses are cached for 60 seconds and may be served stale for up to two additional minutes.

## Polymarket Passport worker

`POST /api/v2/passports/polymarket` accepts exactly one product input:

```json
{ "address": "0x…" }
```

The route is available under the standard IP/user rate limit and requires no
Polymarket credential or wallet signature. It validates the Ethereum address, fetches all accessible
public trades plus open and closed positions, reconciles the venue-reported
market count, loads canonical market metadata and resolutions, builds forecast
and resolution receipts, calculates topic score vectors, verifies the evidence
bundle, and transactionally replaces that address's prior Polymarket Passport.

Provider pagination caps, malformed records, incomplete coverage, or a failed
database transaction do not produce a successful Passport. Retries are
subject-scoped and idempotent. Because an address alone does not prove wallet
control, the created subject is always `identityStatus: "unverified"`. Its
subject identifier is `polymarket:<lowercase-address>`; read routes also accept
the raw address.

## Identity mutations

`POST /api/v2/identity/challenges`, `POST /api/v2/identity/claims`, `DELETE /api/v2/identity/claims/{claimId}`, and `POST /api/v2/identity/claims/{claimId}/refresh` require verified wallet authentication and a bound one-time primary-wallet challenge. Claim linking additionally verifies the external account according to the venue method. Deprecated platform-import mutations return `410` and cannot create claims.

## Evidence bundle and replay

An `evidence-bundle/v1` contains the public subject, receipts, raw source records, canonical-market records, resolution receipts, score inputs, published snapshots, policy inputs, and versioned hashes. The verifier validates every schema and source-evidence hash, reconstructs the deterministic receipt Merkle root, recomputes scoring and policy output, then compares the final passport root. The `@beright/forecaster-scoring-engine` CLI is invoked with `npm run verify:passport --workspace forecaster-scoring-engine -- <bundle.json>`.

Source evidence is evidence supplied by the external venue. Topic scores and underwriting outputs are derived data. A Solana snapshot is issuer-attested data: it proves the issuer published its roots, not that unavailable off-chain source records are true. Profile display names and non-proof platform metadata are unverified metadata.
