use anchor_lang::prelude::*;

#[error_code]
pub enum VaultError {
    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Vault is frozen by admin")]
    VaultFrozen,

    #[msg("Withdrawal timelock is still active — try again later")]
    TimelockActive,

    #[msg("Epoch withdrawal limit exceeded — wait for the next epoch")]
    EpochLimitExceeded,

    #[msg("Insufficient vault balance to maintain rent exemption")]
    InsufficientFundsForRent,

    #[msg("Unauthorized: caller is not the vault owner")]
    Unauthorized,

    #[msg("Guardian signature required for large withdrawals")]
    GuardianRequired,

    #[msg("Amount must be greater than zero")]
    ZeroAmount,

    #[msg("Withdrawal amount exceeds vault balance")]
    InsufficientFunds,

    #[msg("Guardian pubkey has not been set on this vault")]
    GuardianNotSet,

    #[msg("Withdrawal delay must be between 0 and 30 days (2592000 seconds)")]
    InvalidWithdrawalDelay,

    #[msg("Epoch withdrawal limit must be greater than zero")]
    InvalidEpochLimit,

    #[msg("Large withdrawal threshold must be greater than zero")]
    InvalidThreshold,
}
