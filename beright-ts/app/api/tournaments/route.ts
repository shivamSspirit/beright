/**
 * Tournaments API
 *
 * GET  /api/tournaments              → List active tournaments
 * POST /api/tournaments              → Create new tournament
 *
 * Query params:
 * - category: politics|crypto|sports|macro|science|mixed
 * - status: upcoming|active|settling|settled
 * - forecaster: pubkey of forecaster
 * - limit: number (default 20)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTournamentService } from '@/lib/tournament';
import type { CreateTournamentRequest, Domain } from '@/types/forecaster';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') as Domain | 'mixed' | null;
    const status = searchParams.get('status');
    const forecasterPubkey = searchParams.get('forecaster');
    const participantPubkey = searchParams.get('participant');
    const limit = parseInt(searchParams.get('limit') || '20');

    const service = getTournamentService();

    // Get tournaments by forecaster
    if (forecasterPubkey) {
      const tournaments = await service.getForecasterTournaments(
        forecasterPubkey,
        status as any
      );
      return NextResponse.json({
        success: true,
        tournaments,
        total: tournaments.length,
      });
    }

    // Get tournaments by participant
    if (participantPubkey) {
      const tournaments = await service.getParticipantTournaments(participantPubkey);
      return NextResponse.json({
        success: true,
        tournaments,
        total: tournaments.length,
      });
    }

    // Get active tournaments (default)
    const tournaments = await service.getActiveTournaments(
      category || undefined,
      limit
    );

    return NextResponse.json({
      success: true,
      tournaments,
      total: tournaments.length,
      category: category || 'all',
    });
  } catch (error) {
    console.error('[Tournaments API] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch tournaments',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();

    // Validate required fields
    const requiredFields = [
      'forecasterPubkey',
      'name',
      'category',
      'minDepositUsd',
      'entryDeadline',
      'startsAt',
      'endsAt',
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          {
            success: false,
            error: `Missing required field: ${field}`,
          },
          { status: 400 }
        );
      }
    }

    // Validate dates
    const entryDeadline = new Date(body.entryDeadline);
    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    const now = new Date();

    if (entryDeadline <= now) {
      return NextResponse.json(
        { success: false, error: 'Entry deadline must be in the future' },
        { status: 400 }
      );
    }

    if (startsAt <= entryDeadline) {
      return NextResponse.json(
        { success: false, error: 'Start time must be after entry deadline' },
        { status: 400 }
      );
    }

    if (endsAt <= startsAt) {
      return NextResponse.json(
        { success: false, error: 'End time must be after start time' },
        { status: 400 }
      );
    }

    const request: CreateTournamentRequest = {
      forecasterPubkey: body.forecasterPubkey,
      name: body.name,
      description: body.description,
      category: body.category,
      targetMarkets: body.targetMarkets,
      minDepositUsd: body.minDepositUsd,
      maxDepositUsd: body.maxDepositUsd,
      maxParticipants: body.maxParticipants,
      entryDeadline: body.entryDeadline,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      entryFeeBps: body.entryFeeBps,
      performanceFeeBps: body.performanceFeeBps,
    };

    const service = getTournamentService();
    const result = await service.createTournament(request);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      tournament: result.tournament,
      txSignature: result.txSignature,
    });
  } catch (error) {
    console.error('[Tournaments API] POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create tournament',
      },
      { status: 500 }
    );
  }
}
