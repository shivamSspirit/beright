#[cfg(test)]
mod tests {
    use crate::state::*;
    use crate::utils::nav::*;
    use crate::utils::tier::*;

    // ============ Tier Calculation Tests ============

    #[test]
    fn test_calculate_tier_unranked() {
        // Less than 10 predictions = Unranked
        let tier = calculate_tier(0.15, 5);
        assert_eq!(tier, ForecasterTier::Unranked);
    }

    #[test]
    fn test_calculate_tier_rookie() {
        // 10+ predictions but Brier >= 0.25
        let tier = calculate_tier(0.30, 15);
        assert_eq!(tier, ForecasterTier::Rookie);
    }

    #[test]
    fn test_calculate_tier_verified() {
        // Brier < 0.25, 20+ predictions
        let tier = calculate_tier(0.22, 25);
        assert_eq!(tier, ForecasterTier::Verified);
    }

    #[test]
    fn test_calculate_tier_elite() {
        // Brier < 0.18, 50+ predictions
        let tier = calculate_tier(0.15, 60);
        assert_eq!(tier, ForecasterTier::Elite);
    }

    #[test]
    fn test_calculate_tier_super() {
        // Brier < 0.12, 100+ predictions
        let tier = calculate_tier(0.10, 150);
        assert_eq!(tier, ForecasterTier::Super);
    }

    // ============ Pool Creation Eligibility Tests ============

    #[test]
    fn test_can_create_pool_verified() {
        assert!(can_create_pool(ForecasterTier::Verified));
    }

    #[test]
    fn test_can_create_pool_elite() {
        assert!(can_create_pool(ForecasterTier::Elite));
    }

    #[test]
    fn test_can_create_pool_super() {
        assert!(can_create_pool(ForecasterTier::Super));
    }

    #[test]
    fn test_cannot_create_pool_unranked() {
        assert!(!can_create_pool(ForecasterTier::Unranked));
    }

    #[test]
    fn test_cannot_create_pool_rookie() {
        assert!(!can_create_pool(ForecasterTier::Rookie));
    }

    // ============ Capacity Calculation Tests ============

    #[test]
    fn test_capacity_verified_base() {
        // Verified with Brier 0.25: $100K * (2.0 - 0.25) = $100K * 1.75 = $175K
        let capacity = calculate_max_capacity(ForecasterTier::Verified, 0.25);
        assert_eq!(capacity, 175_000_000_000); // $175K in base units
    }

    #[test]
    fn test_capacity_verified_excellent() {
        // Verified with Brier 0.15: $100K * (2.0 - 0.15) = $100K * 1.85 = $185K
        let capacity = calculate_max_capacity(ForecasterTier::Verified, 0.15);
        assert_eq!(capacity, 185_000_000_000);
    }

    #[test]
    fn test_capacity_elite() {
        // Elite with Brier 0.18: $500K * (2.0 - 0.18) = $500K * 1.82 = $910K
        let capacity = calculate_max_capacity(ForecasterTier::Elite, 0.18);
        assert_eq!(capacity, 910_000_000_000);
    }

    #[test]
    fn test_capacity_super() {
        // Super with Brier 0.10: $2M * (2.0 - 0.10) = $2M * 1.9 = $3.8M
        let capacity = calculate_max_capacity(ForecasterTier::Super, 0.10);
        assert_eq!(capacity, 3_800_000_000_000);
    }

    // ============ NAV Calculation Tests ============

    #[test]
    fn test_shares_for_first_deposit() {
        // First deposit: 1:1 ratio at NAV 1.0
        let shares = calculate_shares_for_deposit(
            1_000_000_000, // 1000 base tokens
            NAV_DECIMALS,  // NAV = 1.0
            0,             // No existing shares
        ).unwrap();

        assert_eq!(shares, 1_000_000_000);
    }

    #[test]
    fn test_shares_at_higher_nav() {
        // When NAV = 2.0, depositing 1000 tokens gets 500 shares
        let nav = 2 * NAV_DECIMALS; // NAV = 2.0
        let shares = calculate_shares_for_deposit(
            1_000_000_000, // 1000 base tokens
            nav,
            1_000_000_000, // Existing shares
        ).unwrap();

        // Should get half the shares since NAV doubled
        assert_eq!(shares, 500_000_000);
    }

