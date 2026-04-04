use anchor_lang::prelude::*;

/// Pool tier determines capacity and eligibility requirements
/// Based on the simplified staking spec
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum PoolTier {
    /// Starter SOL: 5 SOL capacity, Brier < 0.35, 10+ predictions
    StarterSol = 0,
    /// Basic SOL: 10 SOL capacity, Brier < 0.30, 25+ predictions
    BasicSol = 1,
    /// Starter USDC: 500 USDC capacity, Brier < 0.35, 10+ predictions
    StarterUsdc = 2,
    /// Basic USDC: 1,000 USDC capacity, Brier < 0.30, 25+ predictions
    BasicUsdc = 3,
    /// Pro SOL: 100 SOL capacity, Brier < 0.25, 100+ predictions
    ProSol = 4,
    /// Pro USDC: 10,000 USDC capacity, Brier < 0.25, 100+ predictions
    ProUsdc = 5,
    /// Elite SOL: 500 SOL capacity, Brier < 0.20, 250+ predictions
    EliteSol = 6,
    /// Elite USDC: 50,000 USDC capacity, Brier < 0.20, 250+ predictions
    EliteUsdc = 7,
}

impl PoolTier {
    /// Get the pool capacity in lamports (SOL) or base units (USDC)
    /// SOL: 9 decimals, USDC: 6 decimals
    pub fn capacity(&self) -> u64 {
        match self {
            PoolTier::StarterSol => 5 * 1_000_000_000,        // 5 SOL
            PoolTier::BasicSol => 10 * 1_000_000_000,         // 10 SOL
            PoolTier::StarterUsdc => 500 * 1_000_000,         // 500 USDC
            PoolTier::BasicUsdc => 1_000 * 1_000_000,         // 1,000 USDC
            PoolTier::ProSol => 100 * 1_000_000_000,          // 100 SOL
            PoolTier::ProUsdc => 10_000 * 1_000_000,          // 10,000 USDC
            PoolTier::EliteSol => 500 * 1_000_000_000,        // 500 SOL
            PoolTier::EliteUsdc => 50_000 * 1_000_000,        // 50,000 USDC
        }
    }

    /// Get the minimum Brier score required (scaled by 1000)
    /// E.g., 0.35 = 350
    pub fn max_brier_score(&self) -> u64 {
        match self {
            PoolTier::StarterSol | PoolTier::StarterUsdc => 350, // 0.35
            PoolTier::BasicSol | PoolTier::BasicUsdc => 300,     // 0.30
            PoolTier::ProSol | PoolTier::ProUsdc => 250,         // 0.25
            PoolTier::EliteSol | PoolTier::EliteUsdc => 200,     // 0.20
        }
    }

    /// Get the minimum number of resolved predictions required
    pub fn min_predictions(&self) -> u32 {
        match self {
            PoolTier::StarterSol | PoolTier::StarterUsdc => 10,
            PoolTier::BasicSol | PoolTier::BasicUsdc => 25,
            PoolTier::ProSol | PoolTier::ProUsdc => 100,
            PoolTier::EliteSol | PoolTier::EliteUsdc => 250,
        }
    }

    /// Check if this is a SOL pool
    pub fn is_sol(&self) -> bool {
        matches!(
            self,
            PoolTier::StarterSol | PoolTier::BasicSol | PoolTier::ProSol | PoolTier::EliteSol
        )
    }

    /// Check if this is a USDC pool
    pub fn is_usdc(&self) -> bool {
        !self.is_sol()
    }

    /// Check if this is a pro-tier pool
    pub fn is_pro(&self) -> bool {
        matches!(
            self,
            PoolTier::ProSol | PoolTier::ProUsdc | PoolTier::EliteSol | PoolTier::EliteUsdc
        )
    }

    /// Get minimum deposit (1% of capacity)
    pub fn min_deposit(&self) -> u64 {
        self.capacity() / 100
    }
}

impl Default for PoolTier {
    fn default() -> Self {
        PoolTier::StarterSol
    }
}

/// Forecaster Pool Status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum ForecastPoolStatus {
    /// Pool is active and accepting stakes
    Active = 0,
    /// Pool is temporarily paused
    Paused = 1,
    /// Pool is closed, withdrawals only
    Closed = 2,
}

impl Default for ForecastPoolStatus {
    fn default() -> Self {
        ForecastPoolStatus::Active
    }
}

