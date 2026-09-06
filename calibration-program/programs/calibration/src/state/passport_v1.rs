use anchor_lang::prelude::*;

use crate::errors::CalibrationError;

pub const PASSPORT_SCHEMA_VERSION_V1: u8 = 1;
pub const PASSPORT_STATUS_UNPROVEN: u8 = 0;
pub const PASSPORT_STATUS_PROVISIONAL: u8 = 1;
pub const PASSPORT_STATUS_VERIFIED: u8 = 2;
pub const PASSPORT_STATUS_ADVANCED: u8 = 3;
pub const PASSPORT_STATUS_RESTRICTED: u8 = 4;

#[account]
pub struct PassportConfig {
    pub bump: u8,
    pub authority: Pubkey,
    pub accepted_schema_version: u8,
    pub paused: bool,
    pub last_updated_slot: u64,
    pub reserved: [u8; 64],
}

impl PassportConfig {
    pub const LEN: usize = 8 + 1 + 32 + 1 + 1 + 8 + 64;
    pub fn initialize(&mut self, authority: Pubkey, bump: u8) -> Result<()> {
        self.bump = bump;
        self.authority = authority;
        self.accepted_schema_version = PASSPORT_SCHEMA_VERSION_V1;
        self.paused = false;
        self.last_updated_slot = Clock::get()?.slot;
        self.reserved = [0; 64];
        Ok(())
    }
    pub fn update(&mut self, authority: Pubkey, version: u8, paused: bool) -> Result<()> {
        require!(
            version == PASSPORT_SCHEMA_VERSION_V1,
            CalibrationError::InvalidPassportSchemaVersion
        );
        self.authority = authority;
        self.accepted_schema_version = version;
        self.paused = paused;
        self.last_updated_slot = Clock::get()?.slot;
        Ok(())
    }
}

#[account]
pub struct PassportSnapshotV1 {
    pub bump: u8,
    pub subject: Pubkey,
    pub issuer: Pubkey,
    pub schema_version: u8,
    pub status: u8,
    pub passport_root: [u8; 32],
    pub evidence_root: [u8; 32],
    pub topic_vector_hash: [u8; 32],
    pub scoring_code_hash: [u8; 32],
    pub score_epoch: u64,
    pub data_window_start: i64,
    pub data_window_end: i64,
    pub evidence_count: u32,
    pub confidence_bps: u16,
    pub issued_at: i64,
    pub expires_at: i64,
    pub revoked_at: i64,
    pub revocation_reason_hash: [u8; 32],
    pub updated_slot: u64,
    pub reserved: [u8; 64],
}

impl PassportSnapshotV1 {
    pub const LEN: usize = 8 + 353;
    pub fn initialize(&mut self, subject: Pubkey, bump: u8) {
        self.bump = bump;
        self.subject = subject;
        self.issuer = Pubkey::default();
        self.schema_version = PASSPORT_SCHEMA_VERSION_V1;
        self.status = PASSPORT_STATUS_RESTRICTED;
        self.passport_root = [0; 32];
        self.evidence_root = [0; 32];
        self.topic_vector_hash = [0; 32];
        self.scoring_code_hash = [0; 32];
        self.score_epoch = 0;
        self.data_window_start = 0;
        self.data_window_end = 0;
        self.evidence_count = 0;
        self.confidence_bps = 0;
        self.issued_at = 0;
        self.expires_at = 0;
        self.revoked_at = 0;
        self.revocation_reason_hash = [0; 32];
        self.updated_slot = 0;
        self.reserved = [0; 64];
    }
    pub fn upsert(
        &mut self,
        subject: Pubkey,
        issuer: Pubkey,
        bump: u8,
        args: UpsertPassportSnapshotV1Args,
    ) -> Result<()> {
        validate_args(&args)?;
        require!(
            args.score_epoch > self.score_epoch,
            CalibrationError::StalePassportEpoch
        );
        // A revoked passport can only be superseded by a strictly newer issuer epoch.
        self.bump = bump;
        self.subject = subject;
        self.issuer = issuer;
        self.schema_version = args.schema_version;
        self.status = args.status;
        self.passport_root = args.passport_root;
        self.evidence_root = args.evidence_root;
        self.topic_vector_hash = args.topic_vector_hash;
        self.scoring_code_hash = args.scoring_code_hash;
        self.score_epoch = args.score_epoch;
        self.data_window_start = args.data_window_start;
        self.data_window_end = args.data_window_end;
        self.evidence_count = args.evidence_count;
        self.confidence_bps = args.confidence_bps;
        self.issued_at = args.issued_at;
        self.expires_at = args.expires_at;
        self.revoked_at = 0;
        self.revocation_reason_hash = [0; 32];
        self.updated_slot = Clock::get()?.slot;
        Ok(())
    }
    pub fn revoke(&mut self, reason_hash: [u8; 32]) -> Result<()> {
        validate_hash(reason_hash)?;
        require!(
            self.revoked_at == 0,
            CalibrationError::PassportAlreadyRevoked
        );
        self.revoked_at = Clock::get()?.unix_timestamp;
        self.revocation_reason_hash = reason_hash;
        self.updated_slot = Clock::get()?.slot;
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct UpsertPassportSnapshotV1Args {
    pub schema_version: u8,
    pub status: u8,
    pub passport_root: [u8; 32],
    pub evidence_root: [u8; 32],
    pub topic_vector_hash: [u8; 32],
    pub scoring_code_hash: [u8; 32],
    pub score_epoch: u64,
    pub data_window_start: i64,
    pub data_window_end: i64,
    pub evidence_count: u32,
    pub confidence_bps: u16,
    pub issued_at: i64,
    pub expires_at: i64,
}
fn validate_hash(value: [u8; 32]) -> Result<()> {
    require!(value != [0; 32], CalibrationError::InvalidHash);
    Ok(())
}
fn validate_args(args: &UpsertPassportSnapshotV1Args) -> Result<()> {
    require!(
        args.schema_version == PASSPORT_SCHEMA_VERSION_V1,
        CalibrationError::InvalidPassportSchemaVersion
    );
    require!(
        args.status <= PASSPORT_STATUS_RESTRICTED,
        CalibrationError::InvalidPassportStatus
    );
    validate_hash(args.passport_root)?;
    validate_hash(args.evidence_root)?;
    validate_hash(args.topic_vector_hash)?;
    validate_hash(args.scoring_code_hash)?;
    require!(
        args.confidence_bps <= 10_000,
        CalibrationError::InvalidConfidenceBps
    );
    require!(
        args.data_window_start <= args.data_window_end,
        CalibrationError::InvalidPassportTimestamp
    );
    require!(
        args.issued_at > 0
            && args.expires_at > args.issued_at
            && args.expires_at > Clock::get()?.unix_timestamp,
        CalibrationError::InvalidPassportTimestamp
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{PassportConfig, PassportSnapshotV1};

    #[test]
    fn passport_account_lengths_include_discriminator_and_reserved_space() {
        assert_eq!(PassportConfig::LEN, 115);
        assert_eq!(PassportSnapshotV1::LEN, 361);
    }
}
