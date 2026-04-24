use anchor_lang::prelude::*;
use anchor_spl::token::{
    self,
    Burn,
    Mint,
    Token,
    TokenAccount,
    Transfer,
};

use crate::errors::ForecastVaultError;
use crate::state::{
    calculate_assets_to_return,
    GlobalConfig,
    VaultConfig,
    VaultState,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct WithdrawParams {
    pub share_amount: u64,
    pub min_assets_out: u64,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        seeds = [b"global-config"],
        bump = global_config.bump
    )]
    pub global_config: Account<'info, GlobalConfig>,
    #[account(
        constraint = vault_config.global_config == global_config.key() @ ForecastVaultError::InvalidVaultState
    )]
    pub vault_config: Account<'info, VaultConfig>,
    #[account(
        mut,
        seeds = [b"vault-state", vault_config.key().as_ref()],
        bump = vault_state.bump,
        constraint = vault_state.vault_config == vault_config.key() @ ForecastVaultError::InvalidVaultState
    )]
    pub vault_state: Account<'info, VaultState>,
    /// CHECK: PDA signer for custody and share issuance.
    #[account(
        seeds = [b"vault-authority", vault_config.key().as_ref()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(mut, address = vault_config.share_mint)]
    pub share_mint: Account<'info, Mint>,
    #[account(
        mut,
        address = vault_config.base_vault,
        constraint = base_vault.owner == vault_authority.key() @ ForecastVaultError::InvalidBaseVaultAuthority,
        constraint = base_vault.mint == vault_config.base_asset_mint @ ForecastVaultError::InvalidBaseVaultMint
    )]
    pub base_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(
        mut,
        constraint = depositor_base_account.owner == depositor.key() @ ForecastVaultError::Unauthorized,
        constraint = depositor_base_account.mint == vault_config.base_asset_mint @ ForecastVaultError::InvalidBaseVaultMint
    )]
    pub depositor_base_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = depositor_share_account.owner == depositor.key() @ ForecastVaultError::Unauthorized,
        constraint = depositor_share_account.mint == vault_config.share_mint @ ForecastVaultError::InvalidVaultState
    )]
    pub depositor_share_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Withdraw>, params: WithdrawParams) -> Result<()> {
    require!(params.share_amount > 0, ForecastVaultError::InvalidAmount);
    require!(
        params.share_amount <= ctx.accounts.vault_state.total_shares,
        ForecastVaultError::InvalidAmount
    );

    let assets_out = calculate_assets_to_return(
        ctx.accounts.vault_state.total_managed_assets,
        ctx.accounts.vault_state.total_shares,
        params.share_amount,
    )?;
    require!(assets_out >= params.min_assets_out, ForecastVaultError::InsufficientVaultLiquidity);
    require!(
        ctx.accounts.base_vault.amount >= assets_out,
        ForecastVaultError::InsufficientVaultLiquidity
    );

    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.share_mint.to_account_info(),
                from: ctx.accounts.depositor_share_account.to_account_info(),
                authority: ctx.accounts.depositor.to_account_info(),
            },
        ),
        params.share_amount,
    )?;

    let vault_authority_bump = ctx.bumps.vault_authority;
    let vault_config_key = ctx.accounts.vault_config.key();
    let signer_seeds: &[&[u8]] = &[
        b"vault-authority",
        vault_config_key.as_ref(),
        &[vault_authority_bump],
    ];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.base_vault.to_account_info(),
                to: ctx.accounts.depositor_base_account.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            &[signer_seeds],
        ),
        assets_out,
    )?;

    let vault_state = &mut ctx.accounts.vault_state;
    vault_state.total_shares = vault_state
        .total_shares
        .checked_sub(params.share_amount)
        .ok_or(ForecastVaultError::MathOverflow)?;
    vault_state.withdraw_assets(assets_out, Clock::get()?.slot)?;

    Ok(())
}
