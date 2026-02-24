use anchor_lang::prelude::*;

/// VaultState — the on-chain state account for each BeRight vault
///
/// Space breakdown:
///   8   discriminator (Anchor)
///   1   vault_bump
///   1   state_bump
///   32  owner
///   8   total_deposited
///   8   total_withdrawn
///   1   is_frozen
///   1   version
///   8   lock_until
///   8   withdrawal_delay
///   8   epoch_withdraw_limit
///   8   current_epoch
///   8   epoch_withdrawn
///   32  guardian
///   8   large_withdraw_threshold
///   1   guardian_set (flag: has a guardian been configured?)
///   64  _reserved
///   ----
///   Total: 8 + 1+1+32+8+8+1+1+8+8+8+8+8+32+8+1+64 = 205 bytes
///   We allocate 256 to be safe.
#[account]
pub struct VaultState {
    /// Bump seed for the vault PDA (SOL account)
    pub vault_bump: u8,

    /// Bump seed for the state PDA
    pub state_bump: u8,

    /// The wallet that owns this vault
    pub owner: Pubkey,

    /// Lifetime total SOL deposited (lamports)
    pub total_deposited: u64,

    /// Lifetime total SOL withdrawn (lamports)
    pub total_withdrawn: u64,

    /// Emergency freeze flag — when true, deposits/withdrawals are blocked
    pub is_frozen: bool,

    /// Schema version for future migrations
    pub version: u8,

    // ─── Timelock ────────────────────────────────────────────────────────────

    /// Unix timestamp before which withdrawals are blocked
    /// Set to `now + withdrawal_delay` after each withdrawal
    pub lock_until: i64,

    /// How many seconds to lock after each withdrawal (0 = no lock)
    /// Max: 30 days (2_592_000)
    pub withdrawal_delay: i64,

    // ─── Per-epoch rate limiting ──────────────────────────────────────────────

    /// Maximum lamports withdrawable per epoch
    pub epoch_withdraw_limit: u64,

    /// The epoch in which the current withdrawal counter applies
    pub current_epoch: u64,

    /// Running total withdrawn in the current epoch
    pub epoch_withdrawn: u64,

    // ─── Guardian / Multi-sig ─────────────────────────────────────────────────

    /// Guardian pubkey for large withdrawals (e.g. cold wallet)
    /// Only active when guardian_set == true
    pub guardian: Pubkey,

    /// Lamport threshold above which guardian signature is required
    pub large_withdraw_threshold: u64,

    /// Whether a guardian has been configured
    pub guardian_set: bool,

    // ─── Reserved space for future fields ────────────────────────────────────
    /// Reserved — DO NOT USE in v1
    pub _reserved: [u8; 64],
}

impl VaultState {
    /// Total account space needed
    pub const LEN: usize = 8   // discriminator
        + 1  // vault_bump
        + 1  // state_bump
        + 32 // owner
        + 8  // total_deposited
        + 8  // total_withdrawn
        + 1  // is_frozen
        + 1  // version
        + 8  // lock_until
        + 8  // withdrawal_delay
        + 8  // epoch_withdraw_limit
        + 8  // current_epoch
        + 8  // epoch_withdrawn
        + 32 // guardian
        + 8  // large_withdraw_threshold
        + 1  // guardian_set
        + 64 // _reserved
        + 8; // alignment padding (extra)

    pub const VERSION: u8 = 1;

    /// Maximum allowed withdrawal delay: 30 days in seconds
    pub const MAX_WITHDRAWAL_DELAY: i64 = 2_592_000;


}
