import 'dotenv/config';
import {
  type PolymarketHistory,
  type PolymarketMarket,
  type PolymarketPosition,
  type PolymarketTrade,
} from '../lib/passport/polymarketClient';
import { buildPolymarketPassport } from '../lib/passport/polymarketWorker';
import { SupabasePassportRepository } from '../lib/passport/repository';
import { SupabasePolymarketPassportStore } from '../lib/passport/polymarketStore';
import { supabaseAdmin } from '../lib/supabase/client';

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

async function main(): Promise<void> {
  const address = process.argv[2];
  if (!address) throw new Error('Usage: npm run passport:repair-snapshots -- 0xPolymarketAddress');
  const data = await new SupabasePassportRepository().getPassport(address.toLowerCase(), {
    includeCanonicalEvidence: false,
  });
  if (!data) throw new Error('Published Passport not found');
  const publishedAt = typeof data.attestation?.published_at === 'string'
    ? data.attestation.published_at
    : null;
  const expectedPassportRoot = typeof data.attestation?.passport_root === 'string'
    ? data.attestation.passport_root
    : null;
  const expectedEvidenceRoot = typeof data.attestation?.evidence_root === 'string'
    ? data.attestation.evidence_root
    : null;
  if (!publishedAt || !expectedPassportRoot || !expectedEvidenceRoot) {
    throw new Error('Published Passport attestation is incomplete');
  }

  const positions: PolymarketPosition[] = [];
  const trades: PolymarketTrade[] = [];
  const marketMap = new Map<string, PolymarketMarket>();
  for (const sourceValue of Object.values(data.rawEvidence)) {
    const source = record(sourceValue);
    const position = record(source?.position);
    const market = record(source?.market);
    const firstTrade = record(source?.firstTrade);
    if (!position) throw new Error('A stored receipt is missing its source position');
    positions.push(position as PolymarketPosition);
    if (market && typeof market.conditionId === 'string') {
      marketMap.set(market.conditionId.toLowerCase(), market as PolymarketMarket);
    }
    if (firstTrade) trades.push(firstTrade as PolymarketTrade);
  }
  const fetchedAt = typeof data.report.fetchedAt === 'string' ? data.report.fetchedAt : publishedAt;
  const reportedMarketCount = typeof data.report.marketsReported === 'number'
    ? data.report.marketsReported
    : null;
  const importMode = data.report.importMode === 'bounded' ? 'bounded' : 'complete';
  const currentPositions = positions
    .filter((position) => position.timestamp === undefined)
    .sort((left, right) => (right.size ?? 0) - (left.size ?? 0));
  const closedPositions = positions
    .filter((position) => position.timestamp !== undefined)
    .sort((left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0));
  const history: PolymarketHistory = {
    address: data.subject.primaryWallet,
    profile: {
      createdAt: data.subject.createdAt,
      proxyWallet: data.subject.primaryWallet,
      displayUsernamePublic: true,
      name: data.subject.displayName,
    },
    trades,
    closedPositions,
    currentPositions,
    markets: [...marketMap.values()],
    reportedMarketCount,
    importMode,
    fetchedAt,
  };
  const reconstructed = buildPolymarketPassport(history, new Date(publishedAt));
  const { snapshots, underwriting } = reconstructed;
  const evidenceRoot = reconstructed.bundle.evidenceRoot;
  const passportRoot = reconstructed.bundle.passportRoot;
  if (evidenceRoot !== expectedEvidenceRoot || passportRoot !== expectedPassportRoot) {
    if (evidenceRoot !== expectedEvidenceRoot) {
      throw new Error('Stored receipts do not reproduce the published evidence root');
    }
    const replacement = buildPolymarketPassport(history, new Date());
    await new SupabasePolymarketPassportStore().persist(replacement);
    process.stdout.write(`${JSON.stringify({
      subjectId: data.subject.subjectId,
      receipts: replacement.receipts.length,
      scoreVectors: replacement.snapshots.length,
      previousPassportRoot: expectedPassportRoot,
      passportRoot: replacement.bundle.passportRoot,
      republished: true,
    }, null, 2)}\n`);
    return;
  }

  const rows = snapshots.map((snapshot) => ({
    subject_id: snapshot.subjectId,
    topic: snapshot.topic,
    subtopic: snapshot.subtopic,
    horizon: snapshot.horizon,
    score: snapshot.score,
    snapshot,
    scoring_version: snapshot.scoringVersion,
    evidence_root: snapshot.evidenceRoot,
    calculated_at: snapshot.calculatedAt,
    data_window_start: snapshot.dataWindowStart,
    data_window_end: snapshot.dataWindowEnd,
  }));
  const { error } = await supabaseAdmin.from('topic_score_snapshots').upsert(rows, {
    onConflict: 'subject_id,topic,subtopic,horizon,scoring_version,calculated_at',
  });
  if (error) throw error;
  const { error: underwritingError } = await supabaseAdmin.from('underwriting_recommendations').upsert({
    subject_id: underwriting.subjectId,
    recommendation: underwriting,
    policy_version: underwriting.policyVersion,
    passport_root: underwriting.passportRoot,
    calculated_at: underwriting.calculatedAt,
    expires_at: underwriting.expiresAt,
    policy_inputs: reconstructed.bundle.underwritingInputs,
  }, { onConflict: 'subject_id,policy_version,passport_root' });
  if (underwritingError) throw underwritingError;
  process.stdout.write(`${JSON.stringify({
    subjectId: data.subject.subjectId,
    receipts: data.receipts.length,
    scoreVectors: snapshots.length,
    passportRoot,
  }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
