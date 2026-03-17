use anchor_lang::prelude::*;

/// Pool type determines lifecycle and features
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum PoolType {
    /// Fixed duration, settles at end
    Tournament = 0,
    /// Open-ended, continuous deposits/withdrawals
    AlphaVault = 1,
    /// Tracks top N forecasters by Brier, auto-rebalances
    IndexPool = 2,
}

impl Default for PoolType {
    fn default() -> Self {
        PoolType::AlphaVault
    }
}

/// Pool lifecycle status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum PoolStatus {
    /// Being configured, not yet accepting deposits
    Draft = 0,
    /// Accepting deposits
    Open = 1,
    /// Active trading
    Active = 2,
    /// Temporarily halted
    Paused = 3,
    /// Closing positions (tournament settling)
    Settling = 4,
    /// Settled, no new activity
    Closed = 5,
}

impl Default for PoolStatus {
    fn default() -> Self {
        PoolStatus::Draft
    }
}

/// Forecaster tier based on Brier score and prediction count
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug)]
pub enum ForecasterTier {
    /// < 10 predictions
    Unranked = 0,
    /// 10+ predictions, any Brier
    Rookie = 1,
    /// Brier < 0.25, 20+ predictions
    Verified = 2,
    /// Brier < 0.18, 50+ predictions
    Elite = 3,
    /// Brier < 0.12, 100+ predictions
    Super = 4,
}

impl Default for ForecasterTier {
    fn default() -> Self {
        ForecasterTier::Unranked
    }
}

/// Main staking pool configuration and state
/// PDA: ["staking_pool", forecaster.key()]
/// Size: 8 (discriminator) + 392 = 400 bytes
#[account]
pub struct StakingPoolState {
    // === Identity (65 bytes) ===
    /// PDA bump seed
    pub bump: u8,
    /// Pool owner/forecaster
    pub forecaster: Pubkey,
    /// bRight LP token mint
    pub pool_mint: Pubkey,

    // === Pool Configuration (49 bytes) ===
    /// Tournament, AlphaVault, or IndexPool
    pub pool_type: PoolType,
    /// Base token for deposits (USDC)
    pub base_token: Pubkey,
    /// Minimum deposit amount (base token units)
    pub min_deposit: u64,
    /// Maximum TVL (reputation-gated)
    pub max_capacity: u64,

    // === Deposit/Share Accounting (56 bytes) ===
    /// Total base tokens deposited
    pub total_deposits: u64,
    /// Total pool shares minted
    pub total_shares: u64,
    /// Net Asset Value per share (scaled 1e9)
    pub nav_per_share: u64,
    /// High-water mark for performance fee
    pub high_water_mark: u64,
    /// Last NAV update timestamp
    pub last_nav_update: i64,
    /// Queued withdrawal amount
    pub pending_withdrawals: u64,
    /// Available liquidity (not in positions)
    pub available_liquidity: u64,

    // === Fee Structure (16 bytes) ===
    /// Performance fee basis points (2000 = 20%)
    pub performance_fee_bps: u16,
    /// Management fee basis points (200 = 2% annual)
    pub management_fee_bps: u16,
    /// Entry fee basis points
    pub entry_fee_bps: u16,
    /// Exit fee basis points
    pub exit_fee_bps: u16,
    /// Last fee collection timestamp
    pub last_fee_collection: i64,

    // === Timelock (16 bytes) ===
    /// Minimum lock period (seconds)
    pub min_lock_period: i64,
    /// Withdrawal processing delay (seconds)
    pub withdrawal_delay: i64,

    // === Status (4 bytes) ===
    /// Current pool status
    pub status: PoolStatus,
    /// Schema version for migrations
    pub version: u8,
    /// Forecaster tier when pool was created
    pub tier_at_creation: u8,
    /// Bitflags for features
    pub flags: u8,

    // === Timestamps (24 bytes) ===
    /// Pool creation timestamp
    pub created_at: i64,
    /// When pool started accepting deposits
    pub activated_at: i64,
    /// For tournament pools: expiry time
    pub closes_at: i64,

    // === Counters (20 bytes) ===
    /// Number of unique depositors
    pub depositor_count: u32,
    /// Lifetime deposits volume
    pub total_deposits_ever: u64,
    /// Lifetime withdrawals volume
    pub total_withdrawals_ever: u64,

