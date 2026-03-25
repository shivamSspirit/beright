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

// === Meteora Integration Events ===

/// Emitted when Meteora vault integration is initialized
#[event]
pub struct MeteoraVaultInitializedEvent {
    pub pool: Pubkey,
    pub meteora_vault: Pubkey,
    pub vault_lp_mint: Pubkey,
    pub underlying_mint: Pubkey,
    pub allocation_bps: u16,
    pub min_deposit: u64,
    pub timestamp: i64,
}

/// Emitted when tokens are deposited to Meteora vault
#[event]
pub struct MeteoraDepositEvent {
    pub pool: Pubkey,
    pub amount_deposited: u64,
    pub lp_tokens_received: u64,
    pub virtual_price: u64,
    pub total_deposited: u64,
    pub timestamp: i64,
}

/// Emitted when tokens are withdrawn from Meteora vault
#[event]
pub struct MeteoraWithdrawEvent {
    pub pool: Pubkey,
    pub lp_tokens_burned: u64,
    pub amount_received: u64,
    pub yield_realized: u64,
    pub virtual_price: u64,
    pub remaining_lp: u64,
    pub timestamp: i64,
}

/// Emitted when yield is harvested from Meteora vault
#[event]
pub struct MeteoraYieldHarvestedEvent {
    pub pool: Pubkey,
    pub yield_amount: u64,
    pub old_virtual_price: u64,
    pub new_virtual_price: u64,
    pub lp_token_balance: u64,
    pub total_yield_earned: u64,
    pub timestamp: i64,
}

// === DLMM Integration Events ===

/// Emitted when DLMM config is initialized
#[event]
pub struct DlmmConfigInitializedEvent {
    pub pool: Pubkey,
    pub max_positions: u8,
    pub max_allocation_bps: u16,
    pub rebalance_threshold_bps: u16,
    pub timestamp: i64,
}

/// Emitted when a DLMM position is created
#[event]
pub struct DlmmPositionCreatedEvent {
    pub pool: Pubkey,
    pub dlmm_pool: Pubkey,
    pub position_nft: Pubkey,
    pub position_index: u8,
    pub lower_bin_id: i32,
    pub upper_bin_id: i32,
    pub amount_x: u64,
    pub amount_y: u64,
    pub timestamp: i64,
}

/// Emitted when liquidity is added to a DLMM position
#[event]
pub struct DlmmLiquidityAddedEvent {
    pub pool: Pubkey,
    pub position_nft: Pubkey,
    pub position_index: u8,
    pub amount_x: u64,
    pub amount_y: u64,
    pub shares_received: u128,
    pub new_total_shares: u128,
    pub timestamp: i64,
}

/// Emitted when liquidity is removed from a DLMM position
#[event]
pub struct DlmmLiquidityRemovedEvent {
    pub pool: Pubkey,
    pub position_nft: Pubkey,
    pub position_index: u8,
    pub shares_removed: u128,
    pub amount_x: u64,
    pub amount_y: u64,
    pub remaining_shares: u128,
    pub position_closed: bool,
    pub timestamp: i64,
}

/// Emitted when fees are claimed from a DLMM position
#[event]
pub struct DlmmFeesClaimedEvent {
    pub pool: Pubkey,
    pub position_nft: Pubkey,
    pub position_index: u8,
    pub fee_x: u64,
    pub fee_y: u64,
    pub total_claimed_x: u64,
    pub total_claimed_y: u64,
    pub timestamp: i64,
}

/// Emitted when a DLMM position is rebalanced
#[event]
pub struct DlmmPositionRebalancedEvent {
    pub pool: Pubkey,
    pub position_nft: Pubkey,
    pub position_index: u8,
    pub old_lower_bin_id: i32,
    pub old_upper_bin_id: i32,
    pub new_lower_bin_id: i32,
    pub new_upper_bin_id: i32,
    pub amount_x: u64,
    pub amount_y: u64,
    pub fees_claimed_x: u64,
    pub fees_claimed_y: u64,
    pub rebalance_count: u16,
    pub timestamp: i64,
}

// === Drift Trading Integration Events ===

