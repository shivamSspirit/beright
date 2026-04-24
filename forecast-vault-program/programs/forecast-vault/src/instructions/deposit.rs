use anchor_lang::prelude::*;
use anchor_spl::token::{
    self,
    Mint,
    MintTo,
    Token,
    TokenAccount,
    Transfer,
};

use crate::errors::ForecastVaultError;
use crate::state::{
    calculate_shares_to_mint,
    GlobalConfig,
    VaultConfig,
    VaultState,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DepositParams {
    pub amount: u64,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        seeds = [b"global-config"],
        bump = global_config.bump
    )]
    pub global_config: Account<'info, GlobalConfig>,
    #[account(
        constraint = vault_config.global_config == global_config.key() @ ForecastVaultError::InvalidVaultState,
        constraint = vault_config.enabled @ ForecastVaultError::VaultPaused
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

pub fn handler(ctx: Context<Deposit>, params: DepositParams) -> Result<()> {
    require!(!ctx.accounts.global_config.protocol_paused, ForecastVaultError::ProtocolPaused);
    require!(!ctx.accounts.vault_state.paused, ForecastVaultError::VaultPaused);
    require!(params.amount > 0, ForecastVaultError::InvalidAmount);

    let shares_to_mint = calculate_shares_to_mint(
        ctx.accounts.vault_state.total_managed_assets,
        ctx.accounts.vault_state.total_shares,
        params.amount,
    )?;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.depositor_base_account.to_account_info(),
                to: ctx.accounts.base_vault.to_account_info(),
                authority: ctx.accounts.depositor.to_account_info(),
            },
        ),
        params.amount,
    )?;

    let vault_authority_bump = ctx.bumps.vault_authority;
    let vault_config_key = ctx.accounts.vault_config.key();
    let signer_seeds: &[&[u8]] = &[
        b"vault-authority",
        vault_config_key.as_ref(),
        &[vault_authority_bump],
    ];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.share_mint.to_account_info(),
                to: ctx.accounts.depositor_share_account.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            &[signer_seeds],
        ),
        shares_to_mint,
    )?;

    let vault_state = &mut ctx.accounts.vault_state;
    vault_state.total_shares = vault_state
        .total_shares
        .checked_add(shares_to_mint)
        .ok_or(ForecastVaultError::MathOverflow)?;
    vault_state.deposit_assets(
        params.amount,
        ctx.accounts.vault_config.reserve_target_bps,
        ctx.accounts.vault_config.yield_target_bps,
        ctx.accounts.vault_config.prediction_target_bps,
        Clock::get()?.slot,
    )?;
    vault_state.high_water_mark = vault_state.high_water_mark.max(vault_state.total_managed_assets);

    Ok(())
}
