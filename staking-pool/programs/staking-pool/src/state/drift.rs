use anchor_lang::prelude::*;

use crate::errors::StakingPoolError;

/// Position side (direction of the trade)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum PositionSide {
    Long,
    Short,
}

impl Default for PositionSide {
    fn default() -> Self {
        Self::Long
    }
}

/// Status of a perp position
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum PerpPositionStatus {
    /// Position is open
    Open,
    /// Position has been closed
    Closed,
    /// Position was liquidated
    Liquidated,
}

impl Default for PerpPositionStatus {
    fn default() -> Self {
        Self::Open
    }
}

/// Configuration for Drift trading integration
#[account]
pub struct DriftTradingState {
    /// PDA bump
    pub bump: u8,

    /// The staking pool this config belongs to
    pub pool: Pubkey,

    /// Drift sub-account address
    pub drift_sub_account: Pubkey,

    /// Drift user account
    pub drift_user: Pubkey,

    /// Maximum leverage allowed (tier-based: 3x default, 5x Elite)
    pub max_leverage: u8,

    /// Maximum position size as BPS of pool capital
    pub max_position_size_bps: u16,

    /// Maximum number of concurrent positions
    pub max_positions: u8,

    /// Current number of open positions
    pub open_positions: u8,

    /// Total collateral deposited to Drift
    pub total_collateral: u64,

    /// Current unrealized P&L (can be negative)
    pub unrealized_pnl: i64,

    /// Total realized P&L since inception
    pub realized_pnl: i64,

    /// Maximum drawdown allowed (BPS)
    pub max_drawdown_bps: u16,

    /// Current drawdown from peak (BPS)
    pub current_drawdown_bps: u16,

    /// High water mark for drawdown calculation
    pub high_water_mark: u64,

    /// Whether trading is enabled
    pub is_active: bool,

    /// Minimum Brier score required to trade (scaled by 1000, e.g., 300 = 0.30)
    pub min_brier_score_threshold: u16,

    /// Timestamp when trading was initialized
    pub created_at: i64,

    /// Last update timestamp
    pub last_update: i64,

    /// Total number of trades executed
    pub total_trades: u32,

    /// Number of winning trades
    pub winning_trades: u32,

    /// Reserved space for future upgrades
    pub _reserved: [u8; 64],
}

impl DriftTradingState {
    /// Account size in bytes
    pub const LEN: usize = 8  // discriminator
        + 1   // bump
        + 32  // pool
        + 32  // drift_sub_account
        + 32  // drift_user
        + 1   // max_leverage
        + 2   // max_position_size_bps
        + 1   // max_positions
        + 1   // open_positions
        + 8   // total_collateral
        + 8   // unrealized_pnl (i64)
        + 8   // realized_pnl (i64)
        + 2   // max_drawdown_bps
        + 2   // current_drawdown_bps
        + 8   // high_water_mark
        + 1   // is_active
        + 2   // min_brier_score_threshold
        + 8   // created_at
        + 8   // last_update
        + 4   // total_trades
        + 4   // winning_trades
        + 64; // reserved

    /// Default max leverage (3x)
    pub const DEFAULT_MAX_LEVERAGE: u8 = 3;

    /// Elite tier max leverage (5x)
    pub const ELITE_MAX_LEVERAGE: u8 = 5;

    /// Default max position size (10% of capital)
    pub const DEFAULT_MAX_POSITION_SIZE_BPS: u16 = 1000;

    /// Default max drawdown (10%)
    pub const DEFAULT_MAX_DRAWDOWN_BPS: u16 = 1000;

    /// Default max positions
    pub const DEFAULT_MAX_POSITIONS: u8 = 5;

    /// Minimum Brier score for trading (0.30 = bad calibration)
    pub const DEFAULT_MIN_BRIER_THRESHOLD: u16 = 300;

