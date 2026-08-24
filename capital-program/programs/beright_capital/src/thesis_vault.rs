use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_spl::{
    token::{self, Mint, Token, TokenAccount, TransferChecked},
    token_2022::Token2022,
    token_interface::{
        self, BurnChecked, InitializeMint2, Mint as InterfaceMint, MintToChecked,
        TokenAccount as InterfaceTokenAccount,
    },
};

use crate::{errors::CapitalError, state::ProtocolConfig};

pub const THESIS_SEED: &[u8] = b"thesis";
pub const THESIS_VAULT_SEED: &[u8] = b"thesis-vault";
pub const THESIS_SHARE_MINT_SEED: &[u8] = b"thesis-share";
pub const THESIS_LIQUID_VAULT_SEED: &[u8] = b"thesis-liquid";
pub const SIMULATED_POSITION_SEED: &[u8] = b"sim-position";
pub const REDEMPTION_SEED: &[u8] = b"redemption";
pub const THESIS_CONTRIBUTOR_SEED: &[u8] = b"thesis-contributor";

const BPS_DENOMINATOR: u64 = 10_000;
const HARD_MAX_PREDICTION_BPS: u16 = 2_500;
const HARD_MIN_RESERVE_BPS: u16 = 1_000;
const MAX_ACTIVE_POSITIONS: u8 = 10;
const MAX_METADATA_URI_BYTES: usize = 200;
const MAX_LOCKUP_SECONDS: i64 = 31_536_000;
const SHARE_PRICE_SCALE: u128 = 1u128 << 64;

#[account]
#[derive(InitSpace)]
pub struct Thesis {
    pub config: Pubkey,
    pub thesis_id: [u8; 32],
    pub creator: Pubkey,
    pub curator: Pubkey,
    pub vault: Pubkey,
    pub metadata_hash: [u8; 32],
    #[max_len(200)]
    pub metadata_uri: String,
    pub vault_type: ThesisVaultType,
    pub vault_structure: ThesisVaultStructure,
    pub thesis_status: ThesisStatus,
    pub prediction_allocation_max_bps: u16,
    pub defi_allocation_target_bps: u16,
    pub liquid_reserve_target_bps: u16,
    pub max_market_allocation_bps: u16,
    pub max_drawdown_bps: u16,
    pub curator_fee_bps: u16,
    pub protocol_fee_bps: u16,
    pub minimum_reputation_tier: u8,
    pub max_active_positions: u8,
    pub expiry: i64,
    pub lockup_seconds: i64,
    pub bump: u8,
    pub reserved: [u8; 22],
}

#[account]
#[derive(InitSpace)]
pub struct ThesisVault {
    pub thesis: Pubkey,
    pub deposit_mint: Pubkey,
    pub share_mint: Pubkey,
    pub liquid_vault: Pubkey,
    pub total_assets: u64,
    pub total_shares: u64,
    pub pending_redemption_shares: u64,
    pub accounting_liquid_assets: u64,
    pub defi_assets: u64,
    pub prediction_assets: u64,
    pub resolved_unclaimed_assets: u64,
    pub accrued_fees: u64,
    pub accrued_curator_fees: u64,
    pub accrued_protocol_fees: u64,
    pub liabilities: u64,
    pub simulated_prediction_principal: u64,
    pub simulated_defi_principal: u64,
    pub active_position_count: u8,
    pub deposit_cap: u64,
    pub nav_epoch: u64,
    pub last_nav_timestamp: i64,
    pub last_nav_hash: [u8; 32],
    pub high_water_mark_share_price_x64: u128,
    pub next_redemption_nonce: u64,
    pub max_nav_age_seconds: i64,
    pub max_nav_change_bps: u16,
    pub graduation_threshold: u64,
    pub qualifying_capital: u64,
    pub per_wallet_qualifying_cap: u64,
    pub unique_contributors: u32,
    pub minimum_unique_contributors: u16,
    pub graduated_at: i64,
    pub funding_yield_enabled: bool,
    pub funding_yield_target_bps: u16,
    pub funding_idle_principal: u64,
    pub funding_idle_assets: u64,
    pub paused: bool,
    pub bump: u8,
    pub reserved: [u8; 16],
}

#[account]
#[derive(InitSpace)]
pub struct ThesisContributor {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub deposited_assets: u64,
    pub owned_shares: u64,
    pub qualifying_assets: u64,
    pub last_deposit_at: i64,
    pub bump: u8,
    pub reserved: [u8; 7],
}

#[account]
#[derive(InitSpace)]
pub struct SimulatedPosition {
    pub vault: Pubkey,
    pub market_id: [u8; 32],
    pub allocated_principal: u64,
    pub maximum_entry_price: u64,
    pub side: PredictionSide,
    pub active: bool,
    pub updated_at: i64,
    pub bump: u8,
    pub reserved: [u8; 30],
}

