'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, FileCheck2, ShieldAlert, Wallet } from 'lucide-react';
import { CapitalVaultShell } from '../CapitalVaultShell';
import { useUser } from '@/hooks/useUnifiedUser';
import { useBerightWallet } from '@/context/BerightWalletContext';
import {
  confirmCapitalThesisCreation,
  createCapitalThesis,
  type CapitalThesis,
  type CreateCapitalThesisInput,
} from '@/lib/api';
import { signAndSendCapitalTransaction } from '@/lib/capital-onchain';
import { formatCapitalPercent, formatCapitalUsd } from '@/lib/capital-format';
import styles from '../capital-vault.module.css';

const steps = ['Idea', 'Allocation', 'Risk', 'Review'] as const;
const availableCategories = ['crypto', 'technology', 'macroeconomics', 'regulation', 'politics'];

interface ThesisDraft {
  name: string;
  symbol: string;
  thesisStatement: string;
  creatorMotivation: string;
  failureConditions: string;
  creatorDisplayName: string;
  vaultType: 'index' | 'curated';
  vaultStructure: 'closed_ended' | 'open_ended';
  categories: string[];
  marketRules: string;
  predictionPct: string;
  defiPct: string;
  reservePct: string;
  maxMarketPct: string;
  maxDrawdownPct: string;
  curatorFeePct: string;
  protocolFeePct: string;
  maxActivePositions: string;
  expiry: string;
  depositCapUsdc: string;
  graduationThresholdUsdc: string;
  minimumUniqueContributors: string;
  fundingYieldEnabled: boolean;
  lockupDays: string;
  metadataUri: string;
}

const initialDraft: ThesisDraft = {
  name: '',
  symbol: '',
  thesisStatement: '',
  creatorMotivation: '',
  failureConditions: '',
  creatorDisplayName: '',
  vaultType: 'index',
  vaultStructure: 'closed_ended',
  categories: ['crypto'],
  marketRules: '',
  predictionPct: '25',
  defiPct: '65',
  reservePct: '10',
  maxMarketPct: '5',
  maxDrawdownPct: '12',
  curatorFeePct: '1.5',
  protocolFeePct: '0.5',
  maxActivePositions: '5',
  expiry: '2027-12-31',
  depositCapUsdc: '50000',
  graduationThresholdUsdc: '10000',
  minimumUniqueContributors: '5',
  fundingYieldEnabled: false,
  lockupDays: '7',
  metadataUri: '',
};

