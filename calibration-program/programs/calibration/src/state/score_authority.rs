use anchor_lang::prelude::*;

/// Legacy-layout authority account retained for prediction resolution.
///
/// The account name and PDA seed remain stable for deployed-account
/// compatibility. It no longer selects or publishes a reputation model.
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
        self.accepted_score_version = 0;
        self.paused = false;
        self.last_updated_slot = clock.slot;
        self._reserved = [0; 64];
        Ok(())
    }

    pub fn update(
        &mut self,
        authority: Pubkey,
        _accepted_score_version: u8,
        paused: bool,
    ) -> Result<()> {
        let clock = Clock::get()?;
        self.authority = authority;
        self.accepted_score_version = 0;
        self.paused = paused;
        self.last_updated_slot = clock.slot;
        Ok(())
    }
}
