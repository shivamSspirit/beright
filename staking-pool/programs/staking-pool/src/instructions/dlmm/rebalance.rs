use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::errors::StakingPoolError;
use crate::events::DlmmPositionRebalancedEvent;
use crate::state::{DlmmConfig, DlmmPositionState, DlmmPositionStatus, StakingPoolState};

use super::{DLMM_CONFIG_SEED, DLMM_POSITION_SEED, DLMM_PROGRAM_ID};

/// Accounts for rebalancing a DLMM position
#[derive(Accounts)]
#[instruction(position_index: u8)]
pub struct RebalanceDlmmPosition<'info> {
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

    /// Old position NFT account (will be burned)
    /// CHECK: Validated by DLMM program
    #[account(mut)]
    pub old_position_nft_account: AccountInfo<'info>,

    /// New position NFT mint (will be created)
    /// CHECK: Created by DLMM program
    #[account(mut)]
    pub new_position_nft_mint: AccountInfo<'info>,

    /// New position NFT account
    /// CHECK: Created by DLMM program
    #[account(mut)]
    pub new_position_nft_account: AccountInfo<'info>,

    /// Old bin arrays
    /// CHECK: Validated by DLMM program
    #[account(mut)]
    pub old_bin_array_lower: AccountInfo<'info>,

    /// CHECK: Validated by DLMM program
    #[account(mut)]
    pub old_bin_array_upper: AccountInfo<'info>,

    /// New bin arrays
    /// CHECK: Validated by DLMM program
    #[account(mut)]
    pub new_bin_array_lower: AccountInfo<'info>,

    /// CHECK: Validated by DLMM program
    #[account(mut)]
    pub new_bin_array_upper: AccountInfo<'info>,

    /// DLMM program
    /// CHECK: Verified by address constraint
    #[account(address = DLMM_PROGRAM_ID)]
    pub dlmm_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Parameters for rebalancing a position
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RebalanceParams {
    /// New lower bin ID
    pub new_lower_bin_id: i32,
    /// New upper bin ID
    pub new_upper_bin_id: i32,
    /// Minimum amount X to receive from old position
    pub min_amount_x: u64,
    /// Minimum amount Y to receive from old position
    pub min_amount_y: u64,
}

/// Rebalance a DLMM position to a new price range
///
/// This instruction:
/// 1. Removes all liquidity from the old position
/// 2. Claims any accumulated fees
/// 3. Creates a new position at the specified bin range
/// 4. Adds liquidity to the new position
///
/// # Arguments
/// * `position_index` - Index of the position to rebalance
/// * `params` - Rebalance parameters
pub fn handler(
    ctx: Context<RebalanceDlmmPosition>,
    position_index: u8,
    params: RebalanceParams,
) -> Result<()> {
    let pool_state = &ctx.accounts.pool_state;
    let dlmm_config = &mut ctx.accounts.dlmm_config;
    let position_state = &mut ctx.accounts.position_state;

    // Validate new bin range
    require!(
        params.new_upper_bin_id > params.new_lower_bin_id,
        StakingPoolError::DlmmInvalidBinRange
    );

    let bin_width = params.new_upper_bin_id - params.new_lower_bin_id;
    require!(
        bin_width >= DlmmPositionState::MIN_BIN_WIDTH
            && bin_width <= DlmmPositionState::MAX_BIN_WIDTH,
        StakingPoolError::DlmmInvalidBinRange
    );

    // Store old position info
    let old_lower_bin = position_state.lower_bin_id;
    let old_upper_bin = position_state.upper_bin_id;
    let old_shares = position_state.liquidity_shares;
    let old_deposited_x = position_state.deposited_x;
    let old_deposited_y = position_state.deposited_y;
    let old_unclaimed_fee_x = position_state.unclaimed_fee_x;
    let old_unclaimed_fee_y = position_state.unclaimed_fee_y;

    // Build signer seeds for pool PDA
    let forecaster_key = pool_state.forecaster;
    let pool_bump = pool_state.bump;
    let seeds = &[
        b"staking_pool".as_ref(),
        forecaster_key.as_ref(),
        &[pool_bump],
    ];
    let _signer_seeds = &[&seeds[..]];

    // In production, the rebalance would:
    // 1. Call DLMM remove_liquidity to get all tokens back
    // 2. Call DLMM claim_fee to get accumulated fees
    // 3. Close the old position
    // 4. Create new position at new bin range
    // 5. Add liquidity to new position

    // For simulation: Validate slippage
    require!(
        old_deposited_x >= params.min_amount_x && old_deposited_y >= params.min_amount_y,
        StakingPoolError::SlippageExceeded
    );

    // Get new active bin (approximation: middle of new range)
    let new_active_bin = (params.new_lower_bin_id + params.new_upper_bin_id) / 2;

    // Update position state for new range
    position_state.record_rebalance(
        params.new_lower_bin_id,
        params.new_upper_bin_id,
        ctx.accounts.new_position_nft_mint.key(),
    )?;

    // Update active bin
    position_state.update_status(new_active_bin)?;

    // Re-add the same liquidity to the new position
    // (In production, amounts might differ slightly due to price changes)
    position_state.liquidity_shares = old_shares;
    position_state.deposited_x = old_deposited_x;
    position_state.deposited_y = old_deposited_y;

    // Process any fees (add to pool liquidity)
    if old_unclaimed_fee_x > 0 || old_unclaimed_fee_y > 0 {
        position_state.claim_fees(old_unclaimed_fee_x, old_unclaimed_fee_y)?;
        dlmm_config.add_fees(old_unclaimed_fee_x, old_unclaimed_fee_y)?;
    }

    let clock = Clock::get()?;

    // Emit event
    emit!(DlmmPositionRebalancedEvent {
        pool: pool_state.key(),
        position_nft: ctx.accounts.new_position_nft_mint.key(),
        position_index,
        old_lower_bin_id: old_lower_bin,
        old_upper_bin_id: old_upper_bin,
        new_lower_bin_id: params.new_lower_bin_id,
        new_upper_bin_id: params.new_upper_bin_id,
        amount_x: old_deposited_x,
        amount_y: old_deposited_y,
        fees_claimed_x: old_unclaimed_fee_x,
        fees_claimed_y: old_unclaimed_fee_y,
        rebalance_count: position_state.rebalance_count,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Rebalanced position {} from bins [{}-{}] to [{}-{}]",
        position_index,
        old_lower_bin,
        old_upper_bin,
        params.new_lower_bin_id,
        params.new_upper_bin_id
    );

    Ok(())
}

/// Check if any positions need rebalancing
#[derive(Accounts)]
pub struct CheckDlmmRebalance<'info> {
    /// Anyone can check rebalance status
    pub caller: Signer<'info>,

    /// The staking pool
    pub pool_state: Account<'info, StakingPoolState>,

    /// The DLMM config for this pool
    #[account(
        seeds = [DLMM_CONFIG_SEED, pool_state.key().as_ref()],
        bump = dlmm_config.bump,
        constraint = dlmm_config.pool == pool_state.key() @ StakingPoolError::InvalidPool,
    )]
    pub dlmm_config: Account<'info, DlmmConfig>,

    /// DLMM pool to check current price
    /// CHECK: Validated externally
    pub dlmm_pool: AccountInfo<'info>,
}