export default function CreateThesisForm() {
  const { isAuthenticated, isLoading: walletLoading, walletAddress, login } = useUser();
  const { signTransaction } = useBerightWallet();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ThesisDraft>(initialDraft);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CapitalThesis | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const allocationTotal = useMemo(
    () => numberValue(draft.predictionPct) + numberValue(draft.defiPct) + numberValue(draft.reservePct),
    [draft],
  );
  const marketRules = useMemo(
    () => draft.marketRules.split('\n').map((line) => line.trim()).filter(Boolean),
    [draft.marketRules],
  );

  const update = <K extends keyof ThesisDraft>(key: K, value: ThesisDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const toggleCategory = (category: string) => {
    update('categories', draft.categories.includes(category)
      ? draft.categories.filter((item) => item !== category)
      : [...draft.categories, category]);
  };

  const goNext = () => {
    const message = validateStep(step, draft, allocationTotal, marketRules.length);
    if (message) {
      setError(message);
      requestAnimationFrame(() => firstFieldRef.current?.focus());
      return;
    }
    setError(null);
    setStep((current) => Math.min(current + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = validateStep(3, draft, allocationTotal, marketRules.length);
    if (message) {
      setError(message);
      return;
    }
    if (!walletAddress) {
      setError('Connect a Solana wallet before launching the thesis.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const maxMarketBps = toBps(draft.maxMarketPct);
      const input: CreateCapitalThesisInput = {
        name: draft.name.trim(),
        symbol: draft.symbol.trim(),
        thesisStatement: draft.thesisStatement.trim(),
        creatorMotivation: draft.creatorMotivation.trim(),
        failureConditions: draft.failureConditions.trim(),
        creatorWallet: walletAddress,
        creatorDisplayName: draft.creatorDisplayName.trim() || undefined,
        vaultType: draft.vaultType,
        vaultStructure: draft.vaultStructure,
        categories: draft.categories,
        allowedDefiProtocols: [],
        marketRules: marketRules.map((label) => ({
          label,
          category: draft.categories[0] ?? 'crypto',
          targetBps: maxMarketBps,
        })),
        predictionAllocationMaxBps: toBps(draft.predictionPct),
        defiAllocationTargetBps: toBps(draft.defiPct),
        liquidReserveTargetBps: toBps(draft.reservePct),
        maxMarketAllocationBps: maxMarketBps,
        maxDrawdownBps: toBps(draft.maxDrawdownPct),
        curatorFeeBps: toBps(draft.curatorFeePct),
        protocolFeeBps: toBps(draft.protocolFeePct),
        maxActivePositions: Math.trunc(numberValue(draft.maxActivePositions)),
        expiry: draft.expiry ? new Date(`${draft.expiry}T00:00:00.000Z`).toISOString() : undefined,
        depositCapUsdc: draft.depositCapUsdc,
        graduationThresholdUsdc: draft.vaultStructure === 'closed_ended' ? draft.graduationThresholdUsdc : undefined,
        minimumUniqueContributors: draft.vaultStructure === 'closed_ended'
          ? Math.trunc(numberValue(draft.minimumUniqueContributors))
          : undefined,
        fundingYieldEnabled: draft.vaultStructure === 'closed_ended' && draft.fundingYieldEnabled,
        lockupSeconds: Math.trunc(numberValue(draft.lockupDays) * 86_400),
        metadataUri: draft.metadataUri.trim() || undefined,
      };
      const response = await createCapitalThesis(input);
      const signature = await signAndSendCapitalTransaction({
        prepared: response.data.preparedTransaction,
        signTransaction,
      });
      const confirmed = await confirmCapitalThesisCreation({
        slug: response.data.thesis.slug,
        signature,
      });
      setCreated(confirmed.data);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'The thesis could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    return (
      <CapitalVaultShell>
        <section className={styles.successPanel} aria-live="polite">
          <span className={styles.successIcon}><Check size={24} aria-hidden="true" /></span>
          <span className={styles.eyebrow}>{created.vaultStructure === 'open_ended' ? 'Vault is ready' : 'Funding is live'}</span>
          <h1>{created.name} launched permissionlessly.</h1>
          <p>
            {created.vaultStructure === 'open_ended'
              ? 'This open-ended vault starts at zero AUM and becomes active with its first deposit. Ongoing deposits and redemptions follow its lockup and settlement rules.'
              : 'Anyone can now fund this devnet vault. Capital remains liquid at $1 per share until the automatic graduation threshold is reached.'}
            The vault PDA controls devnet assets; external strategies remain disabled.
          </p>
          <dl className={styles.successDetails}>
            <div><dt>Status</dt><dd>{created.status === 'dormant' ? 'Dormant' : 'Funding'}</dd></div>
            <div><dt>Symbol</dt><dd className={styles.mono}>{created.symbol}</dd></div>
            <div><dt>Creator</dt><dd>{created.creatorDisplayName}</dd></div>
          </dl>
          <div className={styles.heroActions}>
            <Link className={styles.primaryLink} href={`/capital/${created.slug}`}>View submission</Link>
            <Link className={styles.secondaryLink} href="/capital">Back to Capital</Link>
          </div>
        </section>
      </CapitalVaultShell>
    );
  }

  return (
    <CapitalVaultShell>
      <section className={styles.formHero}>
        <Link href="/capital" className={styles.backLink}><ArrowLeft size={15} aria-hidden="true" /> Capital</Link>
        <span className={styles.eyebrow}><FileCheck2 size={15} aria-hidden="true" /> Forecaster workspace</span>
        <h1>Create a machine-readable thesis.</h1>
        <p>Choose a closed-ended raise or an open-ended vault, then define its allocation and loss limits.</p>
      </section>

      <div className={styles.creatorLayout}>
        <aside className={styles.stepRail} aria-label="Thesis creation progress">
          {steps.map((label, index) => (
            <button
              type="button"
              key={label}
              disabled={index > step}
              aria-current={index === step ? 'step' : undefined}
              className={index === step ? styles.currentStep : index < step ? styles.completedStep : ''}
              onClick={() => index <= step && setStep(index)}
            >
              <span>{index < step ? <Check size={14} aria-hidden="true" /> : index + 1}</span>
              {label}
            </button>
          ))}
        </aside>

        <form className={styles.thesisForm} onSubmit={handleSubmit} noValidate>
          {error && <div className={styles.formError} role="alert"><ShieldAlert size={17} aria-hidden="true" />{error}</div>}

          {step === 0 && (
            <fieldset>
              <legend>What do you believe?</legend>
              <p className={styles.fieldsetHelp}>Write a claim another person can understand and later evaluate.</p>
              <div className={styles.fieldGridTwo}>
                <Field label="Thesis name" id="thesis-name" hint="4–80 characters">
                  <input ref={firstFieldRef} id="thesis-name" value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="Solana Growth 2027" autoComplete="off" />
                </Field>
                <Field label="Share symbol" id="thesis-symbol" hint="3–10 letters, numbers, or hyphens">
                  <input id="thesis-symbol" value={draft.symbol} onChange={(event) => update('symbol', event.target.value)} placeholder="brSOL27" autoComplete="off" spellCheck={false} />
                </Field>
              </div>
              <Field label="Thesis statement" id="thesis-statement" hint={`${draft.thesisStatement.length}/600 characters`}>
                <textarea id="thesis-statement" value={draft.thesisStatement} onChange={(event) => update('thesisStatement', event.target.value)} placeholder="Solana adoption will grow because…" rows={5} />
              </Field>
              <Field label="Why are you creating this?" id="creator-motivation" hint={`${draft.creatorMotivation.length}/400 characters · visible to depositors`}>
                <textarea id="creator-motivation" value={draft.creatorMotivation} onChange={(event) => update('creatorMotivation', event.target.value)} placeholder="I have followed Solana adoption for… and believe this vault makes the view easier to fund because…" rows={4} />
              </Field>
              <Field label="What would prove this thesis wrong?" id="failure-conditions" hint={`${draft.failureConditions.length}/400 characters · specific, observable conditions`}>
                <textarea id="failure-conditions" value={draft.failureConditions} onChange={(event) => update('failureConditions', event.target.value)} placeholder="This thesis weakens if…" rows={4} />
              </Field>
              <div className={styles.fieldGridTwo}>
                <Field label="Creator display name" id="creator-name" hint="Optional; the wallet remains the authority">
                  <input id="creator-name" value={draft.creatorDisplayName} onChange={(event) => update('creatorDisplayName', event.target.value)} placeholder="Your forecaster name" autoComplete="nickname" />
                </Field>
                <Field label="Strategy type" id="vault-type" hint="Index uses fixed rules; curated allows bounded decisions">
                  <select id="vault-type" value={draft.vaultType} onChange={(event) => update('vaultType', event.target.value as ThesisDraft['vaultType'])}>
                    <option value="index">Rules-based index</option>
                    <option value="curated">Curated thesis</option>
                  </select>
                </Field>
              </div>
              <Field label="Vault structure" id="vault-structure" hint={draft.vaultStructure === 'open_ended' ? 'Starts at zero AUM; deposits remain open and there is no graduation target.' : 'Raises to a target, graduates once, then closes to new deposits.'}>
                <select id="vault-structure" value={draft.vaultStructure} onChange={(event) => update('vaultStructure', event.target.value as ThesisDraft['vaultStructure'])}>
                  <option value="closed_ended">Closed-ended raise</option>
                  <option value="open_ended">Open-ended vault</option>
                </select>
              </Field>
              {draft.vaultStructure === 'closed_ended' && (
                <div className={styles.fieldGridTwo}>
                  <Field label="Graduation threshold" id="graduation-threshold" hint="Strategy activates automatically at this qualifying TVL">
                    <div className={styles.amountInput}><input id="graduation-threshold" inputMode="decimal" value={draft.graduationThresholdUsdc} onChange={(event) => update('graduationThresholdUsdc', event.target.value)} /><span>USDC</span></div>
                  </Field>
                  <Field label="Unique contributors" id="minimum-contributors" hint="Prevents one wallet from graduating alone">
                    <input id="minimum-contributors" inputMode="numeric" pattern="[0-9]*" value={draft.minimumUniqueContributors} onChange={(event) => update('minimumUniqueContributors', event.target.value)} />
                  </Field>
                </div>
              )}
              <fieldset className={styles.categoryFieldset}>
                <legend>Allowed categories</legend>
                <div className={styles.checkboxGrid}>
                  {availableCategories.map((category) => (
                    <label key={category}>
                      <input type="checkbox" checked={draft.categories.includes(category)} onChange={() => toggleCategory(category)} />
                      <span>{category}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </fieldset>
          )}

          {step === 1 && (
            <fieldset>
              <legend>Allocate the vault</legend>
              <p className={styles.fieldsetHelp}>All three allocations must equal exactly 100%.</p>
              <div className={styles.allocationInputs}>
                <PercentField label="DeFi lending" id="defi-pct" value={draft.defiPct} onChange={(value) => update('defiPct', value)} />
                <PercentField label="Predictions" id="prediction-pct" value={draft.predictionPct} onChange={(value) => update('predictionPct', value)} />
                <PercentField label="Liquid reserve" id="reserve-pct" value={draft.reservePct} onChange={(value) => update('reservePct', value)} />
              </div>
              <div className={allocationTotal === 100 ? styles.allocationTotalGood : styles.allocationTotalBad}>
                <span>Allocation total</span><strong className={styles.mono}>{formatCapitalPercent(allocationTotal)}</strong>
              </div>
              <Field label="Prediction-market rules" id="market-rules" hint="One eligible market rule per line; no market IDs are approved at submission">
                <textarea id="market-rules" value={draft.marketRules} onChange={(event) => update('marketRules', event.target.value)} placeholder={'SOL price exceeds the thesis threshold\nSolana ETF receives approval'} rows={6} />
              </Field>
              <div className={styles.infoBox}>
                <strong>DeFi adapter</strong>
                <span>External DeFi and prediction execution is disabled until a PDA-compatible audited adapter is deployed.</span>
              </div>
            </fieldset>
          )}

          {step === 2 && (
            <fieldset>
              <legend>Set hard risk limits</legend>
              <p className={styles.fieldsetHelp}>These limits are intended to become immutable or timelocked on-chain.</p>
              <div className={styles.fieldGridThree}>
                <PercentField label="Max per market" id="market-cap" value={draft.maxMarketPct} onChange={(value) => update('maxMarketPct', value)} />
                <PercentField label="Max drawdown" id="drawdown" value={draft.maxDrawdownPct} onChange={(value) => update('maxDrawdownPct', value)} />
                <Field label="Maximum positions" id="position-count">
                  <input id="position-count" inputMode="numeric" pattern="[0-9]*" value={draft.maxActivePositions} onChange={(event) => update('maxActivePositions', event.target.value)} />
                </Field>
              </div>
              <div className={styles.fieldGridTwo}>
                <PercentField label="Curator fee" id="curator-fee" value={draft.curatorFeePct} onChange={(value) => update('curatorFeePct', value)} />
                <PercentField label="Protocol fee" id="protocol-fee" value={draft.protocolFeePct} onChange={(value) => update('protocolFeePct', value)} />
              </div>
              <div className={styles.fieldGridTwo}>
                <Field label={draft.vaultStructure === 'open_ended' ? 'Optional expiry' : 'Expiry'} id="expiry" hint={draft.vaultStructure === 'open_ended' ? 'Leave blank for no fixed maturity' : 'At least 30 days away'}>
                  <input id="expiry" type="date" value={draft.expiry} onChange={(event) => update('expiry', event.target.value)} />
                </Field>
                <Field label="Devnet deposit cap" id="deposit-cap" hint="1,000–1,000,000 devnet USDC">
                  <div className={styles.amountInput}><input id="deposit-cap" inputMode="decimal" value={draft.depositCapUsdc} onChange={(event) => update('depositCapUsdc', event.target.value)} /><span>USDC</span></div>
                </Field>
              </div>
              <Field label="Lockup" id="lockup-days" hint="0–365 days; enforced by the program">
                <div className={styles.amountInput}><input id="lockup-days" inputMode="numeric" pattern="[0-9]*" value={draft.lockupDays} onChange={(event) => update('lockupDays', event.target.value)} /><span>days</span></div>
              </Field>
              <Field label="Metadata URI" id="metadata-uri" hint="Optional HTTPS URL for the full public strategy document">
                <input id="metadata-uri" type="url" inputMode="url" value={draft.metadataUri} onChange={(event) => update('metadataUri', event.target.value)} placeholder="https://…" autoComplete="url" spellCheck={false} />
              </Field>
            </fieldset>
          )}

          {step === 3 && (
            <fieldset>
              <legend>Review the complete thesis</legend>
              <p className={styles.fieldsetHelp}>Your wallet will sign one devnet transaction to create the thesis, vault PDA, and non-transferable share mint.</p>
              <div className={styles.reviewCard}>
                  <div><span>{draft.symbol}</span><h2>{draft.name}</h2><p>{draft.thesisStatement}</p></div>
                <dl>
                  <div><dt>Strategy</dt><dd>{draft.vaultType === 'index' ? 'Rules-based index' : 'Curated'}</dd></div>
                  <div><dt>Structure</dt><dd>{draft.vaultStructure === 'open_ended' ? 'Open-ended' : 'Closed-ended'}</dd></div>
                  <div><dt>DeFi / predictions / reserve</dt><dd className={styles.mono}>{draft.defiPct}% / {draft.predictionPct}% / {draft.reservePct}%</dd></div>
                  <div><dt>Loss pause</dt><dd className={styles.mono}>{formatCapitalPercent(numberValue(draft.maxDrawdownPct))}</dd></div>
                  <div><dt>Total fees</dt><dd className={styles.mono}>{formatCapitalPercent(numberValue(draft.curatorFeePct) + numberValue(draft.protocolFeePct))}</dd></div>
                  <div><dt>Deposit cap</dt><dd className={styles.mono}>{formatCapitalUsd(numberValue(draft.depositCapUsdc), 'detailed')}</dd></div>
                  <div><dt>Lockup</dt><dd className={styles.mono}>{draft.lockupDays} days</dd></div>
                  {draft.vaultStructure === 'closed_ended' && <div><dt>Graduates at</dt><dd className={styles.mono}>{formatCapitalUsd(numberValue(draft.graduationThresholdUsdc), 'detailed')} + {draft.minimumUniqueContributors} contributors</dd></div>}
                  <div><dt>External strategies</dt><dd>Disabled pending audited adapter</dd></div>
                  <div><dt>Markets proposed</dt><dd className={styles.mono}>{marketRules.length}</dd></div>
                </dl>
              </div>
              <div className={styles.reviewWarning}>
                <ShieldAlert size={18} aria-hidden="true" />
                <div><strong>{draft.vaultStructure === 'open_ended' ? 'Deposits open at zero AUM.' : 'Funding opens immediately.'}</strong><span>{draft.vaultStructure === 'open_ended' ? 'The first deposit activates the vault; deposits and redemptions remain open under its terms.' : 'Capital stays liquid and cancellable. Strategy execution unlocks only when capital and contributor thresholds are both met.'}</span></div>
              </div>
              {!isAuthenticated && (
                <button className={styles.walletGate} type="button" disabled={walletLoading} onClick={() => void login()}>
                  <Wallet size={17} aria-hidden="true" />
                  {walletLoading ? 'Connecting…' : 'Connect wallet to submit'}
                </button>
              )}
            </fieldset>
          )}

          <div className={styles.formActions}>
            {step > 0 ? (
              <button type="button" className={styles.secondaryButton} onClick={() => { setError(null); setStep(step - 1); }}>
                <ArrowLeft size={16} aria-hidden="true" /> Back
              </button>
            ) : <span />}
            {step < steps.length - 1 ? (
              <button type="button" className={styles.primaryButton} onClick={goNext}>
                Continue <ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : (
              <button type="submit" className={styles.primaryButton} disabled={!isAuthenticated || submitting} aria-busy={submitting}>
                {submitting ? 'Waiting for wallet…' : 'Sign and launch vault'} <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </form>
      </div>
    </CapitalVaultShell>
  );
}

function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: React.ReactNode }) {
  return <div className={styles.field}><label htmlFor={id}>{label}</label>{children}{hint && <small>{hint}</small>}</div>;
}

function PercentField({ label, id, value, onChange }: { label: string; id: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label} id={id}>
      <div className={styles.amountInput}>
        <input id={id} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} />
        <span>%</span>
      </div>
    </Field>
  );
}

function validateStep(step: number, draft: ThesisDraft, allocationTotal: number, marketCount: number): string | null {
  if (step === 0 || step === 3) {
    if (draft.name.trim().length < 4 || draft.name.trim().length > 80) return 'Use a thesis name containing 4–80 characters.';
    if (!/^[A-Za-z][A-Za-z0-9-]{2,9}$/.test(draft.symbol.trim())) return 'Use a 3–10 character symbol beginning with a letter.';
    if (draft.thesisStatement.trim().length < 40 || draft.thesisStatement.trim().length > 600) return 'Write a thesis statement containing 40–600 characters.';
    if (draft.creatorMotivation.trim().length < 20 || draft.creatorMotivation.trim().length > 400) return 'Explain why you are creating this thesis in 20–400 characters.';
    if (draft.failureConditions.trim().length < 20 || draft.failureConditions.trim().length > 400) return 'Describe observable failure conditions in 20–400 characters.';
    if (draft.categories.length < 1 || draft.categories.length > 5) return 'Choose 1–5 allowed market categories.';
  }
  if (step === 1 || step === 3) {
    if (allocationTotal !== 100) return 'DeFi, prediction, and reserve allocations must equal exactly 100%.';
    if (numberValue(draft.predictionPct) > 25) return 'Prediction allocation cannot exceed the 25% protocol ceiling.';
    if (numberValue(draft.reservePct) < 10) return 'Liquid reserve must be at least 10%.';
    if (marketCount < 1 || marketCount > numberValue(draft.maxActivePositions)) return 'Add at least one market rule without exceeding the active-position limit.';
  }
  if (step === 2 || step === 3) {
    if (numberValue(draft.maxMarketPct) <= 0 || numberValue(draft.maxMarketPct) > numberValue(draft.predictionPct)) return 'Per-market exposure must be positive and within the prediction allocation.';
    if (numberValue(draft.maxDrawdownPct) < 1 || numberValue(draft.maxDrawdownPct) > 50) return 'Maximum drawdown must be between 1% and 50%.';
    if (!Number.isInteger(numberValue(draft.maxActivePositions)) || numberValue(draft.maxActivePositions) < 1 || numberValue(draft.maxActivePositions) > 10) return 'Maximum active positions must be an integer from 1 to 10.';
    if (numberValue(draft.depositCapUsdc) < 1_000 || numberValue(draft.depositCapUsdc) > 1_000_000) return 'Deposit cap must be between 1,000 and 1,000,000 USDC.';
    if (!Number.isInteger(numberValue(draft.lockupDays)) || numberValue(draft.lockupDays) < 0 || numberValue(draft.lockupDays) > 365) return 'Lockup must be an integer from 0 to 365 days.';
    if (draft.vaultStructure === 'closed_ended') {
      if (numberValue(draft.graduationThresholdUsdc) < 1_000 || numberValue(draft.graduationThresholdUsdc) > numberValue(draft.depositCapUsdc)) return 'Graduation threshold must be at least 1,000 USDC and no greater than the deposit cap.';
      if (!Number.isInteger(numberValue(draft.minimumUniqueContributors)) || numberValue(draft.minimumUniqueContributors) < 2 || numberValue(draft.minimumUniqueContributors) > 100) return 'Unique contributors must be an integer from 2 to 100.';
    }
    if ((draft.vaultStructure === 'closed_ended' || draft.expiry) && Number.isNaN(new Date(`${draft.expiry}T00:00:00Z`).getTime())) return 'Choose a valid thesis expiry date.';
    if (draft.metadataUri && !/^https:\/\//i.test(draft.metadataUri)) return 'Metadata URI must use HTTPS.';
  }
  return null;
}

function numberValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBps(value: string): number {
  return Math.round(numberValue(value) * 100);
}
