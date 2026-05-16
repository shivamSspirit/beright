use anchor_lang::prelude::*;

use crate::errors::CalibrationError;
use crate::events::{ScoreConfigInitialized, ScoreConfigUpdated};
use crate::state::ScoreConfig;

#[derive(Accounts)]
pub struct InitializeScoreConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = ScoreConfig::LEN,
        seeds = [b"score_config"],
        bump
    )]
    pub score_config: Account<'info, ScoreConfig>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_handler(ctx: Context<InitializeScoreConfig>) -> Result<()> {
    let authority = ctx.accounts.authority.key();
    let bump = ctx.bumps.score_config;
    let score_config = &mut ctx.accounts.score_config;

    score_config.initialize(authority, bump)?;

    emit!(ScoreConfigInitialized {
        authority,
        score_version: score_config.accepted_score_version,
        paused: score_config.paused,
        slot: score_config.last_updated_slot,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateScoreConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"score_config"],
        bump = score_config.bump,
        has_one = authority @ CalibrationError::Unauthorized
    )]
    pub score_config: Account<'info, ScoreConfig>,
}

pub fn update_handler(
    ctx: Context<UpdateScoreConfig>,
    next_authority: Pubkey,
    accepted_score_version: u8,
    paused: bool,
) -> Result<()> {
    let score_config = &mut ctx.accounts.score_config;

    score_config.update(next_authority, accepted_score_version, paused)?;

    emit!(ScoreConfigUpdated {
        authority: ctx.accounts.authority.key(),
        next_authority,
        score_version: score_config.accepted_score_version,
        paused: score_config.paused,
        slot: score_config.last_updated_slot,
    });

    Ok(())
}
