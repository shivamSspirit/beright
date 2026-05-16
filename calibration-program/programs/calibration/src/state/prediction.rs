use anchor_lang::prelude::*;

/// Individual prediction record
/// PDA: [b"prediction", forecaster_pubkey, market_id_hash, timestamp_bytes]
#[account]
pub struct PredictionRecord {
    /// Bump seed for PDA
    pub bump: u8,

    /// Forecaster who made the prediction
    pub forecaster: Pubkey,

    /// Market ID (32-byte hash of market identifier)
    pub market_id: [u8; 32],

    /// Predicted probability (0.0 - 1.0)
    pub predicted_probability: f64,

    /// Direction of prediction
    pub direction: PredictionDirection,

    /// Unix timestamp when prediction was committed
    pub committed_at: i64,

    /// Unix timestamp when prediction was resolved (None if unresolved)
    pub resolved_at: Option<i64>,

    /// Actual outcome (None if unresolved)
    pub outcome: Option<bool>,

    /// Calculated Brier score (None if unresolved)
    pub brier_score: Option<f64>,

    /// Calculated log score (None if unresolved)
    pub log_score: Option<f64>,

    /// Reference to Memo transaction signature (64 bytes)
    /// This links to the immutable commit on-chain
    pub memo_tx_signature: [u8; 64],

    /// Market category (0-255)
    pub category: u8,

    /// Schema version
    pub version: u8,
}

impl PredictionRecord {
    pub const LEN: usize = 8 + // discriminator
        1 + // bump
        32 + // forecaster
        32 + // market_id
        8 + // predicted_probability
        1 + // direction
        8 + // committed_at
        1 + 8 + // resolved_at (Option<i64>)
        1 + 1 + // outcome (Option<bool>)
        1 + 8 + // brier_score (Option<f64>)
        1 + 8 + // log_score (Option<f64>)
        64 + // memo_tx_signature
        1 + // category
        1; // version

    /// Initialize a new prediction record
    pub fn initialize(
        &mut self,
        bump: u8,
        forecaster: Pubkey,
        market_id: [u8; 32],
        predicted_probability: f64,
        direction: PredictionDirection,
        memo_tx_signature: [u8; 64],
        category: u8,
    ) -> Result<()> {
        let clock = Clock::get()?;

        self.bump = bump;
        self.forecaster = forecaster;
        self.market_id = market_id;
        self.predicted_probability = predicted_probability;
        self.direction = direction;
        self.committed_at = clock.unix_timestamp;
        self.resolved_at = None;
        self.outcome = None;
        self.brier_score = None;
        self.log_score = None;
        self.memo_tx_signature = memo_tx_signature;
        self.category = category;
        self.version = 1;

        Ok(())
    }

    /// Resolves a prediction with the actual outcome and calculates accuracy metrics.
    ///
    /// # Brier Score Calculation
    /// Brier score measures the accuracy of probabilistic predictions:
    /// ```
    /// brier_score = (predicted_probability - actual_outcome)²
    /// ```
    /// - **Range**: 0.0 (perfect prediction) to 1.0 (worst possible)
    /// - **Lower is better**: 0.0 = perfect calibration
    /// - **Penalizes overconfidence**: Being 99% confident and wrong is heavily penalized
    ///
    /// # Direction Handling
    /// Predictions can be YES or NO. The probability is normalized:
    /// - **YES predictions**: Use probability as-is
    /// - **NO predictions**: Invert probability (1.0 - p) before calculation
    ///
    /// # Log Score
    /// Information-theoretic scoring that heavily penalizes confident wrong predictions:
    /// ```
    /// log_score = log₂(p) if correct, log₂(1-p) if wrong
    /// ```
    ///
    /// # Arguments
    /// * `outcome` - true if the event occurred (YES), false otherwise (NO)
    pub fn resolve(&mut self, outcome: bool) -> Result<()> {
        let clock = Clock::get()?;

        // Convert boolean outcome to numerical value for calculation
        let o = if outcome { 1.0 } else { 0.0 };

        // Normalize probability based on prediction direction
        let p = match self.direction {
            PredictionDirection::Yes => self.predicted_probability,
            PredictionDirection::No => 1.0 - self.predicted_probability,
        };

        // Calculate Brier score: (predicted - actual)²
        let brier = (p - o).powi(2);

        // Calculate log score
        let log = if outcome {
            (p.max(0.0001)).log2()
        } else {
            ((1.0 - p).max(0.0001)).log2()
        };

        self.outcome = Some(outcome);
        self.brier_score = Some(brier);
        self.log_score = Some(log);
        self.resolved_at = Some(clock.unix_timestamp);

        Ok(())
    }
}

/// Direction of prediction (YES or NO)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PredictionDirection {
    Yes,
    No,
}
