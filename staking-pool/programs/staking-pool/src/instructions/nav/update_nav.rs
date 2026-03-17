use anchor_lang::prelude::*;

use crate::errors::StakingPoolError;
use crate::events::NavUpdatedEvent;
use crate::state::StakingPoolState;

/// Accounts for updating NAV
#[derive(Accounts)]
pub struct UpdateNav<'info> {
    /// Forecaster (pool owner) updating NAV
    #[account(mut)]
    pub forecaster: Signer<'info>,

    /// Pool state
    #[account(
        mut,
        constraint = pool_state.forecaster == forecaster.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool_state: Account<'info, StakingPoolState>,
}

/// Update NAV handler
///
/// Called by the forecaster to update the pool's NAV based on trading P&L.
/// This affects the value of all depositor shares.
pub fn handler(ctx: Context<UpdateNav>, new_nav_per_share: u64) -> Result<()> {
    let pool_state = &mut ctx.accounts.pool_state;
    let clock = Clock::get()?;

    let old_nav = pool_state.nav_per_share;

    // Update NAV
    pool_state.update_nav(new_nav_per_share)?;

    // Emit event
    emit!(NavUpdatedEvent {
        pool: pool_state.key(),
        old_nav,
        new_nav: new_nav_per_share,
        total_value: pool_state.total_deposits,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "NAV updated: {} -> {} (change: {}%)",
        old_nav,
        new_nav_per_share,
        ((new_nav_per_share as i128 - old_nav as i128) * 100) / old_nav as i128
    );

    Ok(())
}
