import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: {
        code: 'LEGACY_SCORING_RETIRED',
        message: 'The legacy leaderboard has been retired. Build or read a Polymarket Passport instead.',
      },
    },
    { status: 410 },
  );
}
