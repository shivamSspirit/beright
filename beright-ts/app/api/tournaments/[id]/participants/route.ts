/**
 * Tournament Participants API
 *
 * GET /api/tournaments/[id]/participants → Get tournament leaderboard/participants
 *
 * Query params:
 * - sortBy: rank|pnl|deposited (default: rank)
 * - limit: number (default 50)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { TournamentParticipant } from '@/types/forecaster';

interface RouteParams {
  params: {
    id: string;
  };
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(url, key);
}

export async function GET(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const sortBy = searchParams.get('sortBy') || 'rank';
    const limit = parseInt(searchParams.get('limit') || '50');

    const supabase = getSupabase();

    // Determine sort column and order
    let orderColumn = 'rank';
    let ascending = true;

    switch (sortBy) {
      case 'pnl':
        orderColumn = 'pnl_usd';
        ascending = false;
        break;
      case 'deposited':
        orderColumn = 'deposited_usd';
        ascending = false;
        break;
      case 'share':
        orderColumn = 'share_percent';
        ascending = false;
        break;
      default:
        orderColumn = 'rank';
        ascending = true;
    }

    // Fetch participants
    const { data, error, count } = await supabase
      .from('tournament_participants')
      .select('*', { count: 'exact' })
      .eq('tournament_id', id)
      .order(orderColumn, { ascending, nullsFirst: false })
      .limit(limit);

    if (error) {
      console.error('[Participants API] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Map to response format
    const participants: TournamentParticipant[] = (data || []).map((row: any) => ({
      id: row.id,
      tournamentId: row.tournament_id,
      participantPubkey: row.participant_pubkey,
      lpTokenBalance: row.lp_token_balance,
      depositedUsd: row.deposited_usd,
      currentValueUsd: row.current_value_usd,
      sharePercent: row.share_percent,
      entryPrice: row.entry_price,
      depositedAt: row.deposited_at,
      rank: row.rank,
      pnlUsd: row.pnl_usd,
      pnlPercent: row.pnl_percent,
      withdrawRequestedAt: row.withdraw_requested_at,
      withdrawableAt: row.withdrawable_at,
      claimed: row.claimed,
      claimedAmountUsd: row.claimed_amount_usd,
      claimedAt: row.claimed_at,
    }));

    // Calculate tournament stats
    const totalDeposited = participants.reduce((sum, p) => sum + p.depositedUsd, 0);
    const totalValue = participants.reduce((sum, p) => sum + (p.currentValueUsd || 0), 0);
    const totalPnl = participants.reduce((sum, p) => sum + (p.pnlUsd || 0), 0);

    return NextResponse.json({
      success: true,
      participants,
      total: count || participants.length,
      stats: {
        participantCount: participants.length,
        totalDeposited,
        totalValue,
        totalPnl,
        avgPnlPercent: participants.length > 0
          ? participants.reduce((sum, p) => sum + (p.pnlPercent || 0), 0) / participants.length
          : 0,
      },
    });
  } catch (error) {
    console.error('[Participants API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch participants',
      },
      { status: 500 }
    );
  }
}