    #[test]
    fn test_shares_at_lower_nav() {
        // When NAV = 0.5, depositing 1000 tokens gets 2000 shares
        let nav = NAV_DECIMALS / 2; // NAV = 0.5
        let shares = calculate_shares_for_deposit(
            1_000_000_000, // 1000 base tokens
            nav,
            1_000_000_000, // Existing shares
        ).unwrap();

        // Should get double the shares since NAV halved
        assert_eq!(shares, 2_000_000_000);
    }

    #[test]
    fn test_withdrawal_amount() {
        // At NAV 1.0, 1000 shares = 1000 tokens
        let amount = calculate_withdrawal_amount(
            1_000_000_000, // 1000 shares
            NAV_DECIMALS,  // NAV = 1.0
        ).unwrap();

        assert_eq!(amount, 1_000_000_000);
    }

    #[test]
    fn test_withdrawal_with_profit() {
        // At NAV 1.5, 1000 shares = 1500 tokens
        let nav = NAV_DECIMALS + NAV_DECIMALS / 2; // NAV = 1.5
        let amount = calculate_withdrawal_amount(
            1_000_000_000, // 1000 shares
            nav,
        ).unwrap();

        assert_eq!(amount, 1_500_000_000);
    }

    #[test]
    fn test_withdrawal_with_loss() {
        // At NAV 0.8, 1000 shares = 800 tokens
        let nav = NAV_DECIMALS * 8 / 10; // NAV = 0.8
        let amount = calculate_withdrawal_amount(
            1_000_000_000, // 1000 shares
            nav,
        ).unwrap();

        assert_eq!(amount, 800_000_000);
    }

    // ============ Fee Calculation Tests ============

    #[test]
    fn test_entry_fee_zero() {
        let fee = calculate_entry_fee(1_000_000_000, 0).unwrap();
        assert_eq!(fee, 0);
    }

    #[test]
    fn test_entry_fee_one_percent() {
        // 100 bps = 1%
        let fee = calculate_entry_fee(1_000_000_000, 100).unwrap();
        assert_eq!(fee, 10_000_000); // 1% of 1000
    }

    #[test]
    fn test_exit_fee() {
        // 50 bps = 0.5%
        let fee = calculate_exit_fee(1_000_000_000, 50).unwrap();
        assert_eq!(fee, 5_000_000); // 0.5% of 1000
    }

    #[test]
    fn test_performance_fee_no_profit() {
        // No profit = no fee
        let (fee, new_hwm) = calculate_performance_fee(
            NAV_DECIMALS,     // Current NAV = 1.0
            NAV_DECIMALS,     // HWM = 1.0
            1_000_000_000,    // Total value
            2000,             // 20% fee
        ).unwrap();

        assert_eq!(fee, 0);
        assert_eq!(new_hwm, NAV_DECIMALS);
    }

    #[test]
    fn test_performance_fee_with_profit() {
        // NAV increased from 1.0 to 1.1 = 10% profit
        // 20% of 10% profit on $1000 = $20
        let nav = NAV_DECIMALS + NAV_DECIMALS / 10; // NAV = 1.1
        let (fee, new_hwm) = calculate_performance_fee(
            nav,
            NAV_DECIMALS,     // HWM = 1.0
            1_000_000_000,    // Total value
            2000,             // 20% fee
        ).unwrap();

        // Fee = 20% of (1.1 - 1.0) * 1000 = 20% of 100 = 20
        assert_eq!(fee, 20_000_000);
        assert_eq!(new_hwm, nav);
    }

    #[test]
    fn test_management_fee_annual() {
        // 2% annual fee, 1 year elapsed
        // Arguments: total_value, fee_bps, last_collection_ts, current_ts
        let fee = calculate_management_fee(
            1_000_000_000,     // Total value
            200,               // 2% annual
            0,                 // Last collection at time 0
            365 * 24 * 60 * 60, // Current time: 1 year later
        ).unwrap();

        // Should be approximately 2% of 1000 = 20
        assert!(fee > 19_000_000 && fee < 21_000_000);
    }