#[account]
#[derive(InitSpace)]
pub struct RedemptionRequest {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub shares: u64,
    pub minimum_assets_out: u64,
    pub request_nav_epoch: u64,
    pub nonce: u64,
    pub assets_settled: u64,
    pub status: RedemptionStatus,
    pub requested_at: i64,
    pub settled_at: i64,
    pub funding_principal_removed: u64,
    pub funding_qualifying_removed: u64,
    pub funding_contributor_removed: bool,
    pub bump: u8,
    pub reserved: [u8; 13],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
#[repr(u8)]
pub enum ThesisVaultType {
    Index = 0,
    Curated = 1,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
#[repr(u8)]
pub enum ThesisVaultStructure {
    ClosedEnded = 0,
    OpenEnded = 1,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
#[repr(u8)]
pub enum ThesisStatus {
    Funding = 0,
    Active = 1,
    Paused = 2,
    Expired = 3,
    Closed = 4,
    Dormant = 5,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
#[repr(u8)]
pub enum PredictionSide {
    Yes = 0,
    No = 1,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
#[repr(u8)]
pub enum RedemptionStatus {
    Pending = 0,
    Cancelled = 1,
    Settled = 2,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateThesisParams {
    pub thesis_id: [u8; 32],
    pub curator: Pubkey,
    pub metadata_hash: [u8; 32],
    pub metadata_uri: String,
    pub vault_type: ThesisVaultType,
    pub vault_structure: ThesisVaultStructure,
    pub prediction_allocation_max_bps: u16,
    pub defi_allocation_target_bps: u16,
    pub liquid_reserve_target_bps: u16,
    pub max_market_allocation_bps: u16,
    pub max_drawdown_bps: u16,
    pub curator_fee_bps: u16,
    pub protocol_fee_bps: u16,
    pub minimum_reputation_tier: u8,
    pub max_active_positions: u8,
    pub expiry: i64,
    pub lockup_seconds: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeThesisVaultParams {
    pub deposit_cap: u64,
    pub graduation_threshold: u64,
    pub per_wallet_qualifying_cap: u64,
    pub minimum_unique_contributors: u16,
    pub funding_yield_target_bps: u16,
    pub max_nav_age_seconds: i64,
    pub max_nav_change_bps: u16,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SimulatedPositionParams {
    pub market_id: [u8; 32],
    pub allocated_principal: u64,
    pub maximum_entry_price: u64,
    pub side: PredictionSide,
    pub active: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct NavCheckpoint {
    pub epoch: u64,
    pub accounting_liquid_assets: u64,
    pub defi_assets: u64,
    pub prediction_assets: u64,
    pub resolved_unclaimed_assets: u64,
    pub liabilities: u64,
    pub observed_at: i64,
    pub content_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct FundingYieldCheckpoint {
    pub epoch: u64,
    pub idle_assets: u64,
    pub observed_at: i64,
    pub content_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RedemptionParams {
    pub shares: u64,
    pub minimum_assets_out: u64,
    pub nonce: u64,
}

pub fn create_thesis(ctx: Context<CreateThesis>, params: CreateThesisParams) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    validate_thesis_params(&params, now)?;
    require!(!ctx.accounts.config.paused, CapitalError::ProtocolPaused);

    let thesis = &mut ctx.accounts.thesis;
    thesis.config = ctx.accounts.config.key();
    thesis.thesis_id = params.thesis_id;
    thesis.creator = ctx.accounts.creator.key();
    thesis.curator = params.curator;
    thesis.vault = Pubkey::default();
    thesis.metadata_hash = params.metadata_hash;
    thesis.metadata_uri = params.metadata_uri;
    thesis.vault_type = params.vault_type;
    thesis.vault_structure = params.vault_structure;
    thesis.thesis_status = initial_thesis_status(params.vault_structure);
    thesis.prediction_allocation_max_bps = params.prediction_allocation_max_bps;
    thesis.defi_allocation_target_bps = params.defi_allocation_target_bps;
    thesis.liquid_reserve_target_bps = params.liquid_reserve_target_bps;
    thesis.max_market_allocation_bps = params.max_market_allocation_bps;
    thesis.max_drawdown_bps = params.max_drawdown_bps;
    thesis.curator_fee_bps = params.curator_fee_bps;
    thesis.protocol_fee_bps = params.protocol_fee_bps;
    thesis.minimum_reputation_tier = params.minimum_reputation_tier;
    thesis.max_active_positions = params.max_active_positions;
    thesis.expiry = params.expiry;
    thesis.lockup_seconds = params.lockup_seconds;
    thesis.bump = ctx.bumps.thesis;
    thesis.reserved = [0; 22];

    emit!(ThesisCreated {
        thesis: thesis.key(),
        creator: thesis.creator,
        curator: thesis.curator,
        thesis_id: thesis.thesis_id,
        vault_structure: thesis.vault_structure,
        initial_status: thesis.thesis_status,
    });
    Ok(())
}

pub fn initialize_thesis_vault(
    ctx: Context<InitializeThesisVault>,
    params: InitializeThesisVaultParams,
) -> Result<()> {
    require!(!ctx.accounts.config.paused, CapitalError::ProtocolPaused);
    require!(
        is_vault_initializer(
            ctx.accounts.payer.key(),
            ctx.accounts.thesis.creator,
            ctx.accounts.thesis.curator,
        ),
        CapitalError::Unauthorized
    );
    validate_vault_initialization(
        ctx.accounts.thesis.vault_structure,
        ctx.accounts.thesis.thesis_status,
        &params,
    )?;

    let initialize_non_transferable =
        anchor_spl::token_2022::spl_token_2022::instruction::initialize_non_transferable_mint(
            &ctx.accounts.share_token_program.key(),
            &ctx.accounts.share_mint.key(),
        )?;
    invoke(
        &initialize_non_transferable,
        &[
            ctx.accounts.share_token_program.to_account_info(),
            ctx.accounts.share_mint.to_account_info(),
        ],
    )?;
    token_interface::initialize_mint2(
        CpiContext::new(
            ctx.accounts.share_token_program.to_account_info(),
            InitializeMint2 {
                mint: ctx.accounts.share_mint.to_account_info(),
            },
        ),
        ctx.accounts.deposit_mint.decimals,
        &ctx.accounts.vault.key(),
        Some(&ctx.accounts.vault.key()),
    )?;

    let now = Clock::get()?.unix_timestamp;
    let vault = &mut ctx.accounts.vault;
    vault.thesis = ctx.accounts.thesis.key();
    vault.deposit_mint = ctx.accounts.deposit_mint.key();
    vault.share_mint = ctx.accounts.share_mint.key();
    vault.liquid_vault = ctx.accounts.liquid_vault.key();
    vault.total_assets = 0;
    vault.total_shares = 0;
    vault.pending_redemption_shares = 0;
    vault.accounting_liquid_assets = 0;
    vault.defi_assets = 0;
    vault.prediction_assets = 0;
    vault.resolved_unclaimed_assets = 0;
    vault.accrued_fees = 0;
    vault.accrued_curator_fees = 0;
    vault.accrued_protocol_fees = 0;
    vault.liabilities = 0;
    vault.simulated_prediction_principal = 0;
    vault.simulated_defi_principal = 0;
    vault.active_position_count = 0;
    vault.deposit_cap = params.deposit_cap;
    vault.nav_epoch = 0;
    vault.last_nav_timestamp = now;
    vault.last_nav_hash = [0; 32];
    vault.high_water_mark_share_price_x64 = 0;
    vault.next_redemption_nonce = 0;
    vault.max_nav_age_seconds = params.max_nav_age_seconds;
    vault.max_nav_change_bps = params.max_nav_change_bps;
    vault.graduation_threshold = params.graduation_threshold;
    vault.qualifying_capital = 0;
    vault.per_wallet_qualifying_cap = params.per_wallet_qualifying_cap;
    vault.unique_contributors = 0;
    vault.minimum_unique_contributors = params.minimum_unique_contributors;
    vault.graduated_at = 0;
    vault.funding_yield_enabled = false;
    vault.funding_yield_target_bps = params.funding_yield_target_bps;
    vault.funding_idle_principal = 0;
    vault.funding_idle_assets = 0;
    vault.paused = false;
    vault.bump = ctx.bumps.vault;
    vault.reserved = [0; 16];

    ctx.accounts.thesis.vault = vault.key();
    emit!(ThesisVaultInitialized {
        thesis: ctx.accounts.thesis.key(),
        vault: vault.key(),
        share_mint: vault.share_mint,
        deposit_cap: vault.deposit_cap,
        vault_structure: ctx.accounts.thesis.vault_structure,
        graduation_threshold: vault.graduation_threshold,
        minimum_unique_contributors: vault.minimum_unique_contributors,
    });
    Ok(())
}

pub fn deposit_thesis_vault(
    ctx: Context<DepositThesisVault>,
    amount: u64,
    minimum_shares: u64,
) -> Result<()> {
    require!(amount > 0, CapitalError::InvalidAmount);
    require!(!ctx.accounts.config.paused, CapitalError::ProtocolPaused);
    require!(!ctx.accounts.vault.paused, CapitalError::ProtocolPaused);
    let previous_status = ctx.accounts.thesis.thesis_status;
    let is_funding = previous_status == ThesisStatus::Funding;
    require!(
        accepts_deposit(ctx.accounts.thesis.vault_structure, previous_status),
        CapitalError::ThesisNotActive
    );
    let now = Clock::get()?.unix_timestamp;
    if ctx.accounts.thesis.expiry > 0 {
        require!(
            now < ctx.accounts.thesis.expiry,
            CapitalError::InvalidLifecycle
        );
    }
    if is_funding {
        require!(
            ctx.accounts.vault.total_assets
                == add(
                    ctx.accounts.vault.accounting_liquid_assets,
                    ctx.accounts.vault.funding_idle_assets,
                )?
                && ctx.accounts.vault.defi_assets == 0
                && ctx.accounts.vault.prediction_assets == 0
                && ctx.accounts.vault.simulated_defi_principal == 0
                && ctx.accounts.vault.simulated_prediction_principal == 0
                && ctx.accounts.vault.accrued_fees == 0
                && ctx.accounts.vault.liabilities == 0,
            CapitalError::FundingCapitalMustRemainLiquid
        );
        if ctx.accounts.vault.funding_yield_enabled {
            require_nav_fresh(&ctx.accounts.vault, now)?;
        }
    } else if ctx.accounts.vault.total_shares > 0 {
        require_nav_fresh(&ctx.accounts.vault, now)?;
    }
    require!(
        ctx.accounts
            .vault
            .total_assets
            .checked_add(amount)
            .ok_or(CapitalError::MathOverflow)?
            <= ctx.accounts.vault.deposit_cap,
        CapitalError::DepositCapExceeded
    );
    validate_share_supply(&ctx.accounts.vault, ctx.accounts.share_mint.supply)?;

    let shares = if is_funding && !ctx.accounts.vault.funding_yield_enabled {
        amount
    } else {
        shares_for_deposit(
            amount,
            ctx.accounts.vault.total_shares,
            ctx.accounts.vault.total_assets,
        )?
    };
    require!(shares > 0, CapitalError::InvalidAmount);
    require!(
        shares >= minimum_shares,
        CapitalError::ShareSlippageExceeded
    );

    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.deposit_token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.user_deposit_account.to_account_info(),
                mint: ctx.accounts.deposit_mint.to_account_info(),
                to: ctx.accounts.liquid_vault.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.deposit_mint.decimals,
    )?;

    let thesis_key = ctx.accounts.thesis.key();
    let vault_bump = [ctx.accounts.vault.bump];
    let vault_seeds: &[&[u8]] = &[THESIS_VAULT_SEED, thesis_key.as_ref(), &vault_bump];
    token_interface::mint_to_checked(
        CpiContext::new_with_signer(
            ctx.accounts.share_token_program.to_account_info(),
            MintToChecked {
                mint: ctx.accounts.share_mint.to_account_info(),
                to: ctx.accounts.user_share_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[vault_seeds],
        ),
        shares,
        ctx.accounts.share_mint.decimals,
    )?;

    let mut graduated = false;
    let mut activated = false;
    {
        let vault = &mut ctx.accounts.vault;
        vault.total_assets = add(vault.total_assets, amount)?;
        vault.total_shares = add(vault.total_shares, shares)?;
        vault.accounting_liquid_assets = add(vault.accounting_liquid_assets, amount)?;
        if vault.high_water_mark_share_price_x64 == 0 {
            vault.high_water_mark_share_price_x64 =
                share_price_x64(vault.total_assets, vault.total_shares)?;
        }

        let contributor = &mut ctx.accounts.contributor;
        if contributor.vault == Pubkey::default() {
            contributor.vault = vault.key();
            contributor.owner = ctx.accounts.owner.key();
            contributor.bump = ctx.bumps.contributor;
            contributor.reserved = [0; 7];
        } else {
            require_keys_eq!(contributor.vault, vault.key(), CapitalError::InvalidVault);
            require_keys_eq!(
                contributor.owner,
                ctx.accounts.owner.key(),
                CapitalError::Unauthorized
            );
        }
        let previous_assets = contributor.deposited_assets;
        contributor.deposited_assets = add(previous_assets, amount)?;
        contributor.owned_shares = add(contributor.owned_shares, shares)?;
        contributor.last_deposit_at = now;

        if is_funding {
            let previous_qualifying = contributor.qualifying_assets;
            contributor.qualifying_assets = contributor
                .deposited_assets
                .min(vault.per_wallet_qualifying_cap);
            vault.qualifying_capital = add(
                vault.qualifying_capital,
                contributor
                    .qualifying_assets
                    .checked_sub(previous_qualifying)
                    .ok_or(CapitalError::MathOverflow)?,
            )?;
            if previous_assets == 0 {
                vault.unique_contributors = vault
                    .unique_contributors
                    .checked_add(1)
                    .ok_or(CapitalError::MathOverflow)?;
            }
            if vault.qualifying_capital >= vault.graduation_threshold
                && vault.unique_contributors >= u32::from(vault.minimum_unique_contributors)
            {
                ctx.accounts.thesis.thesis_status = ThesisStatus::Active;
                vault.graduated_at = now;
                graduated = true;
            }
        } else if ctx.accounts.thesis.vault_structure == ThesisVaultStructure::OpenEnded
            && previous_status == ThesisStatus::Dormant
        {
            ctx.accounts.thesis.thesis_status = ThesisStatus::Active;
            activated = true;
        }
    }
    emit!(ThesisDeposit {
        vault: ctx.accounts.vault.key(),
        owner: ctx.accounts.owner.key(),
        assets: amount,
        shares,
    });
    if graduated {
        emit!(ThesisGraduated {
            thesis: ctx.accounts.thesis.key(),
            vault: ctx.accounts.vault.key(),
            qualifying_capital: ctx.accounts.vault.qualifying_capital,
            unique_contributors: ctx.accounts.vault.unique_contributors,
            graduated_at: now,
        });
    }
    if activated {
        emit!(ThesisLifecycleChanged {
            thesis: ctx.accounts.thesis.key(),
            vault: ctx.accounts.vault.key(),
            previous_status,
            next_status: ThesisStatus::Active,
            changed_at: now,
        });
    }
    Ok(())
}

pub fn cancel_thesis_funding(
    ctx: Context<CancelThesisFunding>,
    shares: u64,
    minimum_assets_out: u64,
) -> Result<()> {
    require!(shares > 0, CapitalError::InvalidAmount);
    require!(!ctx.accounts.config.paused, CapitalError::ProtocolPaused);
    require!(!ctx.accounts.vault.paused, CapitalError::ProtocolPaused);
    require!(
        ctx.accounts.thesis.vault_structure == ThesisVaultStructure::ClosedEnded,
        CapitalError::InvalidVaultStructure
    );
    require!(
        ctx.accounts.thesis.thesis_status == ThesisStatus::Funding,
        CapitalError::FundingAlreadyGraduated
    );
    let assets_out = assets_for_redemption(
        shares,
        ctx.accounts.vault.total_shares,
        ctx.accounts.vault.total_assets,
    )?;
    require!(
        assets_out >= minimum_assets_out,
        CapitalError::RedemptionSlippageExceeded
    );
    require!(
        ctx.accounts.contributor.owned_shares >= shares,
        CapitalError::InsufficientRedemptionLiquidity
    );
    require!(
        ctx.accounts.vault.accounting_liquid_assets >= assets_out,
        CapitalError::InsufficientRedemptionLiquidity
    );
    validate_share_supply(&ctx.accounts.vault, ctx.accounts.share_mint.supply)?;

    token_interface::burn_checked(
        CpiContext::new(
            ctx.accounts.share_token_program.to_account_info(),
            BurnChecked {
                mint: ctx.accounts.share_mint.to_account_info(),
                from: ctx.accounts.user_share_account.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        shares,
        ctx.accounts.share_mint.decimals,
    )?;

    let thesis_key = ctx.accounts.thesis.key();
    let vault_bump = [ctx.accounts.vault.bump];
    let vault_seeds: &[&[u8]] = &[THESIS_VAULT_SEED, thesis_key.as_ref(), &vault_bump];
    token::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.deposit_token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.liquid_vault.to_account_info(),
                mint: ctx.accounts.deposit_mint.to_account_info(),
                to: ctx.accounts.user_deposit_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[vault_seeds],
        ),
        assets_out,
        ctx.accounts.deposit_mint.decimals,
    )?;

    let contributor = &mut ctx.accounts.contributor;
    let previous_shares = contributor.owned_shares;
    let principal_reduction = if shares == previous_shares {
        contributor.deposited_assets
    } else {
        checked_mul_div(shares, contributor.deposited_assets, previous_shares)?
    };
    let previous_qualifying = contributor.qualifying_assets;
    contributor.deposited_assets = sub(contributor.deposited_assets, principal_reduction)?;
    contributor.owned_shares = sub(contributor.owned_shares, shares)?;
    contributor.qualifying_assets = contributor
        .deposited_assets
        .min(ctx.accounts.vault.per_wallet_qualifying_cap);
    let qualifying_reduction = previous_qualifying
        .checked_sub(contributor.qualifying_assets)
        .ok_or(CapitalError::MathOverflow)?;

    let vault = &mut ctx.accounts.vault;
    vault.total_assets = sub(vault.total_assets, assets_out)?;
    vault.total_shares = sub(vault.total_shares, shares)?;
    vault.accounting_liquid_assets = sub(vault.accounting_liquid_assets, assets_out)?;
    vault.qualifying_capital = sub(vault.qualifying_capital, qualifying_reduction)?;
    if contributor.deposited_assets == 0 {
        vault.unique_contributors = vault
            .unique_contributors
            .checked_sub(1)
            .ok_or(CapitalError::MathOverflow)?;
    }
    emit!(ThesisFundingCancelled {
        vault: vault.key(),
        owner: ctx.accounts.owner.key(),
        shares_burned: shares,
        assets_returned: assets_out,
    });
    Ok(())
}

pub fn configure_funding_yield(ctx: Context<ConfigureFundingYield>, enabled: bool) -> Result<()> {
    require!(!ctx.accounts.config.paused, CapitalError::ProtocolPaused);
    require!(
        ctx.accounts.thesis.vault_structure == ThesisVaultStructure::ClosedEnded,
        CapitalError::InvalidVaultStructure
    );
    require!(
        ctx.accounts.thesis.thesis_status == ThesisStatus::Funding,
        CapitalError::InvalidLifecycle
    );
    if !enabled {
        require!(
            ctx.accounts.vault.funding_idle_principal == 0
                && ctx.accounts.vault.funding_idle_assets == 0,
            CapitalError::CapitalStillDeployed
        );
    }
    ctx.accounts.vault.funding_yield_enabled = enabled;
    emit!(FundingYieldConfigurationChanged {
        vault: ctx.accounts.vault.key(),
        enabled,
        target_bps: ctx.accounts.vault.funding_yield_target_bps,
    });
    Ok(())
}

pub fn set_simulated_funding_yield_allocation(
    ctx: Context<ManageFundingYield>,
    principal: u64,
) -> Result<()> {
    require!(!ctx.accounts.config.paused, CapitalError::ProtocolPaused);
    require!(!ctx.accounts.vault.paused, CapitalError::ProtocolPaused);
    require!(
        ctx.accounts.thesis.vault_structure == ThesisVaultStructure::ClosedEnded,
        CapitalError::InvalidVaultStructure
    );
    require!(
        ctx.accounts.authority.key() == ctx.accounts.config.strategy_authority
            || ctx.accounts.authority.key() == ctx.accounts.config.admin,
        CapitalError::Unauthorized
    );
    let is_funding = ctx.accounts.thesis.thesis_status == ThesisStatus::Funding;
    require!(
        is_funding || ctx.accounts.thesis.thesis_status == ThesisStatus::Active,
        CapitalError::InvalidLifecycle
    );
    require!(
        ctx.accounts.vault.funding_yield_enabled || principal == 0,
        CapitalError::AdapterDisabled
    );
    if !is_funding {
        require!(
            principal <= ctx.accounts.vault.funding_idle_principal,
            CapitalError::InvalidLifecycle
        );
    }
    let maximum_principal = bps_amount(
        ctx.accounts.vault.total_assets,
        ctx.accounts.vault.funding_yield_target_bps,
    )?;
    require!(
        principal <= maximum_principal,
        CapitalError::StrategyLimitExceeded
    );

    let vault = &mut ctx.accounts.vault;
    let previous_principal = vault.funding_idle_principal;
    if principal > previous_principal {
        let deployed = sub(principal, previous_principal)?;
        require!(
            vault.accounting_liquid_assets >= deployed,
            CapitalError::InsufficientLiquidity
        );
        vault.accounting_liquid_assets = sub(vault.accounting_liquid_assets, deployed)?;
        vault.funding_idle_assets = add(vault.funding_idle_assets, deployed)?;
    } else if principal < previous_principal {
        let principal_recalled = sub(previous_principal, principal)?;
        let assets_recalled = if principal == 0 {
            vault.funding_idle_assets
        } else {
            checked_mul_div(
                principal_recalled,
                vault.funding_idle_assets,
                previous_principal,
            )?
        };
        vault.funding_idle_assets = sub(vault.funding_idle_assets, assets_recalled)?;
        vault.accounting_liquid_assets = add(vault.accounting_liquid_assets, assets_recalled)?;
    }
    vault.funding_idle_principal = principal;
    emit!(SimulatedFundingYieldAllocationUpdated {
        vault: vault.key(),
        principal,
        current_value: vault.funding_idle_assets,
        liquid_assets: vault.accounting_liquid_assets,
    });
    Ok(())
}

pub fn submit_funding_yield_nav(
    ctx: Context<SubmitFundingYieldNav>,
    checkpoint: FundingYieldCheckpoint,
) -> Result<()> {
    require!(!ctx.accounts.config.paused, CapitalError::ProtocolPaused);
    require!(
        ctx.accounts.thesis.vault_structure == ThesisVaultStructure::ClosedEnded,
        CapitalError::InvalidVaultStructure
    );
    require!(
        ctx.accounts.thesis.thesis_status == ThesisStatus::Funding,
        CapitalError::InvalidLifecycle
    );
    require!(
        ctx.accounts.vault.funding_yield_enabled,
        CapitalError::AdapterDisabled
    );
    require!(
        checkpoint.epoch == add(ctx.accounts.vault.nav_epoch, 1)?,
        CapitalError::StaleUpdate
    );
    require!(
        checkpoint.observed_at > ctx.accounts.vault.last_nav_timestamp
            && checkpoint.observed_at <= Clock::get()?.unix_timestamp,
        CapitalError::StaleUpdate
    );
    require!(checkpoint.content_hash != [0; 32], CapitalError::InvalidNav);
    let next_total_assets = add(
        ctx.accounts.vault.accounting_liquid_assets,
        checkpoint.idle_assets,
    )?;
    validate_nav_change(
        ctx.accounts.vault.total_assets,
        next_total_assets,
        ctx.accounts.vault.max_nav_change_bps,
    )?;
    let vault = &mut ctx.accounts.vault;
    vault.funding_idle_assets = checkpoint.idle_assets;
    vault.total_assets = next_total_assets;
    vault.nav_epoch = checkpoint.epoch;
    vault.last_nav_timestamp = checkpoint.observed_at;
    vault.last_nav_hash = checkpoint.content_hash;
    emit!(FundingYieldNavSubmitted {
        vault: vault.key(),
        epoch: vault.nav_epoch,
        idle_principal: vault.funding_idle_principal,
        idle_assets: vault.funding_idle_assets,
        total_assets: vault.total_assets,
        content_hash: vault.last_nav_hash,
    });
    Ok(())
}

pub fn upsert_simulated_position(
    ctx: Context<UpsertSimulatedPosition>,
    params: SimulatedPositionParams,
) -> Result<()> {
    require!(params.market_id != [0; 32], CapitalError::InvalidAmount);
    require!(
        params.maximum_entry_price <= 1_000_000,
        CapitalError::InvalidAmount
    );
    require!(
        !params.active || (params.allocated_principal > 0 && params.maximum_entry_price > 0),
        CapitalError::InvalidAmount
    );
    require!(!ctx.accounts.config.paused, CapitalError::ProtocolPaused);
    require!(!ctx.accounts.vault.paused, CapitalError::ProtocolPaused);
    require!(
        ctx.accounts.thesis.thesis_status == ThesisStatus::Active,
        CapitalError::ThesisNotActive
    );
    require!(
        ctx.accounts.vault.funding_idle_principal == 0
            && ctx.accounts.vault.funding_idle_assets == 0,
        CapitalError::FundingYieldExitRequired
    );
    require!(
        ctx.accounts.authority.key() == ctx.accounts.thesis.curator
            || ctx.accounts.authority.key() == ctx.accounts.config.strategy_authority,
        CapitalError::Unauthorized
    );

    let position_initialized = ctx.accounts.position.vault != Pubkey::default();
    let old_amount = if !position_initialized {
        0
    } else {
        require_keys_eq!(
            ctx.accounts.position.vault,
            ctx.accounts.vault.key(),
            CapitalError::InvalidVault
        );
        ctx.accounts.position.allocated_principal
    };
    let next_amount = if params.active {
        params.allocated_principal
    } else {
        0
    };
    let new_total = ctx
        .accounts
        .vault
        .simulated_prediction_principal
        .checked_sub(old_amount)
        .and_then(|value| value.checked_add(next_amount))
        .ok_or(CapitalError::MathOverflow)?;
    validate_prediction_allocation(
        ctx.accounts.vault.total_assets,
        new_total,
        next_amount,
        &ctx.accounts.thesis,
    )?;
    validate_combined_simulated_allocations(
        &ctx.accounts.vault,
        &ctx.accounts.thesis,
        ctx.accounts.vault.simulated_defi_principal,
        Some(new_total),
    )?;

    let was_active = position_initialized && ctx.accounts.position.active;
    let will_be_active = params.active && next_amount > 0;
    let next_active_position_count = match (was_active, will_be_active) {
        (false, true) => ctx
            .accounts
            .vault
            .active_position_count
            .checked_add(1)
            .ok_or(CapitalError::MathOverflow)?,
        (true, false) => ctx
            .accounts
            .vault
            .active_position_count
            .checked_sub(1)
            .ok_or(CapitalError::MathOverflow)?,
        _ => ctx.accounts.vault.active_position_count,
    };
    require!(
        next_active_position_count <= ctx.accounts.thesis.max_active_positions,
        CapitalError::PredictionAllocationExceeded
    );

    let position = &mut ctx.accounts.position;
    position.vault = ctx.accounts.vault.key();
    position.market_id = params.market_id;
    position.allocated_principal = next_amount;
    position.maximum_entry_price = params.maximum_entry_price;
    position.side = params.side;
    position.active = params.active && next_amount > 0;
    position.updated_at = Clock::get()?.unix_timestamp;
    position.bump = ctx.bumps.position;
    position.reserved = [0; 30];
    ctx.accounts.vault.simulated_prediction_principal = new_total;
    ctx.accounts.vault.active_position_count = next_active_position_count;
    emit!(SimulatedPredictionPositionUpdated {
        vault: ctx.accounts.vault.key(),
        position: position.key(),
        market_id: position.market_id,
        allocated_principal: position.allocated_principal,
        active: position.active,
    });
    Ok(())
}

pub fn set_simulated_defi_allocation(
    ctx: Context<SetSimulatedDefiAllocation>,
    amount: u64,
) -> Result<()> {
    require!(!ctx.accounts.config.paused, CapitalError::ProtocolPaused);
    require!(!ctx.accounts.vault.paused, CapitalError::ProtocolPaused);
    require!(
        ctx.accounts.thesis.thesis_status == ThesisStatus::Active,
        CapitalError::ThesisNotActive
    );
    require!(
        ctx.accounts.vault.funding_idle_principal == 0
            && ctx.accounts.vault.funding_idle_assets == 0,
        CapitalError::FundingYieldExitRequired
    );
    require!(
        ctx.accounts.authority.key() == ctx.accounts.thesis.curator
            || ctx.accounts.authority.key() == ctx.accounts.config.strategy_authority,
        CapitalError::Unauthorized
    );
    validate_combined_simulated_allocations(
        &ctx.accounts.vault,
        &ctx.accounts.thesis,
        amount,
        None,
    )?;
    ctx.accounts.vault.simulated_defi_principal = amount;
    emit!(SimulatedDefiAllocationUpdated {
        vault: ctx.accounts.vault.key(),
        allocated_principal: amount,
    });
    Ok(())
}

pub fn submit_thesis_nav(ctx: Context<SubmitThesisNav>, checkpoint: NavCheckpoint) -> Result<()> {
    require!(
        ctx.accounts.thesis.thesis_status == ThesisStatus::Active
            || ctx.accounts.thesis.thesis_status == ThesisStatus::Paused,
        CapitalError::InvalidLifecycle
    );
    require!(
        checkpoint.epoch == add(ctx.accounts.vault.nav_epoch, 1)?,
        CapitalError::StaleUpdate
    );
    require!(checkpoint.content_hash != [0; 32], CapitalError::InvalidNav);
    let now = Clock::get()?.unix_timestamp;
    require!(
        checkpoint.observed_at > ctx.accounts.vault.last_nav_timestamp
            && checkpoint.observed_at <= now,
        CapitalError::StaleUpdate
    );
    require!(
        now.saturating_sub(checkpoint.observed_at) <= ctx.accounts.vault.max_nav_age_seconds,
        CapitalError::StaleNav
    );
    require!(
        checkpoint.accounting_liquid_assets <= ctx.accounts.liquid_vault.amount,
        CapitalError::InvalidNav
    );

    let (new_curator_fees, new_protocol_fees) =
        performance_fees_for_checkpoint(&ctx.accounts.vault, &ctx.accounts.thesis, &checkpoint)?;
    let next_accrued_curator_fees = add(ctx.accounts.vault.accrued_curator_fees, new_curator_fees)?;
    let next_accrued_protocol_fees =
        add(ctx.accounts.vault.accrued_protocol_fees, new_protocol_fees)?;
    let next_accrued_fees = add(next_accrued_curator_fees, next_accrued_protocol_fees)?;
    let new_total_assets = checkpoint_total_assets(&checkpoint, next_accrued_fees)?;
    validate_checkpoint_risk(new_total_assets, &checkpoint, &ctx.accounts.thesis)?;
    validate_nav_change(
        ctx.accounts.vault.total_assets,
        new_total_assets,
        ctx.accounts.vault.max_nav_change_bps,
    )?;

    let current_share_price = if ctx.accounts.vault.total_shares == 0 {
        0
    } else {
        share_price_x64(new_total_assets, ctx.accounts.vault.total_shares)?
    };
    let drawdown_bps = drawdown_bps(
        ctx.accounts.vault.high_water_mark_share_price_x64,
        current_share_price,
    )?;

    let vault = &mut ctx.accounts.vault;
    vault.total_assets = new_total_assets;
    vault.accounting_liquid_assets = checkpoint.accounting_liquid_assets;
    vault.defi_assets = checkpoint.defi_assets;
    vault.prediction_assets = checkpoint.prediction_assets;
    vault.resolved_unclaimed_assets = checkpoint.resolved_unclaimed_assets;
    vault.accrued_fees = next_accrued_fees;
    vault.accrued_curator_fees = next_accrued_curator_fees;
    vault.accrued_protocol_fees = next_accrued_protocol_fees;
    vault.liabilities = checkpoint.liabilities;
    vault.nav_epoch = checkpoint.epoch;
    vault.last_nav_timestamp = checkpoint.observed_at;
    vault.last_nav_hash = checkpoint.content_hash;
    if current_share_price > vault.high_water_mark_share_price_x64 {
        vault.high_water_mark_share_price_x64 = current_share_price;
    }
    if drawdown_bps > ctx.accounts.thesis.max_drawdown_bps {
        vault.paused = true;
        ctx.accounts.thesis.thesis_status = ThesisStatus::Paused;
    }
    emit!(ThesisNavSubmitted {
        vault: vault.key(),
        epoch: vault.nav_epoch,
        total_assets: vault.total_assets,
        share_price_x64: current_share_price,
        drawdown_bps,
        paused: vault.paused,
        curator_fees_accrued: new_curator_fees,
        protocol_fees_accrued: new_protocol_fees,
        content_hash: vault.last_nav_hash,
    });
    Ok(())
}

pub fn collect_thesis_fees(ctx: Context<CollectThesisFees>) -> Result<()> {
    require!(!ctx.accounts.config.paused, CapitalError::ProtocolPaused);
    require!(!ctx.accounts.vault.paused, CapitalError::ProtocolPaused);
    require!(
        ctx.accounts.thesis.thesis_status == ThesisStatus::Active,
        CapitalError::InvalidLifecycle
    );
    require!(
        ctx.accounts.authority.key() == ctx.accounts.thesis.curator
            || ctx.accounts.authority.key() == ctx.accounts.config.admin,
        CapitalError::Unauthorized
    );
    let curator_amount = ctx.accounts.vault.accrued_curator_fees;
    let protocol_amount = ctx.accounts.vault.accrued_protocol_fees;
    let total_amount = add(curator_amount, protocol_amount)?;
    require!(total_amount > 0, CapitalError::FeesUnavailable);
    require!(
        total_amount == ctx.accounts.vault.accrued_fees,
        CapitalError::InvalidNav
    );
    require!(
        ctx.accounts.vault.accounting_liquid_assets >= total_amount
            && ctx.accounts.liquid_vault.amount >= total_amount,
        CapitalError::InsufficientFeeLiquidity
    );

    let thesis_key = ctx.accounts.thesis.key();
    let vault_bump = [ctx.accounts.vault.bump];
    let vault_seeds: &[&[u8]] = &[THESIS_VAULT_SEED, thesis_key.as_ref(), &vault_bump];
    if curator_amount > 0 {
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.deposit_token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.liquid_vault.to_account_info(),
                    mint: ctx.accounts.deposit_mint.to_account_info(),
                    to: ctx.accounts.curator_destination.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                &[vault_seeds],
            ),
            curator_amount,
            ctx.accounts.deposit_mint.decimals,
        )?;
    }
    if protocol_amount > 0 {
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.deposit_token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.liquid_vault.to_account_info(),
                    mint: ctx.accounts.deposit_mint.to_account_info(),
                    to: ctx.accounts.protocol_destination.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                &[vault_seeds],
            ),
            protocol_amount,
            ctx.accounts.deposit_mint.decimals,
        )?;
    }

    let vault = &mut ctx.accounts.vault;
    vault.accounting_liquid_assets = sub(vault.accounting_liquid_assets, total_amount)?;
    vault.accrued_fees = 0;
    vault.accrued_curator_fees = 0;
    vault.accrued_protocol_fees = 0;
    emit!(ThesisFeesCollected {
        vault: vault.key(),
        curator: ctx.accounts.thesis.curator,
        protocol_treasury: ctx.accounts.config.admin,
        curator_amount,
        protocol_amount,
        nav_epoch: vault.nav_epoch,
    });
    Ok(())
}

pub fn request_thesis_redemption(
    ctx: Context<RequestThesisRedemption>,
    params: RedemptionParams,
) -> Result<()> {
    require!(params.shares > 0, CapitalError::InvalidAmount);
    let is_funding = ctx.accounts.thesis.thesis_status == ThesisStatus::Funding;
    require!(
        ctx.accounts.thesis.thesis_status == ThesisStatus::Active
            || (is_funding && ctx.accounts.vault.funding_yield_enabled),
        CapitalError::InvalidLifecycle
    );
    require!(
        params.nonce == ctx.accounts.vault.next_redemption_nonce,
        CapitalError::InvalidRedemptionNonce
    );
    let now = Clock::get()?.unix_timestamp;
    if !is_funding {
        require_lockup_elapsed(
            &ctx.accounts.thesis,
            &ctx.accounts.vault,
            &ctx.accounts.contributor,
            now,
        )?;
    }
    require!(
        ctx.accounts.contributor.owned_shares >= params.shares,
        CapitalError::InvalidAmount
    );
    validate_share_supply(&ctx.accounts.vault, ctx.accounts.share_mint.supply)?;

    token_interface::burn_checked(
        CpiContext::new(
            ctx.accounts.share_token_program.to_account_info(),
            BurnChecked {
                mint: ctx.accounts.share_mint.to_account_info(),
                from: ctx.accounts.user_share_account.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        params.shares,
        ctx.accounts.share_mint.decimals,
    )?;

    let request = &mut ctx.accounts.request;
    request.vault = ctx.accounts.vault.key();
    request.owner = ctx.accounts.owner.key();
    request.shares = params.shares;
    request.minimum_assets_out = params.minimum_assets_out;
    request.request_nav_epoch = ctx.accounts.vault.nav_epoch;
    request.nonce = params.nonce;
    request.assets_settled = 0;
    request.status = RedemptionStatus::Pending;
    request.requested_at = now;
    request.settled_at = 0;
    request.funding_principal_removed = 0;
    request.funding_qualifying_removed = 0;
    request.funding_contributor_removed = false;
    request.bump = ctx.bumps.request;
    request.reserved = [0; 13];

    {
        let contributor = &mut ctx.accounts.contributor;
        let previous_shares = contributor.owned_shares;
        let previous_qualifying = contributor.qualifying_assets;
        let principal_removed = if params.shares == previous_shares {
            contributor.deposited_assets
        } else {
            checked_mul_div(params.shares, contributor.deposited_assets, previous_shares)?
        };
        contributor.deposited_assets = sub(contributor.deposited_assets, principal_removed)?;
        contributor.owned_shares = sub(contributor.owned_shares, params.shares)?;

        let mut qualifying_removed = 0;
        let mut contributor_removed = false;
        if is_funding {
            contributor.qualifying_assets = contributor
                .deposited_assets
                .min(ctx.accounts.vault.per_wallet_qualifying_cap);
            qualifying_removed = sub(previous_qualifying, contributor.qualifying_assets)?;
            ctx.accounts.vault.qualifying_capital =
                sub(ctx.accounts.vault.qualifying_capital, qualifying_removed)?;
            contributor_removed = contributor.deposited_assets == 0;
            if contributor_removed {
                ctx.accounts.vault.unique_contributors = ctx
                    .accounts
                    .vault
                    .unique_contributors
                    .checked_sub(1)
                    .ok_or(CapitalError::MathOverflow)?;
            }
        }
        request.funding_principal_removed = principal_removed;
        request.funding_qualifying_removed = qualifying_removed;
        request.funding_contributor_removed = contributor_removed;
    }

    ctx.accounts.vault.pending_redemption_shares =
        add(ctx.accounts.vault.pending_redemption_shares, params.shares)?;
    ctx.accounts.vault.next_redemption_nonce = add(ctx.accounts.vault.next_redemption_nonce, 1)?;
    emit!(ThesisRedemptionRequested {
        vault: ctx.accounts.vault.key(),
        request: request.key(),
        owner: request.owner,
        shares: request.shares,
        request_nav_epoch: request.request_nav_epoch,
    });
    Ok(())
}

pub fn cancel_thesis_redemption(ctx: Context<CancelThesisRedemption>) -> Result<()> {
    require!(
        ctx.accounts.request.status == RedemptionStatus::Pending,
        CapitalError::RedemptionNotPending
    );
    require!(
        ctx.accounts.request.request_nav_epoch == ctx.accounts.vault.nav_epoch,
        CapitalError::RedemptionEpochPending
    );
    validate_share_supply(&ctx.accounts.vault, ctx.accounts.share_mint.supply)?;

    let thesis_key = ctx.accounts.thesis.key();
    let vault_bump = [ctx.accounts.vault.bump];
    let vault_seeds: &[&[u8]] = &[THESIS_VAULT_SEED, thesis_key.as_ref(), &vault_bump];
    token_interface::mint_to_checked(
        CpiContext::new_with_signer(
            ctx.accounts.share_token_program.to_account_info(),
            MintToChecked {
                mint: ctx.accounts.share_mint.to_account_info(),
                to: ctx.accounts.user_share_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[vault_seeds],
        ),
        ctx.accounts.request.shares,
        ctx.accounts.share_mint.decimals,
    )?;
    ctx.accounts.vault.pending_redemption_shares = sub(
        ctx.accounts.vault.pending_redemption_shares,
        ctx.accounts.request.shares,
    )?;
    if ctx.accounts.request.funding_principal_removed > 0 {
        let contributor = &mut ctx.accounts.contributor;
        contributor.deposited_assets = add(
            contributor.deposited_assets,
            ctx.accounts.request.funding_principal_removed,
        )?;
        contributor.owned_shares = add(contributor.owned_shares, ctx.accounts.request.shares)?;
        contributor.qualifying_assets = add(
            contributor.qualifying_assets,
            ctx.accounts.request.funding_qualifying_removed,
        )?;
        ctx.accounts.vault.qualifying_capital = add(
            ctx.accounts.vault.qualifying_capital,
            ctx.accounts.request.funding_qualifying_removed,
        )?;
        if ctx.accounts.request.funding_contributor_removed {
            ctx.accounts.vault.unique_contributors = ctx
                .accounts
                .vault
                .unique_contributors
                .checked_add(1)
                .ok_or(CapitalError::MathOverflow)?;
        }
    }
    ctx.accounts.request.status = RedemptionStatus::Cancelled;
    emit!(ThesisRedemptionCancelled {
        vault: ctx.accounts.vault.key(),
        request: ctx.accounts.request.key(),
        owner: ctx.accounts.owner.key(),
        shares: ctx.accounts.request.shares,
    });
    Ok(())
}

pub fn settle_thesis_redemption(ctx: Context<SettleThesisRedemption>) -> Result<()> {
    require!(
        ctx.accounts.request.status == RedemptionStatus::Pending,
        CapitalError::RedemptionNotPending
    );
    require!(
        ctx.accounts.vault.nav_epoch > ctx.accounts.request.request_nav_epoch,
        CapitalError::RedemptionEpochPending
    );
    require_nav_fresh(&ctx.accounts.vault, Clock::get()?.unix_timestamp)?;
    validate_share_supply(&ctx.accounts.vault, ctx.accounts.share_mint.supply)?;

    let assets_out = assets_for_redemption(
        ctx.accounts.request.shares,
        ctx.accounts.vault.total_shares,
        ctx.accounts.vault.total_assets,
    )?;
    require!(assets_out > 0, CapitalError::InvalidAmount);
    require!(
        assets_out >= ctx.accounts.request.minimum_assets_out,
        CapitalError::RedemptionSlippageExceeded
    );
    require!(
        ctx.accounts.liquid_vault.amount >= assets_out,
        CapitalError::InsufficientRedemptionLiquidity
    );
    let remaining_assets = sub(ctx.accounts.vault.total_assets, assets_out)?;
    if remaining_assets == 0 {
        require!(
            ctx.accounts.vault.simulated_prediction_principal == 0
                && ctx.accounts.vault.simulated_defi_principal == 0,
            CapitalError::CapitalStillDeployed
        );
    } else {
        validate_prediction_allocation(
            remaining_assets,
            ctx.accounts.vault.simulated_prediction_principal,
            0,
            &ctx.accounts.thesis,
        )?;
        validate_combined_simulated_allocations_for_assets(
            remaining_assets,
            ctx.accounts.vault.simulated_prediction_principal,
            ctx.accounts.vault.simulated_defi_principal,
            &ctx.accounts.thesis,
        )?;
    }

    let thesis_key = ctx.accounts.thesis.key();
    let vault_bump = [ctx.accounts.vault.bump];
    let vault_seeds: &[&[u8]] = &[THESIS_VAULT_SEED, thesis_key.as_ref(), &vault_bump];
    token::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.deposit_token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.liquid_vault.to_account_info(),
                mint: ctx.accounts.deposit_mint.to_account_info(),
                to: ctx.accounts.user_deposit_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[vault_seeds],
        ),
        assets_out,
        ctx.accounts.deposit_mint.decimals,
    )?;

    let previous_status = ctx.accounts.thesis.thesis_status;
    let vault = &mut ctx.accounts.vault;
    vault.total_assets = sub(vault.total_assets, assets_out)?;
    vault.total_shares = sub(vault.total_shares, ctx.accounts.request.shares)?;
    vault.pending_redemption_shares =
        sub(vault.pending_redemption_shares, ctx.accounts.request.shares)?;
    vault.accounting_liquid_assets = vault.accounting_liquid_assets.saturating_sub(assets_out);
    ctx.accounts.request.assets_settled = assets_out;
    ctx.accounts.request.settled_at = Clock::get()?.unix_timestamp;
    ctx.accounts.request.status = RedemptionStatus::Settled;
    let became_dormant = ctx.accounts.thesis.vault_structure == ThesisVaultStructure::OpenEnded
        && vault.total_shares == 0;
    if became_dormant {
        require!(vault.total_assets == 0, CapitalError::InvalidNav);
        require!(
            vault.pending_redemption_shares == 0,
            CapitalError::InvalidNav
        );
        vault.high_water_mark_share_price_x64 = 0;
        ctx.accounts.thesis.thesis_status = ThesisStatus::Dormant;
    }
    emit!(ThesisRedemptionSettled {
        vault: vault.key(),
        request: ctx.accounts.request.key(),
        owner: ctx.accounts.request.owner,
        shares: ctx.accounts.request.shares,
        assets: assets_out,
        nav_epoch: vault.nav_epoch,
    });
    if became_dormant {
        emit!(ThesisLifecycleChanged {
            thesis: ctx.accounts.thesis.key(),
            vault: vault.key(),
            previous_status,
            next_status: ThesisStatus::Dormant,
            changed_at: ctx.accounts.request.settled_at,
        });
    }
    Ok(())
}

pub fn pause_thesis_vault(ctx: Context<ManageThesisVault>) -> Result<()> {
    require!(
        ctx.accounts.authority.key() == ctx.accounts.config.admin
            || ctx.accounts.authority.key() == ctx.accounts.config.emergency_authority,
        CapitalError::Unauthorized
    );
    require!(
        ctx.accounts.thesis.thesis_status == ThesisStatus::Active,
        CapitalError::InvalidLifecycle
    );
    ctx.accounts.vault.paused = true;
    ctx.accounts.thesis.thesis_status = ThesisStatus::Paused;
    emit!(ThesisVaultPauseChanged {
        vault: ctx.accounts.vault.key(),
        paused: true,
    });
    Ok(())
}

pub fn unpause_thesis_vault(ctx: Context<ManageThesisVault>) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.authority.key(),
        ctx.accounts.config.admin,
        CapitalError::Unauthorized
    );
    if ctx.accounts.thesis.expiry > 0 {
        require!(
            ctx.accounts.thesis.expiry > Clock::get()?.unix_timestamp,
            CapitalError::InvalidLifecycle
        );
    }
    ctx.accounts.vault.paused = false;
    ctx.accounts.thesis.thesis_status = ThesisStatus::Active;
    emit!(ThesisVaultPauseChanged {
        vault: ctx.accounts.vault.key(),
        paused: false,
    });
    Ok(())
}

#[derive(Accounts)]
#[instruction(params: CreateThesisParams)]
pub struct CreateThesis<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        init,
        payer = creator,
        space = 8 + Thesis::INIT_SPACE,
        seeds = [THESIS_SEED, config.key().as_ref(), creator.key().as_ref(), params.thesis_id.as_ref()],
        bump
    )]
    pub thesis: Account<'info, Thesis>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeThesisVault<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub config: Account<'info, ProtocolConfig>,
    #[account(mut, has_one = config)]
    pub thesis: Account<'info, Thesis>,
    #[account(
        init,
        payer = payer,
        space = 8 + ThesisVault::INIT_SPACE,
        seeds = [THESIS_VAULT_SEED, thesis.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, ThesisVault>,
    #[account(
        init,
        payer = payer,
        seeds = [THESIS_SHARE_MINT_SEED, vault.key().as_ref()],
        bump,
        space = anchor_spl::token_interface::find_mint_account_size(
            Some(&vec![anchor_spl::token_interface::spl_token_2022::extension::ExtensionType::NonTransferable])
        )?,
        owner = share_token_program.key()
    )]
    /// CHECK: Created with Token-2022 ownership and initialized in the handler.
    pub share_mint: UncheckedAccount<'info>,
    #[account(
        init,
        payer = payer,
        seeds = [THESIS_LIQUID_VAULT_SEED, vault.key().as_ref()],
        bump,
        token::mint = deposit_mint,
        token::authority = vault,
        token::token_program = deposit_token_program
    )]
    pub liquid_vault: Account<'info, TokenAccount>,
    #[account(address = config.settlement_mint)]
    pub deposit_mint: Account<'info, Mint>,
    pub deposit_token_program: Program<'info, Token>,
    pub share_token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositThesisVault<'info> {
    pub config: Account<'info, ProtocolConfig>,
    #[account(mut, has_one = config, has_one = vault)]
    pub thesis: Account<'info, Thesis>,
    #[account(mut, has_one = thesis, has_one = deposit_mint, has_one = share_mint, has_one = liquid_vault)]
    pub vault: Account<'info, ThesisVault>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + ThesisContributor::INIT_SPACE,
        seeds = [THESIS_CONTRIBUTOR_SEED, vault.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub contributor: Account<'info, ThesisContributor>,
    #[account(mut, token::mint = deposit_mint, token::authority = owner)]
    pub user_deposit_account: Account<'info, TokenAccount>,
    #[account(mut, token::mint = deposit_mint, token::authority = vault)]
    pub liquid_vault: Account<'info, TokenAccount>,
    #[account(address = vault.deposit_mint)]
    pub deposit_mint: Account<'info, Mint>,
    #[account(mut, address = vault.share_mint)]
    pub share_mint: InterfaceAccount<'info, InterfaceMint>,
    #[account(mut, token::mint = share_mint, token::authority = owner, token::token_program = share_token_program)]
    pub user_share_account: InterfaceAccount<'info, InterfaceTokenAccount>,
    pub deposit_token_program: Program<'info, Token>,
    pub share_token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelThesisFunding<'info> {
    pub config: Account<'info, ProtocolConfig>,
    #[account(has_one = config, has_one = vault)]
    pub thesis: Account<'info, Thesis>,
    #[account(mut, has_one = thesis, has_one = deposit_mint, has_one = share_mint, has_one = liquid_vault)]
    pub vault: Account<'info, ThesisVault>,
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [THESIS_CONTRIBUTOR_SEED, vault.key().as_ref(), owner.key().as_ref()],
        bump = contributor.bump,
        has_one = vault,
        has_one = owner
    )]
    pub contributor: Account<'info, ThesisContributor>,
    #[account(mut, token::mint = deposit_mint, token::authority = owner)]
    pub user_deposit_account: Account<'info, TokenAccount>,
    #[account(mut, token::mint = deposit_mint, token::authority = vault)]
    pub liquid_vault: Account<'info, TokenAccount>,
    #[account(address = vault.deposit_mint)]
    pub deposit_mint: Account<'info, Mint>,
    #[account(mut, address = vault.share_mint)]
    pub share_mint: InterfaceAccount<'info, InterfaceMint>,
    #[account(mut, token::mint = share_mint, token::authority = owner, token::token_program = share_token_program)]
    pub user_share_account: InterfaceAccount<'info, InterfaceTokenAccount>,
    pub deposit_token_program: Program<'info, Token>,
    pub share_token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
