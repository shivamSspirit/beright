use anchor_lang::prelude::*;

use crate::errors::StakingPoolError;
use crate::events::DlmmConfigInitializedEvent;
use crate::state::{DlmmConfig, StakingPoolState};

use super::DLMM_CONFIG_SEED;

/// Accounts for initializing DLMM configuration
#[derive(Accounts)]
pub struct InitializeDlmmConfig<'info> {
    /// Pool forecaster (must be pool owner)
    #[account(mut)]
    pub forecaster: Signer<'info>,

    /// The staking pool
    #[account(
        constraint = pool_state.forecaster == forecaster.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool_state: Account<'info, StakingPoolState>,

    /// The DLMM config PDA (to be created)
    #[account(
        init,
        payer = forecaster,
        space = DlmmConfig::LEN,
        seeds = [DLMM_CONFIG_SEED, pool_state.key().as_ref()],
        bump,
    )]
    pub dlmm_config: Account<'info, DlmmConfig>,

    pub system_program: Program<'info, System>,
}

/// Optional configuration parameters for DLMM initialization
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct DlmmConfigParams {
    /// Maximum number of DLMM positions allowed
    pub max_positions: Option<u8>,
    /// Maximum allocation to DLMM as basis points (0-10000)
    pub max_allocation_bps: Option<u16>,
    /// Threshold to trigger rebalance (in basis points)
    pub rebalance_threshold_bps: Option<u16>,
}

/// Initialize DLMM configuration for a staking pool
///
/// Sets up the pool to create concentrated liquidity positions on DLMM.
///
/// # Arguments
/// * `config` - Optional configuration parameters
pub fn handler(ctx: Context<InitializeDlmmConfig>, config: Option<DlmmConfigParams>) -> Result<()> {
    let pool_key = ctx.accounts.pool_state.key();
    let params = config.unwrap_or_default();

    // Validate parameters
    if let Some(max_alloc) = params.max_allocation_bps {
        require!(max_alloc <= 10000, StakingPoolError::InvalidAllocation);
    }

    let dlmm_config = &mut ctx.accounts.dlmm_config;
    dlmm_config.initialize(
        ctx.bumps.dlmm_config,
        pool_key,
        params.max_positions,
        params.max_allocation_bps,
        params.rebalance_threshold_bps,
    )?;

    let clock = Clock::get()?;

    // Emit initialization event
    emit!(DlmmConfigInitializedEvent {
        pool: pool_key,
        max_positions: dlmm_config.max_positions,
        max_allocation_bps: dlmm_config.max_allocation_bps,
        rebalance_threshold_bps: dlmm_config.rebalance_threshold_bps,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Initialized DLMM config for pool {} (max positions: {}, max alloc: {}%)",
        pool_key,
        dlmm_config.max_positions,
        dlmm_config.max_allocation_bps as f64 / 100.0
    );

    Ok(())
}

/// Update DLMM configuration
#[derive(Accounts)]
pub struct UpdateDlmmConfig<'info> {
    /// Pool forecaster (must be pool owner)
    #[account(mut)]
    pub forecaster: Signer<'info>,

    /// The staking pool
    #[account(
        constraint = pool_state.forecaster == forecaster.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool_state: Account<'info, StakingPoolState>,

    /// The DLMM config PDA
    #[account(
        mut,
        seeds = [DLMM_CONFIG_SEED, pool_state.key().as_ref()],
        bump = dlmm_config.bump,
        constraint = dlmm_config.pool == pool_state.key() @ StakingPoolError::InvalidPool,
    )]
    pub dlmm_config: Account<'info, DlmmConfig>,
}

/// Update DLMM configuration parameters
pub fn handler_update_config(
    ctx: Context<UpdateDlmmConfig>,
    config: DlmmConfigParams,
) -> Result<()> {
    let dlmm_config = &mut ctx.accounts.dlmm_config;

    if let Some(max_positions) = config.max_positions {
        require!(
            max_positions >= dlmm_config.active_positions,
            StakingPoolError::InvalidConfig
        );
        dlmm_config.max_positions = max_positions;
    }

    if let Some(max_allocation_bps) = config.max_allocation_bps {
        require!(max_allocation_bps <= 10000, StakingPoolError::InvalidAllocation);
        dlmm_config.max_allocation_bps = max_allocation_bps;
    }

    if let Some(rebalance_threshold_bps) = config.rebalance_threshold_bps {
        dlmm_config.rebalance_threshold_bps = rebalance_threshold_bps;
    }

    dlmm_config.last_update = Clock::get()?.unix_timestamp;

    msg!("Updated DLMM config for pool {}", ctx.accounts.pool_state.key());

    Ok(())
}

/// Pause/unpause DLMM integration
#[derive(Accounts)]
pub struct SetDlmmActive<'info> {
    /// Pool forecaster (must be pool owner)
    pub forecaster: Signer<'info>,

    /// The staking pool
    #[account(
        constraint = pool_state.forecaster == forecaster.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool_state: Account<'info, StakingPoolState>,

    /// The DLMM config PDA
    #[account(
        mut,
        seeds = [DLMM_CONFIG_SEED, pool_state.key().as_ref()],
        bump = dlmm_config.bump,
        constraint = dlmm_config.pool == pool_state.key() @ StakingPoolError::InvalidPool,
    )]
    pub dlmm_config: Account<'info, DlmmConfig>,
}

/// Set active status for DLMM integration
pub fn handler_set_active(ctx: Context<SetDlmmActive>, is_active: bool) -> Result<()> {
    let dlmm_config = &mut ctx.accounts.dlmm_config;
    dlmm_config.is_active = is_active;
    dlmm_config.last_update = Clock::get()?.unix_timestamp;

    msg!(
        "DLMM integration {}",
        if is_active { "activated" } else { "paused" }
    );

    Ok(())
}
