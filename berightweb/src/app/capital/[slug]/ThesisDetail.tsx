'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { CapitalVaultShell } from '../CapitalVaultShell';
import { useUser } from '@/hooks/useUnifiedUser';
import { useBerightWallet } from '@/context/BerightWalletContext';
import {
  collectCapitalThesisFees,
  depositCapitalThesis,
  getCapitalThesis,
  getCapitalThesisPortfolio,
  quoteCapitalThesisDeposit,
  requestCapitalThesisRedemption,
  type CapitalThesis,
  type CapitalThesisDepositQuote,
  type CapitalThesisPosition,
} from '@/lib/api';
import { signAndSendCapitalTransaction } from '@/lib/capital-onchain';
import {
  atomicToUiAmount,
  calculateSharePrice,
  formatCapitalPercent,
  formatCapitalShares,
  formatCapitalUsd,
} from '@/lib/capital-format';
import styles from '../capital-vault.module.css';

export default function ThesisDetail({ slug }: { slug: string }) {
  const { isAuthenticated, isLoading: walletLoading, walletAddress, login } = useUser();
  const { signTransaction } = useBerightWallet();
  const [thesis, setThesis] = useState<CapitalThesis | null>(null);
  const [position, setPosition] = useState<CapitalThesisPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<'deposit' | 'redeem'>('deposit');
  const [amount, setAmount] = useState('1000');
  const [shares, setShares] = useState('');
  const [quote, setQuote] = useState<CapitalThesisDepositQuote | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const thesisResponse = await getCapitalThesis(slug);
      setThesis(thesisResponse.data);
      if (walletAddress) {
        const portfolioResponse = await getCapitalThesisPortfolio(walletAddress);
        setPosition(portfolioResponse.data.find((item) => item.thesisSlug === slug) ?? null);
      } else {
        setPosition(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load this thesis.');
    } finally {
      setLoading(false);
    }
  }, [slug, walletAddress]);

  useEffect(() => {
    void load();
  }, [load]);

  const sharePrice = thesis ? calculateSharePrice(thesis.totalAssetsAtomic, thesis.totalSharesAtomic) : null;
  const positionShares = atomicToUiAmount(position?.sharesAtomic);
  const allocationTotal = thesis
    ? thesis.defiAllocationTargetBps + thesis.predictionAllocationMaxBps + thesis.liquidReserveTargetBps
    : 0;
  const qualifyingCapital = atomicToUiAmount(thesis?.qualifyingCapitalAtomic);
  const graduationThreshold = atomicToUiAmount(thesis?.graduationThresholdAtomic);
  const graduationProgress = graduationThreshold && qualifyingCapital !== null
    ? Math.min(100, (qualifyingCapital / graduationThreshold) * 100)
    : 0;

  const handleQuote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuote(null);
    setSuccessMessage(null);
    setActionError(null);
    if (!/^\d+(?:\.\d{1,6})?$/.test(amount) || Number(amount) <= 0) {
      setActionError('Enter a positive USDC amount with up to 6 decimals.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await quoteCapitalThesisDeposit(slug, amount);
      setQuote(response.data.quote);
    } catch (quoteError) {
      setActionError(quoteError instanceof Error ? quoteError.message : 'Could not calculate this deposit.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeposit = async () => {
    if (!walletAddress || !quote) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const response = await depositCapitalThesis({ slug, wallet: walletAddress, amountUsdc: amount });
      const signature = await signAndSendCapitalTransaction({
        prepared: response.data.preparedTransaction,
        signTransaction,
      });
      setSuccessMessage(`${thesis?.status === 'funding' ? 'Funding contribution' : 'Deposit'} confirmed on devnet. ${formatCapitalShares(atomicToUiAmount(response.data.quote.sharesAtomic), 'detailed')} ${thesis?.symbol ?? 'shares'} minted. ${signature.slice(0, 8)}…`);
      setQuote(null);
      await load();
    } catch (depositError) {
      setActionError(depositError instanceof Error ? depositError.message : 'The devnet deposit could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRedemption = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!walletAddress) {
      setActionError('Connect the wallet that owns these on-chain shares.');
      return;
    }
    setSubmitting(true);
    setActionError(null);
    setSuccessMessage(null);
    try {
      const response = await requestCapitalThesisRedemption({ slug, wallet: walletAddress, shares });
      const signature = await signAndSendCapitalTransaction({
        prepared: response.data.preparedTransaction,
        signTransaction,
      });
      setSuccessMessage(response.meta.settlement === 'immediate-funding-cancel'
        ? `Funding cancelled on devnet. ${signature.slice(0, 8)}…`
        : `Redemption request recorded on devnet for a later NAV settlement. ${signature.slice(0, 8)}…`);
      setShares('');
      await load();
    } catch (redemptionError) {
      setActionError(redemptionError instanceof Error ? redemptionError.message : 'The redemption request could not be created.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFeeCollection = async () => {
    if (!walletAddress || !thesis) return;
    setSubmitting(true);
    setActionError(null);
    setSuccessMessage(null);
    try {
      const response = await collectCapitalThesisFees({ slug, wallet: walletAddress });
      const signature = await signAndSendCapitalTransaction({
        prepared: response.data.preparedTransaction,
        signTransaction,
      });
      setSuccessMessage(`Accrued performance fees collected on devnet. ${signature.slice(0, 8)}…`);
      await load();
    } catch (feeError) {
      setActionError(feeError instanceof Error ? feeError.message : 'Fee collection could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <CapitalVaultShell><div className={styles.detailSkeleton} aria-label="Loading thesis"><span /><span /><span /></div></CapitalVaultShell>;
  }
  if (error || !thesis) {
    return (
      <CapitalVaultShell>
        <div className={styles.errorState} role="alert">
          <strong>Couldn’t open this thesis</strong><p>{error ?? 'Thesis not found.'}</p>
          <button type="button" onClick={() => void load()}><RefreshCw size={15} aria-hidden="true" /> Retry</button>
          <Link href="/capital">Back to Capital</Link>
        </div>
      </CapitalVaultShell>
    );
  }

  return (
    <CapitalVaultShell>
      <div className={styles.detailBreadcrumb}>
        <Link href="/capital"><ArrowLeft size={15} aria-hidden="true" /> All theses</Link>
        <span>{thesis.symbol}</span>
      </div>

      <section className={styles.detailHero}>
        <div>
          <div className={styles.detailBadges}>
            <span className={thesis.status === 'active' ? styles.activeStatus : styles.pendingStatus}>{thesis.status.replace('_', ' ')}</span>
            <span>{thesis.vaultType === 'index' ? 'Rules-based index' : 'Curated thesis'}</span>
            <span>{thesis.vaultStructure === 'open_ended' ? 'Open-ended' : 'Closed-ended'}</span>
            <span>Devnet on-chain</span>
          </div>
          <h1>{thesis.name}</h1>
          <p>{thesis.thesisStatement}</p>
          <div className={styles.creatorLine}>Created by <strong>{thesis.creatorDisplayName}</strong><span className={styles.mono}>{thesis.creatorWallet.slice(0, 4)}…{thesis.creatorWallet.slice(-4)}</span></div>
        </div>
        <dl className={styles.navCard}>
          <div><dt>Share price</dt><dd>{formatCapitalUsd(sharePrice, 'detailed')}</dd></div>
          <div><dt>Program NAV</dt><dd>{formatCapitalUsd(atomicToUiAmount(thesis.totalAssetsAtomic), 'detailed')}</dd></div>
          <div><dt>Last checkpoint</dt><dd>{new Date(thesis.navUpdatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</dd></div>
          <small>Program accounting · external strategy adapters disabled</small>
        </dl>
      </section>

      <div className={styles.detailLayout}>
        <div className={styles.detailContent}>
          <section className={styles.detailSection}>
            <span className={styles.cardLabel}>Creator context</span>
            <h2>Who created this—and why</h2>
            <div className={styles.creatorContext}>
              <div><span>Creator</span><strong>{thesis.creatorDisplayName}</strong><small className={styles.mono}>{thesis.creatorWallet}</small></div>
              <div><span>Reason for creating</span><p>{thesis.creatorMotivation}</p></div>
              <div><span>What would prove it wrong</span><p>{thesis.failureConditions}</p></div>
            </div>
          </section>

          {thesis.status === 'funding' && (
            <section className={styles.detailSection}>
              <span className={styles.cardLabel}>Automatic graduation</span>
              <h2>Community demand unlocks the strategy.</h2>
              <div className={styles.graduationBlock}>
                <div><span>Qualifying funding</span><strong>{formatCapitalPercent(graduationProgress)}</strong></div>
                <div className={styles.graduationTrack} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(graduationProgress)}><span style={{ width: `${graduationProgress}%` }} /></div>
                <small>{formatCapitalUsd(qualifyingCapital, 'detailed')} of {formatCapitalUsd(graduationThreshold, 'detailed')} · {thesis.uniqueContributors}/{thesis.minimumUniqueContributors} unique contributors</small>
              </div>
              <div className={styles.fundingYieldGrid}>
                <div><span>Idle-yield adapter</span><strong>Disabled</strong></div>
                <div><span>Funding APY</span><strong>0%</strong></div>
                <div><span>Liquid cancellation reserve</span><strong>{formatCapitalUsd(atomicToUiAmount(thesis.fundingLiquidAssetsAtomic))}</strong></div>
                <div><span>Queued withdrawals</span><strong>{formatCapitalUsd(atomicToUiAmount(thesis.queuedFundingWithdrawalAssetsAtomic))}</strong></div>
              </div>
              <p className={styles.sectionNote}>The idle-yield adapter is disabled, so funding remains fully liquid and shares mint 1:1. Graduation counts contributed principal. One wallet counts only up to {formatCapitalUsd(atomicToUiAmount(thesis.perWalletQualifyingCapAtomic))}.</p>
            </section>
          )}

          <section className={styles.detailSection}>
            <span className={styles.cardLabel}>Capital allocation</span>
            <h2>One share owns the complete strategy.</h2>
            <div className={styles.largeAllocationBar} aria-label={`Allocation totals ${allocationTotal / 100}%`}>
              <span className={styles.defiAllocation} style={{ width: `${thesis.defiAllocationTargetBps / 100}%` }} />
              <span className={styles.predictionAllocation} style={{ width: `${thesis.predictionAllocationMaxBps / 100}%` }} />
              <span className={styles.reserveAllocation} style={{ width: `${thesis.liquidReserveTargetBps / 100}%` }} />
            </div>
            <div className={styles.allocationCards}>
              <article><i className={styles.defiDot} /><span>DeFi target</span><strong className={styles.mono}>{formatCapitalPercent(thesis.defiAllocationTargetBps / 100)}</strong><p>Configuration only; execution adapter disabled.</p></article>
              <article><i className={styles.predictionDot} /><span>Predictions</span><strong className={styles.mono}>{formatCapitalPercent(thesis.predictionAllocationMaxBps / 100)}</strong><p>Maximum risk allocation—not guaranteed return.</p></article>
              <article><i className={styles.reserveDot} /><span>Liquid reserve</span><strong className={styles.mono}>{formatCapitalPercent(thesis.liquidReserveTargetBps / 100)}</strong><p>Held for normal redemption demand.</p></article>
            </div>
          </section>

          <section className={styles.detailSection}>
            <span className={styles.cardLabel}>Eligible prediction rules</span>
            <h2>What this thesis may trade</h2>
            <div className={styles.ruleList}>
              {thesis.marketRules.map((rule, index) => (
                <article key={`${rule.label}-${index}`}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div><strong>{rule.label}</strong><small>{rule.category} · maximum {formatCapitalPercent(rule.targetBps / 100)}</small></div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.detailSection}>
            <span className={styles.cardLabel}>Risk contract</span>
            <h2>Limits the curator cannot exceed</h2>
            <dl className={styles.riskGrid}>
              <div><dt>Prediction ceiling</dt><dd>{formatCapitalPercent(thesis.predictionAllocationMaxBps / 100)}</dd></div>
              <div><dt>Single-market ceiling</dt><dd>{formatCapitalPercent(thesis.maxMarketAllocationBps / 100)}</dd></div>
              <div><dt>Drawdown pause</dt><dd>{formatCapitalPercent(thesis.maxDrawdownBps / 100)}</dd></div>
              <div><dt>Active positions</dt><dd>{thesis.maxActivePositions}</dd></div>
              <div><dt>Curator performance fee</dt><dd>{formatCapitalPercent(thesis.curatorFeeBps / 100)}</dd></div>
              <div><dt>Protocol performance fee</dt><dd>{formatCapitalPercent(thesis.protocolFeeBps / 100)}</dd></div>
              <div><dt>Lockup</dt><dd>{Math.round(thesis.lockupSeconds / 86_400)} days</dd></div>
              <div><dt>Accrued fees</dt><dd>{formatCapitalUsd(atomicToUiAmount(thesis.accruedFeesAtomic), 'detailed')}</dd></div>
            </dl>
            {walletAddress === thesis.curatorWallet && Number(thesis.accruedFeesAtomic) > 0 && (
              <button type="button" className={styles.primaryButton} disabled={submitting} onClick={() => void handleFeeCollection()}>
                Collect accrued fees
              </button>
            )}
          </section>
        </div>

        <aside className={styles.actionPanel} aria-labelledby="thesis-action-title">
          <div className={styles.actionTabs}>
            <button type="button" aria-pressed={action === 'deposit'} className={action === 'deposit' ? styles.actionTabActive : ''} onClick={() => { setAction('deposit'); setActionError(null); setSuccessMessage(null); }}>{thesis.status === 'funding' ? 'Fund' : 'Deposit'}</button>
            <button type="button" aria-pressed={action === 'redeem'} className={action === 'redeem' ? styles.actionTabActive : ''} onClick={() => { setAction('redeem'); setActionError(null); setSuccessMessage(null); setQuote(null); }}>{thesis.status === 'funding' ? 'Cancel' : 'Redeem'}</button>
          </div>
          <div className={styles.actionPanelTitle}>
            <span className={styles.cardLabel}>Wallet-signed devnet action</span>
            <h2 id="thesis-action-title">{action === 'deposit' ? `${thesis.status === 'funding' ? 'Support' : 'Buy'} ${thesis.symbol}` : `${thesis.status === 'funding' ? 'Cancel funding' : 'Redeem'} ${thesis.symbol}`}</h2>
          </div>

          {action === 'deposit' ? (
            <form onSubmit={handleQuote}>
              <label htmlFor="deposit-amount">Amount</label>
              <div className={styles.tradeAmountInput}>
                <input id="deposit-amount" inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setQuote(null); setActionError(null); }} aria-invalid={Boolean(actionError)} />
                <span>USDC</span>
              </div>
              <div className={styles.quickAmounts}>
                {['100', '500', '1000', '5000'].map((preset) => <button type="button" key={preset} onClick={() => { setAmount(preset); setQuote(null); }}>{formatCapitalUsd(Number(preset), 'compact')}</button>)}
              </div>
              {quote && (
                <div className={styles.quoteBox} aria-live="polite">
                  <span>Review deposit</span>
                  <dl>
                    <div><dt>You allocate</dt><dd>{formatCapitalUsd(atomicToUiAmount(quote.depositAmountAtomic), 'detailed')} USDC</dd></div>
                    <div><dt>You receive</dt><dd>{formatCapitalShares(atomicToUiAmount(quote.sharesAtomic), 'detailed')} {thesis.symbol}</dd></div>
                    <div><dt>Checkpoint price</dt><dd>{formatCapitalUsd(quote.sharePriceUsd, 'detailed')}</dd></div>
                    <div><dt>Wallet network fee</dt><dd>Estimated by wallet</dd></div>
                  </dl>
                  <small>Your wallet will sign a devnet USDC transfer into the vault PDA. Minimum shares include 0.5% slippage protection.</small>
                </div>
              )}
              {actionError && <p className={styles.inlineError} role="alert"><AlertTriangle size={15} aria-hidden="true" />{actionError}</p>}
              {successMessage && <p className={styles.inlineSuccess} role="status"><Check size={15} aria-hidden="true" />{successMessage}</p>}
              {!quote ? (
                <button type="submit" className={styles.primaryButton} disabled={submitting || !(thesis.vaultStructure === 'closed_ended' ? thesis.status === 'funding' : thesis.status === 'dormant' || thesis.status === 'active')} aria-busy={submitting}>
                  {submitting ? 'Calculating…' : thesis.status === 'funding' ? 'Review funding' : 'Review deposit'}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              ) : !isAuthenticated ? (
                <button type="button" className={styles.primaryButton} disabled={walletLoading} onClick={() => void login()}>
                  <Wallet size={16} aria-hidden="true" /> {walletLoading ? 'Connecting…' : 'Connect wallet to continue'}
                </button>
              ) : (
                <button type="button" className={styles.primaryButton} disabled={submitting} aria-busy={submitting} onClick={() => void handleDeposit()}>
                  {submitting ? 'Waiting for wallet…' : 'Sign devnet deposit'} <ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
            </form>
          ) : (
            <form onSubmit={handleRedemption}>
              <div className={styles.balanceLine}><span>Available</span><strong className={styles.mono}>{formatCapitalShares(positionShares, 'detailed')} {thesis.symbol}</strong></div>
              <label htmlFor="redemption-shares">Shares to redeem</label>
              <div className={styles.tradeAmountInput}>
                <input id="redemption-shares" inputMode="decimal" value={shares} onChange={(event) => { setShares(event.target.value); setActionError(null); }} disabled={!position || Number(position.pendingRedemptionSharesAtomic) > 0} />
                <button type="button" onClick={() => setShares(positionShares?.toString() ?? '')} disabled={!positionShares}>Max</button>
              </div>
              <div className={styles.redemptionNotice}>
                <CalendarClock size={18} aria-hidden="true" />
                <div><strong>{thesis.status === 'funding' ? 'Immediate cancellation' : `${Math.round(thesis.lockupSeconds / 86_400)}-day lockup`}</strong><span>{thesis.status === 'funding' ? 'Burn funding shares and receive devnet USDC in one signed transaction.' : 'After the on-chain lockup, burn shares into a redemption request settled against a later NAV checkpoint.'}</span></div>
              </div>
              {position && Number(position.pendingRedemptionSharesAtomic) > 0 && (
                <div className={styles.pendingRedemption}>
                  <span>Redemption pending</span>
                  <strong className={styles.mono}>{formatCapitalShares(atomicToUiAmount(position.pendingRedemptionSharesAtomic), 'detailed')} {thesis.symbol}</strong>
                  <small>Estimated {formatCapitalUsd(atomicToUiAmount(position.pendingRedemptionAssetsAtomic), 'detailed')} · settles {position.nextSettlementAt ? new Date(position.nextSettlementAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'next epoch'}</small>
                </div>
              )}
              {actionError && <p className={styles.inlineError} role="alert"><AlertTriangle size={15} aria-hidden="true" />{actionError}</p>}
              {successMessage && <p className={styles.inlineSuccess} role="status"><Check size={15} aria-hidden="true" />{successMessage}</p>}
              {!isAuthenticated ? (
                <button type="button" className={styles.primaryButton} disabled={walletLoading} onClick={() => void login()}><Wallet size={16} aria-hidden="true" /> Connect owning wallet</button>
              ) : (
                <button type="submit" className={styles.primaryButton} disabled={submitting || !position || Number(position.pendingRedemptionSharesAtomic) > 0}>
                  {position ? thesis.status === 'funding' ? 'Cancel funding' : 'Request redemption' : 'No shares to redeem'} <ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
            </form>
          )}
          <div className={styles.actionTrust}>
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Non-transferable shares · PDA custody · devnet only · unaudited</span>
          </div>
        </aside>
      </div>
    </CapitalVaultShell>
  );
}
