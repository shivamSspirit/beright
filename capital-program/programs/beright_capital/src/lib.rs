#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
use anchor_spl::token::{
    self, Mint, Token, TokenAccount, TransferChecked, ID as LEGACY_TOKEN_PROGRAM_ID,
};

pub mod errors;
pub mod math;
pub mod state;
pub mod thesis_vault;

use errors::CapitalError;
use math::{
    accrue_reward, checked_mul_div_ceil, collateral_value, conservative_price, is_liquidatable,
    max_borrow, reward_index_increment,
};
use state::*;
use thesis_vault::*;

declare_id!("F2WkXzns4p5pe8NAuK6V5NhZ4bdpXxAE9h5kLAMtxqCT");

const CONFIG_SEED: &[u8] = b"capital-config";
const MARKET_SEED: &[u8] = b"market";
const POSITION_SEED: &[u8] = b"position";
const PRICE_SEED: &[u8] = b"price";
const LENDING_SEED: &[u8] = b"lending";
const LENDER_SEED: &[u8] = b"lender";
const LOAN_SEED: &[u8] = b"loan";
const INTENT_SEED: &[u8] = b"intent";

#[program]
pub mod berightcapital {
    use super::*;

    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
        params: InitializeProtocolParams,
    ) -> Result<()> {
        validate_protocol_params(&params)?;
        require_legacy_token_mint(&ctx.accounts.settlement_mint)?;

        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.payer.key();
        config.pending_admin = Pubkey::default();
        config.emergency_authority = params.emergency_authority;
        config.strategy_authority = params.strategy_authority;
        config.oracle_authority = params.oracle_authority;
        config.settlement_mint = ctx.accounts.settlement_mint.key();
        config.allowed_strategy_program = Pubkey::default();
        config.pending_strategy_program = Pubkey::default();
        config.strategy_activate_after = 0;
        config.strategy_delay_seconds = params.strategy_delay_seconds;
        config.market_count = 0;
        config.config_initialized = true;
        config.paused = false;
        config.strategy_enabled = false;
        config.pending_strategy_enabled = false;
        config.bump = ctx.bumps.config;
        config.reserved = [0; 15];
        emit!(ProtocolInitialized {
            config: config.key(),
            admin: config.admin
        });
        Ok(())
    }

    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        params: InitializeMarketParams,
    ) -> Result<()> {
        validate_market_params(&params)?;
        require!(
            params.resolution_time > Clock::get()?.unix_timestamp,
            CapitalError::InvalidLifecycle
        );
        require_legacy_token_mint(&ctx.accounts.yes_mint)?;
        require_legacy_token_mint(&ctx.accounts.no_mint)?;
        let config = &mut ctx.accounts.config;
        require!(!config.paused, CapitalError::ProtocolPaused);
        require!(config.market_count < u64::MAX, CapitalError::MathOverflow);

        let market = &mut ctx.accounts.market;
        market.config = config.key();
        market.market_id = params.market_id;
        market.yes_mint = ctx.accounts.yes_mint.key();
        market.no_mint = ctx.accounts.no_mint.key();
        market.yes_vault = ctx.accounts.yes_vault.key();
        market.no_vault = ctx.accounts.no_vault.key();
        market.settlement_vault = ctx.accounts.settlement_vault.key();
        market.resolution_authority = params.resolution_authority;
        market.status = MarketStatus::Active;
        market.winning_side = Side::Unresolved;
        market.total_yes = 0;
        market.total_no = 0;
        market.matched_pairs = 0;
        market.matched_units = 0;
        market.strategy_principal = 0;
        market.harvested_yield = 0;
        market.claimed_yield = 0;
        market.reward_index_x64 = 0;
        market.reward_dust_x64 = 0;
        market.tvl_cap = params.tvl_cap;
        market.max_ltv_bps = params.max_ltv_bps;
        market.liquidation_ltv_bps = params.liquidation_ltv_bps;
        market.collateral_haircut_bps = params.collateral_haircut_bps;
        market.max_oracle_age_seconds = params.max_oracle_age_seconds;
        market.max_confidence_bps = params.max_confidence_bps;
        market.resolution_time = params.resolution_time;
        market.borrow_cutoff_seconds = params.borrow_cutoff_seconds;
        market.position_count = 0;
        market.bump = ctx.bumps.market;
        market.reserved = [0; 40];

        let price = &mut ctx.accounts.price;
        price.market = market.key();
        price.yes_executable_bid = 0;
        price.no_executable_bid = 0;
        price.yes_twap = 0;
        price.no_twap = 0;
        price.confidence_bps = u16::MAX;
        price.observed_slot = 0;
        price.observed_at = 0;
        price.content_hash = [0; 32];
        price.bump = ctx.bumps.price;
        price.reserved = [0; 31];

        config.market_count = config
            .market_count
            .checked_add(1)
            .ok_or(CapitalError::MathOverflow)?;
        emit!(MarketInitialized {
            market: market.key(),
            market_id: params.market_id
        });
        Ok(())
    }

    pub fn initialize_position(ctx: Context<InitializePosition>) -> Result<()> {
        let position = &mut ctx.accounts.position;
        position.market = ctx.accounts.market.key();
        position.owner = ctx.accounts.owner.key();
        position.yes_amount = 0;
        position.no_amount = 0;
        position.matched_yes = 0;
        position.matched_no = 0;
        position.locked_yes = 0;
        position.locked_no = 0;
        position.pending_yield = 0;
        position.reward_index_x64 = ctx.accounts.market.reward_index_x64;
        position.next_intent_nonce = 0;
        position.bump = ctx.bumps.position;
        position.reserved = [0; 31];
        ctx.accounts.market.position_count = add(ctx.accounts.market.position_count, 1)?;
        Ok(())
    }

    pub fn pause(ctx: Context<AdminAction>) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.config.emergency_authority
                || ctx.accounts.authority.key() == ctx.accounts.config.admin,
            CapitalError::Unauthorized
        );
        ctx.accounts.config.paused = true;
        emit!(PauseChanged { paused: true });
        Ok(())
    }

    pub fn unpause(ctx: Context<AdminAction>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ctx.accounts.config.admin,
            CapitalError::Unauthorized
        );
        ctx.accounts.config.paused = false;
        emit!(PauseChanged { paused: false });
        Ok(())
    }

    pub fn configure_strategy(
        ctx: Context<AdminAction>,
        adapter: Pubkey,
        enabled: bool,
    ) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ctx.accounts.config.admin,
            CapitalError::Unauthorized
        );
        require!(
            !enabled || adapter != Pubkey::default(),
            CapitalError::InvalidAdapter
        );
        let activate_after = Clock::get()?
            .unix_timestamp
            .checked_add(ctx.accounts.config.strategy_delay_seconds)
            .ok_or(CapitalError::MathOverflow)?;
        ctx.accounts.config.pending_strategy_program = adapter;
        ctx.accounts.config.pending_strategy_enabled = enabled;
        ctx.accounts.config.strategy_activate_after = activate_after;
        emit!(StrategyChangeProposed {
            adapter,
            enabled,
            activate_after
        });
        Ok(())
    }

    pub fn activate_strategy(ctx: Context<AdminAction>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        require!(
            config.strategy_activate_after > 0,
            CapitalError::NoPendingStrategy
        );
        require!(
            Clock::get()?.unix_timestamp >= config.strategy_activate_after,
            CapitalError::StrategyTimelockActive
        );
        config.allowed_strategy_program = config.pending_strategy_program;
        config.strategy_enabled = config.pending_strategy_enabled;
        config.pending_strategy_program = Pubkey::default();
        config.pending_strategy_enabled = false;
        config.strategy_activate_after = 0;
        emit!(StrategyConfigured {
            adapter: config.allowed_strategy_program,
            enabled: config.strategy_enabled
        });
        Ok(())
    }

    pub fn cancel_strategy_change(ctx: Context<AdminAction>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ctx.accounts.config.admin,
            CapitalError::Unauthorized
        );
        require!(
            ctx.accounts.config.strategy_activate_after > 0,
            CapitalError::NoPendingStrategy
        );
        ctx.accounts.config.pending_strategy_program = Pubkey::default();
        ctx.accounts.config.pending_strategy_enabled = false;
        ctx.accounts.config.strategy_activate_after = 0;
        emit!(StrategyChangeCancelled {});
        Ok(())
    }

    pub fn propose_admin(ctx: Context<AdminAction>, new_admin: Pubkey) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ctx.accounts.config.admin,
            CapitalError::Unauthorized
        );
        require!(
            new_admin != Pubkey::default() && new_admin != ctx.accounts.config.admin,
            CapitalError::InvalidAuthority
        );
        ctx.accounts.config.pending_admin = new_admin;
        emit!(AdminTransferProposed {
            current_admin: ctx.accounts.config.admin,
            pending_admin: new_admin
        });
        Ok(())
    }

    pub fn accept_admin(ctx: Context<AdminAction>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ctx.accounts.config.pending_admin,
            CapitalError::Unauthorized
        );
        let previous_admin = ctx.accounts.config.admin;
        ctx.accounts.config.admin = ctx.accounts.authority.key();
        ctx.accounts.config.pending_admin = Pubkey::default();
        emit!(AdminTransferred {
            previous_admin,
            new_admin: ctx.accounts.config.admin
        });
        Ok(())
    }

    pub fn update_protocol_authorities(
        ctx: Context<AdminAction>,
        params: UpdateProtocolAuthoritiesParams,
    ) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ctx.accounts.config.admin,
            CapitalError::Unauthorized
        );
        validate_protocol_authority_update(&params)?;
        let config = &mut ctx.accounts.config;
        config.emergency_authority = params.emergency_authority;
        config.strategy_authority = params.strategy_authority;
        config.oracle_authority = params.oracle_authority;
        emit!(ProtocolAuthoritiesUpdated {
            admin: config.admin,
            emergency_authority: config.emergency_authority,
            strategy_authority: config.strategy_authority,
            oracle_authority: config.oracle_authority,
        });
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, side: Side, amount: u64) -> Result<()> {
        require!(amount > 0, CapitalError::InvalidAmount);
        require!(!ctx.accounts.config.paused, CapitalError::ProtocolPaused);
        require!(
            ctx.accounts.market.status == MarketStatus::Active,
            CapitalError::InvalidLifecycle
        );
        validate_side_accounts(
            &ctx.accounts.market,
            side,
            &ctx.accounts.mint,
            &ctx.accounts.vault,
        )?;

        let total = ctx
            .accounts
            .market
            .total_yes
            .checked_add(ctx.accounts.market.total_no)
            .and_then(|value| value.checked_add(amount))
            .ok_or(CapitalError::MathOverflow)?;
        require!(
            total <= ctx.accounts.market.tvl_cap && total <= MAX_PROTOCOL_TVL,
            CapitalError::TvlCapExceeded
        );
        settle_position_rewards(&ctx.accounts.market, &mut ctx.accounts.position)?;

        transfer_tokens(
            &ctx.accounts.token_program,
            &ctx.accounts.user_source,
            &ctx.accounts.vault,
            &ctx.accounts.mint,
            &ctx.accounts.owner.to_account_info(),
            amount,
            ctx.accounts.mint.decimals,
            None,
        )?;

        match side {
            Side::Yes => {
                ctx.accounts.position.yes_amount = add(ctx.accounts.position.yes_amount, amount)?;
                ctx.accounts.market.total_yes = add(ctx.accounts.market.total_yes, amount)?;
            }
            Side::No => {
                ctx.accounts.position.no_amount = add(ctx.accounts.position.no_amount, amount)?;
                ctx.accounts.market.total_no = add(ctx.accounts.market.total_no, amount)?;
            }
            Side::Unresolved => return err!(CapitalError::InvalidSide),
        }
        emit!(PositionDeposited {
            market: ctx.accounts.market.key(),
            owner: ctx.accounts.owner.key(),
            side,
            amount
        });
        Ok(())
    }

    pub fn withdraw_unmatched(
        ctx: Context<WithdrawUnmatched>,
        side: Side,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, CapitalError::InvalidAmount);
        require!(
            ctx.accounts.position.unmatched(side)? >= amount,
            CapitalError::InsufficientUnmatched
        );
        validate_side_accounts(
            &ctx.accounts.market,
            side,
            &ctx.accounts.mint,
            &ctx.accounts.vault,
        )?;
        settle_position_rewards(&ctx.accounts.market, &mut ctx.accounts.position)?;

        let config_key = ctx.accounts.config.key();
        let market_id = ctx.accounts.market.market_id;
        let bump = [ctx.accounts.market.bump];
        let signer_seeds: &[&[u8]] = &[MARKET_SEED, config_key.as_ref(), market_id.as_ref(), &bump];
        transfer_tokens(
            &ctx.accounts.token_program,
            &ctx.accounts.vault,
            &ctx.accounts.user_destination,
            &ctx.accounts.mint,
            &ctx.accounts.market.to_account_info(),
            amount,
            ctx.accounts.mint.decimals,
            Some(signer_seeds),
        )?;

        match side {
            Side::Yes => {
                ctx.accounts.position.yes_amount = sub(ctx.accounts.position.yes_amount, amount)?;
                ctx.accounts.market.total_yes = sub(ctx.accounts.market.total_yes, amount)?;
            }
            Side::No => {
                ctx.accounts.position.no_amount = sub(ctx.accounts.position.no_amount, amount)?;
                ctx.accounts.market.total_no = sub(ctx.accounts.market.total_no, amount)?;
            }
            Side::Unresolved => return err!(CapitalError::InvalidSide),
        }
        emit!(PositionWithdrawn {
            market: ctx.accounts.market.key(),
            owner: ctx.accounts.owner.key(),
            side,
            amount
        });
        Ok(())
    }

    pub fn match_positions(ctx: Context<MatchPositions>, amount: u64) -> Result<()> {
        require!(amount > 0, CapitalError::InvalidAmount);
        require!(!ctx.accounts.config.paused, CapitalError::ProtocolPaused);
        require!(
            ctx.accounts.market.status == MarketStatus::Active,
            CapitalError::InvalidLifecycle
        );
        require!(
            ctx.accounts.yes_position.key() != ctx.accounts.no_position.key(),
            CapitalError::InvalidMatch
        );
        require!(
            ctx.accounts.yes_position.unmatched(Side::Yes)? >= amount,
            CapitalError::InsufficientUnmatched
        );
        require!(
            ctx.accounts.no_position.unmatched(Side::No)? >= amount,
            CapitalError::InsufficientUnmatched
        );
        settle_position_rewards(&ctx.accounts.market, &mut ctx.accounts.yes_position)?;
        settle_position_rewards(&ctx.accounts.market, &mut ctx.accounts.no_position)?;

        ctx.accounts.yes_position.matched_yes = add(ctx.accounts.yes_position.matched_yes, amount)?;
        ctx.accounts.no_position.matched_no = add(ctx.accounts.no_position.matched_no, amount)?;
        ctx.accounts.market.matched_pairs = add(ctx.accounts.market.matched_pairs, amount)?;
        ctx.accounts.market.matched_units = add(
            ctx.accounts.market.matched_units,
            amount.checked_mul(2).ok_or(CapitalError::MathOverflow)?,
        )?;
        emit!(PositionsMatched {
            market: ctx.accounts.market.key(),
            yes_owner: ctx.accounts.yes_position.owner,
            no_owner: ctx.accounts.no_position.owner,
            amount,
        });
        Ok(())
    }

    pub fn unmatch_positions(ctx: Context<MatchPositions>, amount: u64) -> Result<()> {
        require!(amount > 0, CapitalError::InvalidAmount);
        require!(
            ctx.accounts.yes_position.matched_yes >= amount,
            CapitalError::InsufficientMatched
        );
        require!(
            ctx.accounts.no_position.matched_no >= amount,
            CapitalError::InsufficientMatched
        );
        require!(
            ctx.accounts.market.status == MarketStatus::Resolved
                || (ctx.accounts.yes_owner.is_signer && ctx.accounts.no_owner.is_signer),
            CapitalError::Unauthorized
        );
        require!(
            ctx.accounts.market.strategy_principal
                <= ctx.accounts.market.matched_pairs.saturating_sub(amount),
            CapitalError::CapitalStillDeployed
        );
        settle_position_rewards(&ctx.accounts.market, &mut ctx.accounts.yes_position)?;
        settle_position_rewards(&ctx.accounts.market, &mut ctx.accounts.no_position)?;
        ctx.accounts.yes_position.matched_yes = sub(ctx.accounts.yes_position.matched_yes, amount)?;
        ctx.accounts.no_position.matched_no = sub(ctx.accounts.no_position.matched_no, amount)?;
        ctx.accounts.market.matched_pairs = sub(ctx.accounts.market.matched_pairs, amount)?;
        ctx.accounts.market.matched_units = sub(
            ctx.accounts.market.matched_units,
            amount.checked_mul(2).ok_or(CapitalError::MathOverflow)?,
        )?;
        emit!(PositionsUnmatched {
            market: ctx.accounts.market.key(),
            yes_owner: ctx.accounts.yes_position.owner,
            no_owner: ctx.accounts.no_position.owner,
            amount,
        });
        Ok(())
    }

    /// Credits yield only when the strategy authority actually transfers settlement
    /// tokens into custody. It cannot mint accounting-only yield.
    pub fn harvest_yield(ctx: Context<HarvestYield>, amount: u64) -> Result<()> {
        require!(amount > 0, CapitalError::InvalidAmount);
        require!(!ctx.accounts.config.paused, CapitalError::ProtocolPaused);
        require!(
            ctx.accounts.config.strategy_enabled,
            CapitalError::AdapterDisabled
        );
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ctx.accounts.config.strategy_authority,
            CapitalError::Unauthorized
        );
        require!(
            ctx.accounts.market.matched_units > 0,
            CapitalError::InsufficientMatched
        );

        transfer_tokens(
            &ctx.accounts.token_program,
            &ctx.accounts.strategy_source,
            &ctx.accounts.settlement_vault,
            &ctx.accounts.settlement_mint,
            &ctx.accounts.authority.to_account_info(),
            amount,
            ctx.accounts.settlement_mint.decimals,
            None,
        )?;
        let (increment, dust) = reward_index_increment(
            amount,
            ctx.accounts.market.matched_units,
            ctx.accounts.market.reward_dust_x64,
        )?;
        ctx.accounts.market.reward_index_x64 = ctx
            .accounts
            .market
            .reward_index_x64
            .checked_add(increment)
            .ok_or(CapitalError::MathOverflow)?;
        ctx.accounts.market.reward_dust_x64 = dust;
        ctx.accounts.market.harvested_yield = add(ctx.accounts.market.harvested_yield, amount)?;
        emit!(YieldHarvested {
            market: ctx.accounts.market.key(),
            amount,
            reward_index_x64: ctx.accounts.market.reward_index_x64
        });
        Ok(())
    }

    pub fn claim_yield(ctx: Context<ClaimYield>, amount: u64) -> Result<()> {
        require!(amount > 0, CapitalError::InvalidAmount);
        settle_position_rewards(&ctx.accounts.market, &mut ctx.accounts.position)?;
        require!(
            ctx.accounts.position.pending_yield >= amount,
            CapitalError::YieldUnavailable
        );
        require!(
            ctx.accounts
                .market
                .claimed_yield
                .checked_add(amount)
                .ok_or(CapitalError::MathOverflow)?
                <= ctx.accounts.market.harvested_yield,
            CapitalError::YieldUnavailable
        );

        let config_key = ctx.accounts.config.key();
        let market_id = ctx.accounts.market.market_id;
        let bump = [ctx.accounts.market.bump];
        let signer_seeds: &[&[u8]] = &[MARKET_SEED, config_key.as_ref(), market_id.as_ref(), &bump];
        transfer_tokens(
            &ctx.accounts.token_program,
            &ctx.accounts.settlement_vault,
            &ctx.accounts.user_destination,
            &ctx.accounts.settlement_mint,
            &ctx.accounts.market.to_account_info(),
            amount,
            ctx.accounts.settlement_mint.decimals,
            Some(signer_seeds),
        )?;
        ctx.accounts.position.pending_yield = sub(ctx.accounts.position.pending_yield, amount)?;
        ctx.accounts.market.claimed_yield = add(ctx.accounts.market.claimed_yield, amount)?;
        emit!(YieldClaimed {
            market: ctx.accounts.market.key(),
            owner: ctx.accounts.owner.key(),
            amount
        });
        Ok(())
    }

    pub fn resolve_market(ctx: Context<ResolveMarket>, winning_side: Side) -> Result<()> {
        require!(
            winning_side != Side::Unresolved,
            CapitalError::InvalidOutcome
        );
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ctx.accounts.market.resolution_authority,
            CapitalError::Unauthorized
        );
        require!(
            ctx.accounts.market.status == MarketStatus::Active,
            CapitalError::AlreadyResolved
        );
        require!(
            Clock::get()?.unix_timestamp >= ctx.accounts.market.resolution_time,
            CapitalError::InvalidLifecycle
        );
        require!(
            ctx.accounts.market.strategy_principal == 0,
            CapitalError::CapitalStillDeployed
        );
        ctx.accounts.market.status = MarketStatus::Resolved;
        ctx.accounts.market.winning_side = winning_side;
        emit!(MarketResolved {
            market: ctx.accounts.market.key(),
            winning_side
        });
        Ok(())
    }

    pub fn update_price(ctx: Context<UpdatePrice>, update: PriceUpdate) -> Result<()> {
        let clock = Clock::get()?;
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ctx.accounts.config.oracle_authority,
            CapitalError::Unauthorized
        );
        require!(
            update.yes_executable_bid <= PRICE_SCALE && update.no_executable_bid <= PRICE_SCALE,
            CapitalError::InvalidAmount
        );
        require!(
            update.yes_twap <= PRICE_SCALE && update.no_twap <= PRICE_SCALE,
            CapitalError::InvalidAmount
        );
        require!(
            update.confidence_bps <= ctx.accounts.market.max_confidence_bps,
            CapitalError::OracleConfidenceTooWide
        );
        require!(
            update.observed_slot > ctx.accounts.price.observed_slot,
            CapitalError::StaleUpdate
        );
        require!(
            update.observed_slot <= clock.slot,
            CapitalError::FutureOracleSlot
        );
        require!(
            update.observed_at > ctx.accounts.price.observed_at,
            CapitalError::StaleUpdate
        );
        require!(
            update.observed_at <= clock.unix_timestamp,
            CapitalError::StaleUpdate
        );

        let price = &mut ctx.accounts.price;
        price.yes_executable_bid = update.yes_executable_bid;
        price.no_executable_bid = update.no_executable_bid;
        price.yes_twap = update.yes_twap;
        price.no_twap = update.no_twap;
        price.confidence_bps = update.confidence_bps;
        price.observed_slot = update.observed_slot;
        price.observed_at = update.observed_at;
        price.content_hash = update.content_hash;
        emit!(PriceUpdated {
            market: ctx.accounts.market.key(),
            observed_slot: update.observed_slot,
            content_hash: update.content_hash
        });
        Ok(())
    }

    pub fn initialize_lending_pool(ctx: Context<InitializeLendingPool>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.market = ctx.accounts.market.key();
        pool.settlement_vault = ctx.accounts.lending_vault.key();
        pool.total_cash = 0;
        pool.total_borrows = 0;
        pool.total_lender_shares = 0;
        pool.bad_debt = 0;
        pool.lender_count = 0;
        pool.loan_count = 0;
        pool.bump = ctx.bumps.pool;
        pool.reserved = [0; 63];
        Ok(())
    }

    pub fn initialize_lender(ctx: Context<InitializeLender>) -> Result<()> {
        let lender = &mut ctx.accounts.lender;
        lender.pool = ctx.accounts.pool.key();
        lender.owner = ctx.accounts.owner.key();
        lender.shares = 0;
        lender.bump = ctx.bumps.lender;
        lender.reserved = [0; 31];
        ctx.accounts.pool.lender_count = add(ctx.accounts.pool.lender_count, 1)?;
        Ok(())
    }

    pub fn fund_lending(ctx: Context<FundLending>, amount: u64) -> Result<()> {
        require!(amount > 0, CapitalError::InvalidAmount);
        require!(!ctx.accounts.config.paused, CapitalError::ProtocolPaused);
        transfer_tokens(
            &ctx.accounts.token_program,
            &ctx.accounts.lender_source,
            &ctx.accounts.lending_vault,
            &ctx.accounts.settlement_mint,
            &ctx.accounts.owner.to_account_info(),
            amount,
            ctx.accounts.settlement_mint.decimals,
            None,
        )?;
        let shares = if ctx.accounts.pool.total_lender_shares == 0 {
            amount
        } else {
            let assets = add(
                ctx.accounts.pool.total_cash,
                ctx.accounts.pool.total_borrows,
            )?
            .saturating_sub(ctx.accounts.pool.bad_debt);
            math::checked_mul_div(amount, ctx.accounts.pool.total_lender_shares, assets)?
        };
        require!(shares > 0, CapitalError::InvalidAmount);
        ctx.accounts.pool.total_cash = add(ctx.accounts.pool.total_cash, amount)?;
        ctx.accounts.pool.total_lender_shares = add(ctx.accounts.pool.total_lender_shares, shares)?;
        ctx.accounts.lender.shares = add(ctx.accounts.lender.shares, shares)?;
        emit!(LendingFunded {
            pool: ctx.accounts.pool.key(),
            owner: ctx.accounts.owner.key(),
            amount,
            shares
        });
        Ok(())
    }

    pub fn withdraw_lending(ctx: Context<WithdrawLending>, shares: u64) -> Result<()> {
        require!(
            shares > 0 && shares <= ctx.accounts.lender.shares,
            CapitalError::InvalidAmount
        );
        let assets = add(
            ctx.accounts.pool.total_cash,
            ctx.accounts.pool.total_borrows,
        )?
        .saturating_sub(ctx.accounts.pool.bad_debt);
        let amount = math::checked_mul_div(shares, assets, ctx.accounts.pool.total_lender_shares)?;
        require!(
            ctx.accounts.pool.total_cash >= amount,
            CapitalError::InsufficientLiquidity
        );
        let market_key = ctx.accounts.market.key();
        let bump = [ctx.accounts.pool.bump];
        let signer_seeds: &[&[u8]] = &[LENDING_SEED, market_key.as_ref(), &bump];
        transfer_tokens(
            &ctx.accounts.token_program,
            &ctx.accounts.lending_vault,
            &ctx.accounts.lender_destination,
            &ctx.accounts.settlement_mint,
            &ctx.accounts.pool.to_account_info(),
            amount,
            ctx.accounts.settlement_mint.decimals,
            Some(signer_seeds),
        )?;
        ctx.accounts.pool.total_cash = sub(ctx.accounts.pool.total_cash, amount)?;
        ctx.accounts.pool.total_lender_shares = sub(ctx.accounts.pool.total_lender_shares, shares)?;
        ctx.accounts.lender.shares = sub(ctx.accounts.lender.shares, shares)?;
        emit!(LendingWithdrawn {
            pool: ctx.accounts.pool.key(),
            owner: ctx.accounts.owner.key(),
            amount,
            shares
        });
        Ok(())
    }

    pub fn initialize_loan(ctx: Context<InitializeLoan>, side: Side) -> Result<()> {
        require!(side != Side::Unresolved, CapitalError::InvalidSide);
        let loan = &mut ctx.accounts.loan;
        loan.pool = ctx.accounts.pool.key();
        loan.borrower = ctx.accounts.borrower.key();
        loan.collateral_side = side;
        loan.collateral_amount = 0;
        loan.borrowed_amount = 0;
        loan.bump = ctx.bumps.loan;
        loan.reserved = [0; 31];
        ctx.accounts.pool.loan_count = add(ctx.accounts.pool.loan_count, 1)?;
        Ok(())
    }

    pub fn borrow(ctx: Context<Borrow>, amount: u64, collateral: u64) -> Result<()> {
        require!(amount > 0 && collateral > 0, CapitalError::InvalidAmount);
        require!(!ctx.accounts.config.paused, CapitalError::ProtocolPaused);
        require!(
            ctx.accounts.market.status == MarketStatus::Active,
            CapitalError::InvalidLifecycle
        );
        let borrow_cutoff = Clock::get()?
            .unix_timestamp
            .checked_add(ctx.accounts.market.borrow_cutoff_seconds)
            .ok_or(CapitalError::MathOverflow)?;
        require!(
            borrow_cutoff < ctx.accounts.market.resolution_time,
            CapitalError::BorrowWindowClosed
        );
        require!(
            ctx.accounts.pool.total_cash >= amount,
            CapitalError::InsufficientLiquidity
        );
        validate_price(&ctx.accounts.market, &ctx.accounts.price)?;
        require!(
            ctx.accounts
                .position
                .unmatched(ctx.accounts.loan.collateral_side)?
                >= collateral,
            CapitalError::InsufficientUnmatched
        );

        let new_collateral = add(ctx.accounts.loan.collateral_amount, collateral)?;
        let new_debt = add(ctx.accounts.loan.borrowed_amount, amount)?;
        let price = price_for_side(
            &ctx.accounts.market,
            &ctx.accounts.price,
            ctx.accounts.loan.collateral_side,
        )?;
        let value = collateral_value(new_collateral, price)?;
        require!(
            new_debt <= max_borrow(value, ctx.accounts.market.max_ltv_bps)?,
            CapitalError::LtvExceeded
        );

        let market_key = ctx.accounts.market.key();
        let bump = [ctx.accounts.pool.bump];
        let signer_seeds: &[&[u8]] = &[LENDING_SEED, market_key.as_ref(), &bump];
        transfer_tokens(
            &ctx.accounts.token_program,
            &ctx.accounts.lending_vault,
            &ctx.accounts.borrower_destination,
            &ctx.accounts.settlement_mint,
            &ctx.accounts.pool.to_account_info(),
            amount,
            ctx.accounts.settlement_mint.decimals,
            Some(signer_seeds),
        )?;
        match ctx.accounts.loan.collateral_side {
            Side::Yes => {
                ctx.accounts.position.locked_yes =
                    add(ctx.accounts.position.locked_yes, collateral)?
            }
            Side::No => {
                ctx.accounts.position.locked_no = add(ctx.accounts.position.locked_no, collateral)?
            }
            Side::Unresolved => return err!(CapitalError::InvalidSide),
        }
        ctx.accounts.loan.collateral_amount = new_collateral;
        ctx.accounts.loan.borrowed_amount = new_debt;
        ctx.accounts.pool.total_cash = sub(ctx.accounts.pool.total_cash, amount)?;
        ctx.accounts.pool.total_borrows = add(ctx.accounts.pool.total_borrows, amount)?;
        emit!(LoanBorrowed {
            pool: ctx.accounts.pool.key(),
            borrower: ctx.accounts.borrower.key(),
            amount,
            collateral
        });
        Ok(())
    }

    pub fn repay(ctx: Context<Repay>, amount: u64, collateral_to_unlock: u64) -> Result<()> {
        require!(
            amount > 0 && amount <= ctx.accounts.loan.borrowed_amount,
            CapitalError::InvalidAmount
        );
        require!(
            collateral_to_unlock <= ctx.accounts.loan.collateral_amount,
            CapitalError::InvalidAmount
        );
        transfer_tokens(
            &ctx.accounts.token_program,
            &ctx.accounts.borrower_source,
            &ctx.accounts.lending_vault,
            &ctx.accounts.settlement_mint,
            &ctx.accounts.borrower.to_account_info(),
            amount,
            ctx.accounts.settlement_mint.decimals,
            None,
        )?;

        let (remaining_debt, remaining_collateral, collateral_to_unlock) = repayment_state(
            ctx.accounts.loan.borrowed_amount,
            ctx.accounts.loan.collateral_amount,
            amount,
            collateral_to_unlock,
        )?;
        if remaining_debt > 0 {
            validate_price(&ctx.accounts.market, &ctx.accounts.price)?;
            let price = price_for_side(
                &ctx.accounts.market,
                &ctx.accounts.price,
                ctx.accounts.loan.collateral_side,
            )?;
            let value = collateral_value(remaining_collateral, price)?;
            require!(
                remaining_debt <= max_borrow(value, ctx.accounts.market.max_ltv_bps)?,
                CapitalError::Insolvent
            );
        }
        unlock_collateral(
            &mut ctx.accounts.position,
            ctx.accounts.loan.collateral_side,
            collateral_to_unlock,
        )?;
        ctx.accounts.loan.borrowed_amount = remaining_debt;
        ctx.accounts.loan.collateral_amount = remaining_collateral;
        ctx.accounts.pool.total_borrows = sub(ctx.accounts.pool.total_borrows, amount)?;
        ctx.accounts.pool.total_cash = add(ctx.accounts.pool.total_cash, amount)?;
        emit!(LoanRepaid {
            pool: ctx.accounts.pool.key(),
            borrower: ctx.accounts.borrower.key(),
            amount,
            collateral_unlocked: collateral_to_unlock
        });
        Ok(())
    }

    pub fn liquidate(ctx: Context<Liquidate>) -> Result<()> {
        require!(
            ctx.accounts.loan.borrowed_amount > 0 && ctx.accounts.loan.collateral_amount > 0,
            CapitalError::InvalidAmount
        );
        validate_price(&ctx.accounts.market, &ctx.accounts.price)?;
        validate_side_accounts(
            &ctx.accounts.market,
            ctx.accounts.loan.collateral_side,
            &ctx.accounts.collateral_mint,
            &ctx.accounts.collateral_vault,
        )?;
        let conservative = price_for_side(
            &ctx.accounts.market,
            &ctx.accounts.price,
            ctx.accounts.loan.collateral_side,
        )?;
        let value = collateral_value(ctx.accounts.loan.collateral_amount, conservative)?;
        require!(
            is_liquidatable(
                ctx.accounts.loan.borrowed_amount,
                value,
                ctx.accounts.market.liquidation_ltv_bps
            )?,
            CapitalError::LoanHealthy
        );

        let debt = ctx.accounts.loan.borrowed_amount;
        let with_bonus = checked_mul_div_ceil(debt, 10_500, BPS_DENOMINATOR)?;
        let seized = checked_mul_div_ceil(with_bonus, PRICE_SCALE, conservative)?
            .min(ctx.accounts.loan.collateral_amount);

        transfer_tokens(
            &ctx.accounts.token_program,
            &ctx.accounts.liquidator_source,
            &ctx.accounts.lending_vault,
            &ctx.accounts.settlement_mint,
            &ctx.accounts.liquidator.to_account_info(),
            debt,
            ctx.accounts.settlement_mint.decimals,
            None,
        )?;
        let config_key = ctx.accounts.config.key();
        let market_id = ctx.accounts.market.market_id;
        let bump = [ctx.accounts.market.bump];
        let signer_seeds: &[&[u8]] = &[MARKET_SEED, config_key.as_ref(), market_id.as_ref(), &bump];
        transfer_tokens(
            &ctx.accounts.token_program,
            &ctx.accounts.collateral_vault,
            &ctx.accounts.liquidator_destination,
            &ctx.accounts.collateral_mint,
            &ctx.accounts.market.to_account_info(),
            seized,
            ctx.accounts.collateral_mint.decimals,
            Some(signer_seeds),
        )?;

        let all_collateral = ctx.accounts.loan.collateral_amount;
        unlock_collateral(
            &mut ctx.accounts.position,
            ctx.accounts.loan.collateral_side,
            all_collateral,
        )?;
        match ctx.accounts.loan.collateral_side {
            Side::Yes => {
                ctx.accounts.position.yes_amount = sub(ctx.accounts.position.yes_amount, seized)?;
                ctx.accounts.market.total_yes = sub(ctx.accounts.market.total_yes, seized)?;
            }
            Side::No => {
                ctx.accounts.position.no_amount = sub(ctx.accounts.position.no_amount, seized)?;
                ctx.accounts.market.total_no = sub(ctx.accounts.market.total_no, seized)?;
            }
            Side::Unresolved => return err!(CapitalError::InvalidSide),
        }
        ctx.accounts.loan.borrowed_amount = 0;
        ctx.accounts.loan.collateral_amount = 0;
        ctx.accounts.pool.total_borrows = sub(ctx.accounts.pool.total_borrows, debt)?;
        ctx.accounts.pool.total_cash = add(ctx.accounts.pool.total_cash, debt)?;
        emit!(LoanLiquidated {
            pool: ctx.accounts.pool.key(),
            borrower: ctx.accounts.loan.borrower,
            liquidator: ctx.accounts.liquidator.key(),
            debt_repaid: debt,
            collateral_seized: seized,
        });
        Ok(())
    }

    pub fn create_agent_intent(
        ctx: Context<CreateAgentIntent>,
        params: CreateIntentParams,
    ) -> Result<()> {
        require!(
            params.nonce == ctx.accounts.position.next_intent_nonce,
            CapitalError::InvalidNonce
        );
        require!(params.amount > 0, CapitalError::InvalidAmount);
        require!(
            params.executor != Pubkey::default(),
            CapitalError::Unauthorized
        );
        require!(
            params.expires_at > Clock::get()?.unix_timestamp,
            CapitalError::IntentExpired
        );
        let intent = &mut ctx.accounts.intent;
        intent.owner = ctx.accounts.owner.key();
        intent.executor = params.executor;
        intent.market = ctx.accounts.market.key();
        intent.action = params.action;
        intent.amount = params.amount;
        intent.min_output = params.min_output;
        intent.nonce = params.nonce;
        intent.expires_at = params.expires_at;
        intent.consumed = false;
        intent.bump = ctx.bumps.intent;
        intent.reserved = [0; 30];
        ctx.accounts.position.next_intent_nonce = add(ctx.accounts.position.next_intent_nonce, 1)?;
        emit!(AgentIntentCreated {
            intent: intent.key(),
            owner: intent.owner,
            action: intent.action,
            nonce: intent.nonce
        });
        Ok(())
    }

    /// Marks an exact, owner-signed intent as consumed. A keeper must include this
    /// instruction atomically with the corresponding protocol action and output
    /// checks; the AI never receives custody or standing authority.
    pub fn execute_agent_intent(
        ctx: Context<ExecuteAgentIntent>,
        action: AgentAction,
        amount: u64,
        min_output: u64,
    ) -> Result<()> {
        let intent = &mut ctx.accounts.intent;
        require!(!intent.consumed, CapitalError::IntentConsumed);
        require!(
            Clock::get()?.unix_timestamp <= intent.expires_at,
            CapitalError::IntentExpired
        );
        require!(
            intent.action == action && intent.amount == amount && intent.min_output == min_output,
            CapitalError::IntentMismatch
        );
        require_keys_eq!(
            ctx.accounts.keeper.key(),
            intent.executor,
            CapitalError::Unauthorized
        );
        intent.consumed = true;
        emit!(AgentIntentExecuted {
            intent: intent.key(),
            keeper: ctx.accounts.keeper.key(),
            nonce: intent.nonce
        });
        Ok(())
    }

    pub fn cancel_agent_intent(ctx: Context<CancelAgentIntent>) -> Result<()> {
        require!(!ctx.accounts.intent.consumed, CapitalError::IntentConsumed);
        ctx.accounts.intent.consumed = true;
        emit!(AgentIntentCancelled {
            intent: ctx.accounts.intent.key(),
            owner: ctx.accounts.owner.key(),
            nonce: ctx.accounts.intent.nonce
        });
        Ok(())
    }

    pub fn create_thesis(ctx: Context<CreateThesis>, params: CreateThesisParams) -> Result<()> {
        thesis_vault::create_thesis(ctx, params)
    }

    pub fn initialize_thesis_vault(
        ctx: Context<InitializeThesisVault>,
        params: InitializeThesisVaultParams,
    ) -> Result<()> {
        thesis_vault::initialize_thesis_vault(ctx, params)
    }

    pub fn deposit_thesis_vault(
        ctx: Context<DepositThesisVault>,
        amount: u64,
        minimum_shares: u64,
    ) -> Result<()> {
        thesis_vault::deposit_thesis_vault(ctx, amount, minimum_shares)
    }

    pub fn cancel_thesis_funding(
        ctx: Context<CancelThesisFunding>,
        shares: u64,
        minimum_assets_out: u64,
    ) -> Result<()> {
        thesis_vault::cancel_thesis_funding(ctx, shares, minimum_assets_out)
    }

    pub fn submit_thesis_nav(
        ctx: Context<SubmitThesisNav>,
        checkpoint: NavCheckpoint,
    ) -> Result<()> {
        thesis_vault::submit_thesis_nav(ctx, checkpoint)
    }

    pub fn collect_thesis_fees(ctx: Context<CollectThesisFees>) -> Result<()> {
        thesis_vault::collect_thesis_fees(ctx)
    }

    pub fn request_thesis_redemption(
        ctx: Context<RequestThesisRedemption>,
        params: RedemptionParams,
    ) -> Result<()> {
        thesis_vault::request_thesis_redemption(ctx, params)
    }

    pub fn cancel_thesis_redemption(ctx: Context<CancelThesisRedemption>) -> Result<()> {
        thesis_vault::cancel_thesis_redemption(ctx)
    }

    pub fn settle_thesis_redemption(ctx: Context<SettleThesisRedemption>) -> Result<()> {
        thesis_vault::settle_thesis_redemption(ctx)
    }

    pub fn pause_thesis_vault(ctx: Context<ManageThesisVault>) -> Result<()> {
        thesis_vault::pause_thesis_vault(ctx)
    }

    pub fn unpause_thesis_vault(ctx: Context<ManageThesisVault>) -> Result<()> {
        thesis_vault::unpause_thesis_vault(ctx)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeProtocolParams {
    pub emergency_authority: Pubkey,
    pub strategy_authority: Pubkey,
    pub oracle_authority: Pubkey,
    pub strategy_delay_seconds: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdateProtocolAuthoritiesParams {
    pub emergency_authority: Pubkey,
    pub strategy_authority: Pubkey,
    pub oracle_authority: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeMarketParams {
    pub market_id: [u8; 32],
    pub resolution_authority: Pubkey,
    pub tvl_cap: u64,
    pub max_ltv_bps: u16,
    pub liquidation_ltv_bps: u16,
    pub collateral_haircut_bps: u16,
    pub max_oracle_age_seconds: i64,
    pub max_confidence_bps: u16,
    pub resolution_time: i64,
    pub borrow_cutoff_seconds: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PriceUpdate {
    pub yes_executable_bid: u64,
    pub no_executable_bid: u64,
    pub yes_twap: u64,
    pub no_twap: u64,
    pub confidence_bps: u16,
    pub observed_slot: u64,
    pub observed_at: i64,
    pub content_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateIntentParams {
    pub executor: Pubkey,
    pub action: AgentAction,
    pub amount: u64,
    pub min_output: u64,
    pub nonce: u64,
    pub expires_at: i64,
}

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        constraint = program.programdata_address()? == Some(program_data.key()) @ CapitalError::Unauthorized
    )]
    pub program: Program<'info, crate::program::Berightcapital>,
    #[account(
        constraint = program_data.upgrade_authority_address == Some(payer.key()) @ CapitalError::Unauthorized
    )]
    pub program_data: Account<'info, ProgramData>,
    #[account(init, payer = payer, space = 8 + ProtocolConfig::INIT_SPACE, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, ProtocolConfig>,
    pub settlement_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(params: InitializeMarketParams)]
