pub mod initialize;
pub mod create_position;
pub mod add_liquidity;
pub mod remove_liquidity;
pub mod claim_fees;
pub mod rebalance;

pub use initialize::*;
pub use create_position::*;
pub use add_liquidity::*;
pub use remove_liquidity::*;
pub use claim_fees::*;
pub use rebalance::*;

use anchor_lang::prelude::*;

/// Meteora DLMM Program ID (mainnet)
pub const DLMM_PROGRAM_ID: Pubkey = pubkey!("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo");

/// Seeds for the DLMM config PDA
pub const DLMM_CONFIG_SEED: &[u8] = b"dlmm_config";

/// Seeds for the DLMM position state PDA
pub const DLMM_POSITION_SEED: &[u8] = b"dlmm_position";

/// Derive the DLMM config PDA
pub fn derive_dlmm_config_pda(pool: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[DLMM_CONFIG_SEED, pool.as_ref()], program_id)
}

/// Derive the DLMM position state PDA
pub fn derive_dlmm_position_pda(
    pool: &Pubkey,
    position_index: u8,
    program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[DLMM_POSITION_SEED, pool.as_ref(), &[position_index]],
        program_id,
    )
}
