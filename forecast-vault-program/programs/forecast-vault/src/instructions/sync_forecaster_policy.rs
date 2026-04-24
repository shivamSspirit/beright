use anchor_lang::prelude::*;

use calibration::{
    program::Calibration,
    state::{ScoreSnapshotV3, SCORE_VERSION_V3, STATUS_RESTRICTED},
};

use crate::errors::ForecastVaultError;
use crate::state::{derive_policy_budget, ForecasterPolicy, GlobalConfig, VaultConfig, VaultState};

#[derive(Accounts)]
pub struct SyncForecasterPolicy<'info> {
    #[account(
        seeds = [b"global-config"],
        bump = global_config.bump,
        has_one = authority
    )]
    pub global_config: Account<'info, GlobalConfig>,
    #[account(
        mut,
        has_one = authority,
        constraint = vault_config.global_config == global_config.key() @ ForecastVaultError::InvalidVaultState
    )]
    pub vault_config: Account<'info, VaultConfig>,
    #[account(
        seeds = [b"vault-state", vault_config.key().as_ref()],
        bump = vault_state.bump,
        constraint = vault_state.vault_config == vault_config.key() @ ForecastVaultError::InvalidVaultState
    )]
    pub vault_state: Account<'info, VaultState>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + ForecasterPolicy::LEN,
        seeds = [b"forecaster-policy", vault_config.key().as_ref(), forecaster.key().as_ref()],
        bump
    )]
    pub forecaster_policy: Account<'info, ForecasterPolicy>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: Forecaster public key only; never receives custody power.
    pub forecaster: UncheckedAccount<'info>,
    pub calibration_program: Program<'info, Calibration>,
    #[account(
        seeds = [b"score_v3", forecaster.key().as_ref()],
        bump = score_snapshot.bump,
        seeds::program = calibration_program.key(),
        constraint = score_snapshot.forecaster == forecaster.key() @ ForecastVaultError::ScoreForecasterMismatch,
        constraint = score_snapshot.score_version == SCORE_VERSION_V3 @ ForecastVaultError::InvalidCalibrationProgram
    )]
    pub score_snapshot: Account<'info, ScoreSnapshotV3>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<SyncForecasterPolicy>) -> Result<()> {
    require!(
        ctx.accounts.global_config.calibration_program == ctx.accounts.calibration_program.key(),
        ForecastVaultError::InvalidCalibrationProgram
    );

    let score_snapshot = &ctx.accounts.score_snapshot;
    let forecaster_policy = &mut ctx.accounts.forecaster_policy;
    let is_new_policy = forecaster_policy.forecaster == Pubkey::default();

    if is_new_policy {
        forecaster_policy.bump = ctx.bumps.forecaster_policy;
        forecaster_policy.vault_config = ctx.accounts.vault_config.key();
        forecaster_policy.forecaster = ctx.accounts.forecaster.key();
        forecaster_policy.locked_budget = 0;
        forecaster_policy._reserved = [0; 64];

        ctx.accounts.vault_config.total_forecasters = ctx.accounts.vault_config.total_forecasters
            .checked_add(1)
            .ok_or(ForecastVaultError::MathOverflow)?;
    } else {
        require!(
            forecaster_policy.forecaster == ctx.accounts.forecaster.key()
                && forecaster_policy.vault_config == ctx.accounts.vault_config.key(),
            ForecastVaultError::Unauthorized
        );
    }

    let capped_active_budget_bps = score_snapshot
        .max_active_sleeve_bps
        .min(ctx.accounts.vault_config.prediction_target_bps);
    let capped_market_exposure_bps = score_snapshot
        .max_market_exposure_bps
        .min(capped_active_budget_bps);
    let capped_theme_exposure_bps = score_snapshot
        .max_theme_exposure_bps
        .min(capped_active_budget_bps);

    let eligible = score_snapshot.vault_score >= ctx.accounts.global_config.min_vault_score
        && score_snapshot.status != STATUS_RESTRICTED;
    let derived_cap = if eligible {
        derive_policy_budget(
            ctx.accounts.vault_state.total_managed_assets,
            capped_active_budget_bps,
        )?
    } else {
        0
    };

    forecaster_policy.score_snapshot = ctx.accounts.score_snapshot.key();
    forecaster_policy.vault_score = score_snapshot.vault_score;
    forecaster_policy.imported_score = if score_snapshot.has_imported_score {
        score_snapshot.imported_score
    } else {
        0
    };
    forecaster_policy.native_score = if score_snapshot.has_native_score {
        score_snapshot.native_score
    } else {
        0
    };
    forecaster_policy.has_imported_score = score_snapshot.has_imported_score;
    forecaster_policy.has_native_score = score_snapshot.has_native_score;
    forecaster_policy.status = score_snapshot.status;
    forecaster_policy.tier = score_snapshot.tier;
    forecaster_policy.max_active_budget_bps = capped_active_budget_bps;
    forecaster_policy.max_market_exposure_bps = capped_market_exposure_bps;
    forecaster_policy.max_theme_exposure_bps = capped_theme_exposure_bps;
    forecaster_policy.active_budget_cap = derived_cap.max(forecaster_policy.locked_budget);
    forecaster_policy.active = eligible;
    forecaster_policy.last_score_sync_slot = Clock::get()?.slot;

    Ok(())
}
