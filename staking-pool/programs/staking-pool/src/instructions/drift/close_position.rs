use anchor_lang::prelude::*;

use crate::errors::StakingPoolError;
use crate::events::DriftPositionClosedEvent;
use crate::state::{
    DriftTradingState, PerpPositionRecord, PerpPositionStatus, StakingPoolState,
};

use super::{DRIFT_PROGRAM_ID, DRIFT_TRADING_STATE_SEED, PERP_POSITION_SEED};

/// Accounts for closing a Drift perp position
#[derive(Accounts)]
#[instruction(position_index: u8)]
pub struct CloseDriftPosition<'info> {
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

    /// The perp position record
    #[account(
        mut,
        seeds = [PERP_POSITION_SEED, pool_state.key().as_ref(), &[position_index]],
        bump = position_record.bump,
        constraint = position_record.pool == pool_state.key() @ StakingPoolError::InvalidPool,
        constraint = position_record.status == PerpPositionStatus::Open @ StakingPoolError::DriftPositionNotOpen,
    )]
    pub position_record: Account<'info, PerpPositionRecord>,

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

    /// Drift perp market
    /// CHECK: Validated by Drift program
    #[account(mut)]
    pub drift_perp_market: AccountInfo<'info>,

    /// Drift oracle
    /// CHECK: Validated by Drift program
    pub drift_oracle: AccountInfo<'info>,

    /// Drift program
    /// CHECK: Verified by address constraint
    #[account(address = DRIFT_PROGRAM_ID)]
    pub drift_program: AccountInfo<'info>,
}

/// Close an open perp position
///
/// # Arguments
/// * `position_index` - Index of the position to close
pub fn handler(ctx: Context<CloseDriftPosition>, position_index: u8) -> Result<()> {
    let pool_state = &ctx.accounts.pool_state;
    let trading_state = &mut ctx.accounts.trading_state;
    let position_record = &mut ctx.accounts.position_record;

    // Build signer seeds for pool PDA
    let forecaster_key = pool_state.forecaster;
    let pool_bump = pool_state.bump;
    let seeds = &[
        b"staking_pool".as_ref(),
        forecaster_key.as_ref(),
        &[pool_bump],
    ];
    let _signer_seeds = &[&seeds[..]];

    // In production: Call Drift's place_perp_order (reduce-only) via CPI
    // This would:
    // 1. Close the position on Drift
    // 2. Return the exit price and realized P&L

    // Get current price from oracle (placeholder)
    let exit_price = position_record.entry_price; // In production: read from oracle

    // Update position P&L
    position_record.update_pnl(exit_price)?;
    let realized_pnl = position_record.unrealized_pnl;
    let is_win = realized_pnl > 0;

    // Close the position
    position_record.close_position(exit_price, PerpPositionStatus::Closed)?;

    // Update trading state
    trading_state.close_position(realized_pnl, is_win)?;

    // If profitable, add PnL back to pool
    if realized_pnl > 0 {
        let pool_state = &mut ctx.accounts.pool_state;
        pool_state.available_liquidity = pool_state
            .available_liquidity
            .saturating_add(realized_pnl as u64);
    }

    let clock = Clock::get()?;

    // Emit event
    emit!(DriftPositionClosedEvent {
        pool: ctx.accounts.pool_state.key(),
        market_index: position_record.market_index,
        exit_price,
        realized_pnl,
        position_index,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Closed position {} (exit: {}, P&L: {})",
        position_index,
        exit_price,
        realized_pnl
    );

    Ok(())
}

/// Close position account after it's been closed
#[derive(Accounts)]
#[instruction(position_index: u8)]
pub struct CleanupDriftPosition<'info> {
    /// Pool forecaster (must be pool owner)
    #[account(mut)]
    pub forecaster: Signer<'info>,

    /// The staking pool
    #[account(
        constraint = pool_state.forecaster == forecaster.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool_state: Account<'info, StakingPoolState>,

    /// The perp position record (to be closed)
    #[account(
        mut,
        seeds = [PERP_POSITION_SEED, pool_state.key().as_ref(), &[position_index]],
        bump = position_record.bump,
        constraint = position_record.pool == pool_state.key() @ StakingPoolError::InvalidPool,
        constraint = position_record.status != PerpPositionStatus::Open @ StakingPoolError::DriftPositionStillOpen,
        close = forecaster,
    )]
    pub position_record: Account<'info, PerpPositionRecord>,
}

/// Cleanup a closed position account to recover rent
pub fn handler_cleanup(
    ctx: Context<CleanupDriftPosition>,
    position_index: u8,
) -> Result<()> {
    msg!("Cleaned up position {} account", position_index);
    Ok(())
}
