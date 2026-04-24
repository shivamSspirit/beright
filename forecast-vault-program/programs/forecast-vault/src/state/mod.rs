use anchor_lang::prelude::*;

use crate::errors::ForecastVaultError;

#[account]
pub struct GlobalConfig {
    pub bump: u8,
    pub authority: Pubkey,
    pub treasury_recipient: Pubkey,
    pub insurance_recipient: Pubkey,
    pub base_asset_mint: Pubkey,
    pub calibration_program: Pubkey,
    pub protocol_paused: bool,
    pub prediction_paused: bool,
    pub max_vaults: u16,
    pub vault_count: u16,
    pub management_fee_bps: u16,
    pub performance_fee_bps: u16,
    pub min_vault_score: u16,
    pub _reserved: [u8; 64],
}

impl GlobalConfig {
    pub const LEN: usize = 237;
}

#[account]
pub struct VaultConfig {
    pub bump: u8,
    pub authority: Pubkey,
    pub global_config: Pubkey,
    pub base_asset_mint: Pubkey,
    pub share_mint: Pubkey,
    pub base_vault: Pubkey,
    pub reserve_target_bps: u16,
    pub yield_target_bps: u16,
    pub prediction_target_bps: u16,
    pub enabled: bool,
    pub total_forecasters: u16,
    pub _reserved: [u8; 64],
}

impl VaultConfig {
    pub const LEN: usize = 234;

    pub fn total_target_bps(&self) -> u16 {
        self.reserve_target_bps
            .saturating_add(self.yield_target_bps)
            .saturating_add(self.prediction_target_bps)
    }
}

#[account]
pub struct VaultState {
    pub bump: u8,
    pub vault_config: Pubkey,
    pub total_managed_assets: u64,
    pub total_shares: u64,
    pub reserve_value: u64,
    pub yield_sleeve_value: u64,
    pub prediction_sleeve_value: u64,
    pub pending_withdrawals: u64,
    pub last_rebalance_slot: u64,
    pub last_fee_slot: u64,
    pub high_water_mark: u64,
    pub total_matched_notional: u64,
    pub total_unmatched_notional: u64,
    pub total_locked_prediction_budget: u64,
    pub paused: bool,
    pub _reserved: [u8; 64],
}

impl VaultState {
    pub const LEN: usize = 194;

    pub fn deposit_assets(
        &mut self,
        amount: u64,
        reserve_target_bps: u16,
        yield_target_bps: u16,
        prediction_target_bps: u16,
        current_slot: u64,
    ) -> Result<()> {
        let (reserve_delta, yield_delta, prediction_delta) = split_by_targets(
            amount,
            reserve_target_bps,
            yield_target_bps,
            prediction_target_bps,
        )?;

        self.total_managed_assets = self
            .total_managed_assets
            .checked_add(amount)
            .ok_or(ForecastVaultError::MathOverflow)?;
        self.reserve_value = self
            .reserve_value
            .checked_add(reserve_delta)
            .ok_or(ForecastVaultError::MathOverflow)?;
        self.yield_sleeve_value = self
            .yield_sleeve_value
            .checked_add(yield_delta)
            .ok_or(ForecastVaultError::MathOverflow)?;
        self.prediction_sleeve_value = self
            .prediction_sleeve_value
            .checked_add(prediction_delta)
            .ok_or(ForecastVaultError::MathOverflow)?;
        self.last_rebalance_slot = current_slot;

        Ok(())
    }

    pub fn withdraw_assets(&mut self, amount: u64, current_slot: u64) -> Result<()> {
        require!(
            amount <= self.total_managed_assets,
            ForecastVaultError::InsufficientVaultLiquidity
        );

        let total_before = self.total_managed_assets;
        let reserve_delta = mul_div_floor(self.reserve_value, amount, total_before)?;
        let yield_delta = mul_div_floor(self.yield_sleeve_value, amount, total_before)?;
        let prediction_delta = amount
            .checked_sub(reserve_delta)
            .and_then(|value| value.checked_sub(yield_delta))
            .ok_or(ForecastVaultError::MathOverflow)?;

        self.total_managed_assets = self
            .total_managed_assets
            .checked_sub(amount)
            .ok_or(ForecastVaultError::MathOverflow)?;
        self.reserve_value = self
            .reserve_value
            .checked_sub(reserve_delta)
            .ok_or(ForecastVaultError::MathOverflow)?;
        self.yield_sleeve_value = self
            .yield_sleeve_value
            .checked_sub(yield_delta)
            .ok_or(ForecastVaultError::MathOverflow)?;
        self.prediction_sleeve_value = self
            .prediction_sleeve_value
            .checked_sub(prediction_delta)
            .ok_or(ForecastVaultError::MathOverflow)?;
        self.last_rebalance_slot = current_slot;

        Ok(())
    }

