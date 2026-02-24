use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};
use crate::{DepositToken, errors::VaultError, events::TokenDepositEvent};

pub fn handler(ctx: Context<DepositToken>, amount: u64) -> Result<()> {
    require!(amount > 0, VaultError::ZeroAmount);

    let clock = Clock::get()?;

    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from:      ctx.accounts.user_token_account.to_account_info(),
            to:        ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    );
    token::transfer(transfer_ctx, amount)?;

    emit!(TokenDepositEvent {
        vault: ctx.accounts.vault_state.key(),
        user:  ctx.accounts.user.key(),
        mint:  ctx.accounts.mint.key(),
        amount,
        timestamp: clock.unix_timestamp,
    });

    msg!("Token deposit: {} | Mint: {} | User: {}",
        amount, ctx.accounts.mint.key(), ctx.accounts.user.key());

    Ok(())
}
