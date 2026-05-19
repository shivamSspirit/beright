# BeRight Scoring V3

## Purpose

Scoring V3 is the canonical first layer of the BeRight forecaster network.

It exists to answer three different questions:

1. How strong is this forecaster based on imported history?
2. How strong is this forecaster based on BeRight-native history?
3. How much trust should this forecaster receive now?

This yields three outputs:

- `IScore`: imported history score
- `NScore`: BeRight-native score
- `VScore`: unified reputation score, stored as `vaultScore` in the current JSON/program contract for compatibility

`calibration-program` should only anchor native performance and accepted score snapshots.
The downstream policy/risk layer should consume score outputs and enforce capital policy.

## Principles

1. Imported history can bootstrap admission, but cannot permanently dominate reputation
2. Native history should become the dominant signal over time
3. Small-sample luck must be discounted
4. Proper scoring rules should dominate the model
5. Anti-gaming must reduce score, not merely annotate it
6. Capital rights must not be mapped linearly from raw score
7. Venue history must carry explicit resolution evidence before it can influence capital
8. Forecasters must never be the trusted resolver for their own capital-impacting native forecasts

## Inputs

The V3 engine accepts resolved and unresolved predictions from two channels:

- `imported`
  - Polymarket
  - Solana-native prediction market venues
  - future approved external venues

- `native`
  - BeRight platform predictions
  - resolved by BeRight platform logic
  - optionally mirrored into the calibration program

## Outputs

The engine should emit a versioned snapshot with:

- `scoreVersion`
- `scoreEpoch`
- `forecasterId`
- `importedScore`
- `nativeScore`
- `vaultScore`
- `confidence`
- `evidenceQuality`
- `nativeResolvedCount`
- `importedResolvedCount`
- `penalties`
- `status`
- `tier`
- `riskCaps`

## Imported Score

Imported score is used for bootstrapping a forecaster into the network.

### Imported Component Weights

- `40%` decayed Brier quality
- `20%` decayed log-score quality
- `15%` calibration quality
- `10%` difficulty-weighted quality
- `10%` consistency
- `5%` consensus edge

### Imported Confidence

Imported confidence should be stricter than native confidence.

```text
ESS = (Σw)^2 / Σ(w^2)
ImportedConfidence = ESS / (ESS + 100)
ImportedConfidenceAdjustment = 0.35 + 0.65 * ImportedConfidence
```

### Imported Penalties

Imported history carries greater gaming risk.

Penalties should reduce score for:

- late-entry behavior
- easy-market farming
- extreme-price market-making behavior
- over-concentration in one niche

### Imported Score Formula

```text
ImportedSkill =
  0.40 * BrierQuality +
  0.20 * LogQuality +
  0.15 * CalibrationQuality +
  0.10 * DifficultyQuality +
  0.10 * ConsistencyQuality +
  0.05 * EdgeQuality

IScore = 1000 * ImportedSkill * ImportedEvidenceQuality * ImportedConfidenceAdjustment * ImportedPenalty
```

## Native Score

Native score is the long-run reputation source for the BeRight network.

### Native Component Weights

- `35%` decayed Brier quality
- `20%` decayed log-score quality
- `20%` calibration quality
- `10%` difficulty-weighted quality
- `10%` consensus edge
- `5%` consistency

### Native Confidence

Native data is more trustworthy and should converge faster.

```text
ESS = (Σw)^2 / Σ(w^2)
NativeConfidence = ESS / (ESS + 75)
NativeConfidenceAdjustment = 0.35 + 0.65 * NativeConfidence
```

### Native Score Formula

```text
NativeSkill =
  0.35 * BrierQuality +
  0.20 * LogQuality +
  0.20 * CalibrationQuality +
  0.10 * DifficultyQuality +
  0.10 * EdgeQuality +
  0.05 * ConsistencyQuality

NScore = 1000 * NativeSkill * NativeEvidenceQuality * NativeConfidenceAdjustment * NativePenalty
```

## Unified Score

The unified score is the score consumed by BeRight reputation surfaces.

It should transition from imported trust to native trust as a forecaster builds a BeRight history.

### Native Weighting Policy

- if `nativeResolvedCount < 20`
  - `VScore = 0.70 * IScore + 0.30 * NScore`
- if `20 <= nativeResolvedCount < 100`
  - `VScore = 0.40 * IScore + 0.60 * NScore`
- if `nativeResolvedCount >= 100`
  - `VScore = 0.20 * IScore + 0.80 * NScore`

If native score is missing:

- imported score can enable `BootstrapEligible`
- imported-only users must receive reduced caps

If imported score is missing:

- use native score only

## Status Model

V3 should emit a status that downstream reputation and policy layers can consume directly.

- `ImportedCandidate`
- `BootstrapEligible`
- `NativeCalibrating`
- `NativeVerified`
- `VaultEligible`
- `VaultScaled`
- `Restricted`

## Tier Model

Suggested tier cutoffs:

- `VScore < 700`: `restricted`
- `700-749`: `bootstrap`
- `750-799`: `standard`
- `800-849`: `advanced`
- `850+`: `elite`

