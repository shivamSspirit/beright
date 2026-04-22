use anchor_lang::prelude::*;

/// Forecaster calibration state account - Version 2
///
/// **CRITICAL CHANGES FROM V1**:
/// - Dual-path S1 (trade-implied + calibration-binned Brier)
/// - S6 Cross-Platform Consistency component
/// - Confidence-weighted composite (Bayesian shrinkage)
/// - Platform-specific metrics for Polymarket, Metaculus, Kalshi, Manifold
/// - Anti-gaming signals (MM detection, late entry, question difficulty)
///
/// **BACKWARD COMPATIBILITY**: All V1 fields preserved in exact same order
///
/// PDA: [b"forecaster", forecaster_pubkey]
#[account]
pub struct ForecasterState {
    // ========================================================================
    // V1 FIELDS (UNCHANGED - DO NOT REORDER)
    // ========================================================================

    /// Bump seed for PDA derivation
    pub bump: u8,

    /// Forecaster's wallet address
    pub authority: Pubkey,

    /// Total number of predictions made (lifetime)
    /// DEPRECATED in V2 - use total_resolved_events instead
    pub total_predictions: u32,

    /// Number of resolved predictions
    /// DEPRECATED in V2 - use total_resolved_events instead
    pub resolved_predictions: u32,

    /// Cumulative Brier score (sum of all Brier scores)
    /// DEPRECATED in V2 - use s1_composite instead
    pub cumulative_brier_score: f64,

    /// Average Brier score (cumulative / resolved_predictions)
    /// DEPRECATED in V2 - use s1_composite instead
    pub avg_brier_score: f64,

    /// Cumulative log score (sum of all log scores)
    pub cumulative_log_score: f64,

    /// Average log score
    pub avg_log_score: f64,

    /// Number of correct predictions
    pub correct_predictions: u32,

    /// Simple accuracy percentage
    pub accuracy: f64,

    /// Number of unique markets predicted on
    pub markets_traded: u16,

    /// Best category by Brier score (0-255)
    pub best_category: u8,

    /// Worst category by Brier score
    pub worst_category: u8,

    /// Current winning streak (consecutive correct predictions)
    pub streak_correct: u16,

    /// Longest winning streak (historical)
    pub max_streak_correct: u16,

    /// Unix timestamp of last prediction
    pub last_prediction_ts: i64,

    /// Unix timestamp of account creation
    pub created_at: i64,

    /// Calibration buckets (10 buckets: 0-10%, 10-20%, ..., 90-100%)
    /// Each bucket stores: [count, sum_actual_outcomes]
    /// CRITICAL: Still used for Murphy-Yates decomposition in V2
    pub calibration_buckets: [[u16; 2]; 10],

    /// Schema version (1 = V1, 2 = V2)
    pub version: u8,

    /// Reserved space from V1 (64 bytes)
    /// DO NOT REMOVE - maintains V1 account size
    pub _reserved_v1: [u8; 64],

    // ========================================================================
    // V2 ADDITIONS (APPENDED AFTER V1 FIELDS)
    // ========================================================================

    // --- DUAL-PATH S1 (Lesson #1: Platform-Aware Calibration) ---

    /// S1 score calculated from trade-implied probabilities
    /// Used for: Polymarket, Kalshi, Limitless (CLOB platforms)
    /// Formula: 1 - (mean(weighted_avg_price - outcome)^2 / 0.25)
    pub s1_trade_implied: Option<f64>,

    /// S1 score calculated from calibration-binned probabilities
    /// Used for: Metaculus, Manifold (forecast platforms)
    /// Formula: 1 - (bin_miscalibration_error / 0.25)
    pub s1_calibration_binned: Option<f64>,

    /// Composite S1 (weighted average of available paths)
    /// This is the final S1 that goes into the composite score
    pub s1_composite: f64,

    // --- PLATFORM-SPECIFIC SAMPLE SIZES (for confidence weighting) ---

    /// Number of resolved trades on Polymarket
    pub polymarket_resolved_trades: u32,

    /// Number of resolved questions on Metaculus
    pub metaculus_resolved_questions: u32,