pub struct InitializeMarket<'info> {
    #[account(mut, has_one = admin)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + MarketVault::INIT_SPACE, seeds = [MARKET_SEED, config.key().as_ref(), params.market_id.as_ref()], bump)]
    pub market: Account<'info, MarketVault>,
    #[account(init, payer = admin, space = 8 + PriceSnapshot::INIT_SPACE, seeds = [PRICE_SEED, market.key().as_ref()], bump)]
    pub price: Account<'info, PriceSnapshot>,
    pub yes_mint: Account<'info, Mint>,
    pub no_mint: Account<'info, Mint>,
    #[account(token::mint = yes_mint, token::authority = market)]
    pub yes_vault: Account<'info, TokenAccount>,
    #[account(token::mint = no_mint, token::authority = market)]
    pub no_vault: Account<'info, TokenAccount>,
    #[account(token::mint = settlement_mint, token::authority = market)]
    pub settlement_vault: Account<'info, TokenAccount>,
    #[account(address = config.settlement_mint)]
    pub settlement_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializePosition<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub market: Account<'info, MarketVault>,
    #[account(init, payer = owner, space = 8 + UserPosition::INIT_SPACE, seeds = [POSITION_SEED, market.key().as_ref(), owner.key().as_ref()], bump)]
    pub position: Account<'info, UserPosition>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    #[account(mut)]
    pub config: Account<'info, ProtocolConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    pub config: Account<'info, ProtocolConfig>,
    #[account(mut, has_one = config)]
    pub market: Account<'info, MarketVault>,
    #[account(mut, has_one = market, has_one = owner, seeds = [POSITION_SEED, market.key().as_ref(), owner.key().as_ref()], bump = position.bump)]
    pub position: Account<'info, UserPosition>,
    pub owner: Signer<'info>,
    #[account(mut, token::mint = mint, token::authority = owner)]
    pub user_source: Account<'info, TokenAccount>,
    #[account(mut, token::mint = mint, token::authority = market)]
    pub vault: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawUnmatched<'info> {
    pub config: Account<'info, ProtocolConfig>,
    #[account(mut, has_one = config)]
    pub market: Account<'info, MarketVault>,
    #[account(mut, has_one = market, has_one = owner, seeds = [POSITION_SEED, market.key().as_ref(), owner.key().as_ref()], bump = position.bump)]
    pub position: Account<'info, UserPosition>,
    pub owner: Signer<'info>,
    #[account(mut, token::mint = mint, token::authority = market)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = mint, token::authority = owner)]
    pub user_destination: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct MatchPositions<'info> {
    pub config: Account<'info, ProtocolConfig>,
    #[account(mut, has_one = config)]
    pub market: Account<'info, MarketVault>,
    #[account(mut, has_one = market, constraint = yes_position.owner == yes_owner.key() @ CapitalError::Unauthorized)]
    pub yes_position: Account<'info, UserPosition>,
    /// CHECK: Key and optional signer status are checked against yes_position.
    pub yes_owner: UncheckedAccount<'info>,
    #[account(mut, has_one = market, constraint = no_position.owner == no_owner.key() @ CapitalError::Unauthorized)]
    pub no_position: Account<'info, UserPosition>,
    /// CHECK: Key and optional signer status are checked against no_position.
    pub no_owner: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct HarvestYield<'info> {
    pub config: Account<'info, ProtocolConfig>,
    #[account(mut, has_one = config, has_one = settlement_vault)]
    pub market: Account<'info, MarketVault>,
    pub authority: Signer<'info>,
    #[account(mut, token::mint = settlement_mint, token::authority = authority)]
    pub strategy_source: Account<'info, TokenAccount>,
    #[account(mut, token::mint = settlement_mint, token::authority = market)]
    pub settlement_vault: Account<'info, TokenAccount>,
    #[account(address = config.settlement_mint)]
    pub settlement_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimYield<'info> {
    pub config: Account<'info, ProtocolConfig>,
    #[account(mut, has_one = config, has_one = settlement_vault)]
    pub market: Account<'info, MarketVault>,
    #[account(mut, has_one = market, has_one = owner)]
    pub position: Account<'info, UserPosition>,
    pub owner: Signer<'info>,
    #[account(mut, token::mint = settlement_mint, token::authority = market)]
    pub settlement_vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = settlement_mint, token::authority = owner)]
    pub user_destination: Account<'info, TokenAccount>,
    #[account(address = config.settlement_mint)]
    pub settlement_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub market: Account<'info, MarketVault>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    pub config: Account<'info, ProtocolConfig>,
    #[account(has_one = config)]
    pub market: Account<'info, MarketVault>,
    #[account(mut, has_one = market, seeds = [PRICE_SEED, market.key().as_ref()], bump = price.bump)]
    pub price: Account<'info, PriceSnapshot>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitializeLendingPool<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub config: Account<'info, ProtocolConfig>,
    #[account(has_one = config)]
    pub market: Account<'info, MarketVault>,
    #[account(init, payer = payer, space = 8 + LendingPool::INIT_SPACE, seeds = [LENDING_SEED, market.key().as_ref()], bump)]
    pub pool: Account<'info, LendingPool>,
    #[account(token::mint = settlement_mint, token::authority = pool)]
    pub lending_vault: Account<'info, TokenAccount>,
    #[account(address = config.settlement_mint)]
    pub settlement_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeLender<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub pool: Account<'info, LendingPool>,
    #[account(init, payer = owner, space = 8 + LenderPosition::INIT_SPACE, seeds = [LENDER_SEED, pool.key().as_ref(), owner.key().as_ref()], bump)]
    pub lender: Account<'info, LenderPosition>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundLending<'info> {
    pub config: Account<'info, ProtocolConfig>,
    pub market: Account<'info, MarketVault>,
    #[account(mut, has_one = market, constraint = pool.settlement_vault == lending_vault.key() @ CapitalError::InvalidVault)]
    pub pool: Account<'info, LendingPool>,
    #[account(mut, has_one = pool, has_one = owner)]
    pub lender: Account<'info, LenderPosition>,
    pub owner: Signer<'info>,
    #[account(mut, token::mint = settlement_mint, token::authority = owner)]
    pub lender_source: Account<'info, TokenAccount>,
    #[account(mut, token::mint = settlement_mint, token::authority = pool)]
    pub lending_vault: Account<'info, TokenAccount>,
    #[account(address = config.settlement_mint)]
    pub settlement_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawLending<'info> {
    pub config: Account<'info, ProtocolConfig>,
    pub market: Account<'info, MarketVault>,
    #[account(mut, has_one = market, constraint = pool.settlement_vault == lending_vault.key() @ CapitalError::InvalidVault)]
    pub pool: Account<'info, LendingPool>,
    #[account(mut, has_one = pool, has_one = owner)]
    pub lender: Account<'info, LenderPosition>,
    pub owner: Signer<'info>,
    #[account(mut, token::mint = settlement_mint, token::authority = pool)]
    pub lending_vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = settlement_mint, token::authority = owner)]
    pub lender_destination: Account<'info, TokenAccount>,
    #[account(address = config.settlement_mint)]
    pub settlement_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct InitializeLoan<'info> {
    #[account(mut)]
    pub borrower: Signer<'info>,
    #[account(mut)]
    pub pool: Account<'info, LendingPool>,
    #[account(init, payer = borrower, space = 8 + LoanPosition::INIT_SPACE, seeds = [LOAN_SEED, pool.key().as_ref(), borrower.key().as_ref()], bump)]
    pub loan: Account<'info, LoanPosition>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Borrow<'info> {
    pub config: Account<'info, ProtocolConfig>,
    pub market: Account<'info, MarketVault>,
    #[account(mut, has_one = market, constraint = pool.settlement_vault == lending_vault.key() @ CapitalError::InvalidVault)]
    pub pool: Account<'info, LendingPool>,
    #[account(mut, has_one = pool, has_one = borrower)]
    pub loan: Account<'info, LoanPosition>,
    #[account(mut, has_one = market, constraint = position.owner == borrower.key() @ CapitalError::Unauthorized)]
    pub position: Account<'info, UserPosition>,
    #[account(has_one = market)]
    pub price: Account<'info, PriceSnapshot>,
    pub borrower: Signer<'info>,
    #[account(mut, token::mint = settlement_mint, token::authority = pool)]
    pub lending_vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = settlement_mint, token::authority = borrower)]
    pub borrower_destination: Account<'info, TokenAccount>,
    #[account(address = config.settlement_mint)]
    pub settlement_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Repay<'info> {
    pub config: Account<'info, ProtocolConfig>,
    pub market: Account<'info, MarketVault>,
    #[account(mut, has_one = market, constraint = pool.settlement_vault == lending_vault.key() @ CapitalError::InvalidVault)]
    pub pool: Account<'info, LendingPool>,
    #[account(mut, has_one = pool, has_one = borrower)]
    pub loan: Account<'info, LoanPosition>,
    #[account(mut, has_one = market, constraint = position.owner == borrower.key() @ CapitalError::Unauthorized)]
    pub position: Account<'info, UserPosition>,
    #[account(has_one = market)]
    pub price: Account<'info, PriceSnapshot>,
    pub borrower: Signer<'info>,
    #[account(mut, token::mint = settlement_mint, token::authority = borrower)]
    pub borrower_source: Account<'info, TokenAccount>,
    #[account(mut, token::mint = settlement_mint, token::authority = pool)]
    pub lending_vault: Account<'info, TokenAccount>,
    #[account(address = config.settlement_mint)]
    pub settlement_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Liquidate<'info> {
    pub config: Box<Account<'info, ProtocolConfig>>,
    #[account(mut, has_one = config)]
    pub market: Box<Account<'info, MarketVault>>,
    #[account(mut, has_one = market, constraint = pool.settlement_vault == lending_vault.key() @ CapitalError::InvalidVault)]
    pub pool: Box<Account<'info, LendingPool>>,
    #[account(mut, has_one = pool)]
    pub loan: Box<Account<'info, LoanPosition>>,
    #[account(mut, has_one = market, constraint = position.owner == loan.borrower @ CapitalError::Unauthorized)]
    pub position: Box<Account<'info, UserPosition>>,
    #[account(has_one = market)]
    pub price: Box<Account<'info, PriceSnapshot>>,
    #[account(mut)]
    pub liquidator: Signer<'info>,
    #[account(mut, token::mint = settlement_mint, token::authority = liquidator)]
    pub liquidator_source: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = settlement_mint, token::authority = pool)]
    pub lending_vault: Box<Account<'info, TokenAccount>>,
    #[account(address = config.settlement_mint)]
    pub settlement_mint: Box<Account<'info, Mint>>,
    #[account(mut, token::mint = collateral_mint, token::authority = market)]
    pub collateral_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = collateral_mint, token::authority = liquidator)]
    pub liquidator_destination: Box<Account<'info, TokenAccount>>,
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(params: CreateIntentParams)]
pub struct CreateAgentIntent<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    pub market: Account<'info, MarketVault>,
    #[account(mut, has_one = market, has_one = owner)]
    pub position: Account<'info, UserPosition>,
    #[account(init, payer = owner, space = 8 + AgentIntent::INIT_SPACE, seeds = [INTENT_SEED, position.key().as_ref(), &params.nonce.to_le_bytes()], bump)]
    pub intent: Account<'info, AgentIntent>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteAgentIntent<'info> {
    pub market: Account<'info, MarketVault>,
    #[account(mut, has_one = market)]
    pub intent: Account<'info, AgentIntent>,
    pub keeper: Signer<'info>,
}

