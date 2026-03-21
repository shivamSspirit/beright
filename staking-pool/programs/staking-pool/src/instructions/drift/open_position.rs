use anchor_lang::prelude::*;

use crate::errors::StakingPoolError;
use crate::events::DriftPositionOpenedEvent;
use crate::state::{
    DriftTradingState, PerpPositionRecord, PositionSide, StakingPoolState,
};

use super::{DRIFT_PROGRAM_ID, DRIFT_TRADING_STATE_SEED, PERP_POSITION_SEED};

/// Accounts for opening a Drift perp position
#[derive(Accounts)]
#[instruction(position_index: u8)]
pub struct OpenDriftPosition<'info> {
    /// Pool forecaster (must be pool owner)
    #[account(mut)]
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
        constraint = trading_state.is_active @ StakingPoolError::DriftNotActive,
        constraint = trading_state.can_open_position() @ StakingPoolError::DriftMaxPositionsReached,
    )]
    pub trading_state: Account<'info, DriftTradingState>,

    /// The perp position record PDA (to be created)
    #[account(
        init,
        payer = forecaster,
        space = PerpPositionRecord::LEN,
        seeds = [PERP_POSITION_SEED, pool_state.key().as_ref(), &[position_index]],
        bump,
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

    pub system_program: Program<'info, System>,
}

/// Parameters for opening a position
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct OpenPositionParams {
    /// Market index (e.g., 0 = SOL-PERP)
    pub market_index: u16,
    /// Position direction
    pub side: PositionSide,
    /// Position size in base units
    pub size: u64,
    /// Leverage to use
    pub leverage: u8,
    /// Prediction ID (hash of the prediction)
    pub prediction_id: [u8; 32],
    /// Prediction probability (scaled by 1000)
    pub prediction_probability: u16,
    /// Forecaster's Brier score (scaled by 1000)
    pub forecaster_brier: u16,
    /// Optional stop loss price
    pub stop_loss_price: Option<u64>,
    /// Optional take profit price
    pub take_profit_price: Option<u64>,
}

/// Open a new perp position based on a prediction
///
/// # Arguments
/// * `position_index` - Index for this position (0-254)
/// * `params` - Position parameters
pub fn handler(
    ctx: Context<OpenDriftPosition>,
    position_index: u8,
    params: OpenPositionParams,
) -> Result<()> {
    let pool_state = &ctx.accounts.pool_state;
    let trading_state = &mut ctx.accounts.trading_state;

    // Validate leverage
    require!(
        params.leverage <= trading_state.max_leverage,
        StakingPoolError::DriftLeverageExceeded
    );

    // Validate Brier score (forecaster must be well-calibrated)
    require!(
        params.forecaster_brier <= trading_state.min_brier_score_threshold,
        StakingPoolError::DriftPoorCalibration
    );

    // Calculate recommended position size based on forecaster metrics
    let recommended_size = trading_state.calculate_position_size(
        pool_state.total_deposits,
        params.forecaster_brier as u64,
        params.prediction_probability as u64,
    );

    // Validate size doesn't exceed recommendation
    require!(
        params.size <= recommended_size || recommended_size == 0,
        StakingPoolError::DriftPositionTooLarge
    );

    // Calculate liquidation price based on leverage
    // Simplified: liq_price = entry_price * (1 - 1/leverage) for longs
    //             liq_price = entry_price * (1 + 1/leverage) for shorts
    // This would be calculated from Drift oracle in production
    let entry_price = 100_000_000u64; // Placeholder - would come from oracle
    let liquidation_price = match params.side {
        PositionSide::Long => {
            entry_price
                .saturating_mul(params.leverage as u64 - 1)
                .saturating_div(params.leverage as u64)
        }
        PositionSide::Short => {
            entry_price
                .saturating_mul(params.leverage as u64 + 1)
                .saturating_div(params.leverage as u64)
        }
    };

    // Build signer seeds for pool PDA
    let forecaster_key = pool_state.forecaster;
    let pool_bump = pool_state.bump;
    let seeds = &[
        b"staking_pool".as_ref(),
        forecaster_key.as_ref(),
        &[pool_bump],
    ];
    let _signer_seeds = &[&seeds[..]];

    // In production: Call Drift's place_perp_order instruction via CPI
    // This would:
    // 1. Create the order on Drift
    // 2. Execute the fill
    // 3. Return fill price and size

    // Initialize position record
    let position_record = &mut ctx.accounts.position_record;
    position_record.initialize(
        ctx.bumps.position_record,
        trading_state.key(),
        pool_state.key(),
        params.market_index,
        params.side,
        entry_price,
        params.size,
        params.leverage,
        params.prediction_id,
        params.prediction_probability,
        params.forecaster_brier,
        liquidation_price,
        position_index,
    )?;

    // Set stop loss and take profit if provided
    if params.stop_loss_price.is_some() || params.take_profit_price.is_some() {
        position_record.set_orders(params.stop_loss_price, params.take_profit_price)?;
    }

    // Update trading state
    trading_state.open_position()?;

    let clock = Clock::get()?;

    // Emit event
    emit!(DriftPositionOpenedEvent {
        pool: pool_state.key(),
        market_index: params.market_index,
        side: params.side as u8,
        size: params.size,
        entry_price,
        leverage: params.leverage,
        prediction_id: params.prediction_id,
        prediction_probability: params.prediction_probability,
        liquidation_price,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Opened {} {} position on market {} (size: {}, leverage: {}x)",
        if params.side == PositionSide::Long { "LONG" } else { "SHORT" },
        params.size,
        params.market_index,
        params.size,
        params.leverage
    );

    Ok(())
}
