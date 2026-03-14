/**
 * Tournament Detail API
 *
 * GET    /api/tournaments/[id]           → Get tournament details
 * POST   /api/tournaments/[id]           → Tournament actions (enter, activate, settle, cancel)
 * DELETE /api/tournaments/[id]           → Cancel tournament (forecaster only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTournamentService } from '@/lib/tournament';
import type { EnterTournamentRequest } from '@/types/forecaster';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = params;
    const service = getTournamentService();

    const tournament = await service.getTournament(id);

    if (!tournament) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      tournament,
    });
  } catch (error) {
    console.error('[Tournament API] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch tournament',
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = params;
    const body = await req.json();
    const action = body.action as string;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Missing action field' },
        { status: 400 }
      );
    }

    const service = getTournamentService();

    switch (action) {
      case 'enter': {
        // Enter tournament
        if (!body.participantPubkey || !body.amountUsd) {
          return NextResponse.json(
            { success: false, error: 'Missing participantPubkey or amountUsd' },
            { status: 400 }
          );
        }

        const request: EnterTournamentRequest = {
          tournamentId: id,
          participantPubkey: body.participantPubkey,
          amountUsd: body.amountUsd,
        };

        const result = await service.enterTournament(request);

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          participantId: result.participantId,
          lpTokensReceived: result.lpTokensReceived,
          entryPrice: result.entryPrice,
          txSignature: result.txSignature,
        });
      }

      case 'activate': {
        // Activate tournament (forecaster or cron)
        const result = await service.activateTournament(id);

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Tournament activated',
        });
      }

      case 'settle': {
        // Begin settlement
        const result = await service.beginSettlement(id);

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Settlement initiated',
        });
      }

      case 'complete': {
        // Complete settlement
        const result = await service.completeSettlement(id);

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Settlement completed',
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Tournament API] POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to perform action',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = params;
    const body = await req.json();

    if (!body.forecasterPubkey) {
      return NextResponse.json(
        { success: false, error: 'Missing forecasterPubkey' },
        { status: 400 }
      );
    }

    const service = getTournamentService();
    const result = await service.cancelTournament(id, body.forecasterPubkey);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Tournament cancelled',
    });
  } catch (error) {
    console.error('[Tournament API] DELETE error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel tournament',
      },
      { status: 500 }
    );
  }
}
