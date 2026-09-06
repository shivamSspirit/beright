import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson, hashCanonicalJson } from '@beright/forecaster-scoring-engine';

export const IDENTITY_VERIFICATION_VERSION = 'identity-verification/v1' as const;
export const DEFAULT_IDENTITY_CHALLENGE_TTL_SECONDS = 600;

export const identityChallengePayloadSchema = z.object({
  challengeId: z.string().uuid(),
  subjectId: z.string().min(1).max(256),
  primaryWallet: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
  venue: z.string().min(1).max(64),
  externalAccount: z.string().min(1).max(256),
  nonce: z.string().regex(/^[a-f0-9]{64}$/),
  domain: z.string().min(1).max(253),
  uri: z.string().url().max(2048),
  issuedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  protocolVersion: z.literal(IDENTITY_VERIFICATION_VERSION),
  intent: z.enum(['link', 'refresh', 'revoke']),
}).strict();

export type IdentityChallengePayload = z.infer<typeof identityChallengePayloadSchema>;

export interface IdentityChallenge {
  payload: IdentityChallengePayload;
  message: string;
  challengeHash: string;
  profileCode: string;
}

export function getIdentityChallengeTtlSeconds(): number {
  const configured = Number(process.env.IDENTITY_CHALLENGE_TTL_SECONDS ?? DEFAULT_IDENTITY_CHALLENGE_TTL_SECONDS);
  if (!Number.isInteger(configured) || configured < 60 || configured > 900) {
    throw new Error('IDENTITY_CHALLENGE_TTL_SECONDS must be an integer between 60 and 900');
  }
  return configured;
}

export function formatIdentityChallengeMessage(payload: IdentityChallengePayload): string {
  return `BeRight Forecaster Passport ownership challenge\n${canonicalJson(payload)}`;
}

export function createIdentityChallenge(input: {
  subjectId: string;
  primaryWallet: string;
  venue: string;
  externalAccount: string;
  intent?: IdentityChallengePayload['intent'];
  domain?: string;
  uri?: string;
  now?: Date;
  ttlSeconds?: number;
  challengeId?: string;
  nonce?: string;
}): IdentityChallenge {
  const now = input.now ?? new Date();
  const ttlSeconds = input.ttlSeconds ?? getIdentityChallengeTtlSeconds();
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 900) {
    throw new Error('Challenge TTL must be between 60 and 900 seconds');
  }

  const payload = identityChallengePayloadSchema.parse({
    challengeId: input.challengeId ?? randomUUID(),
    subjectId: input.subjectId,
    primaryWallet: input.primaryWallet,
    venue: input.venue.toLowerCase(),
    externalAccount: normalizeVenueAccount(input.venue, input.externalAccount),
    nonce: input.nonce ?? randomBytes(32).toString('hex'),
    domain: input.domain ?? process.env.IDENTITY_CHALLENGE_DOMAIN ?? 'beright.app',
    uri: input.uri ?? process.env.IDENTITY_CHALLENGE_URI ?? 'https://beright.app',
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
    protocolVersion: IDENTITY_VERIFICATION_VERSION,
    intent: input.intent ?? 'link',
  });

  return {
    payload,
    message: formatIdentityChallengeMessage(payload),
    challengeHash: hashCanonicalJson(payload),
    profileCode: `beright-${payload.nonce.slice(0, 16)}`,
  };
}

export function normalizeVenueAccount(venue: string, account: string): string {
  const trimmed = account.trim();
  return venue.toLowerCase() === 'polymarket' ? trimmed.toLowerCase() : trimmed;
}
