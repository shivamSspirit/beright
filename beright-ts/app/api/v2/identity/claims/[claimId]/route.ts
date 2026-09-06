import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { IdentityService, IdentityVerificationError, SupabaseIdentityChallengeStore } from '../../../../../../lib/identity/index';
import { requireAuth } from '../../../../../../lib/middleware/auth';

const requestSchema = z.object({
  challengeId: z.string().uuid(), subjectId: z.string().min(1).max(256),
  primaryWallet: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/), venue: z.string().min(1).max(64),
  externalAccount: z.string().min(1).max(256), primarySignature: z.string().min(1).max(512),
}).strict();

const service = new IdentityService(new SupabaseIdentityChallengeStore());

export const DELETE = requireAuth(async (request: NextRequest) => {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_REQUEST', message: 'Invalid revocation request' } }, { status: 400 });
  const claimId = request.nextUrl.pathname.split('/').pop();
  if (!claimId) return NextResponse.json({ error: { code: 'INVALID_REQUEST', message: 'Missing claim ID' } }, { status: 400 });
  try {
    await service.revoke({ ...parsed.data, claimId });
    return NextResponse.json({ success: true, revokedAt: new Date().toISOString() });
  } catch (error) {
    if (error instanceof IdentityVerificationError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 400 });
    return NextResponse.json({ error: { code: 'IDENTITY_SERVICE_UNAVAILABLE', message: 'Identity verification is temporarily unavailable' } }, { status: 503 });
  }
});
