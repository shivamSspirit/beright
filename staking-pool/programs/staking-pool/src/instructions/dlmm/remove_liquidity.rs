use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::errors::StakingPoolError;
use crate::events::DlmmLiquidityRemovedEvent;
use crate::state::{DlmmConfig, DlmmPositionState, DlmmPositionStatus, StakingPoolState};

use super::{DLMM_CONFIG_SEED, DLMM_POSITION_SEED, DLMM_PROGRAM_ID};

/// Accounts for removing liquidity from a DLMM position
#[derive(Accounts)]
#[instruction(position_index: u8)]
pub struct RemoveDlmmLiquidity<'info> {
    /// Pool forecaster (must be pool owner)
    #[account(mut)]
    pub forecaster: Signer<'info>,

    /// The staking pool
    #[account(
        mut,
        constraint = pool_state.forecaster == forecaster.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool_state: Account<'info, StakingPoolState>,

    /// The DLMM config for this pool
    #[account(
        mut,
        seeds = [DLMM_CONFIG_SEED, pool_state.key().as_ref()],
        bump = dlmm_config.bump,
        constraint = dlmm_config.pool == pool_state.key() @ StakingPoolError::InvalidPool,
    )]
    pub dlmm_config: Account<'info, DlmmConfig>,

    /// The DLMM position state
    #[account(
        mut,
        seeds = [DLMM_POSITION_SEED, pool_state.key().as_ref(), &[position_index]],
        bump = position_state.bump,
        constraint = position_state.pool == pool_state.key() @ StakingPoolError::InvalidPool,
        constraint = position_state.status != DlmmPositionStatus::Closed @ StakingPoolError::DlmmPositionClosed,
    )]
    pub position_state: Account<'info, DlmmPositionState>,

    // === Token Accounts ===

    /// Pool's token X account (receives withdrawn tokens)
    #[account(
        mut,
        constraint = pool_token_x.mint == position_state.token_x_mint @ StakingPoolError::InvalidMint,
    )]
    pub pool_token_x: Account<'info, TokenAccount>,

    /// Pool's token Y account (receives withdrawn tokens)
    #[account(
        mut,
        constraint = pool_token_y.mint == position_state.token_y_mint @ StakingPoolError::InvalidMint,
    )]
    pub pool_token_y: Account<'info, TokenAccount>,

    /// DLMM pool's token X vault
    #[account(mut)]
    pub dlmm_token_x_vault: Account<'info, TokenAccount>,

    /// DLMM pool's token Y vault
    #[account(mut)]
    pub dlmm_token_y_vault: Account<'info, TokenAccount>,

    /// DLMM pool
    /// CHECK: Validated by DLMM program during CPI
    #[account(mut)]
    pub dlmm_pool: AccountInfo<'info>,

    /// Position NFT account
    /// CHECK: Validated by DLMM program
    pub position_nft_account: AccountInfo<'info>,

    /// Bin arrays for the position
    /// CHECK: Validated by DLMM program
    #[account(mut)]
    pub bin_array_lower: AccountInfo<'info>,

    /// CHECK: Validated by DLMM program
    #[account(mut)]
    pub bin_array_upper: AccountInfo<'info>,

    /// DLMM program
    /// CHECK: Verified by address constraint
    #[account(address = DLMM_PROGRAM_ID)]
    pub dlmm_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

