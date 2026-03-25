use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::StakingPoolError;
use crate::state::{Delegation, ForecastPool, ForecastPoolStatus};

/// Accounts for staking tokens to a forecast pool
#[derive(Accounts)]
pub struct StakeToPool<'info> {
    /// Delegator staking tokens
    #[account(mut)]
    pub delegator: Signer<'info>,

    /// Forecast pool to stake to
    #[account(
        mut,
        constraint = pool.status == ForecastPoolStatus::Active @ StakingPoolError::PoolNotActive,
    )]
    pub pool: Account<'info, ForecastPool>,

    /// Pool vault to receive tokens
    #[account(
        mut,
        constraint = vault.key() == pool.vault @ StakingPoolError::InvalidVault,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// Delegator's token account
    #[account(
        mut,
        constraint = delegator_token.owner == delegator.key() @ StakingPoolError::InvalidOwner,
        constraint = delegator_token.mint == pool.token_mint @ StakingPoolError::InvalidMint,
    )]
    pub delegator_token: Account<'info, TokenAccount>,

    /// Delegation account (created if new delegator)
    #[account(
        init_if_needed,
        payer = delegator,
        space = Delegation::LEN,
        seeds = [b"delegation", pool.key().as_ref(), delegator.key().as_ref()],
        bump,
    )]
    pub delegation: Account<'info, Delegation>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Stake tokens to a forecast pool
///
/// Delegators deposit tokens and receive pool shares proportional
/// to the current share price. Shares entitle delegators to 50%
/// of pool profits.
pub fn handler(ctx: Context<StakeToPool>, amount: u64) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let delegation = &mut ctx.accounts.delegation;
    let clock = Clock::get()?;

    // 1. Validate amount
    require!(amount > 0, StakingPoolError::ZeroDeposit);
    require!(
        amount >= pool.tier.min_deposit(),
        StakingPoolError::BelowMinimumDeposit
    );

    // 2. Check pool has capacity
    require!(
        pool.total_value.checked_add(amount).unwrap() <= pool.capacity,
        StakingPoolError::ExceedsCapacity
    );

    // 3. Calculate shares
    let shares = pool.calculate_shares(amount);
    require!(shares > 0, StakingPoolError::ZeroDeposit);

    // 4. Transfer tokens to vault
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.delegator_token.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.delegator.to_account_info(),
            },
        ),
        amount,
    )?;

    // 5. Update pool state
    pool.total_value = pool.total_value.checked_add(amount).unwrap();
    pool.total_shares = pool.total_shares.checked_add(shares).unwrap();
    pool.available_liquidity = pool.available_liquidity.checked_add(amount).unwrap();
    pool.last_activity = clock.unix_timestamp;

    // 6. Update or initialize delegation
    let is_new_delegator = delegation.deposited_at == 0;

    if is_new_delegator {
        delegation.bump = ctx.bumps.delegation;
        delegation.pool = pool.key();
        delegation.delegator = ctx.accounts.delegator.key();
        delegation.deposited_at = clock.unix_timestamp;
        delegation.last_claim_at = clock.unix_timestamp;
        pool.delegator_count = pool.delegator_count.checked_add(1).unwrap();
    }

    delegation.shares = delegation.shares.checked_add(shares).unwrap();
    delegation.deposited_amount = delegation.deposited_amount.checked_add(amount).unwrap();

    msg!(
        "Staked {} tokens to pool, received {} shares. Pool TVL: {}",
        amount,
        shares,
        pool.total_value
    );

    Ok(())
}

/// Calculate value of delegation at current share price
pub fn calculate_delegation_value(pool: &ForecastPool, delegation: &Delegation) -> u64 {
    pool.calculate_withdrawal(delegation.shares)
}

/// Calculate P&L for delegation
pub fn calculate_delegation_pnl(pool: &ForecastPool, delegation: &Delegation) -> i64 {
    let current_value = calculate_delegation_value(pool, delegation) as i64;
    let deposited = delegation.deposited_amount as i64;
    current_value - deposited
}
