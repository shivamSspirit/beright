use anchor_lang::prelude::*;

/// Merkle distributor for efficient reward distribution to 100K+ users
/// PDA: ["merkle_distributor", epoch]
/// Size: 8 (discriminator) + 112 = 120 bytes
#[account]
pub struct MerkleDistributorState {
    /// PDA bump seed
    pub bump: u8,
    /// Distribution epoch number
    pub epoch: u64,
    /// Merkle root of claims tree
    pub merkle_root: [u8; 32],
    /// Total tokens claimable in this epoch
    pub total_claimable: u64,
    /// Total tokens already claimed
    pub total_claimed: u64,
    /// Number of claims processed
    pub claims_count: u32,
    /// Deadline after which unclaimed returns to treasury
    pub claim_deadline: i64,
    /// Creation timestamp
    pub created_at: i64,
    /// Token mint for rewards
    pub reward_mint: Pubkey,
    /// Schema version
    pub version: u8,
    /// Reserved
    pub _reserved: [u8; 15],
}

impl MerkleDistributorState {
    pub const LEN: usize = 8  // discriminator
        + 1   // bump
        + 8   // epoch
        + 32  // merkle_root
        + 8   // total_claimable
        + 8   // total_claimed
        + 4   // claims_count
        + 8   // claim_deadline
        + 8   // created_at
        + 32  // reward_mint
        + 1   // version
        + 15; // _reserved

    pub const VERSION: u8 = 1;

    /// Default claim window: 90 days
    pub const DEFAULT_CLAIM_WINDOW: i64 = 90 * 24 * 60 * 60;

    /// Initialize new merkle distributor
    pub fn initialize(
        &mut self,
        bump: u8,
        epoch: u64,
        merkle_root: [u8; 32],
        total_claimable: u64,
        reward_mint: Pubkey,
        claim_window: Option<i64>,
    ) -> Result<()> {
        let clock = Clock::get()?;

        self.bump = bump;
        self.epoch = epoch;
        self.merkle_root = merkle_root;
        self.total_claimable = total_claimable;
        self.total_claimed = 0;
        self.claims_count = 0;
        self.claim_deadline = clock.unix_timestamp
            .checked_add(claim_window.unwrap_or(Self::DEFAULT_CLAIM_WINDOW))
            .unwrap();
        self.created_at = clock.unix_timestamp;
        self.reward_mint = reward_mint;
        self.version = Self::VERSION;
        self._reserved = [0; 15];

        Ok(())
    }

    /// Record a successful claim
    pub fn record_claim(&mut self, amount: u64) -> Result<()> {
        self.total_claimed = self.total_claimed
            .checked_add(amount)
            .unwrap();
        self.claims_count = self.claims_count
            .checked_add(1)
            .unwrap();
        Ok(())
    }

    /// Check if claim window is still open
    pub fn is_claim_window_open(&self) -> bool {
        let clock = Clock::get().unwrap();
        clock.unix_timestamp < self.claim_deadline
    }

    /// Get unclaimed amount (for treasury recovery)
    pub fn unclaimed_amount(&self) -> u64 {
        self.total_claimable
            .checked_sub(self.total_claimed)
            .unwrap_or(0)
    }
}

/// Individual claim receipt to prevent double-claiming
/// PDA: ["claim_receipt", distributor.key(), claimant.key()]
/// Size: 8 (discriminator) + 89 = 97 bytes
#[account]
pub struct ClaimReceipt {
    /// PDA bump seed
    pub bump: u8,
    /// Claimant wallet
    pub claimant: Pubkey,
    /// Distributor this claim is for
    pub distributor: Pubkey,
    /// Amount claimed
    pub amount_claimed: u64,
    /// Claim timestamp
    pub claimed_at: i64,
    /// Leaf index in merkle tree
    pub leaf_index: u64,
}

impl ClaimReceipt {
    pub const LEN: usize = 8  // discriminator
        + 1   // bump
        + 32  // claimant
        + 32  // distributor
        + 8   // amount_claimed
        + 8   // claimed_at
        + 8;  // leaf_index

    /// Initialize claim receipt
    pub fn initialize(
        &mut self,
        bump: u8,
        claimant: Pubkey,
        distributor: Pubkey,
        amount: u64,
        leaf_index: u64,
    ) -> Result<()> {
        let clock = Clock::get()?;

        self.bump = bump;
        self.claimant = claimant;
        self.distributor = distributor;
        self.amount_claimed = amount;
        self.claimed_at = clock.unix_timestamp;
        self.leaf_index = leaf_index;

        Ok(())
    }
}

/// Merkle proof verification utilities
pub mod merkle {
    use solana_sha256_hasher::hash;

    /// Hash two nodes together (sorted order for consistency)
    pub fn hash_pair(a: [u8; 32], b: [u8; 32]) -> [u8; 32] {
        let (first, second) = if a < b { (a, b) } else { (b, a) };
        let mut combined = [0u8; 64];
        combined[..32].copy_from_slice(&first);
        combined[32..].copy_from_slice(&second);
        hash(&combined).to_bytes()
    }

    /// Compute leaf hash from claim data
    /// leaf = sha256(index || claimant || amount)
    pub fn compute_leaf(
        index: u64,
        claimant: &[u8; 32],
        amount: u64,
    ) -> [u8; 32] {
        let mut data = [0u8; 48]; // 8 + 32 + 8
        data[..8].copy_from_slice(&index.to_le_bytes());
        data[8..40].copy_from_slice(claimant);
        data[40..48].copy_from_slice(&amount.to_le_bytes());
        hash(&data).to_bytes()
    }

    /// Verify a merkle proof
    pub fn verify_proof(
        leaf: [u8; 32],
        proof: &[[u8; 32]],
        root: [u8; 32],
    ) -> bool {
        let mut computed_hash = leaf;

        for proof_element in proof.iter() {
            computed_hash = hash_pair(computed_hash, *proof_element);
        }

        computed_hash == root
    }
}
