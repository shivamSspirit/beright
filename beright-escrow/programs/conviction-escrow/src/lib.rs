use anchor_lang::prelude::*;

declare_id!("E6Gp6fzaPM6y1k3wLYBFno1oMZjZvNbaFszVGzvXaZX9");

/// BeRight Conviction Escrow Program
///
/// Enables crypto projects to stake SOL on their own milestones.
/// Binary resolution: YES (milestone achieved) or NO (missed).
#[program]
pub mod conviction_escrow {
    use super::*;

    /// Create a new conviction market
    ///
    /// Project creates a market, specifying their stake position and resolution date.
    /// Vault PDA is created to hold the staked funds.
    pub fn create_market(
        ctx: Context<CreateMarket>,
        stake_position: StakePosition,
        resolution_date: i64,
        stake_amount: u64,
    ) -> Result<()> {
        // Validate resolution date is in the future
        let clock = Clock::get()?;
        require!(
            resolution_date > clock.unix_timestamp,
            ConvictionError::ResolutionDateInPast
        );

        // Validate stake amount
        require!(
            stake_amount >= MIN_STAKE_LAMPORTS,
            ConvictionError::InsufficientStake
        );

        // Initialize market
        let market = &mut ctx.accounts.market;
        market.bump = ctx.bumps.market;
        market.vault_bump = ctx.bumps.vault;
        market.project_wallet = ctx.accounts.project.key();
        market.resolver = ctx.accounts.resolver.key();
        market.stake_amount = stake_amount;
        market.stake_position = stake_position;
        market.resolution_date = resolution_date;
        market.status = MarketStatus::PendingStake;
        market.outcome = MarketOutcome::None;
        market.created_at = clock.unix_timestamp;

        msg!("Market created: {:?}", ctx.accounts.market.key());
        Ok(())
    }

    /// Project stakes SOL to activate the market
    pub fn stake(ctx: Context<Stake>) -> Result<()> {
        let market = &mut ctx.accounts.market;

        // Validate caller is project
        require!(
            ctx.accounts.project.key() == market.project_wallet,
            ConvictionError::Unauthorized
        );

        // Validate status
        require!(
            market.status == MarketStatus::PendingStake,
            ConvictionError::InvalidMarketStatus
        );

        // Transfer SOL to vault
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.project.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, market.stake_amount)?;

        // Update status
        market.status = MarketStatus::Active;

        msg!("Staked {} lamports", market.stake_amount);
        Ok(())
    }

    /// Resolver sets the market outcome
    pub fn resolve(ctx: Context<Resolve>, outcome: MarketOutcome) -> Result<()> {
        let market = &mut ctx.accounts.market;

        // Validate caller is resolver
        require!(
            ctx.accounts.resolver.key() == market.resolver,
            ConvictionError::Unauthorized
        );

        // Validate status
        require!(
            market.status == MarketStatus::Active,
            ConvictionError::InvalidMarketStatus
        );

        // Validate resolution date has passed
        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= market.resolution_date,
            ConvictionError::ResolutionDateNotReached
        );

        // Validate outcome
        require!(
            outcome != MarketOutcome::None,
            ConvictionError::InvalidOutcome
        );

        // Set outcome
        market.outcome = outcome;
        market.status = MarketStatus::Resolved;

        msg!("Market resolved: {:?}", outcome);
        Ok(())
    }

    /// Winner claims funds from vault
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let market = &mut ctx.accounts.market;

        // Validate status
        require!(
            market.status == MarketStatus::Resolved,
            ConvictionError::NotResolved
        );

        // Determine winner
        let project_wins = match (market.stake_position, market.outcome) {
            (StakePosition::Yes, MarketOutcome::Yes) => true,
            (StakePosition::No, MarketOutcome::No) => true,
            (_, MarketOutcome::Invalid) => true, // Refund to project
            _ => false,
        };

        // Validate claimer
        let claimer = ctx.accounts.claimer.key();
        if project_wins {
            require!(
                claimer == market.project_wallet,
                ConvictionError::WrongClaimer
            );
        } else {
            // In MVP, if project loses, resolver can claim (protocol fee)
            // Phase 2 will add counter-stakers
            require!(
                claimer == market.resolver || claimer == market.project_wallet,
                ConvictionError::WrongClaimer
            );
        }

        // Transfer funds from vault to claimer
        let vault_balance = ctx.accounts.vault.lamports();

        **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= vault_balance;
        **ctx.accounts.claimer.to_account_info().try_borrow_mut_lamports()? += vault_balance;

        // Update status
        market.status = MarketStatus::Claimed;

        msg!("Claimed {} lamports", vault_balance);
        Ok(())
    }
}

// ============================================================================
// CONSTANTS
// ============================================================================