#[derive(Accounts)]
pub struct CancelAgentIntent<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner)]
    pub intent: Account<'info, AgentIntent>,
}

#[event]
pub struct ProtocolInitialized {
    pub config: Pubkey,
    pub admin: Pubkey,
}
#[event]
pub struct MarketInitialized {
    pub market: Pubkey,
    pub market_id: [u8; 32],
}
#[event]
pub struct PauseChanged {
    pub paused: bool,
}
#[event]
pub struct StrategyConfigured {
    pub adapter: Pubkey,
    pub enabled: bool,
}
#[event]
pub struct StrategyChangeProposed {
    pub adapter: Pubkey,
    pub enabled: bool,
    pub activate_after: i64,
}
#[event]
pub struct StrategyChangeCancelled {}
#[event]
pub struct AdminTransferProposed {
    pub current_admin: Pubkey,
    pub pending_admin: Pubkey,
}
#[event]
pub struct AdminTransferred {
    pub previous_admin: Pubkey,
    pub new_admin: Pubkey,
}
#[event]
pub struct ProtocolAuthoritiesUpdated {
    pub admin: Pubkey,
    pub emergency_authority: Pubkey,
    pub strategy_authority: Pubkey,
    pub oracle_authority: Pubkey,
}
#[event]
pub struct PositionDeposited {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub side: Side,
    pub amount: u64,
}
#[event]
pub struct PositionWithdrawn {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub side: Side,
    pub amount: u64,
}
#[event]
pub struct PositionsMatched {
    pub market: Pubkey,
    pub yes_owner: Pubkey,
    pub no_owner: Pubkey,
    pub amount: u64,
}
#[event]
pub struct PositionsUnmatched {
    pub market: Pubkey,
    pub yes_owner: Pubkey,
    pub no_owner: Pubkey,
    pub amount: u64,
}
#[event]
pub struct YieldHarvested {
    pub market: Pubkey,
    pub amount: u64,
    pub reward_index_x64: u128,
}
#[event]
pub struct YieldClaimed {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
}
#[event]
pub struct MarketResolved {
    pub market: Pubkey,
    pub winning_side: Side,
}
#[event]
pub struct PriceUpdated {
    pub market: Pubkey,
    pub observed_slot: u64,
    pub content_hash: [u8; 32],
}
#[event]
pub struct LendingFunded {
    pub pool: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub shares: u64,
}
#[event]
pub struct LendingWithdrawn {
    pub pool: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub shares: u64,
}
#[event]
pub struct LoanBorrowed {
    pub pool: Pubkey,
    pub borrower: Pubkey,
    pub amount: u64,
    pub collateral: u64,
}
#[event]
pub struct LoanRepaid {
    pub pool: Pubkey,
    pub borrower: Pubkey,
    pub amount: u64,
    pub collateral_unlocked: u64,
}
#[event]
pub struct LoanLiquidated {
    pub pool: Pubkey,
    pub borrower: Pubkey,
    pub liquidator: Pubkey,
    pub debt_repaid: u64,
    pub collateral_seized: u64,
}
#[event]
pub struct AgentIntentCreated {
    pub intent: Pubkey,
    pub owner: Pubkey,
    pub action: AgentAction,
    pub nonce: u64,
}
#[event]
pub struct AgentIntentExecuted {
    pub intent: Pubkey,
    pub keeper: Pubkey,
    pub nonce: u64,
}
#[event]
pub struct AgentIntentCancelled {
    pub intent: Pubkey,
    pub owner: Pubkey,
    pub nonce: u64,
}

