use anchor_lang::prelude::*;

/// Legacy V1 forecaster state layout (borsh body only; discriminator NOT included).
///
/// This must NOT be an Anchor `#[account]` because the program's canonical
/// on-chain account type is now the V2 `ForecasterState` (in `forecaster_v2.rs`).
///
/// We keep this only to deserialize pre-migration accounts so we can validate
/// `authority` and `version` inside the migration instruction.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ForecasterStateV1 {
    /// Bump seed for PDA derivation
    pub bump: u8,

    /// Forecaster's wallet address
    pub authority: Pubkey,

    /// Total number of predictions made (lifetime)
    pub total_predictions: u32,

    /// Number of resolved predictions
    pub resolved_predictions: u32,

    /// Cumulative Brier score (sum of all Brier scores)
    /// Brier score = (predicted_prob - actual_outcome)^2
    /// Range: 0.0 (perfect) to 1.0 (worst)
    pub cumulative_brier_score: f64,

    /// Average Brier score (cumulative / resolved_predictions)
    /// This is the primary calibration metric
    pub avg_brier_score: f64,

    /// Cumulative log score (sum of all log scores)
    /// Log score = log2(predicted_prob) if correct, log2(1 - predicted_prob) if wrong
    pub cumulative_log_score: f64,

    /// Average log score
    pub avg_log_score: f64,

    /// Number of correct predictions (predicted > 0.5 and outcome = YES, or predicted < 0.5 and outcome = NO)
    pub correct_predictions: u32,

    /// Simple accuracy percentage (correct_predictions / resolved_predictions)
    pub accuracy: f64,

    /// Number of unique markets predicted on
    pub markets_traded: u16,

    /// Best category by Brier score (0-255, mapped to categories)
    pub best_category: u8,

    /// Worst category by Brier score
    pub worst_category: u8,

    /// Current winning streak (consecutive correct predictions)
    pub streak_correct: u16,

    /// Longest winning streak (historical)
    pub max_streak_correct: u16,

    /// Unix timestamp of last prediction
    pub last_prediction_ts: i64,

    /// Unix timestamp of account creation
    pub created_at: i64,

    /// Calibration buckets (10 buckets: 0-10%, 10-20%, ..., 90-100%)
    /// Each bucket stores: [count, sum_actual_outcomes]
    /// This enables calibration curve analysis
    pub calibration_buckets: [[u16; 2]; 10],

    /// Schema version for future migrations
    pub version: u8,

    /// Reserved space for future fields (64 bytes)
    pub _reserved: [u8; 64],
}

impl ForecasterStateV1 {
    /// V1 borsh body length (discriminator excluded)
    pub const LEN_NO_DISCRIMINATOR: usize = 214;
}
