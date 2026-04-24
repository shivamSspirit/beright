use anchor_lang::prelude::*;

use crate::errors::ForecastVaultError;
use crate::state::{GlobalConfig, VaultState};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SetPauseParams {
    pub protocol_paused: Option<bool>,
    pub prediction_paused: Option<bool>,
    pub vault_paused: Option<bool>,
}

#[derive(Accounts)]
pub struct SetPause<'info> {
    #[account(
        mut,
        seeds = [b"global-config"],
        bump = global_config.bump,
        has_one = authority
    )]
    pub global_config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub vault_state: Option<Account<'info, VaultState>>,
    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<SetPause>, params: SetPauseParams) -> Result<()> {
    if let Some(protocol_paused) = params.protocol_paused {
        ctx.accounts.global_config.protocol_paused = protocol_paused;
    }

    if let Some(prediction_paused) = params.prediction_paused {
        ctx.accounts.global_config.prediction_paused = prediction_paused;
    }

    if let Some(vault_paused) = params.vault_paused {
        let vault_state = ctx
            .accounts
            .vault_state
            .as_deref_mut()
            .ok_or(ForecastVaultError::Unauthorized)?;
        vault_state.paused = vault_paused;
    }

    Ok(())
}
