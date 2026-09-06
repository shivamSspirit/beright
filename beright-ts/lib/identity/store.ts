import { canonicalJson, type VenueClaimV1 } from '@beright/forecaster-scoring-engine';
import { supabaseAdmin } from '../supabase/client';
import type { IdentityChallenge } from './challenge';

export interface IdentityChallengeStore {
  create(subjectId: string, challenge: IdentityChallenge): Promise<void>;
  getPending(challengeId: string): Promise<IdentityChallenge | null>;
  consumeAndStoreClaim(challenge: IdentityChallenge, claim: VenueClaimV1): Promise<boolean>;
  revokeClaim(claimId: string, subjectId: string, revokedAt: string): Promise<boolean>;
  markClaimRefreshed(claimId: string, subjectId: string, verifiedAt: string, challengeHash: string): Promise<boolean>;
}

interface IdentityChallengeRow {
  id: string;
  subject_id: string;
  primary_wallet: string;
  venue: string;
  external_account: string;
  nonce: string;
  domain: string;
  uri: string;
  issued_at: string;
  expires_at: string;
  protocol_version: 'identity-verification/v1';
  intent: 'link' | 'refresh' | 'revoke';
  challenge_hash: string;
}

function rowToChallenge(row: IdentityChallengeRow): IdentityChallenge {
  const payload = {
    challengeId: row.id,
    subjectId: row.subject_id,
    primaryWallet: row.primary_wallet,
    venue: row.venue,
    externalAccount: row.external_account,
    nonce: row.nonce,
    domain: row.domain,
    uri: row.uri,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    protocolVersion: row.protocol_version,
    intent: row.intent,
  } as const;
  return {
    payload,
    message: `BeRight Forecaster Passport ownership challenge\n${canonicalJson(payload)}`,
    challengeHash: row.challenge_hash,
    profileCode: `beright-${row.nonce.slice(0, 16)}`,
  };
}

export class SupabaseIdentityChallengeStore implements IdentityChallengeStore {
  async create(subjectId: string, challenge: IdentityChallenge): Promise<void> {
    const { error: subjectError } = await supabaseAdmin.from('subjects').upsert({
      subject_id: subjectId,
      subject_type: 'human',
      primary_solana_wallet: challenge.payload.primaryWallet,
      primary_wallet: challenge.payload.primaryWallet,
      primary_wallet_chain: 'solana',
      display_name: `${challenge.payload.primaryWallet.slice(0, 4)}…${challenge.payload.primaryWallet.slice(-4)}`,
      identity_status: 'unverified',
      updated_at: challenge.payload.issuedAt,
    }, { onConflict: 'subject_id' });
    if (subjectError) throw new Error('Unable to initialize subject identity');

    const { error } = await supabaseAdmin.from('identity_challenges').insert({
      id: challenge.payload.challengeId,
      subject_id: subjectId,
      primary_wallet: challenge.payload.primaryWallet,
      venue: challenge.payload.venue,
      external_account: challenge.payload.externalAccount,
      nonce: challenge.payload.nonce,
      domain: challenge.payload.domain,
      uri: challenge.payload.uri,
      issued_at: challenge.payload.issuedAt,
      expires_at: challenge.payload.expiresAt,
      protocol_version: challenge.payload.protocolVersion,
      intent: challenge.payload.intent,
      challenge_hash: challenge.challengeHash,
    });
    if (error) throw new Error('Unable to store identity challenge');
  }

  async getPending(challengeId: string): Promise<IdentityChallenge | null> {
    const { data, error } = await supabaseAdmin.from('identity_challenges').select('*')
      .eq('id', challengeId).is('consumed_at', null).maybeSingle();
    if (error) throw new Error('Unable to read identity challenge');
    return data ? rowToChallenge(data as IdentityChallengeRow) : null;
  }

  async consumeAndStoreClaim(challenge: IdentityChallenge, claim: VenueClaimV1): Promise<boolean> {
    const { data, error } = await supabaseAdmin.rpc('consume_identity_challenge_v1', {
      p_challenge_id: challenge.payload.challengeId,
      p_challenge_hash: challenge.challengeHash,
      p_claim_id: claim.claimId,
      p_metadata_hash: claim.metadataHash,
      p_proof_type: claim.proofType,
      p_verified_at: claim.verifiedAt,
      p_claim_expires_at: claim.expiresAt,
    });
    if (error) throw new Error('Unable to consume identity challenge');
    return data === true;
  }

  async revokeClaim(claimId: string, subjectId: string, revokedAt: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin.from('venue_claims').update({ revoked_at: revokedAt })
      .eq('claim_id', claimId).eq('subject_id', subjectId).is('revoked_at', null).select('claim_id').maybeSingle();
    if (error) throw new Error('Unable to revoke venue claim');
    return Boolean(data);
  }

  async markClaimRefreshed(claimId: string, subjectId: string, verifiedAt: string, challengeHash: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin.from('venue_claims').update({ verified_at: verifiedAt, challenge_hash: challengeHash })
      .eq('claim_id', claimId).eq('subject_id', subjectId).is('revoked_at', null).select('claim_id').maybeSingle();
    if (error) throw new Error('Unable to refresh venue claim');
    return Boolean(data);
  }
}
