# Passport v1 Architecture

## Active flow

1. A venue worker accepts a wallet address and fetches public venue history.
2. Venue records are converted to canonical markets, forecast receipts, and
   resolution receipts.
3. Receipts are grouped by topic, subtopic, and horizon.
4. `calculateTopicScoreSnapshotsV1` produces transparent score vectors with
   confidence and anti-gaming metadata.
5. Raw inputs and calculated outputs are committed to an evidence Merkle root.
6. `calculatePassportRootV1` commits the subject, vectors, policy, code hash,
   and evidence root into one Passport root.
7. `verifyEvidenceBundleV1` replays the calculation and rejects mismatches.

## Trust boundaries

- Public history proves activity by an address; it does not prove who controls
  that address. Address-only subjects must remain `unverified`.
- Imported-only history is not underwriting-eligible.
- Provider pagination caps are fatal. A worker must not publish an apparently
  complete Passport after silently truncating history.
- The database write is a subject-scoped transactional replacement so retries
  cannot double-count evidence.
- Any on-chain Passport snapshot is an issuer-authorized commitment to the
  off-chain bundle, not an oracle proof of Polymarket identity or resolution.

## Scoring output

The engine intentionally publishes a topic vector rather than a universal
score. Current inputs include proper-scoring-rule performance, calibration,
market-relative alpha, activity breadth, correlation penalties, timing flags,
sample-size confidence, and import completeness. Exact policy constants are in
`src/reputation/config.ts` and are included in the Passport commitment.

## Removed systems

The V3 unified score, `vaultScore`, cross-platform composite scorer, platform
leaderboard generators, and V3 on-chain score snapshot are not active Passport
components and have been removed.