    // === Sanctum Integration (32 bytes) ===
    /// INF tokens held
    pub sanctum_inf_balance: u64,
    /// Yield accrued from Sanctum
    pub sanctum_yield_accrued: u64,
    /// % of idle capital routed to Sanctum (basis points)
    pub idle_allocation_bps: u16,
    /// Reserved for Sanctum expansion
    pub _sanctum_reserved: [u8; 14],

    // === Accrued Fees (16 bytes) ===
    /// Accrued performance fee (not yet collected)
    pub accrued_performance_fee: u64,
    /// Accrued management fee (not yet collected)
    pub accrued_management_fee: u64,

    // === Reserved (48 bytes) ===
    pub _reserved: [u8; 48],
}

impl StakingPoolState {
    pub const LEN: usize = 8  // discriminator
        + 1   // bump
        + 32  // forecaster
        + 32  // pool_mint
        + 1   // pool_type
        + 32  // base_token
        + 8   // min_deposit
        + 8   // max_capacity
        + 8   // total_deposits
        + 8   // total_shares
        + 8   // nav_per_share
        + 8   // high_water_mark
        + 8   // last_nav_update
        + 8   // pending_withdrawals
        + 8   // available_liquidity
        + 2   // performance_fee_bps
        + 2   // management_fee_bps
        + 2   // entry_fee_bps
        + 2   // exit_fee_bps
        + 8   // last_fee_collection
        + 8   // min_lock_period
        + 8   // withdrawal_delay
        + 1   // status
        + 1   // version
        + 1   // tier_at_creation
        + 1   // flags
        + 8   // created_at
        + 8   // activated_at
        + 8   // closes_at
        + 4   // depositor_count
        + 8   // total_deposits_ever
        + 8   // total_withdrawals_ever
        + 8   // sanctum_inf_balance
        + 8   // sanctum_yield_accrued
        + 2   // idle_allocation_bps
        + 14  // _sanctum_reserved
        + 8   // accrued_performance_fee
        + 8   // accrued_management_fee
        + 48; // _reserved

    pub const VERSION: u8 = 1;

    /// NAV scale factor (9 decimals)
    pub const NAV_DECIMALS: u64 = 1_000_000_000;

    /// Default NAV for empty pool (1.0)
    pub const DEFAULT_NAV: u64 = 1_000_000_000;

    /// Maximum withdrawal delay: 30 days
    pub const MAX_WITHDRAWAL_DELAY: i64 = 30 * 24 * 60 * 60;

    /// Maximum lock period: 1 year
    pub const MAX_LOCK_PERIOD: i64 = 365 * 24 * 60 * 60;

    /// Initialize pool state
    pub fn initialize(
        &mut self,
        bump: u8,
        forecaster: Pubkey,
        pool_mint: Pubkey,
        base_token: Pubkey,
        pool_type: PoolType,
        config: PoolConfig,
        tier: ForecasterTier,
        max_capacity: u64,
    ) -> Result<()> {
        let clock = Clock::get()?;

        self.bump = bump;
        self.forecaster = forecaster;
        self.pool_mint = pool_mint;
        self.base_token = base_token;
        self.pool_type = pool_type;
        self.min_deposit = config.min_deposit;
        self.max_capacity = max_capacity;

        // Initialize accounting
        self.total_deposits = 0;
        self.total_shares = 0;
        self.nav_per_share = Self::DEFAULT_NAV;
        self.high_water_mark = Self::DEFAULT_NAV;
        self.last_nav_update = clock.unix_timestamp;
        self.pending_withdrawals = 0;
        self.available_liquidity = 0;

        // Fee structure
        self.performance_fee_bps = config.performance_fee_bps;
        self.management_fee_bps = config.management_fee_bps;
        self.entry_fee_bps = config.entry_fee_bps;
        self.exit_fee_bps = config.exit_fee_bps;
        self.last_fee_collection = clock.unix_timestamp;

        // Timelock
        self.min_lock_period = config.min_lock_period;
        self.withdrawal_delay = config.withdrawal_delay;

        // Status
        self.status = PoolStatus::Open;
        self.version = Self::VERSION;
        self.tier_at_creation = tier as u8;
        self.flags = 0;

        // Timestamps
        self.created_at = clock.unix_timestamp;
        self.activated_at = clock.unix_timestamp;
        self.closes_at = config.closes_at.unwrap_or(0);

        // Counters
        self.depositor_count = 0;
        self.total_deposits_ever = 0;
        self.total_withdrawals_ever = 0;

        // Sanctum
        self.sanctum_inf_balance = 0;
        self.sanctum_yield_accrued = 0;
        self.idle_allocation_bps = config.idle_allocation_bps;
        self._sanctum_reserved = [0; 14];

        // Accrued fees
        self.accrued_performance_fee = 0;
        self.accrued_management_fee = 0;

        self._reserved = [0; 48];

        Ok(())
    }