/// Revenue split configuration (basis points)
/// Total must equal 10000 (100%)
///
/// Default split: 50% Forecaster / 30% Delegators / 20% Platform
/// - Forecasters provide skill and manage capital
/// - Delegators provide capital and bear risk
/// - Platform provides infrastructure and takes a fee
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct RevenueSplit {
    /// Forecaster share (default: 5000 = 50%) - skill reward
    pub forecaster_bps: u16,
    /// Delegator share (default: 3000 = 30%) - capital provider yield
    pub delegator_bps: u16,
    /// Platform share (default: 2000 = 20%) - infrastructure fee
    pub platform_bps: u16,
}

impl Default for RevenueSplit {
    fn default() -> Self {
        Self {
            forecaster_bps: 5000, // 50%
            delegator_bps: 3000,  // 30%
            platform_bps: 2000,   // 20%
        }
    }
}

impl RevenueSplit {
    pub fn is_valid(&self) -> bool {
        self.forecaster_bps + self.delegator_bps + self.platform_bps == 10000
    }
}

/// Simplified Forecaster Pool Account
/// PDA: ["forecast_pool", forecaster.key(), tier]
#[account]
pub struct ForecastPool {
    // === Identity (66 bytes) ===
    /// PDA bump seed
    pub bump: u8,
    /// Pool owner/forecaster wallet
    pub forecaster: Pubkey,
    /// Pool tier (determines capacity and requirements)
    pub tier: PoolTier,

    // === Token Configuration (64 bytes) ===
    /// Token mint (SOL wrapped or USDC)
    pub token_mint: Pubkey,
    /// Pool vault for holding deposits
    pub vault: Pubkey,

    // === Pool State (64 bytes) ===
    /// Total value locked (in token base units)
    pub total_value: u64,
    /// Total shares outstanding
    pub total_shares: u64,
    /// Current share price (scaled 1e9, starts at 1.0)
    pub share_price: u64,
    /// Pool capacity (from tier)
    pub capacity: u64,
    /// Available liquidity (not in active predictions)
    pub available_liquidity: u64,

    // === Revenue Split (6 bytes) ===
    pub revenue_split: RevenueSplit,

    // === Statistics (40 bytes) ===
    /// Number of delegators
    pub delegator_count: u32,
    /// Total predictions made
    pub prediction_count: u32,
    /// Winning predictions
    pub wins_count: u32,
    /// Losing predictions
    pub losses_count: u32,
    /// Total profit distributed to forecaster
    pub forecaster_earnings: u64,
    /// Total profit distributed to platform
    pub platform_earnings: u64,

    // === Status (18 bytes) ===
    /// Pool status
    pub status: ForecastPoolStatus,
    /// Schema version
    pub version: u8,
    /// Creation timestamp
    pub created_at: i64,
    /// Last activity timestamp
    pub last_activity: i64,

    // === Reserved (32 bytes) ===
    pub _reserved: [u8; 32],
}

impl ForecastPool {
    pub const LEN: usize = 8  // discriminator
        + 1   // bump
        + 32  // forecaster
        + 1   // tier
        + 32  // token_mint
        + 32  // vault
        + 8   // total_value
        + 8   // total_shares
        + 8   // share_price
        + 8   // capacity
        + 8   // available_liquidity
        + 6   // revenue_split
        + 4   // delegator_count
        + 4   // prediction_count
        + 4   // wins_count
        + 4   // losses_count
        + 8   // forecaster_earnings
        + 8   // platform_earnings
        + 1   // status
        + 1   // version
        + 8   // created_at
        + 8   // last_activity
        + 32; // _reserved

    pub const VERSION: u8 = 1;

    /// Share price scale factor (1e9)
    pub const SHARE_DECIMALS: u64 = 1_000_000_000;

    /// Default share price (1.0)
    pub const DEFAULT_SHARE_PRICE: u64 = 1_000_000_000;

    /// 7 day lockup period
    pub const LOCKUP_PERIOD: i64 = 7 * 24 * 60 * 60;

    /// Withdrawal fee (50 bps = 0.5%)
    pub const WITHDRAWAL_FEE_BPS: u64 = 50;

    /// Early exit fee (200 bps = 2%)
    pub const EARLY_EXIT_FEE_BPS: u64 = 200;

