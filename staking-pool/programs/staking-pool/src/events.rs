use anchor_lang::prelude::*;

/// Emitted when a new staking pool is created
#[event]
pub struct PoolInitialized {
    pub pool: Pubkey,
    pub forecaster: Pubkey,
    pub pool_mint: Pubkey,
    pub base_token: Pubkey,
    pub pool_type: u8,
    pub max_capacity: u64,
    pub tier_at_creation: u8,
    pub timestamp: i64,
}

/// Emitted when a deposit is made
#[event]
pub struct DepositEvent {
    pub pool: Pubkey,
    pub depositor: Pubkey,
    pub amount: u64,
    pub shares_minted: u64,
    pub entry_nav: u64,
    pub total_deposits: u64,
    pub total_shares: u64,
    pub timestamp: i64,
}

/// Emitted when a withdrawal is requested
#[event]
pub struct WithdrawalRequestedEvent {
    pub pool: Pubkey,
    pub depositor: Pubkey,
    pub shares_requested: u64,
    pub estimated_amount: u64,
    pub withdrawable_after: i64,
    pub timestamp: i64,
}

/// Emitted when a withdrawal is processed
#[event]
pub struct WithdrawalProcessedEvent {
    pub pool: Pubkey,
    pub depositor: Pubkey,
    pub shares_burned: u64,
    pub amount_received: u64,
    pub exit_nav: u64,
    pub pnl: i64,
    pub exit_fee: u64,
    pub total_deposits: u64,
    pub total_shares: u64,
    pub timestamp: i64,
}

/// Emitted when NAV is updated
#[event]
pub struct NavUpdatedEvent {
    pub pool: Pubkey,
    pub old_nav: u64,
    pub new_nav: u64,
    pub total_value: u64,
    pub timestamp: i64,
}

/// Emitted when performance fee is collected
#[event]
pub struct PerformanceFeeCollectedEvent {
    pub pool: Pubkey,
    pub fee_amount: u64,
    pub old_hwm: u64,
    pub new_hwm: u64,
    pub timestamp: i64,
}

/// Emitted when management fee is collected
#[event]
pub struct ManagementFeeCollectedEvent {
    pub pool: Pubkey,
    pub fee_amount: u64,
    pub period_seconds: i64,
    pub timestamp: i64,
}

/// Emitted when fees are collected by the forecaster
#[event]
pub struct FeesCollectedEvent {
    pub pool: Pubkey,
    pub forecaster: Pubkey,
    pub performance_fee: u64,
    pub management_fee: u64,
    pub total_collected: u64,
    pub timestamp: i64,
}

/// Emitted when pool status changes
#[event]
pub struct PoolStatusChangedEvent {
    pub pool: Pubkey,
    pub old_status: u8,
    pub new_status: u8,
    pub timestamp: i64,
}

/// Emitted when tokens are locked for veBRIGHT
#[event]
pub struct VeTokenLockedEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub lock_start: i64,
    pub lock_end: i64,
    pub voting_power: u64,
    pub boost_multiplier: u16,
}

/// Emitted when veBRIGHT lock is extended
#[event]
pub struct VeTokenExtendedEvent {
    pub user: Pubkey,
    pub old_lock_end: i64,
    pub new_lock_end: i64,
    pub new_voting_power: u64,
    pub new_boost_multiplier: u16,
}

/// Emitted when veBRIGHT is unlocked
#[event]
pub struct VeTokenUnlockedEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

/// Emitted when merkle rewards are claimed
#[event]
pub struct MerkleClaimEvent {
    pub distributor: Pubkey,
    pub claimant: Pubkey,
    pub amount: u64,
    pub leaf_index: u64,
    pub timestamp: i64,
}

/// Emitted when a new merkle distributor is created
#[event]
pub struct MerkleDistributorCreatedEvent {
    pub distributor: Pubkey,
    pub epoch: u64,
    pub total_claimable: u64,
    pub claim_deadline: i64,
    pub timestamp: i64,
}

/// Emitted when a forecaster is slashed
#[event]
pub struct SlashingEvent {
    pub pool: Pubkey,
    pub forecaster: Pubkey,
    pub slash_amount: u64,
    pub brier_score: u64,
    pub consecutive_failures: u8,
    pub destination: u8,
    pub timestamp: i64,
}

/// Emitted when capital is deposited to Sanctum INF
#[event]
pub struct SanctumDepositEvent {
    pub pool: Pubkey,
    pub amount_deposited: u64,
    pub inf_tokens_received: u64,
    pub timestamp: i64,
}

/// Emitted when capital is withdrawn from Sanctum INF
#[event]
pub struct SanctumWithdrawEvent {
    pub pool: Pubkey,
    pub inf_tokens_burned: u64,
    pub amount_received: u64,
    pub yield_earned: u64,
    pub timestamp: i64,
}
