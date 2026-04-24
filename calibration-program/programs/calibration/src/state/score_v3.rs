use anchor_lang::prelude::*;

use crate::errors::CalibrationError;

pub const SCORE_VERSION_V3: u8 = 3;

pub const STATUS_IMPORTED_CANDIDATE: u8 = 0;
pub const STATUS_BOOTSTRAP_ELIGIBLE: u8 = 1;
pub const STATUS_NATIVE_CALIBRATING: u8 = 2;
pub const STATUS_NATIVE_VERIFIED: u8 = 3;
pub const STATUS_VAULT_ELIGIBLE: u8 = 4;
pub const STATUS_VAULT_SCALED: u8 = 5;
pub const STATUS_RESTRICTED: u8 = 6;

pub const TIER_RESTRICTED: u8 = 0;
pub const TIER_BOOTSTRAP: u8 = 1;
pub const TIER_STANDARD: u8 = 2;
pub const TIER_ADVANCED: u8 = 3;
pub const TIER_ELITE: u8 = 4;

#[account]
pub struct ScoreConfig {
    pub bump: u8,
    pub authority: Pubkey,
    pub accepted_score_version: u8,
    pub paused: bool,
    pub last_updated_slot: u64,
    pub _reserved: [u8; 64],
}

impl ScoreConfig {
    pub const LEN: usize = 8 + 1 + 32 + 1 + 1 + 8 + 64;

    pub fn initialize(&mut self, authority: Pubkey, bump: u8) -> Result<()> {
        let clock = Clock::get()?;

        self.bump = bump;
        self.authority = authority;
        self.accepted_score_version = SCORE_VERSION_V3;
        self.paused = false;
        self.last_updated_slot = clock.slot;
        self._reserved = [0; 64];

        Ok(())
    }

    pub fn update(
        &mut self,
        authority: Pubkey,
        accepted_score_version: u8,
        paused: bool,
    ) -> Result<()> {
        validate_score_version(accepted_score_version)?;

        let clock = Clock::get()?;
        self.authority = authority;
        self.accepted_score_version = accepted_score_version;
        self.paused = paused;
        self.last_updated_slot = clock.slot;

        Ok(())
    }
}

#[account]
pub struct ScoreSnapshotV3 {
    pub bump: u8,
    pub forecaster: Pubkey,
    pub score_version: u8,
    pub status: u8,
    pub tier: u8,
    pub snapshot_hash: [u8; 32],
    pub score_epoch_hash: [u8; 32],
    pub proof_hash: [u8; 32],
    pub has_imported_score: bool,
    pub imported_score: u16,
    pub has_native_score: bool,
    pub native_score: u16,
    pub vault_score: u16,
    pub confidence_bps: u16,
    pub native_resolved_count: u32,
    pub imported_resolved_count: u32,
    pub max_active_sleeve_bps: u16,
    pub max_market_exposure_bps: u16,
    pub max_theme_exposure_bps: u16,
    pub probationary: bool,
    pub penalty_flags: u32,
    pub calculated_at: i64,
    pub updated_at: i64,
    pub updated_slot: u64,
    pub _reserved: [u8; 64],
}

impl ScoreSnapshotV3 {
    pub const LEN: usize = 8 + 249;

    pub fn initialize(&mut self, forecaster: Pubkey, bump: u8) {
        self.bump = bump;
        self.forecaster = forecaster;
        self.score_version = SCORE_VERSION_V3;
        self.status = STATUS_RESTRICTED;
        self.tier = TIER_RESTRICTED;
        self.snapshot_hash = [0; 32];
        self.score_epoch_hash = [0; 32];
        self.proof_hash = [0; 32];
        self.has_imported_score = false;
        self.imported_score = 0;
        self.has_native_score = false;
        self.native_score = 0;
        self.vault_score = 0;
        self.confidence_bps = 0;
        self.native_resolved_count = 0;
        self.imported_resolved_count = 0;
        self.max_active_sleeve_bps = 0;
        self.max_market_exposure_bps = 0;
        self.max_theme_exposure_bps = 0;
        self.probationary = false;
        self.penalty_flags = 0;
        self.calculated_at = 0;
        self.updated_at = 0;
        self.updated_slot = 0;
        self._reserved = [0; 64];
    }

