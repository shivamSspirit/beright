import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { IdentityService, IdentityVerificationError, SupabaseIdentityChallengeStore } from '../../../../../lib/identity/index';
import { requireAuth } from '../../../../../lib/middleware/auth';

const requestSchema = z.object({
  challengeId: z.string().uuid(),
  subjectId: z.string().min(1).max(256),
  primaryWallet: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
  venue: z.string().min(1).max(64),
  externalAccount: z.string().min(1).max(256),
  proof: z.object({ primarySignature: z.string().min(1).max(512), externalSignature: z.string().max(512).optional(), profileCode: z.string().max(64).optional() }).strict(),
}).strict();

const service = new IdentityService(new SupabaseIdentityChallengeStore());

export const POST = requireAuth(async (request: NextRequest) => {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_REQUEST', message: 'Invalid venue claim request' } }, { status: 400 });
  try {
    const claim = await service.link(parsed.data);
    return NextResponse.json({ schemaVersion: 'reputation-protocol/v1', claim }, { status: 201 });
  } catch (error) {
    if (error instanceof IdentityVerificationError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.code === 'VERIFICATION_UNSUPPORTED' ? 501 : 400 });
    return NextResponse.json({ error: { code: 'IDENTITY_SERVICE_UNAVAILABLE', message: 'Identity verification is temporarily unavailable' } }, { status: 503 });
  }
});
