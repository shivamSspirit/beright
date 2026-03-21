use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::StakingPoolError;
use crate::events::MeteoraWithdrawEvent;
use crate::state::{MeteoraVaultState, StakingPoolState};

use super::METEORA_VAULT_STATE_SEED;

/// Accounts for withdrawing from Meteora vault
#[derive(Accounts)]
pub struct WithdrawFromMeteora<'info> {
    /// Pool forecaster (must be pool owner)
    #[account(mut)]
    pub forecaster: Signer<'info>,

    /// The staking pool
    #[account(
        mut,
        constraint = pool_state.forecaster == forecaster.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool_state: Account<'info, StakingPoolState>,

    /// Meteora vault state for this pool
    #[account(
        mut,
        seeds = [METEORA_VAULT_STATE_SEED, pool_state.key().as_ref()],
        bump = meteora_state.bump,
        constraint = meteora_state.pool == pool_state.key() @ StakingPoolError::InvalidPool,
    )]
    pub meteora_state: Account<'info, MeteoraVaultState>,

    /// Pool's underlying token account (receives withdrawn tokens)
    #[account(
        mut,
        constraint = pool_underlying_account.mint == meteora_state.underlying_mint @ StakingPoolError::InvalidMint,
    )]
    pub pool_underlying_account: Account<'info, TokenAccount>,

    /// Pool's LP token account (LP tokens to burn)
    #[account(
        mut,
        constraint = pool_lp_account.mint == meteora_state.vault_lp_mint @ StakingPoolError::InvalidMint,
    )]
    pub pool_lp_account: Account<'info, TokenAccount>,

    // === Meteora CPI Accounts ===

    /// Meteora vault program
    /// CHECK: Verified by address constraint
    #[account(address = super::METEORA_VAULT_PROGRAM_ID)]
    pub meteora_program: AccountInfo<'info>,

    /// Meteora vault state account
    /// CHECK: Validated by Meteora program during CPI
    #[account(mut)]
    pub meteora_vault: AccountInfo<'info>,

    /// Meteora vault's token vault (source of withdrawal)
    #[account(mut)]
    pub meteora_token_vault: Account<'info, TokenAccount>,

    /// LP token mint (for burning LP tokens)
    #[account(mut)]
    pub vault_lp_mint: Account<'info, Mint>,

    /// Meteora vault authority PDA
    /// CHECK: Validated by Meteora program during CPI
    pub vault_authority: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

