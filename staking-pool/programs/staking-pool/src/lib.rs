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

declare_id!("Fkb7q8pbMa4Wko4u1DYZMXBrXvq8ECFnSqze2TYMm4pM");

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

    // ============ Meteora Vault Integration ============

    /// Initialize Meteora vault integration for a staking pool
    ///
    /// Sets up the pool to route idle capital to a Meteora Dynamic Vault
    /// for yield generation.
    ///
    /// # Arguments
    /// * `allocation_bps` - Percentage of idle capital to allocate (basis points, max 10000)
    /// * `min_deposit` - Minimum deposit amount to prevent dust
    pub fn initialize_meteora_vault(
        ctx: Context<InitializeMeteoraVault>,
        allocation_bps: u16,
        min_deposit: u64,
    ) -> Result<()> {
        instructions::meteora::initialize::handler(ctx, allocation_bps, min_deposit)
    }

    /// Deposit underlying tokens to Meteora Dynamic Vault via CPI
    ///
    /// Transfers tokens from the pool's vault to Meteora and receives
    /// LP tokens in return.
    ///
    /// # Arguments
    /// * `amount` - Amount of underlying tokens to deposit
    pub fn deposit_to_meteora(ctx: Context<DepositToMeteora>, amount: u64) -> Result<()> {
        instructions::meteora::deposit::handler(ctx, amount)
    }

    /// Withdraw from Meteora Dynamic Vault via CPI
    ///
    /// Burns LP tokens and receives the underlying tokens plus any accrued yield.
    ///
    /// # Arguments
    /// * `lp_amount` - Amount of LP tokens to burn
    /// * `min_out_amount` - Minimum underlying tokens to receive (slippage protection)
    pub fn withdraw_from_meteora(
        ctx: Context<WithdrawFromMeteora>,
        lp_amount: u64,
        min_out_amount: u64,
    ) -> Result<()> {
        instructions::meteora::withdraw::handler(ctx, lp_amount, min_out_amount)
    }

    /// Withdraw all LP tokens from Meteora vault
    ///
    /// Convenience method that withdraws all LP tokens with default slippage.
    pub fn withdraw_all_from_meteora(ctx: Context<WithdrawAllFromMeteora>) -> Result<()> {
        instructions::meteora::withdraw::handler_withdraw_all(ctx)
    }

    /// Harvest yield from Meteora vault
    ///
    /// Updates yield tracking based on virtual price increase.
    ///
    /// # Arguments
    /// * `new_virtual_price` - Current virtual price from Meteora vault (scaled 1e9)
    pub fn harvest_meteora_yield(
        ctx: Context<HarvestMeteoraYield>,
        new_virtual_price: u64,
    ) -> Result<()> {
        instructions::meteora::harvest::handler(ctx, new_virtual_price)
    }

    /// Auto-harvest Meteora yield by reading virtual price from vault
    ///
    /// Permissionless instruction that anyone can call to trigger yield harvest.
    pub fn auto_harvest_meteora_yield(ctx: Context<AutoHarvestMeteoraYield>) -> Result<()> {
        instructions::meteora::harvest::handler_auto_harvest(ctx)
    }

    /// Update Meteora vault allocation percentage
    ///
    /// # Arguments
    /// * `new_allocation_bps` - New allocation in basis points (max 10000 = 100%)
    pub fn update_meteora_allocation(
        ctx: Context<UpdateMeteoraAllocation>,
        new_allocation_bps: u16,
    ) -> Result<()> {
        instructions::meteora::harvest::handler_update_allocation(ctx, new_allocation_bps)
    }

    /// Pause or unpause Meteora vault integration
    ///
    /// # Arguments
    /// * `is_active` - Whether the integration should be active
    pub fn set_meteora_active(ctx: Context<SetMeteoraActive>, is_active: bool) -> Result<()> {
        instructions::meteora::harvest::handler_set_active(ctx, is_active)
    }

    // ============ DLMM Integration ============

    /// Initialize DLMM configuration for a staking pool
    ///
    /// Sets up the pool to create concentrated liquidity positions.
    pub fn initialize_dlmm_config(
        ctx: Context<InitializeDlmmConfig>,
        config: Option<DlmmConfigParams>,
    ) -> Result<()> {
        instructions::dlmm::initialize::handler(ctx, config)
    }

    /// Update DLMM configuration parameters
    pub fn update_dlmm_config(
        ctx: Context<UpdateDlmmConfig>,
        config: DlmmConfigParams,
    ) -> Result<()> {
        instructions::dlmm::initialize::handler_update_config(ctx, config)
    }

    /// Pause or unpause DLMM integration
    pub fn set_dlmm_active(ctx: Context<SetDlmmActive>, is_active: bool) -> Result<()> {
        instructions::dlmm::initialize::handler_set_active(ctx, is_active)
    }

    /// Create a new DLMM position
    ///
    /// Creates a concentrated liquidity position on the DLMM pool.
    pub fn create_dlmm_position(
        ctx: Context<CreateDlmmPosition>,
        position_index: u8,
        params: CreatePositionParams,
    ) -> Result<()> {
        instructions::dlmm::create_position::handler(ctx, position_index, params)
    }

    /// Add liquidity to an existing DLMM position
    pub fn add_dlmm_liquidity(
        ctx: Context<AddDlmmLiquidity>,
        position_index: u8,
        amount_x: u64,
        amount_y: u64,
        min_shares: u128,
    ) -> Result<()> {
        instructions::dlmm::add_liquidity::handler(ctx, position_index, amount_x, amount_y, min_shares)
    }

    /// Remove liquidity from a DLMM position
    pub fn remove_dlmm_liquidity(
        ctx: Context<RemoveDlmmLiquidity>,
        position_index: u8,
        shares_to_remove: u128,
        min_amount_x: u64,
        min_amount_y: u64,
    ) -> Result<()> {
        instructions::dlmm::remove_liquidity::handler(ctx, position_index, shares_to_remove, min_amount_x, min_amount_y)
    }

    /// Close a DLMM position and recover all liquidity
    pub fn close_dlmm_position(
        ctx: Context<CloseDlmmPosition>,
        position_index: u8,
    ) -> Result<()> {
        instructions::dlmm::remove_liquidity::handler_close_position(ctx, position_index)
    }

    /// Claim accumulated fees from a DLMM position
    pub fn claim_dlmm_fees(ctx: Context<ClaimDlmmFees>, position_index: u8) -> Result<()> {
        instructions::dlmm::claim_fees::handler(ctx, position_index)
    }

    /// Update unclaimed fees for a position
    pub fn update_dlmm_fees(
        ctx: Context<UpdateDlmmFees>,
        position_index: u8,
        fee_x: u64,
        fee_y: u64,
    ) -> Result<()> {
        instructions::dlmm::claim_fees::handler_update_fees(ctx, position_index, fee_x, fee_y)
    }

    /// Rebalance a DLMM position to a new price range
    pub fn rebalance_dlmm_position(
        ctx: Context<RebalanceDlmmPosition>,
        position_index: u8,
        params: RebalanceParams,
    ) -> Result<()> {
        instructions::dlmm::rebalance::handler(ctx, position_index, params)
    }

    /// Update position status based on current active bin
    pub fn update_dlmm_position_status(
        ctx: Context<UpdateDlmmPositionStatus>,
        position_index: u8,
        current_active_bin: i32,
    ) -> Result<()> {
        instructions::dlmm::rebalance::handler_update_status(ctx, position_index, current_active_bin)
    }

    // ============ Drift Trading Integration ============

    /// Initialize Drift trading for a staking pool
    ///
    /// Sets up the pool to execute perp trades based on forecaster predictions.
    /// Requires the forecaster to meet minimum calibration requirements.
    pub fn initialize_drift_trading(
        ctx: Context<InitializeDriftTrading>,
        config: Option<DriftTradingConfig>,
    ) -> Result<()> {
        instructions::drift::initialize::handler(ctx, config)
    }

    /// Update Drift trading configuration
    pub fn update_drift_config(
        ctx: Context<UpdateDriftConfig>,
        config: DriftTradingConfig,
    ) -> Result<()> {
        instructions::drift::initialize::handler_update_config(ctx, config)
    }

    /// Pause or unpause Drift trading
    pub fn set_drift_active(ctx: Context<SetDriftActive>, is_active: bool) -> Result<()> {
        instructions::drift::initialize::handler_set_active(ctx, is_active)
    }

    /// Deposit collateral to Drift
    ///
    /// Transfers funds from pool vault to Drift for trading margin.
    pub fn deposit_drift_collateral(
        ctx: Context<DepositDriftCollateral>,
        amount: u64,
    ) -> Result<()> {
        instructions::drift::collateral::handler_deposit(ctx, amount)
    }

    /// Withdraw collateral from Drift
    ///
    /// Withdraws margin back to pool vault. Cannot withdraw if positions are open.
    pub fn withdraw_drift_collateral(
        ctx: Context<WithdrawDriftCollateral>,
        amount: u64,
    ) -> Result<()> {
        instructions::drift::collateral::handler_withdraw(ctx, amount)
    }

    /// Open a perp position based on a prediction
    ///
    /// Position size is determined by forecaster's Brier score and prediction confidence.
    pub fn open_drift_position(
        ctx: Context<OpenDriftPosition>,
        position_index: u8,
        params: OpenPositionParams,
    ) -> Result<()> {
        instructions::drift::open_position::handler(ctx, position_index, params)
    }

    /// Close an open perp position
    pub fn close_drift_position(
        ctx: Context<CloseDriftPosition>,
        position_index: u8,
    ) -> Result<()> {
        instructions::drift::close_position::handler(ctx, position_index)
    }

    /// Cleanup a closed position account to recover rent
    pub fn cleanup_drift_position(
        ctx: Context<CleanupDriftPosition>,
        position_index: u8,
    ) -> Result<()> {
        instructions::drift::close_position::handler_cleanup(ctx, position_index)
    }

    /// Update P&L for an open position (permissionless)
    pub fn update_drift_pnl(
        ctx: Context<UpdateDriftPositionPnl>,
        position_index: u8,
        current_price: u64,
    ) -> Result<()> {
        instructions::drift::manage::handler_update_pnl(ctx, position_index, current_price)
    }

    /// Check liquidation risk and emergency close if needed
    pub fn liquidation_guard(
        ctx: Context<LiquidationGuard>,
        position_index: u8,
        current_price: u64,
    ) -> Result<()> {
        instructions::drift::manage::handler_liquidation_guard(ctx, position_index, current_price)
    }

    /// Update stop loss and take profit orders
    pub fn update_drift_orders(
        ctx: Context<UpdateDriftOrders>,
        position_index: u8,
        stop_loss: Option<u64>,
        take_profit: Option<u64>,
    ) -> Result<()> {
        instructions::drift::manage::handler_update_orders(ctx, position_index, stop_loss, take_profit)
    }

    /// Check drawdown limit and pause trading if exceeded (permissionless)
    pub fn check_drift_drawdown(ctx: Context<CheckDriftDrawdown>) -> Result<()> {
        instructions::drift::manage::handler_check_drawdown(ctx)
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

    // ============ Simplified Forecaster Pools ============

    /// Initialize platform treasury (one-time setup)
    ///
    /// Creates the treasury account that collects fees from all pools.
    pub fn initialize_treasury(ctx: Context<InitializeTreasury>) -> Result<()> {
        instructions::forecast_pool::treasury::handler_init(ctx)
    }

    /// Update treasury admin
    pub fn update_treasury_admin(ctx: Context<UpdateTreasuryAdmin>) -> Result<()> {
        instructions::forecast_pool::treasury::handler_update_admin(ctx)
    }

    /// Create a forecaster pool (one-click)
    ///
    /// Creates a new staking pool with fixed tier configuration.
    /// Tiers: StarterSol, BasicSol, StarterUsdc, BasicUsdc, ProSol, ProUsdc, EliteSol, EliteUsdc
    ///
    /// # Arguments
    /// * `tier` - Pool tier determining capacity and requirements
    /// * `brier_score_scaled` - Forecaster's Brier score * 1000 (e.g., 0.25 = 250)
    /// * `prediction_count` - Number of resolved predictions
    pub fn create_forecast_pool(
        ctx: Context<CreateForecastPool>,
        tier: PoolTier,
        brier_score_scaled: u64,
        prediction_count: u32,
    ) -> Result<()> {
        instructions::forecast_pool::create_pool::handler(ctx, tier, brier_score_scaled, prediction_count)
    }

    /// Create a demo forecaster pool (no eligibility check)
    ///
    /// For testing and demo purposes only.
    pub fn create_forecast_pool_demo(
        ctx: Context<CreateForecastPoolDemo>,
        tier: PoolTier,
    ) -> Result<()> {
        instructions::forecast_pool::create_pool::handler_demo(ctx, tier)
    }

    /// Stake tokens to a forecaster pool
    ///
    /// Delegators deposit tokens and receive pool shares.
    /// Revenue split: 30% forecaster, 50% delegators, 20% platform
    ///
    /// # Arguments
    /// * `amount` - Amount of tokens to stake
    pub fn stake_to_forecast_pool(ctx: Context<StakeToPool>, amount: u64) -> Result<()> {
        instructions::forecast_pool::stake::handler(ctx, amount)
    }

    /// Unstake tokens from a forecaster pool
    ///
    /// Burns shares and returns tokens minus fees:
    /// - 0.5% withdrawal fee (normal)
    /// - 2% early exit fee (if < 7 days)
    ///
    /// # Arguments
    /// * `shares` - Number of shares to unstake
    pub fn unstake_from_forecast_pool(
        ctx: Context<UnstakeFromPool>,
        shares: u64,
    ) -> Result<()> {
        instructions::forecast_pool::unstake::handler(ctx, shares)
    }

    /// Open a prediction using pool capital
    ///
    /// Records a new prediction. Amount is locked from available liquidity.
    /// Position size must be between 1% and 20% of pool TVL.
    pub fn open_pool_prediction(
        ctx: Context<OpenPoolPrediction>,
        prediction_index: u8,
        market_id: [u8; 32],
        platform: u8,
        side: u8,
        amount: u64,
        entry_price: u64,
    ) -> Result<()> {
        instructions::forecast_pool::prediction::handler_open(
            ctx,
            prediction_index,
            market_id,
            platform,
            side,
            amount,
            entry_price,
        )
    }

    /// Resolve a prediction and distribute profits
    ///
    /// When prediction wins:
    /// - 30% to forecaster
    /// - 50% to delegators (increases share price)
    /// - 20% to platform treasury
    ///
    /// When prediction loses:
    /// - Loss deducted from pool (decreases share price)
    pub fn resolve_pool_prediction(
        ctx: Context<ResolvePoolPrediction>,
        prediction_index: u8,
        won: bool,
        exit_price: u64,
        realized_amount: u64,
    ) -> Result<()> {
        instructions::forecast_pool::prediction::handler_resolve(
            ctx,
            prediction_index,
            won,
            exit_price,
            realized_amount,
        )
    }

    /// Cancel a prediction (market voided)
    ///
    /// Returns staked amount to available liquidity.
    pub fn cancel_pool_prediction(
        ctx: Context<CancelPoolPrediction>,
        prediction_index: u8,
    ) -> Result<()> {
        instructions::forecast_pool::prediction::handler_cancel(ctx, prediction_index)
    }
}