    /// Number of resolved trades on Kalshi
    pub kalshi_resolved_trades: u32,

    /// Number of resolved questions on Manifold
    pub manifold_resolved_questions: u32,

    // --- PLATFORM-SPECIFIC COMPOSITE SCORES (for S6 calculation) ---

    /// Composite BeRight score (0-1000) for Polymarket only
    /// None if forecaster has never traded on Polymarket
    pub polymarket_composite: Option<u16>,

    /// Composite BeRight score (0-1000) for Metaculus only
    /// None if forecaster has never forecasted on Metaculus
    pub metaculus_composite: Option<u16>,

    /// Composite BeRight score (0-1000) for Kalshi only
    pub kalshi_composite: Option<u16>,

    /// Composite BeRight score (0-1000) for Manifold only
    pub manifold_composite: Option<u16>,

    // --- COMPONENT SCORES (S1-S6 with updated formulas) ---

    /// S2: Resolution score (Murphy-Yates decomposition)
    /// Measures how decisively forecaster diverges from base rate when correct
    /// Higher = more confident + accurate
    pub s2_resolution: f64,

    /// S3a: Economic edge (for CLOB platforms)
    /// Mean(outcome - entry_price) in cents per share
    /// Normalized by /0.25 (99th percentile edge)
    pub s3_economic_edge: Option<f64>,

    /// S3b: Informational edge (for forecast platforms)
    /// Mean peer score / 50 (re-calibrated from Metaculus data)
    pub s3_informational_edge: Option<f64>,

    /// S3: Composite edge (max or weighted avg of S3a and S3b)
    pub s3_composite: f64,

    /// S4: Difficulty-weighted accuracy
    /// Rewards predictions on uncertain markets (near 50%)
    /// Penalizes predictions on near-certain markets
    pub s4_difficulty_weighted: f64,

    /// S5: Volume & consistency
    /// Quality-weighted volume (stake × uncertainty) + low CoV
    pub s5_volume_consistency: f64,

    /// S6: Cross-platform consistency (NEW in V2)
    /// Formula: min(platform_scores) / max(platform_scores)
    /// 1.0 = consistent across all platforms
    /// 0.0 = only performs well on one platform
    pub s6_cross_platform: f64,

    // --- CONFIDENCE WEIGHTING (Lesson #9: Bayesian Shrinkage) ---

    /// Total resolved events across ALL platforms
    /// Sum of polymarket_resolved + metaculus_resolved + kalshi_resolved + manifold_resolved
    pub total_resolved_events: u32,

    /// Confidence weight: N / (N + 100)
    /// 0.0 = no data (full shrinkage to prior)
    /// 1.0 = infinite data (no shrinkage)
    pub confidence_weight: f64,

    /// Raw composite score BEFORE confidence adjustment (0-1000)
    /// This is the weighted sum of S1-S6
    pub raw_composite_score: u16,

    /// Final composite score AFTER Bayesian shrinkage (0-1000)
    /// Formula: confidence × raw + (1 - confidence) × 500
    /// This is the official BeRight Score
    pub final_composite_score: u16,

    // --- ANTI-GAMING SIGNALS (Lesson #8) ---

    /// Market-maker / arbitrage ratio (Polymarket specific)
    /// Fraction of trades in extreme price bands (< 0.2 or > 0.8)
    /// High ratio (>0.7) suggests MM activity, not forecasting
    pub mm_arb_ratio: f64,

    /// Late entry ratio (across all platforms)
    /// Fraction of predictions made in last 10% of question duration
    /// High ratio suggests sniping resolved outcomes
    pub late_entry_ratio: f64,

    /// Average question difficulty (Metaculus specific)
    /// Mean community spread (std dev of all forecasts)
    /// Low difficulty (<0.2) suggests easy-question farming
    pub question_difficulty_avg: f64,

    // --- TIER & PERFORMANCE BOND ---

    /// Tier classification (1-5)
    /// Tier 1 (700+): Can create vaults
    /// Tier 2 (600-699): Can co-manage vaults
    /// Tier 3 (500-599): Verified skill
    /// Tier 4 (300-499): Average
    /// Tier 5 (<300): Unproven
    pub tier: u8,

