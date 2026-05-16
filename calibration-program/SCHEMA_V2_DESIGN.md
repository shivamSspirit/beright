# ForecasterState V2 Schema Design
**Date**: 2026-04-17
**Engineer**: Genius Mode Engaged
**Purpose**: Incorporate 10 critical lessons from Metaculus testing

---

## Design Principles

1. **Backward Compatibility**: V1 fields preserved, new fields appended
2. **Platform Agnostic**: Works for Polymarket, Metaculus, Kalshi, Manifold
3. **Confidence Weighted**: Bayesian shrinkage prevents tiny-sample gaming
4. **Cross-Platform Consistency**: S6 component measures skill portability
5. **Dual-Path S1**: Separate trade-implied and calibration-binned Brier

---

## Memory Layout Calculation

### V1 Fields (Keep Unchanged)
```
discriminator:          8 bytes
bump:                   1 byte
authority:             32 bytes
total_predictions:      4 bytes  (u32)
resolved_predictions:   4 bytes  (u32)
cumulative_brier:       8 bytes  (f64)
avg_brier_score:        8 bytes  (f64)
cumulative_log_score:   8 bytes  (f64)
avg_log_score:          8 bytes  (f64)
correct_predictions:    4 bytes  (u32)
accuracy:               8 bytes  (f64)
markets_traded:         2 bytes  (u16)
best_category:          1 byte   (u8)
worst_category:         1 byte   (u8)
streak_correct:         2 bytes  (u16)
max_streak_correct:     2 bytes  (u16)
last_prediction_ts:     8 bytes  (i64)
created_at:             8 bytes  (i64)
calibration_buckets:   40 bytes  ([[u16; 2]; 10])
version:                1 byte   (u8)
_reserved_v1:          64 bytes  ([u8; 64])

SUBTOTAL V1: 222 bytes (excluding discriminator)
```

### V2 Additions (NEW)
```
--- DUAL-PATH S1 (Lesson #1) ---
s1_trade_implied:       9 bytes  (Option<f64> = 1 + 8)
s1_calibration_binned:  9 bytes  (Option<f64>)
s1_composite:           8 bytes  (f64)

--- PLATFORM-SPECIFIC SAMPLE SIZES ---
polymarket_resolved:    4 bytes  (u32)
metaculus_resolved:     4 bytes  (u32)
kalshi_resolved:        4 bytes  (u32)
manifold_resolved:      4 bytes  (u32)

--- PLATFORM-SPECIFIC SCORES ---
polymarket_composite:   3 bytes  (Option<u16> = 1 + 2)
metaculus_composite:    3 bytes  (Option<u16>)
kalshi_composite:       3 bytes  (Option<u16>)
manifold_composite:     3 bytes  (Option<u16>)

--- COMPONENT SCORES (S1-S6) ---
s2_resolution:          8 bytes  (f64)
s3_economic_edge:       9 bytes  (Option<f64>)
s3_informational_edge:  9 bytes  (Option<f64>)
s3_composite:           8 bytes  (f64)
s4_difficulty_weighted: 8 bytes  (f64)
s5_volume_consistency:  8 bytes  (f64)
s6_cross_platform:      8 bytes  (f64)  ** NEW **

--- CONFIDENCE WEIGHTING (Lesson #9) ---
total_resolved_events:  4 bytes  (u32)
confidence_weight:      8 bytes  (f64)
raw_composite_score:    2 bytes  (u16)
final_composite_score:  2 bytes  (u16)

--- ANTI-GAMING SIGNALS (Lesson #8) ---
mm_arb_ratio:           8 bytes  (f64)
late_entry_ratio:       8 bytes  (f64)
question_difficulty:    8 bytes  (f64)

--- TIER & BOND ---
tier:                   1 byte   (u8)
performance_bond:       8 bytes  (u64)
bond_locked_until:      8 bytes  (i64)

--- PROOF & UPDATE TRACKING ---
proof_hash:            32 bytes  ([u8; 32])
last_score_update:      8 bytes  (u64)

--- FUTURE EXPANSION ---
_reserved_v2:         128 bytes  ([u8; 128])

SUBTOTAL V2: 359 bytes
```

### Total Account Size
```
Discriminator:   8 bytes
V1 Fields:     222 bytes
V2 Fields:     359 bytes
----------------------------
TOTAL:         589 bytes
```

### Rent Calculation
```
Rent-exempt minimum = (589 bytes) × (SOL per byte)
At current rates: ~0.0042 SOL (~$0.63 at $150/SOL)
```

---

## Field-by-Field Justification

