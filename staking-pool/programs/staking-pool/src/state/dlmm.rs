use anchor_lang::prelude::*;

use crate::errors::StakingPoolError;

/// Status of a DLMM position
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum DlmmPositionStatus {
    /// Position is active and in range
    Active,
    /// Position is out of the current price range
    OutOfRange,
    /// Position has been closed
    Closed,
}

impl Default for DlmmPositionStatus {
    fn default() -> Self {
        Self::Active
    }
}

/// Configuration for DLMM integration at the pool level
#[account]
pub struct DlmmConfig {
    /// PDA bump
    pub bump: u8,

    /// The staking pool this config belongs to
    pub pool: Pubkey,

    /// Maximum number of DLMM positions allowed
    pub max_positions: u8,

    /// Maximum allocation to DLMM as basis points (0-10000)
    pub max_allocation_bps: u16,

    /// Threshold to trigger rebalance (in basis points from range edge)
    /// e.g., 500 = rebalance when price is within 5% of position edge
    pub rebalance_threshold_bps: u16,

    /// Current number of active positions
    pub active_positions: u8,

    /// Total liquidity value across all positions (in underlying token)
    pub total_liquidity_value: u64,

    /// Total fees earned across all positions (token X)
    pub total_fees_x: u64,

    /// Total fees earned across all positions (token Y)
    pub total_fees_y: u64,

    /// Whether DLMM integration is enabled
    pub is_active: bool,

    /// Timestamp when config was created
    pub created_at: i64,

    /// Last update timestamp
    pub last_update: i64,

    /// Reserved space for future upgrades
    pub _reserved: [u8; 64],
}

impl DlmmConfig {
    /// Account size in bytes
    pub const LEN: usize = 8 // discriminator
        + 1   // bump
        + 32  // pool
        + 1   // max_positions
        + 2   // max_allocation_bps
        + 2   // rebalance_threshold_bps
        + 1   // active_positions
        + 8   // total_liquidity_value
        + 8   // total_fees_x
        + 8   // total_fees_y
        + 1   // is_active
        + 8   // created_at
        + 8   // last_update
        + 64; // reserved

    /// Default maximum positions
    pub const DEFAULT_MAX_POSITIONS: u8 = 5;

    /// Default max allocation (50%)
    pub const DEFAULT_MAX_ALLOCATION_BPS: u16 = 5000;

    /// Default rebalance threshold (10% from edge)
    pub const DEFAULT_REBALANCE_THRESHOLD_BPS: u16 = 1000;

    /// Initialize DLMM config
    pub fn initialize(
        &mut self,
        bump: u8,
        pool: Pubkey,
        max_positions: Option<u8>,
        max_allocation_bps: Option<u16>,
        rebalance_threshold_bps: Option<u16>,
    ) -> Result<()> {
        let clock = Clock::get()?;

        self.bump = bump;
        self.pool = pool;
        self.max_positions = max_positions.unwrap_or(Self::DEFAULT_MAX_POSITIONS);
        self.max_allocation_bps = max_allocation_bps.unwrap_or(Self::DEFAULT_MAX_ALLOCATION_BPS);
        self.rebalance_threshold_bps =
            rebalance_threshold_bps.unwrap_or(Self::DEFAULT_REBALANCE_THRESHOLD_BPS);
        self.active_positions = 0;
        self.total_liquidity_value = 0;
        self.total_fees_x = 0;
        self.total_fees_y = 0;
        self.is_active = true;
        self.created_at = clock.unix_timestamp;
        self.last_update = clock.unix_timestamp;
        self._reserved = [0u8; 64];

        Ok(())
    }

    /// Check if a new position can be created
    pub fn can_create_position(&self) -> bool {
        self.is_active && self.active_positions < self.max_positions
    }

