use anchor_lang::prelude::*;

/// Emitted when a forecaster state is initialized
#[event]
pub struct ForecasterInitialized {
    pub forecaster: Pubkey,
    pub timestamp: i64,
}

/// Emitted when a new prediction is recorded
#[event]
pub struct PredictionRecorded {
    pub forecaster: Pubkey,
    pub market_id: [u8; 32],
    pub predicted_probability: f64,
    pub direction: u8, // 0 = Yes, 1 = No
    pub timestamp: i64,
    pub total_predictions: u32,
}

/// Emitted when a prediction is resolved
#[event]
pub struct PredictionResolved {
    pub forecaster: Pubkey,
    pub market_id: [u8; 32],
    pub outcome: bool,
    pub brier_score: f64,
    pub log_score: f64,
    pub timestamp: i64,
    pub resolved_predictions: u32,
    pub avg_brier_score: f64,
    pub accuracy: f64,
}

/// Emitted when calibration stats are updated
#[event]
pub struct CalibrationUpdated {
    pub forecaster: Pubkey,
    pub avg_brier_score: f64,
    pub avg_log_score: f64,
    pub accuracy: f64,
    pub resolved_predictions: u32,
    pub streak_correct: u16,
}
