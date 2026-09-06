import { randomUUID } from 'node:crypto';
import {
  hashCanonicalJson,
  REPUTATION_PROTOCOL_V1,
  venueClaimV1Schema,
  type VenueClaimV1,
} from '@beright/forecaster-scoring-engine';
import { getConnector } from '../platformImport/connectors';
import type { ExternalPlatform, OwnershipProof } from '../platformImport/types';
import { formatIdentityChallengeMessage, normalizeVenueAccount, type IdentityChallenge } from './challenge';
import { verifyEthereumOwnershipSignature, verifySolanaOwnershipSignature } from './signatures';
import type { IdentityChallengeStore } from './store';

export type IdentityErrorCode =
  | 'CHALLENGE_NOT_FOUND'
  | 'CHALLENGE_EXPIRED'
  | 'CHALLENGE_MISMATCH'
  | 'CHALLENGE_REPLAYED'
  | 'PRIMARY_SIGNATURE_INVALID'
  | 'EXTERNAL_SIGNATURE_INVALID'
  | 'PROFILE_PROOF_INVALID'
  | 'VERIFICATION_UNSUPPORTED'
  | 'CLAIM_NOT_FOUND';

export class IdentityVerificationError extends Error {
  constructor(public readonly code: IdentityErrorCode, message: string) {
    super(message);
    this.name = 'IdentityVerificationError';
  }
}

export interface ClaimProof {
  primarySignature: string;
  externalSignature?: string;
  profileCode?: string;
}

function assertChallenge(input: {
  challenge: IdentityChallenge | null;
  subjectId: string;
  primaryWallet: string;
  venue: string;
  externalAccount: string;
  intent: IdentityChallenge['payload']['intent'];
  now: Date;
}): IdentityChallenge {
  if (!input.challenge) throw new IdentityVerificationError('CHALLENGE_NOT_FOUND', 'Challenge not found or already consumed');
  const { payload } = input.challenge;
  const matches = payload.primaryWallet === input.primaryWallet
    && payload.subjectId === input.subjectId
    && payload.venue === input.venue.toLowerCase()
    && payload.externalAccount === normalizeVenueAccount(input.venue, input.externalAccount)
    && payload.intent === input.intent;
  if (!matches) throw new IdentityVerificationError('CHALLENGE_MISMATCH', 'Challenge does not match the requested identity operation');
  if (new Date(payload.expiresAt).getTime() <= input.now.getTime()) {
    throw new IdentityVerificationError('CHALLENGE_EXPIRED', 'Challenge has expired');
  }
  const expectedMessage = formatIdentityChallengeMessage(payload);
  if (expectedMessage !== input.challenge.message || hashCanonicalJson(payload) !== input.challenge.challengeHash) {
    throw new IdentityVerificationError('CHALLENGE_MISMATCH', 'Challenge content was modified');
  }
  return input.challenge;
}

function verifyPrimary(challenge: IdentityChallenge, primarySignature: string): void {
  if (!verifySolanaOwnershipSignature({
    message: challenge.message,
    signature: primarySignature,
    expectedAddress: challenge.payload.primaryWallet,
  })) {
    throw new IdentityVerificationError('PRIMARY_SIGNATURE_INVALID', 'Primary wallet signature is invalid');
  }
}

async function verifyExternal(challenge: IdentityChallenge, proof: ClaimProof): Promise<VenueClaimV1['proofType']> {
  switch (challenge.payload.venue) {
    case 'polymarket':
      if (!proof.externalSignature || !verifyEthereumOwnershipSignature({
        message: challenge.message,
        signature: proof.externalSignature,
        expectedAddress: challenge.payload.externalAccount,
      })) {
        throw new IdentityVerificationError('EXTERNAL_SIGNATURE_INVALID', 'External Ethereum signature is invalid');
      }
      return 'dual_wallet_signature';
    case 'dflow':
    case 'jupiter':
    case 'solana':
      if (!proof.externalSignature || !verifySolanaOwnershipSignature({
        message: challenge.message,
        signature: proof.externalSignature,
        expectedAddress: challenge.payload.externalAccount,
      })) {
        throw new IdentityVerificationError('EXTERNAL_SIGNATURE_INVALID', 'External Solana signature is invalid');
      }
      return 'dual_wallet_signature';
    case 'metaculus':
    case 'manifold': {
      if (!proof.profileCode || proof.profileCode !== challenge.profileCode) {
        throw new IdentityVerificationError('PROFILE_PROOF_INVALID', 'Profile verification code is invalid');
      }
      const connector = getConnector(challenge.payload.venue as ExternalPlatform);
      if (!connector) throw new IdentityVerificationError('VERIFICATION_UNSUPPORTED', 'Profile verification is unavailable');
      const ownershipProof: OwnershipProof = { type: 'profile_code', data: { code: proof.profileCode } };
      const result = await connector.verifyOwnership(challenge.payload.externalAccount, ownershipProof);
      if (!result.verified) throw new IdentityVerificationError('PROFILE_PROOF_INVALID', 'Profile biography does not contain the challenge code');
      return 'profile_code';
    }
    case 'kalshi':
      throw new IdentityVerificationError('VERIFICATION_UNSUPPORTED', 'Kalshi account linking is disabled until secure OAuth or scoped read-only verification is implemented');
    default:
      throw new IdentityVerificationError('VERIFICATION_UNSUPPORTED', 'This venue does not have a supported ownership proof');
  }
}

