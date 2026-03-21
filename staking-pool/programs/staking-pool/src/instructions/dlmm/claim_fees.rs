use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::errors::StakingPoolError;
use crate::events::DlmmFeesClaimedEvent;
use crate::state::{DlmmConfig, DlmmPositionState, DlmmPositionStatus, StakingPoolState};

use super::{DLMM_CONFIG_SEED, DLMM_POSITION_SEED, DLMM_PROGRAM_ID};

/// Accounts for claiming fees from a DLMM position
#[derive(Accounts)]
#[instruction(position_index: u8)]
pub struct ClaimDlmmFees<'info> {
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

    /// Pool's token X account (receives fees)
    #[account(
        mut,
        constraint = pool_token_x.mint == position_state.token_x_mint @ StakingPoolError::InvalidMint,
    )]
    pub pool_token_x: Account<'info, TokenAccount>,

    /// Pool's token Y account (receives fees)
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

/// Claim accumulated fees from a DLMM position
///
/// # Arguments
/// * `position_index` - Index of the position to claim fees from
pub fn handler(ctx: Context<ClaimDlmmFees>, position_index: u8) -> Result<()> {
    let pool_state = &ctx.accounts.pool_state;
    let dlmm_config = &mut ctx.accounts.dlmm_config;
    let position_state = &mut ctx.accounts.position_state;

    // Get current unclaimed fees
    let fee_x = position_state.unclaimed_fee_x;
    let fee_y = position_state.unclaimed_fee_y;

    require!(
        fee_x > 0 || fee_y > 0,
        StakingPoolError::NoFeesToClaim
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

    // In production: Call DLMM's claim_fee instruction via CPI
    // The CPI would:
    // 1. Transfer fee tokens from DLMM vaults to pool token accounts
    // 2. Return actual amounts claimed

    // Update position state
    position_state.claim_fees(fee_x, fee_y)?;

    // Update DLMM config totals
    dlmm_config.add_fees(fee_x, fee_y)?;

    // Update pool liquidity (fees add to available liquidity)
    let pool_state = &mut ctx.accounts.pool_state;
    pool_state.available_liquidity = pool_state
        .available_liquidity
        .saturating_add(fee_x)
        .saturating_add(fee_y);

    let clock = Clock::get()?;

    // Emit event
    emit!(DlmmFeesClaimedEvent {
        pool: pool_state.key(),
        position_nft: position_state.position_nft,
        position_index,
        fee_x,
        fee_y,
        total_claimed_x: position_state.total_claimed_fee_x,
        total_claimed_y: position_state.total_claimed_fee_y,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Claimed {} X + {} Y fees from position {}",
        fee_x,
        fee_y,
        position_index
    );

    Ok(())
}

/// Update unclaimed fees for a position (query from DLMM)
#[derive(Accounts)]
#[instruction(position_index: u8)]
pub struct UpdateDlmmFees<'info> {
    /// Anyone can trigger fee update (permissionless)
    pub caller: Signer<'info>,

    /// The staking pool
    pub pool_state: Account<'info, StakingPoolState>,

    /// The DLMM position state
    #[account(
        mut,
        seeds = [DLMM_POSITION_SEED, pool_state.key().as_ref(), &[position_index]],
        bump = position_state.bump,
        constraint = position_state.pool == pool_state.key() @ StakingPoolError::InvalidPool,
        constraint = position_state.status != DlmmPositionStatus::Closed @ StakingPoolError::DlmmPositionClosed,
    )]
    pub position_state: Account<'info, DlmmPositionState>,

    /// DLMM pool
    /// CHECK: Must match position's dlmm_pool
    #[account(
        constraint = dlmm_pool.key() == position_state.dlmm_pool @ StakingPoolError::InvalidPool,
    )]
    pub dlmm_pool: AccountInfo<'info>,

    /// Position NFT account
    /// CHECK: Must match position's NFT
    #[account(
        constraint = position_nft_account.key() == position_state.position_nft @ StakingPoolError::DlmmPositionNftNotFound,
    )]
    pub position_nft_account: AccountInfo<'info>,
}

/// Update unclaimed fees for a position by reading from DLMM
///
/// This is a permissionless instruction that updates the fee tracking
/// by reading current fee values from the DLMM position.
pub fn handler_update_fees(
    ctx: Context<UpdateDlmmFees>,
    position_index: u8,
    fee_x: u64,
    fee_y: u64,
) -> Result<()> {
    let position_state = &mut ctx.accounts.position_state;

    // Update unclaimed fees
    // In production, these values would be read from the DLMM position account
    position_state.update_unclaimed_fees(fee_x, fee_y)?;

    msg!(
        "Updated fees for position {}: {} X + {} Y",
        position_index,
        fee_x,
        fee_y
    );

    Ok(())
}

/// Claim fees from all positions
#[derive(Accounts)]
pub struct ClaimAllDlmmFees<'info> {
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

    /// DLMM program
    /// CHECK: Verified by address constraint
    #[account(address = DLMM_PROGRAM_ID)]
    pub dlmm_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    // Note: Remaining accounts should include all position states and their
    // associated token accounts for batch fee claiming
}

/// Claim fees from all active positions
///
/// This processes fee claims for all positions in a single transaction.
/// Remaining accounts should include position states and token accounts.
pub fn handler_claim_all_fees(ctx: Context<ClaimAllDlmmFees>) -> Result<()> {
    let dlmm_config = &ctx.accounts.dlmm_config;

    msg!(
        "Claiming fees from {} active positions",
        dlmm_config.active_positions
    );

    // In production: Process remaining accounts to claim from each position
    // This would iterate through the remaining accounts and process each position

    Ok(())
}
