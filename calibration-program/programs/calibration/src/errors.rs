use anchor_lang::prelude::*;

#[error_code]
pub enum CalibrationError {
    #[msg("Unauthorized: Only the forecaster can perform this action")]
    Unauthorized,

    #[msg("Invalid probability: Must be between 0.0 and 1.0")]
    InvalidProbability,

    #[msg("Prediction already resolved")]
    AlreadyResolved,

    #[msg("Prediction not found")]
    PredictionNotFound,

    #[msg("Market ID hash invalid")]
    InvalidMarketId,

    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,

    #[msg("No predictions to resolve")]
    NoPredictions,

    #[msg("Invalid category ID")]
    InvalidCategory,

    #[msg("Memo signature invalid")]
    InvalidMemoSignature,

    #[msg("Forecaster state not initialized")]
    NotInitialized,

    #[msg("Invalid timestamp")]
    InvalidTimestamp,

    #[msg("Score sync is currently paused")]
    ScoreSyncPaused,

    #[msg("Invalid confidence bps")]
    InvalidConfidenceBps,

    #[msg("Invalid or zero hash")]
    InvalidHash,

    #[msg("Passport attestation writes are paused")]
    PassportPaused,

    #[msg("Invalid passport schema version")]
    InvalidPassportSchemaVersion,

    #[msg("Invalid passport status")]
    InvalidPassportStatus,

    #[msg("Invalid passport timestamp ordering")]
    InvalidPassportTimestamp,

    #[msg("Passport subject does not match PDA subject")]
    PassportSubjectMismatch,

    #[msg("Passport epoch must be strictly increasing")]
    StalePassportEpoch,

    #[msg("Passport snapshot is already revoked")]
    PassportAlreadyRevoked,
}
