use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::errors::StakingPoolError;
use crate::events::DlmmPositionCreatedEvent;
use crate::state::{DlmmConfig, DlmmPositionState, StakingPoolState};

use super::{DLMM_CONFIG_SEED, DLMM_POSITION_SEED, DLMM_PROGRAM_ID};

/// Accounts for creating a new DLMM position
#[derive(Accounts)]
#[instruction(position_index: u8)]
pub struct CreateDlmmPosition<'info> {
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
        constraint = dlmm_config.can_create_position() @ StakingPoolError::DlmmMaxPositionsReached,
    )]
    pub dlmm_config: Account<'info, DlmmConfig>,

    /// The DLMM position state PDA (to be created)
    #[account(
        init,
        payer = forecaster,
        space = DlmmPositionState::LEN,
        seeds = [DLMM_POSITION_SEED, pool_state.key().as_ref(), &[position_index]],
        bump,
    )]
    pub position_state: Account<'info, DlmmPositionState>,

    // === DLMM Pool Accounts ===

    /// DLMM pool (e.g., SOL-USDC)
    /// CHECK: Validated by DLMM program during CPI
    #[account(mut)]
    pub dlmm_pool: AccountInfo<'info>,

    /// Position NFT mint (will be created by DLMM)
    /// CHECK: Created by DLMM program
    #[account(mut)]
    pub position_nft_mint: AccountInfo<'info>,

    /// Position NFT token account (owned by pool PDA)
    /// CHECK: Validated by DLMM program
    #[account(mut)]
    pub position_nft_account: AccountInfo<'info>,

    /// Token X mint (e.g., SOL)
    pub token_x_mint: Account<'info, Mint>,

    /// Token Y mint (e.g., USDC)
    pub token_y_mint: Account<'info, Mint>,

    /// Pool's token X account
    #[account(
        mut,
        constraint = pool_token_x.mint == token_x_mint.key() @ StakingPoolError::InvalidMint,
    )]
    pub pool_token_x: Account<'info, TokenAccount>,

    /// Pool's token Y account
    #[account(
        mut,
        constraint = pool_token_y.mint == token_y_mint.key() @ StakingPoolError::InvalidMint,
    )]
    pub pool_token_y: Account<'info, TokenAccount>,

    /// DLMM pool's token X vault
    #[account(mut)]
    pub dlmm_token_x_vault: Account<'info, TokenAccount>,

    /// DLMM pool's token Y vault
    #[account(mut)]
    pub dlmm_token_y_vault: Account<'info, TokenAccount>,

    /// DLMM bin arrays (for the position range)
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
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

/// Parameters for creating a DLMM position
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreatePositionParams {
    /// Lower bin ID of the position range
    pub lower_bin_id: i32,
    /// Upper bin ID of the position range
    pub upper_bin_id: i32,
    /// Initial amount of token X to deposit
    pub amount_x: u64,
    /// Initial amount of token Y to deposit
    pub amount_y: u64,
}

/// Create a new DLMM position
///
/// Creates a concentrated liquidity position on the DLMM pool.
///
/// # Arguments
/// * `position_index` - Index for this position (0-254)
/// * `params` - Position parameters (bin range, initial amounts)
pub fn handler(
    ctx: Context<CreateDlmmPosition>,
    position_index: u8,
    params: CreatePositionParams,
) -> Result<()> {
    let pool_state = &ctx.accounts.pool_state;
    let dlmm_config = &mut ctx.accounts.dlmm_config;
    let position_state = &mut ctx.accounts.position_state;

    // Validate bin range
    require!(
        params.upper_bin_id > params.lower_bin_id,
        StakingPoolError::DlmmInvalidBinRange
    );

    // Check allocation limits
    let current_total = dlmm_config.total_liquidity_value;
    let max_allocation = pool_state
        .total_deposits
        .checked_mul(dlmm_config.max_allocation_bps as u64)
        .unwrap_or(0)
        .checked_div(10_000)
        .unwrap_or(0);

    let new_deposit_value = params.amount_x.saturating_add(params.amount_y);
    require!(
        current_total.saturating_add(new_deposit_value) <= max_allocation,
        StakingPoolError::DlmmAllocationExceeded
    );

    // Get current active bin from DLMM pool
    // In production, this would be read from the pool account
    // For now, estimate as middle of the range
    let estimated_active_bin = (params.lower_bin_id + params.upper_bin_id) / 2;

    // Calculate entry price from active bin
    // DLMM uses bin pricing: price = (1 + binStep)^activeBinId
    // Simplified: use a placeholder price
    let entry_price = 1_000_000_000u64; // Placeholder 1:1 price

    // Build signer seeds for pool PDA
    let forecaster_key = pool_state.forecaster;
    let pool_bump = pool_state.bump;
    let seeds = &[
        b"staking_pool".as_ref(),
        forecaster_key.as_ref(),
        &[pool_bump],
    ];
    let _signer_seeds = &[&seeds[..]];

    // In production: Call DLMM's create_position instruction via CPI
    // The actual CPI would:
    // 1. Create the position NFT
    // 2. Add initial liquidity
    // 3. Return the position NFT mint

    // For simulation: Initialize position state
    position_state.initialize(
        ctx.bumps.position_state,
        pool_state.key(),
        ctx.accounts.dlmm_pool.key(),
        ctx.accounts.position_nft_mint.key(),
        ctx.accounts.token_x_mint.key(),
        ctx.accounts.token_y_mint.key(),
        params.lower_bin_id,
        params.upper_bin_id,
        estimated_active_bin,
        position_index,
        entry_price,
    )?;

    // Record initial liquidity
    if params.amount_x > 0 || params.amount_y > 0 {
        // Estimate liquidity shares (simplified)
        let shares = params.amount_x as u128 + params.amount_y as u128;
        position_state.add_liquidity(shares, params.amount_x, params.amount_y)?;
    }

    // Update DLMM config
    dlmm_config.add_position()?;
    let new_total_value = dlmm_config.total_liquidity_value.saturating_add(new_deposit_value);
    dlmm_config.update_liquidity_value(new_total_value)?;

    let clock = Clock::get()?;

    // Emit creation event
    emit!(DlmmPositionCreatedEvent {
        pool: pool_state.key(),
        dlmm_pool: ctx.accounts.dlmm_pool.key(),
        position_nft: ctx.accounts.position_nft_mint.key(),
        position_index,
        lower_bin_id: params.lower_bin_id,
        upper_bin_id: params.upper_bin_id,
        amount_x: params.amount_x,
        amount_y: params.amount_y,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Created DLMM position {} (bins {}-{}, {} X + {} Y)",
        position_index,
        params.lower_bin_id,
        params.upper_bin_id,
        params.amount_x,
        params.amount_y
    );

    Ok(())
}
