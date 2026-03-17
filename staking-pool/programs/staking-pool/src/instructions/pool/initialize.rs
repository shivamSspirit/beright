use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token},
};

use crate::errors::StakingPoolError;
use crate::events::PoolInitialized;
use crate::state::{PoolConfig, PoolMintAuthority, PoolType, StakingPoolState};
use crate::utils::tier::{calculate_max_capacity, calculate_tier, can_create_pool};

/// Accounts for initializing a new staking pool
#[derive(Accounts)]
#[instruction(pool_type: PoolType, config: PoolConfig)]
pub struct InitializePool<'info> {
    /// Forecaster creating the pool - must be Verified tier or above
    #[account(mut)]
    pub forecaster: Signer<'info>,

    /// Pool state account
    #[account(
        init,
        payer = forecaster,
        space = StakingPoolState::LEN,
        seeds = [b"staking_pool", forecaster.key().as_ref()],
        bump,
    )]
    pub pool_state: Account<'info, StakingPoolState>,

    /// Pool share token mint (bRight derivative)
    #[account(
        init,
        payer = forecaster,
        mint::decimals = 6,
        mint::authority = pool_mint_authority,
        mint::freeze_authority = pool_mint_authority,
    )]
    pub pool_mint: Account<'info, Mint>,

    /// PDA authority for minting pool tokens
    #[account(
        init,
        payer = forecaster,
        space = PoolMintAuthority::LEN,
        seeds = [b"pool_mint_authority", pool_state.key().as_ref()],
        bump,
    )]
    pub pool_mint_authority: Account<'info, PoolMintAuthority>,

    /// Base token mint (USDC) for deposits
    pub base_token_mint: Account<'info, Mint>,

    /// Pool's base token vault (for holding deposits)
    /// CHECK: Created by init; authority is pool_state
    #[account(
        init,
        payer = forecaster,
        associated_token::mint = base_token_mint,
        associated_token::authority = pool_state,
    )]
    pub pool_vault: Account<'info, anchor_spl::token::TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Initialize pool handler
///
/// This instruction creates a new staking pool for a forecaster.
/// Requirements:
/// - Forecaster must be Verified tier or above (Brier < 0.25, 20+ predictions)
/// - Pool capacity is determined by tier and Brier score
pub fn handler(
    ctx: Context<InitializePool>,
    pool_type: PoolType,
    config: PoolConfig,
    // These would come from CPI to calibration program in production
    avg_brier_score: f64,
    resolved_predictions: u32,
) -> Result<()> {
    // 1. Calculate forecaster tier
    let tier = calculate_tier(avg_brier_score, resolved_predictions);

    // 2. Verify tier eligibility
    require!(
        can_create_pool(tier),
        StakingPoolError::InsufficientTier
    );

    // 3. Calculate max capacity based on tier and Brier
    let max_capacity = calculate_max_capacity(tier, avg_brier_score);

    // 4. Validate config
    require!(
        config.min_lock_period >= 0 && config.min_lock_period <= StakingPoolState::MAX_LOCK_PERIOD,
        StakingPoolError::InvalidConfig
    );
    require!(
        config.withdrawal_delay >= 0 && config.withdrawal_delay <= StakingPoolState::MAX_WITHDRAWAL_DELAY,
        StakingPoolError::InvalidConfig
    );
    require!(
        config.performance_fee_bps <= 5000, // Max 50%
        StakingPoolError::InvalidConfig
    );
    require!(
        config.management_fee_bps <= 500, // Max 5%
        StakingPoolError::InvalidConfig
    );

    // 5. Initialize pool mint authority
    let pool_mint_authority = &mut ctx.accounts.pool_mint_authority;
    pool_mint_authority.bump = ctx.bumps.pool_mint_authority;
    pool_mint_authority.pool = ctx.accounts.pool_state.key();

    // 6. Initialize pool state
    let pool_state = &mut ctx.accounts.pool_state;
    pool_state.initialize(
        ctx.bumps.pool_state,
        ctx.accounts.forecaster.key(),
        ctx.accounts.pool_mint.key(),
        ctx.accounts.base_token_mint.key(),
        pool_type,
        config,
        tier,
        max_capacity,
    )?;

    // 7. Emit event
    let clock = Clock::get()?;
    emit!(PoolInitialized {
        pool: ctx.accounts.pool_state.key(),
        forecaster: ctx.accounts.forecaster.key(),
        pool_mint: ctx.accounts.pool_mint.key(),
        base_token: ctx.accounts.base_token_mint.key(),
        pool_type: pool_type as u8,
        max_capacity,
        tier_at_creation: tier as u8,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Pool initialized: forecaster={}, tier={:?}, max_capacity={}",
        ctx.accounts.forecaster.key(),
        tier,
        max_capacity
    );

    Ok(())
}
