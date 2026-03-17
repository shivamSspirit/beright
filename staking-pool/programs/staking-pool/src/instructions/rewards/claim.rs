use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::StakingPoolError;
use crate::events::MerkleClaimEvent;
use crate::state::merkle::{merkle, ClaimReceipt, MerkleDistributorState};

/// Accounts for claiming merkle rewards
#[derive(Accounts)]
pub struct ClaimMerkleReward<'info> {
    /// Claimant
    #[account(mut)]
    pub claimant: Signer<'info>,

    /// Merkle distributor state
    #[account(
        mut,
        seeds = [b"merkle_distributor", distributor.epoch.to_le_bytes().as_ref()],
        bump = distributor.bump,
    )]
    pub distributor: Account<'info, MerkleDistributorState>,

    /// Claim receipt PDA (prevents double-claim)
    #[account(
        init,
        payer = claimant,
        space = ClaimReceipt::LEN,
        seeds = [b"claim_receipt", distributor.key().as_ref(), claimant.key().as_ref()],
        bump,
    )]
    pub claim_receipt: Account<'info, ClaimReceipt>,

    /// Claimant's token account to receive rewards
    #[account(mut)]
    pub claimant_token_account: Account<'info, TokenAccount>,

    /// Distributor's token vault
    #[account(mut)]
    pub distributor_vault: Account<'info, TokenAccount>,

    /// Distributor vault authority PDA
    /// CHECK: PDA authority for vault
    #[account(
        seeds = [b"distributor_authority", distributor.key().as_ref()],
        bump,
    )]
    pub vault_authority: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Claim merkle rewards
///
/// Verifies the merkle proof and transfers tokens if valid.
/// Creates a claim receipt to prevent double-claiming.
pub fn handler(
    ctx: Context<ClaimMerkleReward>,
    leaf_index: u64,
    amount: u64,
    proof: Vec<[u8; 32]>,
) -> Result<()> {
    let distributor = &mut ctx.accounts.distributor;
    let clock = Clock::get()?;

    // Verify claim window is open
    require!(
        distributor.is_claim_window_open(),
        StakingPoolError::ClaimWindowClosed
    );

    // Compute leaf hash
    let claimant_key = ctx.accounts.claimant.key();
    let leaf = merkle::compute_leaf(
        leaf_index,
        claimant_key.as_ref().try_into().unwrap(),
        amount,
    );

    // Verify merkle proof
    require!(
        merkle::verify_proof(leaf, &proof, distributor.merkle_root),
        StakingPoolError::InvalidMerkleProof
    );

    // Transfer tokens to claimant
    let distributor_key = distributor.key();
    let authority_bump = ctx.bumps.vault_authority;
    let seeds = &[
        b"distributor_authority".as_ref(),
        distributor_key.as_ref(),
        &[authority_bump],
    ];
    let signer_seeds = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.distributor_vault.to_account_info(),
                to: ctx.accounts.claimant_token_account.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    // Record claim
    distributor.record_claim(amount)?;

    // Initialize claim receipt
    let claim_receipt = &mut ctx.accounts.claim_receipt;
    claim_receipt.initialize(
        ctx.bumps.claim_receipt,
        ctx.accounts.claimant.key(),
        distributor.key(),
        amount,
        leaf_index,
    )?;

    // Emit event
    emit!(MerkleClaimEvent {
        distributor: distributor.key(),
        claimant: ctx.accounts.claimant.key(),
        amount,
        leaf_index,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Claimed {} tokens from epoch {} distributor",
        amount,
        distributor.epoch
    );

    Ok(())
}
