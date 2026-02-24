use anchor_lang::prelude::*;
use crate::{SetGuardian, errors::VaultError, events::GuardianUpdated};

pub fn handler(
    ctx: Context<SetGuardian>,
    guardian: Pubkey,
    large_withdraw_threshold: u64,
) -> Result<()> {
    require!(large_withdraw_threshold > 0, VaultError::InvalidThreshold);

    let vault_state = &mut ctx.accounts.vault_state;
    let clock = Clock::get()?;

    vault_state.guardian = guardian;
    vault_state.large_withdraw_threshold = large_withdraw_threshold;
    vault_state.guardian_set = true;

    emit!(GuardianUpdated {
        vault: ctx.accounts.vault_state.key(),
        owner: ctx.accounts.owner.key(),
        new_guardian: guardian,
        threshold: large_withdraw_threshold,
        timestamp: clock.unix_timestamp,
    });

    msg!("Guardian set: {} | Threshold: {} lamports", guardian, large_withdraw_threshold);
    Ok(())
}

pub fn remove_handler(ctx: Context<SetGuardian>) -> Result<()> {
    let vault_state = &mut ctx.accounts.vault_state;
    let clock = Clock::get()?;

    vault_state.guardian_set = false;
    vault_state.guardian     = Pubkey::default();
    vault_state.large_withdraw_threshold = 0;

    emit!(GuardianUpdated {
        vault: ctx.accounts.vault_state.key(),
        owner: ctx.accounts.owner.key(),
        new_guardian: Pubkey::default(),
        threshold: 0,
        timestamp: clock.unix_timestamp,
    });

    msg!("Guardian removed from vault");
    Ok(())
}
