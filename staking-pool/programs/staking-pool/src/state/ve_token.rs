use anchor_lang::prelude::*;

/// Vote-escrowed bRight (veBRIGHT) position for governance and boosted rewards
/// PDA: ["ve_token", user.key()]
/// Size: 8 (discriminator) + 176 = 184 bytes
#[account]
pub struct VeTokenState {
    // === Identity (65 bytes) ===
    /// PDA bump seed
    pub bump: u8,
    /// Token owner
    pub owner: Pubkey,
    /// veBRIGHT mint (for tracking)
    pub ve_mint: Pubkey,

    // === Lock Details (32 bytes) ===
    /// bRight tokens locked
    pub locked_amount: u64,
    /// Lock start timestamp
    pub lock_start: i64,
    /// Lock end timestamp (max 4 years)
    pub lock_end: i64,
    /// Current voting power (decays linearly)
    pub voting_power: u64,

    // === Boost Mechanics (16 bytes) ===
    /// Boost multiplier (10000 = 1x, max 25000 = 2.5x)
    pub boost_multiplier: u16,
    /// Trading fee discount basis points
    pub fee_discount_bps: u16,
    /// Reserved for boost expansion
    pub _boost_reserved: [u8; 12],

    // === Governance (48 bytes) ===
    /// Last vote timestamp
    pub last_vote_ts: i64,
    /// Total votes cast
    pub votes_cast: u32,
    /// Proposals created
    pub proposals_created: u32,
    /// Delegation target (self if not delegated)
    pub delegated_to: Pubkey,

    // === Reserved (16 bytes) ===
    pub _reserved: [u8; 16],
}

impl VeTokenState {
    pub const LEN: usize = 8  // discriminator
        + 1   // bump
        + 32  // owner
        + 32  // ve_mint
        + 8   // locked_amount
        + 8   // lock_start
        + 8   // lock_end
        + 8   // voting_power
        + 2   // boost_multiplier
        + 2   // fee_discount_bps
        + 12  // _boost_reserved
        + 8   // last_vote_ts
        + 4   // votes_cast
        + 4   // proposals_created
        + 32  // delegated_to
        + 16; // _reserved

    /// Maximum lock duration: 4 years in seconds
    pub const MAX_LOCK_DURATION: i64 = 4 * 365 * 24 * 60 * 60;

    /// Minimum lock duration: 1 week
    pub const MIN_LOCK_DURATION: i64 = 7 * 24 * 60 * 60;

    /// Base boost multiplier (1x = 10000)
    pub const BASE_BOOST: u16 = 10000;

    /// Maximum boost multiplier (2.5x = 25000)
    pub const MAX_BOOST: u16 = 25000;

    /// Maximum fee discount (50% = 5000 bps)
    pub const MAX_FEE_DISCOUNT: u16 = 5000;

    /// Initialize new ve token position
    pub fn initialize(
        &mut self,
        bump: u8,
        owner: Pubkey,
        ve_mint: Pubkey,
        locked_amount: u64,
        lock_duration: i64,
    ) -> Result<()> {
        let clock = Clock::get()?;

        self.bump = bump;
        self.owner = owner;
        self.ve_mint = ve_mint;
        self.locked_amount = locked_amount;
        self.lock_start = clock.unix_timestamp;
        self.lock_end = clock.unix_timestamp
            .checked_add(lock_duration)
            .unwrap();

        // Calculate initial voting power
        self.voting_power = Self::calculate_voting_power(
            locked_amount,
            self.lock_end,
            clock.unix_timestamp,
        );

        // Calculate boost based on lock duration
        self.boost_multiplier = Self::calculate_boost_multiplier(lock_duration);
        self.fee_discount_bps = Self::calculate_fee_discount(lock_duration);
        self._boost_reserved = [0; 12];

        self.last_vote_ts = 0;
        self.votes_cast = 0;
        self.proposals_created = 0;
        self.delegated_to = owner; // Self-delegated by default

        self._reserved = [0; 16];

        Ok(())
    }

