use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};
use crate::{WithdrawToken, errors::VaultError, events::TokenWithdrawEvent};

pub fn handler(ctx: Context<WithdrawToken>, amount: u64) -> Result<()> {
    require!(amount > 0, VaultError::ZeroAmount);

    let vault_state = &ctx.accounts.vault_state;
    let clock = Clock::get()?;

    // Token withdrawals share the same timelock as SOL withdrawals
    require!(
        clock.unix_timestamp >= vault_state.lock_until,
        VaultError::TimelockActive
    );

    require!(
        ctx.accounts.vault_token_account.amount >= amount,
        VaultError::InsufficientFunds
    );

    // Sign with vault_state PDA seeds
    let owner_key = ctx.accounts.owner.key();
    let state_bump = vault_state.state_bump;
    let seeds = &[
        b"vault_state",
        owner_key.as_ref(),
        &[state_bump],
    ];
    let signer_seeds = &[&seeds[..]];

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from:      ctx.accounts.vault_token_account.to_account_info(),
            to:        ctx.accounts.owner_token_account.to_account_info(),
            authority: ctx.accounts.vault_state.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(transfer_ctx, amount)?;

    emit!(TokenWithdrawEvent {
        vault: ctx.accounts.vault_state.key(),
        user:  ctx.accounts.owner.key(),
        mint:  ctx.accounts.mint.key(),
        amount,
        timestamp: clock.unix_timestamp,
    });

    msg!("Token withdraw: {} | Mint: {} | Owner: {}",
        amount, ctx.accounts.mint.key(), ctx.accounts.owner.key());

    Ok(())
}