    /// Check if pool is accepting deposits
    pub fn is_accepting_deposits(&self) -> bool {
        matches!(self.status, PoolStatus::Open | PoolStatus::Active)
    }

    /// Check if pool is at capacity
    pub fn is_at_capacity(&self) -> bool {
        self.total_deposits >= self.max_capacity
    }

    /// Calculate shares for a deposit amount
    pub fn calculate_shares(&self, deposit_amount: u64) -> u64 {
        if self.total_shares == 0 || self.total_deposits == 0 {
            // First deposit: 1:1 ratio
            deposit_amount
        } else {
            // shares = deposit * total_shares / total_value
            // Using NAV: shares = deposit * NAV_DECIMALS / nav_per_share
            deposit_amount
                .checked_mul(Self::NAV_DECIMALS)
                .unwrap()
                .checked_div(self.nav_per_share)
                .unwrap()
        }
    }

    /// Calculate withdrawal amount for shares
    pub fn calculate_withdrawal(&self, shares: u64) -> u64 {
        // amount = shares * nav_per_share / NAV_DECIMALS
        shares
            .checked_mul(self.nav_per_share)
            .unwrap()
            .checked_div(Self::NAV_DECIMALS)
            .unwrap()
    }

    /// Update NAV per share
    pub fn update_nav(&mut self, new_nav: u64) -> Result<()> {
        let clock = Clock::get()?;

        // Update NAV
        self.nav_per_share = new_nav;
        self.last_nav_update = clock.unix_timestamp;

        // Update high-water mark if NAV increased
        if new_nav > self.high_water_mark {
            self.high_water_mark = new_nav;
        }

        Ok(())
    }

    /// Pause pool
    pub fn pause(&mut self) {
        self.status = PoolStatus::Paused;
    }

    /// Resume pool
    pub fn resume(&mut self) {
        self.status = PoolStatus::Active;
    }

    /// Close pool
    pub fn close(&mut self) {
        self.status = PoolStatus::Closed;
    }

    /// Accrue performance fee based on current NAV vs HWM
    /// Returns the performance fee accrued
    pub fn accrue_performance_fee(&mut self) -> Result<u64> {
        if self.nav_per_share <= self.high_water_mark {
            return Ok(0);
        }

        // Calculate total pool value
        let total_value = self.calculate_total_value();

        // Profit ratio = (NAV - HWM) / HWM
        let profit_ratio = self.nav_per_share
            .checked_sub(self.high_water_mark)
            .unwrap();

        // Total profit = total_value * profit_ratio / NAV_DECIMALS
        let total_profit = total_value
            .checked_mul(profit_ratio)
            .unwrap()
            .checked_div(Self::NAV_DECIMALS)
            .unwrap();

        // Fee = profit * fee_bps / 10000
        let fee = total_profit
            .checked_mul(self.performance_fee_bps as u64)
            .unwrap()
            .checked_div(10000)
            .unwrap();

        self.accrued_performance_fee = self.accrued_performance_fee
            .checked_add(fee)
            .unwrap();

        // Update HWM to current NAV
        self.high_water_mark = self.nav_per_share;

        Ok(fee)
    }

    /// Accrue management fee based on time elapsed
    /// Returns the management fee accrued
    pub fn accrue_management_fee(&mut self) -> Result<u64> {
        let clock = Clock::get()?;
        let seconds_elapsed = (clock.unix_timestamp - self.last_fee_collection).max(0) as u64;

        if seconds_elapsed == 0 {
            return Ok(0);
        }

        let seconds_per_year: u64 = 365 * 24 * 60 * 60;
        let total_value = self.calculate_total_value();

        // fee = total_value * (fee_bps / 10000) * (seconds_elapsed / seconds_per_year)
        let fee = total_value
            .checked_mul(self.management_fee_bps as u64)
            .unwrap()
            .checked_mul(seconds_elapsed)
            .unwrap()
            .checked_div(10000)
            .unwrap()
            .checked_div(seconds_per_year)
            .unwrap();

        self.accrued_management_fee = self.accrued_management_fee
            .checked_add(fee)
            .unwrap();

        self.last_fee_collection = clock.unix_timestamp;

        Ok(fee)
    }

