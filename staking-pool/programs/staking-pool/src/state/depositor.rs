use anchor_lang::prelude::*;

/// Depositor lifecycle status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum DepositorStatus {
    /// Active position
    Active = 0,
    /// Withdrawal requested, waiting for delay
    WithdrawalPending = 1,
    /// Fully exited
    Exited = 2,
}

impl Default for DepositorStatus {
    fn default() -> Self {
        DepositorStatus::Active
    }
}

/// Individual depositor position in a pool
/// PDA: ["depositor", pool.key(), depositor_wallet.key()]
/// Size: 8 (discriminator) + 200 = 208 bytes
#[account]
pub struct DepositorState {
    // === Identity (65 bytes) ===
    /// PDA bump seed
    pub bump: u8,
    /// Pool this position belongs to
    pub pool: Pubkey,
    /// Depositor's wallet address
    pub depositor: Pubkey,

    // === Position (56 bytes) ===
    /// Pool shares owned
    pub shares: u64,
    /// Original deposit amount (base tokens)
    pub deposited_base: u64,
    /// NAV at time of deposit (for P&L tracking)
    pub entry_nav: u64,
    /// Volume-weighted average entry price
    pub avg_entry_price: u64,
    /// Current unrealized P&L (can be negative)
    pub unrealized_pnl: i64,
    /// Realized P&L from partial withdrawals
    pub realized_pnl: i64,
    /// Total value at current NAV
    pub current_value: u64,

    // === Withdrawal Queue (24 bytes) ===
    /// Shares requested for withdrawal
    pub withdrawal_requested: u64,
    /// Timestamp of withdrawal request
    pub withdrawal_request_ts: i64,
    /// Timestamp when withdrawal becomes available
    pub withdrawable_after: i64,

    // === Rewards (24 bytes) ===
    /// Lifetime rewards claimed
    pub claimed_rewards: u64,
    /// Pending unclaimed rewards
    pub pending_rewards: u64,
    /// Last reward claim timestamp
    pub last_claim_ts: i64,

    // === Status (8 bytes) ===
    /// Current status
    pub status: DepositorStatus,
    /// Schema version
    pub version: u8,
    /// Number of deposits made
    pub deposit_count: u16,
    /// Number of withdrawals made
    pub withdrawal_count: u16,
    /// Padding for alignment
    pub _padding: [u8; 2],

    // === Timestamps (16 bytes) ===
    /// First deposit timestamp
    pub first_deposit_ts: i64,
    /// Most recent deposit timestamp
    pub last_deposit_ts: i64,

    // === Reserved (16 bytes) ===
    pub _reserved: [u8; 16],
}

impl DepositorState {
    pub const LEN: usize = 8  // discriminator
        + 1   // bump
        + 32  // pool
        + 32  // depositor
        + 8   // shares
        + 8   // deposited_base
        + 8   // entry_nav
        + 8   // avg_entry_price
        + 8   // unrealized_pnl
        + 8   // realized_pnl
        + 8   // current_value
        + 8   // withdrawal_requested
        + 8   // withdrawal_request_ts
        + 8   // withdrawable_after
        + 8   // claimed_rewards
        + 8   // pending_rewards
        + 8   // last_claim_ts
        + 1   // status
        + 1   // version
        + 2   // deposit_count
        + 2   // withdrawal_count
        + 2   // _padding
        + 8   // first_deposit_ts
        + 8   // last_deposit_ts
        + 16; // _reserved

    pub const VERSION: u8 = 1;

    /// Initialize new depositor state
    pub fn initialize(
        &mut self,
        bump: u8,
        pool: Pubkey,
        depositor: Pubkey,
        shares: u64,
        deposited_base: u64,
        entry_nav: u64,
    ) -> Result<()> {
        let clock = Clock::get()?;

        self.bump = bump;
        self.pool = pool;
        self.depositor = depositor;
        self.shares = shares;
        self.deposited_base = deposited_base;
        self.entry_nav = entry_nav;
        self.avg_entry_price = entry_nav;
        self.unrealized_pnl = 0;
        self.realized_pnl = 0;
        self.current_value = deposited_base;

        self.withdrawal_requested = 0;
        self.withdrawal_request_ts = 0;
        self.withdrawable_after = 0;

        self.claimed_rewards = 0;
        self.pending_rewards = 0;
        self.last_claim_ts = 0;

        self.status = DepositorStatus::Active;
        self.version = Self::VERSION;
        self.deposit_count = 1;
        self.withdrawal_count = 0;
        self._padding = [0; 2];

        self.first_deposit_ts = clock.unix_timestamp;
        self.last_deposit_ts = clock.unix_timestamp;

        self._reserved = [0; 16];

        Ok(())
    }

