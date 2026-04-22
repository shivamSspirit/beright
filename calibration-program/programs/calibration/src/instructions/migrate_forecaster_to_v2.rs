use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};
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
    /// NOTE:
    /// This is intentionally `UncheckedAccount` because a legacy V1 account cannot
    /// be deserialized as V2 during Anchor account validation.
    ///
    /// CHECK: The PDA address is verified via seeds+bump, and we additionally
    /// validate the embedded `authority` and `version` by deserializing the
    /// existing V1 state in the handler before reallocating.
    #[account(
        mut,
        seeds = [b"forecaster", authority.key().as_ref()],
        bump,
    )]
    pub forecaster_state: UncheckedAccount<'info>,

    /// System program (required for realloc)
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<MigrateForecasterToV2>) -> Result<()> {
    let authority = ctx.accounts.authority.key();
    let forecaster_state_ai = ctx.accounts.forecaster_state.to_account_info();

    // --------
    // Validate V1 state (skip 8-byte discriminator)
    // --------
    {
        let data = forecaster_state_ai.data.borrow();
        require!(data.len() >= 8, ForecasterV2ErrorCode::InvalidVersion);

        let mut cursor: &[u8] = &data[8..];
        let v1_state = ForecasterStateV1::deserialize(&mut cursor)?;

        require!(v1_state.authority == authority, ForecasterV2ErrorCode::InvalidVersion);
        require!(v1_state.version == 1, ForecasterV2ErrorCode::InvalidVersion);

        msg!("Migrating forecaster {} from V1 to V2", authority);
        msg!(
            "Pre-migration stats: {} total predictions, {} resolved, avg Brier: {:.4}",
            v1_state.total_predictions,
            v1_state.resolved_predictions,
            v1_state.avg_brier_score
        );
    }

    // --------
    // Ensure rent-exempt lamports for the new size, then realloc
    // --------
    let new_len = ForecasterState::LEN;
    let rent = Rent::get()?;
    let required_lamports = rent.minimum_balance(new_len);
    let current_lamports = forecaster_state_ai.lamports();

    if current_lamports < required_lamports {
        let diff = required_lamports - current_lamports;
        let ix = system_instruction::transfer(&authority, &forecaster_state_ai.key(), diff);
        invoke(
            &ix,
            &[
                ctx.accounts.authority.to_account_info(),
                forecaster_state_ai.clone(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
    }

    // Do NOT zero new bytes; keep V1 data intact.
    forecaster_state_ai.realloc(new_len, false)?;

    // --------
    // Deserialize as V2, initialize new fields, and write back
    // --------
    let mut data_mut = forecaster_state_ai.data.borrow_mut();
    let mut cursor2: &[u8] = &data_mut;
    let mut v2_state = ForecasterState::try_deserialize_unchecked(&mut cursor2)?;

    require!(v2_state.authority == authority, ForecasterV2ErrorCode::InvalidVersion);
    v2_state.migrate_from_v1()?;

    let mut out: &mut [u8] = &mut data_mut;
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
        // Sanity check: V2 account size must be larger than the legacy V1 body.
        assert!(ForecasterState::LEN > (8 + ForecasterStateV1::LEN_NO_DISCRIMINATOR));
    }
}