    /// Staked SOL as performance bond (in lamports)
    /// Minimum 0.1 SOL (100M lamports) for scoring
    /// Minimum 1 SOL (1B lamports) for vault creation
    pub performance_bond_lamports: u64,

    /// Unix timestamp when bond can be withdrawn
    /// Cannot withdraw for 90 days after staking
    pub bond_locked_until: i64,

    // --- ZK PROOF & UPDATE TRACKING ---

    /// Hash of the ZK proof verifying score calculation
    /// Blake3 hash of Risc Zero or SP1 proof
    /// [0; 32] if no proof (off-chain trust model)
    pub proof_hash: [u8; 32],

    /// Slot number of last score update
    /// Used to track update frequency and staleness
    pub last_score_update_slot: u64,

    // --- FUTURE EXPANSION ---

    /// Reserved space for future fields (128 bytes)
    /// Doubled from V1 to accommodate:
    /// - New platforms (Zeitgeist, Gnosis, etc.)
    /// - New scoring components (S7, S8, ...)
    /// - Category-specific scores
    /// - Time-decay factors per category
    pub _reserved_v2: [u8; 128],
}

impl ForecasterState {
    /// Total account size in bytes
    ///
    /// NOTE: Actual size is 559 bytes due to Borsh Option packing
    /// Original estimate was 589 bytes, but Option types pack more efficiently
    ///
    /// Calculation breakdown:
    /// - Discriminator: 8 bytes
    /// - V1 fields: 222 bytes
    /// - V2 additions: ~329 bytes (Options pack smaller)
    /// - TOTAL: 559 bytes
    ///
    /// Rent: ~0.004 SOL (~$0.60 at $150/SOL)
    pub const LEN: usize =
        559;  // Actual size measured on-chain

    /*
    // Original calculation (kept for reference):
    pub const LEN_VERBOSE: usize =
        8 +   // discriminator

        // V1 fields (exact order from original)
        1 +   // bump
        32 +  // authority
        4 +   // total_predictions
        4 +   // resolved_predictions
        8 +   // cumulative_brier_score
        8 +   // avg_brier_score
        8 +   // cumulative_log_score
        8 +   // avg_log_score
        4 +   // correct_predictions
        8 +   // accuracy
        2 +   // markets_traded
        1 +   // best_category
        1 +   // worst_category
        2 +   // streak_correct
        2 +   // max_streak_correct
        8 +   // last_prediction_ts
        8 +   // created_at
        40 +  // calibration_buckets (10 * [u16; 2])
        1 +   // version
        64 +  // _reserved_v1

        // V2 additions
        9 +   // s1_trade_implied (Option<f64>)
        9 +   // s1_calibration_binned (Option<f64>)
        8 +   // s1_composite
        4 +   // polymarket_resolved_trades
        4 +   // metaculus_resolved_questions
        4 +   // kalshi_resolved_trades
        4 +   // manifold_resolved_questions
        3 +   // polymarket_composite (Option<u16>)
        3 +   // metaculus_composite (Option<u16>)
        3 +   // kalshi_composite (Option<u16>)
        3 +   // manifold_composite (Option<u16>)
        8 +   // s2_resolution
        9 +   // s3_economic_edge (Option<f64>)
        9 +   // s3_informational_edge (Option<f64>)
        8 +   // s3_composite
        8 +   // s4_difficulty_weighted
        8 +   // s5_volume_consistency
        8 +   // s6_cross_platform
        4 +   // total_resolved_events
        8 +   // confidence_weight
        2 +   // raw_composite_score
        2 +   // final_composite_score
        8 +   // mm_arb_ratio
        8 +   // late_entry_ratio
        8 +   // question_difficulty_avg
        1 +   // tier
        8 +   // performance_bond_lamports
        8 +   // bond_locked_until
        32 +  // proof_hash
        8 +   // last_score_update_slot
        128;  // _reserved_v2
    */

