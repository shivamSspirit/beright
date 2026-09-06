import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function retired(): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: 'LEGACY_SCORING_RETIRED',
        message: 'The calibration/V3 reputation API has been retired. Polymarket Passport v1 is the active reputation path.',
      },
    },
    { status: 410 },
  );
}

export async function GET(): Promise<NextResponse> {
  return retired();
}

export async function POST(): Promise<NextResponse> {
  return retired();
}
