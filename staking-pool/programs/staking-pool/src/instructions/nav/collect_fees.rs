use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::StakingPoolError;
use crate::events::FeesCollectedEvent;
use crate::state::StakingPoolState;

/// Accounts for collecting fees
#[derive(Accounts)]
pub struct CollectFees<'info> {
    /// Forecaster (pool owner) collecting fees
    #[account(mut)]
    pub forecaster: Signer<'info>,

    /// Pool state
    #[account(
        mut,
        constraint = pool_state.forecaster == forecaster.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool_state: Account<'info, StakingPoolState>,

    /// Pool vault holding base tokens
    #[account(
        mut,
        constraint = pool_vault.owner == pool_state.key() @ StakingPoolError::InvalidVault,
        constraint = pool_vault.mint == pool_state.base_token @ StakingPoolError::InvalidMint,
    )]
    pub pool_vault: Account<'info, TokenAccount>,

    /// Forecaster's token account to receive fees
    #[account(
        mut,
        constraint = forecaster_token_account.owner == forecaster.key() @ StakingPoolError::InvalidOwner,
        constraint = forecaster_token_account.mint == pool_state.base_token @ StakingPoolError::InvalidMint,
    )]
    pub forecaster_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// Collect accrued fees handler
///
/// Accrues any pending fees, then transfers them to the forecaster.
/// Must be called by the pool's forecaster/owner.
pub fn handler(ctx: Context<CollectFees>) -> Result<()> {
    let pool_state = &mut ctx.accounts.pool_state;
    let clock = Clock::get()?;

    // Accrue pending fees
    let _perf_fee = pool_state.accrue_performance_fee()?;
    let _mgmt_fee = pool_state.accrue_management_fee()?;

    let total_fees = pool_state.total_accrued_fees();

    // Skip if no fees to collect
    if total_fees == 0 {
        msg!("No fees to collect");
        return Ok(());
    }

    // Check vault has sufficient funds
    require!(
        ctx.accounts.pool_vault.amount >= total_fees,
        StakingPoolError::InsufficientFunds
    );

    // Get the performance and management fees before clearing
    let performance_fee = pool_state.accrued_performance_fee;
    let management_fee = pool_state.accrued_management_fee;

    // Transfer fees to forecaster
    let pool_key = pool_state.key();
    let bump = pool_state.bump;
    let seeds = &[
        b"staking_pool".as_ref(),
        pool_state.forecaster.as_ref(),
        &[bump],
    ];
    let signer_seeds = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.pool_vault.to_account_info(),
                to: ctx.accounts.forecaster_token_account.to_account_info(),
                authority: pool_state.to_account_info(),
            },
            signer_seeds,
        ),
        total_fees,
    )?;

    // Update available liquidity
    pool_state.available_liquidity = pool_state.available_liquidity
        .checked_sub(total_fees)
        .unwrap_or(0);

    // Clear accrued fees
    pool_state.clear_accrued_fees();

    // Emit event
    emit!(FeesCollectedEvent {
        pool: pool_key,
        forecaster: ctx.accounts.forecaster.key(),
        performance_fee,
        management_fee,
        total_collected: total_fees,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Fees collected: performance={}, management={}, total={}",
        performance_fee,
        management_fee,
        total_fees
    );

    Ok(())
}

/// Accounts for accruing fees without collecting
#[derive(Accounts)]
pub struct AccrueFees<'info> {
    /// Forecaster (pool owner) or authorized keeper
    pub authority: Signer<'info>,

    /// Pool state
    #[account(
        mut,
        constraint = pool_state.forecaster == authority.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool_state: Account<'info, StakingPoolState>,
}

/// Accrue fees without collecting
///
/// Useful for updating fee state without transferring tokens.
pub fn accrue_handler(ctx: Context<AccrueFees>) -> Result<()> {
    let pool_state = &mut ctx.accounts.pool_state;

    let perf_fee = pool_state.accrue_performance_fee()?;
    let mgmt_fee = pool_state.accrue_management_fee()?;

    msg!(
        "Fees accrued: performance={}, management={}",
        perf_fee,
        mgmt_fee
    );

    Ok(())
}