    #[test]
    fn test_management_fee_one_day() {
        // 2% annual fee, 1 day elapsed
        // Arguments: total_value, fee_bps, last_collection_ts, current_ts
        let fee = calculate_management_fee(
            1_000_000_000,     // Total value
            200,               // 2% annual
            0,                 // Last collection at time 0
            24 * 60 * 60,      // Current time: 1 day later
        ).unwrap();

        // Should be ~2%/365 of 1000 = ~0.0548
        // In base units: ~54794
        assert!(fee < 100_000); // Much less than 1 token
    }

    // ============ DepositorState Tests ============

    #[test]
    fn test_depositor_can_withdraw_after_lock() {
        let mut depositor = DepositorState::default();
        depositor.first_deposit_ts = 1000;
        depositor.status = DepositorStatus::Active;

        // Lock period of 100 seconds, current time is 1200
        // should be withdrawable
        let can = depositor.can_withdraw_at(100, 1200);
        assert!(can);
    }

    #[test]
    fn test_depositor_cannot_withdraw_during_lock() {
        let mut depositor = DepositorState::default();
        depositor.first_deposit_ts = 1000;
        depositor.status = DepositorStatus::Active;

        // Lock period of 100 seconds, current time is 1050
        // should NOT be withdrawable
        let can = depositor.can_withdraw_at(100, 1050);
        assert!(!can);
    }

    // ============ Pool Status Tests ============

    #[test]
    fn test_pool_accepting_deposits_open() {
        let mut pool = StakingPoolState::default();
        pool.status = PoolStatus::Open;
        assert!(pool.is_accepting_deposits());
    }

    #[test]
    fn test_pool_accepting_deposits_active() {
        let mut pool = StakingPoolState::default();
        pool.status = PoolStatus::Active;
        assert!(pool.is_accepting_deposits());
    }

    #[test]
    fn test_pool_not_accepting_deposits_paused() {
        let mut pool = StakingPoolState::default();
        pool.status = PoolStatus::Paused;
        assert!(!pool.is_accepting_deposits());
    }

    #[test]
    fn test_pool_not_accepting_deposits_closed() {
        let mut pool = StakingPoolState::default();
        pool.status = PoolStatus::Closed;
        assert!(!pool.is_accepting_deposits());
    }

    #[test]
    fn test_pool_at_capacity() {
        let mut pool = StakingPoolState::default();
        pool.max_capacity = 1_000_000_000;
        pool.total_deposits = 1_000_000_000;
        assert!(pool.is_at_capacity());
    }

    #[test]
    fn test_pool_not_at_capacity() {
        let mut pool = StakingPoolState::default();
        pool.max_capacity = 1_000_000_000;
        pool.total_deposits = 500_000_000;
        assert!(!pool.is_at_capacity());
    }

    // ============ Pool Share Calculation Tests ============

    #[test]
    fn test_pool_calculate_shares_first_deposit() {
        let mut pool = StakingPoolState::default();
        pool.nav_per_share = NAV_DECIMALS;
        pool.total_shares = 0;
        pool.total_deposits = 0;

        let shares = pool.calculate_shares(1_000_000_000);
        assert_eq!(shares, 1_000_000_000);
    }

    #[test]
    fn test_pool_calculate_shares_subsequent() {
        let mut pool = StakingPoolState::default();
        pool.nav_per_share = 2 * NAV_DECIMALS; // NAV = 2.0
        pool.total_shares = 1_000_000_000;
        pool.total_deposits = 2_000_000_000;

        // Depositing 1000 at NAV 2.0 should give 500 shares
        let shares = pool.calculate_shares(1_000_000_000);
        assert_eq!(shares, 500_000_000);
    }

    #[test]
    fn test_pool_calculate_withdrawal() {
        let mut pool = StakingPoolState::default();
        pool.nav_per_share = NAV_DECIMALS + NAV_DECIMALS / 2; // NAV = 1.5

        // 1000 shares at NAV 1.5 = 1500 tokens
        let amount = pool.calculate_withdrawal(1_000_000_000);
        assert_eq!(amount, 1_500_000_000);
    }