#[instruction(params: SimulatedPositionParams)]
pub struct UpsertSimulatedPosition<'info> {
    pub config: Account<'info, ProtocolConfig>,
    #[account(has_one = config, has_one = vault)]
    pub thesis: Account<'info, Thesis>,
    #[account(mut, has_one = thesis)]
    pub vault: Account<'info, ThesisVault>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + SimulatedPosition::INIT_SPACE,
        seeds = [SIMULATED_POSITION_SEED, vault.key().as_ref(), params.market_id.as_ref()],
        bump
    )]
    pub position: Account<'info, SimulatedPosition>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetSimulatedDefiAllocation<'info> {
    pub config: Account<'info, ProtocolConfig>,
    #[account(has_one = config, has_one = vault)]
    pub thesis: Account<'info, Thesis>,
    #[account(mut, has_one = thesis)]
    pub vault: Account<'info, ThesisVault>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ConfigureFundingYield<'info> {
    #[account(has_one = admin)]
    pub config: Account<'info, ProtocolConfig>,
    pub admin: Signer<'info>,
    #[account(has_one = config, has_one = vault)]
    pub thesis: Account<'info, Thesis>,
    #[account(mut, has_one = thesis)]
    pub vault: Account<'info, ThesisVault>,
}

#[derive(Accounts)]
pub struct ManageFundingYield<'info> {
    pub config: Account<'info, ProtocolConfig>,
    #[account(has_one = config, has_one = vault)]
    pub thesis: Account<'info, Thesis>,
    #[account(mut, has_one = thesis)]
    pub vault: Account<'info, ThesisVault>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SubmitFundingYieldNav<'info> {
    #[account(has_one = oracle_authority)]
    pub config: Account<'info, ProtocolConfig>,
    pub oracle_authority: Signer<'info>,
    #[account(mut, has_one = config, has_one = vault)]
    pub thesis: Account<'info, Thesis>,
    #[account(mut, has_one = thesis)]
    pub vault: Account<'info, ThesisVault>,
}

#[derive(Accounts)]
pub struct SubmitThesisNav<'info> {
    #[account(has_one = oracle_authority)]
    pub config: Account<'info, ProtocolConfig>,
    pub oracle_authority: Signer<'info>,
    #[account(mut, has_one = config, has_one = vault)]
    pub thesis: Account<'info, Thesis>,
    #[account(mut, has_one = thesis, has_one = liquid_vault)]
    pub vault: Account<'info, ThesisVault>,
    #[account(token::mint = deposit_mint, token::authority = vault)]
    pub liquid_vault: Account<'info, TokenAccount>,
    #[account(address = vault.deposit_mint)]
    pub deposit_mint: Account<'info, Mint>,
}

