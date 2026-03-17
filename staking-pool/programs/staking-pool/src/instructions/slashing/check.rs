use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::StakingPoolError;
use crate::events::SlashingEvent;
use crate::state::slashing::{SlashingState, SlashDestination};
use crate::state::StakingPoolState;

/// Accounts for checking calibration
#[derive(Accounts)]
pub struct CheckCalibration<'info> {
    /// Anyone can trigger a calibration check (keeper, admin, etc.)
    pub keeper: Signer<'info>,

    /// Pool state
    #[account(mut)]
    pub pool_state: Account<'info, StakingPoolState>,

    /// Slashing state PDA
    #[account(
        mut,
        seeds = [b"slashing_state", pool_state.key().as_ref()],
        bump = slashing_state.bump,
        constraint = slashing_state.pool == pool_state.key() @ StakingPoolError::InvalidConfig,
    )]
    pub slashing_state: Account<'info, SlashingState>,
}

/// Check forecaster's calibration (Brier score)
///
/// Anyone can trigger this check. If the forecaster's Brier score
/// exceeds the threshold for consecutive periods, a slash is triggered.
///
/// Note: In production, this would read from the Calibration program via CPI.
/// For now, we accept the Brier score as a parameter.
pub fn handler(ctx: Context<CheckCalibration>, current_brier_scaled: u64) -> Result<()> {
    let slashing_state = &mut ctx.accounts.slashing_state;

    // Verify check is due
    require!(
        slashing_state.is_check_due(),
        StakingPoolError::CalibrationCheckNotDue
    );

    // Record the check and determine if slash is needed
    let should_slash = slashing_state.record_check(current_brier_scaled)?;

    if should_slash {
        msg!(
            "Slashing triggered! Brier {} exceeds threshold {} for {} consecutive periods",
            current_brier_scaled,
            slashing_state.brier_threshold,
            slashing_state.consecutive_failures_required
        );
    } else if current_brier_scaled > slashing_state.brier_threshold {
        msg!(
            "Poor calibration recorded. Consecutive failures: {}/{}",
            slashing_state.current_consecutive_failures,
            slashing_state.consecutive_failures_required
        );
    } else {
        msg!(
            "Calibration check passed. Brier {} is below threshold {}",
            current_brier_scaled,
            slashing_state.brier_threshold
        );
    }

    Ok(())
}

/// Accounts for executing a slash
#[derive(Accounts)]
pub struct ExecuteSlash<'info> {
    /// Anyone can trigger slash execution after conditions are met
    pub keeper: Signer<'info>,

    /// Pool state
    #[account(mut)]
    pub pool_state: Account<'info, StakingPoolState>,

    /// Slashing state PDA
    #[account(
        mut,
        seeds = [b"slashing_state", pool_state.key().as_ref()],
        bump = slashing_state.bump,
        constraint = slashing_state.pool == pool_state.key() @ StakingPoolError::InvalidConfig,
    )]
    pub slashing_state: Account<'info, SlashingState>,

    /// Pool vault (source of slashed funds)
    #[account(mut)]
    pub pool_vault: Account<'info, TokenAccount>,

    /// Treasury account (destination for slashed funds)
    #[account(mut)]
    pub treasury: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// Execute a slash after consecutive calibration failures
///
/// Transfers a percentage of pool deposits to the treasury.
pub fn execute_handler(ctx: Context<ExecuteSlash>) -> Result<()> {
    let slashing_state = &mut ctx.accounts.slashing_state;
    let pool_state = &mut ctx.accounts.pool_state;
    let clock = Clock::get()?;

    // Verify slashing conditions are met
    require!(
        slashing_state.current_consecutive_failures >= slashing_state.consecutive_failures_required,
        StakingPoolError::SlashingConditionsNotMet
    );

    // Calculate slash amount
    let slash_amount = slashing_state.calculate_slash_amount(pool_state.total_deposits);

    require!(
        slash_amount > 0,
        StakingPoolError::SlashingConditionsNotMet
    );

    // Transfer slashed funds to treasury
    let bump = pool_state.bump;
    let forecaster_key = pool_state.forecaster;
    let seeds = &[
        b"staking_pool".as_ref(),
        forecaster_key.as_ref(),
        &[bump],
    ];
    let signer_seeds = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.pool_vault.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
                authority: pool_state.to_account_info(),
            },
            signer_seeds,
        ),
        slash_amount,
    )?;

    // Update pool state
    pool_state.total_deposits = pool_state.total_deposits
        .checked_sub(slash_amount)
        .unwrap();
    pool_state.available_liquidity = pool_state.available_liquidity
        .saturating_sub(slash_amount);

    // Record the slash
    slashing_state.execute_slash(slash_amount)?;

    // Emit event
    emit!(SlashingEvent {
        pool: pool_state.key(),
        forecaster: pool_state.forecaster,
        slash_amount,
        brier_score: slashing_state.brier_threshold, // Last known threshold
        consecutive_failures: slashing_state.consecutive_failures_required,
        destination: slashing_state.slash_destination as u8,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Executed slash: {} tokens sent to treasury. Total slashed: {}",
        slash_amount,
        slashing_state.total_slashed
    );

    Ok(())
}
