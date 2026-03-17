use crate::state::ForecasterTier;

/// Tier thresholds
pub struct TierThresholds;

impl TierThresholds {
    /// Brier score threshold for Verified tier
    pub const VERIFIED_BRIER: f64 = 0.25;

    /// Brier score threshold for Elite tier
    pub const ELITE_BRIER: f64 = 0.18;

    /// Brier score threshold for Super tier
    pub const SUPER_BRIER: f64 = 0.12;

    /// Minimum predictions for Rookie
    pub const ROOKIE_PREDICTIONS: u32 = 10;

    /// Minimum predictions for Verified
    pub const VERIFIED_PREDICTIONS: u32 = 20;

    /// Minimum predictions for Elite
    pub const ELITE_PREDICTIONS: u32 = 50;

    /// Minimum predictions for Super
    pub const SUPER_PREDICTIONS: u32 = 100;
}

/// Determine forecaster tier from Brier score and prediction count
pub fn calculate_tier(avg_brier_score: f64, resolved_predictions: u32) -> ForecasterTier {
    if resolved_predictions < TierThresholds::ROOKIE_PREDICTIONS {
        return ForecasterTier::Unranked;
    }

    if avg_brier_score < TierThresholds::SUPER_BRIER
        && resolved_predictions >= TierThresholds::SUPER_PREDICTIONS
    {
        return ForecasterTier::Super;
    }

    if avg_brier_score < TierThresholds::ELITE_BRIER
        && resolved_predictions >= TierThresholds::ELITE_PREDICTIONS
    {
        return ForecasterTier::Elite;
    }

    if avg_brier_score < TierThresholds::VERIFIED_BRIER
        && resolved_predictions >= TierThresholds::VERIFIED_PREDICTIONS
    {
        return ForecasterTier::Verified;
    }

    ForecasterTier::Rookie
}

/// Calculate maximum pool capacity based on tier and Brier score
/// Formula: base_capacity * (2.0 - brier_score)
pub fn calculate_max_capacity(tier: ForecasterTier, brier_score: f64) -> u64 {
    // Base capacity in USDC (6 decimals)
    let base_capacity: u64 = match tier {
        ForecasterTier::Unranked => 0,
        ForecasterTier::Rookie => 0, // Rookies cannot create pools
        ForecasterTier::Verified => 100_000_000_000,    // $100K
        ForecasterTier::Elite => 500_000_000_000,       // $500K
        ForecasterTier::Super => 2_000_000_000_000,     // $2M
    };

    if base_capacity == 0 {
        return 0;
    }

    // Multiplier: lower Brier = higher capacity
    // At Brier 0.0: multiplier = 2.0
    // At Brier 1.0: multiplier = 1.0
    let brier_clamped = brier_score.max(0.0).min(1.0);
    let multiplier = 2.0 - brier_clamped;

    (base_capacity as f64 * multiplier) as u64
}

/// Calculate fee discount based on tier
/// Returns discount in basis points
pub fn calculate_tier_fee_discount(tier: ForecasterTier) -> u16 {
    match tier {
        ForecasterTier::Unranked => 0,
        ForecasterTier::Rookie => 500,      // 5% discount
        ForecasterTier::Verified => 1500,   // 15% discount
        ForecasterTier::Elite => 3000,      // 30% discount
        ForecasterTier::Super => 5000,      // 50% discount
    }
}

/// Apply tier discount to a base fee
pub fn apply_tier_discount(base_fee: u64, tier: ForecasterTier) -> u64 {
    let discount_bps = calculate_tier_fee_discount(tier) as u64;

    base_fee
        .checked_mul(10000 - discount_bps)
        .unwrap()
        .checked_div(10000)
        .unwrap()
}

/// Check if a tier can create a pool
pub fn can_create_pool(tier: ForecasterTier) -> bool {
    matches!(
        tier,
        ForecasterTier::Verified | ForecasterTier::Elite | ForecasterTier::Super
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_tier() {
        // Unranked: < 10 predictions
        assert_eq!(calculate_tier(0.10, 5), ForecasterTier::Unranked);

        // Rookie: 10+ predictions, any Brier
        assert_eq!(calculate_tier(0.50, 15), ForecasterTier::Rookie);

        // Verified: Brier < 0.25, 20+ predictions
        assert_eq!(calculate_tier(0.24, 25), ForecasterTier::Verified);

        // Elite: Brier < 0.18, 50+ predictions
        assert_eq!(calculate_tier(0.17, 55), ForecasterTier::Elite);

        // Super: Brier < 0.12, 100+ predictions
        assert_eq!(calculate_tier(0.11, 105), ForecasterTier::Super);
    }

    #[test]
    fn test_calculate_max_capacity() {
        // Verified with Brier 0.25: $100K * 1.75 = $175K
        let capacity = calculate_max_capacity(ForecasterTier::Verified, 0.25);
        assert_eq!(capacity, 175_000_000_000);

        // Elite with Brier 0.15: $500K * 1.85 = $925K
        let capacity = calculate_max_capacity(ForecasterTier::Elite, 0.15);
        assert_eq!(capacity, 925_000_000_000);

        // Super with Brier 0.10: $2M * 1.9 = $3.8M
        let capacity = calculate_max_capacity(ForecasterTier::Super, 0.10);
        assert_eq!(capacity, 3_800_000_000_000);
    }

    #[test]
    fn test_can_create_pool() {
        assert!(!can_create_pool(ForecasterTier::Unranked));
        assert!(!can_create_pool(ForecasterTier::Rookie));
        assert!(can_create_pool(ForecasterTier::Verified));
        assert!(can_create_pool(ForecasterTier::Elite));
        assert!(can_create_pool(ForecasterTier::Super));
    }
}