export class IdentityService {
  constructor(private readonly store: IdentityChallengeStore) {}

  async link(input: {
    challengeId: string;
    subjectId: string;
    primaryWallet: string;
    venue: string;
    externalAccount: string;
    proof: ClaimProof;
    now?: Date;
  }): Promise<VenueClaimV1> {
    const now = input.now ?? new Date();
    const challenge = assertChallenge({ ...input, challenge: await this.store.getPending(input.challengeId), intent: 'link', now });
    verifyPrimary(challenge, input.proof.primarySignature);
    const proofType = await verifyExternal(challenge, input.proof);
    const verifiedAt = now.toISOString();
    const claim = venueClaimV1Schema.parse({
      schemaVersion: REPUTATION_PROTOCOL_V1,
      claimId: randomUUID(),
      subjectId: input.subjectId,
      venue: challenge.payload.venue,
      venueAccount: challenge.payload.externalAccount,
      proofType,
      challengeHash: challenge.challengeHash,
      verifiedAt,
      expiresAt: null,
      revokedAt: null,
      verificationVersion: 'v1',
      metadataHash: hashCanonicalJson({ venue: challenge.payload.venue, venueAccount: challenge.payload.externalAccount, verifiedAt }),
    });
    if (!await this.store.consumeAndStoreClaim(challenge, claim)) {
      throw new IdentityVerificationError('CHALLENGE_REPLAYED', 'Challenge was already consumed');
    }
    return claim;
  }

  async revoke(input: {
    challengeId: string; claimId: string; subjectId: string; primaryWallet: string;
    venue: string; externalAccount: string; primarySignature: string; now?: Date;
  }): Promise<void> {
    const now = input.now ?? new Date();
    const challenge = assertChallenge({ ...input, challenge: await this.store.getPending(input.challengeId), intent: 'revoke', now });
    verifyPrimary(challenge, input.primarySignature);
    const consumed = await this.store.consumeAndStoreClaim(challenge, venueClaimV1Schema.parse({
      schemaVersion: REPUTATION_PROTOCOL_V1, claimId: `operation-${challenge.payload.challengeId}`, subjectId: input.subjectId,
      venue: input.venue, venueAccount: input.externalAccount, proofType: 'dual_wallet_signature', challengeHash: challenge.challengeHash,
      verifiedAt: now.toISOString(), expiresAt: null, revokedAt: now.toISOString(), verificationVersion: 'v1',
      metadataHash: hashCanonicalJson({ intent: 'revoke', claimId: input.claimId }),
    }));
    if (!consumed) throw new IdentityVerificationError('CHALLENGE_REPLAYED', 'Challenge was already consumed');
    if (!await this.store.revokeClaim(input.claimId, input.subjectId, now.toISOString())) {
      throw new IdentityVerificationError('CLAIM_NOT_FOUND', 'Active venue claim not found');
    }
  }

  async refresh(input: {
    challengeId: string; claimId: string; subjectId: string; primaryWallet: string;
    venue: string; externalAccount: string; primarySignature: string; now?: Date;
  }): Promise<void> {
    const now = input.now ?? new Date();
    const challenge = assertChallenge({ ...input, challenge: await this.store.getPending(input.challengeId), intent: 'refresh', now });
    verifyPrimary(challenge, input.primarySignature);
    const consumed = await this.store.consumeAndStoreClaim(challenge, venueClaimV1Schema.parse({
      schemaVersion: REPUTATION_PROTOCOL_V1, claimId: `operation-${challenge.payload.challengeId}`, subjectId: input.subjectId,
      venue: input.venue, venueAccount: input.externalAccount, proofType: 'dual_wallet_signature', challengeHash: challenge.challengeHash,
      verifiedAt: now.toISOString(), expiresAt: null, revokedAt: now.toISOString(), verificationVersion: 'v1',
      metadataHash: hashCanonicalJson({ intent: 'refresh', claimId: input.claimId }),
    }));
    if (!consumed) throw new IdentityVerificationError('CHALLENGE_REPLAYED', 'Challenge was already consumed');
    if (!await this.store.markClaimRefreshed(input.claimId, input.subjectId, now.toISOString(), challenge.challengeHash)) {
      throw new IdentityVerificationError('CLAIM_NOT_FOUND', 'Active venue claim not found');
    }
  }
}
