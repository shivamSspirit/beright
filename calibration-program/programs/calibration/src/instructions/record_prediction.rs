use anchor_lang::prelude::*;
use crate::state::{ForecasterState, PredictionRecord, PredictionDirection};
use crate::events::PredictionRecorded;
use crate::errors::CalibrationError;

/// Record a new prediction
#[derive(Accounts)]
#[instruction(market_id: [u8; 32], timestamp_seed: i64)]
pub struct RecordPrediction<'info> {
    /// Forecaster's wallet (authority)
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
        init,
        payer = authority,
        space = PredictionRecord::LEN,
        seeds = [
            b"prediction",
            authority.key().as_ref(),
            market_id.as_ref(),
            timestamp_seed.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub prediction_record: Account<'info, PredictionRecord>,

    /// System program
    pub system_program: Program<'info, System>,
}

/// Handler for recording a new prediction
///
/// This creates a PDA-based prediction record and updates the forecaster's stats.
/// The prediction is tied to an immutable Memo transaction for tamper-proof timestamping.
///
/// # Validation
/// - Probability must be between 0.0 and 1.0
/// - Timestamp must not be in the future
/// - Forecaster must be initialized
///
/// # Arguments
/// * `market_id` - 32-byte hash identifying the prediction market
/// * `_timestamp_seed` - Unix timestamp for PDA derivation (prevents duplicates)
/// * `predicted_probability` - Forecaster's probability estimate (0.0-1.0)
/// * `direction` - YES or NO prediction
/// * `memo_tx_signature` - Reference to immutable Memo program transaction
/// * `category` - Market category identifier (0-255)
pub fn handler(
    ctx: Context<RecordPrediction>,
    market_id: [u8; 32],
    _timestamp_seed: i64,  // Used in PDA seeds, not in function body
    predicted_probability: f64,
    direction: PredictionDirection,
    memo_tx_signature: [u8; 64],
    category: u8,
) -> Result<()> {
    // Validate probability is within valid range
    require!(
        (0.0..=1.0).contains(&predicted_probability),
        CalibrationError::InvalidProbability
    );

    let forecaster_state = &mut ctx.accounts.forecaster_state;
    let prediction_record = &mut ctx.accounts.prediction_record;
    let authority = ctx.accounts.authority.key();
    let bump = ctx.bumps.prediction_record;
    let clock = Clock::get()?;

    // Initialize prediction record
    prediction_record.initialize(
        bump,
        authority,
        market_id,
        predicted_probability,
        direction,
        memo_tx_signature,
        category,
    )?;

    // Update forecaster stats
    forecaster_state.record_prediction(clock.unix_timestamp)?;

    // Emit event
    emit!(PredictionRecorded {
        forecaster: authority,
        market_id,
        predicted_probability,
        direction: match direction {
            PredictionDirection::Yes => 0,
            PredictionDirection::No => 1,
        },
        timestamp: clock.unix_timestamp,
        total_predictions: forecaster_state.total_predictions,
    });

    msg!(
        "Prediction recorded: forecaster={}, market_id={:?}, prob={}, total={}",
        authority,
        market_id,
        predicted_probability,
        forecaster_state.total_predictions
    );

    Ok(())
}
