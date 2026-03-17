use anchor_lang::prelude::*;

use crate::state::ve_token::VeTokenState;

/// Accounts for delegating voting power
#[derive(Accounts)]
pub struct DelegateVote<'info> {
    /// Lock owner
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

/// Delegate voting power to another address
///
/// Allows another wallet to vote on your behalf. The delegate receives
/// your voting power in addition to their own (if any).
pub fn handler(ctx: Context<DelegateVote>, delegate: Pubkey) -> Result<()> {
    let ve_token_state = &mut ctx.accounts.ve_token_state;

    let old_delegate = ve_token_state.delegated_to;
    ve_token_state.delegate(delegate);

    msg!(
        "Delegated voting power from {} to {}",
        old_delegate,
        delegate
    );

    Ok(())
}

/// Accounts for removing delegation
#[derive(Accounts)]
pub struct UndelegateVote<'info> {
    /// Lock owner
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

/// Remove delegation and self-delegate
pub fn undelegate_handler(ctx: Context<UndelegateVote>) -> Result<()> {
    let ve_token_state = &mut ctx.accounts.ve_token_state;

    let old_delegate = ve_token_state.delegated_to;
    ve_token_state.undelegate();

    msg!(
        "Removed delegation from {}, now self-delegating",
        old_delegate
    );

    Ok(())
}

/// Accounts for refreshing voting power
#[derive(Accounts)]
pub struct RefreshVotingPower<'info> {
    /// Anyone can trigger a refresh
    pub payer: Signer<'info>,

    /// VeToken state PDA to refresh
    #[account(mut)]
    pub ve_token_state: Account<'info, VeTokenState>,
}

/// Refresh voting power calculation
///
/// Anyone can call this to update a user's voting power based on current time.
/// Useful for ensuring accurate voting power before governance operations.
pub fn refresh_handler(ctx: Context<RefreshVotingPower>) -> Result<()> {
    let ve_token_state = &mut ctx.accounts.ve_token_state;

    let old_power = ve_token_state.voting_power;
    ve_token_state.refresh_voting_power()?;

    msg!(
        "Refreshed voting power: {} -> {}",
        old_power,
        ve_token_state.voting_power
    );

    Ok(())
}
