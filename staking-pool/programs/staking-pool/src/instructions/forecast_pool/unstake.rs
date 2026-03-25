use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::StakingPoolError;
use crate::state::{Delegation, ForecastPool, ForecastPoolStatus, PlatformTreasury};

/// Accounts for unstaking tokens from a forecast pool
#[derive(Accounts)]
pub struct UnstakeFromPool<'info> {
    /// Delegator withdrawing tokens
    #[account(mut)]
    pub delegator: Signer<'info>,

    /// Forecast pool to unstake from
    #[account(
        mut,
        constraint = pool.status != ForecastPoolStatus::Paused @ StakingPoolError::PoolFrozen,
    )]
    pub pool: Account<'info, ForecastPool>,

    /// Pool vault holding tokens
    #[account(
        mut,
        constraint = vault.key() == pool.vault @ StakingPoolError::InvalidVault,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// Delegator's token account to receive withdrawal
    #[account(
        mut,
        constraint = delegator_token.owner == delegator.key() @ StakingPoolError::InvalidOwner,
        constraint = delegator_token.mint == pool.token_mint @ StakingPoolError::InvalidMint,
    )]
    pub delegator_token: Account<'info, TokenAccount>,

    /// Delegation account
    #[account(
        mut,
        constraint = delegation.pool == pool.key() @ StakingPoolError::InvalidPool,
        constraint = delegation.delegator == delegator.key() @ StakingPoolError::Unauthorized,
        seeds = [b"delegation", pool.key().as_ref(), delegator.key().as_ref()],
        bump = delegation.bump,
    )]
    pub delegation: Account<'info, Delegation>,

    /// Platform treasury to receive withdrawal fee
    #[account(
        mut,
        seeds = [b"platform_treasury"],
        bump = platform_treasury.bump,
    )]
    pub platform_treasury: Account<'info, PlatformTreasury>,

    /// Treasury token account
    #[account(
        mut,
        constraint = treasury_token.mint == pool.token_mint @ StakingPoolError::InvalidMint,
    )]
    pub treasury_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// Unstake tokens from a forecast pool
///
/// Burns shares and returns tokens to delegator, minus fees:
/// - 0.5% withdrawal fee (always)
/// - 2% early exit fee (if lockup < 7 days)
pub fn handler(ctx: Context<UnstakeFromPool>, shares_to_unstake: u64) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let delegation = &ctx.accounts.delegation;
    let clock = Clock::get()?;

    // 1. Validate shares
    require!(shares_to_unstake > 0, StakingPoolError::InvalidAmount);
    require!(
        shares_to_unstake <= delegation.shares,
        StakingPoolError::InsufficientShares
    );

    // 2. Calculate withdrawal amount
    let gross_amount = pool.calculate_withdrawal(shares_to_unstake);

    // 3. Calculate fees
    let withdrawal_fee = delegation.calculate_withdrawal_fee(gross_amount);
    let net_amount = gross_amount.checked_sub(withdrawal_fee).unwrap();

    // 4. Check liquidity
    require!(
        pool.available_liquidity >= gross_amount,
        StakingPoolError::InsufficientLiquidity
    );

    // 5. Transfer withdrawal fee to treasury
    if withdrawal_fee > 0 {
        let pool_key = ctx.accounts.pool.key();
        let seeds = &[
            b"forecast_pool".as_ref(),
            pool.forecaster.as_ref(),
            &[pool.tier as u8],
            &[pool.bump],
        ];
        let signer_seeds = &[&seeds[..]];

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
            withdrawal_fee,
        )?;
    }

    // 6. Transfer net amount to delegator
    let pool = &ctx.accounts.pool;
    let seeds = &[
        b"forecast_pool".as_ref(),
        pool.forecaster.as_ref(),
        &[pool.tier as u8],
        &[pool.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.delegator_token.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            },
            signer_seeds,
        ),
        net_amount,
    )?;

    // 7. Update pool state
    let pool = &mut ctx.accounts.pool;
    pool.total_value = pool.total_value.checked_sub(gross_amount).unwrap();
    pool.total_shares = pool.total_shares.checked_sub(shares_to_unstake).unwrap();
    pool.available_liquidity = pool.available_liquidity.checked_sub(gross_amount).unwrap();
    pool.last_activity = clock.unix_timestamp;

    // 8. Update delegation
    let delegation = &mut ctx.accounts.delegation;
    delegation.shares = delegation.shares.checked_sub(shares_to_unstake).unwrap();

    // Proportionally reduce deposited_amount
    let original_shares = delegation.shares.checked_add(shares_to_unstake).unwrap();
    let amount_reduction = delegation
        .deposited_amount
        .checked_mul(shares_to_unstake)
        .unwrap()
        .checked_div(original_shares)
        .unwrap_or(delegation.deposited_amount);
    delegation.deposited_amount = delegation.deposited_amount.saturating_sub(amount_reduction);

    // 9. Update delegator count if fully withdrawn
    if delegation.shares == 0 {
        pool.delegator_count = pool.delegator_count.saturating_sub(1);
    }

    // 10. Update treasury stats
    let treasury = &mut ctx.accounts.platform_treasury;
    if pool.tier.is_sol() {
        treasury.total_sol_collected = treasury
            .total_sol_collected
            .checked_add(withdrawal_fee)
            .unwrap();
    } else {
        treasury.total_usdc_collected = treasury
            .total_usdc_collected
            .checked_add(withdrawal_fee)
            .unwrap();
    }

    msg!(
        "Unstaked {} shares for {} tokens (fee: {}). Remaining shares: {}",
        shares_to_unstake,
        net_amount,
        withdrawal_fee,
        delegation.shares
    );

    Ok(())
}

/// Request withdrawal (for timelocked pools - not used in simplified version)
#[derive(Accounts)]
pub struct RequestUnstake<'info> {
    #[account(mut)]
    pub delegator: Signer<'info>,

    #[account(mut)]
    pub pool: Account<'info, ForecastPool>,

    #[account(
        mut,
        constraint = delegation.pool == pool.key() @ StakingPoolError::InvalidPool,
        constraint = delegation.delegator == delegator.key() @ StakingPoolError::Unauthorized,
    )]
    pub delegation: Account<'info, Delegation>,
}

/// Request withdrawal with timelock
pub fn handler_request(ctx: Context<RequestUnstake>, shares: u64) -> Result<()> {
    let delegation = &mut ctx.accounts.delegation;
    let clock = Clock::get()?;

    require!(shares > 0, StakingPoolError::InvalidAmount);
    require!(
        shares <= delegation.shares,
        StakingPoolError::InsufficientShares
    );

    delegation.pending_withdrawal = shares;
    delegation.withdrawal_requested_at = clock.unix_timestamp;

    msg!("Withdrawal requested: {} shares", shares);

    Ok(())
}
