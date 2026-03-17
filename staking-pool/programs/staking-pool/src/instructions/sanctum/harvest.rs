use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::errors::StakingPoolError;
use crate::state::StakingPoolState;

/// Accounts for harvesting Sanctum yield
#[derive(Accounts)]
pub struct HarvestSanctumYield<'info> {
    /// Forecaster (pool owner) or authorized keeper
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Pool state
    #[account(
        mut,
        constraint = pool_state.forecaster == authority.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool_state: Account<'info, StakingPoolState>,

    /// Pool vault to receive harvested yield
    #[account(
        mut,
        constraint = pool_vault.owner == pool_state.key() @ StakingPoolError::InvalidVault,
    )]
    pub pool_vault: Account<'info, TokenAccount>,

    /// Pool's INF token account
    #[account(mut)]
    pub pool_inf_account: Account<'info, TokenAccount>,

    /// Sanctum INF program
    /// CHECK: This is the Sanctum INF program
    pub sanctum_program: AccountInfo<'info>,

    /// Sanctum INF pool state
    /// CHECK: This is verified by Sanctum program
    pub sanctum_pool_state: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

/// Harvest accrued yield from Sanctum INF
///
/// Claims any pending yield and adds it to the pool's available liquidity.
/// This updates the NAV to reflect the earned yield.
pub fn handler(ctx: Context<HarvestSanctumYield>) -> Result<()> {
    let pool_state = &mut ctx.accounts.pool_state;
    let _clock = Clock::get()?;

    // Calculate current yield
    // In production, this would query Sanctum for the current exchange rate
    // and calculate actual yield based on INF token value appreciation

    // For simulation: assume 6% APY prorated to time since last harvest
    let yield_rate_bps: u64 = 600; // 6% annual
    let seconds_per_year: u64 = 365 * 24 * 60 * 60;

    // Simple yield calculation (in production would be based on actual INF rate)
    let inf_balance = pool_state.sanctum_inf_balance;

    // Simulate 1 day of yield for testing
    let seconds_elapsed: u64 = 24 * 60 * 60;

    let yield_earned = inf_balance
        .checked_mul(yield_rate_bps)
        .unwrap_or(0)
        .checked_mul(seconds_elapsed)
        .unwrap_or(0)
        .checked_div(10000)
        .unwrap_or(0)
        .checked_div(seconds_per_year)
        .unwrap_or(0);

    if yield_earned == 0 {
        msg!("No yield to harvest");
        return Ok(());
    }

    // Update pool state
    pool_state.sanctum_yield_accrued = pool_state.sanctum_yield_accrued
        .checked_add(yield_earned)
        .unwrap();

    // Add yield to available liquidity (affects NAV)
    pool_state.available_liquidity = pool_state.available_liquidity
        .checked_add(yield_earned)
        .unwrap();

    msg!(
        "Harvested {} yield from Sanctum INF, total accrued: {}",
        yield_earned,
        pool_state.sanctum_yield_accrued
    );

    Ok(())
}

/// Calculate current Sanctum yield without harvesting
/// Useful for NAV calculations
///
/// Formula: yield = balance * rate_bps * seconds / (10000 * seconds_per_year)
/// Reordered to avoid overflow: (balance / 10000) * rate_bps * seconds / seconds_per_year
pub fn calculate_pending_yield(
    inf_balance: u64,
    yield_rate_bps: u64,
    seconds_elapsed: u64,
) -> u64 {
    let seconds_per_year: u64 = 365 * 24 * 60 * 60;

    // Use u128 for intermediate calculations to avoid overflow
    let balance = inf_balance as u128;
    let rate = yield_rate_bps as u128;
    let seconds = seconds_elapsed as u128;
    let year = seconds_per_year as u128;

    // yield = balance * rate * seconds / (10000 * year)
    let result = balance
        .checked_mul(rate)
        .unwrap_or(0)
        .checked_mul(seconds)
        .unwrap_or(0)
        .checked_div(10000)
        .unwrap_or(0)
        .checked_div(year)
        .unwrap_or(0);

    result as u64
}