    /// Add to existing position
    pub fn add_deposit(
        &mut self,
        additional_shares: u64,
        additional_base: u64,
        current_nav: u64,
    ) -> Result<()> {
        let clock = Clock::get()?;

        // Update volume-weighted average entry price
        let old_value = self.shares
            .checked_mul(self.avg_entry_price)
            .unwrap();
        let new_value = additional_shares
            .checked_mul(current_nav)
            .unwrap();
        let total_shares = self.shares
            .checked_add(additional_shares)
            .unwrap();

        self.avg_entry_price = old_value
            .checked_add(new_value)
            .unwrap()
            .checked_div(total_shares)
            .unwrap();

        self.shares = total_shares;
        self.deposited_base = self.deposited_base
            .checked_add(additional_base)
            .unwrap();
        self.deposit_count = self.deposit_count
            .checked_add(1)
            .unwrap();
        self.last_deposit_ts = clock.unix_timestamp;

        Ok(())
    }

    /// Request withdrawal (starts timelock)
    pub fn request_withdrawal(
        &mut self,
        shares_to_withdraw: u64,
        withdrawal_delay: i64,
    ) -> Result<()> {
        let clock = Clock::get()?;

        self.withdrawal_requested = shares_to_withdraw;
        self.withdrawal_request_ts = clock.unix_timestamp;
        self.withdrawable_after = clock.unix_timestamp
            .checked_add(withdrawal_delay)
            .unwrap();
        self.status = DepositorStatus::WithdrawalPending;

        Ok(())
    }

    /// Check if withdrawal is ready
    pub fn is_withdrawal_ready(&self) -> bool {
        if self.withdrawal_requested == 0 {
            return false;
        }
        let clock = Clock::get().unwrap();
        clock.unix_timestamp >= self.withdrawable_after
    }

    /// Process withdrawal (after timelock)
    pub fn process_withdrawal(&mut self, pnl: i64) -> Result<u64> {
        let shares = self.withdrawal_requested;

        self.shares = self.shares
            .checked_sub(shares)
            .unwrap();
        self.realized_pnl = self.realized_pnl
            .checked_add(pnl)
            .unwrap();
        self.withdrawal_count = self.withdrawal_count
            .checked_add(1)
            .unwrap();

        // Reset withdrawal state
        self.withdrawal_requested = 0;
        self.withdrawal_request_ts = 0;
        self.withdrawable_after = 0;

        // Update status
        if self.shares == 0 {
            self.status = DepositorStatus::Exited;
        } else {
            self.status = DepositorStatus::Active;
        }

        Ok(shares)
    }

    /// Update unrealized P&L based on current NAV
    pub fn update_unrealized_pnl(&mut self, current_nav: u64, nav_decimals: u64) {
        let current_value = self.shares
            .checked_mul(current_nav)
            .unwrap()
            .checked_div(nav_decimals)
            .unwrap();

        self.current_value = current_value;

        // P&L = current_value - deposited_base
        self.unrealized_pnl = (current_value as i64)
            .checked_sub(self.deposited_base as i64)
            .unwrap();
    }

    /// Check if timelock period has passed since first deposit
    pub fn can_withdraw(&self, min_lock_period: i64) -> bool {
        let clock = Clock::get().unwrap();
        clock.unix_timestamp >= self.first_deposit_ts + min_lock_period
    }

    /// Check if can withdraw at a specific timestamp (for testing)
    pub fn can_withdraw_at(&self, min_lock_period: i64, current_timestamp: i64) -> bool {
        current_timestamp >= self.first_deposit_ts + min_lock_period
    }
}