#[derive(Accounts)]
pub struct CollectThesisFees<'info> {
    pub config: Account<'info, ProtocolConfig>,
    #[account(has_one = config, has_one = vault)]
    pub thesis: Account<'info, Thesis>,
    #[account(mut, has_one = thesis, has_one = deposit_mint, has_one = liquid_vault)]
    pub vault: Account<'info, ThesisVault>,
    pub authority: Signer<'info>,
    #[account(mut, token::mint = deposit_mint, token::authority = vault)]
    pub liquid_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = deposit_mint,
        token::authority = curator,
        constraint = curator.key() == thesis.curator @ CapitalError::Unauthorized
    )]
    pub curator_destination: Account<'info, TokenAccount>,
    /// CHECK: Constrained to the stored curator and used only as a token authority.
    #[account(address = thesis.curator)]
    pub curator: UncheckedAccount<'info>,
    #[account(
        mut,
        token::mint = deposit_mint,
        token::authority = protocol_treasury,
        constraint = protocol_treasury.key() == config.admin @ CapitalError::Unauthorized
    )]
    pub protocol_destination: Account<'info, TokenAccount>,
    /// CHECK: Constrained to the protocol admin and used only as a token authority.
    #[account(address = config.admin)]
    pub protocol_treasury: UncheckedAccount<'info>,
    #[account(address = vault.deposit_mint)]
    pub deposit_mint: Account<'info, Mint>,
    pub deposit_token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(params: RedemptionParams)]
