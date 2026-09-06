'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { PageWrapper } from '@/components/ui';
import styles from './leaderboard.module.css';

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

type LeaderboardEntry = {
  rank: number;
  subjectId: string;
  address: string;
  displayName: string;
  identityStatus: string;
  status: string;
  featuredScore: number | null;
  featuredTopic: string | null;
  featuredHorizon: string | null;
  confidence: number;
  resolvedCount: number;
  tradesFetched: number;
  marketsCovered: number;
  receiptsCreated: number;
  completeHistory: boolean;
  passportRoot: string;
  publishedAt: string;
};

type LeaderboardResponse = {
  entries?: LeaderboardEntry[];
  error?: { message?: string };
};

type BuildResponse = {
  report?: {
    marketsCovered: number;
    resolvedReceipts: number;
    scoreVectors: number;
    completeHistory: boolean;
  };
  error?: { message?: string };
};

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function readableLabel(value: string | null): string {
  return value ? value.replaceAll('_', ' ') : 'Awaiting resolved evidence';
}

export default function PassportLeaderboardPage() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [building, setBuilding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [report, setReport] = useState<BuildResponse['report']>(undefined);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const response = await fetch('/api/v2/passports/leaderboard', { cache: 'no-store' });
      const payload = await response.json().catch(() => null) as LeaderboardResponse | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Could not load the Passport leaderboard.');
      }
      setEntries(payload?.entries ?? []);
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Could not load the Passport leaderboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  function openBuilder() {
    setFormError(null);
    setReport(undefined);
    dialogRef.current?.showModal();
    window.setTimeout(() => addressInputRef.current?.focus(), 0);
  }

  function closeBuilder() {
    dialogRef.current?.close();
  }

  async function buildPassport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedAddress = address.trim().toLowerCase();
    if (!ADDRESS_PATTERN.test(normalizedAddress)) {
      setFormError('Enter a valid 0x Polymarket wallet address.');
      addressInputRef.current?.focus();
      return;
    }

    setBuilding(true);
    setFormError(null);
    setReport(undefined);
    try {
      const passportPath = `/forecasters/${encodeURIComponent(normalizedAddress)}`;
      const existingResponse = await fetch(
        `/api/v2/passports/${encodeURIComponent(normalizedAddress)}`,
        { cache: 'no-store' },
      );
      if (existingResponse.ok) {
        closeBuilder();
        router.push(passportPath);
        return;
      }
      if (existingResponse.status !== 404) {
        const existingPayload = await existingResponse.json().catch(() => null) as BuildResponse | null;
        throw new Error(existingPayload?.error?.message || 'The Passport service is temporarily unavailable.');
      }

      const response = await fetch('/api/v2/passports/polymarket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: normalizedAddress }),
      });
      const responseBody = await response.text();
      let payload: BuildResponse | null = null;
      if (responseBody) {
        try {
          payload = JSON.parse(responseBody) as BuildResponse;
        } catch {
          // Preserve a proxy HTTP error instead of replacing it with a JSON SyntaxError.
        }
      }
      if (!response.ok) {
        throw new Error(
          payload?.error?.message
            || `The Passport service returned HTTP ${response.status}. Please try again.`,
        );
      }
      if (!payload?.report) {
        throw new Error('The Passport service returned an invalid response. Please try again.');
      }
      setReport(payload.report);
      await loadLeaderboard();
      window.setTimeout(() => {
        closeBuilder();
        router.push(passportPath);
      }, 900);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The Passport worker could not complete this import.');
    } finally {
      setBuilding(false);
    }
  }

  return (
    <PageWrapper showHeader={false} showFooter={false}>
      <main className={styles.page}>
        <section className={styles.shell}>
          <header className={styles.hero}>
            <div>
              <p className={styles.eyebrow}>Reputation layer · Polymarket</p>
              <h1>Passport leaderboard</h1>
              <p className={styles.intro}>
                Compare evidence-backed forecasting records, then open any trader&apos;s complete Passport.
              </p>
            </div>
            <button type="button" className={styles.createButton} onClick={openBuilder}>
              <Plus size={18} aria-hidden="true" />
              Create Passport
            </button>
          </header>

          <section className={styles.summaryBar} aria-label="Leaderboard summary">
            <div><Users size={18} aria-hidden="true" /><span>Published Passports</span><strong>{entries.length}</strong></div>
            <div><ShieldCheck size={18} aria-hidden="true" /><span>Scoring</span><strong>Topic-specific</strong></div>
            <div><BadgeCheck size={18} aria-hidden="true" /><span>Evidence</span><strong>Replayable</strong></div>
          </section>

          <section className={styles.board} aria-labelledby="ranking-title" aria-busy={loading}>
            <div className={styles.boardHeading}>
              <div>
                <p className={styles.eyebrow}>Live directory</p>
                <h2 id="ranking-title">Forecaster rankings</h2>
              </div>
              <p>Ranked by each Passport&apos;s highest-confidence topic score.</p>
            </div>

            {loading && <LeaderboardSkeleton />}

            {!loading && listError && (
              <div className={styles.statePanel} role="alert">
                <strong>Couldn&apos;t load the leaderboard</strong>
                <p>{listError}</p>
                <button type="button" onClick={() => void loadLeaderboard()}>
                  <RefreshCw size={16} aria-hidden="true" /> Try again
                </button>
              </div>
            )}

            {!loading && !listError && entries.length === 0 && (
              <div className={styles.statePanel}>
                <Trophy size={26} aria-hidden="true" />
                <strong>No published Passports yet</strong>
                <p>Create the first Passport from a public Polymarket address.</p>
                <button type="button" onClick={openBuilder}>Create Passport</button>
              </div>
            )}

            {!loading && !listError && entries.length > 0 && (
              <ol className={styles.rankingList}>
                {entries.map((entry) => (
                  <li key={entry.subjectId}>
                    <Link
                      href={`/forecasters/${encodeURIComponent(entry.address)}`}
                      className={styles.rankRow}
                      aria-label={`Open ${entry.displayName}'s Polymarket Passport`}
                    >
                      <span className={styles.rankNumber}>{String(entry.rank).padStart(2, '0')}</span>
                      <span className={styles.forecaster}>
                        <span className={styles.avatar} aria-hidden="true">{entry.displayName.charAt(0).toUpperCase()}</span>
                        <span>
                          <strong>{entry.displayName}</strong>
                          <small>{shortAddress(entry.address)} · {entry.identityStatus}</small>
                        </span>
                      </span>
                      <span className={styles.scoreCell}>
                        <small>Featured score</small>
                        <strong>{entry.featuredScore === null ? '—' : Math.round(entry.featuredScore).toLocaleString()}</strong>
                      </span>
                      <span className={styles.topicCell}>
                        <strong>{entry.featuredTopic ?? 'No scored topic'}</strong>
                        <small>{readableLabel(entry.featuredHorizon)} · {Math.round(entry.confidence * 100)}% confidence</small>
                      </span>
                      <span className={styles.evidenceCell}>
                        <strong>{entry.resolvedCount.toLocaleString()}</strong>
                        <small>resolved</small>
                      </span>
                      <span className={`${styles.statusPill} ${entry.completeHistory ? styles.complete : styles.partial}`}>
                        {entry.completeHistory ? 'Complete' : 'Partial'}
                      </span>
                      <ArrowRight className={styles.rowArrow} size={18} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </section>

        <dialog
          ref={dialogRef}
          className={styles.dialog}
          aria-labelledby="passport-dialog-title"
          onClose={() => {
            setFormError(null);
            setReport(undefined);
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget && !building) closeBuilder();
          }}
        >
          <div className={styles.dialogCard}>
            <div className={styles.dialogHeader}>
              <div>
                <p className={styles.eyebrow}>New reputation profile</p>
                <h2 id="passport-dialog-title">Create a Polymarket Passport</h2>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeBuilder} aria-label="Close Passport form">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <p className={styles.dialogIntro}>
              Paste a public wallet address. No signature or Polymarket credentials are required.
            </p>
            <form className={styles.form} onSubmit={buildPassport} noValidate aria-busy={building}>
              <label htmlFor="polymarket-address">Polymarket wallet address</label>
              <input
                ref={addressInputRef}
                id="polymarket-address"
                value={address}
                onChange={(event) => {
                  setAddress(event.target.value);
                  setFormError(null);
                }}
                placeholder="0x1234…abcd"
                autoComplete="off"
                spellCheck={false}
                disabled={building}
                aria-invalid={Boolean(formError)}
                aria-describedby={formError ? 'passport-form-error' : 'passport-form-help'}
              />
              <p id="passport-form-help" className={styles.formHelp}>
                {building
                  ? 'Importing public history. Large accounts can take several minutes; keep this tab open.'
                  : 'Existing Passports open immediately. New addresses are imported and verified before publication.'}
              </p>
              {formError && <p id="passport-form-error" className={styles.formError} role="alert">{formError}</p>}
              {report && (
                <p className={styles.formSuccess} role="status">
                  <CheckCircle2 size={17} aria-hidden="true" />
                  Published {report.resolvedReceipts} resolved receipts. Opening Passport…
                </p>
              )}
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelButton} onClick={closeBuilder} disabled={building}>Cancel</button>
                <button type="submit" className={styles.submitButton} disabled={building} aria-busy={building}>
                  {building ? 'Building Passport…' : 'Create Passport'}
                  {!building && <ArrowRight size={17} aria-hidden="true" />}
                </button>
              </div>
            </form>
          </div>
        </dialog>
      </main>
    </PageWrapper>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className={styles.skeletonList} aria-label="Loading Passport leaderboard">
      {Array.from({ length: 5 }, (_, index) => (
        <div className={styles.skeletonRow} key={index} aria-hidden="true">
          <span /><span /><span /><span />
        </div>
      ))}
    </div>
  );
}
