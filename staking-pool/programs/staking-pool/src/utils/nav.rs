use anchor_lang::prelude::*;
use crate::errors::StakingPoolError;

/// NAV scale factor (9 decimals of precision)
pub const NAV_DECIMALS: u64 = 1_000_000_000;

/// Default NAV for empty pool (1.0)
pub const DEFAULT_NAV: u64 = 1_000_000_000;

/// Calculate Net Asset Value per share
///
/// NAV = Total Pool Value / Total Shares
///
/// Where Total Pool Value = deposits + positions_value + sanctum_value - accrued_fees
pub fn calculate_nav(
    total_deposits: u64,
    positions_value: u64,
    sanctum_value: u64,
    accrued_fees: u64,
    total_shares: u64,
) -> Result<u64> {
    if total_shares == 0 {
        return Ok(DEFAULT_NAV);
    }

    let total_value = total_deposits
        .checked_add(positions_value)
        .ok_or(StakingPoolError::Overflow)?
        .checked_add(sanctum_value)
        .ok_or(StakingPoolError::Overflow)?
        .checked_sub(accrued_fees)
        .ok_or(StakingPoolError::Overflow)?;

    // NAV = total_value * NAV_DECIMALS / total_shares
    total_value
        .checked_mul(NAV_DECIMALS)
        .ok_or(StakingPoolError::Overflow)?
        .checked_div(total_shares)
        .ok_or(StakingPoolError::ZeroNav)
        .map_err(|e| e.into())
}

/// Calculate shares to mint for a deposit
///
/// For first deposit: shares = deposit_amount (1:1)
/// For subsequent: shares = deposit_amount * NAV_DECIMALS / nav_per_share
pub fn calculate_shares_for_deposit(
    deposit_amount: u64,
    current_nav: u64,
    total_shares: u64,
) -> Result<u64> {
    if total_shares == 0 {
        // First deposit: 1:1
        return Ok(deposit_amount);
    }

    require!(current_nav > 0, StakingPoolError::ZeroNav);

    // shares = deposit * NAV_DECIMALS / nav
    deposit_amount
        .checked_mul(NAV_DECIMALS)
        .ok_or(StakingPoolError::Overflow)?
        .checked_div(current_nav)
        .ok_or(StakingPoolError::ZeroNav)
        .map_err(|e| e.into())
}

/// Calculate withdrawal amount for shares
///
/// amount = shares * nav_per_share / NAV_DECIMALS
pub fn calculate_withdrawal_amount(
    shares: u64,
    current_nav: u64,
) -> Result<u64> {
    shares
        .checked_mul(current_nav)
        .ok_or(StakingPoolError::Overflow)?
        .checked_div(NAV_DECIMALS)
        .ok_or(StakingPoolError::ZeroNav)
        .map_err(|e| e.into())
}

/// Calculate performance fee based on high-water mark
///
/// Performance fee is only charged on profits above the HWM.
/// Returns (fee_amount, new_hwm)
pub fn calculate_performance_fee(
    current_nav: u64,
    high_water_mark: u64,
    total_value: u64,
    performance_fee_bps: u16,
) -> Result<(u64, u64)> {
    if current_nav <= high_water_mark {
        return Ok((0, high_water_mark));
    }

    // Profit ratio (scaled by NAV_DECIMALS)
    let profit_ratio = current_nav
        .checked_sub(high_water_mark)
        .ok_or(StakingPoolError::Overflow)?;

    // Total profit = total_value * profit_ratio / NAV_DECIMALS
    let total_profit = total_value
        .checked_mul(profit_ratio)
        .ok_or(StakingPoolError::Overflow)?
        .checked_div(NAV_DECIMALS)
        .ok_or(StakingPoolError::Overflow)?;

    // Fee = total_profit * fee_bps / 10000
    let fee = total_profit
        .checked_mul(performance_fee_bps as u64)
        .ok_or(StakingPoolError::Overflow)?
        .checked_div(10000)
        .ok_or(StakingPoolError::Overflow)?;

    Ok((fee, current_nav))
}

