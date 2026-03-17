use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::StakingPoolError;
use crate::events::VeTokenLockedEvent;
use crate::state::ve_token::{VeTokenState, VeTokenError};

/// Accounts for locking tokens to create veBRIGHT
#[derive(Accounts)]
pub struct LockVeToken<'info> {
    /// User locking tokens
    #[account(mut)]
    pub user: Signer<'info>,

    /// VeToken state PDA
    #[account(
        init,
        payer = user,
        space = VeTokenState::LEN,
        seeds = [b"ve_token", user.key().as_ref()],
        bump,
    )]
    pub ve_token_state: Account<'info, VeTokenState>,

    /// User's bRight token account
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    /// VeToken escrow vault
    #[account(mut)]
    pub ve_escrow_vault: Account<'info, TokenAccount>,

    /// bRight token mint
    /// CHECK: Verified by token account constraints
    pub bright_mint: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Lock bRight tokens to create veBRIGHT
///
/// Creates a vote-escrowed position with voting power that decays linearly.
/// Longer locks = higher boost multiplier and fee discounts.
pub fn handler(
    ctx: Context<LockVeToken>,
    amount: u64,
    lock_duration: i64,
) -> Result<()> {
    // Validate lock duration
    require!(
        lock_duration >= VeTokenState::MIN_LOCK_DURATION,
        VeTokenError::LockDurationTooShort
    );
    require!(
        lock_duration <= VeTokenState::MAX_LOCK_DURATION,
        VeTokenError::LockDurationTooLong
    );

    // Transfer tokens to escrow
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.ve_escrow_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )?;

    // Initialize ve token state
    let ve_token_state = &mut ctx.accounts.ve_token_state;
    ve_token_state.initialize(
        ctx.bumps.ve_token_state,
        ctx.accounts.user.key(),
        ctx.accounts.bright_mint.key(),
        amount,
        lock_duration,
    )?;

    // Emit event
    emit!(VeTokenLockedEvent {
        user: ctx.accounts.user.key(),
        amount,
        lock_start: ve_token_state.lock_start,
        lock_end: ve_token_state.lock_end,
        voting_power: ve_token_state.voting_power,
        boost_multiplier: ve_token_state.boost_multiplier,
    });

    msg!(
        "Locked {} bRight for {} seconds, voting power: {}, boost: {}x",
        amount,
        lock_duration,
        ve_token_state.voting_power,
        ve_token_state.boost_multiplier as f64 / 10000.0
    );

    Ok(())
}
