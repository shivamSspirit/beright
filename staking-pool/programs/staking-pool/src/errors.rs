use anchor_lang::prelude::*;

#[error_code]
pub enum StakingPoolError {
    // === Tier & Access ===
    #[msg("Forecaster tier is insufficient to create a pool")]
    InsufficientTier,

    #[msg("Forecaster does not meet minimum prediction count")]
    InsufficientPredictions,

    #[msg("Forecaster Brier score exceeds tier threshold")]
    BrierScoreTooHigh,

    // === Pool Status ===
    #[msg("Pool is not accepting deposits")]
    PoolNotAcceptingDeposits,

    #[msg("Pool is at maximum capacity")]
    PoolAtCapacity,

    #[msg("Pool is frozen")]
    PoolFrozen,

    #[msg("Pool has closed")]
    PoolClosed,

    #[msg("Pool is not active")]
    PoolNotActive,

    // === Deposits ===
    #[msg("Deposit amount is below minimum")]
    BelowMinimumDeposit,

    #[msg("Deposit amount is zero")]
    ZeroDeposit,

    #[msg("Deposit would exceed pool capacity")]
    ExceedsCapacity,

    // === Withdrawals ===
    #[msg("Withdrawal timelock is still active")]
    TimelockActive,

    #[msg("Minimum lock period has not passed")]
    LockPeriodActive,

    #[msg("No withdrawal request pending")]
    NoWithdrawalPending,

    #[msg("Withdrawal amount exceeds position")]
    InsufficientShares,

    #[msg("Withdrawal delay has not passed")]
    WithdrawalDelayActive,

    #[msg("Insufficient liquidity for withdrawal")]
    InsufficientLiquidity,

    // === NAV & Fees ===
    #[msg("Invalid NAV update")]
    InvalidNavUpdate,

    #[msg("NAV cannot be zero")]
    ZeroNav,

    #[msg("Fee collection not yet due")]
    FeeCollectionNotDue,

    // === Authorization ===
    #[msg("Unauthorized: caller is not the pool owner")]
    Unauthorized,

    #[msg("Invalid authority for this operation")]
    InvalidAuthority,

    // === Merkle ===
    #[msg("Invalid merkle proof")]
    InvalidMerkleProof,

    #[msg("Claim already processed")]
    AlreadyClaimed,

    #[msg("Claim window has closed")]
    ClaimWindowClosed,

    // === Slashing ===
    #[msg("Slashing conditions not met")]
    SlashingConditionsNotMet,

    #[msg("Calibration check not yet due")]
    CalibrationCheckNotDue,

    // === Sanctum ===
    #[msg("Sanctum integration error")]
    SanctumError,

    #[msg("Insufficient idle capital for Sanctum deposit")]
    InsufficientIdleCapital,

    // === Token Accounts ===
    #[msg("Invalid vault account")]
    InvalidVault,

    #[msg("Invalid token mint")]
    InvalidMint,

    #[msg("Invalid token account owner")]
    InvalidOwner,

    #[msg("Insufficient funds in vault")]
    InsufficientFunds,

    // === General ===
    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Invalid configuration parameter")]
    InvalidConfig,

    #[msg("Account already initialized")]
    AlreadyInitialized,

    #[msg("Invalid pool type for this operation")]
    InvalidPoolType,

    // === Meteora Integration ===
    #[msg("Meteora vault not initialized")]
    MeteoraVaultNotInitialized,

    #[msg("Meteora vault is not active")]
    MeteoraVaultNotActive,

    #[msg("Meteora deposit exceeds allocation limit")]
    MeteoraAllocationExceeded,

    #[msg("Insufficient LP tokens for withdrawal")]
    MeteoraInsufficientLp,

    #[msg("Invalid amount specified")]
    InvalidAmount,

    #[msg("Invalid deposit amount (below minimum or exceeds limit)")]
    InvalidDepositAmount,

    #[msg("Invalid allocation percentage")]
    InvalidAllocation,

    #[msg("Invalid pool reference")]
    InvalidPool,

    #[msg("No LP tokens to withdraw")]
    NoLpTokens,

    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,

    #[msg("Invalid virtual price")]
    InvalidVirtualPrice,

    #[msg("Virtual price decreased unexpectedly")]
    VirtualPriceDecreased,

    #[msg("Invalid vault data format")]
    InvalidVaultData,

    // === DLMM Integration ===
    #[msg("DLMM integration is not active")]
    DlmmNotActive,

    #[msg("Maximum DLMM positions reached")]
    DlmmMaxPositionsReached,

    #[msg("DLMM allocation limit exceeded")]
    DlmmAllocationExceeded,

    #[msg("Invalid bin range for position")]
    DlmmInvalidBinRange,

    #[msg("Position is out of price range")]
    DlmmPositionOutOfRange,

    #[msg("DLMM position has been closed")]
    DlmmPositionClosed,

    #[msg("Position NFT not found")]
    DlmmPositionNftNotFound,

    #[msg("Insufficient liquidity shares")]
    DlmmInsufficientShares,

    #[msg("No fees to claim")]
    NoFeesToClaim,

    // === Drift Trading Integration ===
    #[msg("Drift trading is not active")]
    DriftNotActive,

    #[msg("Maximum Drift positions reached")]
    DriftMaxPositionsReached,

    #[msg("Leverage exceeds maximum allowed")]
    DriftLeverageExceeded,

    #[msg("Insufficient collateral for operation")]
    DriftInsufficientCollateral,

    #[msg("Cannot withdraw with open positions")]
    DriftOpenPositions,

    #[msg("Position is not open")]
    DriftPositionNotOpen,

    #[msg("Position is still open")]
    DriftPositionStillOpen,

    #[msg("Forecaster calibration too poor for trading")]
    DriftPoorCalibration,

    #[msg("Position size exceeds allowed maximum")]
    DriftPositionTooLarge,

    #[msg("Invalid prediction ID")]
    DriftInvalidPrediction,

    #[msg("Liquidation risk too high")]
    DriftLiquidationRisk,
}