/// Calculate prorated management fee
///
/// Annual fee prorated to the second.
/// Returns fee amount.
pub fn calculate_management_fee(
    total_value: u64,
    management_fee_bps: u16,
    last_collection_ts: i64,
    current_ts: i64,
) -> Result<u64> {
    let seconds_elapsed = (current_ts - last_collection_ts).max(0) as u64;
    let seconds_per_year: u64 = 365 * 24 * 60 * 60;

    // fee = total_value * (fee_bps / 10000) * (seconds_elapsed / seconds_per_year)
    // Rearranged to avoid overflow: fee = total_value * fee_bps * seconds_elapsed / (10000 * seconds_per_year)
    total_value
        .checked_mul(management_fee_bps as u64)
        .ok_or(StakingPoolError::Overflow)?
        .checked_mul(seconds_elapsed)
        .ok_or(StakingPoolError::Overflow)?
        .checked_div(10000)
        .ok_or(StakingPoolError::Overflow)?
        .checked_div(seconds_per_year)
        .ok_or(StakingPoolError::Overflow)
        .map_err(|e| e.into())
}

/// Calculate entry fee
pub fn calculate_entry_fee(deposit_amount: u64, entry_fee_bps: u16) -> Result<u64> {
    deposit_amount
        .checked_mul(entry_fee_bps as u64)
        .ok_or(StakingPoolError::Overflow)?
        .checked_div(10000)
        .ok_or(StakingPoolError::Overflow)
        .map_err(|e| e.into())
}

/// Calculate exit fee
pub fn calculate_exit_fee(withdrawal_amount: u64, exit_fee_bps: u16) -> Result<u64> {
    withdrawal_amount
        .checked_mul(exit_fee_bps as u64)
        .ok_or(StakingPoolError::Overflow)?
        .checked_div(10000)
        .ok_or(StakingPoolError::Overflow)
        .map_err(|e| e.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_nav_empty_pool() {
        let nav = calculate_nav(0, 0, 0, 0, 0).unwrap();
        assert_eq!(nav, DEFAULT_NAV);
    }

    #[test]
    fn test_calculate_nav_with_deposits() {
        // 1K USDC (6 decimals), 1K shares -> NAV = 1.0
        let nav = calculate_nav(1_000_000_000, 0, 0, 0, 1_000_000_000).unwrap();
        assert_eq!(nav, NAV_DECIMALS);
    }

    #[test]
    fn test_calculate_nav_with_profit() {
        // 1K deposits + 100 profit = 1.1K value, 1K shares -> NAV = 1.1
        let nav = calculate_nav(
            1_000_000_000,  // 1000 USDC (6 decimals)
            100_000_000,    // 100 USDC profit
            0,
            0,
            1_000_000_000,  // 1000 shares
        ).unwrap();
        assert_eq!(nav, 1_100_000_000); // 1.1 * 1e9
    }

    #[test]
    fn test_performance_fee_below_hwm() {
        let (fee, new_hwm) = calculate_performance_fee(
            900_000_000,     // NAV 0.9
            1_000_000_000,   // HWM 1.0
            1_000_000_000,   // $1K value
            2000,            // 20%
        ).unwrap();
        assert_eq!(fee, 0);
        assert_eq!(new_hwm, 1_000_000_000);
    }

    #[test]
    fn test_performance_fee_above_hwm() {
        let (fee, new_hwm) = calculate_performance_fee(
            1_200_000_000,   // NAV 1.2
            1_000_000_000,   // HWM 1.0
            1_000_000_000,   // $1K value
            2000,            // 20%
        ).unwrap();
        // Profit = (1.2 - 1.0) * $1K = $200
        // Fee = $200 * 20% = $40
        assert_eq!(fee, 40_000_000);  // $40 in base units
        assert_eq!(new_hwm, 1_200_000_000);
    }

    #[test]
    fn test_management_fee_annual() {
        // 2% annual on $1K for 1 year
        let fee = calculate_management_fee(
            1_000_000_000,  // $1K
            200,            // 2%
            0,
            365 * 24 * 60 * 60,
        ).unwrap();
        assert_eq!(fee, 20_000_000); // $20 (2% of $1K)
    }

    #[test]
    fn test_management_fee_monthly() {
        // 2% annual on $1K for 30 days
        let fee = calculate_management_fee(
            1_000_000_000,  // $1K
            200,            // 2%
            0,
            30 * 24 * 60 * 60,
        ).unwrap();
        // ~$1.64 (30/365 * 2% * $1K)
        assert!(fee > 1_600_000 && fee < 1_700_000);
    }
}
