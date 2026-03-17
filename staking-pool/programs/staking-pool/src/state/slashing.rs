use anchor_lang::prelude::*;

/// Where slashed funds are sent
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum SlashDestination {
    /// Protocol treasury
    Treasury = 0,
    /// Distributed to depositors
    Depositors = 1,
    /// Insurance fund
    Insurance = 2,
}

impl Default for SlashDestination {
    fn default() -> Self {
        SlashDestination::Treasury
    }
}

/// Slashing configuration and state for forecasters with poor calibration
/// PDA: ["slashing_state", pool.key()]
/// Size: 8 (discriminator) + 96 = 104 bytes
#[account]
pub struct SlashingState {
    /// PDA bump seed
    pub bump: u8,
    /// Pool this slashing config applies to
    pub pool: Pubkey,

    // === Thresholds ===
    /// Brier score threshold (scaled 1e9, e.g., 0.30 = 300_000_000)
    pub brier_threshold: u64,
    /// How many consecutive periods of poor calibration before slash
    pub consecutive_failures_required: u8,
    /// Current consecutive failure count
    pub current_consecutive_failures: u8,

    // === Slashing Parameters ===
    /// Percentage of forecaster stake to slash (basis points)
    pub slash_bps: u16,
    /// Where slashed funds go
    pub slash_destination: SlashDestination,

    // === State ===
    /// Last calibration check timestamp
    pub last_check_ts: i64,
    /// Check interval (seconds between checks)
    pub check_interval: i64,
    /// Total amount slashed lifetime
    pub total_slashed: u64,
    /// Number of slash events
    pub slash_events: u32,

    // === Reserved ===
    pub _reserved: [u8; 24],
}

impl SlashingState {
    pub const LEN: usize = 8  // discriminator
        + 1   // bump
        + 32  // pool
        + 8   // brier_threshold
        + 1   // consecutive_failures_required
        + 1   // current_consecutive_failures
        + 2   // slash_bps
        + 1   // slash_destination
        + 8   // last_check_ts
        + 8   // check_interval
        + 8   // total_slashed
        + 4   // slash_events
        + 24; // _reserved

    /// Default Brier threshold: 0.30 (scaled by 1e9)
    pub const DEFAULT_BRIER_THRESHOLD: u64 = 300_000_000;

    /// Default consecutive failures before slash: 3
    pub const DEFAULT_CONSECUTIVE_FAILURES: u8 = 3;

    /// Default slash percentage: 10%
    pub const DEFAULT_SLASH_BPS: u16 = 1000;

    /// Default check interval: 7 days
    pub const DEFAULT_CHECK_INTERVAL: i64 = 7 * 24 * 60 * 60;

    /// Initialize slashing state with defaults
    pub fn initialize(
        &mut self,
        bump: u8,
        pool: Pubkey,
        config: Option<SlashingConfig>,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let cfg = config.unwrap_or_default();

        self.bump = bump;
        self.pool = pool;
        self.brier_threshold = cfg.brier_threshold;
        self.consecutive_failures_required = cfg.consecutive_failures_required;
        self.current_consecutive_failures = 0;
        self.slash_bps = cfg.slash_bps;
        self.slash_destination = cfg.slash_destination;
        self.last_check_ts = clock.unix_timestamp;
        self.check_interval = cfg.check_interval;
        self.total_slashed = 0;
        self.slash_events = 0;
        self._reserved = [0; 24];

        Ok(())
    }

    /// Check if calibration check is due
    pub fn is_check_due(&self) -> bool {
        let clock = Clock::get().unwrap();
        clock.unix_timestamp >= self.last_check_ts + self.check_interval
    }

    /// Record a calibration check result
    /// Returns true if slashing should be triggered
    pub fn record_check(&mut self, brier_score_scaled: u64) -> Result<bool> {
        let clock = Clock::get()?;
        self.last_check_ts = clock.unix_timestamp;

        if brier_score_scaled > self.brier_threshold {
            // Poor calibration - increment failure counter
            self.current_consecutive_failures = self.current_consecutive_failures
                .checked_add(1)
                .unwrap();

            if self.current_consecutive_failures >= self.consecutive_failures_required {
                // Trigger slash
                return Ok(true);
            }
        } else {
            // Good calibration - reset failure counter
            self.current_consecutive_failures = 0;
        }

        Ok(false)
    }

    /// Execute a slash
    pub fn execute_slash(&mut self, slash_amount: u64) -> Result<()> {
        self.total_slashed = self.total_slashed
            .checked_add(slash_amount)
            .unwrap();
        self.slash_events = self.slash_events
            .checked_add(1)
            .unwrap();

        // Reset failure counter after slash
        self.current_consecutive_failures = 0;

        Ok(())
    }

    /// Calculate slash amount based on total deposits
    pub fn calculate_slash_amount(&self, total_deposits: u64) -> u64 {
        total_deposits
            .checked_mul(self.slash_bps as u64)
            .unwrap()
            .checked_div(10000)
            .unwrap()
    }
}

/// Configuration for initializing slashing state
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SlashingConfig {
    pub brier_threshold: u64,
    pub consecutive_failures_required: u8,
    pub slash_bps: u16,
    pub slash_destination: SlashDestination,
    pub check_interval: i64,
}

impl Default for SlashingConfig {
    fn default() -> Self {
        Self {
            brier_threshold: SlashingState::DEFAULT_BRIER_THRESHOLD,
            consecutive_failures_required: SlashingState::DEFAULT_CONSECUTIVE_FAILURES,
            slash_bps: SlashingState::DEFAULT_SLASH_BPS,
            slash_destination: SlashDestination::Treasury,
            check_interval: SlashingState::DEFAULT_CHECK_INTERVAL,
        }
    }
}