fn validate_protocol_params(params: &InitializeProtocolParams) -> Result<()> {
    require!(
        params.emergency_authority != Pubkey::default(),
        CapitalError::Unauthorized
    );
    require!(
        params.strategy_authority != Pubkey::default(),
        CapitalError::Unauthorized
    );
    require!(
        params.oracle_authority != Pubkey::default(),
        CapitalError::Unauthorized
    );
    require!(
        params.strategy_delay_seconds >= MIN_STRATEGY_DELAY_SECONDS,
        CapitalError::StrategyTimelockActive
    );
    Ok(())
}

fn validate_protocol_authority_update(params: &UpdateProtocolAuthoritiesParams) -> Result<()> {
    require!(
        params.emergency_authority != Pubkey::default()
            && params.strategy_authority != Pubkey::default()
            && params.oracle_authority != Pubkey::default(),
        CapitalError::InvalidAuthority
    );
    Ok(())
}

fn validate_market_params(params: &InitializeMarketParams) -> Result<()> {
    require!(params.market_id != [0; 32], CapitalError::InvalidAmount);
    require!(
        params.resolution_authority != Pubkey::default(),
        CapitalError::Unauthorized
    );
    require!(
        params.tvl_cap > 0 && params.tvl_cap <= MAX_PROTOCOL_TVL,
        CapitalError::TvlCapExceeded
    );
    require!(
        params.max_ltv_bps > 0 && params.max_ltv_bps < params.liquidation_ltv_bps,
        CapitalError::LtvExceeded
    );
    require!(
        u64::from(params.liquidation_ltv_bps) < BPS_DENOMINATOR,
        CapitalError::LtvExceeded
    );
    require!(
        u64::from(params.collateral_haircut_bps) < BPS_DENOMINATOR,
        CapitalError::InvalidAmount
    );
    require!(
        params.max_oracle_age_seconds > 0,
        CapitalError::InvalidAmount
    );
    require!(
        params.resolution_time > 0
            && params.borrow_cutoff_seconds > 0
            && params.borrow_cutoff_seconds < params.resolution_time,
        CapitalError::InvalidLifecycle
    );
    require!(
        u64::from(params.max_confidence_bps) <= BPS_DENOMINATOR,
        CapitalError::InvalidAmount
    );
    Ok(())
}

