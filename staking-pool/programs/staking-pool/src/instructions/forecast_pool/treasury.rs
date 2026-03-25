use anchor_lang::prelude::*;

use crate::errors::StakingPoolError;
use crate::state::PlatformTreasury;

/// Accounts for initializing the platform treasury
#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    /// Admin initializing the treasury
    #[account(mut)]
    pub admin: Signer<'info>,

    /// Platform treasury account
    #[account(
        init,
        payer = admin,
        space = PlatformTreasury::LEN,
        seeds = [b"platform_treasury"],
        bump,
    )]
    pub treasury: Account<'info, PlatformTreasury>,

    pub system_program: Program<'info, System>,
}

/// Initialize the platform treasury
///
/// Creates a single treasury account that collects:
/// - Pool creation fees (0.1 SOL)
/// - Withdrawal fees (0.5% / 2% early)
/// - Platform share of profits (20%)
pub fn handler_init(ctx: Context<InitializeTreasury>) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;

    treasury.bump = ctx.bumps.treasury;
    treasury.admin = ctx.accounts.admin.key();
    treasury.total_sol_collected = 0;
    treasury.total_usdc_collected = 0;
    treasury._reserved = [0; 32];

    msg!("Platform treasury initialized");

    Ok(())
}

/// Accounts for updating treasury admin
#[derive(Accounts)]
pub struct UpdateTreasuryAdmin<'info> {
    /// Current admin
    pub current_admin: Signer<'info>,

    /// Platform treasury
    #[account(
        mut,
        constraint = treasury.admin == current_admin.key() @ StakingPoolError::Unauthorized,
        seeds = [b"platform_treasury"],
        bump = treasury.bump,
    )]
    pub treasury: Account<'info, PlatformTreasury>,

    /// New admin
    /// CHECK: This is the new admin pubkey
    pub new_admin: AccountInfo<'info>,
}

/// Update treasury admin
pub fn handler_update_admin(ctx: Context<UpdateTreasuryAdmin>) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;
    treasury.admin = ctx.accounts.new_admin.key();

    msg!("Treasury admin updated to {}", ctx.accounts.new_admin.key());

    Ok(())
}

/// Accounts for withdrawing from treasury
#[derive(Accounts)]
pub struct WithdrawFromTreasury<'info> {
    /// Admin withdrawing
    pub admin: Signer<'info>,

    /// Platform treasury
    #[account(
        mut,
        constraint = treasury.admin == admin.key() @ StakingPoolError::Unauthorized,
        seeds = [b"platform_treasury"],
        bump = treasury.bump,
    )]
    pub treasury: Account<'info, PlatformTreasury>,

    /// Destination for SOL
    /// CHECK: Admin-controlled destination
    #[account(mut)]
    pub destination: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

/// Withdraw SOL from treasury (rent-exempt balance only)
pub fn handler_withdraw_sol(ctx: Context<WithdrawFromTreasury>, amount: u64) -> Result<()> {
    // Note: For actual withdrawals, you'd need to track deposited SOL
    // in a separate vault account. This is a simplified version.

    msg!(
        "Treasury withdrawal requested: {} lamports to {}",
        amount,
        ctx.accounts.destination.key()
    );

    // In production, implement proper vault withdrawal logic

    Ok(())
}
