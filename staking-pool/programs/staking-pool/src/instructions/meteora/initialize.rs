use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::errors::StakingPoolError;
use crate::events::MeteoraVaultInitializedEvent;
use crate::state::{MeteoraVaultState, StakingPoolState};

use super::METEORA_VAULT_STATE_SEED;

/// Accounts for initializing Meteora vault integration
#[derive(Accounts)]
pub struct InitializeMeteoraVault<'info> {
    /// Pool forecaster (must be pool owner)
    #[account(mut)]
    pub forecaster: Signer<'info>,

    /// The staking pool to add Meteora integration to
    #[account(
        mut,
        constraint = pool_state.forecaster == forecaster.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool_state: Account<'info, StakingPoolState>,

    /// The Meteora vault state PDA (to be created)
    #[account(
        init,
        payer = forecaster,
        space = MeteoraVaultState::LEN,
        seeds = [METEORA_VAULT_STATE_SEED, pool_state.key().as_ref()],
        bump,
    )]
    pub meteora_state: Account<'info, MeteoraVaultState>,

    /// The Meteora vault we're integrating with
    /// CHECK: Validated by checking it's owned by Meteora program
    pub meteora_vault: AccountInfo<'info>,

    /// LP token mint for the Meteora vault
    pub vault_lp_mint: Account<'info, Mint>,

    /// The underlying token mint (e.g., USDC)
    pub underlying_mint: Account<'info, Mint>,

    /// Pool's token account for the underlying asset
    #[account(
        constraint = pool_underlying_account.mint == underlying_mint.key() @ StakingPoolError::InvalidMint,
        constraint = pool_underlying_account.owner == pool_state.key() @ StakingPoolError::InvalidVault,
    )]
    pub pool_underlying_account: Account<'info, TokenAccount>,

    /// Pool's LP token account (will receive LP tokens on deposit)
    #[account(
        init_if_needed,
        payer = forecaster,
        associated_token::mint = vault_lp_mint,
        associated_token::authority = pool_state,
    )]
    pub pool_lp_account: Account<'info, TokenAccount>,

    /// Meteora vault program
    /// CHECK: Verified by address constraint
    #[account(address = super::METEORA_VAULT_PROGRAM_ID)]
    pub meteora_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

/// Initialize Meteora vault integration for a staking pool
///
/// This sets up the pool to route idle capital to a Meteora Dynamic Vault
/// for yield generation.
///
/// # Arguments
/// * `allocation_bps` - Percentage of idle capital to allocate (basis points, max 10000)
/// * `min_deposit` - Minimum deposit amount to prevent dust
pub fn handler(
    ctx: Context<InitializeMeteoraVault>,
    allocation_bps: u16,
    min_deposit: u64,
) -> Result<()> {
    // Validate allocation
    require!(
        allocation_bps <= MeteoraVaultState::MAX_ALLOCATION_BPS,
        StakingPoolError::InvalidAllocation
    );

    // Validate minimum deposit
    require!(min_deposit > 0, StakingPoolError::InvalidAmount);

    let pool_key = ctx.accounts.pool_state.key();
    let meteora_state = &mut ctx.accounts.meteora_state;

    // Initialize the Meteora vault state
    meteora_state.initialize(
        ctx.bumps.meteora_state,
        pool_key,
        ctx.accounts.meteora_vault.key(),
        ctx.accounts.vault_lp_mint.key(),
        ctx.accounts.underlying_mint.key(),
        allocation_bps,
        min_deposit,
    )?;

    let clock = Clock::get()?;

    // Emit initialization event
    emit!(MeteoraVaultInitializedEvent {
        pool: pool_key,
        meteora_vault: ctx.accounts.meteora_vault.key(),
        vault_lp_mint: ctx.accounts.vault_lp_mint.key(),
        underlying_mint: ctx.accounts.underlying_mint.key(),
        allocation_bps,
        min_deposit,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Initialized Meteora vault integration for pool {} with {}% allocation",
        pool_key,
        allocation_bps as f64 / 100.0
    );

    Ok(())
}
