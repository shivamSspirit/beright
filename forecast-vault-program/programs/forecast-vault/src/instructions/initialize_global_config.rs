use anchor_lang::prelude::*;

use crate::errors::ForecastVaultError;
use crate::state::GlobalConfig;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeGlobalConfigParams {
    pub treasury_recipient: Pubkey,
    pub insurance_recipient: Pubkey,
    pub base_asset_mint: Pubkey,
    pub calibration_program: Pubkey,
    pub max_vaults: u16,
    pub management_fee_bps: u16,
    pub performance_fee_bps: u16,
    pub min_vault_score: u16,
}

#[derive(Accounts)]
pub struct InitializeGlobalConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + GlobalConfig::LEN,
        seeds = [b"global-config"],
        bump
    )]
    pub global_config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeGlobalConfig>,
    params: InitializeGlobalConfigParams,
) -> Result<()> {
    require!(
        params.management_fee_bps <= 10_000 && params.performance_fee_bps <= 10_000,
        ForecastVaultError::InvalidFeeConfiguration
    );
    require!(params.min_vault_score <= 1_000, ForecastVaultError::ScoreBelowThreshold);

    let global_config = &mut ctx.accounts.global_config;

    global_config.bump = ctx.bumps.global_config;
    global_config.authority = ctx.accounts.authority.key();
    global_config.treasury_recipient = params.treasury_recipient;
    global_config.insurance_recipient = params.insurance_recipient;
    global_config.base_asset_mint = params.base_asset_mint;
    global_config.calibration_program = params.calibration_program;
    global_config.protocol_paused = false;
    global_config.prediction_paused = false;
    global_config.max_vaults = params.max_vaults;
    global_config.vault_count = 0;
    global_config.management_fee_bps = params.management_fee_bps;
    global_config.performance_fee_bps = params.performance_fee_bps;
    global_config.min_vault_score = params.min_vault_score;
    global_config._reserved = [0; 64];

    Ok(())
}
