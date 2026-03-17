use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::StakingPoolError;
use crate::events::MerkleDistributorCreatedEvent;
use crate::state::merkle::MerkleDistributorState;

/// Accounts for creating a merkle distributor
#[derive(Accounts)]
#[instruction(epoch: u64)]
pub struct CreateMerkleDistributor<'info> {
    /// Admin creating the distributor
    #[account(mut)]
    pub admin: Signer<'info>,

    /// Merkle distributor state PDA
    #[account(
        init,
        payer = admin,
        space = MerkleDistributorState::LEN,
        seeds = [b"merkle_distributor", epoch.to_le_bytes().as_ref()],
        bump,
    )]
    pub distributor: Account<'info, MerkleDistributorState>,

    /// Admin's token account (source of rewards)
    #[account(mut)]
    pub admin_token_account: Account<'info, TokenAccount>,

    /// Distributor's token vault
    #[account(mut)]
    pub distributor_vault: Account<'info, TokenAccount>,

    /// Reward token mint
    /// CHECK: Validated by token account constraints
    pub reward_mint: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Create a new merkle distributor for reward distribution
///
/// The admin provides a merkle root representing all claimable rewards.
/// Users can later claim by providing a valid proof.
pub fn handler(
    ctx: Context<CreateMerkleDistributor>,
    epoch: u64,
    merkle_root: [u8; 32],
    total_claimable: u64,
    claim_window: Option<i64>,
) -> Result<()> {
    let clock = Clock::get()?;

    // Transfer reward tokens to distributor vault
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.admin_token_account.to_account_info(),
                to: ctx.accounts.distributor_vault.to_account_info(),
                authority: ctx.accounts.admin.to_account_info(),
            },
        ),
        total_claimable,
    )?;

    // Initialize distributor state
    let distributor = &mut ctx.accounts.distributor;
    distributor.initialize(
        ctx.bumps.distributor,
        epoch,
        merkle_root,
        total_claimable,
        ctx.accounts.reward_mint.key(),
        claim_window,
    )?;

    // Emit event
    emit!(MerkleDistributorCreatedEvent {
        distributor: distributor.key(),
        epoch,
        total_claimable,
        claim_deadline: distributor.claim_deadline,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Created merkle distributor epoch {} with {} claimable tokens",
        epoch,
        total_claimable
    );

    Ok(())
}