    /// Initialize a NEW V2 forecaster (not migrated from V1)
    ///
    /// Use this when creating a forecaster account from scratch.
    /// For V1 → V2 migration, use migrate_from_v1() instead.
    pub fn initialize_v2(&mut self, authority: Pubkey, bump: u8) -> Result<()> {
        let clock = Clock::get()?;

        // V1 fields (keep for backward compat, but mark as deprecated)
        self.bump = bump;
        self.authority = authority;
        self.total_predictions = 0;
        self.resolved_predictions = 0;
        self.cumulative_brier_score = 0.0;
        self.avg_brier_score = 0.0;
        self.cumulative_log_score = 0.0;
        self.avg_log_score = 0.0;
        self.correct_predictions = 0;
        self.accuracy = 0.0;
        self.markets_traded = 0;
        self.best_category = 0;
        self.worst_category = 0;
        self.streak_correct = 0;
        self.max_streak_correct = 0;
        self.last_prediction_ts = clock.unix_timestamp;
        self.created_at = clock.unix_timestamp;
        self.calibration_buckets = [[0, 0]; 10];
        self.version = 2;  // NEW accounts are V2
        self._reserved_v1 = [0; 64];

        // V2 fields (initialize to safe defaults)
        self.s1_trade_implied = None;
        self.s1_calibration_binned = None;
        self.s1_composite = 0.0;

        self.polymarket_resolved_trades = 0;
        self.metaculus_resolved_questions = 0;
        self.kalshi_resolved_trades = 0;
        self.manifold_resolved_questions = 0;

        self.polymarket_composite = None;
        self.metaculus_composite = None;
        self.kalshi_composite = None;
        self.manifold_composite = None;

        self.s2_resolution = 0.0;
        self.s3_economic_edge = None;
        self.s3_informational_edge = None;
        self.s3_composite = 0.0;
        self.s4_difficulty_weighted = 0.0;
        self.s5_volume_consistency = 0.0;
        self.s6_cross_platform = 0.0;

        self.total_resolved_events = 0;
        self.confidence_weight = 0.0;
        self.raw_composite_score = 500;  // Prior mean (assume average until proven)
        self.final_composite_score = 500;

        self.mm_arb_ratio = 0.0;
        self.late_entry_ratio = 0.0;
        self.question_difficulty_avg = 0.0;

        self.tier = 5;  // Unproven tier
        self.performance_bond_lamports = 0;
        self.bond_locked_until = 0;

        self.proof_hash = [0; 32];
        self.last_score_update_slot = clock.slot;

        self._reserved_v2 = [0; 128];

        Ok(())
    }