### Why Option<f64> for S1 paths?
- Forecasters may only be active on one platform type
- Polymarket trader → s1_trade_implied = Some(0.85), s1_calibration_binned = None
- Metaculus forecaster → s1_calibration_binned = Some(0.78), s1_trade_implied = None
- Multi-platform → Both Some, composite is weighted average

### Why separate economic vs informational edge?
- Economic edge (Polymarket) = cents per share EV
- Informational edge (Metaculus) = log-odds vs community
- Cannot be directly compared, but both measure "edge"
- Composite uses max() or weighted average based on sample size

### Why u32 for resolved counts per platform?
- 4.3 billion max predictions per platform
- Adonis has 8,317 on Metaculus → u16 (65k max) would overflow eventually
- u32 future-proofs for 50+ years of daily predictions

### Why [u8; 128] reserved space?
- V1 had 64 bytes, which we nearly exhausted
- Doubling to 128 allows for:
  - Additional platforms (e.g., Zeitgeist, Gnosis)
  - New scoring components (S7, S8)
  - Category-specific scores (8 categories × 2 bytes each)
  - Time-decay factors per category

---

## Alignment Considerations

Rust structs have natural alignment. Option<f64> is 9 bytes (1 discriminant + 8 value), which may cause padding.

To minimize padding:
1. Group all Option<f64> fields together
2. Put u64/i64/f64 fields (8-byte) first
3. Put u32 fields (4-byte) next
4. Put u16 fields (2-byte) next
5. Put u8 fields (1-byte) last
6. Put byte arrays at boundaries

Anchor handles serialization with Borsh, which packs tightly without padding for PDAs.

---

## Migration Strategy (V1 → V2)

### Option A: Realloc (Recommended)
```rust
pub fn migrate_to_v2(ctx: Context<MigrateForecaster>) -> Result<()> {
    let old_len = 8 + 222;  // discriminator + V1 fields
    let new_len = 8 + 222 + 359;  // + V2 fields

    // Realloc account
    ctx.accounts.forecaster_state
        .to_account_info()
        .realloc(new_len, false)?;

    // Initialize V2 fields with safe defaults
    // (Existing V1 data remains unchanged)

    Ok(())
}
```

### Option B: Create New + Copy (Safer but more expensive)
- Create new V2 PDA with same seeds
- Copy V1 data
- Close old account
- Costs: extra rent + tx fees

**Recommendation**: Option A (realloc) - cheaper, backward compatible

---

## Version Field Strategy

```rust
pub version: u8,

// Values:
// 1 = V1 schema (original)
// 2 = V2 schema (Metaculus lessons integrated)
// 3+ = Future versions
```

All instructions check version and handle appropriately:
```rust
match forecaster.version {
    1 => migrate_to_v2_if_needed(),
    2 => proceed_normally(),
    _ => return Err(ErrorCode::UnsupportedVersion),
}
```

---

## Security Considerations

### Integer Overflow Protection
All arithmetic uses checked operations:
```rust
self.total_resolved_events = self.total_resolved_events
    .checked_add(1)
    .ok_or(ProgramError::ArithmeticOverflow)?;
```

### Probability Bounds
All probability fields (f64) must be in [0.0, 1.0]:
```rust
require!(
    probability >= 0.0 && probability <= 1.0,
    ErrorCode::InvalidProbability
);
```

### Division by Zero
All averages check denominator:
```rust
if self.total_resolved_events == 0 {
    return Ok(0.0);
}
```

---

## Testing Strategy

### Unit Tests
1. Schema size calculation (assert LEN matches actual)
2. Initialization sets all fields correctly
3. V1 → V2 migration preserves existing data
4. Confidence weighting math (Bayesian shrinkage)
5. S6 cross-platform calculation edge cases

### Integration Tests
1. Create V1 forecaster, make predictions, migrate to V2
2. Create V2 forecaster directly
3. Update scores from multiple platforms
4. Verify rent-exempt amounts

### Invariants
1. `total_resolved_events == sum of platform_resolved counts`
2. `0 <= confidence_weight <= 1.0`
3. `0 <= all component scores <= 1.0`
4. `0 <= final_composite_score <= 1000`
5. `version >= 2` for V2 accounts

---

## Next Steps

1. ✅ Schema designed on paper
2. ⏭️ Implement in Rust with full documentation
3. ⏭️ Write initialization method
4. ⏭️ Write migration method
5. ⏭️ Write helper methods (calculate_confidence, calculate_s6, etc.)
6. ⏭️ Write comprehensive tests
7. ⏭️ Deploy to devnet
8. ⏭️ Test migration on real V1 accounts

---

**Status**: Ready for implementation
**Estimated Implementation Time**: 4 hours
**Risk Level**: Medium (realloc can fail if not enough lamports)
