# Project Provenance

BeRight is published here as a clean reviewer snapshot of a private development effort. The public/reviewer repository is intentionally a single curated commit so reviewers can inspect the current product surface without inherited local credentials, experimental branches, deployment noise, or obsolete product directions.

## Development History

BeRight has gone through a private four-month build cycle before this publication snapshot. The work covered:

- market aggregation and API routing in `beright-ts`
- AI-assisted terminal and web workflows in `berightweb`
- Solana-linked prediction recording in `calibration-program`
- forecaster scoring and leaderboard logic in `forecaster-scoring-engine`
- repeated product-scope pruning as the project moved away from retired vault, pool, staking, and delegation concepts

The original private repository history is retained by the maintainers for internal audit and continuity, but it is not the review surface because old development history contained operational noise and sensitive configuration material that should not be redistributed.

## Why The Public History Is Squashed

The single public commit is a security and reviewer-experience decision, not an attempt to obscure authorship.

It keeps the review surface focused on:

- the current product architecture
- the current code
- the current setup instructions
- the current security posture

It avoids exposing:

- stale credentials or credential-like examples from old commits
- merged pull-request refs from retired implementation branches
- internal deployment experiments
- misleading commit messages from debugging or infrastructure cleanup
- retired product directions that are no longer part of BeRight

## Ownership Signals

Reviewers can evaluate authorship and continuity through:

- the breadth of implementation across web, API, Solana program, and scoring engine
- consistent BeRight product language across `README.md`, `AGENTS.md`, `CLAUDE.md`, and package docs
- working local setup via the root npm workspaces
- Solana calibration program source and Anchor configuration in `calibration-program`
- scoring and leaderboard logic in `forecaster-scoring-engine`
- private repository access or private audit evidence from the maintainers when appropriate

## Reviewer Notes

For normal review, use the clean public repository:

```text
https://github.com/shivamSspirit/beright-review
```

For deeper diligence, maintainers can provide controlled evidence separately, such as deployment history, private commit metadata, product demos, or provider dashboard timestamps. Those materials should be shared selectively because they may include operational details that do not belong in a public source repository.

## Security Position

Any credential that ever appeared in private development history should be treated as compromised and rotated. The public reviewer snapshot should pass:

```bash
gitleaks detect --source . --redact --no-banner
```

The repository should never publish real `.env` files, private key files, wallet keypairs, provider tokens, or deployment credentials.
