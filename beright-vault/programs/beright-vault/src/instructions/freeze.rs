use anchor_lang::prelude::*;
use crate::{FreezeVault, events::FreezeEvent};

pub fn freeze_handler(ctx: Context<FreezeVault>) -> Result<()> {
    let vault_state = &mut ctx.accounts.vault_state;
    let clock = Clock::get()?;

    vault_state.is_frozen = true;

    emit!(FreezeEvent {
        vault: ctx.accounts.vault_state.key(),
        frozen_by: ctx.accounts.authority.key(),
        is_frozen: true,
        timestamp: clock.unix_timestamp,
    });

    msg!("Vault frozen by {}", ctx.accounts.authority.key());
    Ok(())
}

pub fn unfreeze_handler(ctx: Context<FreezeVault>) -> Result<()> {
    let vault_state = &mut ctx.accounts.vault_state;
    let clock = Clock::get()?;

    vault_state.is_frozen = false;

    emit!(FreezeEvent {
        vault: ctx.accounts.vault_state.key(),
        frozen_by: ctx.accounts.authority.key(),
        is_frozen: false,
        timestamp: clock.unix_timestamp,
    });

    msg!("Vault unfrozen by {}", ctx.accounts.authority.key());
    Ok(())
}