    pub fn current_prediction_capacity(&self) -> Result<u64> {
        self.prediction_sleeve_value
            .checked_sub(self.total_locked_prediction_budget)
            .ok_or(ForecastVaultError::MathOverflow.into())
    }
}

#[account]
pub struct ForecasterPolicy {
    pub bump: u8,
    pub vault_config: Pubkey,
    pub forecaster: Pubkey,
    pub score_snapshot: Pubkey,
    pub vault_score: u16,
    pub imported_score: u16,
    pub native_score: u16,
    pub has_imported_score: bool,
    pub has_native_score: bool,
    pub status: u8,
    pub tier: u8,
    pub max_active_budget_bps: u16,
    pub max_market_exposure_bps: u16,
    pub max_theme_exposure_bps: u16,
    pub active_budget_cap: u64,
    pub locked_budget: u64,
    pub active: bool,
    pub last_score_sync_slot: u64,
    pub _reserved: [u8; 64],
}

impl ForecasterPolicy {
    pub const LEN: usize = 193;

    pub fn available_budget(&self) -> Result<u64> {
        self.active_budget_cap
            .checked_sub(self.locked_budget)
            .ok_or(ForecastVaultError::MathOverflow.into())
    }
}

#[account]
pub struct TradeIntent {
    pub bump: u8,
    pub vault_config: Pubkey,
    pub forecaster: Pubkey,
    pub intent_id: [u8; 32],
    pub basket_id: [u8; 32],
    pub market_id_hash: [u8; 32],
    pub side: u8,
    pub max_size: u64,
    pub limit_price_bps: u16,
    pub expiry_slot: u64,
    pub created_slot: u64,
    pub locked_budget: u64,
    pub status: u8,
    pub _reserved: [u8; 32],
}

impl TradeIntent {
    pub const LEN: usize = 229;

    pub const STATUS_OPEN: u8 = 0;
    pub const STATUS_CANCELLED: u8 = 1;
    pub const STATUS_CONSUMED: u8 = 2;
}

pub fn calculate_shares_to_mint(
    total_managed_assets: u64,
    total_shares: u64,
    deposit_amount: u64,
) -> Result<u64> {
    if total_shares == 0 || total_managed_assets == 0 {
        return Ok(deposit_amount);
    }

    let shares = mul_div_floor(deposit_amount, total_shares, total_managed_assets)?;
    require!(shares > 0, ForecastVaultError::ZeroSharesMinted);
    Ok(shares)
}

pub fn calculate_assets_to_return(
    total_managed_assets: u64,
    total_shares: u64,
    share_amount: u64,
) -> Result<u64> {
    require!(share_amount > 0, ForecastVaultError::InvalidAmount);
    require!(total_shares > 0, ForecastVaultError::InvalidVaultState);

    let assets = mul_div_floor(share_amount, total_managed_assets, total_shares)?;
    require!(assets > 0, ForecastVaultError::ZeroAssetsReturned);
    Ok(assets)
}

pub fn derive_policy_budget(total_managed_assets: u64, max_active_budget_bps: u16) -> Result<u64> {
    mul_div_floor(total_managed_assets, max_active_budget_bps as u64, 10_000)
}

pub fn split_by_targets(
    amount: u64,
    reserve_target_bps: u16,
    yield_target_bps: u16,
    prediction_target_bps: u16,
) -> Result<(u64, u64, u64)> {
    let total_bps = reserve_target_bps as u64 + yield_target_bps as u64 + prediction_target_bps as u64;
    require!(total_bps > 0 && total_bps <= 10_000, ForecastVaultError::InvalidSleeveAllocation);

    let yield_amount = mul_div_floor(amount, yield_target_bps as u64, total_bps)?;
    let prediction_amount = mul_div_floor(amount, prediction_target_bps as u64, total_bps)?;
    let reserve_amount = amount
        .checked_sub(yield_amount)
        .and_then(|value| value.checked_sub(prediction_amount))
        .ok_or(ForecastVaultError::MathOverflow)?;

    Ok((reserve_amount, yield_amount, prediction_amount))
}

pub fn mul_div_floor(a: u64, b: u64, c: u64) -> Result<u64> {
    require!(c > 0, ForecastVaultError::DivisionByZero);

    ((a as u128)
        .checked_mul(b as u128)
        .ok_or(ForecastVaultError::MathOverflow)?
        .checked_div(c as u128)
        .ok_or(ForecastVaultError::DivisionByZero)?)
    .try_into()
    .map_err(|_| ForecastVaultError::MathOverflow.into())
}