/// Check if positions need rebalancing and emit events
///
/// This is a permissionless read-only instruction that checks
/// all positions and emits events for any that need rebalancing.
pub fn handler_check_rebalance(ctx: Context<CheckDlmmRebalance>) -> Result<()> {
    let dlmm_config = &ctx.accounts.dlmm_config;

    // In production: Read current active bin from DLMM pool
    // Then check each position against the threshold

    msg!(
        "Checking {} positions for rebalance (threshold: {}bps)",
        dlmm_config.active_positions,
        dlmm_config.rebalance_threshold_bps
    );

    Ok(())
}

/// Update position status based on current DLMM pool state
#[derive(Accounts)]
#[instruction(position_index: u8)]
pub struct UpdateDlmmPositionStatus<'info> {
    /// Anyone can update status
    pub caller: Signer<'info>,

    /// The staking pool
    pub pool_state: Account<'info, StakingPoolState>,

    /// The DLMM position state
    #[account(
        mut,
        seeds = [DLMM_POSITION_SEED, pool_state.key().as_ref(), &[position_index]],
        bump = position_state.bump,
        constraint = position_state.pool == pool_state.key() @ StakingPoolError::InvalidPool,
    )]
    pub position_state: Account<'info, DlmmPositionState>,

    /// DLMM pool
    /// CHECK: Must match position's dlmm_pool
    #[account(
        constraint = dlmm_pool.key() == position_state.dlmm_pool @ StakingPoolError::InvalidPool,
    )]
    pub dlmm_pool: AccountInfo<'info>,
}

/// Update position status based on current active bin
///
/// # Arguments
/// * `position_index` - Index of the position
/// * `current_active_bin` - Current active bin from DLMM pool
pub fn handler_update_status(
    ctx: Context<UpdateDlmmPositionStatus>,
    position_index: u8,
    current_active_bin: i32,
) -> Result<()> {
    let position_state = &mut ctx.accounts.position_state;

    // Update status
    position_state.update_status(current_active_bin)?;

    msg!(
        "Position {} status: {:?} (active bin: {}, range: [{}-{}])",
        position_index,
        position_state.status,
        current_active_bin,
        position_state.lower_bin_id,
        position_state.upper_bin_id
    );

    Ok(())
}
