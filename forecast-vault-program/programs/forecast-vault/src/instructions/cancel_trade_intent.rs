use anchor_lang::prelude::*;

use crate::errors::ForecastVaultError;
use crate::state::{ForecasterPolicy, TradeIntent, VaultConfig, VaultState};

#[derive(Accounts)]
pub struct CancelTradeIntent<'info> {
    pub vault_config: Account<'info, VaultConfig>,
    #[account(
        mut,
        seeds = [b"vault-state", vault_config.key().as_ref()],
        bump = vault_state.bump,
        constraint = vault_state.vault_config == vault_config.key() @ ForecastVaultError::InvalidVaultState
    )]
    pub vault_state: Account<'info, VaultState>,
    #[account(
        mut,
        has_one = vault_config,
        has_one = forecaster
    )]
    pub forecaster_policy: Account<'info, ForecasterPolicy>,
    #[account(
        mut,
        constraint = trade_intent.vault_config == vault_config.key() @ ForecastVaultError::InvalidVaultState,
        constraint = trade_intent.forecaster == forecaster.key() @ ForecastVaultError::Unauthorized,
        constraint = trade_intent.status == TradeIntent::STATUS_OPEN @ ForecastVaultError::TradeIntentNotOpen
    )]
    pub trade_intent: Account<'info, TradeIntent>,
    pub forecaster: Signer<'info>,
}

pub fn handler(ctx: Context<CancelTradeIntent>) -> Result<()> {
    let locked_budget = ctx.accounts.trade_intent.locked_budget;

    let forecaster_policy = &mut ctx.accounts.forecaster_policy;
    forecaster_policy.locked_budget = forecaster_policy
        .locked_budget
        .checked_sub(locked_budget)
        .ok_or(ForecastVaultError::MathOverflow)?;

    let vault_state = &mut ctx.accounts.vault_state;
    vault_state.total_locked_prediction_budget = vault_state
        .total_locked_prediction_budget
        .checked_sub(locked_budget)
        .ok_or(ForecastVaultError::MathOverflow)?;

    ctx.accounts.trade_intent.status = TradeIntent::STATUS_CANCELLED;
    ctx.accounts.trade_intent.locked_budget = 0;

    Ok(())
}