/// Minimum stake in lamports (0.1 SOL)
pub const MIN_STAKE_LAMPORTS: u64 = 100_000_000;

/// Market PDA seed
pub const MARKET_SEED: &[u8] = b"market";

/// Vault PDA seed
pub const VAULT_SEED: &[u8] = b"vault";

// ============================================================================
// ACCOUNTS
// ============================================================================

#[derive(Accounts)]
pub struct CreateMarket<'info> {
    /// Market PDA - stores market state
    #[account(
        init,
        payer = project,
        space = 8 + ConvictionMarket::INIT_SPACE,
        seeds = [MARKET_SEED, project.key().as_ref()],
        bump
    )]
    pub market: Account<'info, ConvictionMarket>,

    /// Vault PDA - holds staked SOL
    #[account(
        mut,
        seeds = [VAULT_SEED, market.key().as_ref()],
        bump
    )]
    /// CHECK: Vault is a PDA that holds SOL
    pub vault: UncheckedAccount<'info>,

    /// Project wallet (payer and staker)
    #[account(mut)]
    pub project: Signer<'info>,

    /// Resolver authority
    /// CHECK: Can be any pubkey, validated in resolve instruction
    pub resolver: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    /// Market PDA
    #[account(
        mut,
        seeds = [MARKET_SEED, market.project_wallet.as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, ConvictionMarket>,

    /// Vault PDA
    #[account(
        mut,
        seeds = [VAULT_SEED, market.key().as_ref()],
        bump = market.vault_bump
    )]
    /// CHECK: Vault is a PDA that holds SOL
    pub vault: UncheckedAccount<'info>,

    /// Project wallet
    #[account(mut)]
    pub project: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Resolve<'info> {
    /// Market PDA
    #[account(
        mut,
        seeds = [MARKET_SEED, market.project_wallet.as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, ConvictionMarket>,

    /// Resolver authority
    pub resolver: Signer<'info>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    /// Market PDA
    #[account(
        mut,
        seeds = [MARKET_SEED, market.project_wallet.as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, ConvictionMarket>,

    /// Vault PDA
    #[account(
        mut,
        seeds = [VAULT_SEED, market.key().as_ref()],
        bump = market.vault_bump
    )]
    /// CHECK: Vault is a PDA that holds SOL
    pub vault: UncheckedAccount<'info>,

    /// Winner claiming funds
    #[account(mut)]
    /// CHECK: Validated in instruction logic
    pub claimer: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

// ============================================================================
// STATE
// ============================================================================

/// Conviction market account
#[account]
#[derive(InitSpace)]
pub struct ConvictionMarket {
    /// PDA bump
    pub bump: u8,
    /// Vault PDA bump
    pub vault_bump: u8,
    /// Project's wallet
    pub project_wallet: Pubkey,
    /// Resolver authority
    pub resolver: Pubkey,
    /// Stake amount in lamports
    pub stake_amount: u64,
    /// Project's position (YES or NO)
    pub stake_position: StakePosition,
    /// Unix timestamp for resolution
    pub resolution_date: i64,
    /// Market status
    pub status: MarketStatus,
    /// Resolution outcome
    pub outcome: MarketOutcome,
    /// Creation timestamp
    pub created_at: i64,
}

// ============================================================================
// ENUMS
// ============================================================================

/// Market status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum MarketStatus {
    /// Awaiting project stake
    PendingStake,
    /// Staked and active
    Active,
    /// Resolved with outcome
    Resolved,
    /// Winnings claimed
    Claimed,
}

/// Market outcome
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum MarketOutcome {
    /// Not resolved
    None,
    /// Milestone achieved
    Yes,
    /// Milestone missed
    No,
    /// Market invalidated (refund)
    Invalid,
}

/// Stake position
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum StakePosition {
    /// Betting milestone WILL be achieved
    Yes,
    /// Betting milestone will NOT be achieved
    No,
}

// ============================================================================
// ERRORS
// ============================================================================

#[error_code]
pub enum ConvictionError {
    #[msg("Resolution date must be in the future")]
    ResolutionDateInPast,

    #[msg("Stake amount too low (minimum 0.1 SOL)")]
    InsufficientStake,

    #[msg("Unauthorized - wrong signer")]
    Unauthorized,

    #[msg("Invalid market status for this operation")]
    InvalidMarketStatus,

    #[msg("Resolution date not reached yet")]
    ResolutionDateNotReached,

    #[msg("Invalid outcome value")]
    InvalidOutcome,

    #[msg("Market not resolved yet")]
    NotResolved,

    #[msg("Wrong claimer - not the winner")]
    WrongClaimer,

    #[msg("Already claimed")]
    AlreadyClaimed,
}