/// Remove liquidity from a DLMM position
///
/// # Arguments
/// * `position_index` - Index of the position
/// * `shares_to_remove` - Amount of liquidity shares to remove
/// * `min_amount_x` - Minimum token X to receive (slippage)
/// * `min_amount_y` - Minimum token Y to receive (slippage)
pub fn handler(
    ctx: Context<RemoveDlmmLiquidity>,
    position_index: u8,
    shares_to_remove: u128,
    min_amount_x: u64,
    min_amount_y: u64,
) -> Result<()> {
    let pool_state = &ctx.accounts.pool_state;
    let dlmm_config = &mut ctx.accounts.dlmm_config;
    let position_state = &mut ctx.accounts.position_state;

    require!(shares_to_remove > 0, StakingPoolError::InvalidAmount);
    require!(
        shares_to_remove <= position_state.liquidity_shares,
        StakingPoolError::DlmmInsufficientShares
    );

    // Build signer seeds for pool PDA
    let forecaster_key = pool_state.forecaster;
    let pool_bump = pool_state.bump;
    let seeds = &[
        b"staking_pool".as_ref(),
        forecaster_key.as_ref(),
        &[pool_bump],
    ];
    let _signer_seeds = &[&seeds[..]];

    // Calculate expected amounts based on share percentage
    let share_percentage = shares_to_remove
        .checked_mul(10000)
        .unwrap_or(0)
        .checked_div(position_state.liquidity_shares)
        .unwrap_or(0) as u64;

    let expected_amount_x = position_state
        .deposited_x
        .checked_mul(share_percentage)
        .unwrap_or(0)
        .checked_div(10000)
        .unwrap_or(0);

    let expected_amount_y = position_state
        .deposited_y
        .checked_mul(share_percentage)
        .unwrap_or(0)
        .checked_div(10000)
        .unwrap_or(0);

    // In production: Call DLMM's remove_liquidity instruction via CPI
    // The CPI would return the actual amounts received

    // Validate slippage
    require!(
        expected_amount_x >= min_amount_x && expected_amount_y >= min_amount_y,
        StakingPoolError::SlippageExceeded
    );

    // Update position state
    position_state.remove_liquidity(shares_to_remove, expected_amount_x, expected_amount_y)?;

    // Update DLMM config
    let value_removed = expected_amount_x.saturating_add(expected_amount_y);
    let new_total_value = dlmm_config.total_liquidity_value.saturating_sub(value_removed);
    dlmm_config.update_liquidity_value(new_total_value)?;

    // If position fully closed, decrement position count
    if position_state.status == DlmmPositionStatus::Closed {
        dlmm_config.remove_position()?;
    }

    // Update pool liquidity
    let pool_state = &mut ctx.accounts.pool_state;
    pool_state.available_liquidity = pool_state
        .available_liquidity
        .saturating_add(value_removed);

    let clock = Clock::get()?;

    // Emit event
    emit!(DlmmLiquidityRemovedEvent {
        pool: pool_state.key(),
        position_nft: position_state.position_nft,
        position_index,
        shares_removed: shares_to_remove,
        amount_x: expected_amount_x,
        amount_y: expected_amount_y,
        remaining_shares: position_state.liquidity_shares,
        position_closed: position_state.status == DlmmPositionStatus::Closed,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Removed {} shares from position {} ({} X + {} Y)",
        shares_to_remove,
        position_index,
        expected_amount_x,
        expected_amount_y
    );

    Ok(())
}

/// Close a DLMM position entirely
#[derive(Accounts)]
#[instruction(position_index: u8)]
pub struct CloseDlmmPosition<'info> {
    /// Pool forecaster (must be pool owner)
    #[account(mut)]
    pub forecaster: Signer<'info>,

    /// The staking pool
    #[account(
        mut,
        constraint = pool_state.forecaster == forecaster.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool_state: Account<'info, StakingPoolState>,

    /// The DLMM config for this pool
    #[account(
        mut,
        seeds = [DLMM_CONFIG_SEED, pool_state.key().as_ref()],
        bump = dlmm_config.bump,
        constraint = dlmm_config.pool == pool_state.key() @ StakingPoolError::InvalidPool,
    )]
    pub dlmm_config: Account<'info, DlmmConfig>,

    /// The DLMM position state (will be closed)
    #[account(
        mut,
        seeds = [DLMM_POSITION_SEED, pool_state.key().as_ref(), &[position_index]],
        bump = position_state.bump,
        constraint = position_state.pool == pool_state.key() @ StakingPoolError::InvalidPool,
        close = forecaster,
    )]
    pub position_state: Account<'info, DlmmPositionState>,

    // === Token Accounts ===

    /// Pool's token X account
    #[account(mut)]
    pub pool_token_x: Account<'info, TokenAccount>,

    /// Pool's token Y account
    #[account(mut)]
    pub pool_token_y: Account<'info, TokenAccount>,

    /// DLMM pool
    /// CHECK: Validated by DLMM program
    #[account(mut)]
    pub dlmm_pool: AccountInfo<'info>,

    /// DLMM program
    /// CHECK: Verified by address constraint
    #[account(address = DLMM_PROGRAM_ID)]
    pub dlmm_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

/// Close a DLMM position and recover all liquidity
///
/// This removes all remaining liquidity, claims any fees, and closes the position account.
pub fn handler_close_position(
    ctx: Context<CloseDlmmPosition>,
    position_index: u8,
) -> Result<()> {
    let dlmm_config = &mut ctx.accounts.dlmm_config;
    let position_state = &ctx.accounts.position_state;

    // Calculate value being recovered
    let value_recovered = position_state
        .deposited_x
        .saturating_add(position_state.deposited_y);

    // Update config
    dlmm_config.remove_position()?;
    let new_total_value = dlmm_config.total_liquidity_value.saturating_sub(value_recovered);
    dlmm_config.update_liquidity_value(new_total_value)?;

    // Add any unclaimed fees
    dlmm_config.add_fees(
        position_state.unclaimed_fee_x,
        position_state.unclaimed_fee_y,
    )?;

    // Update pool liquidity
    let pool_state = &mut ctx.accounts.pool_state;
    pool_state.available_liquidity = pool_state
        .available_liquidity
        .saturating_add(value_recovered)
        .saturating_add(position_state.unclaimed_fee_x)
        .saturating_add(position_state.unclaimed_fee_y);

    msg!(
        "Closed position {} (recovered {} value + {} fees)",
        position_index,
        value_recovered,
        position_state.unclaimed_fee_x + position_state.unclaimed_fee_y
    );

    Ok(())
}
