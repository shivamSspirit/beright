use anchor_lang::prelude::*;

pub const BPS_DENOMINATOR: u64 = 10_000;
pub const PRICE_SCALE: u64 = 1_000_000;
pub const REWARD_SCALE: u128 = 1u128 << 64;
pub const MAX_PROTOCOL_TVL: u64 = 1_000_000_000_000;
pub const MIN_STRATEGY_DELAY_SECONDS: i64 = 86_400;

#[account]
#[derive(InitSpace)]
pub struct ProtocolConfig {
    pub admin: Pubkey,
    pub pending_admin: Pubkey,
    pub emergency_authority: Pubkey,
    pub strategy_authority: Pubkey,
    pub oracle_authority: Pubkey,
    pub settlement_mint: Pubkey,
    pub allowed_strategy_program: Pubkey,
    pub pending_strategy_program: Pubkey,
    pub strategy_activate_after: i64,
    pub strategy_delay_seconds: i64,
    pub market_count: u64,
    pub config_initialized: bool,
    pub paused: bool,
    pub strategy_enabled: bool,
    pub pending_strategy_enabled: bool,
    pub bump: u8,
    pub reserved: [u8; 15],
}

#[account]
#[derive(InitSpace)]
pub struct MarketVault {
    pub config: Pubkey,
    pub market_id: [u8; 32],
    pub yes_mint: Pubkey,
    pub no_mint: Pubkey,
    pub yes_vault: Pubkey,
    pub no_vault: Pubkey,
    pub settlement_vault: Pubkey,
    pub resolution_authority: Pubkey,
    pub status: MarketStatus,
    pub winning_side: Side,
    pub total_yes: u64,
    pub total_no: u64,
    pub matched_pairs: u64,
    pub matched_units: u64,
    pub strategy_principal: u64,
    pub harvested_yield: u64,
    pub claimed_yield: u64,
    pub reward_index_x64: u128,
    pub reward_dust_x64: u128,
    pub tvl_cap: u64,
    pub max_ltv_bps: u16,
    pub liquidation_ltv_bps: u16,
    pub collateral_haircut_bps: u16,
    pub max_oracle_age_seconds: i64,
    pub max_confidence_bps: u16,
    pub resolution_time: i64,
    pub borrow_cutoff_seconds: i64,
    pub position_count: u64,
    pub bump: u8,
    pub reserved: [u8; 40],
}

#[account]
#[derive(InitSpace)]
pub struct UserPosition {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub yes_amount: u64,
    pub no_amount: u64,
    pub matched_yes: u64,
    pub matched_no: u64,
    pub locked_yes: u64,
    pub locked_no: u64,
    pub pending_yield: u64,
    pub reward_index_x64: u128,
    pub next_intent_nonce: u64,
    pub bump: u8,
    pub reserved: [u8; 31],
}

#[account]
#[derive(InitSpace)]
pub struct PriceSnapshot {
    pub market: Pubkey,
    pub yes_executable_bid: u64,
    pub no_executable_bid: u64,
    pub yes_twap: u64,
    pub no_twap: u64,
    pub confidence_bps: u16,
    pub observed_slot: u64,
    pub observed_at: i64,
    pub content_hash: [u8; 32],
    pub bump: u8,
    pub reserved: [u8; 31],
}

#[account]
#[derive(InitSpace)]
pub struct LendingPool {
    pub market: Pubkey,
    pub settlement_vault: Pubkey,
    pub total_cash: u64,
    pub total_borrows: u64,
    pub total_lender_shares: u64,
    pub bad_debt: u64,
    pub lender_count: u64,
    pub loan_count: u64,
    pub bump: u8,
    pub reserved: [u8; 63],
}

#[account]
#[derive(InitSpace)]
pub struct LenderPosition {
    pub pool: Pubkey,
    pub owner: Pubkey,
    pub shares: u64,
    pub bump: u8,
    pub reserved: [u8; 31],
}

#[account]
#[derive(InitSpace)]
pub struct LoanPosition {
    pub pool: Pubkey,
    pub borrower: Pubkey,
    pub collateral_side: Side,
    pub collateral_amount: u64,
    pub borrowed_amount: u64,
    pub bump: u8,
    pub reserved: [u8; 31],
}

#[account]
#[derive(InitSpace)]
pub struct AgentIntent {
    pub owner: Pubkey,
    pub executor: Pubkey,
    pub market: Pubkey,
    pub action: AgentAction,
    pub amount: u64,
    pub min_output: u64,
    pub nonce: u64,
    pub expires_at: i64,
    pub consumed: bool,
    pub bump: u8,
    pub reserved: [u8; 30],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
#[repr(u8)]
pub enum Side {
    Yes = 0,
    No = 1,
    Unresolved = 2,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
#[repr(u8)]
pub enum MarketStatus {
    Active = 0,
    Resolved = 1,
    Closed = 2,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
#[repr(u8)]
pub enum AgentAction {
    Match = 0,
    ClaimYield = 1,
    Repay = 2,
    WithdrawUnmatched = 3,
}

impl UserPosition {
    pub fn matched_units(&self) -> Result<u64> {
        self.matched_yes
            .checked_add(self.matched_no)
            .ok_or_else(|| error!(crate::errors::CapitalError::MathOverflow))
    }

    pub fn unmatched(&self, side: Side) -> Result<u64> {
        let (total, matched, locked) = match side {
            Side::Yes => (self.yes_amount, self.matched_yes, self.locked_yes),
            Side::No => (self.no_amount, self.matched_no, self.locked_no),
            Side::Unresolved => return err!(crate::errors::CapitalError::InvalidSide),
        };
        total
            .checked_sub(matched)
            .and_then(|value| value.checked_sub(locked))
            .ok_or_else(|| error!(crate::errors::CapitalError::MathOverflow))
    }
}
