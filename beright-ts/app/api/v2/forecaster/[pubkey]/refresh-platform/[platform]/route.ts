import { NextRequest, NextResponse } from 'next/server';
import { extractAuthContext } from '../../../../../../../lib/middleware/auth';

async function retiredMutation(request: NextRequest, intent: 'refresh' | 'revoke'): Promise<NextResponse> {
  const auth = await extractAuthContext(request);
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } }, { status: 401 });
  }
  return NextResponse.json({
    success: false,
    error: {
      code: 'LEGACY_IDENTITY_FLOW_RETIRED',
      message: `Use a signed ${intent} challenge through /api/v2/identity/challenges`,
    },
  }, { status: 410 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return retiredMutation(request, 'refresh');
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  return retiredMutation(request, 'revoke');
}