pub struct RequestThesisRedemption<'info> {
    #[account(has_one = vault)]
    pub thesis: Account<'info, Thesis>,
    #[account(mut, has_one = thesis, has_one = share_mint)]
    pub vault: Account<'info, ThesisVault>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [THESIS_CONTRIBUTOR_SEED, vault.key().as_ref(), owner.key().as_ref()],
        bump = contributor.bump,
        has_one = vault,
        has_one = owner
    )]
    pub contributor: Account<'info, ThesisContributor>,
    #[account(
        init,
        payer = owner,
        space = 8 + RedemptionRequest::INIT_SPACE,
        seeds = [REDEMPTION_SEED, vault.key().as_ref(), &params.nonce.to_le_bytes()],
        bump
    )]
    pub request: Account<'info, RedemptionRequest>,
    #[account(mut, address = vault.share_mint)]
    pub share_mint: InterfaceAccount<'info, InterfaceMint>,
    #[account(mut, token::mint = share_mint, token::authority = owner, token::token_program = share_token_program)]
    pub user_share_account: InterfaceAccount<'info, InterfaceTokenAccount>,
    pub share_token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelThesisRedemption<'info> {
    #[account(has_one = vault)]
    pub thesis: Account<'info, Thesis>,
    #[account(mut, has_one = thesis, has_one = share_mint)]
    pub vault: Account<'info, ThesisVault>,
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [THESIS_CONTRIBUTOR_SEED, vault.key().as_ref(), owner.key().as_ref()],
        bump = contributor.bump,
        has_one = vault,
        has_one = owner
    )]
    pub contributor: Account<'info, ThesisContributor>,
    #[account(mut, has_one = vault, has_one = owner)]
    pub request: Account<'info, RedemptionRequest>,
    #[account(mut, address = vault.share_mint)]
    pub share_mint: InterfaceAccount<'info, InterfaceMint>,
    #[account(mut, token::mint = share_mint, token::authority = owner, token::token_program = share_token_program)]
    pub user_share_account: InterfaceAccount<'info, InterfaceTokenAccount>,
    pub share_token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct SettleThesisRedemption<'info> {
    #[account(mut, has_one = vault)]
    pub thesis: Account<'info, Thesis>,
    #[account(mut, has_one = thesis, has_one = deposit_mint, has_one = share_mint, has_one = liquid_vault)]
    pub vault: Account<'info, ThesisVault>,
    #[account(mut, has_one = vault)]
    pub request: Account<'info, RedemptionRequest>,
    /// CHECK: Bound to the request and destination token account.
    #[account(address = request.owner)]
    pub owner: UncheckedAccount<'info>,
    #[account(mut, token::mint = deposit_mint, token::authority = vault)]
    pub liquid_vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = deposit_mint, token::authority = owner)]
    pub user_deposit_account: Account<'info, TokenAccount>,
    #[account(address = vault.deposit_mint)]
    pub deposit_mint: Account<'info, Mint>,
    #[account(address = vault.share_mint)]
    pub share_mint: InterfaceAccount<'info, InterfaceMint>,
    pub deposit_token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ManageThesisVault<'info> {
    pub config: Account<'info, ProtocolConfig>,
    #[account(mut, has_one = config, has_one = vault)]
    pub thesis: Account<'info, Thesis>,
    #[account(mut, has_one = thesis)]
    pub vault: Account<'info, ThesisVault>,
    pub authority: Signer<'info>,
}

