'use client';

import { useState, useCallback } from 'react';
import { useUser } from '@/hooks/useUnifiedUser';
import { getTransactionUrl } from '@/lib/explorer';
import { useVault } from '@/hooks/useVault';
import {
  Shield, Lock, Unlock, TrendingDown, TrendingUp,
  AlertTriangle, CheckCircle, RefreshCw, ExternalLink,
  Settings, UserCheck, UserX, Zap,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(4);
}

function formatSeconds(secs: number): string {
  if (secs <= 0) return 'unlocked';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function shortKey(key: string): string {
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

// Explorer URL helper - uses Orb Markets for devnet visibility
const solscanTx = (sig: string) => getTransactionUrl(sig, 'devnet');

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent = false }: {
  label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div style={{
      background: 'rgba(0,255,247,0.04)',
      border: `1px solid ${accent ? '#00fff7' : 'rgba(0,255,247,0.12)'}`,
      borderRadius: 10,
      padding: '14px 18px',
    }}>
      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ color: accent ? '#00fff7' : '#fff', fontSize: 22, fontFamily: 'monospace', fontWeight: 700 }}>
        {value}
      </div>
      {sub && <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function TxLink({ sig }: { sig: string }) {
  return (
    <a
      href={solscanTx(sig)}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#00fff7', fontSize: 12, textDecoration: 'none' }}
    >
      <ExternalLink size={12} />
      {shortKey(sig)}
    </a>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function VaultPage() {
  const { login, isAuthenticated, isLoading } = useUser();
  const authenticated = isAuthenticated;
  const ready = !isLoading;
  const {
    vaultState, initialized, loading, txLoading, error, lastTx,
    initVault, deposit, withdraw, freezeVault, unfreezeVault,
    setGuardian, removeGuardian, fetchVaultState,
  } = useVault();

  // Form state
  const [depositAmt,   setDepositAmt]   = useState('');
  const [withdrawAmt,  setWithdrawAmt]  = useState('');
  const [guardianKey,  setGuardianKey]  = useState('');
  const [guardianThresh, setGuardianThresh] = useState('');
  const [showGuardianForm, setShowGuardianForm] = useState(false);
  const [initDelay,    setInitDelay]    = useState('0');
  const [initEpochLim, setInitEpochLim] = useState('0');

  const [notice, setNotice] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const notify = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setNotice({ msg, type });
    setTimeout(() => setNotice(null), 6000);
  }, []);

  const run = useCallback(async (fn: () => Promise<string>, successMsg: string) => {
    try {
      const sig = await fn();
      notify(`${successMsg} — tx: ${sig.slice(0, 8)}…`, 'ok');
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : String(e), 'err');
    }
  }, [notify]);

  // ─── Not authenticated ───────────────────────────────────────────────────

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#00fff7', fontFamily: 'monospace' }}>loading…</div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0a0f', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
      }}>
        <Shield size={48} color="#00fff7" />
        <div style={{ color: '#fff', fontSize: 24, fontWeight: 700, fontFamily: 'Orbitron, monospace' }}>
          BeRight Vault
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
          Connect your wallet to manage your on-chain vault
        </div>
        <button
          onClick={login}
          style={{
            background: '#00fff7', color: '#000', border: 'none', borderRadius: 8,
            padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'monospace',
          }}
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  const s = vaultState;

  // ─── Vault not initialized ───────────────────────────────────────────────

  const renderInitForm = () => (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <Shield size={32} color="#00fff7" />
        <div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, fontFamily: 'Orbitron, monospace' }}>
            Initialize Vault
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
            Create your on-chain BeRight vault
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label style={labelStyle}>
          Withdrawal Delay (seconds)
          <input
            type="number" min="0" max="2592000"
            value={initDelay} onChange={e => setInitDelay(e.target.value)}
            style={inputStyle} placeholder="0 = no lock"
          />
          <span style={hintStyle}>Max 30 days (2592000 s). Set 0 to skip.</span>
        </label>

        <label style={labelStyle}>
          Epoch Withdraw Limit (SOL)
          <input
            type="number" min="0" step="0.1"
            value={initEpochLim} onChange={e => setInitEpochLim(e.target.value)}
            style={inputStyle} placeholder="0 = unlimited"
          />
          <span style={hintStyle}>Max SOL withdrawable per Solana epoch (~2 days). 0 = unlimited.</span>
        </label>

        <button
          disabled={txLoading}
          onClick={() => run(() => initVault({
            withdrawalDelay:       Math.round(Number(initDelay)),
            epochWithdrawLimit:    Math.round(Number(initEpochLim) * 1e9),
            largeWithdrawThreshold: 0,
          }), 'Vault initialized')}
          style={primaryBtnStyle(txLoading)}
        >
          {txLoading ? 'Initializing…' : 'Create Vault'}
        </button>
      </div>
    </div>
  );

  // ─── Vault dashboard ─────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid rgba(0,255,247,0.1)',
        padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={22} color="#00fff7" />
          <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 16, fontWeight: 700, color: '#00fff7' }}>
            BeRight Vault
          </span>
          {s?.isFrozen && (
            <span style={{ background: '#ff4444', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
              FROZEN
            </span>
          )}
          {s?.timelocked && (
            <span style={{ background: 'rgba(255,165,0,0.2)', color: '#ffa500', fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid #ffa500' }}>
              LOCKED {formatSeconds(s.unlocksInSeconds)}
            </span>
          )}
        </div>
        <button
          onClick={fetchVaultState}
          disabled={loading}
          style={{ background: 'none', border: '1px solid rgba(0,255,247,0.2)', borderRadius: 6, padding: '6px 10px', color: '#00fff7', cursor: 'pointer' }}
        >
          <RefreshCw size={14} style={{ display: 'block', animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* Notice */}
      {notice && (
        <div style={{
          margin: '12px 24px 0',
          padding: '10px 14px',
          borderRadius: 8,
          background: notice.type === 'ok' ? 'rgba(0,255,0,0.08)' : 'rgba(255,0,0,0.08)',
          border: `1px solid ${notice.type === 'ok' ? 'rgba(0,255,0,0.3)' : 'rgba(255,0,0,0.3)'}`,
          color: notice.type === 'ok' ? '#00e676' : '#ff6b6b',
          fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {notice.type === 'ok' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          {notice.msg}
          {lastTx && notice.type === 'ok' && <TxLink sig={lastTx} />}
        </div>
      )}

      {/* Error */}
      {error && !notice && (
        <div style={{ margin: '12px 24px 0', padding: '10px 14px', borderRadius: 8, background: 'rgba(255,0,0,0.08)', border: '1px solid rgba(255,0,0,0.3)', color: '#ff6b6b', fontSize: 13 }}>
          <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !s && !error && (
        <div style={{ padding: '60px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
          Reading vault from chain…
        </div>
      )}

      {/* Not initialized */}
      {!loading && !initialized && renderInitForm()}

      {/* Dashboard */}
      {s && (
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <StatCard label="Vault Balance" value={`${s.vaultSol.toFixed(4)} SOL`} accent sub={`${s.vaultLamports.toLocaleString()} lamports`} />
            <StatCard label="Total Deposited" value={`${formatSol(s.totalDeposited)} SOL`} />
            <StatCard label="Total Withdrawn" value={`${formatSol(s.totalWithdrawn)} SOL`} />
            <StatCard
              label="Status"
              value={s.isFrozen ? 'FROZEN' : s.timelocked ? 'LOCKED' : 'OPEN'}
              sub={s.timelocked ? `unlocks in ${formatSeconds(s.unlocksInSeconds)}` : undefined}
            />
          </div>

          {/* Epoch limit bar */}
          {s.epochWithdrawLimit > 0 && s.epochWithdrawLimit < Number.MAX_SAFE_INTEGER && (
            <div style={{ background: 'rgba(0,255,247,0.04)', border: '1px solid rgba(0,255,247,0.12)', borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Epoch Withdrawal Limit
                </span>
                <span style={{ color: '#fff', fontSize: 12, fontFamily: 'monospace' }}>
                  {formatSol(s.epochWithdrawn)} / {formatSol(s.epochWithdrawLimit)} SOL
                </span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 6 }}>
                <div style={{
                  width: `${Math.min(100, (s.epochWithdrawn / s.epochWithdrawLimit) * 100)}%`,
                  background: '#00fff7', borderRadius: 4, height: '100%',
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          )}

          {/* Deposit */}
          <Section title="Deposit SOL" icon={<TrendingUp size={16} color="#00e676" />}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number" min="0.001" step="0.1"
                value={depositAmt} onChange={e => setDepositAmt(e.target.value)}
                placeholder="Amount in SOL"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                disabled={txLoading || !depositAmt || s.isFrozen}
                onClick={() => run(() => deposit(Number(depositAmt)), 'Deposited')}
                style={primaryBtnStyle(txLoading || !depositAmt || s.isFrozen)}
              >
                {txLoading ? '…' : 'Deposit'}
              </button>
            </div>
            {s.isFrozen && <span style={hintStyle}>Vault is frozen — deposits blocked</span>}
          </Section>

          {/* Withdraw */}
          <Section title="Withdraw SOL" icon={<TrendingDown size={16} color="#ff6b6b" />}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number" min="0.001" step="0.1"
                value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)}
                placeholder="Amount in SOL"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                disabled={txLoading || !withdrawAmt || s.isFrozen || s.timelocked}
                onClick={() => run(() => withdraw(Number(withdrawAmt)), 'Withdrawn')}
                style={dangerBtnStyle(txLoading || !withdrawAmt || s.isFrozen || s.timelocked)}
              >
                {txLoading ? '…' : 'Withdraw'}
              </button>
            </div>
            {s.timelocked && <span style={{ ...hintStyle, color: '#ffa500' }}>Timelocked — unlocks in {formatSeconds(s.unlocksInSeconds)}</span>}
            {s.isFrozen    && <span style={{ ...hintStyle, color: '#ff6b6b' }}>Vault is frozen — withdrawals blocked</span>}
            {s.guardianSet && (
              <span style={hintStyle}>
                Guardian required for withdrawals ≥ {formatSol(s.largeWithdrawThreshold)} SOL
              </span>
            )}
          </Section>

          {/* Freeze toggle */}
          <Section title="Emergency Freeze" icon={<AlertTriangle size={16} color="#ffa500" />}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                {s.isFrozen
                  ? 'Vault is frozen — all activity blocked'
                  : 'Freeze vault to block all deposits and withdrawals'}
              </span>
              <button
                disabled={txLoading}
                onClick={() => run(
                  s.isFrozen ? unfreezeVault : freezeVault,
                  s.isFrozen ? 'Vault unfrozen' : 'Vault frozen',
                )}
                style={{
                  background: s.isFrozen ? 'rgba(0,230,118,0.15)' : 'rgba(255,165,0,0.15)',
                  border: `1px solid ${s.isFrozen ? '#00e676' : '#ffa500'}`,
                  color: s.isFrozen ? '#00e676' : '#ffa500',
                  borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: txLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600,
                  opacity: txLoading ? 0.5 : 1,
                }}
              >
                {s.isFrozen ? <><Unlock size={13} /> Unfreeze</> : <><Lock size={13} /> Freeze</>}
              </button>
            </div>
          </Section>

          {/* Guardian */}
          <Section
            title="Guardian"
            icon={<UserCheck size={16} color={s.guardianSet ? '#00e676' : 'rgba(255,255,255,0.4)'} />}
            action={
              s.guardianSet
                ? <button onClick={() => setShowGuardianForm(f => !f)} style={ghostBtnStyle}><Settings size={13} /></button>
                : <button onClick={() => setShowGuardianForm(f => !f)} style={ghostBtnStyle}>{showGuardianForm ? 'Cancel' : '+ Set Guardian'}</button>
            }
          >
            {s.guardianSet ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 24 }}>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 2 }}>GUARDIAN</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 13 }}>{shortKey(s.guardian!)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 2 }}>THRESHOLD</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 13 }}>≥ {formatSol(s.largeWithdrawThreshold)} SOL</div>
                  </div>
                </div>
                {showGuardianForm && (
                  <button
                    disabled={txLoading}
                    onClick={() => run(removeGuardian, 'Guardian removed')}
                    style={{ ...dangerBtnStyle(txLoading), width: 'fit-content' }}
                  >
                    <UserX size={13} /> Remove Guardian
                  </button>
                )}
              </div>
            ) : (
              <>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
                  No guardian set — large withdrawals require no co-signature
                </div>
                {showGuardianForm && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                    <input
                      value={guardianKey} onChange={e => setGuardianKey(e.target.value)}
                      placeholder="Guardian wallet address"
                      style={inputStyle}
                    />
                    <input
                      type="number" min="0" step="0.1"
                      value={guardianThresh} onChange={e => setGuardianThresh(e.target.value)}
                      placeholder="Threshold in SOL (e.g. 5)"
                      style={inputStyle}
                    />
                    <button
                      disabled={txLoading || !guardianKey || !guardianThresh}
                      onClick={() => run(
                        () => setGuardian(guardianKey, Number(guardianThresh)),
                        'Guardian set',
                      )}
                      style={primaryBtnStyle(txLoading || !guardianKey || !guardianThresh)}
                    >
                      {txLoading ? '…' : 'Set Guardian'}
                    </button>
                  </div>
                )}
              </>
            )}
          </Section>

          {/* Footer metadata */}
          <div style={{
            borderTop: '1px solid rgba(0,255,247,0.08)',
            paddingTop: 16,
            display: 'flex', flexWrap: 'wrap', gap: 16,
          }}>
            <Meta label="Vault PDA"      value={shortKey(s.vaultPda)} />
            <Meta label="State PDA"      value={shortKey(s.vaultStatePda)} />
            <Meta label="Delay"          value={s.withdrawalDelay > 0 ? formatSeconds(s.withdrawalDelay) : 'None'} />
            <Meta label="Program"        value={shortKey('EhU2oz3LKPDCVRhRW5TXMeraqVFoSJ3L42cyeC6Ns2eL')} />
            <Meta label="Version"        value={`v${s.version}`} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Section({ title, icon, children, action }: {
  title: string; icon?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'rgba(0,255,247,0.03)',
      border: '1px solid rgba(0,255,247,0.1)',
      borderRadius: 12,
      padding: '16px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {icon}
          <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'monospace' }}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(0,255,247,0.2)',
  borderRadius: 8,
  padding: '9px 12px',
  color: '#fff',
  fontSize: 14,
  fontFamily: 'monospace',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  color: 'rgba(255,255,255,0.7)',
  fontSize: 13,
};

const hintStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.35)',
  fontSize: 11,
};

const primaryBtnStyle = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? 'rgba(0,255,247,0.1)' : '#00fff7',
  color: disabled ? 'rgba(255,255,255,0.4)' : '#000',
  border: 'none',
  borderRadius: 8,
  padding: '9px 18px',
  fontWeight: 700,
  fontSize: 13,
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'monospace',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
});

const dangerBtnStyle = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? 'rgba(255,0,0,0.05)' : 'rgba(255,107,107,0.15)',
  color: disabled ? 'rgba(255,255,255,0.3)' : '#ff6b6b',
  border: `1px solid ${disabled ? 'rgba(255,0,0,0.1)' : '#ff6b6b'}`,
  borderRadius: 8,
  padding: '9px 18px',
  fontWeight: 700,
  fontSize: 13,
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'monospace',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
});

const ghostBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid rgba(0,255,247,0.2)',
  borderRadius: 6,
  padding: '4px 10px',
  color: '#00fff7',
  fontSize: 12,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};
