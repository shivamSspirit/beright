use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

// use errors::*;  // Removed: unused import warning
use instructions::*;
use state::*;

// Local testing: 3RG5h37iiugivHp6R2LkkzaivCoGUnGaMYjV3mgJKmKM
// Devnet/Mainnet: GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ
declare_id!("GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ");

#[program]
pub mod calibration {
    use super::*;

    /// Initialize a forecaster's calibration tracking state
    ///
    /// Creates a PDA at [b"forecaster", authority.key()]
    /// to store aggregated calibration statistics.
    ///
    /// # Arguments
    /// * `ctx` - InitializeForecaster accounts context
    pub fn initialize_forecaster(ctx: Context<InitializeForecaster>) -> Result<()> {
        instructions::initialize_forecaster::handler(ctx)
    }

    /// Migrate an existing V1 forecaster account to V2 schema
    ///
    /// **CRITICAL**: This reallocates the account from 230 bytes to 589 bytes.
    /// All V1 data is preserved. V2 fields are initialized to safe defaults.
    ///
    /// **Requirements**:
    /// - Account must be version 1 (will fail if already V2)
    /// - Authority must sign (only forecaster can migrate their own account)
    /// - Payer must have ~0.0015 SOL for rent difference
    ///
    /// **After migration**:
    /// - version field updated to 2
    /// - V2 scores initialized to 0/None
    /// - Off-chain service should recalculate from historical cross-platform data
    ///
    /// # Arguments
    /// * `ctx` - MigrateForecasterToV2 accounts context
    pub fn migrate_forecaster_to_v2(ctx: Context<MigrateForecasterToV2>) -> Result<()> {
        instructions::migrate_forecaster_to_v2::handler(ctx)
    }

    /// Record a new prediction
    ///
    /// Creates a PDA at [b"prediction", authority.key(), market_id, timestamp]
    /// to store individual prediction details and updates forecaster stats.
    ///
    /// # Arguments
    /// * `ctx` - RecordPrediction accounts context
    /// * `market_id` - 32-byte hash of market identifier
    /// * `timestamp_seed` - Unix timestamp for PDA derivation (prevents duplicates)
    /// * `predicted_probability` - Predicted probability (0.0 - 1.0)
    /// * `direction` - YES or NO
    /// * `memo_tx_signature` - Reference to Memo transaction (64 bytes)
    /// * `category` - Market category (0-255)
    pub fn record_prediction(
        ctx: Context<RecordPrediction>,
        market_id: [u8; 32],
        timestamp_seed: i64,
        predicted_probability: f64,
        direction: PredictionDirection,
        memo_tx_signature: [u8; 64],
        category: u8,
    ) -> Result<()> {
        instructions::record_prediction::handler(
            ctx,
            market_id,
            timestamp_seed,
            predicted_probability,
            direction,
            memo_tx_signature,
            category,
        )
    }

    /// Resolve a prediction with the actual outcome
    ///
    /// Updates the prediction record with outcome, calculates Brier score
    /// and log score, then updates forecaster's aggregated stats.
    ///
    /// # Arguments
    /// * `ctx` - ResolvePrediction accounts context
    /// * `outcome` - Actual outcome (true = YES, false = NO)
    pub fn resolve_prediction(
        ctx: Context<ResolvePrediction>,
        outcome: bool,
    ) -> Result<()> {
        instructions::resolve_prediction::handler(ctx, outcome)
    }

    // COMPRESSION FEATURES TEMPORARILY DISABLED FOR BUILD COMPATIBILITY
    // TODO: Re-enable when dependency conflicts are resolved
    //
    // /// Initialize a concurrent Merkle tree for compressed predictions
    // pub fn initialize_merkle_tree(
    //     ctx: Context<InitializeMerkleTree>,
    //     max_depth: u32,
    //     max_buffer_size: u32,
    // ) -> Result<()> {
    //     instructions::initialize_merkle_tree::handler(ctx, max_depth, max_buffer_size)
    // }
    //
    // /// Record a compressed prediction using state compression
    // pub fn record_compressed_prediction(
    //     ctx: Context<RecordCompressedPrediction>,
    //     market_id: [u8; 32],
    //     predicted_probability: f64,
    //     direction: PredictionDirection,
    //     memo_tx_signature: [u8; 64],
    //     category: u8,
    // ) -> Result<()> {
    //     instructions::record_compressed_prediction::handler(
    //         ctx,
    //         market_id,
    //         predicted_probability,
    //         direction,
    //         memo_tx_signature,
    //         category,
    //     )
    // }
}
