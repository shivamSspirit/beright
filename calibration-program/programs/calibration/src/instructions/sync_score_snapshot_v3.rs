use anchor_lang::prelude::*;

use crate::errors::CalibrationError;
use crate::events::ScoreSnapshotSynced;
use crate::state::{ScoreConfig, ScoreSnapshotV3, SyncScoreSnapshotV3Args};

#[derive(Accounts)]
pub struct SyncScoreSnapshotV3<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"score_config"],
        bump = score_config.bump,
        has_one = authority @ CalibrationError::Unauthorized,
        constraint = !score_config.paused @ CalibrationError::ScoreSyncPaused
    )]
    pub score_config: Account<'info, ScoreConfig>,

    /// CHECK: This pubkey is used only as a deterministic seed target for the snapshot PDA.
    pub forecaster: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = authority,
        space = ScoreSnapshotV3::LEN,
        seeds = [b"score_v3", forecaster.key().as_ref()],
        bump
    )]
    pub score_snapshot_v3: Account<'info, ScoreSnapshotV3>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<SyncScoreSnapshotV3>,
    args: SyncScoreSnapshotV3Args,
) -> Result<()> {
    require!(
        ctx.accounts.score_config.accepted_score_version == args.score_version,
        CalibrationError::InvalidScoreVersion
    );

    let forecaster = ctx.accounts.forecaster.key();
    let bump = ctx.bumps.score_snapshot_v3;
    let snapshot = &mut ctx.accounts.score_snapshot_v3;

    if snapshot.forecaster == Pubkey::default() {
        snapshot.initialize(forecaster, bump);
    } else {
        require!(
            snapshot.forecaster == forecaster,
            CalibrationError::ForecasterMismatch
        );
    }

    snapshot.sync(bump, forecaster, args)?;

    emit!(ScoreSnapshotSynced {
        forecaster,
        authority: ctx.accounts.authority.key(),
        score_version: snapshot.score_version,
        vault_score: snapshot.vault_score,
        has_imported_score: snapshot.has_imported_score,
        has_native_score: snapshot.has_native_score,
        status: snapshot.status,
        tier: snapshot.tier,
        probationary: snapshot.probationary,
        native_resolved_count: snapshot.native_resolved_count,
        imported_resolved_count: snapshot.imported_resolved_count,
        max_active_sleeve_bps: snapshot.max_active_sleeve_bps,
        max_market_exposure_bps: snapshot.max_market_exposure_bps,
        max_theme_exposure_bps: snapshot.max_theme_exposure_bps,
        penalty_flags: snapshot.penalty_flags,
        snapshot_hash: snapshot.snapshot_hash,
        score_epoch_hash: snapshot.score_epoch_hash,
        updated_slot: snapshot.updated_slot,
    });

    Ok(())
}
