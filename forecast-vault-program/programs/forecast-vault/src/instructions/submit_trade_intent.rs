use anchor_lang::prelude::*;

use crate::errors::ForecastVaultError;
use crate::state::{ForecasterPolicy, GlobalConfig, TradeIntent, VaultConfig, VaultState};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SubmitTradeIntentParams {
    pub intent_id: [u8; 32],
    pub basket_id: [u8; 32],
    pub market_id_hash: [u8; 32],
    pub side: u8,
    pub max_size: u64,
    pub limit_price_bps: u16,
    pub expiry_slot: u64,
}

#[derive(Accounts)]
#[instruction(params: SubmitTradeIntentParams)]
pub struct SubmitTradeIntent<'info> {
    #[account(
        seeds = [b"global-config"],
        bump = global_config.bump
    )]
    pub global_config: Account<'info, GlobalConfig>,
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
        init,
        payer = forecaster,
        space = 8 + TradeIntent::LEN,
        seeds = [
            b"trade-intent",
            vault_config.key().as_ref(),
            forecaster.key().as_ref(),
            &params.intent_id
        ],
        bump
    )]
    pub trade_intent: Account<'info, TradeIntent>,
    #[account(mut)]
    pub forecaster: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<SubmitTradeIntent>,
    params: SubmitTradeIntentParams,
) -> Result<()> {
    require!(!ctx.accounts.global_config.protocol_paused, ForecastVaultError::ProtocolPaused);
    require!(!ctx.accounts.global_config.prediction_paused, ForecastVaultError::PredictionSleevePaused);
    require!(!ctx.accounts.vault_state.paused, ForecastVaultError::VaultPaused);
    require!(ctx.accounts.forecaster_policy.active, ForecastVaultError::ForecasterPolicyInactive);
    require!(params.expiry_slot > Clock::get()?.slot, ForecastVaultError::TradeIntentExpired);
    require!(params.max_size > 0, ForecastVaultError::InvalidAmount);
    require!(params.limit_price_bps <= 10_000, ForecastVaultError::InvalidAmount);
    require!(params.side <= 1, ForecastVaultError::InvalidAmount);

    let available_policy_budget = ctx.accounts.forecaster_policy.available_budget()?;
    require!(
        params.max_size <= available_policy_budget,
        ForecastVaultError::ForecasterBudgetExceeded
    );

    let available_prediction_capacity = ctx.accounts.vault_state.current_prediction_capacity()?;
    require!(
        params.max_size <= available_prediction_capacity,
        ForecastVaultError::PredictionSleeveCapacityExceeded
    );

    let forecaster_policy = &mut ctx.accounts.forecaster_policy;
    forecaster_policy.locked_budget = forecaster_policy
        .locked_budget
        .checked_add(params.max_size)
        .ok_or(ForecastVaultError::MathOverflow)?;

    let vault_state = &mut ctx.accounts.vault_state;
    vault_state.total_locked_prediction_budget = vault_state
        .total_locked_prediction_budget
        .checked_add(params.max_size)
        .ok_or(ForecastVaultError::MathOverflow)?;

    let trade_intent = &mut ctx.accounts.trade_intent;
    trade_intent.bump = ctx.bumps.trade_intent;
    trade_intent.vault_config = ctx.accounts.vault_config.key();
    trade_intent.forecaster = ctx.accounts.forecaster.key();
    trade_intent.intent_id = params.intent_id;
    trade_intent.basket_id = params.basket_id;
    trade_intent.market_id_hash = params.market_id_hash;
    trade_intent.side = params.side;
    trade_intent.max_size = params.max_size;
    trade_intent.limit_price_bps = params.limit_price_bps;
    trade_intent.expiry_slot = params.expiry_slot;
    trade_intent.created_slot = Clock::get()?.slot;
    trade_intent.locked_budget = params.max_size;
    trade_intent.status = TradeIntent::STATUS_OPEN;
    trade_intent._reserved = [0; 32];

    Ok(())
}