fn require_legacy_token_mint(mint: &Account<Mint>) -> Result<()> {
    require_keys_eq!(
        *mint.to_account_info().owner,
        LEGACY_TOKEN_PROGRAM_ID,
        CapitalError::InvalidMint
    );
    Ok(())
}

fn validate_side_accounts(
    market: &MarketVault,
    side: Side,
    mint: &Account<Mint>,
    vault: &Account<TokenAccount>,
) -> Result<()> {
    let (expected_mint, expected_vault) = match side {
        Side::Yes => (market.yes_mint, market.yes_vault),
        Side::No => (market.no_mint, market.no_vault),
        Side::Unresolved => return err!(CapitalError::InvalidSide),
    };
    require_keys_eq!(mint.key(), expected_mint, CapitalError::InvalidMint);
    require_keys_eq!(vault.key(), expected_vault, CapitalError::InvalidVault);
    Ok(())
}

fn settle_position_rewards(market: &MarketVault, position: &mut UserPosition) -> Result<()> {
    let accrued = accrue_reward(
        position.matched_units()?,
        market.reward_index_x64,
        position.reward_index_x64,
    )?;
    position.pending_yield = add(position.pending_yield, accrued)?;
    position.reward_index_x64 = market.reward_index_x64;
    Ok(())
}

