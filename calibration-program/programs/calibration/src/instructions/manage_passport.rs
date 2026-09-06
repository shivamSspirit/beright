use crate::errors::CalibrationError;
use crate::events::{
    PassportConfigInitialized, PassportConfigUpdated, PassportSnapshotRevoked,
    PassportSnapshotUpserted,
};
use crate::state::{PassportConfig, PassportSnapshotV1, UpsertPassportSnapshotV1Args};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitializePassportConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = PassportConfig::LEN, seeds = [b"passport_config"], bump)]
    pub passport_config: Account<'info, PassportConfig>,
    pub system_program: Program<'info, System>,
}
pub fn initialize_config_handler(ctx: Context<InitializePassportConfig>) -> Result<()> {
    let authority = ctx.accounts.authority.key();
    let config = &mut ctx.accounts.passport_config;
    config.initialize(authority, ctx.bumps.passport_config)?;
    emit!(PassportConfigInitialized {
        authority,
        schema_version: config.accepted_schema_version,
        paused: config.paused,
        slot: config.last_updated_slot
    });
    Ok(())
}

#[derive(Accounts)]
pub struct UpdatePassportConfig<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"passport_config"], bump = passport_config.bump, has_one = authority @ CalibrationError::Unauthorized)]
    pub passport_config: Account<'info, PassportConfig>,
}
pub fn update_config_handler(
    ctx: Context<UpdatePassportConfig>,
    next_authority: Pubkey,
    schema_version: u8,
    paused: bool,
) -> Result<()> {
    let config = &mut ctx.accounts.passport_config;
    config.update(next_authority, schema_version, paused)?;
    emit!(PassportConfigUpdated {
        authority: ctx.accounts.authority.key(),
        next_authority,
        schema_version,
        paused,
        slot: config.last_updated_slot
    });
    Ok(())
}

#[derive(Accounts)]
pub struct UpsertPassportSnapshot<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [b"passport_config"], bump = passport_config.bump, has_one = authority @ CalibrationError::Unauthorized, constraint = !passport_config.paused @ CalibrationError::PassportPaused)]
    pub passport_config: Account<'info, PassportConfig>,
    /// CHECK: used only as a stable passport PDA subject seed; it never signs this instruction.
    pub subject: UncheckedAccount<'info>,
    #[account(init_if_needed, payer = authority, space = PassportSnapshotV1::LEN, seeds = [b"passport_v1", subject.key().as_ref()], bump)]
    pub passport_snapshot: Account<'info, PassportSnapshotV1>,
    pub system_program: Program<'info, System>,
}
pub fn upsert_handler(
    ctx: Context<UpsertPassportSnapshot>,
    args: UpsertPassportSnapshotV1Args,
) -> Result<()> {
    require!(
        ctx.accounts.passport_config.accepted_schema_version == args.schema_version,
        CalibrationError::InvalidPassportSchemaVersion
    );
    let subject = ctx.accounts.subject.key();
    let snapshot = &mut ctx.accounts.passport_snapshot;
    if snapshot.subject == Pubkey::default() {
        snapshot.initialize(subject, ctx.bumps.passport_snapshot);
    } else {
        require!(
            snapshot.subject == subject,
            CalibrationError::PassportSubjectMismatch
        );
    }
    snapshot.upsert(
        subject,
        ctx.accounts.authority.key(),
        ctx.bumps.passport_snapshot,
        args,
    )?;
    emit!(PassportSnapshotUpserted {
        subject,
        issuer: snapshot.issuer,
        schema_version: snapshot.schema_version,
        status: snapshot.status,
        passport_root: snapshot.passport_root,
        evidence_root: snapshot.evidence_root,
        score_epoch: snapshot.score_epoch,
        confidence_bps: snapshot.confidence_bps,
        expires_at: snapshot.expires_at,
        updated_slot: snapshot.updated_slot
    });
    Ok(())
}

#[derive(Accounts)]
pub struct RevokePassportSnapshot<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [b"passport_config"], bump = passport_config.bump, has_one = authority @ CalibrationError::Unauthorized)]
    pub passport_config: Account<'info, PassportConfig>,
    #[account(mut, seeds = [b"passport_v1", subject.key().as_ref()], bump = passport_snapshot.bump, constraint = passport_snapshot.subject == subject.key() @ CalibrationError::PassportSubjectMismatch)]
    pub passport_snapshot: Account<'info, PassportSnapshotV1>,
    /// CHECK: constrained solely as the PDA subject seed.
    pub subject: UncheckedAccount<'info>,
}
pub fn revoke_handler(ctx: Context<RevokePassportSnapshot>, reason_hash: [u8; 32]) -> Result<()> {
    let snapshot = &mut ctx.accounts.passport_snapshot;
    snapshot.revoke(reason_hash)?;
    emit!(PassportSnapshotRevoked {
        subject: snapshot.subject,
        issuer: ctx.accounts.authority.key(),
        score_epoch: snapshot.score_epoch,
        revoked_at: snapshot.revoked_at,
        reason_hash
    });
    Ok(())
}