fn validate_thesis_params(params: &CreateThesisParams, now: i64) -> Result<()> {
    require!(
        params.thesis_id != [0; 32],
        CapitalError::InvalidThesisParameters
    );
    require!(
        params.curator != Pubkey::default(),
        CapitalError::InvalidAuthority
    );
    require!(
        !params.metadata_uri.is_empty() && params.metadata_uri.len() <= MAX_METADATA_URI_BYTES,
        CapitalError::InvalidThesisParameters
    );
    require!(
        params.metadata_hash != [0; 32],
        CapitalError::InvalidThesisParameters
    );
    require!(
        params.prediction_allocation_max_bps <= HARD_MAX_PREDICTION_BPS
            && params.max_market_allocation_bps > 0
            && params.max_market_allocation_bps <= params.prediction_allocation_max_bps,
        CapitalError::InvalidThesisParameters
    );
    require!(
        params.liquid_reserve_target_bps >= HARD_MIN_RESERVE_BPS,
        CapitalError::InvalidThesisParameters
    );
    let target_total = u64::from(params.prediction_allocation_max_bps)
        .checked_add(u64::from(params.defi_allocation_target_bps))
        .and_then(|value| value.checked_add(u64::from(params.liquid_reserve_target_bps)))
        .ok_or(CapitalError::MathOverflow)?;
    require!(
        target_total <= BPS_DENOMINATOR,
        CapitalError::InvalidThesisParameters
    );
    require!(
        params.max_drawdown_bps > 0 && u64::from(params.max_drawdown_bps) < BPS_DENOMINATOR,
        CapitalError::InvalidThesisParameters
    );
    require!(
        u64::from(params.curator_fee_bps)
            .checked_add(u64::from(params.protocol_fee_bps))
            .ok_or(CapitalError::MathOverflow)?
            <= 3_000,
        CapitalError::InvalidThesisParameters
    );
    require!(
        params.max_active_positions > 0 && params.max_active_positions <= MAX_ACTIVE_POSITIONS,
        CapitalError::InvalidThesisParameters
    );
    require!(
        params.lockup_seconds >= 0 && params.lockup_seconds <= MAX_LOCKUP_SECONDS,
        CapitalError::InvalidLockup
    );
    match params.vault_structure {
        ThesisVaultStructure::ClosedEnded => {
            require!(params.expiry > now, CapitalError::InvalidThesisParameters);
        }
        ThesisVaultStructure::OpenEnded => {
            require!(
                params.expiry == 0 || params.expiry > now,
                CapitalError::InvalidThesisParameters
            );
        }
    }
    Ok(())
}

fn initial_thesis_status(vault_structure: ThesisVaultStructure) -> ThesisStatus {
    match vault_structure {
        ThesisVaultStructure::ClosedEnded => ThesisStatus::Funding,
        ThesisVaultStructure::OpenEnded => ThesisStatus::Dormant,
    }
}

fn is_vault_initializer(payer: Pubkey, creator: Pubkey, curator: Pubkey) -> bool {
    payer == creator || payer == curator
}

fn accepts_deposit(vault_structure: ThesisVaultStructure, status: ThesisStatus) -> bool {
    matches!(
        (vault_structure, status),
        (ThesisVaultStructure::ClosedEnded, ThesisStatus::Funding)
            | (ThesisVaultStructure::OpenEnded, ThesisStatus::Dormant)
            | (ThesisVaultStructure::OpenEnded, ThesisStatus::Active)
    )
}

fn validate_vault_initialization(
    vault_structure: ThesisVaultStructure,
    status: ThesisStatus,
    params: &InitializeThesisVaultParams,
) -> Result<()> {
    require!(params.deposit_cap > 0, CapitalError::InvalidAmount);
    require!(params.max_nav_age_seconds > 0, CapitalError::InvalidAmount);
    require!(
        params.max_nav_change_bps > 0 && u64::from(params.max_nav_change_bps) <= BPS_DENOMINATOR,
        CapitalError::InvalidAmount
    );

    match vault_structure {
        ThesisVaultStructure::ClosedEnded => {
            require!(
                status == ThesisStatus::Funding,
                CapitalError::InvalidLifecycle
            );
            require!(
                params.graduation_threshold > 0
                    && params.graduation_threshold <= params.deposit_cap,
                CapitalError::InvalidGraduationParameters
            );
            require!(
                params.minimum_unique_contributors >= 2
                    && params.per_wallet_qualifying_cap > 0
                    && params.per_wallet_qualifying_cap < params.graduation_threshold,
                CapitalError::InvalidGraduationParameters
            );
            require!(
                u64::from(params.funding_yield_target_bps)
                    <= BPS_DENOMINATOR - u64::from(HARD_MIN_RESERVE_BPS),
                CapitalError::InvalidGraduationParameters
            );
        }
        ThesisVaultStructure::OpenEnded => {
            require!(
                status == ThesisStatus::Dormant,
                CapitalError::InvalidLifecycle
            );
            require!(
                params.graduation_threshold == 0
                    && params.per_wallet_qualifying_cap == 0
                    && params.minimum_unique_contributors == 0
                    && params.funding_yield_target_bps == 0,
                CapitalError::InvalidGraduationParameters
            );
        }
    }
    Ok(())
}

fn validate_prediction_allocation(
    total_assets: u64,
    total_prediction: u64,
    single_market: u64,
    thesis: &Thesis,
) -> Result<()> {
    require!(total_assets > 0, CapitalError::InvalidNav);
    require!(
        total_prediction <= bps_amount(total_assets, thesis.prediction_allocation_max_bps)?,
        CapitalError::PredictionAllocationExceeded
    );
    require!(
        single_market <= bps_amount(total_assets, thesis.max_market_allocation_bps)?,
        CapitalError::MarketAllocationExceeded
    );
    Ok(())
}

fn validate_combined_simulated_allocations(
    vault: &ThesisVault,
    thesis: &Thesis,
    defi_amount: u64,
    prediction_override: Option<u64>,
) -> Result<()> {
    validate_combined_simulated_allocations_for_assets(
        vault.total_assets,
        prediction_override.unwrap_or(vault.simulated_prediction_principal),
        defi_amount,
        thesis,
    )
}

