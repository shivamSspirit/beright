use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::StakingPoolError;
use crate::events::SanctumDepositEvent;
use crate::state::StakingPoolState;

/// Accounts for depositing to Sanctum INF
#[derive(Accounts)]
pub struct DepositToSanctum<'info> {
    /// Forecaster (pool owner) initiating deposit
    #[account(mut)]
    pub forecaster: Signer<'info>,

    /// Pool state
    #[account(
        mut,
        constraint = pool_state.forecaster == forecaster.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool_state: Account<'info, StakingPoolState>,

    /// Pool vault holding base tokens (USDC)
    #[account(
        mut,
        constraint = pool_vault.owner == pool_state.key() @ StakingPoolError::InvalidVault,
        constraint = pool_vault.mint == pool_state.base_token @ StakingPoolError::InvalidMint,
    )]
    pub pool_vault: Account<'info, TokenAccount>,

    /// Pool's INF token account
    #[account(mut)]
    pub pool_inf_account: Account<'info, TokenAccount>,

    /// Sanctum INF program (placeholder - would be actual Sanctum program)
    /// CHECK: This is the Sanctum INF program
    pub sanctum_program: AccountInfo<'info>,

    /// Sanctum INF pool state
    /// CHECK: This is verified by Sanctum program
    pub sanctum_pool_state: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

/// Deposit idle capital to Sanctum INF
///
/// Deposits a portion of idle capital to earn yield from Sanctum.
/// The amount deposited is controlled by `idle_allocation_bps`.
pub fn handler(ctx: Context<DepositToSanctum>, amount: u64) -> Result<()> {
    let pool_state = &mut ctx.accounts.pool_state;
    let clock = Clock::get()?;

    // Validate amount doesn't exceed available liquidity
    require!(
        amount <= pool_state.available_liquidity,
        StakingPoolError::InsufficientIdleCapital
    );

    // Calculate maximum allowed Sanctum allocation
    let max_sanctum = pool_state.available_liquidity
        .checked_mul(pool_state.idle_allocation_bps as u64)
        .unwrap()
        .checked_div(10000)
        .unwrap();

    // Current Sanctum balance + deposit shouldn't exceed allocation
    let new_balance = pool_state.sanctum_inf_balance
        .checked_add(amount)
        .unwrap();

    require!(
        new_balance <= max_sanctum.checked_add(pool_state.sanctum_inf_balance).unwrap_or(u64::MAX),
        StakingPoolError::SanctumError
    );

    // Transfer base tokens from pool vault to Sanctum
    // Note: In production, this would be a CPI to Sanctum's deposit function
    let bump = pool_state.bump;
    let forecaster_key = pool_state.forecaster;
    let seeds = &[
        b"staking_pool".as_ref(),
        forecaster_key.as_ref(),
        &[bump],
    ];
    let _signer_seeds = &[&seeds[..]];

    // Placeholder for Sanctum CPI - in production would call sanctum::deposit
    // For now, we simulate by tracking internally

    // Update pool state
    pool_state.sanctum_inf_balance = new_balance;
    pool_state.available_liquidity = pool_state.available_liquidity
        .checked_sub(amount)
        .unwrap();

    // Emit event
    emit!(SanctumDepositEvent {
        pool: pool_state.key(),
        amount_deposited: amount,
        inf_tokens_received: amount, // 1:1 for simulation
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Deposited {} to Sanctum INF, new balance: {}",
        amount,
        pool_state.sanctum_inf_balance
    );

    Ok(())
}
