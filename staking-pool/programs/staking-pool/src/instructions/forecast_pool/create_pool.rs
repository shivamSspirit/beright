use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

use crate::errors::StakingPoolError;
use crate::state::{Delegation, ForecastPool, ForecastPoolStatus, PoolTier, PlatformTreasury};

/// Accounts for creating a new forecaster pool (one-click)
#[derive(Accounts)]
#[instruction(tier: PoolTier)]
pub struct CreateForecastPool<'info> {
    /// Forecaster creating the pool
    #[account(mut)]
    pub forecaster: Signer<'info>,

    /// Forecast pool state account
    #[account(
        init,
        payer = forecaster,
        space = ForecastPool::LEN,
        seeds = [b"forecast_pool", forecaster.key().as_ref(), &[tier as u8]],
        bump,
    )]
    pub pool: Account<'info, ForecastPool>,

    /// Token mint for the pool (wSOL for SOL pools, USDC for USDC pools)
    pub token_mint: Account<'info, Mint>,

    /// Pool vault for holding staked tokens
    #[account(
        init,
        payer = forecaster,
        token::mint = token_mint,
        token::authority = pool,
        seeds = [b"pool_vault", pool.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// Platform treasury to receive creation fee
    #[account(
        mut,
        seeds = [b"platform_treasury"],
        bump = platform_treasury.bump,
    )]
    pub platform_treasury: Account<'info, PlatformTreasury>,

    /// Treasury SOL account to receive creation fee
    /// CHECK: This is the treasury's SOL receiving account
    #[account(mut)]
    pub treasury_sol: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Create forecaster pool handler (one-click)
///
/// Creates a new staking pool for forecasters with a specific tier.
/// Tier determines capacity and eligibility requirements.
pub fn handler(
    ctx: Context<CreateForecastPool>,
    tier: PoolTier,
    // Passed from frontend, validated against calibration program
    brier_score_scaled: u64, // Brier * 1000 (e.g., 0.25 = 250)
    prediction_count: u32,
) -> Result<()> {
    // 1. Validate tier eligibility
    require!(
        brier_score_scaled <= tier.max_brier_score(),
        StakingPoolError::BrierScoreTooHigh
    );
    require!(
        prediction_count >= tier.min_predictions(),
        StakingPoolError::InsufficientPredictions
    );

    // 2. Validate token mint matches tier
    // For SOL pools, we expect wrapped SOL mint
    // For USDC pools, we expect USDC mint
    let is_sol_mint = ctx.accounts.token_mint.decimals == 9;
    let is_usdc_mint = ctx.accounts.token_mint.decimals == 6;

    if tier.is_sol() {
        require!(is_sol_mint, StakingPoolError::InvalidMint);
    } else {
        require!(is_usdc_mint, StakingPoolError::InvalidMint);
    }

    // 3. Collect creation fee (0.1 SOL)
    let creation_fee = ForecastPool::CREATION_FEE;
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.forecaster.to_account_info(),
                to: ctx.accounts.treasury_sol.to_account_info(),
            },
        ),
        creation_fee,
    )?;

    // 4. Initialize pool state
    let pool = &mut ctx.accounts.pool;
    pool.initialize(
        ctx.bumps.pool,
        ctx.accounts.forecaster.key(),
        tier,
        ctx.accounts.token_mint.key(),
        ctx.accounts.vault.key(),
    )?;

    msg!(
        "Forecast pool created: forecaster={}, tier={:?}, capacity={}",
        ctx.accounts.forecaster.key(),
        tier,
        tier.capacity()
    );

    Ok(())
}

/// Alternative: Create pool without eligibility check (for testing/demo)
#[derive(Accounts)]
#[instruction(tier: PoolTier)]
pub struct CreateForecastPoolDemo<'info> {
    #[account(mut)]
    pub forecaster: Signer<'info>,

    #[account(
        init,
        payer = forecaster,
        space = ForecastPool::LEN,
        seeds = [b"forecast_pool", forecaster.key().as_ref(), &[tier as u8]],
        bump,
    )]
    pub pool: Account<'info, ForecastPool>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = forecaster,
        token::mint = token_mint,
        token::authority = pool,
        seeds = [b"pool_vault", pool.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Create pool for demo/testing (no eligibility check)
pub fn handler_demo(ctx: Context<CreateForecastPoolDemo>, tier: PoolTier) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    pool.initialize(
        ctx.bumps.pool,
        ctx.accounts.forecaster.key(),
        tier,
        ctx.accounts.token_mint.key(),
        ctx.accounts.vault.key(),
    )?;

    msg!(
        "Demo pool created: forecaster={}, tier={:?}",
        ctx.accounts.forecaster.key(),
        tier
    );

    Ok(())
}