fn validate_combined_simulated_allocations_for_assets(
    total_assets: u64,
    prediction_amount: u64,
    defi_amount: u64,
    thesis: &Thesis,
) -> Result<()> {
    require!(total_assets > 0, CapitalError::InvalidNav);
    let allocated = prediction_amount
        .checked_add(defi_amount)
        .ok_or(CapitalError::MathOverflow)?;
    let required_reserve = bps_amount(total_assets, thesis.liquid_reserve_target_bps)?;
    require!(
        allocated <= total_assets.saturating_sub(required_reserve),
        CapitalError::ReserveRequirementViolated
    );
    Ok(())
}

fn validate_checkpoint_risk(
    total_assets: u64,
    checkpoint: &NavCheckpoint,
    thesis: &Thesis,
) -> Result<()> {
    if total_assets == 0 {
        require!(
            checkpoint.prediction_assets == 0,
            CapitalError::PredictionAllocationExceeded
        );
        return Ok(());
    }
    require!(
        checkpoint.prediction_assets
            <= bps_amount(total_assets, thesis.prediction_allocation_max_bps)?,
        CapitalError::PredictionAllocationExceeded
    );
    require!(
        checkpoint.accounting_liquid_assets
            >= bps_amount(total_assets, thesis.liquid_reserve_target_bps)?,
        CapitalError::ReserveRequirementViolated
    );
    Ok(())
}

fn checkpoint_gross_assets(checkpoint: &NavCheckpoint) -> Result<u64> {
    checkpoint
        .accounting_liquid_assets
        .checked_add(checkpoint.defi_assets)
        .and_then(|value| value.checked_add(checkpoint.prediction_assets))
        .and_then(|value| value.checked_add(checkpoint.resolved_unclaimed_assets))
        .ok_or_else(|| error!(CapitalError::MathOverflow))
}

fn checkpoint_total_assets(checkpoint: &NavCheckpoint, accrued_fees: u64) -> Result<u64> {
    let gross = checkpoint_gross_assets(checkpoint)?;
    let deductions = accrued_fees
        .checked_add(checkpoint.liabilities)
        .ok_or(CapitalError::MathOverflow)?;
    gross
        .checked_sub(deductions)
        .ok_or_else(|| error!(CapitalError::InvalidNav))
}

fn performance_fees_for_checkpoint(
    vault: &ThesisVault,
    thesis: &Thesis,
    checkpoint: &NavCheckpoint,
) -> Result<(u64, u64)> {
    require!(
        add(vault.accrued_curator_fees, vault.accrued_protocol_fees)? == vault.accrued_fees,
        CapitalError::InvalidNav
    );
    if vault.total_shares == 0 || vault.high_water_mark_share_price_x64 == 0 {
        return Ok((0, 0));
    }

    let gross = checkpoint_gross_assets(checkpoint)?;
    let existing_deductions = vault
        .accrued_fees
        .checked_add(checkpoint.liabilities)
        .ok_or(CapitalError::MathOverflow)?;
    let assets_before_new_fees = gross
        .checked_sub(existing_deductions)
        .ok_or(CapitalError::InvalidNav)?;
    let high_water_assets = u128::from(vault.total_shares)
        .checked_mul(vault.high_water_mark_share_price_x64)
        .and_then(|value| value.checked_add(SHARE_PRICE_SCALE.checked_sub(1)?))
        .and_then(|value| value.checked_div(SHARE_PRICE_SCALE))
        .ok_or(CapitalError::MathOverflow)?;
    let high_water_assets =
        u64::try_from(high_water_assets).map_err(|_| error!(CapitalError::MathOverflow))?;
    let profit = assets_before_new_fees.saturating_sub(high_water_assets);
    if profit == 0 {
        return Ok((0, 0));
    }

    let combined_fee_bps = u64::from(thesis.curator_fee_bps)
        .checked_add(u64::from(thesis.protocol_fee_bps))
        .ok_or(CapitalError::MathOverflow)?;
    if combined_fee_bps == 0 {
        return Ok((0, 0));
    }
    let total_fee = checked_mul_div_ceil(profit, combined_fee_bps, BPS_DENOMINATOR)?;
    let curator_fee = checked_mul_div(
        total_fee,
        u64::from(thesis.curator_fee_bps),
        combined_fee_bps,
    )?;
    let protocol_fee = sub(total_fee, curator_fee)?;
    Ok((curator_fee, protocol_fee))
}

fn require_lockup_elapsed(
    thesis: &Thesis,
    vault: &ThesisVault,
    contributor: &ThesisContributor,
    now: i64,
) -> Result<()> {
    if thesis.lockup_seconds == 0 {
        return Ok(());
    }
    let lock_started_at = match thesis.vault_structure {
        ThesisVaultStructure::ClosedEnded => vault.graduated_at,
        ThesisVaultStructure::OpenEnded => contributor.last_deposit_at,
    };
    require!(lock_started_at > 0, CapitalError::InvalidLifecycle);
    let unlock_at = lock_started_at
        .checked_add(thesis.lockup_seconds)
        .ok_or(CapitalError::MathOverflow)?;
    require!(now >= unlock_at, CapitalError::LockupActive);
    Ok(())
}

fn checked_mul_div_ceil(a: u64, b: u64, denominator: u64) -> Result<u64> {
    require!(denominator > 0, CapitalError::InvalidAmount);
    let denominator = u128::from(denominator);
    let value = u128::from(a)
        .checked_mul(u128::from(b))
        .and_then(|product| product.checked_add(denominator.checked_sub(1)?))
        .and_then(|numerator| numerator.checked_div(denominator))
        .ok_or(CapitalError::MathOverflow)?;
    u64::try_from(value).map_err(|_| error!(CapitalError::MathOverflow))
}

fn validate_nav_change(previous: u64, next: u64, max_change_bps: u16) -> Result<()> {
    if previous == 0 {
        return Ok(());
    }
    let change = previous.abs_diff(next);
    let change_bps = u128::from(change)
        .checked_mul(u128::from(BPS_DENOMINATOR))
        .and_then(|value| value.checked_div(u128::from(previous)))
        .ok_or(CapitalError::MathOverflow)?;
    require!(
        change_bps <= u128::from(max_change_bps),
        CapitalError::NavChangeTooLarge
    );
    Ok(())
}

fn require_nav_fresh(vault: &ThesisVault, now: i64) -> Result<()> {
    require!(
        vault.last_nav_timestamp > 0
            && now.saturating_sub(vault.last_nav_timestamp) <= vault.max_nav_age_seconds,
        CapitalError::StaleNav
    );
    Ok(())
}

fn validate_share_supply(vault: &ThesisVault, mint_supply: u64) -> Result<()> {
    let expected_supply = vault
        .total_shares
        .checked_sub(vault.pending_redemption_shares)
        .ok_or(CapitalError::MathOverflow)?;
    require!(mint_supply == expected_supply, CapitalError::InvalidNav);
    Ok(())
}

fn shares_for_deposit(amount: u64, total_shares: u64, total_assets: u64) -> Result<u64> {
    if total_shares == 0 {
        require!(total_assets == 0, CapitalError::InvalidNav);
        return Ok(amount);
    }
    require!(total_assets > 0, CapitalError::InvalidNav);
    checked_mul_div(amount, total_shares, total_assets)
}

fn assets_for_redemption(shares: u64, total_shares: u64, total_assets: u64) -> Result<u64> {
    require!(
        total_shares > 0 && shares <= total_shares,
        CapitalError::InvalidAmount
    );
    checked_mul_div(shares, total_assets, total_shares)
}

fn share_price_x64(total_assets: u64, total_shares: u64) -> Result<u128> {
    require!(total_shares > 0, CapitalError::InvalidAmount);
    u128::from(total_assets)
        .checked_mul(SHARE_PRICE_SCALE)
        .and_then(|value| value.checked_div(u128::from(total_shares)))
        .ok_or_else(|| error!(CapitalError::MathOverflow))
}

fn drawdown_bps(high_water_mark_x64: u128, current_x64: u128) -> Result<u16> {
    if high_water_mark_x64 == 0 || current_x64 >= high_water_mark_x64 {
        return Ok(0);
    }
    let drawdown = high_water_mark_x64
        .checked_sub(current_x64)
        .ok_or(CapitalError::MathOverflow)?;
    let value = drawdown
        .checked_mul(u128::from(BPS_DENOMINATOR))
        .and_then(|amount| amount.checked_div(high_water_mark_x64))
        .ok_or(CapitalError::MathOverflow)?;
    u16::try_from(value).map_err(|_| error!(CapitalError::MathOverflow))
}

fn bps_amount(amount: u64, bps: u16) -> Result<u64> {
    checked_mul_div(amount, u64::from(bps), BPS_DENOMINATOR)
}

fn checked_mul_div(a: u64, b: u64, denominator: u64) -> Result<u64> {
    require!(denominator > 0, CapitalError::InvalidAmount);
    let value = u128::from(a)
        .checked_mul(u128::from(b))
        .and_then(|product| product.checked_div(u128::from(denominator)))
        .ok_or(CapitalError::MathOverflow)?;
    u64::try_from(value).map_err(|_| error!(CapitalError::MathOverflow))
}

fn add(left: u64, right: u64) -> Result<u64> {
    left.checked_add(right)
        .ok_or_else(|| error!(CapitalError::MathOverflow))
}

fn sub(left: u64, right: u64) -> Result<u64> {
    left.checked_sub(right)
        .ok_or_else(|| error!(CapitalError::MathOverflow))
}

#[event]
pub struct ThesisCreated {
    pub thesis: Pubkey,
    pub creator: Pubkey,
    pub curator: Pubkey,
    pub thesis_id: [u8; 32],
    pub vault_structure: ThesisVaultStructure,
    pub initial_status: ThesisStatus,
}

#[event]
pub struct ThesisVaultInitialized {
    pub thesis: Pubkey,
    pub vault: Pubkey,
    pub share_mint: Pubkey,
    pub deposit_cap: u64,
    pub vault_structure: ThesisVaultStructure,
    pub graduation_threshold: u64,
    pub minimum_unique_contributors: u16,
}

#[event]
pub struct ThesisDeposit {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub assets: u64,
    pub shares: u64,
}

#[event]
pub struct ThesisGraduated {
    pub thesis: Pubkey,
    pub vault: Pubkey,
    pub qualifying_capital: u64,
    pub unique_contributors: u32,
    pub graduated_at: i64,
}

#[event]
pub struct ThesisFundingCancelled {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub shares_burned: u64,
    pub assets_returned: u64,
}

#[event]
pub struct FundingYieldConfigurationChanged {
    pub vault: Pubkey,
    pub enabled: bool,
    pub target_bps: u16,
}

#[event]
pub struct SimulatedFundingYieldAllocationUpdated {
    pub vault: Pubkey,
    pub principal: u64,
    pub current_value: u64,
    pub liquid_assets: u64,
}

#[event]
pub struct FundingYieldNavSubmitted {
    pub vault: Pubkey,
    pub epoch: u64,
    pub idle_principal: u64,
    pub idle_assets: u64,
    pub total_assets: u64,
    pub content_hash: [u8; 32],
}

#[event]
pub struct SimulatedPredictionPositionUpdated {
    pub vault: Pubkey,
    pub position: Pubkey,
    pub market_id: [u8; 32],
    pub allocated_principal: u64,
    pub active: bool,
}

#[event]
pub struct SimulatedDefiAllocationUpdated {
    pub vault: Pubkey,
    pub allocated_principal: u64,
}

#[event]
pub struct ThesisNavSubmitted {
    pub vault: Pubkey,
    pub epoch: u64,
    pub total_assets: u64,
    pub share_price_x64: u128,
    pub drawdown_bps: u16,
    pub paused: bool,
    pub curator_fees_accrued: u64,
    pub protocol_fees_accrued: u64,
    pub content_hash: [u8; 32],
}

#[event]
pub struct ThesisFeesCollected {
    pub vault: Pubkey,
    pub curator: Pubkey,
    pub protocol_treasury: Pubkey,
    pub curator_amount: u64,
    pub protocol_amount: u64,
    pub nav_epoch: u64,
}

