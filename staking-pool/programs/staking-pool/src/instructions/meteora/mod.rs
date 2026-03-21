pub mod initialize;
pub mod deposit;
pub mod withdraw;
pub mod harvest;

pub use initialize::*;
pub use deposit::*;
pub use withdraw::*;
pub use harvest::*;

use anchor_lang::prelude::*;

/// Meteora Dynamic Vault Program ID (mainnet)
pub const METEORA_VAULT_PROGRAM_ID: Pubkey =
    pubkey!("24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi");

/// Seeds for the Meteora vault state PDA
pub const METEORA_VAULT_STATE_SEED: &[u8] = b"meteora_vault_state";

/// Derive the Meteora vault state PDA
pub fn derive_meteora_vault_state_pda(pool: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[METEORA_VAULT_STATE_SEED, pool.as_ref()],
        program_id,
    )
}
