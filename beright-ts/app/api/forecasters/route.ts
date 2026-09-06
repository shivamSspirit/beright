import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: {
        code: 'LEGACY_SCORING_RETIRED',
        message: 'The legacy forecaster ranking API has been retired. Use Passport v2 resources.',
      },
    },
    { status: 410 },
  );
}
