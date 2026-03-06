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
}
