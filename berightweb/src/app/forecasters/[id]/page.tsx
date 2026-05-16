import { promises as fs } from 'fs';
import path from 'path';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  ExternalLink,
  Gauge,
  ShieldCheck,
  Target,
  Trophy,
  Wallet,
} from 'lucide-react';

import { PageWrapper } from '@/components/ui';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

type ForecasterEntry = {
  rank: number;
  username: string;
  walletAddress?: string;
  platform: 'polymarket' | 'metaculus' | string;
  profit: string;
  accuracy: number;
  streak: number;
  predictions: number;
  scoreVersion?: string;
  scoreEpoch?: string;
  vaultScore?: number;
  confidence?: number;
  status?: string;
  tier?: string;
  importedResolvedCount?: number;
  nativeResolvedCount?: number;
  penaltyFlags?: string[];
  isOnChainVerified?: boolean;
  calculatedAt?: string;
};

type PageProps = {
  params: Promise<{ id: string }>;
};

async function getForecasters(): Promise<ForecasterEntry[]> {
  const dataPath = path.join(process.cwd(), 'public', 'data', 'real-leaderboard.json');
  try {
    const fileContent = await fs.readFile(dataPath, 'utf-8');
    return JSON.parse(fileContent) as ForecasterEntry[];
  } catch {
    return [];
  }
}

function matchesEntry(entry: ForecasterEntry, id: string): boolean {
  const decoded = decodeURIComponent(id).toLowerCase();
  return (
    entry.walletAddress?.toLowerCase() === decoded ||
    entry.username.toLowerCase() === decoded ||
    `${entry.rank}` === decoded
  );
}

function formatPercent(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return '-';
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(value: string | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatAddress(address: string | undefined): string {
  if (!address) return '-';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getPolymarketUrl(address: string | undefined): string | null {
  if (!address) return null;
  return `https://polymarket.com/profile/${address}`;
}

function getExternalProfileUrl(platform: string, address: string | undefined): string | null {
  if (!address) return null;
  if (platform === 'polymarket') return getPolymarketUrl(address);
  if (platform === 'limitless') return `https://limitless.exchange/profile/${address}`;
  return null;
}

export default async function ForecasterPage({ params }: PageProps) {
  const { id } = await params;
  const forecasters = await getForecasters();
  const forecaster = forecasters.find((entry) => matchesEntry(entry, id));

  if (!forecaster) {
    notFound();
  }

  const platformLabel = forecaster.platform.toUpperCase();
  const score = forecaster.vaultScore ?? 0;
  const confidence = forecaster.confidence ?? 0;
  const penalties = forecaster.penaltyFlags ?? [];
  const externalProfile = getExternalProfileUrl(forecaster.platform, forecaster.walletAddress);

  return (
    <PageWrapper showHeader={false} showFooter={false}>
      <main className={styles.page}>
        <section className={styles.shell}>
          <header className={styles.topbar}>
            <Link href="/leaderboard" className={styles.backLink}>
              <ArrowLeft size={16} aria-hidden="true" />
              Leaderboard
            </Link>
            <div className={styles.rankBadge}>Rank #{forecaster.rank}</div>
          </header>

          <section className={styles.hero} aria-labelledby="forecaster-title">
            <div className={styles.identity}>
              <div className={styles.avatar} aria-hidden="true">
                {forecaster.username.charAt(0)}
              </div>
              <div className={styles.identityText}>
                <div className={styles.eyebrow}>{platformLabel} IMPORT</div>
                <h1 id="forecaster-title" className={styles.title}>{forecaster.username}</h1>
                <div className={styles.identityMeta}>
                  <span>{formatAddress(forecaster.walletAddress)}</span>
                  <span>{forecaster.tier || 'unranked'}</span>
                  <span>{forecaster.status || 'Unknown'}</span>
                </div>
              </div>
            </div>

            <div className={styles.scorePanel}>
              <span className={styles.scoreLabel}>BeRight Score</span>
              <strong className={styles.scoreValue}>{score.toLocaleString()}</strong>
              <div className={styles.scoreBar} aria-label={`Score ${score} out of 1000`}>
                <span style={{ width: `${Math.min(score / 10, 100)}%` }} />
              </div>
            </div>
          </section>

          <section className={styles.metricsGrid} aria-label="Forecaster metrics">
            <Metric icon={<Trophy size={18} />} label="Display Profit" value={forecaster.profit} />
            <Metric icon={<Target size={18} />} label="Accuracy" value={`${forecaster.accuracy}%`} />
            <Metric icon={<BarChart3 size={18} />} label="Resolved Markets" value={forecaster.predictions.toLocaleString()} />
            <Metric icon={<Gauge size={18} />} label="Confidence" value={formatPercent(confidence)} />
          </section>

          <section className={styles.contentGrid}>
            <section className={styles.panel} aria-labelledby="reputation-heading">
              <div className={styles.panelHeader}>
                <ShieldCheck size={18} aria-hidden="true" />
                <h2 id="reputation-heading">Reputation Snapshot</h2>
              </div>

              <div className={styles.detailList}>
                <Detail label="Score version" value={forecaster.scoreVersion?.toUpperCase() || '-'} />
                <Detail label="Imported resolved" value={(forecaster.importedResolvedCount ?? 0).toLocaleString()} />
                <Detail label="Native resolved" value={(forecaster.nativeResolvedCount ?? 0).toLocaleString()} />
                <Detail label="Score epoch" value={formatDate(forecaster.scoreEpoch)} />
                <Detail label="Calculated" value={formatDate(forecaster.calculatedAt)} />
              </div>
            </section>

            <section className={styles.panel} aria-labelledby="risk-heading">
              <div className={styles.panelHeader}>
                <AlertTriangle size={18} aria-hidden="true" />
                <h2 id="risk-heading">Risk Signals</h2>
              </div>

              {penalties.length > 0 ? (
                <div className={styles.penaltyList}>
                  {penalties.map((penalty) => (
                    <span key={penalty} className={styles.penaltyPill}>{penalty}</span>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyText}>No active penalty flags.</p>
              )}

              <p className={styles.panelNote}>
                Imported history can bootstrap reputation, but native BeRight history must carry the long-run trust score.
              </p>
            </section>
          </section>

          <section className={styles.accountBand} aria-label="Linked account">
            <div className={styles.accountCopy}>
              <Wallet size={18} aria-hidden="true" />
              <div>
                <h2>Linked Account</h2>
                <p>{forecaster.walletAddress || forecaster.username}</p>
              </div>
            </div>

            <div className={styles.accountActions}>
              {forecaster.isOnChainVerified ? (
                <span className={styles.verified}>
                  <BadgeCheck size={16} aria-hidden="true" />
                  On-chain verified
                </span>
              ) : (
                <span className={styles.imported}>
                  <Activity size={16} aria-hidden="true" />
                  Imported history
                </span>
              )}

              {externalProfile && (
                <a
                  href={externalProfile}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.externalLink}
                >
                  Open {forecaster.platform === 'limitless' ? 'Limitless' : 'Polymarket'}
                  <ExternalLink size={16} aria-hidden="true" />
                </a>
              )}
            </div>
          </section>
        </section>
      </main>
    </PageWrapper>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricIcon} aria-hidden="true">{icon}</div>
      <span className={styles.metricLabel}>{label}</span>
      <strong className={styles.metricValue}>{value}</strong>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.detailRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
