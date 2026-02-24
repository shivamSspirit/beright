use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::{Deposit, errors::VaultError, events::DepositEvent};

pub fn handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, VaultError::ZeroAmount);

    let vault_state = &mut ctx.accounts.vault_state;
    let clock = Clock::get()?;

    let transfer_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.user.to_account_info(),
            to:   ctx.accounts.vault.to_account_info(),
        },
    );
    system_program::transfer(transfer_ctx, amount)?;

    vault_state.total_deposited = vault_state.total_deposited
        .checked_add(amount)
        .ok_or(VaultError::Overflow)?;

    let new_balance = ctx.accounts.vault.lamports();

    emit!(DepositEvent {
        vault: ctx.accounts.vault.key(),
        user: ctx.accounts.user.key(),
        amount,
        timestamp: clock.unix_timestamp,
        new_balance,
        total_deposited: vault_state.total_deposited,
    });

    msg!("Deposit: {} lamports | Balance: {} | Total deposited: {}",
        amount, new_balance, vault_state.total_deposited);

    Ok(())
}
