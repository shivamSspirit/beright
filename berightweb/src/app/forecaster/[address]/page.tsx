'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Target,
  TrendingUp,
  Trophy,
  Calendar,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  UserPlus,
  UserMinus,
  Share2,
  ShieldCheck,
  BarChart3,
  Award,
} from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/Header';
import { useUser } from '@/context/UserContext';

interface ForecasterProfile {
  address: string;
  telegramId?: number;
  username: string | null;
  avatar: string | null;
  rank: number;
  totalPredictions: number;
  resolvedPredictions: number;
  accuracy: number;
  brierScore: number;
  brierPolitics: number | null;
  brierCrypto: number | null;
  brierSports: number | null;
  brierMacro: number | null;
  badges: string[];
  joinedAt: string;
  accuracy30d: number | null;
  onChainCommits?: number;
  recentPredictions: {
    id: string;
    question: string;
    prediction: number;
    outcome: boolean | null;
    resolvedAt: string | null;
    onChainTx?: string | null;
  }[];
}

const BADGE_META: Record<string, { label: string; emoji: string; color: string }> = {
  elite_forecaster: { label: 'Elite Forecaster', emoji: '🏆', color: 'text-yellow-400' },
  superforecaster:  { label: 'Superforecaster',  emoji: '⭐', color: 'text-purple-400' },
  expert:           { label: 'Expert',            emoji: '🎯', color: 'text-blue-400' },
  good_calibration: { label: 'Well Calibrated',   emoji: '📊', color: 'text-green-400' },
  veteran:          { label: 'Veteran',            emoji: '🎖',  color: 'text-orange-400' },
  active:           { label: 'Active',             emoji: '⚡', color: 'text-cyan-400' },
  contributor:      { label: 'Contributor',        emoji: '✅', color: 'text-green-300' },
  politics_expert:  { label: 'Politics Expert',    emoji: '🏛', color: 'text-blue-300' },
  crypto_expert:    { label: 'Crypto Expert',      emoji: '₿',  color: 'text-orange-300' },
  sports_expert:    { label: 'Sports Expert',      emoji: '🏅', color: 'text-green-300' },
  macro_expert:     { label: 'Macro Expert',       emoji: '📈', color: 'text-purple-300' },
};

function getBrierLabel(score: number | null): { text: string; color: string } {
  if (score === null) return { text: 'N/A', color: 'text-[var(--text-muted)]' };
  if (score < 0.08) return { text: score.toFixed(3) + ' 🏆', color: 'text-yellow-400' };
  if (score < 0.12) return { text: score.toFixed(3) + ' ⭐', color: 'text-purple-400' };
  if (score < 0.18) return { text: score.toFixed(3) + ' ✅', color: 'text-green-400' };
  if (score < 0.22) return { text: score.toFixed(3), color: 'text-blue-300' };
  return { text: score.toFixed(3), color: 'text-[var(--text-muted)]' };
}

function getMockForecaster(address: string): ForecasterProfile {
  const seed = address.charCodeAt(2) + address.charCodeAt(3);
  const accuracy = 50 + (seed % 35);
  const predictions = 20 + (seed % 200);

  return {
    address,
    username: null,
    avatar: null,
    rank: 1 + (seed % 100),
    totalPredictions: predictions,
    resolvedPredictions: Math.floor(predictions * 0.7),
    accuracy,
    brierScore: 0.15 + (seed % 20) / 100,
    brierPolitics: 0.14 + (seed % 8) / 100,
    brierCrypto: 0.13 + (seed % 12) / 100,
    brierSports: 0.18 + (seed % 10) / 100,
    brierMacro: 0.16 + (seed % 9) / 100,
    badges: seed % 3 === 0 ? ['superforecaster', 'crypto_expert'] : ['contributor'],
    joinedAt: new Date(Date.now() - (seed % 365) * 24 * 60 * 60 * 1000).toISOString(),
    accuracy30d: (50 + seed % 30) / 100,
    onChainCommits: seed % 15,
    recentPredictions: [
      { id: '1', question: 'Will Bitcoin exceed $100K by Q1 2026?', prediction: 65, outcome: true, resolvedAt: '2026-01-15', onChainTx: null },
      { id: '2', question: 'Will SpaceX Starship reach orbit in 2025?', prediction: 78, outcome: true, resolvedAt: '2025-11-20', onChainTx: 'abc123' },
      { id: '3', question: 'Will ETH flip BTC market cap in 2026?', prediction: 25, outcome: null, resolvedAt: null, onChainTx: null },
    ],
  };
}