    // ============ Pool Fee Accrual Tests ============

    #[test]
    fn test_pool_total_value_calculation() {
        let mut pool = StakingPoolState::default();
        pool.total_shares = 1_000_000_000; // 1000 shares
        pool.nav_per_share = NAV_DECIMALS; // NAV = 1.0

        // Total value = 1000 shares * 1.0 NAV = 1000 tokens
        let value = pool.calculate_total_value();
        assert_eq!(value, 1_000_000_000);
    }

    #[test]
    fn test_pool_total_value_with_profit() {
        let mut pool = StakingPoolState::default();
        pool.total_shares = 1_000_000_000; // 1000 shares
        pool.nav_per_share = NAV_DECIMALS + NAV_DECIMALS / 2; // NAV = 1.5

        // Total value = 1000 shares * 1.5 NAV = 1500 tokens
        let value = pool.calculate_total_value();
        assert_eq!(value, 1_500_000_000);
    }

    #[test]
    fn test_pool_total_accrued_fees() {
        let mut pool = StakingPoolState::default();
        pool.accrued_performance_fee = 100_000_000; // 100
        pool.accrued_management_fee = 20_000_000;   // 20

        assert_eq!(pool.total_accrued_fees(), 120_000_000);
    }

    #[test]
    fn test_pool_clear_accrued_fees() {
        let mut pool = StakingPoolState::default();
        pool.accrued_performance_fee = 100_000_000;
        pool.accrued_management_fee = 20_000_000;

        pool.clear_accrued_fees();

        assert_eq!(pool.accrued_performance_fee, 0);
        assert_eq!(pool.accrued_management_fee, 0);
    }

    // ============ Sanctum Yield Tests ============

    #[test]
    fn test_sanctum_yield_calculation() {
        use crate::instructions::sanctum::harvest::calculate_pending_yield;

        // 6% APY for 30 days on $1000
        let inf_balance = 1_000_000_000; // 1000 tokens
        let yield_rate_bps = 600; // 6%
        let seconds_elapsed = 30 * 24 * 60 * 60; // 30 days

        let yield_amount = calculate_pending_yield(inf_balance, yield_rate_bps, seconds_elapsed);

        // Expected: ~$4.93 (1000 * 0.06 * 30/365)
        // In base units: ~4930000
        assert!(yield_amount > 4_900_000 && yield_amount < 5_000_000);
    }

    #[test]
    fn test_sanctum_yield_annual() {
        use crate::instructions::sanctum::harvest::calculate_pending_yield;

        // 6% APY for 1 year on $1000
        let inf_balance = 1_000_000_000;
        let yield_rate_bps = 600;
        let seconds_elapsed = 365 * 24 * 60 * 60;

        let yield_amount = calculate_pending_yield(inf_balance, yield_rate_bps, seconds_elapsed);

        // Expected: $60 (1000 * 0.06)
        assert_eq!(yield_amount, 60_000_000);
    }

    #[test]
    fn test_sanctum_yield_zero_balance() {
        use crate::instructions::sanctum::harvest::calculate_pending_yield;

        let yield_amount = calculate_pending_yield(0, 600, 365 * 24 * 60 * 60);
        assert_eq!(yield_amount, 0);
    }

    // ============ veToken Tests ============

    #[test]
    fn test_ve_token_voting_power_full_lock() {
        use crate::state::ve_token::VeTokenState;

        // Max lock (4 years) should give full voting power
        let locked_amount = 1_000_000_000; // 1000 tokens
        let max_lock = VeTokenState::MAX_LOCK_DURATION;
        let current_time = 0;
        let lock_end = max_lock;

        let voting_power = VeTokenState::calculate_voting_power(
            locked_amount,
            lock_end,
            current_time,
        );

        // Full voting power = locked_amount
        assert_eq!(voting_power, locked_amount);
    }