    /// Max position size per prediction (20% of pool)
    pub const MAX_POSITION_PCT: u64 = 20;

    /// Min position size per prediction (1% of pool)
    pub const MIN_POSITION_PCT: u64 = 1;

    /// Pool creation fee (0.1 SOL in lamports)
    pub const CREATION_FEE: u64 = 100_000_000;

    /// Initialize a new forecast pool
    pub fn initialize(
        &mut self,
        bump: u8,
        forecaster: Pubkey,
        tier: PoolTier,
        token_mint: Pubkey,
        vault: Pubkey,
    ) -> Result<()> {
        let clock = Clock::get()?;

        self.bump = bump;
        self.forecaster = forecaster;
        self.tier = tier;
        self.token_mint = token_mint;
        self.vault = vault;

        self.total_value = 0;
        self.total_shares = 0;
        self.share_price = Self::DEFAULT_SHARE_PRICE;
        self.capacity = tier.capacity();
        self.available_liquidity = 0;

        self.revenue_split = RevenueSplit::default();

        self.delegator_count = 0;
        self.prediction_count = 0;
        self.wins_count = 0;
        self.losses_count = 0;
        self.forecaster_earnings = 0;
        self.platform_earnings = 0;

        self.status = ForecastPoolStatus::Active;
        self.version = Self::VERSION;
        self.created_at = clock.unix_timestamp;
        self.last_activity = clock.unix_timestamp;

        self._reserved = [0; 32];

        Ok(())
    }

    /// Calculate shares for a deposit amount
    pub fn calculate_shares(&self, amount: u64) -> u64 {
        if self.total_shares == 0 || self.total_value == 0 {
            // First deposit: 1:1 ratio
            amount
        } else {
            // shares = amount / share_price
            amount
                .checked_mul(Self::SHARE_DECIMALS)
                .unwrap()
                .checked_div(self.share_price)
                .unwrap()
        }
    }

    /// Calculate withdrawal amount for shares
    pub fn calculate_withdrawal(&self, shares: u64) -> u64 {
        // amount = shares * share_price / DECIMALS
        shares
            .checked_mul(self.share_price)
            .unwrap()
            .checked_div(Self::SHARE_DECIMALS)
            .unwrap()
    }

    /// Update share price based on new total value
    pub fn update_share_price(&mut self) {
        if self.total_shares > 0 {
            self.share_price = self.total_value
                .checked_mul(Self::SHARE_DECIMALS)
                .unwrap()
                .checked_div(self.total_shares)
                .unwrap();
        }
    }

    /// Distribute profits according to revenue split
    /// Returns (forecaster_share, delegator_share, platform_share)
    pub fn calculate_profit_distribution(&self, profit: u64) -> (u64, u64, u64) {
        let forecaster_share = profit
            .checked_mul(self.revenue_split.forecaster_bps as u64)
            .unwrap()
            .checked_div(10000)
            .unwrap();

        let delegator_share = profit
            .checked_mul(self.revenue_split.delegator_bps as u64)
            .unwrap()
            .checked_div(10000)
            .unwrap();

        let platform_share = profit
            .checked_mul(self.revenue_split.platform_bps as u64)
            .unwrap()
            .checked_div(10000)
            .unwrap();

        (forecaster_share, delegator_share, platform_share)
    }

    /// Check if pool is accepting deposits
    pub fn is_accepting_deposits(&self) -> bool {
        self.status == ForecastPoolStatus::Active && self.total_value < self.capacity
    }

    /// Get maximum position size for a prediction
    pub fn max_position_size(&self) -> u64 {
        self.total_value
            .checked_mul(Self::MAX_POSITION_PCT)
            .unwrap()
            .checked_div(100)
            .unwrap()
    }

    /// Get minimum position size for a prediction
    pub fn min_position_size(&self) -> u64 {
        self.total_value
            .checked_mul(Self::MIN_POSITION_PCT)
            .unwrap()
            .checked_div(100)
            .unwrap()
    }
}