    /// Calculate voting power (decays linearly from locked_amount to 0)
    pub fn calculate_voting_power(
        locked_amount: u64,
        lock_end: i64,
        current_time: i64,
    ) -> u64 {
        let remaining = (lock_end - current_time).max(0) as u64;
        let max_duration = Self::MAX_LOCK_DURATION as u64;

        // voting_power = locked_amount * remaining_duration / max_duration
        locked_amount
            .checked_mul(remaining)
            .unwrap_or(0)
            .checked_div(max_duration)
            .unwrap_or(0)
    }

    /// Calculate boost multiplier based on lock duration
    /// Scales linearly from 1x (min lock) to 2.5x (max lock)
    pub fn calculate_boost_multiplier(lock_duration: i64) -> u16 {
        let duration_ratio = (lock_duration as u64)
            .checked_mul(10000)
            .unwrap_or(0)
            .checked_div(Self::MAX_LOCK_DURATION as u64)
            .unwrap_or(0);

        // boost = 1x + (1.5x * duration_ratio)
        // boost = 10000 + (15000 * ratio / 10000)
        let additional_boost = (15000u64)
            .checked_mul(duration_ratio)
            .unwrap_or(0)
            .checked_div(10000)
            .unwrap_or(0);

        (Self::BASE_BOOST as u64 + additional_boost)
            .min(Self::MAX_BOOST as u64) as u16
    }

    /// Calculate fee discount based on lock duration
    /// Scales linearly from 0% (min lock) to 50% (max lock)
    pub fn calculate_fee_discount(lock_duration: i64) -> u16 {
        let duration_ratio = (lock_duration as u64)
            .checked_mul(10000)
            .unwrap_or(0)
            .checked_div(Self::MAX_LOCK_DURATION as u64)
            .unwrap_or(0);

        // discount = 50% * duration_ratio
        ((Self::MAX_FEE_DISCOUNT as u64)
            .checked_mul(duration_ratio)
            .unwrap_or(0)
            .checked_div(10000)
            .unwrap_or(0)) as u16
    }

    /// Update voting power (call periodically as time passes)
    pub fn refresh_voting_power(&mut self) -> Result<()> {
        let clock = Clock::get()?;
        self.voting_power = Self::calculate_voting_power(
            self.locked_amount,
            self.lock_end,
            clock.unix_timestamp,
        );
        Ok(())
    }

    /// Check if lock has expired
    pub fn is_expired(&self) -> bool {
        let clock = Clock::get().unwrap();
        clock.unix_timestamp >= self.lock_end
    }

    /// Extend lock duration (can only extend, not shorten)
    pub fn extend_lock(&mut self, new_lock_end: i64) -> Result<()> {
        require!(new_lock_end > self.lock_end, VeTokenError::InvalidLockExtension);

        let clock = Clock::get()?;
        let new_duration = new_lock_end - clock.unix_timestamp;

        require!(
            new_duration <= Self::MAX_LOCK_DURATION,
            VeTokenError::LockDurationTooLong
        );

        self.lock_end = new_lock_end;
        self.voting_power = Self::calculate_voting_power(
            self.locked_amount,
            self.lock_end,
            clock.unix_timestamp,
        );
        self.boost_multiplier = Self::calculate_boost_multiplier(new_duration);
        self.fee_discount_bps = Self::calculate_fee_discount(new_duration);

        Ok(())
    }

    /// Add more tokens to existing lock (keeps same unlock time)
    pub fn increase_lock_amount(&mut self, additional_amount: u64) -> Result<()> {
        let clock = Clock::get()?;

        self.locked_amount = self.locked_amount
            .checked_add(additional_amount)
            .unwrap();

        self.voting_power = Self::calculate_voting_power(
            self.locked_amount,
            self.lock_end,
            clock.unix_timestamp,
        );

        Ok(())
    }

    /// Delegate voting power to another address
    pub fn delegate(&mut self, delegate_to: Pubkey) {
        self.delegated_to = delegate_to;
    }

    /// Remove delegation (self-delegate)
    pub fn undelegate(&mut self) {
        self.delegated_to = self.owner;
    }
}

/// veToken specific errors
#[error_code]
pub enum VeTokenError {
    #[msg("Lock duration too short")]
    LockDurationTooShort,

    #[msg("Lock duration too long")]
    LockDurationTooLong,

    #[msg("Cannot shorten lock, only extend")]
    InvalidLockExtension,

    #[msg("Lock has not expired yet")]
    LockNotExpired,

    #[msg("Lock has already expired")]
    LockExpired,
}