    pub fn sync(
        &mut self,
        bump: u8,
        forecaster: Pubkey,
        args: SyncScoreSnapshotV3Args,
    ) -> Result<()> {
        validate_score_version(args.score_version)?;
        validate_status(args.status)?;
        validate_tier(args.tier)?;
        validate_hash(args.snapshot_hash)?;
        validate_hash(args.score_epoch_hash)?;
        validate_score(args.vault_score)?;
        validate_score_cap(args.confidence_bps, CalibrationError::InvalidConfidenceBps)?;
        validate_score_cap(
            args.max_active_sleeve_bps,
            CalibrationError::InvalidRiskCapBps,
        )?;
        validate_score_cap(
            args.max_market_exposure_bps,
            CalibrationError::InvalidRiskCapBps,
        )?;
        validate_score_cap(
            args.max_theme_exposure_bps,
            CalibrationError::InvalidRiskCapBps,
        )?;

        if args.has_imported_score {
            validate_score(args.imported_score)?;
        }

        if args.has_native_score {
            validate_score(args.native_score)?;
        }

        require!(
            args.max_market_exposure_bps <= args.max_theme_exposure_bps,
            CalibrationError::InvalidRiskCapBps
        );
        require!(
            args.max_theme_exposure_bps <= args.max_active_sleeve_bps,
            CalibrationError::InvalidRiskCapBps
        );
        require!(args.calculated_at > 0, CalibrationError::InvalidTimestamp);

        let clock = Clock::get()?;

        self.bump = bump;
        self.forecaster = forecaster;
        self.score_version = args.score_version;
        self.status = args.status;
        self.tier = args.tier;
        self.snapshot_hash = args.snapshot_hash;
        self.score_epoch_hash = args.score_epoch_hash;
        self.proof_hash = args.proof_hash;
        self.has_imported_score = args.has_imported_score;
        self.imported_score = if args.has_imported_score {
            args.imported_score
        } else {
            0
        };
        self.has_native_score = args.has_native_score;
        self.native_score = if args.has_native_score {
            args.native_score
        } else {
            0
        };
        self.vault_score = args.vault_score;
        self.confidence_bps = args.confidence_bps;
        self.native_resolved_count = args.native_resolved_count;
        self.imported_resolved_count = args.imported_resolved_count;
        self.max_active_sleeve_bps = args.max_active_sleeve_bps;
        self.max_market_exposure_bps = args.max_market_exposure_bps;
        self.max_theme_exposure_bps = args.max_theme_exposure_bps;
        self.probationary = args.probationary;
        self.penalty_flags = args.penalty_flags;
        self.calculated_at = args.calculated_at;
        self.updated_at = clock.unix_timestamp;
        self.updated_slot = clock.slot;

        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct SyncScoreSnapshotV3Args {
    pub score_version: u8,
    pub status: u8,
    pub tier: u8,
    pub snapshot_hash: [u8; 32],
    pub score_epoch_hash: [u8; 32],
    pub proof_hash: [u8; 32],
    pub has_imported_score: bool,
    pub imported_score: u16,
    pub has_native_score: bool,
    pub native_score: u16,
    pub vault_score: u16,
    pub confidence_bps: u16,
    pub native_resolved_count: u32,
    pub imported_resolved_count: u32,
    pub max_active_sleeve_bps: u16,
    pub max_market_exposure_bps: u16,
    pub max_theme_exposure_bps: u16,
    pub probationary: bool,
    pub penalty_flags: u32,
    pub calculated_at: i64,
}

fn validate_score_version(score_version: u8) -> Result<()> {
    require!(
        score_version == SCORE_VERSION_V3,
        CalibrationError::InvalidScoreVersion
    );
    Ok(())
}

fn validate_status(status: u8) -> Result<()> {
    require!(
        status <= STATUS_RESTRICTED,
        CalibrationError::InvalidForecasterStatus
    );
    Ok(())
}

fn validate_tier(tier: u8) -> Result<()> {
    require!(tier <= TIER_ELITE, CalibrationError::InvalidForecasterTier);
    Ok(())
}

fn validate_score(score: u16) -> Result<()> {
    require!(score <= 1000, CalibrationError::InvalidScoreValue);
    Ok(())
}

fn validate_score_cap(value: u16, error: CalibrationError) -> Result<()> {
    if value > 10_000 {
        return Err(error.into());
    }

    Ok(())
}

fn validate_hash(hash: [u8; 32]) -> Result<()> {
    require!(hash != [0; 32], CalibrationError::InvalidHash);
    Ok(())
}
