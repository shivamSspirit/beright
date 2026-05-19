use anchor_lang::prelude::*;
use crate::state::{ForecasterState, PredictionRecord, ScoreConfig};
use crate::events::{PredictionResolved, CalibrationUpdated};
use crate::errors::CalibrationError;

/// Resolve a prediction with the actual outcome
#[derive(Accounts)]
pub struct ResolvePrediction<'info> {
    /// Program scoring authority. Forecasters must not resolve records they are scored on.
    #[account(mut)]
    pub resolver: Signer<'info>,

    /// Global scoring config that defines the trusted resolver authority.
    #[account(
        seeds = [b"score_config"],
        bump = score_config.bump,
        constraint = !score_config.paused @ CalibrationError::ScoreSyncPaused,
        constraint = score_config.authority == resolver.key() @ CalibrationError::Unauthorized
    )]
    pub score_config: Account<'info, ScoreConfig>,

    /// Prediction record account (PDA)
    #[account(
        mut,
        constraint = prediction_record.outcome.is_none() @ CalibrationError::AlreadyResolved
    )]
    pub prediction_record: Account<'info, PredictionRecord>,

    /// Forecaster state account (PDA)
    #[account(
        mut,
        seeds = [b"forecaster_v2", prediction_record.forecaster.as_ref()],
        bump = forecaster_state.bump,
        constraint = forecaster_state.authority == prediction_record.forecaster @ CalibrationError::Unauthorized
    )]
    pub forecaster_state: Account<'info, ForecasterState>,
}

pub fn handler(
    ctx: Context<ResolvePrediction>,
    outcome: bool,
) -> Result<()> {
    let forecaster_state = &mut ctx.accounts.forecaster_state;
    let prediction_record = &mut ctx.accounts.prediction_record;
    let clock = Clock::get()?;

    // Resolve the prediction record
    prediction_record.resolve(outcome)?;

    // Update forecaster stats with the new resolution
    forecaster_state.record_resolution(
        prediction_record.predicted_probability,
        outcome,
    )?;

    // Emit resolution event
    emit!(PredictionResolved {
        forecaster: prediction_record.forecaster,
        market_id: prediction_record.market_id,
        outcome,
        brier_score: prediction_record.brier_score.unwrap(),
        log_score: prediction_record.log_score.unwrap(),
        timestamp: clock.unix_timestamp,
        resolved_predictions: forecaster_state.resolved_predictions,
        avg_brier_score: forecaster_state.avg_brier_score,
        accuracy: forecaster_state.accuracy,
    });

    // Emit calibration update event
    emit!(CalibrationUpdated {
        forecaster: prediction_record.forecaster,
        avg_brier_score: forecaster_state.avg_brier_score,
        avg_log_score: forecaster_state.avg_log_score,
        accuracy: forecaster_state.accuracy,
        resolved_predictions: forecaster_state.resolved_predictions,
        streak_correct: forecaster_state.streak_correct,
    });

    msg!(
        "Prediction resolved: forecaster={}, resolver={}, outcome={}, brier={:.4}, avg_brier={:.4}, accuracy={:.2}%",
        prediction_record.forecaster,
        ctx.accounts.resolver.key(),
        outcome,
        prediction_record.brier_score.unwrap(),
        forecaster_state.avg_brier_score,
        forecaster_state.accuracy * 100.0
    );

    Ok(())
}
