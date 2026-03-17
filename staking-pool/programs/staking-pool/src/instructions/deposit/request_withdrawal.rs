use anchor_lang::prelude::*;

use crate::errors::StakingPoolError;
use crate::events::WithdrawalRequestedEvent;
use crate::state::{DepositorState, DepositorStatus, StakingPoolState};
use crate::utils::nav::calculate_withdrawal_amount;

/// Accounts for requesting a withdrawal
#[derive(Accounts)]
pub struct RequestWithdrawal<'info> {
    /// Depositor requesting withdrawal
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
        constraint = depositor_state.status == DepositorStatus::Active @ StakingPoolError::NoWithdrawalPending,
    )]
    pub depositor_state: Account<'info, DepositorState>,
}

/// Request withdrawal handler
///
/// This starts the withdrawal process by:
/// 1. Checking timelock eligibility
/// 2. Recording the withdrawal request
/// 3. Setting the unlock timestamp
///
/// The actual withdrawal is processed via `process_withdrawal` after the delay.
pub fn handler(ctx: Context<RequestWithdrawal>, shares_to_withdraw: u64) -> Result<()> {
    let pool_state = &ctx.accounts.pool_state;
    let depositor_state = &ctx.accounts.depositor_state;
    let clock = Clock::get()?;

    // 1. Validate shares amount
    require!(shares_to_withdraw > 0, StakingPoolError::ZeroDeposit);
    require!(
        shares_to_withdraw <= depositor_state.shares,
        StakingPoolError::InsufficientShares
    );

    // 2. Check minimum lock period has passed
    require!(
        depositor_state.can_withdraw(pool_state.min_lock_period),
        StakingPoolError::LockPeriodActive
    );

    // 3. Calculate estimated withdrawal amount
    let estimated_amount = calculate_withdrawal_amount(
        shares_to_withdraw,
        pool_state.nav_per_share,
    )?;

    // 4. Update depositor state with withdrawal request
    let depositor_state = &mut ctx.accounts.depositor_state;
    depositor_state.request_withdrawal(shares_to_withdraw, pool_state.withdrawal_delay)?;

    // 5. Update pool pending withdrawals
    let pool_state = &mut ctx.accounts.pool_state;
    pool_state.pending_withdrawals = pool_state.pending_withdrawals
        .checked_add(estimated_amount)
        .ok_or(StakingPoolError::Overflow)?;

    // 6. Emit event
    emit!(WithdrawalRequestedEvent {
        pool: ctx.accounts.pool_state.key(),
        depositor: ctx.accounts.depositor.key(),
        shares_requested: shares_to_withdraw,
        estimated_amount,
        withdrawable_after: depositor_state.withdrawable_after,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Withdrawal requested: {} shares, estimated {} base tokens, available after {}",
        shares_to_withdraw,
        estimated_amount,
        depositor_state.withdrawable_after
    );

    Ok(())
}
