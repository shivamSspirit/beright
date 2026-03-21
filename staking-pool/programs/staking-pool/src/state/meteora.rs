use anchor_lang::prelude::*;

/// Meteora Dynamic Vault integration state for a staking pool
///
/// Tracks the pool's position in a Meteora vault, including LP token
/// balance and yield accrual. Enables trustless on-chain yield routing.
///
/// PDA: ["meteora_vault_state", pool.key()]
#[account]
pub struct MeteoraVaultState {
    /// PDA bump seed
    pub bump: u8,

    /// Parent staking pool this belongs to
    pub pool: Pubkey,

    /// Meteora vault address (the dynamic vault we deposit into)
    pub vault: Pubkey,

    /// LP token mint for this vault
    pub vault_lp_mint: Pubkey,

    /// Token mint we're depositing (USDC, SOL, etc.)
    pub underlying_mint: Pubkey,

    // === Balances ===

    /// Total underlying tokens deposited (before yield)
    pub deposited_amount: u64,

    /// LP tokens currently held
    pub lp_token_balance: u64,

    /// Last recorded virtual price (LP -> underlying rate, scaled 1e9)
    /// Value > 1e9 indicates accumulated yield
    pub last_virtual_price: u64,

    // === Yield Tracking ===

    /// Total yield earned (in underlying token units)
    pub total_yield_earned: u64,

    /// Last time yield was harvested
    pub last_harvest_ts: i64,

    // === Configuration ===

    /// Allocation in basis points (% of idle capital routed here)
    /// e.g., 5000 = 50%
    pub allocation_bps: u16,

    /// Minimum deposit amount to prevent dust
    pub min_deposit: u64,

    // === Status ===

    /// Whether this integration is active
    pub is_active: bool,

    /// Timestamp when initialized
    pub created_at: i64,

    /// Last state update timestamp
    pub last_update: i64,

    /// Reserved for future use
    pub _reserved: [u8; 32],
}

impl MeteoraVaultState {
    /// Account size for space allocation
    pub const LEN: usize = 8  // discriminator
        + 1   // bump
        + 32  // pool
        + 32  // vault
        + 32  // vault_lp_mint
        + 32  // underlying_mint
        + 8   // deposited_amount
        + 8   // lp_token_balance
        + 8   // last_virtual_price
        + 8   // total_yield_earned
        + 8   // last_harvest_ts
        + 2   // allocation_bps
        + 8   // min_deposit
        + 1   // is_active
        + 8   // created_at
        + 8   // last_update
        + 32; // _reserved

    /// Virtual price scale factor (9 decimals)
    pub const VIRTUAL_PRICE_DECIMALS: u64 = 1_000_000_000;

    /// Default virtual price (1.0)
    pub const DEFAULT_VIRTUAL_PRICE: u64 = 1_000_000_000;

    /// Maximum allocation (100%)
    pub const MAX_ALLOCATION_BPS: u16 = 10_000;

    /// Initialize the Meteora vault state
    pub fn initialize(
        &mut self,
        bump: u8,
        pool: Pubkey,
        vault: Pubkey,
        vault_lp_mint: Pubkey,
        underlying_mint: Pubkey,
        allocation_bps: u16,
        min_deposit: u64,
    ) -> Result<()> {
        let clock = Clock::get()?;

        self.bump = bump;
        self.pool = pool;
        self.vault = vault;
        self.vault_lp_mint = vault_lp_mint;
        self.underlying_mint = underlying_mint;

        self.deposited_amount = 0;
        self.lp_token_balance = 0;
        self.last_virtual_price = Self::DEFAULT_VIRTUAL_PRICE;

        self.total_yield_earned = 0;
        self.last_harvest_ts = clock.unix_timestamp;

        self.allocation_bps = allocation_bps;
        self.min_deposit = min_deposit;

        self.is_active = true;
        self.created_at = clock.unix_timestamp;
        self.last_update = clock.unix_timestamp;

        self._reserved = [0; 32];

        Ok(())
    }

    /// Calculate current value of LP tokens in underlying
    /// Returns the estimated underlying value based on current virtual price
    pub fn calculate_underlying_value(&self, current_virtual_price: u64) -> u64 {
        if current_virtual_price == 0 {
            return 0;
        }

        // underlying = lp_tokens * virtual_price / DECIMALS
        self.lp_token_balance
            .checked_mul(current_virtual_price)
            .unwrap_or(0)
            .checked_div(Self::VIRTUAL_PRICE_DECIMALS)
            .unwrap_or(0)
    }

