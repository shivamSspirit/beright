use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};

use crate::errors::StakingPoolError;
use crate::events::WithdrawalProcessedEvent;
use crate::state::{DepositorState, DepositorStatus, PoolMintAuthority, StakingPoolState};
use crate::utils::nav::{calculate_exit_fee, calculate_withdrawal_amount};

/// Accounts for processing a withdrawal
#[derive(Accounts)]
pub struct ProcessWithdrawal<'info> {
    /// Depositor processing withdrawal
    #[account(mut)]
    pub depositor: Signer<'info>,

    /// Pool state
    #[account(mut)]
    pub pool_state: Account<'info, StakingPoolState>,

    /// Depositor's position state
    #[account(
        mut,
        seeds = [b"depositor", pool_state.key().as_ref(), depositor.key().as_ref()],
        bump = depositor_state.bump,
        constraint = depositor_state.depositor == depositor.key() @ StakingPoolError::Unauthorized,
        constraint = depositor_state.status == DepositorStatus::WithdrawalPending @ StakingPoolError::NoWithdrawalPending,
    )]
    pub depositor_state: Account<'info, DepositorState>,

    /// Depositor's pool token account (source for burn)
    #[account(
        mut,
        associated_token::mint = pool_mint,
        associated_token::authority = depositor,
    )]
    pub depositor_pool_token_account: Account<'info, TokenAccount>,

    /// Pool share token mint
    #[account(
        mut,
        constraint = pool_mint.key() == pool_state.pool_mint @ StakingPoolError::InvalidConfig,
    )]
    pub pool_mint: Account<'info, Mint>,

    /// Pool's base token vault (source)
    #[account(
        mut,
        associated_token::mint = base_token_mint,
        associated_token::authority = pool_state,
    )]
    pub pool_vault: Account<'info, TokenAccount>,

    /// Depositor's base token account (destination)
    #[account(
        mut,
        associated_token::mint = base_token_mint,
        associated_token::authority = depositor,
    )]
    pub depositor_token_account: Account<'info, TokenAccount>,

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
}

/// Process withdrawal handler
///
/// This completes the withdrawal process after the delay has passed:
/// 1. Burns pool shares
/// 2. Transfers base tokens to depositor
/// 3. Updates state
pub fn handler(ctx: Context<ProcessWithdrawal>) -> Result<()> {
    let depositor_state = &ctx.accounts.depositor_state;
    let pool_state = &ctx.accounts.pool_state;
    let clock = Clock::get()?;

    // 1. Check withdrawal delay has passed
    require!(
        depositor_state.is_withdrawal_ready(),
        StakingPoolError::WithdrawalDelayActive
    );

    let shares_to_burn = depositor_state.withdrawal_requested;

    // 2. Calculate withdrawal amount at current NAV
    let withdrawal_amount = calculate_withdrawal_amount(shares_to_burn, pool_state.nav_per_share)?;

    // 3. Calculate exit fee
    let exit_fee = calculate_exit_fee(withdrawal_amount, pool_state.exit_fee_bps)?;
    let net_withdrawal = withdrawal_amount
        .checked_sub(exit_fee)
        .ok_or(StakingPoolError::Overflow)?;

    // 4. Check liquidity
    require!(
        ctx.accounts.pool_vault.amount >= net_withdrawal,
        StakingPoolError::InsufficientLiquidity
    );

    // 5. Burn pool shares from depositor
    let burn_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.pool_mint.to_account_info(),
            from: ctx.accounts.depositor_pool_token_account.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        },
    );
    token::burn(burn_ctx, shares_to_burn)?;

    // 6. Transfer base tokens from pool vault to depositor
    let pool_bump = ctx.accounts.pool_state.bump;
    let forecaster = ctx.accounts.pool_state.forecaster;
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"staking_pool",
        forecaster.as_ref(),
        &[pool_bump],
    ]];

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.pool_vault.to_account_info(),
            to: ctx.accounts.depositor_token_account.to_account_info(),
            authority: ctx.accounts.pool_state.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(transfer_ctx, net_withdrawal)?;

    // 7. Calculate P&L
    let depositor_state = &ctx.accounts.depositor_state;
    let original_value = shares_to_burn
        .checked_mul(depositor_state.entry_nav)
        .ok_or(StakingPoolError::Overflow)?
        .checked_div(crate::utils::nav::NAV_DECIMALS)
        .ok_or(StakingPoolError::Overflow)?;
    let pnl = (net_withdrawal as i64)
        .checked_sub(original_value as i64)
        .ok_or(StakingPoolError::Overflow)?;

    // 8. Capture values before mutable borrows
    let pool_key = ctx.accounts.pool_state.key();
    let depositor_key = ctx.accounts.depositor.key();

    // 9. Update depositor state
    let depositor_state = &mut ctx.accounts.depositor_state;
    depositor_state.process_withdrawal(pnl)?;
    let is_fully_exited = depositor_state.shares == 0;

    // 10. Update pool state
    let pool_state = &mut ctx.accounts.pool_state;
    pool_state.total_deposits = pool_state.total_deposits
        .checked_sub(withdrawal_amount)
        .ok_or(StakingPoolError::Overflow)?;
    pool_state.total_shares = pool_state.total_shares
        .checked_sub(shares_to_burn)
        .ok_or(StakingPoolError::Overflow)?;
    pool_state.available_liquidity = pool_state.available_liquidity
        .checked_sub(net_withdrawal)
        .ok_or(StakingPoolError::Overflow)?;
    pool_state.pending_withdrawals = pool_state.pending_withdrawals
        .checked_sub(withdrawal_amount)
        .ok_or(StakingPoolError::Overflow)?;
    pool_state.total_withdrawals_ever = pool_state.total_withdrawals_ever
        .checked_add(net_withdrawal)
        .ok_or(StakingPoolError::Overflow)?;

    // Decrement depositor count if fully exited
    if is_fully_exited {
        pool_state.depositor_count = pool_state.depositor_count
            .checked_sub(1)
            .ok_or(StakingPoolError::Overflow)?;
    }

    // 11. Emit event
    emit!(WithdrawalProcessedEvent {
        pool: pool_key,
        depositor: depositor_key,
        shares_burned: shares_to_burn,
        amount_received: net_withdrawal,
        exit_nav: pool_state.nav_per_share,
        pnl,
        exit_fee,
        total_deposits: pool_state.total_deposits,
        total_shares: pool_state.total_shares,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Withdrawal processed: {} shares -> {} base tokens (P&L: {})",
        shares_to_burn,
        net_withdrawal,
        pnl
    );

    Ok(())
}