    #[test]
    fn test_ve_token_voting_power_half_lock() {
        use crate::state::ve_token::VeTokenState;

        // 2 year lock should give half voting power
        let locked_amount = 1_000_000_000;
        let half_lock = VeTokenState::MAX_LOCK_DURATION / 2;
        let current_time = 0;
        let lock_end = half_lock;

        let voting_power = VeTokenState::calculate_voting_power(
            locked_amount,
            lock_end,
            current_time,
        );

        // Half voting power
        assert_eq!(voting_power, locked_amount / 2);
    }

    #[test]
    fn test_ve_token_voting_power_decay() {
        use crate::state::ve_token::VeTokenState;

        // Start with max lock, check after 1 year of decay
        let locked_amount = 1_000_000_000;
        let max_lock = VeTokenState::MAX_LOCK_DURATION;
        let one_year = 365 * 24 * 60 * 60;

        // At time 0, full voting power
        let power_start = VeTokenState::calculate_voting_power(
            locked_amount,
            max_lock,
            0,
        );

        // After 1 year, 3/4 voting power
        let power_1y = VeTokenState::calculate_voting_power(
            locked_amount,
            max_lock,
            one_year,
        );

        assert_eq!(power_start, locked_amount);
        // After 1 year (25% of 4 years), should have 75% voting power
        assert!(power_1y > locked_amount * 74 / 100);
        assert!(power_1y < locked_amount * 76 / 100);
    }

    #[test]
    fn test_ve_token_boost_multiplier() {
        use crate::state::ve_token::VeTokenState;

        // Min lock = 1x boost
        let min_boost = VeTokenState::calculate_boost_multiplier(
            VeTokenState::MIN_LOCK_DURATION
        );
        assert!(min_boost >= VeTokenState::BASE_BOOST);
        assert!(min_boost < VeTokenState::BASE_BOOST + 100);

        // Max lock = 2.5x boost
        let max_boost = VeTokenState::calculate_boost_multiplier(
            VeTokenState::MAX_LOCK_DURATION
        );
        assert_eq!(max_boost, VeTokenState::MAX_BOOST);
    }

    #[test]
    fn test_ve_token_fee_discount() {
        use crate::state::ve_token::VeTokenState;

        // Min lock = 0% discount
        let min_discount = VeTokenState::calculate_fee_discount(
            VeTokenState::MIN_LOCK_DURATION
        );
        assert!(min_discount < 100); // Very small discount

        // Max lock = 50% discount
        let max_discount = VeTokenState::calculate_fee_discount(
            VeTokenState::MAX_LOCK_DURATION
        );
        assert_eq!(max_discount, VeTokenState::MAX_FEE_DISCOUNT);
    }

    // ============ Merkle Tests ============

    #[test]
    fn test_merkle_compute_leaf() {
        use crate::state::merkle::merkle;

        let index: u64 = 0;
        let claimant = [1u8; 32];
        let amount: u64 = 1_000_000_000;

        let leaf = merkle::compute_leaf(index, &claimant, amount);

        // Leaf should be deterministic
        let leaf2 = merkle::compute_leaf(index, &claimant, amount);
        assert_eq!(leaf, leaf2);

        // Different inputs = different leaf
        let leaf3 = merkle::compute_leaf(1, &claimant, amount);
        assert_ne!(leaf, leaf3);
    }

    #[test]
    fn test_merkle_hash_pair_ordering() {
        use crate::state::merkle::merkle;

        let a = [1u8; 32];
        let b = [2u8; 32];

        // Hash should be same regardless of order (sorted internally)
        let hash1 = merkle::hash_pair(a, b);
        let hash2 = merkle::hash_pair(b, a);
        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_merkle_proof_verification_single() {
        use crate::state::merkle::merkle;

        // Create a simple 2-leaf tree
        let leaf1 = [1u8; 32];
        let leaf2 = [2u8; 32];
        let root = merkle::hash_pair(leaf1, leaf2);

        // Verify leaf1 with leaf2 as proof
        assert!(merkle::verify_proof(leaf1, &[leaf2], root));

        // Verify leaf2 with leaf1 as proof
        assert!(merkle::verify_proof(leaf2, &[leaf1], root));

        // Wrong proof should fail
        let wrong_proof = [3u8; 32];
        assert!(!merkle::verify_proof(leaf1, &[wrong_proof], root));
    }
}
