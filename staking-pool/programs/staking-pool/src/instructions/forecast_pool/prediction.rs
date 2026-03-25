use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::StakingPoolError;
use crate::state::{ForecastPool, ForecastPoolStatus, PlatformTreasury, PoolPrediction};

/// Accounts for opening a prediction using pool capital
#[derive(Accounts)]
#[instruction(prediction_index: u8)]
pub struct OpenPoolPrediction<'info> {
    /// Forecaster (pool owner) making the prediction
    #[account(mut)]
    pub forecaster: Signer<'info>,

    /// Forecast pool
    #[account(
        mut,
        constraint = pool.forecaster == forecaster.key() @ StakingPoolError::Unauthorized,
        constraint = pool.status == ForecastPoolStatus::Active @ StakingPoolError::PoolNotActive,
    )]
    pub pool: Account<'info, ForecastPool>,

    /// Prediction account
    #[account(
        init,
        payer = forecaster,
        space = PoolPrediction::LEN,
        seeds = [b"pool_prediction", pool.key().as_ref(), &[prediction_index]],
        bump,
    )]
    pub prediction: Account<'info, PoolPrediction>,

    pub system_program: Program<'info, System>,
}

/// Open a prediction using pool capital
///
/// Records a new prediction but doesn't actually move funds (that happens off-chain
/// through the prediction market platform). The amount is tracked for accounting.
pub fn handler_open(
    ctx: Context<OpenPoolPrediction>,
    prediction_index: u8,
    market_id: [u8; 32],
    platform: u8,
    side: u8,
    amount: u64,
    entry_price: u64, // Scaled 1e6
) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let prediction = &mut ctx.accounts.prediction;
    let clock = Clock::get()?;

    // 1. Validate amount
    require!(amount > 0, StakingPoolError::InvalidAmount);
    require!(
        amount >= pool.min_position_size(),
        StakingPoolError::InvalidAmount
    );
    require!(
        amount <= pool.max_position_size(),
        StakingPoolError::DriftPositionTooLarge
    );

    // 2. Check available liquidity
    require!(
        pool.available_liquidity >= amount,
        StakingPoolError::InsufficientLiquidity
    );

    // 3. Initialize prediction
    prediction.bump = ctx.bumps.prediction;
    prediction.pool = pool.key();
    prediction.market_id = market_id;
    prediction.platform = platform;
    prediction.side = side;
    prediction.amount = amount;
    prediction.entry_price = entry_price;
    prediction.exit_price = 0;
    prediction.pnl = 0;
    prediction.status = PoolPrediction::STATUS_OPEN;
    prediction.opened_at = clock.unix_timestamp;
    prediction.closed_at = 0;
    prediction._reserved = [0; 16];

    // 4. Update pool state
    pool.available_liquidity = pool.available_liquidity.checked_sub(amount).unwrap();
    pool.prediction_count = pool.prediction_count.checked_add(1).unwrap();
    pool.last_activity = clock.unix_timestamp;

    msg!(
        "Prediction opened: market={:?}, side={}, amount={}, entry_price={}",
        market_id,
        if side == PoolPrediction::SIDE_YES { "YES" } else { "NO" },
        amount,
        entry_price
    );

    Ok(())
}

/// Accounts for resolving a prediction
#[derive(Accounts)]
#[instruction(prediction_index: u8)]
pub struct ResolvePoolPrediction<'info> {
    /// Forecaster (pool owner) or resolver
    #[account(mut)]
    pub resolver: Signer<'info>,

    /// Forecast pool
    #[account(
        mut,
        constraint = pool.forecaster == resolver.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool: Account<'info, ForecastPool>,

    /// Pool vault holding tokens
    #[account(
        mut,
        constraint = vault.key() == pool.vault @ StakingPoolError::InvalidVault,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// Prediction account
    #[account(
        mut,
        constraint = prediction.pool == pool.key() @ StakingPoolError::InvalidPool,
        constraint = prediction.status == PoolPrediction::STATUS_OPEN @ StakingPoolError::DriftPositionNotOpen,
        seeds = [b"pool_prediction", pool.key().as_ref(), &[prediction_index]],
        bump = prediction.bump,
    )]
    pub prediction: Account<'info, PoolPrediction>,

    /// Forecaster's token account (receives 30% of profit)
    #[account(
        mut,
        constraint = forecaster_token.owner == pool.forecaster @ StakingPoolError::InvalidOwner,
        constraint = forecaster_token.mint == pool.token_mint @ StakingPoolError::InvalidMint,
    )]
    pub forecaster_token: Account<'info, TokenAccount>,

    /// Platform treasury account
    #[account(
        mut,
        seeds = [b"platform_treasury"],
        bump = platform_treasury.bump,
    )]
    pub platform_treasury: Account<'info, PlatformTreasury>,

    /// Treasury token account (receives 20% of profit)
    #[account(
        mut,
        constraint = treasury_token.mint == pool.token_mint @ StakingPoolError::InvalidMint,
    )]
    pub treasury_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// Resolve a prediction and distribute profits
