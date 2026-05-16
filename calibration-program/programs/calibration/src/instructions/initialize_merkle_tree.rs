use anchor_lang::prelude::*;
use spl_account_compression::{
    program::SplAccountCompression,
    cpi::{accounts::Initialize, init_empty_merkle_tree},
};

/// Initialize a concurrent Merkle tree for compressed predictions
///
/// This creates a Merkle tree that can store millions of predictions
/// at a fraction of the cost of individual PDAs.
///
/// Tree Parameters:
/// - Max Depth: 14 (16,384 predictions per tree)
/// - Max Buffer Size: 64
/// - Cost: ~0.001 SOL one-time (~$0.14)
#[derive(Accounts)]
pub struct InitializeMerkleTree<'info> {
    /// Tree creator and rent payer
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Tree authority (controls who can append)
    /// CHECK: Can be any account, typically the forecaster or program PDA
    pub tree_authority: UncheckedAccount<'info>,

    /// Merkle tree account
    /// CHECK: This account is initialized by the SPL Account Compression program
    #[account(zero)]
    pub merkle_tree: UncheckedAccount<'info>,

    /// SPL Account Compression program
    pub compression_program: Program<'info, SplAccountCompression>,
}

pub fn handler(
    ctx: Context<InitializeMerkleTree>,
    max_depth: u32,
    max_buffer_size: u32,
) -> Result<()> {
    // Recommended configs:
    // - Small tree (1K predictions): max_depth=10, buffer=64
    // - Medium tree (16K predictions): max_depth=14, buffer=64
    // - Large tree (262K predictions): max_depth=18, buffer=256
    // - Massive tree (1M predictions): max_depth=20, buffer=256

    require!(
        max_depth >= 3 && max_depth <= 30,
        ProgramError::InvalidArgument
    );

    require!(
        max_buffer_size >= 8 && max_buffer_size <= 2048,
        ProgramError::InvalidArgument
    );

    // Initialize the Merkle tree via CPI
    let cpi_ctx = CpiContext::new(
        ctx.accounts.compression_program.to_account_info(),
        Initialize {
            merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
            authority: ctx.accounts.tree_authority.to_account_info(),
            noop: ctx.accounts.compression_program.to_account_info(), // Using compression program as noop for init
        },
    );

    init_empty_merkle_tree(cpi_ctx, max_depth, max_buffer_size)?;

    msg!(
        "Merkle tree initialized: depth={}, buffer={}, capacity={}",
        max_depth,
        max_buffer_size,
        2u64.pow(max_depth)
    );

    Ok(())
}
