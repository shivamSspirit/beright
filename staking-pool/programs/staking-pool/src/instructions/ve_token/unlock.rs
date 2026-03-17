use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::events::VeTokenUnlockedEvent;
use crate::state::ve_token::{VeTokenState, VeTokenError};

/// Accounts for unlocking expired ve tokens
#[derive(Accounts)]
pub struct UnlockVeToken<'info> {
    /// Lock owner
    #[account(mut)]
    pub user: Signer<'info>,

    /// VeToken state PDA (will be closed)
    #[account(
        mut,
        seeds = [b"ve_token", user.key().as_ref()],
        bump = ve_token_state.bump,
        constraint = ve_token_state.owner == user.key(),
        close = user,
    )]
    pub ve_token_state: Account<'info, VeTokenState>,

    /// User's bRight token account to receive unlocked tokens
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    /// VeToken escrow vault
    #[account(mut)]
    pub ve_escrow_vault: Account<'info, TokenAccount>,

    /// Escrow vault authority PDA
    /// CHECK: PDA authority for escrow
    #[account(
        seeds = [b"ve_escrow_authority"],
        bump,
    )]
    pub escrow_authority: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

/// Unlock expired ve tokens
///
/// Can only be called after lock has expired. Returns bRight tokens to user
/// and closes the ve token state account.
pub fn handler(ctx: Context<UnlockVeToken>) -> Result<()> {
    let ve_token_state = &ctx.accounts.ve_token_state;
    let clock = Clock::get()?;

    // Validate lock has expired
    require!(
        clock.unix_timestamp >= ve_token_state.lock_end,
        VeTokenError::LockNotExpired
    );

    let amount = ve_token_state.locked_amount;

    // Transfer tokens back to user
    let authority_bump = ctx.bumps.escrow_authority;
    let seeds = &[b"ve_escrow_authority".as_ref(), &[authority_bump]];
    let signer_seeds = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.ve_escrow_vault.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.escrow_authority.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    // Emit event
    emit!(VeTokenUnlockedEvent {
        user: ctx.accounts.user.key(),
        amount,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Unlocked {} bRight tokens, lock ended at {}",
        amount,
        ve_token_state.lock_end
    );

    Ok(())
}
