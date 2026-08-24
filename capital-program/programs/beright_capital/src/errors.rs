use anchor_lang::prelude::*;

#[error_code]
pub enum CapitalError {
    #[msg("The protocol is paused")]
    ProtocolPaused,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("The market TVL cap would be exceeded")]
    TvlCapExceeded,
    #[msg("The position does not have enough unmatched tokens")]
    InsufficientUnmatched,
    #[msg("The position does not have enough matched tokens")]
    InsufficientMatched,
    #[msg("The strategy principal limit would be exceeded")]
    StrategyLimitExceeded,
    #[msg("No yield is available to claim")]
    YieldUnavailable,
    #[msg("The lending pool has insufficient cash")]
    InsufficientLiquidity,
    #[msg("The requested action would make the account insolvent")]
    Insolvent,
    #[msg("The market is already resolved")]
    AlreadyResolved,
    #[msg("The market has not resolved")]
    NotResolved,
    #[msg("The supplied nonce is invalid")]
    InvalidNonce,
    #[msg("Arithmetic overflow or underflow")]
    MathOverflow,
    #[msg("The account is in the wrong lifecycle state")]
    InvalidLifecycle,
    #[msg("The supplied side is invalid for this operation")]
    InvalidSide,
    #[msg("The supplied token mint does not match the market")]
    InvalidMint,
    #[msg("The supplied token account does not match the market vault")]
    InvalidVault,
    #[msg("This signer is not authorized")]
    Unauthorized,
    #[msg("The two positions cannot be matched")]
    InvalidMatch,
    #[msg("The oracle price is stale")]
    StaleOracle,
    #[msg("The oracle confidence interval is too wide")]
    OracleConfidenceTooWide,
    #[msg("The oracle update is not monotonic")]
    StaleUpdate,
    #[msg("The requested loan exceeds the configured LTV")]
    LtvExceeded,
    #[msg("The loan is healthy and cannot be liquidated")]
    LoanHealthy,
    #[msg("The agent intent has expired")]
    IntentExpired,
    #[msg("The agent intent has already been executed or cancelled")]
    IntentConsumed,
    #[msg("The intent payload does not match the requested execution")]
    IntentMismatch,
    #[msg("The external strategy adapter is disabled")]
    AdapterDisabled,
    #[msg("The external strategy program is not allowlisted")]
    InvalidAdapter,
    #[msg("Market resolution outcome is invalid")]
    InvalidOutcome,
    #[msg("The market cannot close while capital remains deployed")]
    CapitalStillDeployed,
    #[msg("New borrowing is closed before market resolution")]
    BorrowWindowClosed,
    #[msg("The oracle observation slot cannot be in the future")]
    FutureOracleSlot,
    #[msg("The strategy change timelock has not elapsed")]
    StrategyTimelockActive,
    #[msg("No strategy change is pending")]
    NoPendingStrategy,
    #[msg("The proposed authority is invalid")]
    InvalidAuthority,
    #[msg("The thesis parameters violate protocol risk limits")]
    InvalidThesisParameters,
    #[msg("The thesis graduation parameters are invalid")]
    InvalidGraduationParameters,
    #[msg("Funding liquid and idle-yield assets do not reconcile with NAV")]
    FundingCapitalMustRemainLiquid,
    #[msg("The thesis has already graduated and funding cancellation is closed")]
    FundingAlreadyGraduated,
    #[msg("The idle-yield position must be fully exited before thesis strategy execution")]
    FundingYieldExitRequired,
    #[msg("The thesis or vault is not active")]
    ThesisNotActive,
    #[msg("The NAV checkpoint is stale")]
    StaleNav,
    #[msg("The NAV checkpoint change exceeds the configured review threshold")]
    NavChangeTooLarge,
    #[msg("The NAV components do not reconcile")]
    InvalidNav,
    #[msg("The requested deposit would exceed the vault cap")]
    DepositCapExceeded,
    #[msg("The share amount is below the user's minimum")]
    ShareSlippageExceeded,
    #[msg("The redemption amount is below the user's minimum")]
    RedemptionSlippageExceeded,
    #[msg("The redemption must wait for a newer NAV checkpoint")]
    RedemptionEpochPending,
    #[msg("The redemption request is not pending")]
    RedemptionNotPending,
    #[msg("The vault does not have enough liquid custody to settle")]
    InsufficientRedemptionLiquidity,
    #[msg("The prediction allocation exceeds the thesis limit")]
    PredictionAllocationExceeded,
    #[msg("The market allocation exceeds the thesis limit")]
    MarketAllocationExceeded,
    #[msg("The liquid reserve is below the thesis requirement")]
    ReserveRequirementViolated,
    #[msg("The redemption nonce is invalid")]
    InvalidRedemptionNonce,
    #[msg("The requested operation is not supported by this vault structure")]
    InvalidVaultStructure,
    #[msg("The configured lockup is outside the supported range")]
    InvalidLockup,
    #[msg("This investor's vault shares are still locked")]
    LockupActive,
    #[msg("No accrued thesis fees are available to collect")]
    FeesUnavailable,
    #[msg("The vault needs more liquid custody before fees can be collected")]
    InsufficientFeeLiquidity,
}