fn validate_price(market: &MarketVault, price: &PriceSnapshot) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(
        price.observed_at > 0
            && now.saturating_sub(price.observed_at) <= market.max_oracle_age_seconds,
        CapitalError::StaleOracle
    );
    require!(
        price.confidence_bps <= market.max_confidence_bps,
        CapitalError::OracleConfidenceTooWide
    );
    Ok(())
}

fn price_for_side(market: &MarketVault, price: &PriceSnapshot, side: Side) -> Result<u64> {
    match side {
        Side::Yes => conservative_price(
            price.yes_executable_bid,
            price.yes_twap,
            market.collateral_haircut_bps,
        ),
        Side::No => conservative_price(
            price.no_executable_bid,
            price.no_twap,
            market.collateral_haircut_bps,
        ),
        Side::Unresolved => err!(CapitalError::InvalidSide),
    }
}

fn unlock_collateral(position: &mut UserPosition, side: Side, amount: u64) -> Result<()> {
    match side {
        Side::Yes => position.locked_yes = sub(position.locked_yes, amount)?,
        Side::No => position.locked_no = sub(position.locked_no, amount)?,
        Side::Unresolved => return err!(CapitalError::InvalidSide),
    }
    Ok(())
}

fn repayment_state(
    borrowed_amount: u64,
    collateral_amount: u64,
    repayment_amount: u64,
    requested_collateral_unlock: u64,
) -> Result<(u64, u64, u64)> {
    let remaining_debt = sub(borrowed_amount, repayment_amount)?;
    // A terminal repayment always releases every remaining collateral token.
    // This prevents a caller from accidentally stranding collateral in a
    // zero-debt loan that can no longer accept another repayment.
    let collateral_to_unlock = if remaining_debt == 0 {
        collateral_amount
    } else {
        requested_collateral_unlock
    };
    let remaining_collateral = sub(collateral_amount, collateral_to_unlock)?;
    Ok((remaining_debt, remaining_collateral, collateral_to_unlock))
}

