use anchor_lang::prelude::*;
use crate::state::{ForecasterState, PredictionRecord};
use crate::events::{PredictionResolved, CalibrationUpdated};
use crate::errors::CalibrationError;

/// Resolve a prediction with the actual outcome
#[derive(Accounts)]
pub struct ResolvePrediction<'info> {
    /// Forecaster's wallet (authority) - only forecaster can resolve their own predictions
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Forecaster state account (PDA)
    #[account(
        mut,
        seeds = [b"forecaster", authority.key().as_ref()],
        bump = forecaster_state.bump,
        constraint = forecaster_state.authority == authority.key() @ CalibrationError::Unauthorized
    )]
    pub forecaster_state: Account<'info, ForecasterState>,

    /// Prediction record account (PDA)
    #[account(
        mut,
        constraint = prediction_record.forecaster == authority.key() @ CalibrationError::Unauthorized,
        constraint = prediction_record.outcome.is_none() @ CalibrationError::AlreadyResolved
    )]
    pub prediction_record: Account<'info, PredictionRecord>,
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
        forecaster: ctx.accounts.authority.key(),
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
        forecaster: ctx.accounts.authority.key(),
        avg_brier_score: forecaster_state.avg_brier_score,
        avg_log_score: forecaster_state.avg_log_score,
        accuracy: forecaster_state.accuracy,
        resolved_predictions: forecaster_state.resolved_predictions,
        streak_correct: forecaster_state.streak_correct,
    });

    msg!(
        "Prediction resolved: forecaster={}, outcome={}, brier={:.4}, avg_brier={:.4}, accuracy={:.2}%",
        ctx.accounts.authority.key(),
        outcome,
        prediction_record.brier_score.unwrap(),
        forecaster_state.avg_brier_score,
        forecaster_state.accuracy * 100.0
    );

    Ok(())
}
