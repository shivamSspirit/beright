use anchor_lang::prelude::*;

/// Forecaster calibration state account
/// PDA: [b"forecaster", forecaster_pubkey]
#[account]
pub struct ForecasterState {
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

impl ForecasterState {
    pub const LEN: usize = 8 + // discriminator
        1 + // bump
        32 + // authority
        4 + // total_predictions
        4 + // resolved_predictions
        8 + // cumulative_brier_score
        8 + // avg_brier_score
        8 + // cumulative_log_score
        8 + // avg_log_score
        4 + // correct_predictions
        8 + // accuracy
        2 + // markets_traded
        1 + // best_category
        1 + // worst_category
        2 + // streak_correct
        2 + // max_streak_correct
        8 + // last_prediction_ts
        8 + // created_at
        (2 * 2 * 10) + // calibration_buckets (10 buckets * 2 u16s)
        1 + // version
        64; // _reserved

    /// Initialize a new forecaster state
    pub fn initialize(&mut self, authority: Pubkey, bump: u8) -> Result<()> {
        let clock = Clock::get()?;

        self.bump = bump;
        self.authority = authority;
        self.total_predictions = 0;
        self.resolved_predictions = 0;
        self.cumulative_brier_score = 0.0;
        self.avg_brier_score = 0.0;
        self.cumulative_log_score = 0.0;
        self.avg_log_score = 0.0;
        self.correct_predictions = 0;
        self.accuracy = 0.0;
        self.markets_traded = 0;
        self.best_category = 0;
        self.worst_category = 0;
        self.streak_correct = 0;
        self.max_streak_correct = 0;
        self.last_prediction_ts = clock.unix_timestamp;
        self.created_at = clock.unix_timestamp;
        self.calibration_buckets = [[0, 0]; 10];
        self.version = 1;
        self._reserved = [0; 64];

        Ok(())
    }

    /// Record a new prediction (increment total_predictions)
    pub fn record_prediction(&mut self, timestamp: i64) -> Result<()> {
        self.total_predictions = self.total_predictions
            .checked_add(1)
            .ok_or(ProgramError::ArithmeticOverflow)?;
        self.last_prediction_ts = timestamp;

        Ok(())
    }

    /// Update stats after a prediction is resolved
    pub fn record_resolution(
        &mut self,
        predicted_probability: f64,
        outcome: bool,
    ) -> Result<()> {
        // Calculate Brier score: (p - o)^2
        let o = if outcome { 1.0 } else { 0.0 };
        let brier_score = (predicted_probability - o).powi(2);

        // Calculate log score
        let log_score = if outcome {
            (predicted_probability.max(0.0001)).log2() // Avoid log(0)
        } else {
            ((1.0 - predicted_probability).max(0.0001)).log2()
        };

        // Update cumulative scores
        self.cumulative_brier_score += brier_score;
        self.cumulative_log_score += log_score;

        // Increment resolved count
        self.resolved_predictions = self.resolved_predictions
            .checked_add(1)
            .ok_or(ProgramError::ArithmeticOverflow)?;

        // Recalculate averages
        self.avg_brier_score = self.cumulative_brier_score / self.resolved_predictions as f64;
        self.avg_log_score = self.cumulative_log_score / self.resolved_predictions as f64;

        // Check if prediction was correct
        let predicted_yes = predicted_probability > 0.5;
        let is_correct = (predicted_yes && outcome) || (!predicted_yes && !outcome);

        if is_correct {
            self.correct_predictions = self.correct_predictions
                .checked_add(1)
                .ok_or(ProgramError::ArithmeticOverflow)?;
            self.streak_correct = self.streak_correct
                .checked_add(1)
                .ok_or(ProgramError::ArithmeticOverflow)?;

            if self.streak_correct > self.max_streak_correct {
                self.max_streak_correct = self.streak_correct;
            }
        } else {
            self.streak_correct = 0;
        }

        // Update simple accuracy
        self.accuracy = self.correct_predictions as f64 / self.resolved_predictions as f64;

        // Update calibration buckets
        let bucket_idx = ((predicted_probability * 10.0).floor() as usize).min(9);
        self.calibration_buckets[bucket_idx][0] = self.calibration_buckets[bucket_idx][0]
            .checked_add(1)
            .ok_or(ProgramError::ArithmeticOverflow)?;
        if outcome {
            self.calibration_buckets[bucket_idx][1] = self.calibration_buckets[bucket_idx][1]
                .checked_add(1)
                .ok_or(ProgramError::ArithmeticOverflow)?;
        }

        Ok(())
    }

    /// Get calibration curve data (for analysis)
    pub fn get_calibration_curve(&self) -> Vec<(f64, f64, u16)> {
        self.calibration_buckets
            .iter()
            .enumerate()
            .map(|(i, &[count, sum_outcomes])| {
                let predicted_range = (i as f64 * 0.1, (i + 1) as f64 * 0.1);
                let avg_predicted = (predicted_range.0 + predicted_range.1) / 2.0;
                let actual_freq = if count > 0 {
                    sum_outcomes as f64 / count as f64
                } else {
                    0.0
                };
                (avg_predicted, actual_freq, count)
            })
            .collect()
    }
}
