# Reputation Protocol v1

`@beright/forecaster-scoring-engine` owns the canonical runtime schemas, strict TypeScript types, canonical JSON encoder, and SHA-256 utilities under `src/protocol/v1`. The backend consumes that package; the scoring engine does not depend on the backend, avoiding a circular dependency.

Every public object carries `schemaVersion: "reputation-protocol/v1"`. Hashes use UTF-8 SHA-256 over canonical JSON with lexicographically sorted object keys, preserved array order, ISO-8601 timestamps, finite JSON numbers, and no `undefined` values.

## Data classes and trust boundaries

Subjects use a chain-neutral `primaryWallet` plus `walletChain`. The active
worker creates Ethereum subjects from Polymarket addresses. A public address is
enough to assemble history, but not enough to claim the owner, so address-only
Passports are explicitly unverified.

- Source evidence: Polymarket API records, public profiles, venue transactions, and resolution-source records. `rawEvidenceHash` and `evidenceHash` commit to these records; a hash does not make unavailable evidence independently verifiable.
- Derived data: canonical market classification, equivalence decisions, topic scores, confidence, effective sample size, penalties, evidence roots, and underwriting recommendations. These are reproducible when the evidence bundle and versioned code/configuration are available.
- Attested data: issuer-signed or Solana-published passport commitments. An attestation proves that the configured issuer published the commitment at a point in time. It does not prove the truth or completeness of source evidence.
- Unverified metadata: display names, free-form titles, profile text, provider labels, and manually supplied annotations until supported by accessible evidence.

`ForecastReceiptV1.sourceType` permanently distinguishes venue trades from explicit forecasts. Trade receipts require an entry price; explicit forecasts cannot carry entry price or position size. PnL remains venue metadata and is not forecast skill.

Underwriting outputs are read-only, deterministic recommendations. They grant no custody, transaction authority, allocation, or withdrawal rights and always expire.
