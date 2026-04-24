use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

pub use instructions::*;

declare_id!("3RG5h37iiugivHp6R2LkkzaivCoGUnGaMYjV3mgJKmKM");

#[program]
pub mod forecast_vault {
    use super::*;

    pub fn initialize_global_config(
        ctx: Context<InitializeGlobalConfig>,
        params: InitializeGlobalConfigParams,
    ) -> Result<()> {
        instructions::initialize_global_config::handler(ctx, params)
    }

    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        params: InitializeVaultParams,
    ) -> Result<()> {
        instructions::initialize_vault::handler(ctx, params)
    }

    pub fn deposit(
        ctx: Context<Deposit>,
        params: DepositParams,
    ) -> Result<()> {
        instructions::deposit::handler(ctx, params)
    }

    pub fn withdraw(
        ctx: Context<Withdraw>,
        params: WithdrawParams,
    ) -> Result<()> {
        instructions::withdraw::handler(ctx, params)
    }

    pub fn sync_forecaster_policy(
        ctx: Context<SyncForecasterPolicy>,
    ) -> Result<()> {
        instructions::sync_forecaster_policy::handler(ctx)
    }

    pub fn submit_trade_intent(
        ctx: Context<SubmitTradeIntent>,
        params: SubmitTradeIntentParams,
    ) -> Result<()> {
        instructions::submit_trade_intent::handler(ctx, params)
    }

    pub fn cancel_trade_intent(
        ctx: Context<CancelTradeIntent>,
    ) -> Result<()> {
        instructions::cancel_trade_intent::handler(ctx)
    }

    pub fn set_pause(
        ctx: Context<SetPause>,
        params: SetPauseParams,
    ) -> Result<()> {
        instructions::set_pause::handler(ctx, params)
    }
}
