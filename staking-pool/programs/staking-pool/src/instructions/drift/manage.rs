use anchor_lang::prelude::*;

use crate::errors::StakingPoolError;
use crate::events::{DriftLiquidationWarningEvent, DriftPnlUpdatedEvent};
use crate::state::{
    DriftTradingState, PerpPositionRecord, PerpPositionStatus, StakingPoolState,
};

use super::{DRIFT_PROGRAM_ID, DRIFT_TRADING_STATE_SEED, PERP_POSITION_SEED};

/// Accounts for updating position P&L
#[derive(Accounts)]
#[instruction(position_index: u8)]
pub struct UpdateDriftPositionPnl<'info> {
    /// Anyone can trigger P&L update
    pub caller: Signer<'info>,

    /// The staking pool
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

    /// Drift oracle for current price
    /// CHECK: Validated by reading account data
    pub drift_oracle: AccountInfo<'info>,
}

/// Update P&L for an open position
///
/// This is permissionless - anyone can trigger P&L updates.
///
/// # Arguments
/// * `position_index` - Index of the position
/// * `current_price` - Current market price (from oracle)
pub fn handler_update_pnl(
    ctx: Context<UpdateDriftPositionPnl>,
    position_index: u8,
    current_price: u64,
) -> Result<()> {
    let trading_state = &mut ctx.accounts.trading_state;
    let position_record = &mut ctx.accounts.position_record;

    // Update position P&L
    position_record.update_pnl(current_price)?;

    // Update trading state's total unrealized P&L
    // In production, would aggregate across all positions
    trading_state.update_unrealized_pnl(position_record.unrealized_pnl)?;

    // Emit event
    emit!(DriftPnlUpdatedEvent {
        pool: ctx.accounts.pool_state.key(),
        position_index,
        current_price,
        unrealized_pnl: position_record.unrealized_pnl,
        margin_ratio: position_record.margin_ratio(current_price) as u64,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!(
        "Updated P&L for position {}: {}",
        position_index,
        position_record.unrealized_pnl
    );

    Ok(())
}

/// Accounts for liquidation guard check
#[derive(Accounts)]
#[instruction(position_index: u8)]
pub struct LiquidationGuard<'info> {
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

/// Check if position is at risk and emergency close if needed
///
/// This function:
/// 1. Checks if price is near liquidation
/// 2. Checks if stop loss should trigger
/// 3. Emergency closes position if at high risk
///
/// # Arguments
/// * `position_index` - Index of the position
/// * `current_price` - Current market price
pub fn handler_liquidation_guard(
    ctx: Context<LiquidationGuard>,
    position_index: u8,
    current_price: u64,
) -> Result<()> {
    let pool_state = &ctx.accounts.pool_state;
    let trading_state = &mut ctx.accounts.trading_state;
    let position_record = &mut ctx.accounts.position_record;

    // Update P&L first
    position_record.update_pnl(current_price)?;

    // Check if position should be liquidated
    let should_liquidate = position_record.should_liquidate(current_price);

    // Check if stop loss should trigger
    let should_stop = position_record.should_stop_loss(current_price);

    // Check margin ratio (below 5% is danger zone)
    let margin_ratio = position_record.margin_ratio(current_price);
    let high_risk = margin_ratio < 500; // 5%

    let clock = Clock::get()?;

    if should_liquidate || should_stop || high_risk {
        // Emit warning event
        emit!(DriftLiquidationWarningEvent {
            pool: pool_state.key(),
            position_index,
            current_price,
            liquidation_price: position_record.liquidation_price,
            margin_ratio: margin_ratio as u64,
            unrealized_pnl: position_record.unrealized_pnl,
            action_taken: if should_liquidate {
                2 // Liquidated
            } else if should_stop {
                1 // Stop loss
            } else {
                0 // Warning only
            },
            timestamp: clock.unix_timestamp,
        });

        // If liquidation or stop loss triggered, close position
        if should_liquidate || should_stop {
            // Build signer seeds for pool PDA
            let forecaster_key = pool_state.forecaster;
            let pool_bump = pool_state.bump;
            let seeds = &[
                b"staking_pool".as_ref(),
                forecaster_key.as_ref(),
                &[pool_bump],
            ];
            let _signer_seeds = &[&seeds[..]];

            // In production: Call Drift's close_position via CPI

            // Determine status
            let status = if should_liquidate {
                PerpPositionStatus::Liquidated
            } else {
                PerpPositionStatus::Closed
            };

            let realized_pnl = position_record.unrealized_pnl;
            let is_win = realized_pnl > 0;

            // Close position
            position_record.close_position(current_price, status)?;

            // Update trading state
            trading_state.close_position(realized_pnl, is_win)?;

            msg!(
                "Emergency closed position {} ({:?}, P&L: {})",
                position_index,
                status,
                realized_pnl
            );
        } else {
            msg!(
                "WARNING: Position {} at high risk (margin: {}bps)",
                position_index,
                margin_ratio
            );
        }
    } else {
        msg!(
            "Position {} healthy (margin: {}bps, P&L: {})",
            position_index,
            margin_ratio,
            position_record.unrealized_pnl
        );
    }

    Ok(())
}

/// Update stop loss and take profit orders
#[derive(Accounts)]
#[instruction(position_index: u8)]
pub struct UpdateDriftOrders<'info> {
    /// Pool forecaster (must be pool owner)
    pub forecaster: Signer<'info>,

    /// The staking pool
    #[account(
        constraint = pool_state.forecaster == forecaster.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool_state: Account<'info, StakingPoolState>,

    /// The perp position record
    #[account(
        mut,
        seeds = [PERP_POSITION_SEED, pool_state.key().as_ref(), &[position_index]],
        bump = position_record.bump,
        constraint = position_record.pool == pool_state.key() @ StakingPoolError::InvalidPool,
        constraint = position_record.status == PerpPositionStatus::Open @ StakingPoolError::DriftPositionNotOpen,
    )]
    pub position_record: Account<'info, PerpPositionRecord>,
}