#[allow(clippy::too_many_arguments)]
fn transfer_tokens<'info>(
    token_program: &Program<'info, Token>,
    from: &Account<'info, TokenAccount>,
    to: &Account<'info, TokenAccount>,
    mint: &Account<'info, Mint>,
    authority: &AccountInfo<'info>,
    amount: u64,
    decimals: u8,
    signer_seeds: Option<&[&[u8]]>,
) -> Result<()> {
    let accounts = TransferChecked {
        from: from.to_account_info(),
        mint: mint.to_account_info(),
        to: to.to_account_info(),
        authority: authority.clone(),
    };
    let program = token_program.to_account_info();
    match signer_seeds {
        Some(seeds) => token::transfer_checked(
            CpiContext::new_with_signer(program, accounts, &[seeds]),
            amount,
            decimals,
        ),
        None => token::transfer_checked(CpiContext::new(program, accounts), amount, decimals),
    }
}

fn add(left: u64, right: u64) -> Result<u64> {
    left.checked_add(right)
        .ok_or_else(|| error!(CapitalError::MathOverflow))
}

fn sub(left: u64, right: u64) -> Result<u64> {
    left.checked_sub(right)
        .ok_or_else(|| error!(CapitalError::MathOverflow))
}

#[cfg(test)]
mod unit_tests {
    use super::*;