    /// Initialize trading state
    #[allow(clippy::too_many_arguments)]
    pub fn initialize(
        &mut self,
        bump: u8,
        pool: Pubkey,
        drift_sub_account: Pubkey,
        drift_user: Pubkey,
        max_leverage: Option<u8>,
        max_position_size_bps: Option<u16>,
        max_drawdown_bps: Option<u16>,
    ) -> Result<()> {
        let clock = Clock::get()?;

        self.bump = bump;
        self.pool = pool;
        self.drift_sub_account = drift_sub_account;
        self.drift_user = drift_user;
        self.max_leverage = max_leverage.unwrap_or(Self::DEFAULT_MAX_LEVERAGE);
        self.max_position_size_bps = max_position_size_bps.unwrap_or(Self::DEFAULT_MAX_POSITION_SIZE_BPS);
        self.max_positions = Self::DEFAULT_MAX_POSITIONS;
        self.open_positions = 0;
        self.total_collateral = 0;
        self.unrealized_pnl = 0;
        self.realized_pnl = 0;
        self.max_drawdown_bps = max_drawdown_bps.unwrap_or(Self::DEFAULT_MAX_DRAWDOWN_BPS);
        self.current_drawdown_bps = 0;
        self.high_water_mark = 0;
        self.is_active = true;
        self.min_brier_score_threshold = Self::DEFAULT_MIN_BRIER_THRESHOLD;
        self.created_at = clock.unix_timestamp;
        self.last_update = clock.unix_timestamp;
        self.total_trades = 0;
        self.winning_trades = 0;
        self._reserved = [0u8; 64];

        Ok(())
    }

    /// Check if a new position can be opened
    pub fn can_open_position(&self) -> bool {
        self.is_active && self.open_positions < self.max_positions
    }

