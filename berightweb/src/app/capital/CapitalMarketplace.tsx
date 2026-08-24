'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarClock,
  CircleDollarSign,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { getCapitalTheses, type CapitalThesis } from '@/lib/api';
import {
  atomicToUiAmount,
  calculateSharePrice,
  formatCapitalPercent,
  formatCapitalUsd,
} from '@/lib/capital-format';
import { CapitalVaultShell } from './CapitalVaultShell';
import styles from './capital-vault.module.css';

export default function CapitalMarketplace() {
  const [theses, setTheses] = useState<CapitalThesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTheses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getCapitalTheses();
      setTheses(response.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load thesis vaults.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTheses();
  }, [loadTheses]);

  return (
    <CapitalVaultShell>
      <section className={styles.marketHero} aria-labelledby="capital-market-title">
        <div className={styles.marketHeroCopy}>
          <span className={styles.eyebrow}><Sparkles size={15} aria-hidden="true" /> Thesis vaults</span>
          <h1 id="capital-market-title">Fund an idea, not a maze of DeFi transactions.</h1>
          <p>
            Choose a transparent strategy, deposit devnet USDC, and receive program-minted shares whose value follows the whole vault.
            You do not need to place prediction orders yourself.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryLink} href="#theses">
              Explore theses <ArrowRight size={16} aria-hidden="true" />
            </a>
            <Link className={styles.secondaryLink} href="/capital/create">Create a thesis</Link>
          </div>
        </div>
        <aside className={styles.guestPrimer} aria-label="How thesis investing works">
          <span className={styles.cardLabel}>New to Capital?</span>
          <ol>
            <li><span>1</span><div><strong>Choose a thesis</strong><small>Understand its belief, risks, and expiry.</small></div></li>
            <li><span>2</span><div><strong>Check who created it</strong><small>Read their reason, rules, and failure conditions.</small></div></li>
            <li><span>3</span><div><strong>Fund or deposit</strong><small>Funding shares stay at $1 until automatic graduation.</small></div></li>
            <li><span>4</span><div><strong>Request redemption</strong><small>Exit after the program-enforced lockup and a later NAV epoch.</small></div></li>
          </ol>
        </aside>
      </section>

      <section className={styles.truthStrip} aria-label="Devnet disclosure">
        <ShieldCheck size={19} aria-hidden="true" />
        <div>
          <strong>Wallet-signed devnet custody—unaudited.</strong>
          <span>Deposits move devnet USDC into a program-owned PDA and mint non-transferable shares. Do not use real-value assets; external strategy execution is disabled.</span>
        </div>
      </section>

      <section className={styles.explainerGrid} aria-label="How users can earn">
        <article>
          <CircleDollarSign size={20} aria-hidden="true" />
          <span>Base income</span>
          <strong>Adapter pending</strong>
          <p>The DeFi target is visible, but no pooled asset moves until an audited PDA-compatible adapter is enabled.</p>
        </article>
        <article>
          <BarChart3 size={20} aria-hidden="true" />
          <span>Thesis outcome</span>
          <strong>Execution pending</strong>
          <p>Prediction limits are stored on-chain, but current wallet APIs cannot safely execute for a vault PDA.</p>
        </article>
        <article>
          <CalendarClock size={20} aria-hidden="true" />
          <span>How you exit</span>
          <strong>Program lockup</strong>
          <p>Shares enter redemption only after their on-chain lockup; funding can be cancelled before graduation.</p>
        </article>
      </section>

      <section className={styles.thesisSection} id="theses" aria-labelledby="available-theses-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.cardLabel}>Permissionless discovery</span>
            <h2 id="available-theses-title">Available theses</h2>
          </div>
          <Link href="/capital/create">Submit your own <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>

        {loading && <ThesisCardsSkeleton />}
        {error && (
          <div className={styles.errorState} role="alert">
            <strong>Couldn’t load thesis vaults</strong>
            <p>{error}</p>
            <button type="button" onClick={() => void loadTheses()}>
              <RefreshCw size={15} aria-hidden="true" /> Retry
            </button>
          </div>
        )}
        {!loading && !error && theses.length === 0 && (
          <div className={styles.emptyState}>
            <BookOpen size={28} aria-hidden="true" />
            <strong>No theses yet</strong>
            <p>Launch a machine-readable strategy and open community funding immediately.</p>
            <Link href="/capital/create">Create the first thesis</Link>
          </div>
        )}
        {!loading && !error && theses.length > 0 && (
          <div className={styles.thesisGrid}>
            {theses.map((thesis) => <ThesisCard thesis={thesis} key={thesis.id} />)}
          </div>
        )}
      </section>
    </CapitalVaultShell>
  );
}

