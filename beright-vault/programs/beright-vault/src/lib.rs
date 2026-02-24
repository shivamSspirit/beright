/*!
 * BeRight Vault Program
 * =====================
 * A production-grade Solana vault with:
 *   - SOL + SPL token support (USDC and any SPL mint)
 *   - Withdrawal timelock (configurable delay after each withdrawal)
 *   - Per-epoch withdrawal rate limiting (max lamports per Solana epoch)
 *   - Guardian / co-signer for large withdrawals
 *   - Emergency freeze (owner or admin)
 *   - Checked arithmetic throughout (no overflow silent failures)
 *   - Rent-exempt floor protection
 *   - On-chain event emission for indexers and frontends
 *   - Reserved state space for future upgrades without account realloc
 */

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

pub mod errors;
pub mod events;
pub mod state;
pub mod instructions;

use state::VaultState;
use errors::VaultError;

/// Replace with your actual governance/multisig address before mainnet.
/// This is a program constant — cannot be changed without a program upgrade.
const ADMIN_PUBKEY: &str = "BaQhHZ6gA49DSBeJ7PGbw3vJsVTUMpVfT2U79mHKWyWi";

declare_id!("EhU2oz3LKPDCVRhRW5TXMeraqVFoSJ3L42cyeC6Ns2eL");

// ─── Instruction Account Structs ─────────────────────────────────────────────
// All #[derive(Accounts)] structs MUST be defined at the crate root so that
// Anchor's #[program] macro can find the generated __client_accounts_* modules.

/// Accounts for initializing a new vault.
#[derive(Accounts)]
pub struct Initialize<'info> {
    /// Wallet creating the vault — pays rent, becomes owner.
    #[account(mut)]
    pub owner: Signer<'info>,

    /// VaultState PDA — stores all vault configuration and counters.
    #[account(
        init,
        payer = owner,
        space = VaultState::LEN,
        seeds = [b"vault_state", owner.key().as_ref()],
        bump,
    )]
    pub vault_state: Account<'info, VaultState>,

    /// Vault PDA — holds SOL for this vault. Zero-data system account.
    /// CHECK: Created by init with space=0; verified by seeds at use-sites.
    #[account(
        init,
        payer = owner,
        space = 0,
        seeds = [b"vault", owner.key().as_ref()],
        bump,
    )]
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Accounts for depositing SOL into the vault.
#[derive(Accounts)]
pub struct Deposit<'info> {
    /// The depositor — can be anyone, not just the owner.
    #[account(mut)]
    pub user: Signer<'info>,

    /// The vault owner — used only to derive the vault PDAs.
    /// CHECK: Used as a seed only; no data read from it.
    pub owner: UncheckedAccount<'info>,

    /// VaultState — verified by PDA seeds, must not be frozen.
    #[account(
        mut,
        seeds = [b"vault_state", owner.key().as_ref()],
        bump = vault_state.state_bump,
        constraint = !vault_state.is_frozen @ VaultError::VaultFrozen,
    )]
    pub vault_state: Account<'info, VaultState>,

    /// Vault SOL account — receives the deposit. Program-owned PDA; seeds verified.
    /// CHECK: Ownership checked via PDA seeds. SOL received via system_program::transfer.
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault_state.vault_bump,
    )]
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Accounts for withdrawing SOL from the vault.
#[derive(Accounts)]
pub struct Withdraw<'info> {
    /// The vault owner — only they can withdraw.
    #[account(mut)]
    pub owner: Signer<'info>,

    /// Optional guardian — required only when amount >= large_withdraw_threshold.
    /// CHECK: Manually verified against vault_state.guardian inside the handler.
    pub guardian: Option<Signer<'info>>,

    /// VaultState — owner must match, vault must not be frozen.
    #[account(
        mut,
        seeds = [b"vault_state", owner.key().as_ref()],
        bump = vault_state.state_bump,
        constraint = vault_state.owner == owner.key() @ VaultError::Unauthorized,
        constraint = !vault_state.is_frozen @ VaultError::VaultFrozen,
    )]
    pub vault_state: Account<'info, VaultState>,

    /// Vault SOL account — source of funds. Program-owned PDA; lamports manipulated directly.
    /// CHECK: Ownership checked via PDA seeds. Lamports moved via checked arithmetic.
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault_state.vault_bump,
    )]
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Accounts for depositing SPL tokens into the vault.
#[derive(Accounts)]
pub struct DepositToken<'info> {
    /// The depositor.
    #[account(mut)]
    pub user: Signer<'info>,

    /// The vault owner (used to derive PDAs).
    /// CHECK: Used as a seed only.
    pub owner: UncheckedAccount<'info>,

    /// VaultState — vault must not be frozen.
    #[account(
        mut,
        seeds = [b"vault_state", owner.key().as_ref()],
        bump = vault_state.state_bump,
        constraint = !vault_state.is_frozen @ VaultError::VaultFrozen,
    )]
    pub vault_state: Account<'info, VaultState>,

    /// The SPL token mint being deposited (e.g. USDC).
    pub mint: Account<'info, Mint>,

    /// User's source token account.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    /// Vault's token account — PDA-controlled, created if needed.
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = vault_state,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Accounts for withdrawing SPL tokens from the vault.
#[derive(Accounts)]
pub struct WithdrawToken<'info> {
    /// The vault owner — only they can withdraw tokens.
    #[account(mut)]
    pub owner: Signer<'info>,

    /// VaultState — owner must match, vault must not be frozen.
    #[account(
        mut,
        seeds = [b"vault_state", owner.key().as_ref()],
        bump = vault_state.state_bump,
        constraint = vault_state.owner == owner.key() @ VaultError::Unauthorized,
        constraint = !vault_state.is_frozen @ VaultError::VaultFrozen,
    )]
    pub vault_state: Account<'info, VaultState>,

    /// The SPL token mint.
    pub mint: Account<'info, Mint>,

    /// Vault's token account (PDA authority = vault_state).
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault_state,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// Owner's destination token account — created if needed.
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
    pub owner_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Accounts for freezing or unfreezing the vault.
