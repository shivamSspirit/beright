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

/// Emitted when score-sync configuration is initialized
#[event]
pub struct ScoreConfigInitialized {
    pub authority: Pubkey,
    pub score_version: u8,
    pub paused: bool,
    pub slot: u64,
}

/// Emitted when score-sync configuration is updated
#[event]
pub struct ScoreConfigUpdated {
    pub authority: Pubkey,
    pub next_authority: Pubkey,
    pub score_version: u8,
    pub paused: bool,
    pub slot: u64,
}

#[event]
pub struct PassportConfigInitialized {
    pub authority: Pubkey,
    pub schema_version: u8,
    pub paused: bool,
    pub slot: u64,
}
#[event]
pub struct PassportConfigUpdated {
    pub authority: Pubkey,
    pub next_authority: Pubkey,
    pub schema_version: u8,
    pub paused: bool,
    pub slot: u64,
}
#[event]
pub struct PassportSnapshotUpserted {
    pub subject: Pubkey,
    pub issuer: Pubkey,
    pub schema_version: u8,
    pub status: u8,
    pub passport_root: [u8; 32],
    pub evidence_root: [u8; 32],
    pub score_epoch: u64,
    pub confidence_bps: u16,
    pub expires_at: i64,
    pub updated_slot: u64,
}
#[event]
pub struct PassportSnapshotRevoked {
    pub subject: Pubkey,
    pub issuer: Pubkey,
    pub score_epoch: u64,
    pub revoked_at: i64,
    pub reason_hash: [u8; 32],
}
