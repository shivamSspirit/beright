use anchor_lang::prelude::*;
use crate::state::PredictionDirection;

/// Compressed prediction data (stored in Merkle tree leaf)
/// This structure is serialized and stored off-chain, with only the
/// Merkle root stored on-chain, drastically reducing costs.
///
/// Size: ~150 bytes (vs 200+ for full PDA)
/// Cost: ~$0.0001 per prediction (vs $0.27 for PDA)
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CompressedPredictionData {
    /// Forecaster who made the prediction (32 bytes)
    pub forecaster: Pubkey,

    /// Market ID (32-byte hash of market identifier)
    pub market_id: [u8; 32],

    /// Predicted probability (0.0 - 1.0)
    pub predicted_probability: f64,

    /// Direction of prediction
    pub direction: PredictionDirection,

    /// Unix timestamp when prediction was committed
    pub committed_at: i64,

    /// Unix timestamp when prediction was resolved (0 if unresolved)
    pub resolved_at: i64,

    /// Actual outcome (255 = unresolved, 1 = YES, 0 = NO)
    pub outcome: u8,

    /// Calculated Brier score (0.0 if unresolved)
    pub brier_score: f64,

    /// Calculated log score (0.0 if unresolved)
    pub log_score: f64,

    /// Reference to Memo transaction signature (64 bytes)
    pub memo_tx_signature: [u8; 64],

    /// Market category (0-255)
    pub category: u8,

    /// Schema version
    pub version: u8,
}

impl CompressedPredictionData {
    /// Create a new compressed prediction
    pub fn new(
        forecaster: Pubkey,
        market_id: [u8; 32],
        predicted_probability: f64,
        direction: PredictionDirection,
        committed_at: i64,
        memo_tx_signature: [u8; 64],
        category: u8,
    ) -> Self {
        Self {
            forecaster,
            market_id,
            predicted_probability,
            direction,
            committed_at,
            resolved_at: 0,
            outcome: 255, // 255 = unresolved
            brier_score: 0.0,
            log_score: 0.0,
            memo_tx_signature,
            category,
            version: 1,
        }
    }

    /// Resolve the prediction with an outcome
    pub fn resolve(&mut self, outcome: bool, resolved_at: i64) -> Result<()> {
        // Calculate Brier score
        let o = if outcome { 1.0 } else { 0.0 };
        let p = match self.direction {
            PredictionDirection::Yes => self.predicted_probability,
            PredictionDirection::No => 1.0 - self.predicted_probability,
        };
        let brier = (p - o).powi(2);

        // Calculate log score
        let log = if outcome {
            (p.max(0.0001)).log2()
        } else {
            ((1.0 - p).max(0.0001)).log2()
        };

        self.outcome = if outcome { 1 } else { 0 };
        self.brier_score = brier;
        self.log_score = log;
        self.resolved_at = resolved_at;

        Ok(())
    }

    /// Check if prediction is resolved
    pub fn is_resolved(&self) -> bool {
        self.outcome != 255
    }

    /// Get the hash of this prediction (for Merkle tree leaf)
    pub fn hash(&self) -> [u8; 32] {
        let data = self.try_to_vec().unwrap();
        anchor_lang::solana_program::keccak::hash(&data).to_bytes()
    }
}