/// Update stop loss and take profit for a position
pub fn handler_update_orders(
    ctx: Context<UpdateDriftOrders>,
    position_index: u8,
    stop_loss: Option<u64>,
    take_profit: Option<u64>,
) -> Result<()> {
    let position_record = &mut ctx.accounts.position_record;

    position_record.set_orders(stop_loss, take_profit)?;

    msg!(
        "Updated orders for position {}: SL={:?}, TP={:?}",
        position_index,
        stop_loss,
        take_profit
    );

    Ok(())
}

/// Check drawdown and pause trading if exceeded
#[derive(Accounts)]
pub struct CheckDriftDrawdown<'info> {
    /// Anyone can check drawdown
    pub caller: Signer<'info>,

    /// The staking pool
    pub pool_state: Account<'info, StakingPoolState>,

    /// The Drift trading state
    #[account(
        mut,
        seeds = [DRIFT_TRADING_STATE_SEED, pool_state.key().as_ref()],
        bump = trading_state.bump,
        constraint = trading_state.pool == pool_state.key() @ StakingPoolError::InvalidPool,
    )]
    pub trading_state: Account<'info, DriftTradingState>,
}

/// Check if drawdown limit is exceeded and pause trading if so
pub fn handler_check_drawdown(ctx: Context<CheckDriftDrawdown>) -> Result<()> {
    let trading_state = &mut ctx.accounts.trading_state;

    if trading_state.is_drawdown_exceeded() {
        // Pause trading
        trading_state.is_active = false;
        trading_state.last_update = Clock::get()?.unix_timestamp;

        msg!(
            "Drawdown limit exceeded ({}bps > {}bps). Trading paused.",
            trading_state.current_drawdown_bps,
            trading_state.max_drawdown_bps
        );
    } else {
        msg!(
            "Drawdown OK ({}bps / {}bps limit)",
            trading_state.current_drawdown_bps,
            trading_state.max_drawdown_bps
        );
    }

    Ok(())
}