    #[test]
    fn market_parameter_guards_reject_unsafe_ltv() {
        let params = InitializeMarketParams {
            market_id: [1; 32],
            resolution_authority: Pubkey::new_unique(),
            tvl_cap: 1_000_000,
            max_ltv_bps: 7_500,
            liquidation_ltv_bps: 7_000,
            collateral_haircut_bps: 2_000,
            max_oracle_age_seconds: 60,
            max_confidence_bps: 500,
            resolution_time: 1,
            borrow_cutoff_seconds: 3_600,
        };
        assert!(validate_market_params(&params).is_err());
    }

    #[test]
    fn market_parameter_guards_require_a_borrow_cutoff() {
        let params = InitializeMarketParams {
            market_id: [1; 32],
            resolution_authority: Pubkey::new_unique(),
            tvl_cap: 1_000_000,
            max_ltv_bps: 3_500,
            liquidation_ltv_bps: 5_000,
            collateral_haircut_bps: 2_000,
            max_oracle_age_seconds: 60,
            max_confidence_bps: 500,
            resolution_time: 10_000,
            borrow_cutoff_seconds: 0,
        };
        assert!(validate_market_params(&params).is_err());
    }

    #[test]
    fn terminal_repayment_releases_all_collateral() {
        assert_eq!(repayment_state(100, 250, 100, 0).unwrap(), (0, 0, 250));
    }

    #[test]
    fn partial_repayment_uses_the_requested_collateral_release() {
        assert_eq!(repayment_state(100, 250, 40, 75).unwrap(), (60, 175, 75));
    }

    #[test]
    fn market_account_size_is_stable() {
        assert_eq!(MarketVault::INIT_SPACE, 435);
    }

    #[test]
    fn protocol_account_size_is_stable() {
        assert_eq!(ProtocolConfig::INIT_SPACE, 300);
    }

    #[test]
    fn strategy_configuration_requires_a_day_delay() {
        let mut params = InitializeProtocolParams {
            emergency_authority: Pubkey::new_unique(),
            strategy_authority: Pubkey::new_unique(),
            oracle_authority: Pubkey::new_unique(),
            strategy_delay_seconds: MIN_STRATEGY_DELAY_SECONDS,
        };
        assert!(validate_protocol_params(&params).is_ok());
        params.strategy_delay_seconds = MIN_STRATEGY_DELAY_SECONDS - 1;
        assert!(validate_protocol_params(&params).is_err());
    }

    #[test]
    fn protocol_authority_rotation_rejects_default_keys() {
        let mut params = UpdateProtocolAuthoritiesParams {
            emergency_authority: Pubkey::new_unique(),
            strategy_authority: Pubkey::new_unique(),
            oracle_authority: Pubkey::new_unique(),
        };
        assert!(validate_protocol_authority_update(&params).is_ok());
        params.oracle_authority = Pubkey::default();
        assert!(validate_protocol_authority_update(&params).is_err());
    }

    #[test]
    fn unmatched_excludes_matched_and_locked_tokens() {
        let position = UserPosition {
            market: Pubkey::default(),
            owner: Pubkey::default(),
            yes_amount: 100,
            no_amount: 0,
            matched_yes: 25,
            matched_no: 0,
            locked_yes: 10,
            locked_no: 0,
            pending_yield: 0,
            reward_index_x64: 0,
            next_intent_nonce: 0,
            bump: 0,
            reserved: [0; 31],
        };
        assert_eq!(position.unmatched(Side::Yes).unwrap(), 65);
    }
}