#[event]
pub struct ThesisRedemptionRequested {
    pub vault: Pubkey,
    pub request: Pubkey,
    pub owner: Pubkey,
    pub shares: u64,
    pub request_nav_epoch: u64,
}

#[event]
pub struct ThesisRedemptionCancelled {
    pub vault: Pubkey,
    pub request: Pubkey,
    pub owner: Pubkey,
    pub shares: u64,
}

#[event]
pub struct ThesisRedemptionSettled {
    pub vault: Pubkey,
    pub request: Pubkey,
    pub owner: Pubkey,
    pub shares: u64,
    pub assets: u64,
    pub nav_epoch: u64,
}

#[event]
pub struct ThesisVaultPauseChanged {
    pub vault: Pubkey,
    pub paused: bool,
}

#[event]
pub struct ThesisLifecycleChanged {
    pub thesis: Pubkey,
    pub vault: Pubkey,
    pub previous_status: ThesisStatus,
    pub next_status: ThesisStatus,
    pub changed_at: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_deposit_is_one_share_per_atomic_unit() {
        assert_eq!(
            shares_for_deposit(1_000_000_000, 0, 0).unwrap(),
            1_000_000_000
        );
    }

    #[test]
    fn later_deposit_rounds_shares_down() {
        assert_eq!(shares_for_deposit(1_000, 100_000, 120_000).unwrap(), 833);
    }

    #[test]
    fn redemption_rounds_assets_down() {
        assert_eq!(assets_for_redemption(833, 100_000, 120_000).unwrap(), 999);
    }

    #[test]
    fn nav_subtracts_fees_and_liabilities() {
        let checkpoint = NavCheckpoint {
            epoch: 1,
            accounting_liquid_assets: 10_000,
            defi_assets: 65_000,
            prediction_assets: 25_000,
            resolved_unclaimed_assets: 500,
            liabilities: 300,
            observed_at: 1,
            content_hash: [1; 32],
        };
        assert_eq!(checkpoint_total_assets(&checkpoint, 200).unwrap(), 100_000);
    }

    #[test]
    fn share_price_drawdown_ignores_deposit_size() {
        let high = share_price_x64(100_000, 100_000).unwrap();
        let after_deposit = share_price_x64(200_000, 200_000).unwrap();
        assert_eq!(drawdown_bps(high, after_deposit).unwrap(), 0);
        let loss = share_price_x64(176_000, 200_000).unwrap();
        assert_eq!(drawdown_bps(high, loss).unwrap(), 1_200);
    }

    #[test]
    fn large_checkpoint_moves_require_review() {
        assert!(validate_nav_change(100_000, 121_000, 2_000).is_err());
        assert!(validate_nav_change(100_000, 120_000, 2_000).is_ok());
    }

    #[test]
    fn pending_burns_reconcile_with_economic_supply() {
        let mut vault = test_vault();
        vault.pending_redemption_shares = 20;
        assert!(validate_share_supply(&vault, 80).is_ok());
        vault.pending_redemption_shares = 19;
        assert!(validate_share_supply(&vault, 80).is_err());
    }

    fn test_vault() -> ThesisVault {
        ThesisVault {
            thesis: Pubkey::default(),
            deposit_mint: Pubkey::default(),
            share_mint: Pubkey::default(),
            liquid_vault: Pubkey::default(),
            total_assets: 100,
            total_shares: 100,
            pending_redemption_shares: 20,
            accounting_liquid_assets: 100,
            defi_assets: 0,
            prediction_assets: 0,
            resolved_unclaimed_assets: 0,
            accrued_fees: 0,
            accrued_curator_fees: 0,
            accrued_protocol_fees: 0,
            liabilities: 0,
            simulated_prediction_principal: 0,
            simulated_defi_principal: 0,
            active_position_count: 0,
            deposit_cap: 1_000,
            nav_epoch: 0,
            last_nav_timestamp: 1,
            last_nav_hash: [0; 32],
            high_water_mark_share_price_x64: SHARE_PRICE_SCALE,
            next_redemption_nonce: 1,
            max_nav_age_seconds: 60,
            max_nav_change_bps: 2_000,
            graduation_threshold: 500,
            qualifying_capital: 100,
            per_wallet_qualifying_cap: 100,
            unique_contributors: 1,
            minimum_unique_contributors: 2,
            graduated_at: 0,
            funding_yield_enabled: false,
            funding_yield_target_bps: 9_000,
            funding_idle_principal: 0,
            funding_idle_assets: 0,
            paused: false,
            bump: 0,
            reserved: [0; 16],
        }
    }

    fn test_thesis(
        vault_structure: ThesisVaultStructure,
        lockup_seconds: i64,
        curator_fee_bps: u16,
        protocol_fee_bps: u16,
    ) -> Thesis {
        Thesis {
            config: Pubkey::default(),
            thesis_id: [1; 32],
            creator: Pubkey::new_unique(),
            curator: Pubkey::new_unique(),
            vault: Pubkey::default(),
            metadata_hash: [1; 32],
            metadata_uri: "https://example.com/thesis.json".to_owned(),
            vault_type: ThesisVaultType::Curated,
            vault_structure,
            thesis_status: ThesisStatus::Active,
            prediction_allocation_max_bps: 2_500,
            defi_allocation_target_bps: 6_500,
            liquid_reserve_target_bps: 1_000,
            max_market_allocation_bps: 500,
            max_drawdown_bps: 1_200,
            curator_fee_bps,
            protocol_fee_bps,
            minimum_reputation_tier: 0,
            max_active_positions: 5,
            expiry: 0,
            lockup_seconds,
            bump: 0,
            reserved: [0; 22],
        }
    }

    fn test_contributor(last_deposit_at: i64) -> ThesisContributor {
        ThesisContributor {
            vault: Pubkey::default(),
            owner: Pubkey::default(),
            deposited_assets: 100,
            owned_shares: 100,
            qualifying_assets: 0,
            last_deposit_at,
            bump: 0,
            reserved: [0; 7],
        }
    }

    fn initialization_params() -> InitializeThesisVaultParams {
        InitializeThesisVaultParams {
            deposit_cap: 1_000_000,
            graduation_threshold: 500_000,
            per_wallet_qualifying_cap: 100_000,
            minimum_unique_contributors: 5,
            funding_yield_target_bps: 0,
            max_nav_age_seconds: 300,
            max_nav_change_bps: 2_000,
        }
    }

    #[test]
    fn vault_structures_start_in_distinct_lifecycle_states() {
        assert_eq!(
            initial_thesis_status(ThesisVaultStructure::ClosedEnded),
            ThesisStatus::Funding
        );
        assert_eq!(
            initial_thesis_status(ThesisVaultStructure::OpenEnded),
            ThesisStatus::Dormant
        );
    }

    #[test]
    fn only_creator_or_curator_can_initialize_vault_terms() {
        let creator = Pubkey::new_unique();
        let curator = Pubkey::new_unique();
        assert!(is_vault_initializer(creator, creator, curator));
        assert!(is_vault_initializer(curator, creator, curator));
        assert!(!is_vault_initializer(
            Pubkey::new_unique(),
            creator,
            curator
        ));
    }

    #[test]
    fn closed_ended_vault_stops_accepting_deposits_after_graduation() {
        assert!(accepts_deposit(
            ThesisVaultStructure::ClosedEnded,
            ThesisStatus::Funding
        ));
        assert!(!accepts_deposit(
            ThesisVaultStructure::ClosedEnded,
            ThesisStatus::Active
        ));
    }

    #[test]
    fn open_ended_vault_accepts_deposits_when_dormant_or_active() {
        assert!(accepts_deposit(
            ThesisVaultStructure::OpenEnded,
            ThesisStatus::Dormant
        ));
        assert!(accepts_deposit(
            ThesisVaultStructure::OpenEnded,
            ThesisStatus::Active
        ));
        assert!(!accepts_deposit(
            ThesisVaultStructure::OpenEnded,
            ThesisStatus::Funding
        ));
    }

    #[test]
    fn open_ended_vault_requires_zero_graduation_terms() {
        let mut params = initialization_params();
        params.graduation_threshold = 0;
        params.per_wallet_qualifying_cap = 0;
        params.minimum_unique_contributors = 0;
        assert!(validate_vault_initialization(
            ThesisVaultStructure::OpenEnded,
            ThesisStatus::Dormant,
            &params
        )
        .is_ok());

        params.graduation_threshold = 1;
        assert!(validate_vault_initialization(
            ThesisVaultStructure::OpenEnded,
            ThesisStatus::Dormant,
            &params
        )
        .is_err());
    }

    #[test]
    fn closed_ended_vault_rejects_zero_graduation_terms() {
        let valid = initialization_params();
        assert!(validate_vault_initialization(
            ThesisVaultStructure::ClosedEnded,
            ThesisStatus::Funding,
            &valid
        )
        .is_ok());

        let mut invalid = valid;
        invalid.graduation_threshold = 0;
        assert!(validate_vault_initialization(
            ThesisVaultStructure::ClosedEnded,
            ThesisStatus::Funding,
            &invalid
        )
        .is_err());
    }

    #[test]
    fn final_redemption_removes_all_assets_without_rounding_dust() {
        assert_eq!(assets_for_redemption(833, 833, 1_117).unwrap(), 1_117);
    }

    #[test]
    fn performance_fee_is_charged_only_above_the_high_water_mark() {
        let vault = test_vault();
        let thesis = test_thesis(ThesisVaultStructure::OpenEnded, 0, 1_500, 500);
        let profitable = NavCheckpoint {
            epoch: 1,
            accounting_liquid_assets: 120,
            defi_assets: 0,
            prediction_assets: 0,
            resolved_unclaimed_assets: 0,
            liabilities: 0,
            observed_at: 1,
            content_hash: [1; 32],
        };
        assert_eq!(
            performance_fees_for_checkpoint(&vault, &thesis, &profitable).unwrap(),
            (3, 1)
        );

        let mut post_fee_vault = vault;
        post_fee_vault.accrued_fees = 4;
        post_fee_vault.accrued_curator_fees = 3;
        post_fee_vault.accrued_protocol_fees = 1;
        post_fee_vault.high_water_mark_share_price_x64 = share_price_x64(116, 100).unwrap();
        assert_eq!(
            performance_fees_for_checkpoint(&post_fee_vault, &thesis, &profitable).unwrap(),
            (0, 0)
        );
    }

    #[test]
    fn fee_rounding_never_charges_more_than_tiny_profit() {
        let vault = test_vault();
        let thesis = test_thesis(ThesisVaultStructure::OpenEnded, 0, 1_500, 500);
        let checkpoint = NavCheckpoint {
            epoch: 1,
            accounting_liquid_assets: 101,
            defi_assets: 0,
            prediction_assets: 0,
            resolved_unclaimed_assets: 0,
            liabilities: 0,
            observed_at: 1,
            content_hash: [1; 32],
        };
        let (curator, protocol) =
            performance_fees_for_checkpoint(&vault, &thesis, &checkpoint).unwrap();
        assert_eq!(curator + protocol, 1);
    }

    #[test]
    fn open_ended_lockup_restarts_on_latest_deposit() {
        let thesis = test_thesis(ThesisVaultStructure::OpenEnded, 86_400, 0, 0);
        let vault = test_vault();
        let contributor = test_contributor(1_000);
        assert!(require_lockup_elapsed(&thesis, &vault, &contributor, 87_399).is_err());
        assert!(require_lockup_elapsed(&thesis, &vault, &contributor, 87_400).is_ok());
    }

    #[test]
    fn closed_ended_lockup_starts_at_graduation() {
        let thesis = test_thesis(ThesisVaultStructure::ClosedEnded, 86_400, 0, 0);
        let mut vault = test_vault();
        vault.graduated_at = 10_000;
        let contributor = test_contributor(1);
        assert!(require_lockup_elapsed(&thesis, &vault, &contributor, 96_399).is_err());
        assert!(require_lockup_elapsed(&thesis, &vault, &contributor, 96_400).is_ok());
    }
}