function ThesisCard({ thesis }: { thesis: CapitalThesis }) {
  const assets = atomicToUiAmount(thesis.totalAssetsAtomic);
  const sharePrice = calculateSharePrice(thesis.totalAssetsAtomic, thesis.totalSharesAtomic);
  const qualifyingCapital = atomicToUiAmount(thesis.qualifyingCapitalAtomic);
  const graduationThreshold = atomicToUiAmount(thesis.graduationThresholdAtomic);
  const graduationProgress = graduationThreshold && qualifyingCapital !== null
    ? Math.min(100, (qualifyingCapital / graduationThreshold) * 100)
    : 0;
  return (
    <article className={styles.thesisCard}>
      <div className={styles.thesisCardTop}>
        <span className={styles.thesisSymbol}>{thesis.symbol}</span>
        <span className={thesis.status === 'active' ? styles.activeStatus : thesis.status === 'funding' ? styles.pendingStatus : styles.pausedStatus}>
          {thesis.status === 'active' ? thesis.vaultStructure === 'open_ended' ? 'Open' : 'Graduated' : thesis.status}
        </span>
      </div>
      {thesis.status === 'funding' && (
        <div className={styles.graduationBlock}>
          <div><span>Graduation progress</span><strong>{formatCapitalPercent(graduationProgress)}</strong></div>
          <div className={styles.graduationTrack} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(graduationProgress)}>
            <span style={{ width: `${graduationProgress}%` }} />
          </div>
          <small>{formatCapitalUsd(qualifyingCapital)} of {formatCapitalUsd(graduationThreshold)} qualifying · {thesis.uniqueContributors}/{thesis.minimumUniqueContributors} contributors</small>
        </div>
      )}
      <div className={styles.thesisIdentity}>
        <span>{thesis.vaultStructure === 'open_ended' ? 'Open-ended' : 'Closed-ended'} · {thesis.vaultType === 'index' ? 'Rules-based index' : 'Curated strategy'}</span>
        <h3>{thesis.name}</h3>
        <p>{thesis.thesisStatement}</p>
      </div>
      <div className={styles.allocationBar} aria-label={`${thesis.defiAllocationTargetBps / 100}% DeFi, ${thesis.predictionAllocationMaxBps / 100}% predictions, ${thesis.liquidReserveTargetBps / 100}% reserve`}>
        <span className={styles.defiAllocation} style={{ width: `${thesis.defiAllocationTargetBps / 100}%` }} />
        <span className={styles.predictionAllocation} style={{ width: `${thesis.predictionAllocationMaxBps / 100}%` }} />
        <span className={styles.reserveAllocation} style={{ width: `${thesis.liquidReserveTargetBps / 100}%` }} />
      </div>
      <div className={styles.allocationLegend}>
        <span><i className={styles.defiDot} />{thesis.defiAllocationTargetBps / 100}% DeFi</span>
        <span><i className={styles.predictionDot} />{thesis.predictionAllocationMaxBps / 100}% predictions</span>
        <span><i className={styles.reserveDot} />{thesis.liquidReserveTargetBps / 100}% reserve</span>
      </div>
      <dl className={styles.thesisMetrics}>
        <div><dt>Devnet TVL</dt><dd>{formatCapitalUsd(assets)}</dd></div>
        <div><dt>Share price</dt><dd>{formatCapitalUsd(sharePrice, 'detailed')}</dd></div>
        <div><dt>External execution</dt><dd>Disabled</dd></div>
        <div><dt>Max drawdown</dt><dd>{formatCapitalPercent(thesis.maxDrawdownBps / 100)}</dd></div>
      </dl>
      <div className={styles.thesisCardFooter}>
        <span>Created by {thesis.creatorDisplayName}</span>
        <Link href={`/capital/${thesis.slug}`}>Review thesis <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
    </article>
  );
}

function ThesisCardsSkeleton() {
  return (
    <div className={styles.thesisGrid} aria-label="Loading thesis vaults">
      {[0, 1].map((item) => (
        <div className={styles.thesisSkeleton} key={item}>
          <span /><span /><span /><span />
        </div>
      ))}
    </div>
  );
}
