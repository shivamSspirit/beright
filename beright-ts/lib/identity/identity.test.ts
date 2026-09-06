import assert from 'node:assert/strict';
import { test } from 'node:test';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { Wallet } from 'ethers';
import type { VenueClaimV1 } from '@beright/forecaster-scoring-engine';
import { createIdentityChallenge, type IdentityChallenge } from './challenge';
import { IdentityService, IdentityVerificationError } from './service';
import type { IdentityChallengeStore } from './store';

class MemoryIdentityStore implements IdentityChallengeStore {
  readonly pending = new Map<string, IdentityChallenge>();
  readonly claims = new Map<string, VenueClaimV1>();
  async create(_subjectId: string, challenge: IdentityChallenge): Promise<void> { this.pending.set(challenge.payload.challengeId, challenge); }
  async getPending(challengeId: string): Promise<IdentityChallenge | null> { return this.pending.get(challengeId) ?? null; }
  async consumeAndStoreClaim(challenge: IdentityChallenge, claim: VenueClaimV1): Promise<boolean> {
    if (!this.pending.delete(challenge.payload.challengeId)) return false;
    this.claims.set(claim.claimId, claim);
    return true;
  }
  async revokeClaim(claimId: string, subjectId: string, revokedAt: string): Promise<boolean> {
    const claim = this.claims.get(claimId);
    if (!claim || claim.subjectId !== subjectId || claim.revokedAt) return false;
    this.claims.set(claimId, { ...claim, revokedAt });
    return true;
  }
  async markClaimRefreshed(): Promise<boolean> { return false; }
}

function solanaSigner() {
  const keypair = nacl.sign.keyPair();
  return {
    address: bs58.encode(keypair.publicKey),
    sign: (message: string) => bs58.encode(nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey)),
  };
}

async function setupPolymarketChallenge(options: { now?: Date; ttlSeconds?: number; venue?: string; subjectId?: string } = {}) {
  const primary = solanaSigner();
  const external = Wallet.createRandom();
  const subjectId = options.subjectId ?? 'subject-a';
  const challenge = createIdentityChallenge({
    subjectId, primaryWallet: primary.address, venue: options.venue ?? 'polymarket', externalAccount: external.address,
    now: options.now ?? new Date('2026-08-30T10:00:00.000Z'), ttlSeconds: options.ttlSeconds ?? 600,
  });
  const store = new MemoryIdentityStore();
  await store.create(subjectId, challenge);
  return { primary, external, subjectId, challenge, store, service: new IdentityService(store) };
}

async function expectIdentityError(action: () => Promise<unknown>, code: string) {
  await assert.rejects(action, (error: unknown) => error instanceof IdentityVerificationError && error.code === code);
}

test('links only after independent primary Solana and external Ethereum signatures', async () => {
  const setup = await setupPolymarketChallenge();
  const claim = await setup.service.link({
    challengeId: setup.challenge.payload.challengeId, subjectId: setup.subjectId, primaryWallet: setup.primary.address,
    venue: 'polymarket', externalAccount: setup.external.address,
    proof: { primarySignature: setup.primary.sign(setup.challenge.message), externalSignature: await setup.external.signMessage(setup.challenge.message) },
    now: new Date('2026-08-30T10:01:00.000Z'),
  });
  assert.equal(claim.proofType, 'dual_wallet_signature');
  assert.equal(claim.venueAccount, setup.external.address.toLowerCase());
});

test('rejects wrong primary wallet', async () => {
  const setup = await setupPolymarketChallenge();
  const wrongPrimary = solanaSigner();
  await expectIdentityError(() => setup.service.link({
    challengeId: setup.challenge.payload.challengeId, subjectId: setup.subjectId, primaryWallet: setup.primary.address,
    venue: 'polymarket', externalAccount: setup.external.address,
    proof: { primarySignature: wrongPrimary.sign(setup.challenge.message), externalSignature: 'invalid' },
    now: new Date('2026-08-30T10:01:00.000Z'),
  }), 'PRIMARY_SIGNATURE_INVALID');
});

test('rejects wrong external wallet and invalid Ethereum signature', async () => {
  const setup = await setupPolymarketChallenge();
  const wrongExternal = Wallet.createRandom();
  const wrongExternalSignature = await wrongExternal.signMessage(setup.challenge.message);
  await expectIdentityError(() => setup.service.link({
    challengeId: setup.challenge.payload.challengeId, subjectId: setup.subjectId, primaryWallet: setup.primary.address,
    venue: 'polymarket', externalAccount: setup.external.address,
    proof: { primarySignature: setup.primary.sign(setup.challenge.message), externalSignature: wrongExternalSignature },
    now: new Date('2026-08-30T10:01:00.000Z'),
  }), 'EXTERNAL_SIGNATURE_INVALID');
});

test('rejects modified challenge messages', async () => {
  const setup = await setupPolymarketChallenge();
  setup.store.pending.set(setup.challenge.payload.challengeId, { ...setup.challenge, message: `${setup.challenge.message} modified` });
  await expectIdentityError(() => setup.service.link({
    challengeId: setup.challenge.payload.challengeId, subjectId: setup.subjectId, primaryWallet: setup.primary.address,
    venue: 'polymarket', externalAccount: setup.external.address,
    proof: { primarySignature: setup.primary.sign(setup.challenge.message), externalSignature: 'invalid' },
    now: new Date('2026-08-30T10:01:00.000Z'),
  }), 'CHALLENGE_MISMATCH');
});

