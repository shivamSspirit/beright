use anchor_lang::{
    prelude::*,
    solana_program::program_option::COption,
};
use anchor_spl::token::{Mint, TokenAccount};

use crate::errors::ForecastVaultError;
use crate::state::{GlobalConfig, VaultConfig, VaultState};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeVaultParams {
    pub reserve_target_bps: u16,
    pub yield_target_bps: u16,
    pub prediction_target_bps: u16,
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        mut,
        seeds = [b"global-config"],
        bump = global_config.bump,
        has_one = authority
    )]
    pub global_config: Account<'info, GlobalConfig>,
    #[account(
        init,
        payer = authority,
        space = 8 + VaultConfig::LEN,
        seeds = [b"vault-config", share_mint.key().as_ref()],
        bump
    )]
    pub vault_config: Account<'info, VaultConfig>,
    #[account(
        init,
        payer = authority,
        space = 8 + VaultState::LEN,
        seeds = [b"vault-state", vault_config.key().as_ref()],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        constraint = share_mint.mint_authority == COption::Some(vault_authority.key()) @ ForecastVaultError::InvalidShareMintAuthority,
        constraint = share_mint.supply == 0 @ ForecastVaultError::InvalidVaultState
    )]
    pub share_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = base_vault.owner == vault_authority.key() @ ForecastVaultError::InvalidBaseVaultAuthority,
        constraint = base_vault.mint == global_config.base_asset_mint @ ForecastVaultError::InvalidBaseVaultMint,
        constraint = base_vault.amount == 0 @ ForecastVaultError::InvalidVaultState
    )]
    pub base_vault: Account<'info, TokenAccount>,
    /// CHECK: PDA signer for vault custody and share minting.
    #[account(
        seeds = [b"vault-authority", vault_config.key().as_ref()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeVault>,
    params: InitializeVaultParams,
) -> Result<()> {
    let total_target_bps = params.reserve_target_bps as u64
        + params.yield_target_bps as u64
        + params.prediction_target_bps as u64;

    require!(total_target_bps == 10_000, ForecastVaultError::InvalidSleeveAllocation);
    require!(
        ctx.accounts.global_config.vault_count < ctx.accounts.global_config.max_vaults,
        ForecastVaultError::InvalidVaultState
    );

    let vault_config = &mut ctx.accounts.vault_config;
    vault_config.bump = ctx.bumps.vault_config;
    vault_config.authority = ctx.accounts.authority.key();
    vault_config.global_config = ctx.accounts.global_config.key();
    vault_config.base_asset_mint = ctx.accounts.global_config.base_asset_mint;
    vault_config.share_mint = ctx.accounts.share_mint.key();
    vault_config.base_vault = ctx.accounts.base_vault.key();
    vault_config.reserve_target_bps = params.reserve_target_bps;
    vault_config.yield_target_bps = params.yield_target_bps;
    vault_config.prediction_target_bps = params.prediction_target_bps;
    vault_config.enabled = true;
    vault_config.total_forecasters = 0;
    vault_config._reserved = [0; 64];

    let current_slot = Clock::get()?.slot;
    let vault_state = &mut ctx.accounts.vault_state;
    vault_state.bump = ctx.bumps.vault_state;
    vault_state.vault_config = vault_config.key();
    vault_state.total_managed_assets = 0;
    vault_state.total_shares = 0;
    vault_state.reserve_value = 0;
    vault_state.yield_sleeve_value = 0;
    vault_state.prediction_sleeve_value = 0;
    vault_state.pending_withdrawals = 0;
    vault_state.last_rebalance_slot = current_slot;
    vault_state.last_fee_slot = current_slot;
    vault_state.high_water_mark = 0;
    vault_state.total_matched_notional = 0;
    vault_state.total_unmatched_notional = 0;
    vault_state.total_locked_prediction_budget = 0;
    vault_state.paused = false;
    vault_state._reserved = [0; 64];

    ctx.accounts.global_config.vault_count = ctx.accounts.global_config.vault_count
        .checked_add(1)
        .ok_or(ForecastVaultError::MathOverflow)?;

    Ok(())
}
