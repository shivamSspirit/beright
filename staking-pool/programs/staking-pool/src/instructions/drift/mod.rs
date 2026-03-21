pub mod initialize;
pub mod collateral;
pub mod open_position;
pub mod close_position;
pub mod manage;

pub use initialize::*;
pub use collateral::*;
pub use open_position::*;
pub use close_position::*;
pub use manage::*;

use anchor_lang::prelude::*;

/// Drift Protocol Program ID (mainnet)
pub const DRIFT_PROGRAM_ID: Pubkey = pubkey!("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");

/// Seeds for the Drift trading state PDA
pub const DRIFT_TRADING_STATE_SEED: &[u8] = b"drift_trading_state";

/// Seeds for the perp position record PDA
pub const PERP_POSITION_SEED: &[u8] = b"perp_position";

/// Derive the Drift trading state PDA
pub fn derive_drift_trading_state_pda(pool: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[DRIFT_TRADING_STATE_SEED, pool.as_ref()], program_id)
}

/// Derive the perp position record PDA
pub fn derive_perp_position_pda(
    pool: &Pubkey,
    position_index: u8,
    program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[PERP_POSITION_SEED, pool.as_ref(), &[position_index]],
        program_id,
    )
}

/// Common Drift market indices
pub mod markets {
    pub const SOL_PERP: u16 = 0;
    pub const BTC_PERP: u16 = 1;
    pub const ETH_PERP: u16 = 2;
    pub const APT_PERP: u16 = 3;
    pub const BONK_PERP: u16 = 4;
    pub const WIF_PERP: u16 = 5;
    pub const JUP_PERP: u16 = 6;
    pub const JTO_PERP: u16 = 7;
    pub const PYTH_PERP: u16 = 8;
    pub const W_PERP: u16 = 9;
}
