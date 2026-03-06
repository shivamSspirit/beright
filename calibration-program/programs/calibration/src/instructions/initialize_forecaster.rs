use anchor_lang::prelude::*;
use crate::state::ForecasterState;
use crate::events::ForecasterInitialized;

/// Initialize a forecaster's calibration tracking state
#[derive(Accounts)]
pub struct InitializeForecaster<'info> {
    /// Forecaster's wallet (authority)
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Forecaster state account (PDA)
    #[account(
        init,
        payer = authority,
        space = ForecasterState::LEN,
        seeds = [b"forecaster", authority.key().as_ref()],
        bump
    )]
    pub forecaster_state: Account<'info, ForecasterState>,

    /// System program
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeForecaster>) -> Result<()> {
    let forecaster_state = &mut ctx.accounts.forecaster_state;
    let authority = ctx.accounts.authority.key();
    let bump = ctx.bumps.forecaster_state;

    // Initialize the forecaster state
    forecaster_state.initialize(authority, bump)?;

    // Emit event
    emit!(ForecasterInitialized {
        forecaster: authority,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!(
        "Forecaster initialized: {} (bump: {})",
        authority,
        bump
    );

    Ok(())
}