## Risk Cap Policy

V3 should also emit recommended caps rather than letting downstream policy infer them.

Suggested active sleeve limits:

- `restricted`: `0 bps`
- `bootstrap`: `1000 bps`
- `standard`: `1500 bps`
- `advanced`: `2000 bps`
- `elite`: `2500 bps`

Suggested probation rule:

- imported-only forecasters cannot exceed `1000 bps`
- full sleeve rights require minimum native history

## Capital Mandate Policy

`riskCaps` are recommendations, not custody. Downstream Solana policy should translate them into a bounded `CapitalMandate`:

```text
CapitalLimit =
  BaseLimit
  * VScoreMultiplier
  * ConfidenceMultiplier
  * EvidenceQualityMultiplier
  * DrawdownMultiplier
  * LiquidityMultiplier
```

Suggested public tiers:

| Tier | Trust State | Suggested Capital |
| --- | --- | ---: |
| `restricted` | no capital rights | `$0` |
| `bootstrap` | imported skill only or early native history | up to `$5,000` |
| `standard` | clean history and enough observations | up to `$25,000` |
| `advanced` | strong cross-market performance | up to `$50,000` |
| `elite` | high score, high confidence, low drawdown | up to `$100,000` |

Capital mandates must be bounded by:

- max active capital
- max market exposure
- max theme/category exposure
- max daily/epoch loss
- allowed venues
- mandate expiry
- emergency pause

Forecasters should direct capital through signed intents or policy-checked workflows. They should not receive withdrawal authority over BeRight capital.

## Effective Sample Size

Use exponentially decayed observation weights:

```text
w_i = exp(-ln(2) * age_days_i / half_life_days)
```

Recommended half-lives:

- imported: `120` days
- native: `90` days

And:

```text
ESS = (Σw)^2 / Σ(w^2)
```

## Calibration Quality

Calibration quality is based on bucket deviation:

```text
CalibrationError = Σ bucket_weight * |bucket_accuracy - bucket_midpoint|
CalibrationQuality = clamp(1 - CalibrationError / 0.35, 0, 1)
```

## Difficulty Quality

Difficulty is higher when a market is closer to uncertainty or has wider community spread.

Use difficulty as a multiplier on quality rather than a raw count.

## Edge Quality

For forecast platforms:

- measure whether the forecaster beats market or community consensus

For trade-based platforms:

- use entry price vs resolution quality, not raw pnl alone

## Resolution Evidence Quality

Every resolved observation should include `resolutionEvidence`:

```typescript
interface ResolutionEvidence {
  source: string; // e.g. polymarket-data-api, limitless-portfolio-api, pyth, switchboard
  finality: 'venue_final' | 'oracle_final' | 'redeemable' | 'api_resolved' | 'provisional' | 'disputed' | 'unknown';
  confidence: number; // 0.0-1.0
  observedAt?: Date;
  referenceUrl?: string;
  evidenceHash?: string;
}
```

Resolution evidence is a multiplicative trust factor:

```text
EvidenceQuality = weighted_mean(min(finality_quality, confidence))
```

Suggested finality quality:

| Finality | Quality | Use |
| --- | ---: | --- |
| `venue_final` | `1.00` | Final venue-settled Polymarket/Metaculus-style record |
| `oracle_final` | `1.00` | Final Pyth/Switchboard/Chainlink-style objective oracle record |
| `redeemable` | `0.98` | Position can be redeemed or settled onchain |
| `api_resolved` | `0.90` | Venue API marks market resolved, but independent redeemability is not proven |
| `provisional` | `0.65` | Proposed outcome before dispute/finality window closes |
| `disputed` | `0.25` | Active dispute or ambiguous outcome |
| `unknown` | `0.80` | Legacy/imported records without explicit evidence metadata |

Current imported-source policy:

- Polymarket closed-position imports use `polymarket-data-api`, `venue_final`, confidence `0.95`
- Limitless resolved portfolio imports use `limitless-portfolio-api`, `api_resolved`, confidence `0.85`
- Metaculus resolved imports use `metaculus-api`, `venue_final`, confidence `0.90`

For BeRight-native forecasts, capital-impacting resolution must be written by a resolution adapter or protocol authority. A forecaster-signed self-resolution can remain useful for demos or personal tracking, but it must not unlock capital or increase a capital mandate.

## Anti-Gaming

V3 penalties should be multiplicative and bounded.

Recommended minimum penalty floor:

- `0.70`

Penalty inputs:

- late-entry ratio
- easy-market ratio
- extreme-price ratio
- category concentration

## Migration Plan

### Phase 1

Implement V3 as the canonical scorer.

- `src/v3/*` is the single scoring implementation
- emit versioned score snapshots + calibration summaries

### Phase 2

Update backend consumers to read V3 snapshot shape.

### Phase 3

Push V3 snapshot summaries into the calibration layer.

### Phase 4

Make V3 the only canonical scorer.

## Repository Contract

After V3 lands:

- `forecaster-scoring-engine` becomes the canonical scoring layer
- `calibration-program` becomes the on-chain reputation anchor
- Downstream policy services consume score snapshots and caps
