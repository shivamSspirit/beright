use anchor_lang::prelude::*;

#[error_code]
pub enum ForecastVaultError {
    #[msg("Protocol is paused")]
    ProtocolPaused,
    #[msg("Vault is paused for new activity")]
    VaultPaused,
    #[msg("Prediction sleeve is paused")]
    PredictionSleevePaused,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid fee configuration")]
    InvalidFeeConfiguration,
    #[msg("Invalid sleeve allocation")]
    InvalidSleeveAllocation,
    #[msg("Forecaster policy is inactive")]
    ForecasterPolicyInactive,
    #[msg("Trade intent has already expired")]
    TradeIntentExpired,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Division by zero")]
    DivisionByZero,
    #[msg("Zero shares would be minted")]
    ZeroSharesMinted,
    #[msg("Zero assets would be returned")]
    ZeroAssetsReturned,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid vault state")]
    InvalidVaultState,
    #[msg("Insufficient vault liquidity")]
    InsufficientVaultLiquidity,
    #[msg("Share mint authority mismatch")]
    InvalidShareMintAuthority,
    #[msg("Base vault authority mismatch")]
    InvalidBaseVaultAuthority,
    #[msg("Base vault mint mismatch")]
    InvalidBaseVaultMint,
    #[msg("The requested forecaster budget exceeds the policy cap")]
    ForecasterBudgetExceeded,
    #[msg("The vault prediction sleeve does not have enough free capacity")]
    PredictionSleeveCapacityExceeded,
    #[msg("Trade intent is not open")]
    TradeIntentNotOpen,
    #[msg("Score snapshot does not meet the minimum vault threshold")]
    ScoreBelowThreshold,
    #[msg("Score snapshot forecaster mismatch")]
    ScoreForecasterMismatch,
    #[msg("Score snapshot calibration source mismatch")]
    InvalidCalibrationProgram,
}