    /// Get total accrued fees ready for collection
    pub fn total_accrued_fees(&self) -> u64 {
        self.accrued_performance_fee
            .checked_add(self.accrued_management_fee)
            .unwrap_or(0)
    }

    /// Clear accrued fees after collection
    pub fn clear_accrued_fees(&mut self) {
        self.accrued_performance_fee = 0;
        self.accrued_management_fee = 0;
    }

    /// Calculate total pool value
    pub fn calculate_total_value(&self) -> u64 {
        self.total_shares
            .checked_mul(self.nav_per_share)
            .unwrap_or(0)
            .checked_div(Self::NAV_DECIMALS)
            .unwrap_or(0)
    }
}

/// Pool initialization configuration
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct PoolConfig {
    pub min_deposit: u64,
    pub performance_fee_bps: u16,
    pub management_fee_bps: u16,
    pub entry_fee_bps: u16,
    pub exit_fee_bps: u16,
    pub min_lock_period: i64,
    pub withdrawal_delay: i64,
    pub idle_allocation_bps: u16,
    pub closes_at: Option<i64>,
}

impl Default for PoolConfig {
    fn default() -> Self {
        Self {
            min_deposit: 100_000_000, // 100 USDC (6 decimals)
            performance_fee_bps: 2000, // 20%
            management_fee_bps: 200,   // 2% annual
            entry_fee_bps: 0,
            exit_fee_bps: 0,
            min_lock_period: 7 * 24 * 60 * 60, // 7 days
            withdrawal_delay: 24 * 60 * 60,    // 24 hours
            idle_allocation_bps: 3000,         // 30% to Sanctum
            closes_at: None,
        }
    }
}

/// PDA authority for pool share token minting
/// PDA: ["pool_mint_authority", pool.key()]
#[account]
pub struct PoolMintAuthority {
    pub bump: u8,
    pub pool: Pubkey,
}

impl PoolMintAuthority {
    pub const LEN: usize = 8 + 1 + 32;
}

// Default implementation for testing
impl Default for StakingPoolState {
    fn default() -> Self {
        Self {
            bump: 0,
            forecaster: Pubkey::default(),
            pool_mint: Pubkey::default(),
            pool_type: PoolType::default(),
            base_token: Pubkey::default(),
            min_deposit: 0,
            max_capacity: 0,
            total_deposits: 0,
            total_shares: 0,
            nav_per_share: Self::DEFAULT_NAV,
            high_water_mark: Self::DEFAULT_NAV,
            last_nav_update: 0,
            pending_withdrawals: 0,
            available_liquidity: 0,
            performance_fee_bps: 0,
            management_fee_bps: 0,
            entry_fee_bps: 0,
            exit_fee_bps: 0,
            last_fee_collection: 0,
            min_lock_period: 0,
            withdrawal_delay: 0,
            status: PoolStatus::default(),
            version: Self::VERSION,
            tier_at_creation: 0,
            flags: 0,
            created_at: 0,
            activated_at: 0,
            closes_at: 0,
            depositor_count: 0,
            total_deposits_ever: 0,
            total_withdrawals_ever: 0,
            sanctum_inf_balance: 0,
            sanctum_yield_accrued: 0,
            idle_allocation_bps: 0,
            _sanctum_reserved: [0; 14],
            accrued_performance_fee: 0,
            accrued_management_fee: 0,
            _reserved: [0; 48],
        }
    }
}

impl Default for DepositorState {
    fn default() -> Self {
        Self {
            bump: 0,
            pool: Pubkey::default(),
            depositor: Pubkey::default(),
            shares: 0,
            deposited_base: 0,
            entry_nav: 0,
            avg_entry_price: 0,
            unrealized_pnl: 0,
            realized_pnl: 0,
            current_value: 0,
            withdrawal_requested: 0,
            withdrawal_request_ts: 0,
            withdrawable_after: 0,
            claimed_rewards: 0,
            pending_rewards: 0,
            last_claim_ts: 0,
            status: DepositorStatus::default(),
            version: 1,
            deposit_count: 0,
            withdrawal_count: 0,
            _padding: [0; 2],
            first_deposit_ts: 0,
            last_deposit_ts: 0,
            _reserved: [0; 16],
        }
    }
}

use crate::state::depositor::{DepositorState, DepositorStatus};
