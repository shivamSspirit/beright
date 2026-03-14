/**
 * BeRight Tournament Service
 *
 * Manages tournament lifecycle for forecaster prediction competitions.
 *
 * Tournaments use Meteora DAMM v2 pools for:
 * - Trustless entry/exit via LP tokens
 * - Built-in fee handling
 * - On-chain settlement
 *
 * Idle capital routes to Sanctum INF for yield.
 *
 * Lifecycle:
 * 1. draft -> upcoming: Tournament created, accepting entries
 * 2. upcoming -> active: Entry deadline passed, predictions begin
 * 3. active -> settling: End time reached, closing positions
 * 4. settling -> settled: Profits distributed, LP tokens redeemable
 *
 * @author BeRight Protocol
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PublicKey, Connection, Transaction } from '@solana/web3.js';
import type {
  TournamentPool,
  TournamentParticipant,
  TournamentStatus,
  CreateTournamentRequest,
  EnterTournamentRequest,
  EnterTournamentResponse,
  Domain,
  PredictionRecord,
} from '@/types/forecaster';

// =============================================================================
// TYPES
// =============================================================================

interface TournamentCreateResult {
  success: boolean;
  tournament?: TournamentPool;
  error?: string;
  txSignature?: string;
}

interface TournamentActionResult {
  success: boolean;
  error?: string;
  txSignature?: string;
}

interface TournamentPerformance {
  navPerShare: number;
  cumulativePnlUsd: number;
  predictionsMade: number;
  predictionsResolved: number;
  winRate: number;
  avgReturnPct: number;
  sharpeRatio: number | null;
  maxDrawdown: number;
  currentDrawdown: number;
}

// =============================================================================
// TOURNAMENT SERVICE
// =============================================================================

export class TournamentService {
  private supabase: SupabaseClient;
  private connection: Connection;

  constructor(supabaseUrl: string, supabaseKey: string, rpcUrl: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  // ===========================================================================
  // TOURNAMENT CREATION
  // ===========================================================================

  /**
   * Create a new tournament
   *
   * Steps:
   * 1. Verify forecaster eligibility
   * 2. Create Meteora DAMM v2 pool
   * 3. Store tournament metadata in Supabase
   */
  async createTournament(
    request: CreateTournamentRequest
  ): Promise<TournamentCreateResult> {
    try {
      // Verify forecaster exists and can create tournaments
      const { data: forecaster, error: forecasterError } = await this.supabase
        .from('forecaster_profiles')
        .select('*')
        .eq('pubkey', request.forecasterPubkey)
        .single();

      if (forecasterError || !forecaster) {
        return {
          success: false,
          error: 'Forecaster not found',
        };
      }

      if (!forecaster.can_create_tournament) {
        return {
          success: false,
          error: 'Forecaster not eligible to create tournaments. Requires verified tier or above.',
        };
      }

      // Generate tournament ID
      const tournamentId = crypto.randomUUID();

      // Create Meteora DAMM v2 pool (placeholder - actual implementation uses Meteora SDK)
      const meteoraResult = await this.createMeteoraPool(request);
      if (!meteoraResult.success) {
        return {
          success: false,
          error: `Failed to create Meteora pool: ${meteoraResult.error}`,
        };
      }

      // Store tournament in database
      const tournament: Partial<TournamentPool> = {
        id: tournamentId,
        pubkey: meteoraResult.poolAddress!,
        name: request.name,
        description: request.description || null,
        forecasterPubkey: request.forecasterPubkey,
        meteora: {
          poolAddress: meteoraResult.poolAddress!,
          lpMint: meteoraResult.lpMint!,
          tokenAMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
          tokenBMint: forecaster.token_mint || 'So11111111111111111111111111111111111111112',
          feeRate: 30,
          binStep: 10,
          baseFactor: 10000,
          activationType: 'timestamp',
          activationPoint: new Date(request.startsAt).getTime() / 1000,
        },
        rules: {
          category: request.category,
          targetMarkets: request.targetMarkets || [],
          minPredictions: 5,
          maxLeverage: 10,
          allowedPlatforms: ['polymarket', 'kalshi', 'jupiter', 'dflow', 'manifold', 'limitless'],
        },
        entry: {
          minDepositUsd: request.minDepositUsd,
          maxDepositUsd: request.maxDepositUsd || null,
          maxParticipants: request.maxParticipants || null,
          maxTvlUsd: null,
          entryDeadline: request.entryDeadline,
        },
        fees: {
          entryFeeBps: request.entryFeeBps || 50,
          managementFeeBps: 200,
          performanceFeeBps: request.performanceFeeBps || 2000,
          hurdleRateBps: null,
        },
        feeSplit: {
          forecasterBps: 2000,
          platformBps: 1600,
          participantsBps: 6400,
        },
        status: 'upcoming',
        allocation: {
          totalValueUsd: 0,
          activePositions: 0,
          sanctumYield: 0,
          liquidReserve: 0,
        },
        sanctum: null,
        performance: {
          navPerShare: 1,
          cumulativePnlUsd: 0,
          predictionsMade: 0,
          predictionsResolved: 0,
          winRate: 0,
          avgReturnPct: 0,
          sharpeRatio: null,
          maxDrawdown: 0,
          currentDrawdown: 0,
        },
        participantCount: 0,
        totalLpTokens: '0',
        leaderboard: [],
        createdAt: new Date().toISOString(),
        startsAt: request.startsAt,
        endsAt: request.endsAt,
        settlesAt: request.endsAt, // Same as end for now
        settledAt: null,
      };

      const { error: insertError } = await this.supabase
        .from('tournament_pools')
        .insert(this.mapTournamentToDb(tournament));

      if (insertError) {
        return {
          success: false,
          error: `Failed to store tournament: ${insertError.message}`,
        };
      }

      // Update forecaster tournament count
      await this.supabase
        .from('forecaster_profiles')
        .update({
          total_tournaments_created: forecaster.total_tournaments_created + 1,
          active_tournament_count: forecaster.active_tournament_count + 1,
        })
        .eq('pubkey', request.forecasterPubkey);

      return {
        success: true,
        tournament: tournament as TournamentPool,
        txSignature: meteoraResult.txSignature,
      };
    } catch (error) {
      console.error('[TournamentService] Create error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create Meteora DAMM v2 pool (placeholder)
   */
  private async createMeteoraPool(
    request: CreateTournamentRequest
  ): Promise<{
    success: boolean;
    poolAddress?: string;
    lpMint?: string;
    txSignature?: string;
    error?: string;
  }> {
    // TODO: Implement actual Meteora SDK integration
    // For now, return mock data
    console.log('[TournamentService] Creating Meteora DAMM v2 pool (mock)');

    return {
      success: true,
      poolAddress: `pool_${Date.now()}`,
      lpMint: `lp_${Date.now()}`,
      txSignature: `sig_${Date.now()}`,
    };
  }

  // ===========================================================================
  // TOURNAMENT ENTRY
  // ===========================================================================

  /**
   * Enter a tournament
   */
  async enterTournament(
    request: EnterTournamentRequest
  ): Promise<EnterTournamentResponse & { success: boolean; error?: string }> {
    try {
      // Get tournament
      const { data: tournament, error: tournamentError } = await this.supabase
        .from('tournament_pools')
        .select('*')
        .eq('id', request.tournamentId)
        .single();

      if (tournamentError || !tournament) {
        return {
          success: false,
          error: 'Tournament not found',
          participantId: '',
          lpTokensReceived: '0',
          entryPrice: 0,
          txSignature: '',
        };
      }

      // Check tournament status
      if (tournament.status !== 'upcoming') {
        return {
          success: false,
          error: `Tournament is ${tournament.status}, not accepting entries`,
          participantId: '',
          lpTokensReceived: '0',
          entryPrice: 0,
          txSignature: '',
        };
      }

      // Check entry deadline
      if (new Date(tournament.entry_deadline) < new Date()) {
        return {
          success: false,
          error: 'Entry deadline has passed',
          participantId: '',
          lpTokensReceived: '0',
          entryPrice: 0,
          txSignature: '',
        };
      }

      // Check deposit limits
      if (request.amountUsd < tournament.min_deposit_usd) {
        return {
          success: false,
          error: `Minimum deposit is $${tournament.min_deposit_usd}`,
          participantId: '',
          lpTokensReceived: '0',
          entryPrice: 0,
          txSignature: '',
        };
      }

      if (tournament.max_deposit_usd && request.amountUsd > tournament.max_deposit_usd) {
        return {
          success: false,
          error: `Maximum deposit is $${tournament.max_deposit_usd}`,
          participantId: '',
          lpTokensReceived: '0',
          entryPrice: 0,
          txSignature: '',
        };
      }

      // Check max participants
      if (tournament.max_participants && tournament.participant_count >= tournament.max_participants) {
        return {
          success: false,
          error: 'Tournament is full',
          participantId: '',
          lpTokensReceived: '0',
          entryPrice: 0,
          txSignature: '',
        };
      }

      // Calculate entry fee
      const entryFee = (request.amountUsd * tournament.entry_fee_bps) / 10000;
      const netDeposit = request.amountUsd - entryFee;

      // Calculate LP tokens (based on current NAV)
      const navPerShare = tournament.nav_per_share || 1;
      const lpTokens = Math.floor((netDeposit / navPerShare) * 1e6); // 6 decimals

      // Create participant record
      const participantId = crypto.randomUUID();
      const participant: Partial<TournamentParticipant> = {
        id: participantId,
        tournamentId: request.tournamentId,
        participantPubkey: request.participantPubkey,
        lpTokenBalance: lpTokens.toString(),
        depositedUsd: request.amountUsd,
        currentValueUsd: netDeposit,
        sharePercent: 0, // Will be calculated
        entryPrice: navPerShare,
        depositedAt: new Date().toISOString(),
        rank: 0,
        pnlUsd: 0,
        pnlPercent: 0,
        withdrawRequestedAt: null,
        withdrawableAt: null,
        claimed: false,
        claimedAmountUsd: null,
        claimedAt: null,
      };

      // Execute on-chain deposit (placeholder)
      const txSignature = await this.executeDeposit(
        tournament.pubkey,
        request.participantPubkey,
        request.amountUsd
      );

      // Insert participant
      const { error: insertError } = await this.supabase
        .from('tournament_participants')
        .insert({
          id: participant.id,
          tournament_id: participant.tournamentId,
          participant_pubkey: participant.participantPubkey,
          lp_token_balance: participant.lpTokenBalance,
          deposited_usd: participant.depositedUsd,
          current_value_usd: participant.currentValueUsd,
          entry_price: participant.entryPrice,
          deposited_at: participant.depositedAt,
        });

      if (insertError) {
        return {
          success: false,
          error: `Failed to store participant: ${insertError.message}`,
          participantId: '',
          lpTokensReceived: '0',
          entryPrice: 0,
          txSignature: '',
        };
      }

      // Update tournament totals
      const newTotalValue = tournament.total_value_usd + netDeposit;
      const newTotalLpTokens = BigInt(tournament.total_lp_tokens || '0') + BigInt(lpTokens);

      await this.supabase
        .from('tournament_pools')
        .update({
          total_value_usd: newTotalValue,
          total_lp_tokens: newTotalLpTokens.toString(),
          participant_count: tournament.participant_count + 1,
          liquid_reserve: (tournament.liquid_reserve || 0) + netDeposit,
        })
        .eq('id', request.tournamentId);

      // Update share percentages for all participants
      await this.updateSharePercentages(request.tournamentId);

      return {
        success: true,
        participantId,
        lpTokensReceived: lpTokens.toString(),
        entryPrice: navPerShare,
        txSignature,
      };
    } catch (error) {
      console.error('[TournamentService] Enter error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        participantId: '',
        lpTokensReceived: '0',
        entryPrice: 0,
        txSignature: '',
      };
    }
  }

  /**
   * Execute on-chain deposit (placeholder)
   */
  private async executeDeposit(
    poolAddress: string,
    participantPubkey: string,
    amountUsd: number
  ): Promise<string> {
    // TODO: Implement actual Meteora deposit
    console.log('[TournamentService] Executing deposit (mock):', {
      poolAddress,
      participantPubkey,
      amountUsd,
    });
    return `deposit_sig_${Date.now()}`;
  }

  // ===========================================================================
  // LIFECYCLE MANAGEMENT
  // ===========================================================================

  /**
   * Activate tournament (draft -> upcoming -> active)
   */
  async activateTournament(tournamentId: string): Promise<TournamentActionResult> {
    try {
      const { data: tournament, error } = await this.supabase
        .from('tournament_pools')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (error || !tournament) {
        return { success: false, error: 'Tournament not found' };
      }

      if (tournament.status !== 'upcoming') {
        return { success: false, error: `Cannot activate tournament in ${tournament.status} status` };
      }

      const now = new Date();
      if (new Date(tournament.starts_at) > now) {
        return { success: false, error: 'Tournament start time not reached' };
      }

      await this.supabase
        .from('tournament_pools')
        .update({ status: 'active' })
        .eq('id', tournamentId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Begin settlement (active -> settling)
   */
  async beginSettlement(tournamentId: string): Promise<TournamentActionResult> {
    try {
      const { data: tournament, error } = await this.supabase
        .from('tournament_pools')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (error || !tournament) {
        return { success: false, error: 'Tournament not found' };
      }

      if (tournament.status !== 'active') {
        return { success: false, error: `Cannot settle tournament in ${tournament.status} status` };
      }

      // Mark as settling
      await this.supabase
        .from('tournament_pools')
        .update({ status: 'settling' })
        .eq('id', tournamentId);

      // TODO: Close all open positions
      // TODO: Harvest Sanctum yield

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Complete settlement (settling -> settled)
   */
  async completeSettlement(tournamentId: string): Promise<TournamentActionResult> {
    try {
      const { data: tournament, error } = await this.supabase
        .from('tournament_pools')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (error || !tournament) {
        return { success: false, error: 'Tournament not found' };
      }

      if (tournament.status !== 'settling') {
        return { success: false, error: `Cannot complete settlement in ${tournament.status} status` };
      }

      // Calculate final performance
      const performance = await this.calculatePerformance(tournamentId);

      // Calculate fees
      const profit = performance.cumulativePnlUsd;
      let performanceFee = 0;
      if (profit > 0) {
        performanceFee = (profit * tournament.performance_fee_bps) / 10000;
      }

      // Distribute fees
      const forecasterFee = (performanceFee * tournament.forecaster_fee_split_bps) / 10000;
      const platformFee = (performanceFee * tournament.platform_fee_split_bps) / 10000;

      // Update tournament
      await this.supabase
        .from('tournament_pools')
        .update({
          status: 'settled',
          settled_at: new Date().toISOString(),
          nav_per_share: performance.navPerShare,
          cumulative_pnl_usd: performance.cumulativePnlUsd,
          win_rate: performance.winRate,
          avg_return_pct: performance.avgReturnPct,
          sharpe_ratio: performance.sharpeRatio,
        })
        .eq('id', tournamentId);

      // Update participant values and ranks
      await this.updateParticipantValues(tournamentId, performance.navPerShare);

      // Update forecaster stats
      await this.supabase
        .from('forecaster_profiles')
        .update({
          active_tournament_count: tournament.forecaster_pubkey ?
            (await this.getActiveCount(tournament.forecaster_pubkey)) : 0,
          total_fees_earned_usd: forecasterFee,
        })
        .eq('pubkey', tournament.forecaster_pubkey);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Cancel tournament
   */
  async cancelTournament(
    tournamentId: string,
    forecasterPubkey: string
  ): Promise<TournamentActionResult> {
    try {
      const { data: tournament, error } = await this.supabase
        .from('tournament_pools')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (error || !tournament) {
        return { success: false, error: 'Tournament not found' };
      }

      if (tournament.forecaster_pubkey !== forecasterPubkey) {
        return { success: false, error: 'Only forecaster can cancel tournament' };
      }

      if (tournament.status === 'settled' || tournament.status === 'cancelled') {
        return { success: false, error: 'Tournament already finalized' };
      }

      // Mark as cancelled
      await this.supabase
        .from('tournament_pools')
        .update({ status: 'cancelled' })
        .eq('id', tournamentId);

      // Mark all participants as withdrawable
      await this.supabase
        .from('tournament_participants')
        .update({
          withdrawable_at: new Date().toISOString(),
        })
        .eq('tournament_id', tournamentId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Update share percentages for all participants
   */
  private async updateSharePercentages(tournamentId: string): Promise<void> {
    const { data: participants } = await this.supabase
      .from('tournament_participants')
      .select('id, lp_token_balance')
      .eq('tournament_id', tournamentId);

    if (!participants || participants.length === 0) return;

    const totalLpTokens = participants.reduce(
      (sum, p) => sum + BigInt(p.lp_token_balance || '0'),
      BigInt(0)
    );

    for (const participant of participants) {
      const share =
        totalLpTokens > 0
          ? (Number(BigInt(participant.lp_token_balance || '0') * BigInt(10000)) /
              Number(totalLpTokens)) /
            100
          : 0;

      await this.supabase
        .from('tournament_participants')
        .update({ share_percent: share })
        .eq('id', participant.id);
    }
  }

  /**
   * Update participant values based on new NAV
   */
  private async updateParticipantValues(
    tournamentId: string,
    navPerShare: number
  ): Promise<void> {
    const { data: participants } = await this.supabase
      .from('tournament_participants')
      .select('*')
      .eq('tournament_id', tournamentId);

    if (!participants) return;

    // Sort by P&L for ranking
    const sorted = [...participants].sort((a, b) => {
      const pnlA = a.current_value_usd - a.deposited_usd;
      const pnlB = b.current_value_usd - b.deposited_usd;
      return pnlB - pnlA;
    });

    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const lpTokens = BigInt(p.lp_token_balance || '0');
      const currentValue = (Number(lpTokens) / 1e6) * navPerShare;
      const pnlUsd = currentValue - p.deposited_usd;
      const pnlPercent = p.deposited_usd > 0 ? (pnlUsd / p.deposited_usd) * 100 : 0;

      await this.supabase
        .from('tournament_participants')
        .update({
          current_value_usd: currentValue,
          pnl_usd: pnlUsd,
          pnl_percent: pnlPercent,
          rank: i + 1,
        })
        .eq('id', p.id);
    }
  }

  /**
   * Calculate tournament performance
   */
  private async calculatePerformance(tournamentId: string): Promise<TournamentPerformance> {
    // Get all predictions for this tournament
    const { data: predictions } = await this.supabase
      .from('predictions')
      .select('*')
      .eq('tournament_id', tournamentId);

    if (!predictions || predictions.length === 0) {
      return {
        navPerShare: 1,
        cumulativePnlUsd: 0,
        predictionsMade: 0,
        predictionsResolved: 0,
        winRate: 0,
        avgReturnPct: 0,
        sharpeRatio: null,
        maxDrawdown: 0,
        currentDrawdown: 0,
      };
    }

    const resolved = predictions.filter((p) => p.outcome !== null);
    const correct = resolved.filter((p) => {
      const isCorrect =
        (p.direction === 'YES' && p.outcome === true) ||
        (p.direction === 'NO' && p.outcome === false);
      return isCorrect;
    });

    const totalPnl = predictions.reduce((sum, p) => sum + (p.pnl_usd || 0), 0);

    // Get tournament for TVL
    const { data: tournament } = await this.supabase
      .from('tournament_pools')
      .select('total_value_usd')
      .eq('id', tournamentId)
      .single();

    const totalValue = tournament?.total_value_usd || 1;
    const navPerShare = 1 + totalPnl / totalValue;

    const avgReturn = predictions.length > 0 ? totalPnl / predictions.length : 0;

    return {
      navPerShare,
      cumulativePnlUsd: totalPnl,
      predictionsMade: predictions.length,
      predictionsResolved: resolved.length,
      winRate: resolved.length > 0 ? correct.length / resolved.length : 0,
      avgReturnPct: avgReturn,
      sharpeRatio: null, // TODO: Calculate with variance
      maxDrawdown: 0, // TODO: Track drawdown over time
      currentDrawdown: 0,
    };
  }

  /**
   * Get active tournament count for forecaster
   */
  private async getActiveCount(forecasterPubkey: string): Promise<number> {
    const { count } = await this.supabase
      .from('tournament_pools')
      .select('*', { count: 'exact', head: true })
      .eq('forecaster_pubkey', forecasterPubkey)
      .in('status', ['upcoming', 'active']);

    return count || 0;
  }

  /**
   * Map tournament object to database format
   */
  private mapTournamentToDb(tournament: Partial<TournamentPool>): Record<string, any> {
    return {
      id: tournament.id,
      pubkey: tournament.pubkey,
      name: tournament.name,
      description: tournament.description,
      forecaster_pubkey: tournament.forecasterPubkey,
      lp_mint: tournament.meteora?.lpMint,
      token_a_mint: tournament.meteora?.tokenAMint,
      token_b_mint: tournament.meteora?.tokenBMint,
      fee_rate: tournament.meteora?.feeRate,
      bin_step: tournament.meteora?.binStep,
      base_factor: tournament.meteora?.baseFactor,
      activation_type: tournament.meteora?.activationType,
      activation_point: tournament.meteora?.activationPoint,
      category: tournament.rules?.category,
      target_markets: tournament.rules?.targetMarkets,
      min_predictions: tournament.rules?.minPredictions,
      max_leverage: tournament.rules?.maxLeverage,
      allowed_platforms: tournament.rules?.allowedPlatforms,
      min_deposit_usd: tournament.entry?.minDepositUsd,
      max_deposit_usd: tournament.entry?.maxDepositUsd,
      max_participants: tournament.entry?.maxParticipants,
      entry_deadline: tournament.entry?.entryDeadline,
      entry_fee_bps: tournament.fees?.entryFeeBps,
      management_fee_bps: tournament.fees?.managementFeeBps,
      performance_fee_bps: tournament.fees?.performanceFeeBps,
      hurdle_rate_bps: tournament.fees?.hurdleRateBps,
      forecaster_fee_split_bps: tournament.feeSplit?.forecasterBps,
      platform_fee_split_bps: tournament.feeSplit?.platformBps,
      participants_fee_split_bps: tournament.feeSplit?.participantsBps,
      status: tournament.status,
      total_value_usd: tournament.allocation?.totalValueUsd,
      active_positions: tournament.allocation?.activePositions,
      sanctum_yield: tournament.allocation?.sanctumYield,
      liquid_reserve: tournament.allocation?.liquidReserve,
      nav_per_share: tournament.performance?.navPerShare,
      cumulative_pnl_usd: tournament.performance?.cumulativePnlUsd,
      predictions_made: tournament.performance?.predictionsMade,
      predictions_resolved: tournament.performance?.predictionsResolved,
      win_rate: tournament.performance?.winRate,
      avg_return_pct: tournament.performance?.avgReturnPct,
      sharpe_ratio: tournament.performance?.sharpeRatio,
      max_drawdown: tournament.performance?.maxDrawdown,
      current_drawdown: tournament.performance?.currentDrawdown,
      participant_count: tournament.participantCount,
      total_lp_tokens: tournament.totalLpTokens,
      created_at: tournament.createdAt,
      starts_at: tournament.startsAt,
      ends_at: tournament.endsAt,
      settles_at: tournament.settlesAt,
      settled_at: tournament.settledAt,
    };
  }

  // ===========================================================================
  // QUERIES
  // ===========================================================================

  /**
   * Get tournament by ID
   */
  async getTournament(tournamentId: string): Promise<TournamentPool | null> {
    const { data, error } = await this.supabase
      .from('tournament_pools')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (error || !data) return null;
    return this.mapDbToTournament(data);
  }

  /**
   * Get tournaments for a forecaster
   */
  async getForecasterTournaments(
    forecasterPubkey: string,
    status?: TournamentStatus
  ): Promise<TournamentPool[]> {
    let query = this.supabase
      .from('tournament_pools')
      .select('*')
      .eq('forecaster_pubkey', forecasterPubkey)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((row) => this.mapDbToTournament(row));
  }

  /**
   * Get active tournaments
   */
  async getActiveTournaments(
    category?: Domain | 'mixed',
    limit: number = 20
  ): Promise<TournamentPool[]> {
    let query = this.supabase
      .from('tournament_pools')
      .select('*')
      .in('status', ['upcoming', 'active'])
      .order('total_value_usd', { ascending: false })
      .limit(limit);

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((row) => this.mapDbToTournament(row));
  }

  /**
   * Get participant's tournaments
   */
  async getParticipantTournaments(
    participantPubkey: string
  ): Promise<TournamentPool[]> {
    const { data: participations, error: participationsError } = await this.supabase
      .from('tournament_participants')
      .select('tournament_id')
      .eq('participant_pubkey', participantPubkey);

    if (participationsError || !participations) return [];

    const tournamentIds = participations.map((p) => p.tournament_id);
    if (tournamentIds.length === 0) return [];

    const { data, error } = await this.supabase
      .from('tournament_pools')
      .select('*')
      .in('id', tournamentIds)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((row) => this.mapDbToTournament(row));
  }

  /**
   * Map database row to TournamentPool
   */
  private mapDbToTournament(row: any): TournamentPool {
    return {
      id: row.id,
      pubkey: row.pubkey,
      name: row.name,
      description: row.description,
      imageUrl: row.image_url,
      forecasterPubkey: row.forecaster_pubkey,
      forecasterProfile: null,
      forecasterToken: null,
      meteora: {
        poolAddress: row.pubkey,
        lpMint: row.lp_mint,
        tokenAMint: row.token_a_mint,
        tokenBMint: row.token_b_mint,
        feeRate: row.fee_rate,
        binStep: row.bin_step,
        baseFactor: row.base_factor,
        activationType: row.activation_type,
        activationPoint: row.activation_point,
      },
      rules: {
        category: row.category,
        targetMarkets: row.target_markets || [],
        minPredictions: row.min_predictions,
        maxLeverage: row.max_leverage,
        allowedPlatforms: row.allowed_platforms || [],
      },
      entry: {
        minDepositUsd: row.min_deposit_usd,
        maxDepositUsd: row.max_deposit_usd,
        maxParticipants: row.max_participants,
        maxTvlUsd: row.max_tvl_usd,
        entryDeadline: row.entry_deadline,
      },
      fees: {
        entryFeeBps: row.entry_fee_bps,
        managementFeeBps: row.management_fee_bps,
        performanceFeeBps: row.performance_fee_bps,
        hurdleRateBps: row.hurdle_rate_bps,
      },
      feeSplit: {
        forecasterBps: row.forecaster_fee_split_bps,
        platformBps: row.platform_fee_split_bps,
        participantsBps: row.participants_fee_split_bps,
      },
      status: row.status,
      allocation: {
        totalValueUsd: row.total_value_usd,
        activePositions: row.active_positions,
        sanctumYield: row.sanctum_yield,
        liquidReserve: row.liquid_reserve,
      },
      sanctum: row.inf_balance
        ? {
            infBalance: row.inf_balance,
            infValueUsd: row.inf_value_usd,
            yieldEarned: row.yield_earned,
            lastHarvest: row.last_harvest,
          }
        : null,
      performance: {
        navPerShare: row.nav_per_share,
        cumulativePnlUsd: row.cumulative_pnl_usd,
        predictionsMade: row.predictions_made,
        predictionsResolved: row.predictions_resolved,
        winRate: row.win_rate,
        avgReturnPct: row.avg_return_pct,
        sharpeRatio: row.sharpe_ratio,
        maxDrawdown: row.max_drawdown,
        currentDrawdown: row.current_drawdown,
      },
      participantCount: row.participant_count,
      totalLpTokens: row.total_lp_tokens,
      leaderboard: [],
      createdAt: row.created_at,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      settlesAt: row.settles_at,
      settledAt: row.settled_at,
    };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let instance: TournamentService | null = null;

export function getTournamentService(): TournamentService {
  if (!instance) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    instance = new TournamentService(supabaseUrl, supabaseKey, rpcUrl);
  }

  return instance;
}

export default TournamentService;
