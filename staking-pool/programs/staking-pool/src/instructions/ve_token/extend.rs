use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::events::VeTokenExtendedEvent;
use crate::state::ve_token::{VeTokenState, VeTokenError};

/// Accounts for extending a ve lock
#[derive(Accounts)]
pub struct ExtendLock<'info> {
    /// Lock owner
    #[account(mut)]
    pub user: Signer<'info>,

    /// VeToken state PDA
    #[account(
        mut,
        seeds = [b"ve_token", user.key().as_ref()],
        bump = ve_token_state.bump,
        constraint = ve_token_state.owner == user.key(),
    )]
    pub ve_token_state: Account<'info, VeTokenState>,
}

/// Extend lock duration
///
/// Can only extend, not shorten. Recalculates voting power and boost.
pub fn handler(ctx: Context<ExtendLock>, new_lock_end: i64) -> Result<()> {
    let ve_token_state = &mut ctx.accounts.ve_token_state;
    let clock = Clock::get()?;

    // Validate lock hasn't expired
    require!(
        clock.unix_timestamp < ve_token_state.lock_end,
        VeTokenError::LockExpired
    );

    let old_lock_end = ve_token_state.lock_end;

    // Extend the lock
    ve_token_state.extend_lock(new_lock_end)?;

    // Emit event
    emit!(VeTokenExtendedEvent {
        user: ctx.accounts.user.key(),
        old_lock_end,
        new_lock_end,
        new_voting_power: ve_token_state.voting_power,
        new_boost_multiplier: ve_token_state.boost_multiplier,
    });

    msg!(
        "Extended lock from {} to {}, new voting power: {}",
        old_lock_end,
        new_lock_end,
        ve_token_state.voting_power
    );

    Ok(())
}

/// Accounts for increasing locked amount
#[derive(Accounts)]
pub struct IncreaseLock<'info> {
    /// Lock owner
    #[account(mut)]
    pub user: Signer<'info>,

    /// VeToken state PDA
    #[account(
        mut,
        seeds = [b"ve_token", user.key().as_ref()],
        bump = ve_token_state.bump,
        constraint = ve_token_state.owner == user.key(),
    )]
    pub ve_token_state: Account<'info, VeTokenState>,

    /// User's bRight token account
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    /// VeToken escrow vault
    #[account(mut)]
    pub ve_escrow_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// Add more tokens to existing lock
///
/// Keeps the same unlock time but increases voting power.
pub fn increase_handler(ctx: Context<IncreaseLock>, additional_amount: u64) -> Result<()> {
    let ve_token_state = &mut ctx.accounts.ve_token_state;
    let clock = Clock::get()?;

    // Validate lock hasn't expired
    require!(
        clock.unix_timestamp < ve_token_state.lock_end,
        VeTokenError::LockExpired
    );

    // Transfer additional tokens to escrow
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.ve_escrow_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        additional_amount,
    )?;

    // Update lock amount
    ve_token_state.increase_lock_amount(additional_amount)?;

    msg!(
        "Increased lock by {}, new total: {}, voting power: {}",
        additional_amount,
        ve_token_state.locked_amount,
        ve_token_state.voting_power
    );

    Ok(())
}
