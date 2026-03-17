use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

use crate::errors::StakingPoolError;
use crate::events::SanctumWithdrawEvent;
use crate::state::StakingPoolState;

/// Accounts for withdrawing from Sanctum INF
#[derive(Accounts)]
pub struct WithdrawFromSanctum<'info> {
    /// Forecaster (pool owner) initiating withdrawal
    #[account(mut)]
    pub forecaster: Signer<'info>,

    /// Pool state
    #[account(
        mut,
        constraint = pool_state.forecaster == forecaster.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool_state: Account<'info, StakingPoolState>,

    /// Pool vault to receive base tokens (USDC)
    #[account(
        mut,
        constraint = pool_vault.owner == pool_state.key() @ StakingPoolError::InvalidVault,
        constraint = pool_vault.mint == pool_state.base_token @ StakingPoolError::InvalidMint,
    )]
    pub pool_vault: Account<'info, TokenAccount>,

    /// Pool's INF token account
    #[account(mut)]
    pub pool_inf_account: Account<'info, TokenAccount>,

    /// Sanctum INF program (placeholder)
    /// CHECK: This is the Sanctum INF program
    pub sanctum_program: AccountInfo<'info>,

    /// Sanctum INF pool state
    /// CHECK: This is verified by Sanctum program
    pub sanctum_pool_state: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

/// Withdraw capital from Sanctum INF
///
/// Withdraws base tokens from Sanctum, including any accrued yield.
pub fn handler(ctx: Context<WithdrawFromSanctum>, inf_amount: u64) -> Result<()> {
    let pool_state = &mut ctx.accounts.pool_state;
    let clock = Clock::get()?;

    // Validate INF amount doesn't exceed balance
    require!(
        inf_amount <= pool_state.sanctum_inf_balance,
        StakingPoolError::InsufficientFunds
    );

    // Calculate yield earned
    // In production, this would come from Sanctum's exchange rate
    // For simulation: assume 6% APY, prorated
    let yield_rate_bps: u64 = 600; // 6% annual
    let seconds_since_deposit: u64 = 30 * 24 * 60 * 60; // Assume 30 days for simulation
    let seconds_per_year: u64 = 365 * 24 * 60 * 60;

    let yield_earned = inf_amount
        .checked_mul(yield_rate_bps)
        .unwrap()
        .checked_mul(seconds_since_deposit)
        .unwrap()
        .checked_div(10000)
        .unwrap()
        .checked_div(seconds_per_year)
        .unwrap();

    let amount_received = inf_amount.checked_add(yield_earned).unwrap();

    // Placeholder for Sanctum CPI - in production would call sanctum::withdraw
    // For now, we simulate by tracking internally

    // Update pool state
    pool_state.sanctum_inf_balance = pool_state.sanctum_inf_balance
        .checked_sub(inf_amount)
        .unwrap();
    pool_state.sanctum_yield_accrued = pool_state.sanctum_yield_accrued
        .checked_add(yield_earned)
        .unwrap();
    pool_state.available_liquidity = pool_state.available_liquidity
        .checked_add(amount_received)
        .unwrap();

    // Emit event
    emit!(SanctumWithdrawEvent {
        pool: pool_state.key(),
        inf_tokens_burned: inf_amount,
        amount_received,
        yield_earned,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Withdrew {} INF, received {} (including {} yield)",
        inf_amount,
        amount_received,
        yield_earned
    );

    Ok(())
}