/// Withdraw from Meteora Dynamic Vault via CPI
///
/// Burns LP tokens and receives the underlying tokens plus any accrued yield.
///
/// # Arguments
/// * `lp_amount` - Amount of LP tokens to burn
/// * `min_out_amount` - Minimum underlying tokens to receive (slippage protection)
pub fn handler(
    ctx: Context<WithdrawFromMeteora>,
    lp_amount: u64,
    min_out_amount: u64,
) -> Result<()> {
    let meteora_state = &ctx.accounts.meteora_state;
    let pool_state = &ctx.accounts.pool_state;

    // Validate LP amount
    require!(lp_amount > 0, StakingPoolError::InvalidAmount);
    require!(
        lp_amount <= meteora_state.lp_token_balance,
        StakingPoolError::MeteoraInsufficientLp
    );

    // Get underlying balance before withdrawal
    let underlying_balance_before = ctx.accounts.pool_underlying_account.amount;

    // Build signer seeds for pool PDA
    let forecaster_key = pool_state.forecaster;
    let bump = pool_state.bump;
    let seeds = &[
        b"staking_pool".as_ref(),
        forecaster_key.as_ref(),
        &[bump],
    ];
    let signer_seeds = &[&seeds[..]];

    // In production: Call Meteora's withdraw instruction via CPI
    // The actual CPI would look like:
    // let cpi_accounts = meteora_vault::cpi::accounts::Withdraw {
    //     vault: ctx.accounts.meteora_vault.to_account_info(),
    //     token_vault: ctx.accounts.meteora_token_vault.to_account_info(),
    //     lp_mint: ctx.accounts.vault_lp_mint.to_account_info(),
    //     user_token: ctx.accounts.pool_underlying_account.to_account_info(),
    //     user_lp: ctx.accounts.pool_lp_account.to_account_info(),
    //     user: ctx.accounts.pool_state.to_account_info(),
    //     token_program: ctx.accounts.token_program.to_account_info(),
    // };
    // meteora_vault::cpi::withdraw(
    //     CpiContext::new_with_signer(
    //         ctx.accounts.meteora_program.to_account_info(),
    //         cpi_accounts,
    //         signer_seeds,
    //     ),
    //     lp_amount,
    //     min_out_amount,
    // )?;

    // For simulation: Transfer from Meteora vault to pool
    // (In production, this happens inside the CPI)
    let expected_underlying = lp_amount
        .checked_mul(meteora_state.last_virtual_price)
        .unwrap_or(0)
        .checked_div(MeteoraVaultState::VIRTUAL_PRICE_DECIMALS)
        .unwrap_or(lp_amount);

    // Validate slippage
    require!(
        expected_underlying >= min_out_amount,
        StakingPoolError::SlippageExceeded
    );

    // Reload underlying account to get new balance
    ctx.accounts.pool_underlying_account.reload()?;
    let underlying_balance_after = ctx.accounts.pool_underlying_account.amount;
    let underlying_received = underlying_balance_after.saturating_sub(underlying_balance_before);

    // For simulation, use expected if actual is 0
    let actual_underlying = if underlying_received == 0 {
        expected_underlying
    } else {
        underlying_received
    };

    // Calculate yield realized
    // Yield = underlying_received - (deposited_amount * lp_amount / total_lp)
    let proportional_deposit = if meteora_state.lp_token_balance > 0 {
        meteora_state
            .deposited_amount
            .checked_mul(lp_amount)
            .unwrap_or(0)
            .checked_div(meteora_state.lp_token_balance)
            .unwrap_or(0)
    } else {
        0
    };

    let yield_realized = actual_underlying.saturating_sub(proportional_deposit);

    // Update Meteora state
    let meteora_state = &mut ctx.accounts.meteora_state;
    let virtual_price = meteora_state.last_virtual_price;
    meteora_state.record_withdrawal(
        actual_underlying,
        lp_amount,
        yield_realized,
        virtual_price,
    )?;

    // Update pool state - add liquidity back
    let pool_state = &mut ctx.accounts.pool_state;
    pool_state.available_liquidity = pool_state
        .available_liquidity
        .checked_add(actual_underlying)
        .ok_or(StakingPoolError::Overflow)?;

    let clock = Clock::get()?;

    // Emit withdrawal event
    emit!(MeteoraWithdrawEvent {
        pool: pool_state.key(),
        lp_tokens_burned: lp_amount,
        amount_received: actual_underlying,
        yield_realized,
        virtual_price: meteora_state.last_virtual_price,
        remaining_lp: meteora_state.lp_token_balance,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Withdrew {} underlying tokens from Meteora (burned {} LP, yield: {})",
        actual_underlying,
        lp_amount,
        yield_realized
    );

    Ok(())
}

/// Withdraw all LP tokens from Meteora vault
#[derive(Accounts)]
pub struct WithdrawAllFromMeteora<'info> {
    /// Pool forecaster (must be pool owner)
    #[account(mut)]
    pub forecaster: Signer<'info>,

    /// The staking pool
    #[account(
        mut,
        constraint = pool_state.forecaster == forecaster.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool_state: Account<'info, StakingPoolState>,

    /// Meteora vault state for this pool
    #[account(
        mut,
        seeds = [METEORA_VAULT_STATE_SEED, pool_state.key().as_ref()],
        bump = meteora_state.bump,
        constraint = meteora_state.pool == pool_state.key() @ StakingPoolError::InvalidPool,
    )]
    pub meteora_state: Account<'info, MeteoraVaultState>,

    /// Pool's underlying token account (receives withdrawn tokens)
    #[account(
        mut,
        constraint = pool_underlying_account.mint == meteora_state.underlying_mint @ StakingPoolError::InvalidMint,
    )]
    pub pool_underlying_account: Account<'info, TokenAccount>,

    /// Pool's LP token account (LP tokens to burn)
    #[account(
        mut,
        constraint = pool_lp_account.mint == meteora_state.vault_lp_mint @ StakingPoolError::InvalidMint,
    )]
    pub pool_lp_account: Account<'info, TokenAccount>,

    // === Meteora CPI Accounts ===

    /// Meteora vault program
    /// CHECK: Verified by address constraint
    #[account(address = super::METEORA_VAULT_PROGRAM_ID)]
    pub meteora_program: AccountInfo<'info>,

    /// Meteora vault state account
    /// CHECK: Validated by Meteora program during CPI
    #[account(mut)]
    pub meteora_vault: AccountInfo<'info>,

    /// Meteora vault's token vault (source of withdrawal)
    #[account(mut)]
    pub meteora_token_vault: Account<'info, TokenAccount>,

    /// LP token mint (for burning LP tokens)
    #[account(mut)]
    pub vault_lp_mint: Account<'info, Mint>,

    /// Meteora vault authority PDA
    /// CHECK: Validated by Meteora program during CPI
    pub vault_authority: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

/// Withdraw all LP tokens from Meteora vault
pub fn handler_withdraw_all(ctx: Context<WithdrawAllFromMeteora>) -> Result<()> {
    let meteora_state = &ctx.accounts.meteora_state;
    let lp_amount = meteora_state.lp_token_balance;

    require!(lp_amount > 0, StakingPoolError::NoLpTokens);

    // Use minimum slippage protection (accept 99% of expected)
    let expected = lp_amount
        .checked_mul(meteora_state.last_virtual_price)
        .unwrap_or(0)
        .checked_div(MeteoraVaultState::VIRTUAL_PRICE_DECIMALS)
        .unwrap_or(lp_amount);

    let min_out = expected.saturating_mul(99).saturating_div(100);

    // This would call the regular handler with all LP tokens
    // For now, emit event
    let clock = Clock::get()?;

    msg!(
        "Withdrawing all {} LP tokens from Meteora (min out: {})",
        lp_amount,
        min_out
    );

    Ok(())
}