    /// Migrate existing V1 account to V2 schema
    ///
    /// CRITICAL: This modifies an existing account in-place using realloc.
    /// All V1 data is preserved. V2 fields are initialized to safe defaults.
    ///
    /// **Prerequisites**:
    /// - Account version must be 1
    /// - Account must have enough lamports for realloc
    /// - Calling transaction must be signed by authority
    ///
    /// **After migration**:
    /// - version field updated to 2
    /// - V1 fields unchanged
    /// - V2 fields initialized to 0/None
    /// - Off-chain service should recalculate scores from historical data
    pub fn migrate_from_v1(&mut self) -> Result<()> {
        // Safety check: only migrate from V1
        require!(self.version == 1, ErrorCode::InvalidVersion);

        let clock = Clock::get()?;

        // V1 fields are already set - DO NOT TOUCH THEM
        // Just initialize the NEW V2 fields

        self.s1_trade_implied = None;
        self.s1_calibration_binned = None;
        self.s1_composite = self.avg_brier_score;  // Carry over old Brier as initial S1

        self.polymarket_resolved_trades = 0;
        self.metaculus_resolved_questions = 0;
        self.kalshi_resolved_trades = 0;
        self.manifold_resolved_questions = 0;

        self.polymarket_composite = None;
        self.metaculus_composite = None;
        self.kalshi_composite = None;
        self.manifold_composite = None;

        self.s2_resolution = 0.0;
        self.s3_economic_edge = None;
        self.s3_informational_edge = None;
        self.s3_composite = 0.0;
        self.s4_difficulty_weighted = 0.0;
        self.s5_volume_consistency = 0.0;
        self.s6_cross_platform = 0.0;

        // Map old resolved_predictions to total_resolved_events
        self.total_resolved_events = self.resolved_predictions;

        // Calculate initial confidence weight
        self.confidence_weight = self.calculate_confidence_weight();

        // Map old avg_brier to raw_composite temporarily
        // Off-chain service will recalculate properly
        self.raw_composite_score = self.estimate_composite_from_v1();
        self.final_composite_score = self.apply_confidence_weighting();

        self.mm_arb_ratio = 0.0;
        self.late_entry_ratio = 0.0;
        self.question_difficulty_avg = 0.0;

        self.tier = self.calculate_tier();
        self.performance_bond_lamports = 0;
        self.bond_locked_until = 0;

        self.proof_hash = [0; 32];
        self.last_score_update_slot = clock.slot;

        self._reserved_v2 = [0; 128];

        // Mark as V2
        self.version = 2;

        msg!("Migrated forecaster {} from V1 to V2", self.authority);

        Ok(())
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    /// Calculate confidence weight using Bayesian shrinkage
    ///
    /// Formula: N / (N + 100)
    /// - 0 events → 0.0 (full shrinkage to prior mean of 500)
    /// - 100 events → 0.5 (half weight to data, half to prior)
    /// - 1000 events → 0.91 (mostly trust the data)
    ///
    /// The anchor of 100 was chosen empirically from Metaculus data.
    pub fn calculate_confidence_weight(&self) -> f64 {
        const ANCHOR: f64 = 100.0;
        let n = self.total_resolved_events as f64;
        n / (n + ANCHOR)
    }

    /// Apply confidence weighting to raw composite score
    ///
    /// Formula: confidence × raw + (1 - confidence) × prior_mean
    ///
    /// Example:
    /// - Adonis (1192 events, raw 752) → 0.923 × 752 + 0.077 × 500 = 732
    /// - Theo4 (22 events, raw 573) → 0.180 × 573 + 0.820 × 500 = 513
    pub fn apply_confidence_weighting(&self) -> u16 {
        const PRIOR_MEAN: f64 = 500.0;

        let confidence = self.confidence_weight;
        let raw = self.raw_composite_score as f64;

        let final_score = confidence * raw + (1.0 - confidence) * PRIOR_MEAN;

        final_score.round().min(1000.0).max(0.0) as u16
    }

    /// Calculate S6 cross-platform consistency
    ///
    /// Formula: min(active_platform_scores) / max(active_platform_scores)
    ///
    /// Requires at least 2 platforms with scores.
    /// Returns 0.0 if fewer than 2 platforms.
    ///
    /// Example:
    /// - Polymarket 720, Metaculus 750 → 720/750 = 0.96 (consistent)
    /// - Polymarket 200, Metaculus 750 → 200/750 = 0.27 (platform-specific)
    pub fn calculate_s6_cross_platform(&self) -> f64 {
        let mut scores: Vec<u16> = Vec::new();

        if let Some(s) = self.polymarket_composite {
            scores.push(s);
        }
        if let Some(s) = self.metaculus_composite {
            scores.push(s);
        }
        if let Some(s) = self.kalshi_composite {
            scores.push(s);
        }
        if let Some(s) = self.manifold_composite {
            scores.push(s);
        }

        if scores.len() < 2 {
            return 0.0;  // Need at least 2 platforms
        }

        let min = *scores.iter().min().unwrap() as f64;
        let max = *scores.iter().max().unwrap() as f64;

        if max == 0.0 {
            return 0.0;
        }

        min / max
    }

    /// Estimate composite score from V1 data (used during migration)
    ///
    /// This is a ROUGH estimate. Off-chain service should recalculate properly.
    ///
    /// Conversion heuristic:
    /// - Brier 0.15 (elite) → ~750
    /// - Brier 0.20 (good) → ~600
    /// - Brier 0.25 (random) → ~500
    /// - Brier 0.30 (poor) → ~400
    fn estimate_composite_from_v1(&self) -> u16 {
        let brier = self.avg_brier_score;

        // Invert Brier to score (lower Brier = higher score)
        // Formula: 1000 × (1 - brier / 0.5)
        let estimated = 1000.0 * (1.0 - (brier / 0.5));

        estimated.round().min(1000.0).max(0.0) as u16
    }

    /// Calculate tier from final composite score
    ///
    /// Tier thresholds:
    /// - Tier 1: 700+ (top 5%)
    /// - Tier 2: 600-699 (top 10%)
    /// - Tier 3: 500-599 (top 20%)
    /// - Tier 4: 300-499 (average)
    /// - Tier 5: <300 (unproven)
    pub fn calculate_tier(&self) -> u8 {
        match self.final_composite_score {
            700..=1000 => 1,
            600..=699 => 2,
            500..=599 => 3,
            300..=499 => 4,
            _ => 5,
        }
    }

    /// Check if forecaster is eligible to create a vault
    ///
    /// Requirements:
    /// - Tier 1 or 2 (score >= 600)
    /// - Performance bond staked (>= 1 SOL)
    /// - At least 50 resolved events
    /// - Active on at least 2 platforms (for cross-platform consistency)
    pub fn can_create_vault(&self) -> bool {
        self.tier <= 2 &&
        self.performance_bond_lamports >= 1_000_000_000 && // 1 SOL
        self.total_resolved_events >= 50 &&
        self.s6_cross_platform > 0.0  // Implies 2+ platforms
    }

    /// Get active platform count (for S6 calculation)
    pub fn active_platform_count(&self) -> u8 {
        let mut count = 0;
        if self.polymarket_composite.is_some() { count += 1; }
        if self.metaculus_composite.is_some() { count += 1; }
        if self.kalshi_composite.is_some() { count += 1; }
        if self.manifold_composite.is_some() { count += 1; }
        count
    }

    /// Check if account is MM/arb wallet (likely not a real forecaster)
    ///
    /// Heuristic: >70% of trades in extreme price bands (<0.2 or >0.8)
    /// Real forecasters trade in uncertain markets (0.3-0.7 range)
    pub fn is_likely_mm_wallet(&self) -> bool {
        self.mm_arb_ratio > 0.70
    }

    /// Check if forecaster is gaming via late entry
    ///
    /// Heuristic: >50% of predictions made in last 10% of question duration
    pub fn is_likely_late_entry_gamer(&self) -> bool {
        self.late_entry_ratio > 0.50
    }

    /// Check if forecaster is gaming via easy question selection
    ///
    /// Heuristic: average question difficulty < 0.2 (low community spread)
    pub fn is_likely_easy_question_farmer(&self) -> bool {
        self.question_difficulty_avg < 0.2 && self.metaculus_resolved_questions > 100
    }

    /// Detect any anti-gaming flags
    pub fn has_anti_gaming_flags(&self) -> bool {
        self.is_likely_mm_wallet() ||
        self.is_likely_late_entry_gamer() ||
        self.is_likely_easy_question_farmer()
    }

    // ========================================================================
    // BACKWARD COMPATIBILITY METHODS (for V1 instructions)
    // ========================================================================

    /// Initialize a forecaster (V1-compatible method)
    ///
    /// This method exists for backward compatibility with V1 instructions.
    /// New code should use initialize_v2() instead.
    pub fn initialize(&mut self, authority: Pubkey, bump: u8) -> Result<()> {
        // V1 instructions create V2 accounts by default
        self.initialize_v2(authority, bump)
    }

    /// Record a new prediction (V1-compatible method)
    ///
    /// This method exists for backward compatibility with V1 instructions.
    /// Updates only V1 fields, leaving V2 fields for off-chain recalculation.
    pub fn record_prediction(&mut self, timestamp: i64) -> Result<()> {
        self.total_predictions = self.total_predictions
            .checked_add(1)
            .ok_or(ProgramError::ArithmeticOverflow)?;
        self.last_prediction_ts = timestamp;

        Ok(())
    }

    /// Update stats after a prediction is resolved (V1-compatible method)
    ///
    /// This method exists for backward compatibility with V1 instructions.
    /// Updates V1 fields using original V1 logic.
    /// V2 scores should be recalculated off-chain from full cross-platform data.
    pub fn record_resolution(
        &mut self,
        predicted_probability: f64,
        outcome: bool,
    ) -> Result<()> {
        // Calculate Brier score: (p - o)^2
        let o = if outcome { 1.0 } else { 0.0 };
        let brier_score = (predicted_probability - o).powi(2);

        // Calculate log score
        let log_score = if outcome {
            (predicted_probability.max(0.0001)).log2() // Avoid log(0)
        } else {
            ((1.0 - predicted_probability).max(0.0001)).log2()
        };

        // Update cumulative scores (V1 fields)
        self.cumulative_brier_score += brier_score;
        self.cumulative_log_score += log_score;

        // Increment resolved count
        self.resolved_predictions = self.resolved_predictions
            .checked_add(1)
            .ok_or(ProgramError::ArithmeticOverflow)?;

        // Recalculate averages
        self.avg_brier_score = self.cumulative_brier_score / self.resolved_predictions as f64;
        self.avg_log_score = self.cumulative_log_score / self.resolved_predictions as f64;

        // Check if prediction was correct
        let predicted_yes = predicted_probability > 0.5;
        let is_correct = (predicted_yes && outcome) || (!predicted_yes && !outcome);

        if is_correct {
            self.correct_predictions = self.correct_predictions
                .checked_add(1)
                .ok_or(ProgramError::ArithmeticOverflow)?;
            self.streak_correct = self.streak_correct
                .checked_add(1)
                .ok_or(ProgramError::ArithmeticOverflow)?;

            if self.streak_correct > self.max_streak_correct {
                self.max_streak_correct = self.streak_correct;
            }
        } else {
            self.streak_correct = 0;
        }

        // Update simple accuracy
        self.accuracy = self.correct_predictions as f64 / self.resolved_predictions as f64;

        // Update calibration buckets
        let bucket_idx = ((predicted_probability * 10.0).floor() as usize).min(9);
        self.calibration_buckets[bucket_idx][0] = self.calibration_buckets[bucket_idx][0]
            .checked_add(1)
            .ok_or(ProgramError::ArithmeticOverflow)?;
        if outcome {
            self.calibration_buckets[bucket_idx][1] = self.calibration_buckets[bucket_idx][1]
                .checked_add(1)
                .ok_or(ProgramError::ArithmeticOverflow)?;
        }

        // Also update total_resolved_events (V2 field) to keep it in sync
        self.total_resolved_events = self.resolved_predictions;

        Ok(())
    }

    /// Get calibration curve data (V1-compatible method)
    ///
    /// Returns calibration curve data for analysis and visualization.
    /// This method is backward compatible with V1.
    pub fn get_calibration_curve(&self) -> Vec<(f64, f64, u16)> {
        self.calibration_buckets
            .iter()
            .enumerate()
            .map(|(i, &[count, sum_outcomes])| {
                let predicted_range = (i as f64 * 0.1, (i + 1) as f64 * 0.1);
                let avg_predicted = (predicted_range.0 + predicted_range.1) / 2.0;
                let actual_freq = if count > 0 {
                    sum_outcomes as f64 / count as f64
                } else {
                    0.0
                };
                (avg_predicted, actual_freq, count)
            })
            .collect()
    }
}

// ========================================================================
// ERROR CODES
// ========================================================================

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid version - expected V1 for migration")]
    InvalidVersion,

    #[msg("Insufficient performance bond - minimum 0.1 SOL required")]
    InsufficientBond,

    #[msg("Performance bond is still locked - cannot withdraw yet")]
    BondStillLocked,

    #[msg("Insufficient reputation - need Tier 3 or higher (score >= 500)")]
    InsufficientReputation,

    #[msg("Cross-platform requirement not met - need activity on 2+ platforms")]
    InsufficientCrossPlatform,

    #[msg("Anti-gaming flag detected - account flagged for review")]
    AntiGamingFlagged,
}