///
/// When a prediction resolves:
/// - WIN: Distribute profit 30% forecaster, 50% delegators, 20% platform
/// - LOSS: Deduct loss from pool (delegators bear the risk)
///
/// Note: In production, funds should be transferred back from the prediction
/// market before calling this. This instruction handles the accounting.
pub fn handler_resolve(
    ctx: Context<ResolvePoolPrediction>,
    _prediction_index: u8,
    won: bool,
    exit_price: u64, // Scaled 1e6
    realized_amount: u64, // Actual amount returned from prediction market
) -> Result<()> {
    let clock = Clock::get()?;

    // 1. Extract all values needed from pool (immutable read)
    let principal = ctx.accounts.prediction.amount;
    let forecaster_key = ctx.accounts.pool.forecaster;
    let tier_byte = ctx.accounts.pool.tier as u8;
    let bump = ctx.accounts.pool.bump;
    let is_sol = ctx.accounts.pool.tier.is_sol();
    let revenue_split = ctx.accounts.pool.revenue_split;

    // 2. Calculate P&L
    let pnl: i64 = (realized_amount as i64).checked_sub(principal as i64).unwrap();

    // 3. Calculate profit distribution if profitable
    let (forecaster_share, delegator_share, platform_share) = if pnl > 0 {
        let profit = pnl as u64;
        (
            profit.checked_mul(revenue_split.forecaster_bps as u64).unwrap().checked_div(10000).unwrap(),
            profit.checked_mul(revenue_split.delegator_bps as u64).unwrap().checked_div(10000).unwrap(),
            profit.checked_mul(revenue_split.platform_bps as u64).unwrap().checked_div(10000).unwrap(),
        )
    } else {
        (0, 0, 0)
    };

    // 4. Do CPI transfers if there's profit (before any mutable borrows)
    if pnl > 0 {
        // Build seeds with owned values
        let seeds: &[&[u8]] = &[
            b"forecast_pool",
            forecaster_key.as_ref(),
            &[tier_byte],
            &[bump],
        ];
        let signer_seeds = &[seeds];

        // Transfer forecaster share
        if forecaster_share > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.forecaster_token.to_account_info(),
                        authority: ctx.accounts.pool.to_account_info(),
                    },
                    signer_seeds,
                ),
                forecaster_share,
            )?;
        }

        // Transfer platform share
        if platform_share > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.treasury_token.to_account_info(),
                        authority: ctx.accounts.pool.to_account_info(),
                    },
                    signer_seeds,
                ),
                platform_share,
            )?;
        }
    }

    // 5. Now do all mutable state updates
    // Update prediction state
    let prediction = &mut ctx.accounts.prediction;
    prediction.exit_price = exit_price;
    prediction.pnl = pnl;
    prediction.status = if won {
        PoolPrediction::STATUS_WON
    } else {
        PoolPrediction::STATUS_LOST
    };
    prediction.closed_at = clock.unix_timestamp;

    // Update pool state
    let pool = &mut ctx.accounts.pool;
    if won {
        pool.wins_count = pool.wins_count.checked_add(1).unwrap();
    } else {
        pool.losses_count = pool.losses_count.checked_add(1).unwrap();
    }

    if pnl > 0 {
        pool.forecaster_earnings = pool.forecaster_earnings.checked_add(forecaster_share).unwrap();
        pool.platform_earnings = pool.platform_earnings.checked_add(platform_share).unwrap();
        // Delegator share stays in pool (increases share price)
        pool.total_value = pool.total_value.checked_add(delegator_share).unwrap();
        pool.available_liquidity = pool.available_liquidity
            .checked_add(principal).unwrap()
            .checked_add(delegator_share).unwrap();

        msg!(
            "Prediction WON: profit={}, forecaster={}, delegators={}, platform={}",
            pnl,
            forecaster_share,
            delegator_share,
            platform_share
        );
    } else if pnl < 0 {
        let loss = (-pnl) as u64;
        pool.total_value = pool.total_value.saturating_sub(loss);
        pool.available_liquidity = pool.available_liquidity.checked_add(realized_amount).unwrap();
        msg!("Prediction LOST: loss={}", loss);
    } else {
        pool.available_liquidity = pool.available_liquidity.checked_add(principal).unwrap();
        msg!("Prediction broke even");
    }

    // Update share price and timestamp
    pool.update_share_price();
    pool.last_activity = clock.unix_timestamp;

    // Update treasury stats
    if platform_share > 0 {
        let treasury = &mut ctx.accounts.platform_treasury;
        if is_sol {
            treasury.total_sol_collected = treasury.total_sol_collected.checked_add(platform_share).unwrap();
        } else {
            treasury.total_usdc_collected = treasury.total_usdc_collected.checked_add(platform_share).unwrap();
        }
    }

    Ok(())
}

/// Cancel an open prediction (e.g., market voided)
#[derive(Accounts)]
#[instruction(prediction_index: u8)]
pub struct CancelPoolPrediction<'info> {
    #[account(mut)]
    pub forecaster: Signer<'info>,

    #[account(
        mut,
        constraint = pool.forecaster == forecaster.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool: Account<'info, ForecastPool>,

    #[account(
        mut,
        constraint = prediction.pool == pool.key() @ StakingPoolError::InvalidPool,
        constraint = prediction.status == PoolPrediction::STATUS_OPEN @ StakingPoolError::DriftPositionNotOpen,
        seeds = [b"pool_prediction", pool.key().as_ref(), &[prediction_index]],
        bump = prediction.bump,
    )]
    pub prediction: Account<'info, PoolPrediction>,
}

/// Cancel a prediction (market voided or error)
pub fn handler_cancel(ctx: Context<CancelPoolPrediction>, prediction_index: u8) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let prediction = &mut ctx.accounts.prediction;
    let clock = Clock::get()?;

    // Return amount to available liquidity
    pool.available_liquidity = pool
        .available_liquidity
        .checked_add(prediction.amount)
        .unwrap();

    // Update prediction status
    prediction.status = PoolPrediction::STATUS_CANCELLED;
    prediction.closed_at = clock.unix_timestamp;

    pool.last_activity = clock.unix_timestamp;

    msg!("Prediction cancelled: amount returned={}", prediction.amount);

    Ok(())
}
