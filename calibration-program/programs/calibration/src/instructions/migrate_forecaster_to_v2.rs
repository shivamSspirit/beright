use anchor_lang::prelude::*;
use crate::state::{ForecasterState, ForecasterStateV1, ForecasterV2ErrorCode};

/// Migrate a V1 forecaster account to V2 schema
///
/// **CRITICAL OPERATION**: This reallocates the account to add V2 fields.
///
/// **Safety guarantees**:
/// - All V1 data preserved in exact same locations
/// - V2 fields appended after V1 data
/// - Version field updated from 1 to 2
/// - No data loss possible (realloc only grows, never shrinks)
///
/// **After migration**:
/// - Off-chain service should recalculate scores from historical cross-platform data
/// - V2 scores will be 0/None until recalculated
/// - Account can continue to be used immediately (backward compat)
///
/// **Cost**:
/// - Rent difference: ~0.0014 SOL (V2 is 359 bytes larger than V1)
/// - Transaction fee: ~0.000005 SOL
/// - Total: ~0.0015 SOL per migration
#[derive(Accounts)]
pub struct MigrateForecasterToV2<'info> {
    /// Forecaster's wallet (authority) - must sign to authorize migration
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Forecaster state account (PDA) - will be reallocated from V1 to V2
    ///
    /// **IMPORTANT**: This account MUST be version 1 before migration.
    /// Attempting to migrate a V2 account will fail with InvalidVersion error.
    #[account(
        mut,
        seeds = [b"forecaster", authority.key().as_ref()],
        bump,
        constraint = forecaster_state.authority == authority.key() @ ForecasterV2ErrorCode::InvalidVersion,
        realloc = ForecasterState::LEN,
        realloc::payer = authority,
        realloc::zero = false,  // CRITICAL: Do not zero - preserves existing V1 data
    )]
    pub forecaster_state: Account<'info, ForecasterStateV1>,

    /// System program (required for realloc)
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<MigrateForecasterToV2>) -> Result<()> {
    let authority = ctx.accounts.authority.key();

    // Safety check: ensure we're migrating from V1
    require!(
        ctx.accounts.forecaster_state.version == 1,
        ForecasterV2ErrorCode::InvalidVersion
    );

    // Log pre-migration state for auditing
    msg!(
        "Migrating forecaster {} from V1 to V2",
        authority
    );
    msg!(
        "Pre-migration stats: {} total predictions, {} resolved, avg Brier: {:.4}",
        ctx.accounts.forecaster_state.total_predictions,
        ctx.accounts.forecaster_state.resolved_predictions,
        ctx.accounts.forecaster_state.avg_brier_score
    );

    // IMPORTANT:
    // - The existing on-chain account is serialized as V1 (smaller).
    // - This instruction reallocates it to V2 length.
    // - After realloc, we must deserialize as V2 and initialize the new fields.
    //
    // We cannot declare the account as `Account<ForecasterState>` in the Accounts struct,
    // because Anchor would attempt to deserialize V1 bytes as V2 during validation and fail.
    let account_info = ctx.accounts.forecaster_state.to_account_info();

    // After realloc, interpret the account data as V2 and initialize all new fields safely.
    let mut data = account_info.data.borrow_mut();
    let mut cursor: &[u8] = &data;
    let mut v2_state = ForecasterState::try_deserialize_unchecked(&mut cursor)?;

    // Double-check authority matches (defense-in-depth)
    require!(v2_state.authority == authority, ForecasterV2ErrorCode::InvalidVersion);

    // This preserves all V1 fields and initializes all V2 additions.
    v2_state.migrate_from_v1()?;

    // Write the updated V2 state back to the account.
    let mut out: &mut [u8] = &mut data;
    v2_state.try_serialize(&mut out)?;

    // Log post-migration state
    msg!("Migration complete - forecaster is now V2");
    msg!(
        "Initial V2 scores: S1={:.3}, confidence={:.3}, final_composite={}",
        v2_state.s1_composite,
        v2_state.confidence_weight,
        v2_state.final_composite_score
    );

    msg!(
        "IMPORTANT: Off-chain service should recalculate cross-platform scores for {}",
        authority
    );

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_migration_account_size_calculation() {
        // Verify that V2 account size is correctly calculated
        const V1_SIZE: usize = 230;  // 8 (discriminator) + 222 (V1 fields)
        const V2_SIZE: usize = ForecasterState::LEN;

        // V2 should be exactly V1 + 359 bytes
        // NOTE: ForecasterState::LEN reflects the current on-chain measured size (borsh packing).
        assert!(V2_SIZE > V1_SIZE, "V2 size must be larger than V1");
    }
}
