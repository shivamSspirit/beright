import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createIdentityChallenge, SupabaseIdentityChallengeStore } from '../../../../../lib/identity/index';
import { requireAuth } from '../../../../../lib/middleware/auth';

const requestSchema = z.object({
  subjectId: z.string().min(1).max(256),
  primaryWallet: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
  venue: z.string().min(1).max(64),
  externalAccount: z.string().min(1).max(256),
  intent: z.enum(['link', 'refresh', 'revoke']).default('link'),
}).strict();

const store = new SupabaseIdentityChallengeStore();

export const POST = requireAuth(async (request: NextRequest) => {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_REQUEST', message: 'Invalid identity challenge request' } }, { status: 400 });
  if (parsed.data.venue.toLowerCase() === 'kalshi') {
    return NextResponse.json({ error: { code: 'VERIFICATION_UNSUPPORTED', message: 'Kalshi linking is disabled until secure OAuth or scoped read-only verification is implemented' } }, { status: 501 });
  }
  const challenge = createIdentityChallenge(parsed.data);
  await store.create(parsed.data.subjectId, challenge);
  return NextResponse.json({ schemaVersion: 'reputation-protocol/v1', challenge }, { status: 201 });
});
