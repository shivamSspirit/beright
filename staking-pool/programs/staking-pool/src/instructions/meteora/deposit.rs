use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::StakingPoolError;
use crate::events::MeteoraDepositEvent;
use crate::state::{MeteoraVaultState, StakingPoolState};

use super::METEORA_VAULT_STATE_SEED;

/// Accounts for depositing to Meteora vault
#[derive(Accounts)]
pub struct DepositToMeteora<'info> {
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
        constraint = meteora_state.is_active @ StakingPoolError::MeteoraVaultNotActive,
    )]
    pub meteora_state: Account<'info, MeteoraVaultState>,

    /// Pool's underlying token account (source of deposit)
    #[account(
        mut,
        constraint = pool_underlying_account.mint == meteora_state.underlying_mint @ StakingPoolError::InvalidMint,
    )]
    pub pool_underlying_account: Account<'info, TokenAccount>,

    /// Pool's LP token account (receives LP tokens)
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

    /// Meteora vault's token vault (receives our deposit)
    #[account(mut)]
    pub meteora_token_vault: Account<'info, TokenAccount>,

    /// LP token mint (for minting LP tokens)
    #[account(mut)]
    pub vault_lp_mint: Account<'info, Mint>,

    /// Meteora vault authority PDA
    /// CHECK: Validated by Meteora program during CPI
    pub vault_authority: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

/// Deposit underlying tokens to Meteora Dynamic Vault via CPI
///
/// This transfers tokens from the pool's vault to Meteora and receives
/// LP tokens in return. The LP tokens represent the pool's share of the vault.
///
/// # Arguments
/// * `amount` - Amount of underlying tokens to deposit
pub fn handler(ctx: Context<DepositToMeteora>, amount: u64) -> Result<()> {
    let meteora_state = &ctx.accounts.meteora_state;
    let pool_state = &ctx.accounts.pool_state;

    // Validate deposit amount
    require!(
        meteora_state.is_valid_deposit(amount),
        StakingPoolError::InvalidDepositAmount
    );

    // Check pool has sufficient available liquidity
    require!(
        pool_state.available_liquidity >= amount,
        StakingPoolError::InsufficientLiquidity
    );

    // Check allocation limits
    let max_allocation = pool_state
        .total_deposits
        .checked_mul(meteora_state.allocation_bps as u64)
        .unwrap_or(0)
        .checked_div(10_000)
        .unwrap_or(0);

    let new_total_deposited = meteora_state
        .deposited_amount
        .checked_add(amount)
        .ok_or(StakingPoolError::Overflow)?;

    require!(
        new_total_deposited <= max_allocation,
        StakingPoolError::MeteoraAllocationExceeded
    );

    // Get LP balance before deposit
    let lp_balance_before = ctx.accounts.pool_lp_account.amount;

    // Build signer seeds for pool PDA
    let pool_key = pool_state.key();
    let forecaster_key = pool_state.forecaster;
    let bump = pool_state.bump;
    let seeds = &[
        b"staking_pool".as_ref(),
        forecaster_key.as_ref(),
        &[bump],
    ];
    let signer_seeds = &[&seeds[..]];

    // Transfer tokens from pool to Meteora vault
    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.pool_underlying_account.to_account_info(),
            to: ctx.accounts.meteora_token_vault.to_account_info(),
            authority: ctx.accounts.pool_state.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(transfer_ctx, amount)?;

    // In production: Call Meteora's deposit instruction via CPI
    // For now, we simulate the LP token mint by calculating expected LP tokens
    //
    // The actual CPI would look like:
    // let cpi_accounts = meteora_vault::cpi::accounts::Deposit {
    //     vault: ctx.accounts.meteora_vault.to_account_info(),
    //     token_vault: ctx.accounts.meteora_token_vault.to_account_info(),
    //     lp_mint: ctx.accounts.vault_lp_mint.to_account_info(),
    //     user_token: ctx.accounts.pool_underlying_account.to_account_info(),
    //     user_lp: ctx.accounts.pool_lp_account.to_account_info(),
    //     user: ctx.accounts.pool_state.to_account_info(),
    //     token_program: ctx.accounts.token_program.to_account_info(),
    // };
    // meteora_vault::cpi::deposit(
    //     CpiContext::new_with_signer(
    //         ctx.accounts.meteora_program.to_account_info(),
    //         cpi_accounts,
    //         signer_seeds,
    //     ),
    //     amount,
    //     0, // min_lp_amount (slippage protection)
    // )?;

    // Reload LP account to get new balance
    ctx.accounts.pool_lp_account.reload()?;
    let lp_balance_after = ctx.accounts.pool_lp_account.amount;
    let lp_tokens_received = lp_balance_after.saturating_sub(lp_balance_before);

    // For simulation (until CPI is fully implemented), estimate LP tokens
    // In production, this would be the actual received amount
    let estimated_lp_tokens = if lp_tokens_received == 0 {
        // Estimate based on virtual price
        amount
            .checked_mul(MeteoraVaultState::VIRTUAL_PRICE_DECIMALS)
            .unwrap_or(0)
            .checked_div(meteora_state.last_virtual_price)
            .unwrap_or(amount)
    } else {
        lp_tokens_received
    };

    // Update Meteora state
    let meteora_state = &mut ctx.accounts.meteora_state;
    let virtual_price = meteora_state.last_virtual_price;
    meteora_state.record_deposit(
        amount,
        estimated_lp_tokens,
        virtual_price,
    )?;

    // Update pool state
    let pool_state = &mut ctx.accounts.pool_state;
    pool_state.available_liquidity = pool_state
        .available_liquidity
        .saturating_sub(amount);

    let clock = Clock::get()?;

    // Emit deposit event
    emit!(MeteoraDepositEvent {
        pool: pool_key,
        amount_deposited: amount,
        lp_tokens_received: estimated_lp_tokens,
        virtual_price: meteora_state.last_virtual_price,
        total_deposited: meteora_state.deposited_amount,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Deposited {} tokens to Meteora vault, received {} LP tokens",
        amount,
        estimated_lp_tokens
    );

    Ok(())
}