    /// Increment active position count
    pub fn add_position(&mut self) -> Result<()> {
        require!(
            self.active_positions < self.max_positions,
            StakingPoolError::DlmmMaxPositionsReached
        );
        self.active_positions = self.active_positions.saturating_add(1);
        self.last_update = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Decrement active position count
    pub fn remove_position(&mut self) -> Result<()> {
        self.active_positions = self.active_positions.saturating_sub(1);
        self.last_update = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Update total liquidity value
    pub fn update_liquidity_value(&mut self, new_value: u64) -> Result<()> {
        self.total_liquidity_value = new_value;
        self.last_update = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Add claimed fees
    pub fn add_fees(&mut self, fees_x: u64, fees_y: u64) -> Result<()> {
        self.total_fees_x = self.total_fees_x.saturating_add(fees_x);
        self.total_fees_y = self.total_fees_y.saturating_add(fees_y);
        self.last_update = Clock::get()?.unix_timestamp;
        Ok(())
    }
}

/// State for an individual DLMM position
#[account]
pub struct DlmmPositionState {
    /// PDA bump
    pub bump: u8,

    /// The staking pool this position belongs to
    pub pool: Pubkey,

    /// DLMM pool address (e.g., SOL-USDC)
    pub dlmm_pool: Pubkey,

    /// Position NFT mint (used to identify the position)
    pub position_nft: Pubkey,

    /// Token X mint (e.g., SOL)
    pub token_x_mint: Pubkey,

    /// Token Y mint (e.g., USDC)
    pub token_y_mint: Pubkey,

    /// Lower bin ID of the position range
    pub lower_bin_id: i32,

    /// Upper bin ID of the position range
    pub upper_bin_id: i32,

    /// Current active bin ID (from DLMM pool)
    pub active_bin_id: i32,

    /// Total liquidity shares in this position
    pub liquidity_shares: u128,

    /// Amount of token X deposited
    pub deposited_x: u64,

    /// Amount of token Y deposited
    pub deposited_y: u64,

    /// Unclaimed fees in token X
    pub unclaimed_fee_x: u64,

    /// Unclaimed fees in token Y
    pub unclaimed_fee_y: u64,

    /// Total fees claimed from this position (token X)
    pub total_claimed_fee_x: u64,

    /// Total fees claimed from this position (token Y)
    pub total_claimed_fee_y: u64,

    /// Current status of the position
    pub status: DlmmPositionStatus,

    /// Position index (for tracking multiple positions)
    pub position_index: u8,

    /// Entry price when position was created (scaled 1e9)
    pub entry_price: u64,

    /// Timestamp when position was created
    pub created_at: i64,

    /// Last update timestamp
    pub last_update: i64,

    /// Number of times position has been rebalanced
    pub rebalance_count: u16,

    /// Reserved space for future upgrades
    pub _reserved: [u8; 32],
}

impl DlmmPositionState {
    /// Account size in bytes
    pub const LEN: usize = 8  // discriminator
        + 1   // bump
        + 32  // pool
        + 32  // dlmm_pool
        + 32  // position_nft
        + 32  // token_x_mint
        + 32  // token_y_mint
        + 4   // lower_bin_id
        + 4   // upper_bin_id
        + 4   // active_bin_id
        + 16  // liquidity_shares
        + 8   // deposited_x
        + 8   // deposited_y
        + 8   // unclaimed_fee_x
        + 8   // unclaimed_fee_y
        + 8   // total_claimed_fee_x
        + 8   // total_claimed_fee_y
        + 1   // status
        + 1   // position_index
        + 8   // entry_price
        + 8   // created_at
        + 8   // last_update
        + 2   // rebalance_count
        + 32; // reserved

    /// Minimum bin width for a position (in bin IDs)
    pub const MIN_BIN_WIDTH: i32 = 10;

    /// Maximum bin width for a position
    pub const MAX_BIN_WIDTH: i32 = 200;

    /// Price scale factor (1e9)
    pub const PRICE_SCALE: u64 = 1_000_000_000;

    /// Initialize a new position
    #[allow(clippy::too_many_arguments)]
    pub fn initialize(
        &mut self,
        bump: u8,
        pool: Pubkey,
        dlmm_pool: Pubkey,
        position_nft: Pubkey,
        token_x_mint: Pubkey,
        token_y_mint: Pubkey,
        lower_bin_id: i32,
        upper_bin_id: i32,
        active_bin_id: i32,
        position_index: u8,
        entry_price: u64,
    ) -> Result<()> {
        // Validate bin range
        let bin_width = upper_bin_id.saturating_sub(lower_bin_id);
        require!(
            bin_width >= Self::MIN_BIN_WIDTH && bin_width <= Self::MAX_BIN_WIDTH,
            StakingPoolError::DlmmInvalidBinRange
        );

        let clock = Clock::get()?;

        self.bump = bump;
        self.pool = pool;
        self.dlmm_pool = dlmm_pool;
        self.position_nft = position_nft;
        self.token_x_mint = token_x_mint;
        self.token_y_mint = token_y_mint;
        self.lower_bin_id = lower_bin_id;
        self.upper_bin_id = upper_bin_id;
        self.active_bin_id = active_bin_id;
        self.liquidity_shares = 0;
        self.deposited_x = 0;
        self.deposited_y = 0;
        self.unclaimed_fee_x = 0;
        self.unclaimed_fee_y = 0;
        self.total_claimed_fee_x = 0;
        self.total_claimed_fee_y = 0;
        self.status = DlmmPositionStatus::Active;
        self.position_index = position_index;
        self.entry_price = entry_price;
        self.created_at = clock.unix_timestamp;
        self.last_update = clock.unix_timestamp;
        self.rebalance_count = 0;
        self._reserved = [0u8; 32];

        Ok(())
    }

    /// Check if position is in range
    pub fn is_in_range(&self) -> bool {
        self.active_bin_id >= self.lower_bin_id && self.active_bin_id <= self.upper_bin_id
    }

    /// Update position status based on current bin
    pub fn update_status(&mut self, current_active_bin: i32) -> Result<()> {
        self.active_bin_id = current_active_bin;

        if self.status == DlmmPositionStatus::Closed {
            return Ok(());
        }

        if self.is_in_range() {
            self.status = DlmmPositionStatus::Active;
        } else {
            self.status = DlmmPositionStatus::OutOfRange;
        }

        self.last_update = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Check if position should be rebalanced
    /// Returns true if price is within threshold of position edge
    pub fn should_rebalance(&self, threshold_bps: u16) -> bool {
        if self.status == DlmmPositionStatus::Closed {
            return false;
        }

        let bin_width = self.upper_bin_id - self.lower_bin_id;
        let threshold_bins = (bin_width as u32 * threshold_bps as u32 / 10000) as i32;

        // Check if within threshold of either edge
        let near_lower = self.active_bin_id <= self.lower_bin_id + threshold_bins;
        let near_upper = self.active_bin_id >= self.upper_bin_id - threshold_bins;

        near_lower || near_upper || !self.is_in_range()
    }

    /// Record liquidity addition
    pub fn add_liquidity(
        &mut self,
        shares_added: u128,
        amount_x: u64,
        amount_y: u64,
    ) -> Result<()> {
        self.liquidity_shares = self
            .liquidity_shares
            .checked_add(shares_added)
            .ok_or(StakingPoolError::Overflow)?;
        self.deposited_x = self
            .deposited_x
            .checked_add(amount_x)
            .ok_or(StakingPoolError::Overflow)?;
        self.deposited_y = self
            .deposited_y
            .checked_add(amount_y)
            .ok_or(StakingPoolError::Overflow)?;
        self.last_update = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Record liquidity removal
    pub fn remove_liquidity(
        &mut self,
        shares_removed: u128,
        amount_x: u64,
        amount_y: u64,
    ) -> Result<()> {
        self.liquidity_shares = self.liquidity_shares.saturating_sub(shares_removed);
        self.deposited_x = self.deposited_x.saturating_sub(amount_x);
        self.deposited_y = self.deposited_y.saturating_sub(amount_y);

        if self.liquidity_shares == 0 {
            self.status = DlmmPositionStatus::Closed;
        }

        self.last_update = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Record fee claim
    pub fn claim_fees(&mut self, fee_x: u64, fee_y: u64) -> Result<()> {
        self.unclaimed_fee_x = 0;
        self.unclaimed_fee_y = 0;
        self.total_claimed_fee_x = self
            .total_claimed_fee_x
            .checked_add(fee_x)
            .ok_or(StakingPoolError::Overflow)?;
        self.total_claimed_fee_y = self
            .total_claimed_fee_y
            .checked_add(fee_y)
            .ok_or(StakingPoolError::Overflow)?;
        self.last_update = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Update unclaimed fees
    pub fn update_unclaimed_fees(&mut self, fee_x: u64, fee_y: u64) -> Result<()> {
        self.unclaimed_fee_x = fee_x;
        self.unclaimed_fee_y = fee_y;
        self.last_update = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Record rebalance
    pub fn record_rebalance(
        &mut self,
        new_lower_bin: i32,
        new_upper_bin: i32,
        new_position_nft: Pubkey,
    ) -> Result<()> {
        self.lower_bin_id = new_lower_bin;
        self.upper_bin_id = new_upper_bin;
        self.position_nft = new_position_nft;
        self.rebalance_count = self.rebalance_count.saturating_add(1);
        self.status = DlmmPositionStatus::Active;
        self.last_update = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Calculate current position value in token Y (using current price)
    pub fn calculate_value_in_y(&self, current_price: u64) -> u64 {
        // Value = deposited_y + (deposited_x * price)
        let x_value_in_y = self
            .deposited_x
            .saturating_mul(current_price)
            .saturating_div(Self::PRICE_SCALE);

        self.deposited_y.saturating_add(x_value_in_y)
    }

    /// Calculate impermanent loss percentage (scaled by 10000)
    pub fn calculate_il_bps(&self, current_price: u64) -> i64 {
        if self.entry_price == 0 || current_price == 0 {
            return 0;
        }

        // IL formula simplified:
        // IL = 2 * sqrt(price_ratio) / (1 + price_ratio) - 1
        // This is an approximation for concentrated liquidity

        let price_ratio = (current_price as u128)
            .saturating_mul(Self::PRICE_SCALE as u128)
            .saturating_div(self.entry_price as u128);

        // Simplified IL approximation: (price_ratio - 1)^2 / (4 * price_ratio)
        // Convert to basis points
        let ratio_diff = if price_ratio > Self::PRICE_SCALE as u128 {
            price_ratio - Self::PRICE_SCALE as u128
        } else {
            Self::PRICE_SCALE as u128 - price_ratio
        };

        let il_raw = ratio_diff
            .saturating_mul(ratio_diff)
            .saturating_div(4 * price_ratio);

        // Convert to basis points (0-10000)
        (il_raw.saturating_mul(10000).saturating_div(Self::PRICE_SCALE as u128)) as i64
    }
}
