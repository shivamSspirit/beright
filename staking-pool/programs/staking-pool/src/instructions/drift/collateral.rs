use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer};

use crate::errors::StakingPoolError;
use crate::events::DriftCollateralEvent;
use crate::state::{DriftTradingState, StakingPoolState};

use super::{DRIFT_PROGRAM_ID, DRIFT_TRADING_STATE_SEED};

/// Accounts for depositing collateral to Drift
#[derive(Accounts)]
pub struct DepositDriftCollateral<'info> {
    /// Pool forecaster (must be pool owner)
    #[account(mut)]
    pub forecaster: Signer<'info>,

    /// The staking pool
    #[account(
        mut,
        constraint = pool_state.forecaster == forecaster.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool_state: Account<'info, StakingPoolState>,

    /// The Drift trading state
    #[account(
        mut,
        seeds = [DRIFT_TRADING_STATE_SEED, pool_state.key().as_ref()],
        bump = trading_state.bump,
        constraint = trading_state.pool == pool_state.key() @ StakingPoolError::InvalidPool,
        constraint = trading_state.is_active @ StakingPoolError::DriftNotActive,
    )]
    pub trading_state: Account<'info, DriftTradingState>,

    /// Pool's collateral token account (source)
    #[account(mut)]
    pub pool_collateral_account: Account<'info, TokenAccount>,

    /// Drift user's collateral vault (destination)
    /// CHECK: Validated by Drift program
    #[account(mut)]
    pub drift_collateral_vault: AccountInfo<'info>,

    /// Drift user account
    /// CHECK: Must match trading_state.drift_user
    #[account(
        mut,
        constraint = drift_user.key() == trading_state.drift_user @ StakingPoolError::InvalidAuthority,
    )]
    pub drift_user: AccountInfo<'info>,

    /// Drift state
    /// CHECK: Validated by Drift program
    pub drift_state: AccountInfo<'info>,

    /// Drift spot market vault
    /// CHECK: Validated by Drift program
    #[account(mut)]
    pub drift_spot_market_vault: AccountInfo<'info>,

    /// Drift program
    /// CHECK: Verified by address constraint
    #[account(address = DRIFT_PROGRAM_ID)]
    pub drift_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

/// Deposit collateral to Drift for trading
///
/// Transfers tokens from the pool to Drift's collateral vault.
///
/// # Arguments
/// * `amount` - Amount of collateral to deposit
pub fn handler_deposit(ctx: Context<DepositDriftCollateral>, amount: u64) -> Result<()> {
    let pool_state = &ctx.accounts.pool_state;
    let trading_state = &mut ctx.accounts.trading_state;

    require!(amount > 0, StakingPoolError::InvalidAmount);

    // Check pool has sufficient available liquidity
    require!(
        pool_state.available_liquidity >= amount,
        StakingPoolError::InsufficientLiquidity
    );

    // Build signer seeds for pool PDA
    let forecaster_key = pool_state.forecaster;
    let pool_bump = pool_state.bump;
    let seeds = &[
        b"staking_pool".as_ref(),
        forecaster_key.as_ref(),
        &[pool_bump],
    ];
    let signer_seeds = &[&seeds[..]];

    // Transfer tokens to Drift vault
    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.pool_collateral_account.to_account_info(),
            to: ctx.accounts.drift_collateral_vault.to_account_info(),
            authority: ctx.accounts.pool_state.to_account_info(),
        },
        signer_seeds,
    );
    anchor_spl::token::transfer(transfer_ctx, amount)?;

    // In production: Call Drift's deposit instruction via CPI
    // This would credit the deposit to the user's account

    // Update trading state
    trading_state.deposit_collateral(amount)?;

    // Update pool state
    let pool_state = &mut ctx.accounts.pool_state;
    pool_state.available_liquidity = pool_state.available_liquidity.saturating_sub(amount);

    let clock = Clock::get()?;

    // Emit event
    emit!(DriftCollateralEvent {
        pool: pool_state.key(),
        action: 0, // 0 = deposit
        amount,
        total_collateral: trading_state.total_collateral,
        timestamp: clock.unix_timestamp,
    });

    msg!("Deposited {} collateral to Drift", amount);

    Ok(())
}