#[derive(Accounts)]
pub struct FreezeVault<'info> {
    /// Must be the vault owner OR the global admin.
    pub authority: Signer<'info>,

    /// CHECK: Used as a seed to derive vault_state PDA.
    pub owner: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"vault_state", owner.key().as_ref()],
        bump = vault_state.state_bump,
        constraint = (
            authority.key() == vault_state.owner ||
            authority.key().to_string() == ADMIN_PUBKEY
        ) @ VaultError::Unauthorized,
    )]
    pub vault_state: Account<'info, VaultState>,
}

/// Accounts for setting or removing the guardian.
#[derive(Accounts)]
pub struct SetGuardian<'info> {
    /// Only the vault owner can change the guardian.
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault_state", owner.key().as_ref()],
        bump = vault_state.state_bump,
        constraint = vault_state.owner == owner.key() @ VaultError::Unauthorized,
        constraint = !vault_state.is_frozen @ VaultError::VaultFrozen,
    )]
    pub vault_state: Account<'info, VaultState>,
}

// ─── Program ──────────────────────────────────────────────────────────────────

#[program]
pub mod beright_vault {
    use super::*;

    // ─── Vault Lifecycle ──────────────────────────────────────────────────────

    /// Initialize a new vault for the calling wallet.
    pub fn init_vault(
        ctx: Context<Initialize>,
        withdrawal_delay: i64,
        epoch_withdraw_limit: u64,
        large_withdraw_threshold: u64,
    ) -> Result<()> {
        instructions::initialize::handler(ctx, withdrawal_delay, epoch_withdraw_limit, large_withdraw_threshold)
    }

    // ─── SOL ──────────────────────────────────────────────────────────────────

    /// Deposit SOL into the vault. Anyone can deposit; only the owner can withdraw.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::handler(ctx, amount)
    }

    /// Withdraw SOL from the vault (timelock + epoch limit + optional guardian).
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::withdraw::handler(ctx, amount)
    }

    // ─── SPL Tokens ───────────────────────────────────────────────────────────

    /// Deposit any SPL token into the vault's token account.
    pub fn deposit_token(ctx: Context<DepositToken>, amount: u64) -> Result<()> {
        instructions::deposit_token::handler(ctx, amount)
    }

    /// Withdraw SPL tokens from the vault (subject to timelock).
    pub fn withdraw_token(ctx: Context<WithdrawToken>, amount: u64) -> Result<()> {
        instructions::withdraw_token::handler(ctx, amount)
    }

    // ─── Admin / Security ────────────────────────────────────────────────────

    /// Freeze the vault — blocks all deposits and withdrawals.
    pub fn freeze_vault(ctx: Context<FreezeVault>) -> Result<()> {
        instructions::freeze::freeze_handler(ctx)
    }

    /// Unfreeze the vault.
    pub fn unfreeze_vault(ctx: Context<FreezeVault>) -> Result<()> {
        instructions::freeze::unfreeze_handler(ctx)
    }

    /// Set a guardian pubkey and large-withdrawal threshold.
    pub fn set_guardian(
        ctx: Context<SetGuardian>,
        guardian: Pubkey,
        large_withdraw_threshold: u64,
    ) -> Result<()> {
        instructions::set_guardian::handler(ctx, guardian, large_withdraw_threshold)
    }

    /// Remove the guardian requirement from this vault.
    pub fn remove_guardian(ctx: Context<SetGuardian>) -> Result<()> {
        instructions::set_guardian::remove_handler(ctx)
    }
}
