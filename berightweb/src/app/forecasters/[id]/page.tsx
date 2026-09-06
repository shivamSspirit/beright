import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowLeft, BadgeCheck, BarChart3, CalendarClock, Database, Gauge, ShieldCheck, Target, Wallet } from 'lucide-react';

import { PageWrapper } from '@/components/ui';
import { PassportActions } from './passport-actions';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

// Sentinel thrown when the passport service is up but the subject has no data
class PassportUnavailableError extends Error {
  readonly isPassportUnavailable = true;
  constructor() { super('PASSPORT_UNAVAILABLE'); }
}

type Subject = { subjectId: string; subjectType: 'human' | 'agent'; primaryWallet: string; walletChain: 'ethereum' | 'solana'; displayName: string; identityStatus: string };
type Claim = { claimId: string; venue: string; venueAccount: string; proofType: string; verifiedAt: string; expiresAt?: string | null; revokedAt?: string | null };
type Snapshot = { topic: string; subtopic: string; horizon: string; score: number; brierQuality: number; calibrationQuality: number; marketAlpha: number; resolvedCount: number; effectiveSampleSize: number; confidence: number; evidenceQuality: number; penaltyFlags: string[]; status: string; scoringVersion: string; calculatedAt: string; dataWindowStart: string; dataWindowEnd: string };
type EvidenceSummary = { resolvedCount: number; openCount: number; disputedCount: number | null; freshness: string | null };
type Summary = { subject: Subject; claims: Claim[]; summary: { status: string; resolvedCount: number; effectiveSampleSize: number; confidence: number; evidenceQuality: number; sourceFreshness: string | null; stale: boolean; venues: string[] }; scoreVersion: string; calculatedAt: string | null; dataWindow: { start: string; end: string } | null; attestation: { revokedAt: string | null; cluster: string | null; programId: string | null } | null };
type Underwriting = { recommendation: { eligibility: string; maximumActiveCapitalUsd: number; maximumMarketExposureBps: number; maximumTopicExposureBps: number; allowedTopics: string[]; allowedVenues: string[]; probationary: boolean; expiresAt: string; reasonCodes: string[] } | null; disclaimer: string };
type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const address = decodeURIComponent(id);
  const identity = /^0x[a-fA-F0-9]{40}$/.test(address) ? shortAddress(address) : address;
  const title = `${identity} · Polymarket Passport`;
  const description = 'View this evidence-backed Polymarket forecasting record, topic scores, calibration, and verification data on BeRight.';
  return {
    title,
    description,
    alternates: { canonical: `/forecasters/${encodeURIComponent(address)}` },
    openGraph: { title, description, type: 'profile' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

function apiBase(): string {
  // Prefer the server-side var (not exposed to browser, safe for SSR).
  // Fall back to the public var, then the Railway production URL.
  const serverUrl = process.env.BERIGHT_API_URL;
  const publicUrl = process.env.NEXT_PUBLIC_API_URL;
  const configured = serverUrl || publicUrl;
  return !configured || configured.includes('api.beright.fun')
    ? 'https://beright-protocol-production-3b61.up.railway.app'
    : configured;
}

async function passportFetch<T>(path: string): Promise<T> {
  const url = `${apiBase()}${path}`;
  let response: Response;
  try {
    response = await fetch(url, { next: { revalidate: 60 } });
  } catch (err) {
    throw new Error(
      `Cannot reach BeRight API at ${apiBase()} — is beright-ts running on port 3001? (${err instanceof Error ? err.message : String(err)})`
    );
  }
  if (response.status === 404) notFound();
  if (response.status === 503) {
    // Passport service unavailable — DB not configured or subject not indexed yet
    throw new PassportUnavailableError();
  }
  if (!response.ok) throw new Error(`Passport API unavailable (${response.status})`);
  return response.json() as Promise<T>;
}
function formatDate(value: string | null | undefined): string { if (!value) return 'Unavailable'; const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Unavailable' : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date); }
function shortAddress(value: string): string { return `${value.slice(0, 6)}…${value.slice(-4)}`; }
function percent(value: number): string { return `${Math.round(value * 100)}%`; }
function score(value: number): string { return Math.round(value).toLocaleString(); }

export default async function ForecasterPage({ params }: PageProps) {
  const { id } = await params;
  const subject = encodeURIComponent(decodeURIComponent(id));

  let summary: Awaited<ReturnType<typeof passportFetch<Summary>>>;
  let topicResult: Awaited<ReturnType<typeof passportFetch<{ topics: Snapshot[] }>>>;
  let evidence: Awaited<ReturnType<typeof passportFetch<EvidenceSummary>>>;
  let underwriting: Awaited<ReturnType<typeof passportFetch<Underwriting>>>;

  try {
    [summary, topicResult, evidence, underwriting] = await Promise.all([
      passportFetch<Summary>(`/api/v2/passports/${subject}`),
      passportFetch<{ topics: Snapshot[] }>(`/api/v2/passports/${subject}/topics`),
      passportFetch<EvidenceSummary>(`/api/v2/passports/${subject}/evidence-summary`),
      passportFetch<Underwriting>(`/api/v2/passports/${subject}/underwriting`),
    ]);
  } catch (err) {
    if (err instanceof PassportUnavailableError) {
      return (
        <PageWrapper showHeader={false} showFooter={false}>
          <main className={styles.page}>
            <section className={styles.shell}>
              <header className={styles.topbar}>
                <Link href="/leaderboard" className={styles.backLink}>
                  <ArrowLeft size={16} aria-hidden="true" />
                  Leaderboard
                </Link>
              </header>
              <div className={styles.warning} role="status">
                <AlertTriangle size={18} aria-hidden="true" />
                This address does not have a published Polymarket Passport yet.
              </div>
            </section>
          </main>
        </PageWrapper>
      );
    }
    throw err;
  }
  const topics = topicResult.topics; const overall = [...topics].sort((left, right) => right.confidence - left.confidence)[0];
  const stale = summary.summary.stale;
  const allFlags = [...new Set(topics.flatMap((item) => item.penaltyFlags))];
  return <PageWrapper showHeader={false} showFooter={false}><main className={styles.page}><section className={styles.shell}>
    <header className={styles.topbar}><Link href="/leaderboard" className={styles.backLink}><ArrowLeft size={16} aria-hidden="true" />Leaderboard</Link><PassportActions subjectId={summary.subject.subjectId} displayName={summary.subject.displayName} /></header>
    <section className={styles.hero} aria-labelledby="forecaster-title"><div className={styles.identity}><div className={styles.avatar} aria-hidden="true">{summary.subject.displayName.charAt(0).toUpperCase()}</div><div className={styles.identityText}><div className={styles.eyebrow}>Polymarket Passport · {summary.subject.subjectType}</div><h1 id="forecaster-title" className={styles.title}>{summary.subject.displayName}</h1><div className={styles.identityMeta}><span>{shortAddress(summary.subject.primaryWallet)}</span><span>{summary.subject.walletChain}</span><span>{summary.subject.identityStatus}</span><span>{summary.summary.status}</span></div></div></div><div className={styles.scorePanel}><span className={styles.scoreLabel}>Highest-confidence topic score</span><strong className={styles.scoreValue}>{overall ? score(overall.score) : '—'}</strong><div className={styles.scoreBar} aria-label={overall ? `Score ${score(overall.score)} out of 1000` : 'No score yet'}><span style={{ width: `${Math.min((overall?.score ?? 0) / 10, 100)}%` }} /></div></div></section>
    {(stale || (evidence.disputedCount ?? 0) > 0 || summary.attestation?.revokedAt) && <section className={styles.warning} role="status"><AlertTriangle size={18} aria-hidden="true" />{summary.attestation?.revokedAt ? 'The published on-chain attestation has been revoked.' : (evidence.disputedCount ?? 0) > 0 ? `${evidence.disputedCount} resolution record${evidence.disputedCount === 1 ? '' : 's'} is disputed; scores are conservative.` : 'Source evidence is stale; refresh before relying on this passport.'}</section>}
    <section className={styles.metricsGrid} aria-label="Passport metrics"><Metric icon={<Target size={18} />} label="Resolved forecasts" value={summary.summary.resolvedCount.toLocaleString()} /><Metric icon={<Gauge size={18} />} label="Confidence" value={percent(summary.summary.confidence)} /><Metric icon={<BarChart3 size={18} />} label="Effective sample" value={summary.summary.effectiveSampleSize.toFixed(1)} /><Metric icon={<ShieldCheck size={18} />} label="Evidence coverage" value={percent(summary.summary.evidenceQuality)} /></section>
    <section className={styles.section} aria-labelledby="topics-heading"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Scoped reputation</p><h2 id="topics-heading">Topic and horizon scores</h2></div><span>{topics.length} score vectors</span></div>{topics.length ? <div className={styles.topicGrid}>{topics.map((item) => <article key={`${item.topic}-${item.subtopic}-${item.horizon}`} className={styles.topicCard}><div className={styles.topicHeading}><span>{item.topic} / {item.subtopic}</span><strong>{item.status}</strong></div><h3>{item.horizon.replaceAll('_', ' ')}</h3><div className={styles.topicScore}>{score(item.score)} <span>/ 1000</span></div><dl className={styles.topicStats}><Stat label="Resolved" value={item.resolvedCount.toString()} /><Stat label="Effective sample" value={item.effectiveSampleSize.toFixed(1)} /><Stat label="Brier" value={item.brierQuality.toFixed(3)} /><Stat label="Market alpha" value={`${item.marketAlpha >= 0 ? '+' : ''}${item.marketAlpha.toFixed(3)}`} /><Stat label="Calibration" value={percent(item.calibrationQuality)} /><Stat label="Evidence" value={percent(item.evidenceQuality)} /></dl></article>)}</div> : <Empty message="No resolved, reproducible topic score is available for this subject yet." />}</section>
    <section className={styles.contentGrid}><section className={styles.panel} aria-labelledby="evidence-heading"><div className={styles.panelHeader}><Database size={18} aria-hidden="true" /><h2 id="evidence-heading">Evidence coverage</h2></div><div className={styles.detailList}><Detail label="Final / resolved receipts" value={evidence.resolvedCount.toLocaleString()} /><Detail label="Open or provisional receipts" value={evidence.openCount.toLocaleString()} /><Detail label="Disputed resolutions" value={evidence.disputedCount === null ? 'Not reported' : evidence.disputedCount.toLocaleString()} /><Detail label="Source freshness" value={formatDate(evidence.freshness)} /><Detail label="Venues" value={summary.summary.venues.join(', ') || 'None'} /></div></section><section className={styles.panel} aria-labelledby="calibration-heading"><div className={styles.panelHeader}><BarChart3 size={18} aria-hidden="true" /><h2 id="calibration-heading">Calibration by score vector</h2></div>{topics.length ? <div className={styles.calibrationChart} role="img" aria-label="Calibration quality by topic and horizon">{topics.map((item) => <div key={`${item.topic}-${item.subtopic}-${item.horizon}`}><span title={`${item.topic} ${item.horizon}`}>{item.subtopic.slice(0, 3).toUpperCase()}</span><i style={{ height: `${Math.max(4, item.calibrationQuality * 100)}%` }} /><small>{percent(item.calibrationQuality)}</small></div>)}</div> : <Empty message="Calibration needs resolved receipts." />}</section><section className={styles.panel} aria-labelledby="claims-heading"><div className={styles.panelHeader}><Wallet size={18} aria-hidden="true" /><h2 id="claims-heading">Verified venue claims</h2></div>{summary.claims.length ? <ul className={styles.claimList}>{summary.claims.map((claim) => <li key={claim.claimId}><BadgeCheck size={16} aria-hidden="true" /><span><strong>{claim.venue}</strong><small>{shortAddress(claim.venueAccount)} · {claim.revokedAt ? 'revoked' : `verified ${formatDate(claim.verifiedAt)}`}</small></span></li>)}</ul> : <Empty message="No active venue ownership proof is published." />}</section></section>
    <section className={styles.contentGrid}><section className={styles.panel} aria-labelledby="integrity-heading"><div className={styles.panelHeader}><AlertTriangle size={18} aria-hidden="true" /><h2 id="integrity-heading">Integrity signals</h2></div>{allFlags.length ? <div className={styles.penaltyList}>{allFlags.map((flag) => <span key={flag} className={styles.penaltyPill}>{flag.replaceAll('_', ' ')}</span>)}</div> : <p className={styles.emptyText}>No active scoring penalties.</p>}<p className={styles.panelNote}>Receipt provenance, resolution finality, timing, and correlated markets can only reduce a score or underwriting limit.</p></section><section className={styles.panel} aria-labelledby="underwriting-heading"><div className={styles.panelHeader}><CalendarClock size={18} aria-hidden="true" /><h2 id="underwriting-heading">Underwriting recommendation</h2></div>{underwriting.recommendation ? <div className={styles.detailList}><Detail label="Eligibility" value={underwriting.recommendation.eligibility} /><Detail label="Maximum active capital" value={`$${underwriting.recommendation.maximumActiveCapitalUsd.toLocaleString()}`} /><Detail label="Per-market cap" value={`${underwriting.recommendation.maximumMarketExposureBps} bps`} /><Detail label="Expires" value={formatDate(underwriting.recommendation.expiresAt)} /></div> : <Empty message="No reproducible underwriting recommendation has been published." />}<p className={styles.panelNote}>{underwriting.disclaimer}</p></section></section>
    <section className={styles.accountBand}><div className={styles.accountCopy}><ShieldCheck size={18} aria-hidden="true" /><div><h2>Calculation details</h2><p>Version {summary.scoreVersion} · calculated {formatDate(summary.calculatedAt)} · data window {summary.dataWindow ? `${formatDate(summary.dataWindow.start)} – ${formatDate(summary.dataWindow.end)}` : 'unavailable'}</p></div></div></section>
  </section></main></PageWrapper>;
}
function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className={styles.metric}><div className={styles.metricIcon} aria-hidden="true">{icon}</div><span className={styles.metricLabel}>{label}</span><strong className={styles.metricValue}>{value}</strong></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className={styles.detailRow}><span>{label}</span><strong>{value}</strong></div>; }
function Stat({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function Empty({ message }: { message: string }) { return <p className={styles.emptyText}>{message}</p>; }
