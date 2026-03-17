use anchor_lang::prelude::*;

use crate::errors::StakingPoolError;
use crate::state::slashing::{SlashingConfig, SlashingState};
use crate::state::StakingPoolState;

/// Accounts for initializing slashing state
#[derive(Accounts)]
pub struct InitializeSlashing<'info> {
    /// Pool owner initializing slashing config
    #[account(mut)]
    pub forecaster: Signer<'info>,

    /// Pool state
    #[account(
        constraint = pool_state.forecaster == forecaster.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool_state: Account<'info, StakingPoolState>,

    /// Slashing state PDA
    #[account(
        init,
        payer = forecaster,
        space = SlashingState::LEN,
        seeds = [b"slashing_state", pool_state.key().as_ref()],
        bump,
    )]
    pub slashing_state: Account<'info, SlashingState>,

    pub system_program: Program<'info, System>,
}

/// Initialize slashing state for a pool
///
/// Sets up calibration monitoring with configurable thresholds.
pub fn handler(
    ctx: Context<InitializeSlashing>,
    config: Option<SlashingConfig>,
) -> Result<()> {
    let slashing_state = &mut ctx.accounts.slashing_state;

    slashing_state.initialize(
        ctx.bumps.slashing_state,
        ctx.accounts.pool_state.key(),
        config,
    )?;

    msg!(
        "Initialized slashing for pool with threshold: {}, consecutive failures: {}",
        slashing_state.brier_threshold,
        slashing_state.consecutive_failures_required
    );

    Ok(())
}
