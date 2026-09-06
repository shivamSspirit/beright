# Reputation scoring and underwriting v1

Scores are calculated independently per topic, subtopic, and horizon. Taxonomy v1 includes crypto (bitcoin, ethereum, solana, other_crypto), macro (rates, inflation, employment, growth, markets), and other/uncategorized. Horizons are intraday, 1–7 days, 8–30 days, 31–90 days, and over 90 days. Reputation is never inferred across these boundaries.

The deterministic scorer uses exponentially decayed Brier and log quality, calibration, contemporaneous-market alpha, consistency, resolution/evidence quality, and effective sample size. It shrinks sparse data toward a conservative prior. Statuses are configurable: fewer than 10 resolved observations are Unproven; 10–29 are Provisional; 30–99 with sufficient evidence are Verified; 100+ strong results are Advanced; integrity failures are Restricted.

The scorer separates prediction skill from PnL and reduces quality or eligibility for late/easy/extreme-price entries, topic concentration, selective imports, duplicate/correlated records, unresolved or disputed outcomes, missing evidence, and market-making behavior. Import-only subjects remain probationary.

Canonical market matching is shared with arbitrage. Exact equivalence requires compatible entities, dates, outcomes/inversion, thresholds/units/timezone, resolution source, cancellation rules, and normalized rules. A similar title cannot override a rule conflict. The service returns exact_equivalent, related_not_equivalent, ambiguous_requires_review, or rejected with components, warnings, and disqualifiers.

Underwriting is a deterministic, versioned, read-only recommendation. It can only reduce a configured maximum based on score, confidence, evidence, sample size, relevance, drawdown, and liquidity. Unproven, Provisional, import-only, or Restricted records receive no real-capital recommendation; every recommendation expires. It grants no custody or execution right.
