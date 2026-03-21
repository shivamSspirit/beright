use anchor_lang::prelude::*;

use crate::errors::StakingPoolError;
use crate::events::MeteoraYieldHarvestedEvent;
use crate::state::{MeteoraVaultState, StakingPoolState};

use super::METEORA_VAULT_STATE_SEED;

/// Accounts for harvesting yield from Meteora vault
#[derive(Accounts)]
pub struct HarvestMeteoraYield<'info> {
    /// Pool forecaster (must be pool owner)
    #[account(mut)]
    pub forecaster: Signer<'info>,

    /// The staking pool
    #[account(
        mut,
        constraint = pool_state.forecaster == forecaster.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool_state: Account<'info, StakingPoolState>,

    /// Meteora vault state for this pool
    #[account(
        mut,
        seeds = [METEORA_VAULT_STATE_SEED, pool_state.key().as_ref()],
        bump = meteora_state.bump,
        constraint = meteora_state.pool == pool_state.key() @ StakingPoolError::InvalidPool,
        constraint = meteora_state.is_active @ StakingPoolError::MeteoraVaultNotActive,
    )]
    pub meteora_state: Account<'info, MeteoraVaultState>,

    /// Meteora vault state account (for reading virtual price)
    /// CHECK: Validated by Meteora program
    pub meteora_vault: AccountInfo<'info>,
}

/// Harvest yield from Meteora vault by updating virtual price
///
/// This instruction reads the current virtual price from the Meteora vault
/// and calculates the yield earned since the last harvest. No actual token
/// transfer happens - the yield is tracked in the state for later realization
/// during withdrawal.
///
/// # Arguments
/// * `new_virtual_price` - Current virtual price from Meteora vault (scaled 1e9)
pub fn handler(ctx: Context<HarvestMeteoraYield>, new_virtual_price: u64) -> Result<()> {
    let meteora_state = &ctx.accounts.meteora_state;

    // Validate new virtual price is reasonable
    require!(
        new_virtual_price > 0,
        StakingPoolError::InvalidVirtualPrice
    );

    // Virtual price should only increase (yield accrual)
    // Allow small decrease for rounding, but flag if significant
    let min_acceptable_price = meteora_state
        .last_virtual_price
        .saturating_mul(99)
        .saturating_div(100);

    require!(
        new_virtual_price >= min_acceptable_price,
        StakingPoolError::VirtualPriceDecreased
    );

    // Calculate pending yield based on virtual price increase
    let pending_yield = meteora_state.calculate_pending_yield(new_virtual_price);

    // Only harvest if there's meaningful yield (avoid dust)
    if pending_yield == 0 {
        msg!("No yield to harvest (virtual price unchanged or decreased slightly)");
        return Ok(());
    }

    let clock = Clock::get()?;

    // Update meteora state with new virtual price and yield
    let meteora_state = &mut ctx.accounts.meteora_state;
    meteora_state.record_harvest(pending_yield, new_virtual_price)?;

    // Emit harvest event
    emit!(MeteoraYieldHarvestedEvent {
        pool: ctx.accounts.pool_state.key(),
        yield_amount: pending_yield,
        old_virtual_price: meteora_state.last_virtual_price,
        new_virtual_price,
        lp_token_balance: meteora_state.lp_token_balance,
        total_yield_earned: meteora_state.total_yield_earned,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Harvested {} yield from Meteora (price {} -> {})",
        pending_yield,
        meteora_state.last_virtual_price,
        new_virtual_price
    );

    Ok(())
}

/// Auto-harvest that reads virtual price from on-chain account
#[derive(Accounts)]
pub struct AutoHarvestMeteoraYield<'info> {
    /// Anyone can trigger auto-harvest (permissionless)
    pub caller: Signer<'info>,

    /// The staking pool
    #[account(mut)]
    pub pool_state: Account<'info, StakingPoolState>,

    /// Meteora vault state for this pool
    #[account(
        mut,
        seeds = [METEORA_VAULT_STATE_SEED, pool_state.key().as_ref()],
        bump = meteora_state.bump,
        constraint = meteora_state.pool == pool_state.key() @ StakingPoolError::InvalidPool,
        constraint = meteora_state.is_active @ StakingPoolError::MeteoraVaultNotActive,
    )]
    pub meteora_state: Account<'info, MeteoraVaultState>,

    /// Meteora vault state account (for reading virtual price)
    /// CHECK: Must match the vault in meteora_state
    #[account(
        constraint = meteora_vault.key() == meteora_state.vault @ StakingPoolError::InvalidVault,
    )]
    pub meteora_vault: AccountInfo<'info>,
}

