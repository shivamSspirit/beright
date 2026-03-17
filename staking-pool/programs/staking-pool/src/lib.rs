use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;
pub mod utils;

#[cfg(test)]
mod tests;

use instructions::*;
use state::*;

declare_id!("STAKEpoo11111111111111111111111111111111111");

#[program]
pub mod staking_pool {
    use super::*;

    // ============ Pool Management ============

    /// Initialize a new staking pool
    ///
    /// Requirements:
    /// - Forecaster must be Verified tier or above (Brier < 0.25, 20+ predictions)
    /// - Pool capacity is determined by tier and Brier score
    ///
    /// # Arguments
    /// * `pool_type` - Tournament, AlphaVault, or IndexPool
    /// * `config` - Pool configuration (fees, lock periods, etc.)
    /// * `avg_brier_score` - Forecaster's average Brier score (from calibration program)
    /// * `resolved_predictions` - Number of resolved predictions
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        pool_type: PoolType,
        config: PoolConfig,
        avg_brier_score: f64,
        resolved_predictions: u32,
    ) -> Result<()> {
        instructions::pool::initialize::handler(ctx, pool_type, config, avg_brier_score, resolved_predictions)
    }

    // ============ Depositor Operations ============

    /// Deposit base tokens and receive pool shares
    ///
    /// # Arguments
    /// * `amount` - Amount of base tokens to deposit
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::deposit::handler(ctx, amount)
    }

    /// Request withdrawal of pool shares
    ///
    /// Starts the withdrawal timelock. Actual withdrawal is processed
    /// after `withdrawal_delay` has passed via `process_withdrawal`.
    ///
    /// # Arguments
    /// * `shares` - Number of pool shares to withdraw
    pub fn request_withdrawal(ctx: Context<RequestWithdrawal>, shares: u64) -> Result<()> {
        instructions::deposit::request_withdrawal::handler(ctx, shares)
    }

    /// Process a pending withdrawal
    ///
    /// Called after withdrawal delay has passed. Burns shares and
    /// transfers base tokens to depositor.
    pub fn process_withdrawal(ctx: Context<ProcessWithdrawal>) -> Result<()> {
        instructions::deposit::process_withdrawal::handler(ctx)
    }

    // ============ NAV Management ============

    /// Update pool NAV
    ///
    /// Called by forecaster to update NAV based on trading P&L.
    ///
    /// # Arguments
    /// * `new_nav_per_share` - New NAV per share (scaled 1e9)
    pub fn update_nav(ctx: Context<UpdateNav>, new_nav_per_share: u64) -> Result<()> {
        instructions::nav::update_nav::handler(ctx, new_nav_per_share)
    }

    // ============ Fee Management ============

    /// Collect accrued fees
    ///
    /// Accrues pending performance and management fees, then transfers
    /// them to the forecaster's token account.
    pub fn collect_fees(ctx: Context<CollectFees>) -> Result<()> {
        instructions::nav::collect_fees::handler(ctx)
    }

    /// Accrue fees without collecting
    ///
    /// Updates fee accrual state without transferring tokens.
    /// Useful for keeping fee tracking up-to-date.
    pub fn accrue_fees(ctx: Context<AccrueFees>) -> Result<()> {
        instructions::nav::collect_fees::accrue_handler(ctx)
    }

    // ============ Sanctum Integration (Phase 3) ============

    /// Deposit idle capital to Sanctum INF
    ///
    /// Deposits base tokens to Sanctum to earn yield. The amount
    /// is limited by the pool's idle_allocation_bps setting.
    pub fn deposit_to_sanctum(ctx: Context<DepositToSanctum>, amount: u64) -> Result<()> {
        instructions::sanctum::deposit::handler(ctx, amount)
    }

    /// Withdraw capital from Sanctum INF
    ///
    /// Withdraws base tokens from Sanctum, including any accrued yield.
    pub fn withdraw_from_sanctum(ctx: Context<WithdrawFromSanctum>, inf_amount: u64) -> Result<()> {
        instructions::sanctum::withdraw::handler(ctx, inf_amount)
    }

    /// Harvest Sanctum yield
    ///
    /// Claims accrued yield from Sanctum and updates pool NAV.
    pub fn harvest_sanctum_yield(ctx: Context<HarvestSanctumYield>) -> Result<()> {
        instructions::sanctum::harvest::handler(ctx)
    }

    // ============ veToken Governance (Phase 4) ============

    /// Lock bRight tokens to create veBRIGHT
    ///
    /// Creates a vote-escrowed position with voting power that decays linearly.
    /// Longer locks = higher boost multiplier and fee discounts.
    pub fn lock_ve_token(ctx: Context<LockVeToken>, amount: u64, lock_duration: i64) -> Result<()> {
        instructions::ve_token::lock::handler(ctx, amount, lock_duration)
    }

    /// Extend lock duration
    ///
    /// Can only extend, not shorten. Recalculates voting power and boost.
    pub fn extend_lock(ctx: Context<ExtendLock>, new_lock_end: i64) -> Result<()> {
        instructions::ve_token::extend::handler(ctx, new_lock_end)
    }

    /// Add more tokens to existing lock
    ///
    /// Keeps the same unlock time but increases voting power.
    pub fn increase_lock_amount(ctx: Context<IncreaseLock>, additional_amount: u64) -> Result<()> {
        instructions::ve_token::extend::increase_handler(ctx, additional_amount)
    }

    /// Unlock expired ve tokens
    ///
    /// Can only be called after lock has expired. Returns bRight tokens.
    pub fn unlock_ve_token(ctx: Context<UnlockVeToken>) -> Result<()> {
        instructions::ve_token::unlock::handler(ctx)
    }

    /// Delegate voting power
    ///
    /// Allows another wallet to vote on your behalf.
    pub fn delegate_vote(ctx: Context<DelegateVote>, delegate: Pubkey) -> Result<()> {
        instructions::ve_token::delegate::handler(ctx, delegate)
    }

    /// Remove delegation and self-delegate
    pub fn undelegate_vote(ctx: Context<UndelegateVote>) -> Result<()> {
        instructions::ve_token::delegate::undelegate_handler(ctx)
    }

    /// Refresh voting power calculation
    pub fn refresh_voting_power(ctx: Context<RefreshVotingPower>) -> Result<()> {
        instructions::ve_token::delegate::refresh_handler(ctx)
    }

    // ============ Merkle Rewards (Phase 4) ============

    /// Create a new merkle distributor for reward distribution
    ///
    /// The admin provides a merkle root representing all claimable rewards.
    pub fn create_merkle_distributor(
        ctx: Context<CreateMerkleDistributor>,
        epoch: u64,
        merkle_root: [u8; 32],
        total_claimable: u64,
        claim_window: Option<i64>,
    ) -> Result<()> {
        instructions::rewards::create_distributor::handler(ctx, epoch, merkle_root, total_claimable, claim_window)
    }

    /// Claim merkle rewards
    ///
    /// Verifies the merkle proof and transfers tokens if valid.
    pub fn claim_merkle_reward(
        ctx: Context<ClaimMerkleReward>,
        leaf_index: u64,
        amount: u64,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        instructions::rewards::claim::handler(ctx, leaf_index, amount, proof)
    }

    // ============ Slashing (Phase 4) ============

    /// Initialize slashing state for a pool
    ///
    /// Sets up calibration monitoring with configurable thresholds.
    pub fn initialize_slashing(
        ctx: Context<InitializeSlashing>,
        config: Option<SlashingConfig>,
    ) -> Result<()> {
        instructions::slashing::init::handler(ctx, config)
    }

    /// Check forecaster's calibration (Brier score)
    ///
    /// Anyone can trigger this check. If Brier > 0.30 for consecutive
    /// periods, slashing is triggered.
    pub fn check_calibration(ctx: Context<CheckCalibration>, current_brier_scaled: u64) -> Result<()> {
        instructions::slashing::check::handler(ctx, current_brier_scaled)
    }

    /// Execute a slash after consecutive calibration failures
    ///
    /// Transfers a percentage of pool deposits to the treasury.
    pub fn execute_slash(ctx: Context<ExecuteSlash>) -> Result<()> {
        instructions::slashing::check::execute_handler(ctx)
    }
}