    /// Calculate yield earned since last harvest
    pub fn calculate_pending_yield(&self, current_virtual_price: u64) -> u64 {
        let current_value = self.calculate_underlying_value(current_virtual_price);

        // Yield = current_value - deposited_amount (if positive)
        if current_value > self.deposited_amount {
            current_value.saturating_sub(self.deposited_amount)
        } else {
            0
        }
    }

    /// Record a deposit
    pub fn record_deposit(
        &mut self,
        underlying_amount: u64,
        lp_tokens_received: u64,
        virtual_price: u64,
    ) -> Result<()> {
        let clock = Clock::get()?;

        self.deposited_amount = self.deposited_amount
            .checked_add(underlying_amount)
            .ok_or(ProgramError::ArithmeticOverflow)?;

        self.lp_token_balance = self.lp_token_balance
            .checked_add(lp_tokens_received)
            .ok_or(ProgramError::ArithmeticOverflow)?;

        self.last_virtual_price = virtual_price;
        self.last_update = clock.unix_timestamp;

        Ok(())
    }

    /// Record a withdrawal
    pub fn record_withdrawal(
        &mut self,
        underlying_received: u64,
        lp_tokens_burned: u64,
        yield_realized: u64,
        virtual_price: u64,
    ) -> Result<()> {
        let clock = Clock::get()?;

        // Calculate proportional deposit to reduce
        let deposit_reduction = if self.lp_token_balance > 0 {
            self.deposited_amount
                .checked_mul(lp_tokens_burned)
                .unwrap_or(0)
                .checked_div(self.lp_token_balance)
                .unwrap_or(0)
        } else {
            0
        };

        self.deposited_amount = self.deposited_amount.saturating_sub(deposit_reduction);
        self.lp_token_balance = self.lp_token_balance.saturating_sub(lp_tokens_burned);

        self.total_yield_earned = self.total_yield_earned
            .checked_add(yield_realized)
            .ok_or(ProgramError::ArithmeticOverflow)?;

        self.last_virtual_price = virtual_price;
        self.last_update = clock.unix_timestamp;

        Ok(())
    }

    /// Record yield harvest (no withdrawal, just accounting)
    pub fn record_harvest(
        &mut self,
        yield_amount: u64,
        new_virtual_price: u64,
    ) -> Result<()> {
        let clock = Clock::get()?;

        self.total_yield_earned = self.total_yield_earned
            .checked_add(yield_amount)
            .ok_or(ProgramError::ArithmeticOverflow)?;

        self.last_virtual_price = new_virtual_price;
        self.last_harvest_ts = clock.unix_timestamp;
        self.last_update = clock.unix_timestamp;

        Ok(())
    }

    /// Calculate LP tokens needed for a withdrawal amount
    pub fn calculate_lp_for_withdrawal(&self, underlying_amount: u64) -> u64 {
        if self.last_virtual_price == 0 {
            return underlying_amount;
        }

        // lp_needed = underlying * DECIMALS / virtual_price
        // Round up to ensure we get at least the requested amount
        underlying_amount
            .checked_mul(Self::VIRTUAL_PRICE_DECIMALS)
            .unwrap_or(0)
            .checked_add(self.last_virtual_price.saturating_sub(1))
            .unwrap_or(0)
            .checked_div(self.last_virtual_price)
            .unwrap_or(0)
    }

    /// Check if deposit amount is valid
    pub fn is_valid_deposit(&self, amount: u64) -> bool {
        amount >= self.min_deposit && self.is_active
    }

    /// Deactivate the integration
    pub fn deactivate(&mut self) -> Result<()> {
        let clock = Clock::get()?;
        self.is_active = false;
        self.last_update = clock.unix_timestamp;
        Ok(())
    }

    /// Reactivate the integration
    pub fn activate(&mut self) -> Result<()> {
        let clock = Clock::get()?;
        self.is_active = true;
        self.last_update = clock.unix_timestamp;
        Ok(())
    }
}

impl Default for MeteoraVaultState {
    fn default() -> Self {
        Self {
            bump: 0,
            pool: Pubkey::default(),
            vault: Pubkey::default(),
            vault_lp_mint: Pubkey::default(),
            underlying_mint: Pubkey::default(),
            deposited_amount: 0,
            lp_token_balance: 0,
            last_virtual_price: Self::DEFAULT_VIRTUAL_PRICE,
            total_yield_earned: 0,
            last_harvest_ts: 0,
            allocation_bps: 0,
            min_deposit: 0,
            is_active: false,
            created_at: 0,
            last_update: 0,
            _reserved: [0; 32],
        }
    }
}