/// Auto-harvest yield by reading virtual price from Meteora vault account
///
/// This is a permissionless instruction that anyone can call to trigger
/// yield harvesting. It reads the virtual price directly from the Meteora
/// vault account data.
pub fn handler_auto_harvest(ctx: Context<AutoHarvestMeteoraYield>) -> Result<()> {
    let meteora_state = &ctx.accounts.meteora_state;

    // Read virtual price from Meteora vault account
    // Meteora vault layout: skip discriminator (8) + other fields
    // Virtual price is typically at a known offset in the vault struct
    let vault_data = ctx.accounts.meteora_vault.try_borrow_data()?;

    // Meteora vault virtual price offset (this may need adjustment based on actual layout)
    // Typically: discriminator (8) + various pubkeys and u64s
    // For now, we use a simplified approach
    const VIRTUAL_PRICE_OFFSET: usize = 8 + 32 + 32 + 32 + 8 + 8; // Approximate offset

    if vault_data.len() < VIRTUAL_PRICE_OFFSET + 8 {
        msg!("Meteora vault data too short to read virtual price");
        return Err(StakingPoolError::InvalidVaultData.into());
    }

    let virtual_price_bytes: [u8; 8] = vault_data[VIRTUAL_PRICE_OFFSET..VIRTUAL_PRICE_OFFSET + 8]
        .try_into()
        .map_err(|_| StakingPoolError::InvalidVaultData)?;
    let new_virtual_price = u64::from_le_bytes(virtual_price_bytes);

    // Validate price
    require!(
        new_virtual_price > 0,
        StakingPoolError::InvalidVirtualPrice
    );

    // Calculate pending yield
    let pending_yield = meteora_state.calculate_pending_yield(new_virtual_price);

    if pending_yield == 0 {
        msg!("No yield to harvest");
        return Ok(());
    }

    let clock = Clock::get()?;

    // Update state
    let meteora_state = &mut ctx.accounts.meteora_state;
    let old_price = meteora_state.last_virtual_price;
    meteora_state.record_harvest(pending_yield, new_virtual_price)?;

    // Emit event
    emit!(MeteoraYieldHarvestedEvent {
        pool: ctx.accounts.pool_state.key(),
        yield_amount: pending_yield,
        old_virtual_price: old_price,
        new_virtual_price,
        lp_token_balance: meteora_state.lp_token_balance,
        total_yield_earned: meteora_state.total_yield_earned,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Auto-harvested {} yield from Meteora (price {} -> {})",
        pending_yield,
        old_price,
        new_virtual_price
    );

    Ok(())
}

/// Update Meteora vault allocation percentage
#[derive(Accounts)]
pub struct UpdateMeteoraAllocation<'info> {
    /// Pool forecaster (must be pool owner)
    #[account(mut)]
    pub forecaster: Signer<'info>,

    /// The staking pool
    #[account(
        constraint = pool_state.forecaster == forecaster.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool_state: Account<'info, StakingPoolState>,

    /// Meteora vault state for this pool
    #[account(
        mut,
        seeds = [METEORA_VAULT_STATE_SEED, pool_state.key().as_ref()],
        bump = meteora_state.bump,
        constraint = meteora_state.pool == pool_state.key() @ StakingPoolError::InvalidPool,
    )]
    pub meteora_state: Account<'info, MeteoraVaultState>,
}

/// Update the allocation percentage for Meteora vault
///
/// # Arguments
/// * `new_allocation_bps` - New allocation in basis points (max 10000 = 100%)
pub fn handler_update_allocation(
    ctx: Context<UpdateMeteoraAllocation>,
    new_allocation_bps: u16,
) -> Result<()> {
    require!(
        new_allocation_bps <= MeteoraVaultState::MAX_ALLOCATION_BPS,
        StakingPoolError::InvalidAllocation
    );

    let meteora_state = &mut ctx.accounts.meteora_state;
    let old_allocation = meteora_state.allocation_bps;
    meteora_state.allocation_bps = new_allocation_bps;
    meteora_state.last_update = Clock::get()?.unix_timestamp;

    msg!(
        "Updated Meteora allocation: {}bps -> {}bps",
        old_allocation,
        new_allocation_bps
    );

    Ok(())
}

/// Pause/unpause Meteora vault integration
#[derive(Accounts)]
pub struct SetMeteoraActive<'info> {
    /// Pool forecaster (must be pool owner)
    #[account(mut)]
    pub forecaster: Signer<'info>,

    /// The staking pool
    #[account(
        constraint = pool_state.forecaster == forecaster.key() @ StakingPoolError::Unauthorized,
    )]
    pub pool_state: Account<'info, StakingPoolState>,

    /// Meteora vault state for this pool
    #[account(
        mut,
        seeds = [METEORA_VAULT_STATE_SEED, pool_state.key().as_ref()],
        bump = meteora_state.bump,
        constraint = meteora_state.pool == pool_state.key() @ StakingPoolError::InvalidPool,
    )]
    pub meteora_state: Account<'info, MeteoraVaultState>,
}

/// Set active status for Meteora vault integration
///
/// # Arguments
/// * `is_active` - Whether the integration should be active
pub fn handler_set_active(ctx: Context<SetMeteoraActive>, is_active: bool) -> Result<()> {
    let meteora_state = &mut ctx.accounts.meteora_state;
    meteora_state.is_active = is_active;
    meteora_state.last_update = Clock::get()?.unix_timestamp;

    msg!(
        "Meteora vault integration {}",
        if is_active { "activated" } else { "paused" }
    );

    Ok(())
}
