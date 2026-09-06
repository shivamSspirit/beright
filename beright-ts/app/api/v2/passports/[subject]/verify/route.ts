import { NextRequest, NextResponse } from 'next/server';
import { replayEvidenceBundleV1, type EvidenceBundleV1 } from '@beright/forecaster-scoring-engine';
import { withAuth } from '../../../../../../lib/middleware/auth';
import { PassportService } from '../../../../../../lib/passport';
import { passportErrorResponse, passportLookup } from '../../../../../../lib/passport/http';
const service = new PassportService();
export const POST = withAuth(async (request: NextRequest, context) => {
  if (context.rateLimit.remaining <= 0) return NextResponse.json({ error: { code: 'RATE_LIMITED', message: 'Replay rate limit exceeded' } }, { status: 429 });
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 2_000_000) return NextResponse.json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Evidence bundle exceeds 2 MB' } }, { status: 413 });
  try {
    const body = request.headers.get('content-type')?.includes('application/json') ? await request.json().catch(() => null) as { bundle?: EvidenceBundleV1 } | null : null;
    const result = body?.bundle ? replayEvidenceBundleV1(body.bundle) : await service.verify(passportLookup(request));
    return NextResponse.json({ schemaVersion: 'reputation-protocol/v1', result }, { status: result.valid ? 200 : 422,
      headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return passportErrorResponse(error); }
});
