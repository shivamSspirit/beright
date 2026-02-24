use anchor_lang::prelude::*;
use crate::{Initialize, state::VaultState, errors::VaultError, events::VaultInitialized};

pub fn handler(
    ctx: Context<Initialize>,
    withdrawal_delay: i64,
    epoch_withdraw_limit: u64,
    large_withdraw_threshold: u64,
) -> Result<()> {
    require!(
        withdrawal_delay >= 0 && withdrawal_delay <= VaultState::MAX_WITHDRAWAL_DELAY,
        VaultError::InvalidWithdrawalDelay
    );

    let effective_limit = if epoch_withdraw_limit == 0 {
        u64::MAX
    } else {
        epoch_withdraw_limit
    };

    let clock = Clock::get()?;
    let vault_state = &mut ctx.accounts.vault_state;

    vault_state.vault_bump   = ctx.bumps.vault;
    vault_state.state_bump   = ctx.bumps.vault_state;
    vault_state.owner        = ctx.accounts.owner.key();
    vault_state.version      = VaultState::VERSION;
    vault_state.is_frozen    = false;
    vault_state.guardian_set = false;
    vault_state.guardian     = Pubkey::default();

    vault_state.total_deposited  = 0;
    vault_state.total_withdrawn  = 0;
    vault_state.lock_until       = 0;
    vault_state.withdrawal_delay = withdrawal_delay;

    vault_state.epoch_withdraw_limit = effective_limit;
    vault_state.current_epoch        = clock.epoch;
    vault_state.epoch_withdrawn      = 0;

    vault_state.large_withdraw_threshold = large_withdraw_threshold;
    vault_state._reserved = [0u8; 64];

    emit!(VaultInitialized {
        vault: ctx.accounts.vault.key(),
        owner: ctx.accounts.owner.key(),
        withdrawal_delay,
        epoch_withdraw_limit: effective_limit,
        large_withdraw_threshold,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "BeRight vault initialized. Owner: {} | Delay: {}s | EpochLimit: {} | GuardianThreshold: {}",
        ctx.accounts.owner.key(),
        withdrawal_delay,
        effective_limit,
        large_withdraw_threshold,
    );

    Ok(())
}