    /// Record new position opened
    pub fn open_position(&mut self) -> Result<()> {
        require!(
            self.open_positions < self.max_positions,
            StakingPoolError::DriftMaxPositionsReached
        );
        self.open_positions = self.open_positions.saturating_add(1);
        self.total_trades = self.total_trades.saturating_add(1);
        self.last_update = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Record position closed
    pub fn close_position(&mut self, pnl: i64, is_win: bool) -> Result<()> {
        self.open_positions = self.open_positions.saturating_sub(1);
        self.realized_pnl = self.realized_pnl.saturating_add(pnl);

        if is_win {
            self.winning_trades = self.winning_trades.saturating_add(1);
        }

        // Update high water mark and drawdown
        let current_value = (self.total_collateral as i64)
            .saturating_add(self.realized_pnl)
            .saturating_add(self.unrealized_pnl);

        if current_value > self.high_water_mark as i64 {
            self.high_water_mark = current_value as u64;
            self.current_drawdown_bps = 0;
        } else if self.high_water_mark > 0 {
            let drawdown = self.high_water_mark as i64 - current_value;
            self.current_drawdown_bps =
                ((drawdown as u64 * 10000) / self.high_water_mark) as u16;
        }

        self.last_update = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Deposit collateral
    pub fn deposit_collateral(&mut self, amount: u64) -> Result<()> {
        self.total_collateral = self
            .total_collateral
            .checked_add(amount)
            .ok_or(StakingPoolError::Overflow)?;
        self.last_update = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Withdraw collateral
    pub fn withdraw_collateral(&mut self, amount: u64) -> Result<()> {
        require!(
            amount <= self.total_collateral,
            StakingPoolError::DriftInsufficientCollateral
        );
        self.total_collateral = self.total_collateral.saturating_sub(amount);
        self.last_update = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Update unrealized P&L
    pub fn update_unrealized_pnl(&mut self, pnl: i64) -> Result<()> {
        self.unrealized_pnl = pnl;
        self.last_update = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Check if drawdown limit exceeded
    pub fn is_drawdown_exceeded(&self) -> bool {
        self.current_drawdown_bps > self.max_drawdown_bps
    }

    /// Calculate win rate (scaled by 10000)
    pub fn win_rate_bps(&self) -> u16 {
        if self.total_trades == 0 {
            return 0;
        }
        ((self.winning_trades as u64 * 10000) / self.total_trades as u64) as u16
    }

    /// Calculate position size based on forecaster metrics
    ///
    /// Size = base_size * brier_weight * confidence_weight
    /// - brier_weight: 1.0 - (brier_score / 0.5) -> better calibration = more size
    /// - confidence_weight: |probability - 0.5| * 2 -> higher conviction = more size
    pub fn calculate_position_size(
        &self,
        pool_capital: u64,
        forecaster_brier: u64, // Scaled by 1000 (e.g., 200 = 0.20)
        prediction_probability: u64, // Scaled by 1000 (e.g., 750 = 75%)
    ) -> u64 {
        // Max size based on pool allocation
        let max_size = pool_capital
            .checked_mul(self.max_position_size_bps as u64)
            .unwrap_or(0)
            .checked_div(10000)
            .unwrap_or(0);

        // Brier weight: better calibration (lower Brier) = higher weight
        // Scale: 0.50 Brier = 0 weight, 0.00 Brier = 1.0 weight
        let brier_weight = if forecaster_brier >= 500 {
            0u64
        } else {
            (500 - forecaster_brier) * 2 // 0-1000 scaled
        };

        // Confidence weight: distance from 50%
        let confidence = if prediction_probability > 500 {
            prediction_probability - 500
        } else {
            500 - prediction_probability
        };
        let confidence_weight = confidence * 2; // 0-1000 scaled

        // Final size = max_size * (brier_weight / 1000) * (confidence_weight / 1000)
        max_size
            .checked_mul(brier_weight)
            .unwrap_or(0)
            .checked_div(1000)
            .unwrap_or(0)
            .checked_mul(confidence_weight)
            .unwrap_or(0)
            .checked_div(1000)
            .unwrap_or(0)
    }
}

/// Record of an individual perp position
#[account]
pub struct PerpPositionRecord {
    /// PDA bump
    pub bump: u8,

    /// Trading state this position belongs to
    pub trading_state: Pubkey,

    /// Pool this position is for
    pub pool: Pubkey,

    /// Drift market index (e.g., SOL-PERP = 0, BTC-PERP = 1)
    pub market_index: u16,

    /// Position direction
    pub side: PositionSide,

    /// Entry price (scaled by 1e6)
    pub entry_price: u64,

    /// Position size in base units
    pub size: u64,

    /// Leverage used
    pub leverage: u8,

    /// Prediction ID this position is based on (hash of prediction)
    pub prediction_id: [u8; 32],

    /// Prediction probability (scaled by 1000)
    pub prediction_probability: u16,

    /// Forecaster Brier score at time of trade (scaled by 1000)
    pub forecaster_brier: u16,

    /// Stop loss price (optional)
    pub stop_loss_price: Option<u64>,

    /// Take profit price (optional)
    pub take_profit_price: Option<u64>,

    /// Liquidation price
    pub liquidation_price: u64,

    /// Current unrealized P&L
    pub unrealized_pnl: i64,

    /// Position status
    pub status: PerpPositionStatus,

    /// Position index
    pub position_index: u8,

    /// Timestamp when position was opened
    pub opened_at: i64,

    /// Timestamp when position was closed (0 if still open)
    pub closed_at: i64,

    /// Exit price (0 if still open)
    pub exit_price: u64,

    /// Realized P&L (0 if still open)
    pub realized_pnl: i64,

    /// Reserved space
    pub _reserved: [u8; 32],
}

impl PerpPositionRecord {
    /// Account size in bytes
    pub const LEN: usize = 8  // discriminator
        + 1   // bump
        + 32  // trading_state
        + 32  // pool
        + 2   // market_index
        + 1   // side
        + 8   // entry_price
        + 8   // size
        + 1   // leverage
        + 32  // prediction_id
        + 2   // prediction_probability
        + 2   // forecaster_brier
        + 9   // stop_loss_price (Option<u64>)
        + 9   // take_profit_price (Option<u64>)
        + 8   // liquidation_price
        + 8   // unrealized_pnl (i64)
        + 1   // status
        + 1   // position_index
        + 8   // opened_at
        + 8   // closed_at
        + 8   // exit_price
        + 8   // realized_pnl (i64)
        + 32; // reserved

    /// Price scale factor
    pub const PRICE_SCALE: u64 = 1_000_000;

    /// Initialize a new position record
    #[allow(clippy::too_many_arguments)]
    pub fn initialize(
        &mut self,
        bump: u8,
        trading_state: Pubkey,
        pool: Pubkey,
        market_index: u16,
        side: PositionSide,
        entry_price: u64,
        size: u64,
        leverage: u8,
        prediction_id: [u8; 32],
        prediction_probability: u16,
        forecaster_brier: u16,
        liquidation_price: u64,
        position_index: u8,
    ) -> Result<()> {
        let clock = Clock::get()?;

        self.bump = bump;
        self.trading_state = trading_state;
        self.pool = pool;
        self.market_index = market_index;
        self.side = side;
        self.entry_price = entry_price;
        self.size = size;
        self.leverage = leverage;
        self.prediction_id = prediction_id;
        self.prediction_probability = prediction_probability;
        self.forecaster_brier = forecaster_brier;
        self.stop_loss_price = None;
        self.take_profit_price = None;
        self.liquidation_price = liquidation_price;
        self.unrealized_pnl = 0;
        self.status = PerpPositionStatus::Open;
        self.position_index = position_index;
        self.opened_at = clock.unix_timestamp;
        self.closed_at = 0;
        self.exit_price = 0;
        self.realized_pnl = 0;
        self._reserved = [0u8; 32];

        Ok(())
    }

    /// Set stop loss and take profit
    pub fn set_orders(
        &mut self,
        stop_loss: Option<u64>,
        take_profit: Option<u64>,
    ) -> Result<()> {
        self.stop_loss_price = stop_loss;
        self.take_profit_price = take_profit;
        Ok(())
    }

    /// Update unrealized P&L
    pub fn update_pnl(&mut self, current_price: u64) -> Result<()> {
        let price_diff = if self.side == PositionSide::Long {
            current_price as i64 - self.entry_price as i64
        } else {
            self.entry_price as i64 - current_price as i64
        };

        // P&L = (price_diff / entry_price) * size * leverage
        self.unrealized_pnl = price_diff
            .checked_mul(self.size as i64)
            .unwrap_or(0)
            .checked_mul(self.leverage as i64)
            .unwrap_or(0)
            .checked_div(Self::PRICE_SCALE as i64)
            .unwrap_or(0);

        Ok(())
    }

    /// Close the position
    pub fn close_position(&mut self, exit_price: u64, status: PerpPositionStatus) -> Result<()> {
        let clock = Clock::get()?;

        // Calculate final P&L
        self.update_pnl(exit_price)?;
        self.realized_pnl = self.unrealized_pnl;
        self.unrealized_pnl = 0;

        self.exit_price = exit_price;
        self.status = status;
        self.closed_at = clock.unix_timestamp;

        Ok(())
    }

    /// Check if stop loss should trigger
    pub fn should_stop_loss(&self, current_price: u64) -> bool {
        if let Some(stop_loss) = self.stop_loss_price {
            match self.side {
                PositionSide::Long => current_price <= stop_loss,
                PositionSide::Short => current_price >= stop_loss,
            }
        } else {
            false
        }
    }

    /// Check if take profit should trigger
    pub fn should_take_profit(&self, current_price: u64) -> bool {
        if let Some(take_profit) = self.take_profit_price {
            match self.side {
                PositionSide::Long => current_price >= take_profit,
                PositionSide::Short => current_price <= take_profit,
            }
        } else {
            false
        }
    }

    /// Check if position should be liquidated
    pub fn should_liquidate(&self, current_price: u64) -> bool {
        match self.side {
            PositionSide::Long => current_price <= self.liquidation_price,
            PositionSide::Short => current_price >= self.liquidation_price,
        }
    }

    /// Calculate margin ratio (scaled by 10000)
    pub fn margin_ratio(&self, current_price: u64) -> u16 {
        let equity = (self.size as i64)
            .checked_mul(self.leverage as i64)
            .unwrap_or(0)
            .saturating_add(self.unrealized_pnl);

        let notional = (self.size as u64)
            .checked_mul(current_price)
            .unwrap_or(0)
            .checked_div(Self::PRICE_SCALE)
            .unwrap_or(0);

        if notional == 0 {
            return 10000;
        }

        ((equity as u64 * 10000) / notional) as u16
    }
}