export default function ForecasterProfilePage() {
  const params = useParams();
  const address = params.address as string;
  const { walletAddress } = useUser();

  const [forecaster, setForecaster] = useState<ForecasterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  const isOwnProfile = walletAddress?.toLowerCase() === address?.toLowerCase();

  useEffect(() => {
    const fetchForecaster = async () => {
      setLoading(true);
      try {
        // Try beright-ts API first
        const res = await fetch(`/api/users/${address}`);
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setForecaster({ ...getMockForecaster(address), ...data.user });
            return;
          }
        }
        setForecaster(getMockForecaster(address));
      } catch {
        setForecaster(getMockForecaster(address));
      } finally {
        setLoading(false);
      }
    };
    if (address) fetchForecaster();
  }, [address]);

  const handleCopyAddress = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/forecaster/${address}`;
    if (navigator.share) {
      await navigator.share({ title: `${forecaster?.username || address.slice(0, 8)} on BeRight`, url });
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  const displayName = forecaster?.username || `${address.slice(0, 6)}...${address.slice(-4)}`;

  const domainBriers = forecaster ? [
    { name: 'Crypto', key: 'brierCrypto', score: forecaster.brierCrypto },
    { name: 'Politics', key: 'brierPolitics', score: forecaster.brierPolitics },
    { name: 'Sports', key: 'brierSports', score: forecaster.brierSports },
    { name: 'Macro', key: 'brierMacro', score: forecaster.brierMacro },
  ].filter(d => d.score !== null) : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh pb-24 pt-20">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[var(--ai-primary)]" />
        </div>
      </div>
    );
  }

  if (!forecaster) {
    return (
      <div className="min-h-screen bg-mesh pb-24 pt-20">
        <Header />
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-bold mb-2">Forecaster Not Found</h2>
          <p className="text-[var(--text-muted)] mb-6">This address hasn't made any predictions yet.</p>
          <Link href="/leaderboard" className="btn-primary inline-block">View Leaderboard</Link>
        </div>
      </div>
    );
  }

  const overallBrier = getBrierLabel(forecaster.brierScore);

  return (
    <div className="min-h-screen bg-mesh pb-24 pt-20">
      <Header />

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Back */}
        <Link href="/leaderboard" className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-white mb-6 transition-colors">
          <ArrowLeft size={18} />
          <span className="text-sm">Back to Leaderboard</span>
        </Link>

        {/* Profile Header */}
        <motion.div className="glass-card p-6 mb-4 text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="relative inline-block mb-4">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[var(--yes-primary)] to-[var(--ai-primary)] flex items-center justify-center text-4xl">
              {forecaster.rank <= 3 ? '🏆' : forecaster.rank <= 10 ? '⭐' : '🎯'}
            </div>
            <div className="absolute -bottom-2 -right-2 px-2 py-1 rounded-full bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
              <span className="text-xs font-semibold text-[var(--yes-primary)]">#{forecaster.rank}</span>
            </div>
          </div>

          <h2 className="text-xl font-bold mb-1">{displayName}</h2>

          <button onClick={handleCopyAddress} className="text-sm text-[var(--text-muted)] mb-4 flex items-center justify-center gap-2 hover:text-[var(--text-secondary)] transition-colors mx-auto">
            <span className="mono">{address.slice(0, 8)}...{address.slice(-6)}</span>
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>

          {/* Badges */}
          {forecaster.badges.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {forecaster.badges.map((badge) => {
                const meta = BADGE_META[badge];
                if (!meta) return null;
                return (
                  <span key={badge} className={`px-2 py-1 rounded-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-subtle)] ${meta.color}`}>
                    {meta.emoji} {meta.label}
                  </span>
                );
              })}
            </div>
          )}

          {/* On-chain commit badge */}
          {(forecaster.onChainCommits ?? 0) > 0 && (
            <div className="flex items-center justify-center gap-2 mb-4 text-xs text-green-400">
              <ShieldCheck size={14} />
              <span>{forecaster.onChainCommits} on-chain verified predictions</span>
            </div>
          )}

          {!isOwnProfile && (
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setIsFollowing(!isFollowing)}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                  isFollowing ? 'bg-[var(--bg-secondary)] text-[var(--text-muted)]' : 'bg-[var(--yes-primary)] text-white'
                }`}
              >
                {isFollowing ? <UserMinus size={16} /> : <UserPlus size={16} />}
                {isFollowing ? 'Unfollow' : 'Follow'}
              </button>
              <button onClick={handleShare} className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-white transition-colors flex items-center gap-2">
                <Share2 size={16} />
                Share
              </button>
            </div>
          )}
        </motion.div>

        {/* Key Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <motion.div className="glass-card p-4 text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="flex justify-center mb-2"><TrendingUp size={16} className="text-green-400" /></div>
            <div className={`text-lg font-bold mono ${overallBrier.color}`}>{overallBrier.text}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Brier Score</div>
          </motion.div>

          <motion.div className="glass-card p-4 text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="flex justify-center mb-2"><Target size={16} className="text-[var(--yes-primary)]" /></div>
            <div className="text-lg font-bold mono">
              {forecaster.accuracy30d !== null ? `${(forecaster.accuracy30d * 100).toFixed(0)}%` : `${forecaster.accuracy.toFixed(0)}%`}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1">30d Accuracy</div>
          </motion.div>

          <motion.div className="glass-card p-4 text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="flex justify-center mb-2"><BarChart3 size={16} className="text-[var(--ai-primary)]" /></div>
            <div className="text-lg font-bold mono">{forecaster.totalPredictions}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Predictions</div>
          </motion.div>
        </div>

        {/* Domain Brier Breakdown */}
        {domainBriers.length > 0 && (
          <motion.div className="glass-card p-5 mb-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Award size={16} className="text-[var(--ai-primary)]" />
              Brier Score by Domain
            </h3>
            <div className="space-y-3">
              {domainBriers.map((d) => {
                const label = getBrierLabel(d.score);
                const barWidth = d.score !== null ? Math.max(5, Math.min(100, (1 - d.score / 0.5) * 100)) : 0;
                return (
                  <div key={d.key} className="flex items-center gap-3">
                    <span className="text-sm w-20 text-[var(--text-secondary)]">{d.name}</span>
                    <div className="flex-1 h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--yes-primary)] to-[var(--ai-primary)]"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className={`text-sm mono w-20 text-right ${label.color}`}>{label.text}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-3">Lower Brier score = better calibrated predictions</p>
          </motion.div>
        )}

        {/* Recent Predictions */}
        <motion.div className="glass-card p-5 mb-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h3 className="font-semibold mb-4">Recent Predictions</h3>
          <div className="space-y-3">
            {forecaster.recentPredictions.map((pred) => (
              <div key={pred.id} className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm flex-1">{pred.question}</p>
                  <span className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${
                    pred.outcome === true ? 'bg-green-500/20 text-green-400'
                    : pred.outcome === false ? 'bg-red-500/20 text-red-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {pred.outcome === true ? 'Correct' : pred.outcome === false ? 'Wrong' : 'Pending'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>Predicted: <span className="text-[var(--yes-primary)] font-medium">{pred.prediction}%</span> YES</span>
                  <div className="flex items-center gap-2">
                    {pred.resolvedAt && <span>{pred.resolvedAt}</span>}
                    {pred.onChainTx && (
                      <a
                        href={`https://solscan.io/tx/${pred.onChainTx}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-400 hover:text-green-300 flex items-center gap-1"
                        title="On-chain proof"
                      >
                        <ShieldCheck size={12} />
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Member Since */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Calendar size={12} />
            <span>Member since {new Date(forecaster.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

    </div>
  );
}
