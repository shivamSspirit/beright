use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::errors::StakingPoolError;
use crate::events::DlmmLiquidityAddedEvent;
use crate::state::{DlmmConfig, DlmmPositionState, DlmmPositionStatus, StakingPoolState};

use super::{DLMM_CONFIG_SEED, DLMM_POSITION_SEED, DLMM_PROGRAM_ID};

/// Accounts for adding liquidity to a DLMM position
#[derive(Accounts)]
#[instruction(position_index: u8)]
pub struct AddDlmmLiquidity<'info> {
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
        constraint = dlmm_config.is_active @ StakingPoolError::DlmmNotActive,
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

    /// Pool's token X account
    #[account(
        mut,
        constraint = pool_token_x.mint == position_state.token_x_mint @ StakingPoolError::InvalidMint,
    )]
    pub pool_token_x: Account<'info, TokenAccount>,

    /// Pool's token Y account
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

/// Add liquidity to an existing DLMM position
///
/// # Arguments
/// * `position_index` - Index of the position to add to
/// * `amount_x` - Amount of token X to add
/// * `amount_y` - Amount of token Y to add
/// * `min_shares` - Minimum liquidity shares to receive
pub fn handler(
    ctx: Context<AddDlmmLiquidity>,
    position_index: u8,
    amount_x: u64,
    amount_y: u64,
    min_shares: u128,
) -> Result<()> {
    let pool_state = &ctx.accounts.pool_state;
    let dlmm_config = &mut ctx.accounts.dlmm_config;
    let position_state = &mut ctx.accounts.position_state;

    require!(
        amount_x > 0 || amount_y > 0,
        StakingPoolError::InvalidAmount
    );

    // Check allocation limits
    let new_deposit_value = amount_x.saturating_add(amount_y);
    let max_allocation = pool_state
        .total_deposits
        .checked_mul(dlmm_config.max_allocation_bps as u64)
        .unwrap_or(0)
        .checked_div(10_000)
        .unwrap_or(0);

    require!(
        dlmm_config
            .total_liquidity_value
            .saturating_add(new_deposit_value)
            <= max_allocation,
        StakingPoolError::DlmmAllocationExceeded
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

    // In production: Call DLMM's add_liquidity instruction via CPI
    // The CPI would return the actual shares received

    // For simulation: Estimate shares
    let shares_received = amount_x as u128 + amount_y as u128;
    require!(
        shares_received >= min_shares,
        StakingPoolError::SlippageExceeded
    );

    // Update position state
    position_state.add_liquidity(shares_received, amount_x, amount_y)?;

    // Update DLMM config
    let new_total_value = dlmm_config.total_liquidity_value.saturating_add(new_deposit_value);
    dlmm_config.update_liquidity_value(new_total_value)?;

    let clock = Clock::get()?;

    // Emit event
    emit!(DlmmLiquidityAddedEvent {
        pool: pool_state.key(),
        position_nft: position_state.position_nft,
        position_index,
        amount_x,
        amount_y,
        shares_received,
        new_total_shares: position_state.liquidity_shares,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Added {} X + {} Y to position {} (shares: {})",
        amount_x,
        amount_y,
        position_index,
        shares_received
    );

    Ok(())
}