test('rejects expired nonces', async () => {
  const setup = await setupPolymarketChallenge({ ttlSeconds: 60 });
  await expectIdentityError(() => setup.service.link({
    challengeId: setup.challenge.payload.challengeId, subjectId: setup.subjectId, primaryWallet: setup.primary.address,
    venue: 'polymarket', externalAccount: setup.external.address,
    proof: { primarySignature: setup.primary.sign(setup.challenge.message), externalSignature: 'invalid' },
    now: new Date('2026-08-30T10:01:01.000Z'),
  }), 'CHALLENGE_EXPIRED');
});

test('rejects reused nonces', async () => {
  const setup = await setupPolymarketChallenge();
  const input = {
    challengeId: setup.challenge.payload.challengeId, subjectId: setup.subjectId, primaryWallet: setup.primary.address,
    venue: 'polymarket', externalAccount: setup.external.address,
    proof: { primarySignature: setup.primary.sign(setup.challenge.message), externalSignature: await setup.external.signMessage(setup.challenge.message) },
    now: new Date('2026-08-30T10:01:00.000Z'),
  };
  await setup.service.link(input);
  await expectIdentityError(() => setup.service.link(input), 'CHALLENGE_NOT_FOUND');
});

test('rejects cross-user and cross-platform replay', async () => {
  const setup = await setupPolymarketChallenge();
  const base = { challengeId: setup.challenge.payload.challengeId, primaryWallet: setup.primary.address, externalAccount: setup.external.address,
    proof: { primarySignature: setup.primary.sign(setup.challenge.message), externalSignature: 'invalid' }, now: new Date('2026-08-30T10:01:00.000Z') };
  await expectIdentityError(() => setup.service.link({ ...base, subjectId: 'subject-b', venue: 'polymarket' }), 'CHALLENGE_MISMATCH');
  await expectIdentityError(() => setup.service.link({ ...base, subjectId: setup.subjectId, venue: 'kalshi' }), 'CHALLENGE_MISMATCH');
});

test('verifies a Solana-native external account independently', async () => {
  const primary = solanaSigner();
  const external = solanaSigner();
  const challenge = createIdentityChallenge({ subjectId: 'subject-sol', primaryWallet: primary.address, venue: 'dflow', externalAccount: external.address, now: new Date('2026-08-30T10:00:00Z'), ttlSeconds: 600 });
  const store = new MemoryIdentityStore(); await store.create('subject-sol', challenge);
  const claim = await new IdentityService(store).link({ challengeId: challenge.payload.challengeId, subjectId: 'subject-sol', primaryWallet: primary.address,
    venue: 'dflow', externalAccount: external.address, proof: { primarySignature: primary.sign(challenge.message), externalSignature: external.sign(challenge.message) },
    now: new Date('2026-08-30T10:01:00Z') });
  assert.equal(claim.venue, 'dflow');
});

test('returns honest unsupported status for Kalshi without accepting credentials', async () => {
  const setup = await setupPolymarketChallenge({ venue: 'kalshi' });
  await expectIdentityError(() => setup.service.link({ challengeId: setup.challenge.payload.challengeId, subjectId: setup.subjectId,
    primaryWallet: setup.primary.address, venue: 'kalshi', externalAccount: setup.external.address,
    proof: { primarySignature: setup.primary.sign(setup.challenge.message), externalSignature: 'api-secret-must-not-be-used' },
    now: new Date('2026-08-30T10:01:00Z') }), 'VERIFICATION_UNSUPPORTED');
  assert.equal(JSON.stringify(setup.challenge).includes('api-secret'), false);
  assert.equal('accessToken' in setup.challenge.payload, false);
});

test('rejects unauthorized revocation before consuming its challenge', async () => {
  const primary = solanaSigner(); const wrong = solanaSigner();
  const challenge = createIdentityChallenge({ subjectId: 'subject-a', primaryWallet: primary.address, venue: 'polymarket', externalAccount: Wallet.createRandom().address,
    intent: 'revoke', now: new Date('2026-08-30T10:00:00Z'), ttlSeconds: 600 });
  const store = new MemoryIdentityStore(); await store.create('subject-a', challenge);
  await expectIdentityError(() => new IdentityService(store).revoke({ challengeId: challenge.payload.challengeId, claimId: 'claim-a', subjectId: 'subject-a',
    primaryWallet: primary.address, venue: 'polymarket', externalAccount: challenge.payload.externalAccount,
    primarySignature: wrong.sign(challenge.message), now: new Date('2026-08-30T10:01:00Z') }), 'PRIMARY_SIGNATURE_INVALID');
  assert.equal(store.pending.has(challenge.payload.challengeId), true);
});

test('rejects unauthorized refresh before consuming its challenge', async () => {
  const primary = solanaSigner(); const wrong = solanaSigner();
  const challenge = createIdentityChallenge({ subjectId: 'subject-a', primaryWallet: primary.address, venue: 'polymarket', externalAccount: Wallet.createRandom().address,
    intent: 'refresh', now: new Date('2026-08-30T10:00:00Z'), ttlSeconds: 600 });
  const store = new MemoryIdentityStore(); await store.create('subject-a', challenge);
  await expectIdentityError(() => new IdentityService(store).refresh({ challengeId: challenge.payload.challengeId, claimId: 'claim-a', subjectId: 'subject-a',
    primaryWallet: primary.address, venue: 'polymarket', externalAccount: challenge.payload.externalAccount,
    primarySignature: wrong.sign(challenge.message), now: new Date('2026-08-30T10:01:00Z') }), 'PRIMARY_SIGNATURE_INVALID');
  assert.equal(store.pending.has(challenge.payload.challengeId), true);
});
