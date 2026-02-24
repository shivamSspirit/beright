use anchor_lang::prelude::*;

/// Emitted when a vault is initialized
#[event]
pub struct VaultInitialized {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub withdrawal_delay: i64,
    pub epoch_withdraw_limit: u64,
    pub large_withdraw_threshold: u64,
    pub timestamp: i64,
}

/// Emitted on every SOL deposit
#[event]
pub struct DepositEvent {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
    pub new_balance: u64,
    pub total_deposited: u64,
}

/// Emitted on every SOL withdrawal
#[event]
pub struct WithdrawEvent {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
    pub new_balance: u64,
    pub total_withdrawn: u64,
    pub next_unlock: i64,
}

/// Emitted on every SPL token deposit
#[event]
pub struct TokenDepositEvent {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

/// Emitted on every SPL token withdrawal
#[event]
pub struct TokenWithdrawEvent {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

/// Emitted when the vault freeze state changes
#[event]
pub struct FreezeEvent {
    pub vault: Pubkey,
    pub frozen_by: Pubkey,
    pub is_frozen: bool,
    pub timestamp: i64,
}

/// Emitted when guardian is updated
#[event]
pub struct GuardianUpdated {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub new_guardian: Pubkey,
    pub threshold: u64,
    pub timestamp: i64,
}