/// Delegation Account - tracks a delegator's position in a pool
/// PDA: ["delegation", pool.key(), delegator.key()]
#[account]
pub struct Delegation {
    /// PDA bump seed
    pub bump: u8,
    /// Pool this delegation belongs to
    pub pool: Pubkey,
    /// Delegator wallet
    pub delegator: Pubkey,
    /// Number of shares owned
    pub shares: u64,
    /// Original deposit amount
    pub deposited_amount: u64,
    /// Deposit timestamp (for lockup)
    pub deposited_at: i64,
    /// Last claim timestamp
    pub last_claim_at: i64,
    /// Pending withdrawal amount (0 if none)
    pub pending_withdrawal: u64,
    /// Withdrawal request timestamp
    pub withdrawal_requested_at: i64,
    /// Reserved
    pub _reserved: [u8; 16],
}

impl Delegation {
    pub const LEN: usize = 8  // discriminator
        + 1   // bump
        + 32  // pool
        + 32  // delegator
        + 8   // shares
        + 8   // deposited_amount
        + 8   // deposited_at
        + 8   // last_claim_at
        + 8   // pending_withdrawal
        + 8   // withdrawal_requested_at
        + 16; // _reserved

    /// Check if lockup period has passed
    pub fn is_lockup_complete(&self) -> bool {
        let clock = Clock::get().unwrap();
        clock.unix_timestamp >= self.deposited_at + ForecastPool::LOCKUP_PERIOD
    }

    /// Calculate withdrawal fee
    pub fn calculate_withdrawal_fee(&self, amount: u64) -> u64 {
        let fee_bps = if self.is_lockup_complete() {
            ForecastPool::WITHDRAWAL_FEE_BPS
        } else {
            ForecastPool::EARLY_EXIT_FEE_BPS
        };

        amount
            .checked_mul(fee_bps)
            .unwrap()
            .checked_div(10000)
            .unwrap()
    }
}

/// Pool Prediction Account - tracks a prediction made using pool capital
/// PDA: ["pool_prediction", pool.key(), prediction_index]
#[account]
pub struct PoolPrediction {
    /// PDA bump seed
    pub bump: u8,
    /// Pool this prediction belongs to
    pub pool: Pubkey,
    /// External market identifier (hash of platform + market_id)
    pub market_id: [u8; 32],
    /// Platform identifier (0: Polymarket, 1: Kalshi, 2: Jupiter, etc.)
    pub platform: u8,
    /// Position side (0: NO, 1: YES)
    pub side: u8,
    /// Amount staked from pool
    pub amount: u64,
    /// Entry price (scaled 1e6, e.g., 0.55 = 550000)
    pub entry_price: u64,
    /// Exit price (set when resolved)
    pub exit_price: u64,
    /// Profit/loss (signed, set when resolved)
    pub pnl: i64,
    /// Status (0: Open, 1: Won, 2: Lost, 3: Cancelled)
    pub status: u8,
    /// Opened timestamp
    pub opened_at: i64,
    /// Closed timestamp
    pub closed_at: i64,
    /// Reserved
    pub _reserved: [u8; 16],
}

impl PoolPrediction {
    pub const LEN: usize = 8  // discriminator
        + 1   // bump
        + 32  // pool
        + 32  // market_id
        + 1   // platform
        + 1   // side
        + 8   // amount
        + 8   // entry_price
        + 8   // exit_price
        + 8   // pnl
        + 1   // status
        + 8   // opened_at
        + 8   // closed_at
        + 16; // _reserved

    pub const STATUS_OPEN: u8 = 0;
    pub const STATUS_WON: u8 = 1;
    pub const STATUS_LOST: u8 = 2;
    pub const STATUS_CANCELLED: u8 = 3;

    pub const SIDE_NO: u8 = 0;
    pub const SIDE_YES: u8 = 1;

    pub const PLATFORM_POLYMARKET: u8 = 0;
    pub const PLATFORM_KALSHI: u8 = 1;
    pub const PLATFORM_JUPITER: u8 = 2;
    pub const PLATFORM_MANIFOLD: u8 = 3;
    pub const PLATFORM_LIMITLESS: u8 = 4;
}

/// Platform Treasury Account - collects platform fees
/// PDA: ["platform_treasury"]
#[account]
pub struct PlatformTreasury {
    /// PDA bump seed
    pub bump: u8,
    /// Admin authority
    pub admin: Pubkey,
    /// Total SOL collected
    pub total_sol_collected: u64,
    /// Total USDC collected
    pub total_usdc_collected: u64,
    /// Reserved
    pub _reserved: [u8; 32],
}

impl PlatformTreasury {
    pub const LEN: usize = 8 + 1 + 32 + 8 + 8 + 32;
}
