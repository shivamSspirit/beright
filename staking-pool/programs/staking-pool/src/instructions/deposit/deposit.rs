use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, MintTo, Token, TokenAccount, Transfer},
};

use crate::errors::StakingPoolError;
use crate::events::DepositEvent;
use crate::state::{DepositorState, PoolMintAuthority, StakingPoolState};
use crate::utils::nav::{calculate_entry_fee, calculate_shares_for_deposit};

/// Accounts for depositing into a staking pool
#[derive(Accounts)]
pub struct Deposit<'info> {
    /// Depositor making the deposit
    #[account(mut)]
    pub depositor: Signer<'info>,

    /// Pool state (must be accepting deposits)
    #[account(
        mut,
        constraint = pool_state.is_accepting_deposits() @ StakingPoolError::PoolNotAcceptingDeposits,
        constraint = !pool_state.is_at_capacity() @ StakingPoolError::PoolAtCapacity,
    )]
    pub pool_state: Account<'info, StakingPoolState>,

    /// Depositor's position state (created if first deposit)
    #[account(
        init_if_needed,
        payer = depositor,
        space = DepositorState::LEN,
        seeds = [b"depositor", pool_state.key().as_ref(), depositor.key().as_ref()],
        bump,
    )]
    pub depositor_state: Account<'info, DepositorState>,

    /// Depositor's base token account (source)
    #[account(
        mut,
        associated_token::mint = base_token_mint,
        associated_token::authority = depositor,
    )]
    pub depositor_token_account: Account<'info, TokenAccount>,

    /// Pool's base token vault (destination)
    #[account(
        mut,
        associated_token::mint = base_token_mint,
        associated_token::authority = pool_state,
    )]
    pub pool_vault: Account<'info, TokenAccount>,

    /// Pool share token mint
    #[account(
        mut,
        constraint = pool_mint.key() == pool_state.pool_mint @ StakingPoolError::InvalidConfig,
    )]
    pub pool_mint: Account<'info, Mint>,

    /// Depositor's pool token account (receives shares)
    #[account(
        init_if_needed,
        payer = depositor,
        associated_token::mint = pool_mint,
        associated_token::authority = depositor,
    )]
    pub depositor_pool_token_account: Account<'info, TokenAccount>,

    /// Pool mint authority PDA
    #[account(
        seeds = [b"pool_mint_authority", pool_state.key().as_ref()],
        bump = pool_mint_authority.bump,
    )]
    pub pool_mint_authority: Account<'info, PoolMintAuthority>,

    /// Base token mint
    #[account(
        constraint = base_token_mint.key() == pool_state.base_token @ StakingPoolError::InvalidConfig,
    )]
    pub base_token_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Deposit handler
pub fn handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    let pool_state = &ctx.accounts.pool_state;
    let clock = Clock::get()?;

    // 1. Validate deposit amount
    require!(amount > 0, StakingPoolError::ZeroDeposit);
    require!(
        amount >= pool_state.min_deposit,
        StakingPoolError::BelowMinimumDeposit
    );

    // 2. Check capacity
    let new_total = pool_state.total_deposits
        .checked_add(amount)
        .ok_or(StakingPoolError::Overflow)?;
    require!(
        new_total <= pool_state.max_capacity,
        StakingPoolError::ExceedsCapacity
    );

    // 3. Calculate entry fee
    let entry_fee = calculate_entry_fee(amount, pool_state.entry_fee_bps)?;
    let net_deposit = amount
        .checked_sub(entry_fee)
        .ok_or(StakingPoolError::Overflow)?;

    // 4. Calculate shares to mint
    let shares = calculate_shares_for_deposit(
        net_deposit,
        pool_state.nav_per_share,
        pool_state.total_shares,
    )?;

    // 5. Transfer base tokens from depositor to pool vault
    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.depositor_token_account.to_account_info(),
            to: ctx.accounts.pool_vault.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        },
    );
    token::transfer(transfer_ctx, amount)?;

    // 6. Mint pool shares to depositor
    let pool_key = ctx.accounts.pool_state.key();
    let authority_bump = ctx.accounts.pool_mint_authority.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool_mint_authority",
        pool_key.as_ref(),
        &[authority_bump],
    ]];

    let mint_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.pool_mint.to_account_info(),
            to: ctx.accounts.depositor_pool_token_account.to_account_info(),
            authority: ctx.accounts.pool_mint_authority.to_account_info(),
        },
        signer_seeds,
    );
    token::mint_to(mint_ctx, shares)?;

    // 7. Check if first deposit and capture nav_per_share
    let is_first_deposit = ctx.accounts.depositor_state.shares == 0;
    let nav_per_share = ctx.accounts.pool_state.nav_per_share;
    let pool_key = ctx.accounts.pool_state.key();

    // 8. Update depositor state
    let depositor_state = &mut ctx.accounts.depositor_state;
    if is_first_deposit {
        depositor_state.initialize(
            ctx.bumps.depositor_state,
            pool_key,
            ctx.accounts.depositor.key(),
            shares,
            net_deposit,
            nav_per_share,
        )?;
    } else {
        depositor_state.add_deposit(shares, net_deposit, nav_per_share)?;
    }

    // 9. Update pool state
    let pool_state = &mut ctx.accounts.pool_state;
    pool_state.total_deposits = new_total;
    pool_state.total_shares = pool_state.total_shares
        .checked_add(shares)
        .ok_or(StakingPoolError::Overflow)?;
    pool_state.available_liquidity = pool_state.available_liquidity
        .checked_add(net_deposit)
        .ok_or(StakingPoolError::Overflow)?;
    pool_state.total_deposits_ever = pool_state.total_deposits_ever
        .checked_add(amount)
        .ok_or(StakingPoolError::Overflow)?;

    // Increment depositor count if first deposit
    if is_first_deposit {
        pool_state.depositor_count = pool_state.depositor_count
            .checked_add(1)
            .ok_or(StakingPoolError::Overflow)?;
    }

    // 10. Emit event
    emit!(DepositEvent {
        pool: pool_key,
        depositor: ctx.accounts.depositor.key(),
        amount,
        shares_minted: shares,
        entry_nav: nav_per_share,
        total_deposits: pool_state.total_deposits,
        total_shares: pool_state.total_shares,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Deposit: {} base tokens -> {} shares at NAV {}",
        amount,
        shares,
        nav_per_share
    );

    Ok(())
}
