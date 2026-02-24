use anchor_lang::prelude::*;
use crate::{Withdraw, errors::VaultError, events::WithdrawEvent};

pub fn handler(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    require!(amount > 0, VaultError::ZeroAmount);

    let vault_state = &mut ctx.accounts.vault_state;
    let clock = Clock::get()?;

    // 1. Timelock check
    require!(
        clock.unix_timestamp >= vault_state.lock_until,
        VaultError::TimelockActive
    );

    // 2. Per-epoch rate limit
    let current_epoch = clock.epoch;
    if vault_state.current_epoch != current_epoch {
        vault_state.current_epoch   = current_epoch;
        vault_state.epoch_withdrawn = 0;
    }

    let epoch_after = vault_state.epoch_withdrawn
        .checked_add(amount)
        .ok_or(VaultError::Overflow)?;

    require!(
        epoch_after <= vault_state.epoch_withdraw_limit,
        VaultError::EpochLimitExceeded
    );

    // 3. Guardian check for large withdrawals
    if vault_state.guardian_set && amount >= vault_state.large_withdraw_threshold {
        match &ctx.accounts.guardian {
            None => return err!(VaultError::GuardianRequired),
            Some(g) => {
                require_keys_eq!(
                    g.key(),
                    vault_state.guardian,
                    VaultError::GuardianRequired
                );
            }
        }
    }

    // 4. Balance and rent floor checks
    let vault_lamports = ctx.accounts.vault.lamports();
    require!(vault_lamports >= amount, VaultError::InsufficientFunds);

    let rent = Rent::get()?;
    let after_balance = vault_lamports
        .checked_sub(amount)
        .ok_or(VaultError::Overflow)?;

    if after_balance > 0 {
        let min_rent = rent.minimum_balance(0);
        require!(
            after_balance >= min_rent,
            VaultError::InsufficientFundsForRent
        );
    }

    // 5. Transfer lamports directly (PDA cannot sign via system_program::transfer)
    **ctx.accounts.vault.try_borrow_mut_lamports()? = ctx.accounts.vault
        .lamports()
        .checked_sub(amount)
        .ok_or(VaultError::Overflow)?;

    **ctx.accounts.owner.try_borrow_mut_lamports()? = ctx.accounts.owner
        .lamports()
        .checked_add(amount)
        .ok_or(VaultError::Overflow)?;

    // 6. Update state
    vault_state.epoch_withdrawn = epoch_after;
    vault_state.total_withdrawn = vault_state.total_withdrawn
        .checked_add(amount)
        .ok_or(VaultError::Overflow)?;

    let next_unlock = if vault_state.withdrawal_delay > 0 {
        clock.unix_timestamp
            .checked_add(vault_state.withdrawal_delay)
            .ok_or(VaultError::Overflow)?
    } else {
        0
    };
    vault_state.lock_until = next_unlock;

    let new_balance = ctx.accounts.vault.lamports();

    emit!(WithdrawEvent {
        vault: ctx.accounts.vault.key(),
        user: ctx.accounts.owner.key(),
        amount,
        timestamp: clock.unix_timestamp,
        new_balance,
        total_withdrawn: vault_state.total_withdrawn,
        next_unlock,
    });

    msg!("Withdraw: {} lamports | Balance: {} | Next unlock: {}",
        amount, new_balance, next_unlock);

    Ok(())
}
