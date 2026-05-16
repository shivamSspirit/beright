use anchor_lang::prelude::*;
use spl_account_compression::{
    program::SplAccountCompression,
    cpi::{accounts::Append, append},
    Noop,
};
use crate::state::{ForecasterState, PredictionDirection, CompressedPredictionData};
use crate::events::PredictionRecorded;
use crate::errors::CalibrationError;

/// Record a compressed prediction using state compression
///
/// This instruction stores predictions in a concurrent Merkle tree,
/// drastically reducing storage costs while maintaining verifiability.
///
/// Cost: ~$0.0001 per prediction (vs $0.27 for regular PDAs)
/// 99% cost reduction at scale!
#[derive(Accounts)]
pub struct RecordCompressedPrediction<'info> {
    /// Forecaster's wallet (authority)
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Forecaster state account (PDA) - still needed for aggregated stats
    #[account(
        mut,
        seeds = [b"forecaster", authority.key().as_ref()],
        bump = forecaster_state.bump,
        constraint = forecaster_state.authority == authority.key() @ CalibrationError::Unauthorized
    )]
    pub forecaster_state: Account<'info, ForecasterState>,

    /// Concurrent Merkle Tree account (stores compressed data)
    /// CHECK: This account is validated by the SPL Account Compression program
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,

    /// SPL Account Compression program
    pub compression_program: Program<'info, SplAccountCompression>,

    /// SPL Noop program (for logging data)
    /// CHECK: This is the official Noop program
    pub log_wrapper: Program<'info, Noop>,
}

pub fn handler(
    ctx: Context<RecordCompressedPrediction>,
    market_id: [u8; 32],
    predicted_probability: f64,
    direction: PredictionDirection,
    memo_tx_signature: [u8; 64],
    category: u8,
) -> Result<()> {
    // Validate probability
    require!(
        (0.0..=1.0).contains(&predicted_probability),
        CalibrationError::InvalidProbability
    );

    let forecaster_state = &mut ctx.accounts.forecaster_state;
    let authority = ctx.accounts.authority.key();
    let clock = Clock::get()?;

    // Create compressed prediction data
    let prediction_data = CompressedPredictionData::new(
        authority,
        market_id,
        predicted_probability,
        direction,
        clock.unix_timestamp,
        memo_tx_signature,
        category,
    );

    // Serialize the data
    let data_hash = prediction_data.hash();

    // Append to Merkle tree via CPI
    let cpi_ctx = CpiContext::new(
        ctx.accounts.compression_program.to_account_info(),
        Append {
            merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
            noop: ctx.accounts.log_wrapper.to_account_info(),
        },
    );

    // Append the leaf hash to the Merkle tree
    append(cpi_ctx, data_hash)?;

    // Update forecaster stats (same as regular PDA version)
    forecaster_state.record_prediction(clock.unix_timestamp)?;

    // Emit event (for indexers to capture off-chain)
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
        "Compressed prediction recorded: forecaster={}, market_id={:?}, prob={}, total={}",
        authority,
        market_id,
        predicted_probability,
        forecaster_state.total_predictions
    );

    Ok(())
}