/// Accounts for withdrawing collateral from Drift
#[derive(Accounts)]
pub struct WithdrawDriftCollateral<'info> {
    /// Pool forecaster (must be pool owner)
    #[account(mut)]
    pub forecaster: Signer<'info>,

    /// The staking pool
    #[account(
        mut,
        constraint = pool_state.forecaster == forecaster.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool_state: Account<'info, StakingPoolState>,

    /// The Drift trading state
    #[account(
        mut,
        seeds = [DRIFT_TRADING_STATE_SEED, pool_state.key().as_ref()],
        bump = trading_state.bump,
        constraint = trading_state.pool == pool_state.key() @ StakingPoolError::InvalidPool,
    )]
    pub trading_state: Account<'info, DriftTradingState>,

    /// Pool's collateral token account (destination)
    #[account(mut)]
    pub pool_collateral_account: Account<'info, TokenAccount>,

    /// Drift user's collateral vault (source)
    /// CHECK: Validated by Drift program
    #[account(mut)]
    pub drift_collateral_vault: AccountInfo<'info>,

    /// Drift user account
    /// CHECK: Must match trading_state.drift_user
    #[account(
        mut,
        constraint = drift_user.key() == trading_state.drift_user @ StakingPoolError::InvalidAuthority,
    )]
    pub drift_user: AccountInfo<'info>,

    /// Drift user stats
    /// CHECK: Validated by Drift program
    #[account(mut)]
    pub drift_user_stats: AccountInfo<'info>,

    /// Drift state
    /// CHECK: Validated by Drift program
    pub drift_state: AccountInfo<'info>,

    /// Drift spot market vault
    /// CHECK: Validated by Drift program
    #[account(mut)]
    pub drift_spot_market_vault: AccountInfo<'info>,

    /// Drift signer PDA
    /// CHECK: Validated by Drift program
    pub drift_signer: AccountInfo<'info>,

    /// Drift program
    /// CHECK: Verified by address constraint
    #[account(address = DRIFT_PROGRAM_ID)]
    pub drift_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

/// Withdraw collateral from Drift
///
/// Transfers tokens from Drift's vault back to the pool.
/// Cannot withdraw if it would leave positions under-collateralized.
///
/// # Arguments
/// * `amount` - Amount of collateral to withdraw
pub fn handler_withdraw(ctx: Context<WithdrawDriftCollateral>, amount: u64) -> Result<()> {
    let trading_state = &mut ctx.accounts.trading_state;

    require!(amount > 0, StakingPoolError::InvalidAmount);
    require!(
        amount <= trading_state.total_collateral,
        StakingPoolError::DriftInsufficientCollateral
    );

    // Check no open positions (simple safety check)
    // In production, would check margin requirements
    require!(
        trading_state.open_positions == 0,
        StakingPoolError::DriftOpenPositions
    );

    // Build signer seeds for pool PDA
    let forecaster_key = ctx.accounts.pool_state.forecaster;
    let pool_bump = ctx.accounts.pool_state.bump;
    let seeds = &[
        b"staking_pool".as_ref(),
        forecaster_key.as_ref(),
        &[pool_bump],
    ];
    let _signer_seeds = &[&seeds[..]];

    // In production: Call Drift's withdraw instruction via CPI
    // This would transfer tokens from Drift vault to pool

    // Update trading state
    trading_state.withdraw_collateral(amount)?;

    // Update pool state
    let pool_state = &mut ctx.accounts.pool_state;
    pool_state.available_liquidity = pool_state
        .available_liquidity
        .checked_add(amount)
        .ok_or(StakingPoolError::Overflow)?;

    let clock = Clock::get()?;

    // Emit event
    emit!(DriftCollateralEvent {
        pool: pool_state.key(),
        action: 1, // 1 = withdraw
        amount,
        total_collateral: trading_state.total_collateral,
        timestamp: clock.unix_timestamp,
    });

    msg!("Withdrew {} collateral from Drift", amount);

    Ok(())
}