/// Emitted when Drift trading is initialized for a pool
#[event]
pub struct DriftTradingInitializedEvent {
    pub pool: Pubkey,
    pub drift_sub_account: Pubkey,
    pub drift_user: Pubkey,
    pub max_leverage: u8,
    pub max_position_size_bps: u16,
    pub max_positions: u8,
    pub max_drawdown_bps: u16,
    pub min_brier_threshold: u16,
    pub timestamp: i64,
}

/// Emitted when collateral is deposited/withdrawn from Drift
#[event]
pub struct DriftCollateralEvent {
    pub pool: Pubkey,
    pub action: u8, // 0 = deposit, 1 = withdraw
    pub amount: u64,
    pub total_collateral: u64,
    pub timestamp: i64,
}

/// Emitted when a perp position is opened
#[event]
pub struct DriftPositionOpenedEvent {
    pub pool: Pubkey,
    pub market_index: u16,
    pub side: u8, // 0 = long, 1 = short
    pub size: u64,
    pub entry_price: u64,
    pub leverage: u8,
    pub prediction_id: [u8; 32],
    pub prediction_probability: u16,
    pub liquidation_price: u64,
    pub timestamp: i64,
}

/// Emitted when a perp position is closed
#[event]
pub struct DriftPositionClosedEvent {
    pub pool: Pubkey,
    pub market_index: u16,
    pub exit_price: u64,
    pub realized_pnl: i64,
    pub position_index: u8,
    pub timestamp: i64,
}

/// Emitted when P&L is updated for a position
#[event]
pub struct DriftPnlUpdatedEvent {
    pub pool: Pubkey,
    pub position_index: u8,
    pub current_price: u64,
    pub unrealized_pnl: i64,
    pub margin_ratio: u64,
    pub timestamp: i64,
}

/// Emitted when a position is at risk or liquidated
#[event]
pub struct DriftLiquidationWarningEvent {
    pub pool: Pubkey,
    pub position_index: u8,
    pub current_price: u64,
    pub liquidation_price: u64,
    pub margin_ratio: u64,
    pub unrealized_pnl: i64,
    pub action_taken: u8, // 0 = warning, 1 = stop loss, 2 = liquidated
    pub timestamp: i64,
}

// === Simplified Forecaster Pool Events ===

/// Emitted when a forecaster pool is created
#[event]
pub struct ForecastPoolCreatedEvent {
    pub pool: Pubkey,
    pub forecaster: Pubkey,
    pub tier: u8,
    pub capacity: u64,
    pub token_mint: Pubkey,
    pub timestamp: i64,
}

/// Emitted when tokens are staked to a forecaster pool
#[event]
pub struct ForecastPoolStakedEvent {
    pub pool: Pubkey,
    pub delegator: Pubkey,
    pub amount: u64,
    pub shares_received: u64,
    pub share_price: u64,
    pub total_value: u64,
    pub timestamp: i64,
}

/// Emitted when tokens are unstaked from a forecaster pool
#[event]
pub struct ForecastPoolUnstakedEvent {
    pub pool: Pubkey,
    pub delegator: Pubkey,
    pub shares_burned: u64,
    pub amount_received: u64,
    pub fee_paid: u64,
    pub share_price: u64,
    pub timestamp: i64,
}

/// Emitted when a prediction is opened using pool capital
#[event]
pub struct PoolPredictionOpenedEvent {
    pub pool: Pubkey,
    pub prediction: Pubkey,
    pub market_id: [u8; 32],
    pub platform: u8,
    pub side: u8,
    pub amount: u64,
    pub entry_price: u64,
    pub timestamp: i64,
}

/// Emitted when a prediction is resolved
#[event]
pub struct PoolPredictionResolvedEvent {
    pub pool: Pubkey,
    pub prediction: Pubkey,
    pub won: bool,
    pub pnl: i64,
    pub forecaster_share: u64,
    pub delegator_share: u64,
    pub platform_share: u64,
    pub new_share_price: u64,
    pub timestamp: i64,
}

/// Emitted when profit is distributed
#[event]
pub struct ProfitDistributedEvent {
    pub pool: Pubkey,
    pub total_profit: u64,
    pub forecaster_amount: u64,
    pub delegator_amount: u64,
    pub platform_amount: u64,
    pub new_share_price: u64,
    pub timestamp: i64,
}
