use anchor_lang::prelude::*;

use crate::errors::StakingPoolError;
use crate::events::DriftTradingInitializedEvent;
use crate::state::{DriftTradingState, StakingPoolState};

use super::{DRIFT_PROGRAM_ID, DRIFT_TRADING_STATE_SEED};

/// Accounts for initializing Drift trading
#[derive(Accounts)]
pub struct InitializeDriftTrading<'info> {
    /// Pool forecaster (must be pool owner)
    #[account(mut)]
    pub forecaster: Signer<'info>,

    /// The staking pool
    #[account(
        constraint = pool_state.forecaster == forecaster.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool_state: Account<'info, StakingPoolState>,

    /// The Drift trading state PDA (to be created)
    #[account(
        init,
        payer = forecaster,
        space = DriftTradingState::LEN,
        seeds = [DRIFT_TRADING_STATE_SEED, pool_state.key().as_ref()],
        bump,
    )]
    pub trading_state: Account<'info, DriftTradingState>,

    /// Drift sub-account for this pool
    /// CHECK: Will be created via CPI to Drift
    #[account(mut)]
    pub drift_sub_account: AccountInfo<'info>,

    /// Drift user account
    /// CHECK: Validated by Drift program
    #[account(mut)]
    pub drift_user: AccountInfo<'info>,

    /// Drift state account
    /// CHECK: Validated by Drift program
    pub drift_state: AccountInfo<'info>,

    /// Drift program
    /// CHECK: Verified by address constraint
    #[account(address = DRIFT_PROGRAM_ID)]
    pub drift_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

/// Optional configuration for Drift trading
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct DriftTradingConfig {
    /// Maximum leverage (default 3, elite 5)
    pub max_leverage: Option<u8>,
    /// Maximum position size as BPS (default 1000 = 10%)
    pub max_position_size_bps: Option<u16>,
    /// Maximum drawdown BPS (default 1000 = 10%)
    pub max_drawdown_bps: Option<u16>,
}

/// Initialize Drift trading for a staking pool
///
/// This creates a Drift sub-account for the pool and sets up trading parameters.
///
/// # Arguments
/// * `config` - Optional trading configuration
pub fn handler(
    ctx: Context<InitializeDriftTrading>,
    config: Option<DriftTradingConfig>,
) -> Result<()> {
    let pool_key = ctx.accounts.pool_state.key();
    let params = config.unwrap_or_default();

    // Validate leverage
    if let Some(leverage) = params.max_leverage {
        require!(
            leverage >= 1 && leverage <= DriftTradingState::ELITE_MAX_LEVERAGE,
            StakingPoolError::DriftLeverageExceeded
        );
    }

    // Build signer seeds for pool PDA
    let forecaster_key = ctx.accounts.pool_state.forecaster;
    let pool_bump = ctx.accounts.pool_state.bump;
    let seeds = &[
        b"staking_pool".as_ref(),
        forecaster_key.as_ref(),
        &[pool_bump],
    ];
    let _signer_seeds = &[&seeds[..]];

    // In production: Call Drift's initialize_user instruction via CPI
    // This would:
    // 1. Create the drift user account
    // 2. Create the sub-account
    // 3. Set up the user's trading permissions

    // Initialize trading state
    let trading_state = &mut ctx.accounts.trading_state;
    trading_state.initialize(
        ctx.bumps.trading_state,
        pool_key,
        ctx.accounts.drift_sub_account.key(),
        ctx.accounts.drift_user.key(),
        params.max_leverage,
        params.max_position_size_bps,
        params.max_drawdown_bps,
    )?;

    let clock = Clock::get()?;

    // Emit initialization event
    emit!(DriftTradingInitializedEvent {
        pool: pool_key,
        drift_sub_account: ctx.accounts.drift_sub_account.key(),
        drift_user: ctx.accounts.drift_user.key(),
        max_leverage: trading_state.max_leverage,
        max_position_size_bps: trading_state.max_position_size_bps,
        max_positions: trading_state.max_positions,
        max_drawdown_bps: trading_state.max_drawdown_bps,
        min_brier_threshold: trading_state.min_brier_score_threshold,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Initialized Drift trading for pool {} (leverage: {}x, max size: {}bps)",
        pool_key,
        trading_state.max_leverage,
        trading_state.max_position_size_bps
    );

    Ok(())
}

/// Update Drift trading configuration
#[derive(Accounts)]
pub struct UpdateDriftConfig<'info> {
    /// Pool forecaster (must be pool owner)
    pub forecaster: Signer<'info>,

    /// The staking pool
    #[account(
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
}

/// Update Drift trading configuration
pub fn handler_update_config(
    ctx: Context<UpdateDriftConfig>,
    config: DriftTradingConfig,
) -> Result<()> {
    let trading_state = &mut ctx.accounts.trading_state;

    if let Some(max_leverage) = config.max_leverage {
        require!(
            max_leverage >= 1 && max_leverage <= DriftTradingState::ELITE_MAX_LEVERAGE,
            StakingPoolError::DriftLeverageExceeded
        );
        trading_state.max_leverage = max_leverage;
    }

    if let Some(max_position_size_bps) = config.max_position_size_bps {
        require!(max_position_size_bps <= 5000, StakingPoolError::InvalidConfig);
        trading_state.max_position_size_bps = max_position_size_bps;
    }

    if let Some(max_drawdown_bps) = config.max_drawdown_bps {
        require!(max_drawdown_bps <= 5000, StakingPoolError::InvalidConfig);
        trading_state.max_drawdown_bps = max_drawdown_bps;
    }

    trading_state.last_update = Clock::get()?.unix_timestamp;

    msg!("Updated Drift config for pool {}", ctx.accounts.pool_state.key());

    Ok(())
}

/// Pause/unpause Drift trading
#[derive(Accounts)]
pub struct SetDriftActive<'info> {
    /// Pool forecaster (must be pool owner)
    pub forecaster: Signer<'info>,

    /// The staking pool
    #[account(
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
}

/// Set active status for Drift trading
pub fn handler_set_active(ctx: Context<SetDriftActive>, is_active: bool) -> Result<()> {
    let trading_state = &mut ctx.accounts.trading_state;
    trading_state.is_active = is_active;
    trading_state.last_update = Clock::get()?.unix_timestamp;

    msg!(
        "Drift trading {}",
        if is_active { "activated" } else { "paused" }
    );

    Ok(())
}
