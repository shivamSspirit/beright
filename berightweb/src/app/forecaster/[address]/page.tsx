'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Target,
  TrendingUp,
  Flame,
  Trophy,
  Calendar,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  UserPlus,
  UserMinus,
  Share2,
  Bot,
} from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useUser } from '@/context/UserContext';

interface ForecasterProfile {
  address: string;
  username: string | null;
  avatar: string | null;
  rank: number;
  totalPredictions: number;
  resolvedPredictions: number;
  accuracy: number;
  brierScore: number;
  streak: number;
  vsAiWins: number;
  vsAiLosses: number;
  joinedAt: string;
  followers: number;
  following: number;
  categories: { name: string; accuracy: number; count: number }[];
  recentPredictions: {
    id: string;
    question: string;
    prediction: number;
    outcome: boolean | null;
    resolvedAt: string | null;
  }[];
}

// Mock forecaster data generator
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
    streak: seed % 12,
    vsAiWins: Math.floor(predictions * 0.3),
    vsAiLosses: Math.floor(predictions * 0.25),
    joinedAt: new Date(Date.now() - (seed % 365) * 24 * 60 * 60 * 1000).toISOString(),
    followers: seed * 3,
    following: seed * 2,
    categories: [
      { name: 'Crypto', accuracy: accuracy + (seed % 10) - 5, count: Math.floor(predictions * 0.3) },
      { name: 'Politics', accuracy: accuracy + (seed % 8) - 4, count: Math.floor(predictions * 0.25) },
      { name: 'Tech', accuracy: accuracy + (seed % 12) - 6, count: Math.floor(predictions * 0.2) },
      { name: 'Economics', accuracy: accuracy + (seed % 6) - 3, count: Math.floor(predictions * 0.15) },
      { name: 'Sports', accuracy: accuracy + (seed % 14) - 7, count: Math.floor(predictions * 0.1) },
    ],
    recentPredictions: [
      {
        id: '1',
        question: 'Will Bitcoin exceed $100K by Q1 2026?',
        prediction: 65,
        outcome: true,
        resolvedAt: '2026-01-15',
      },
      {
        id: '2',
        question: 'Will SpaceX Starship reach orbit in 2025?',
        prediction: 78,
        outcome: true,
        resolvedAt: '2025-11-20',
      },
      {
        id: '3',
        question: 'Will ETH flip BTC market cap in 2026?',
        prediction: 25,
        outcome: null,
        resolvedAt: null,
      },
      {
        id: '4',
        question: 'Will Fed cut rates in March 2026?',
        prediction: 55,
        outcome: null,
        resolvedAt: null,
      },
    ],
  };
}

export default function ForecasterProfilePage() {
  const params = useParams();
  const address = params.address as string;
  const { walletAddress, isAuthenticated } = useUser();

  const [forecaster, setForecaster] = useState<ForecasterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  const isOwnProfile = walletAddress?.toLowerCase() === address?.toLowerCase();

  useEffect(() => {
    const fetchForecaster = async () => {
      setLoading(true);
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${API_BASE}/api/users/${address}`);

        if (res.ok) {
          const data = await res.json();
          setForecaster(data.user);
        } else {
          // Use mock data
          setForecaster(getMockForecaster(address));
        }
      } catch {
        // Use mock data
        setForecaster(getMockForecaster(address));
      } finally {
        setLoading(false);
      }
    };

    if (address) {
      fetchForecaster();
    }
  }, [address]);

  const handleCopyAddress = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFollow = () => {
    setIsFollowing(!isFollowing);
    // TODO: Call API to follow/unfollow
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/forecaster/${address}`;
    if (navigator.share) {
      await navigator.share({
        title: `${forecaster?.username || address.slice(0, 8)} on BeRight`,
        text: `Check out this forecaster's predictions on BeRight!`,
        url,
      });
    } else {
      await navigator.clipboard.writeText(url);
      alert('Profile link copied!');
    }
  };

  const displayName = forecaster?.username || `${address.slice(0, 6)}...${address.slice(-4)}`;
  const vsAiWinRate = forecaster
    ? Math.round((forecaster.vsAiWins / (forecaster.vsAiWins + forecaster.vsAiLosses)) * 100)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh pb-24 pt-20">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[var(--ai-primary)]" />
        </div>
        <BottomNav />
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
          <Link href="/leaderboard" className="btn-primary inline-block">
            View Leaderboard
          </Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh pb-24 pt-20">
      <Header />

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Back Button */}
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back to Leaderboard</span>
        </Link>

        {/* Profile Header */}
        <motion.div
          className="glass-card p-6 mb-6 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Avatar */}
          <div className="relative inline-block mb-4">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[var(--yes-primary)] to-[var(--ai-primary)] flex items-center justify-center text-4xl">
              {forecaster.rank <= 3 ? '🏆' : forecaster.rank <= 10 ? '⭐' : '🎯'}
            </div>
            <div className="absolute -bottom-2 -right-2 px-2 py-1 rounded-full bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
              <span className="text-xs font-semibold text-[var(--yes-primary)]">#{forecaster.rank}</span>
            </div>
          </div>

          <h2 className="text-xl font-bold mb-1">{displayName}</h2>

          <button
            onClick={handleCopyAddress}
            className="text-sm text-[var(--text-muted)] mb-4 flex items-center justify-center gap-2 hover:text-[var(--text-secondary)] transition-colors mx-auto"
          >
            <span className="mono">{address.slice(0, 8)}...{address.slice(-6)}</span>
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>

          {/* Follow/Share Buttons */}
          {!isOwnProfile && (
            <div className="flex gap-3 justify-center mb-4">
              <button
                onClick={handleFollow}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                  isFollowing
                    ? 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                    : 'bg-[var(--yes-primary)] text-white'
                }`}
              >
                {isFollowing ? <UserMinus size={16} /> : <UserPlus size={16} />}
                {isFollowing ? 'Unfollow' : 'Follow'}
              </button>
              <button
                onClick={handleShare}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-white transition-colors flex items-center gap-2"
              >
                <Share2 size={16} />
                Share
              </button>
            </div>
          )}

          {/* Followers/Following */}
          <div className="flex justify-center gap-8 text-sm">
            <div>
              <span className="font-bold">{forecaster.followers}</span>
              <span className="text-[var(--text-muted)] ml-1">followers</span>
            </div>
            <div>
              <span className="font-bold">{forecaster.following}</span>
              <span className="text-[var(--text-muted)] ml-1">following</span>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <motion.div
            className="glass-card p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Target size={16} className="text-[var(--yes-primary)]" />
              <span className="text-xs text-[var(--text-muted)]">Accuracy</span>
            </div>
            <div className="text-2xl font-bold mono">{forecaster.accuracy.toFixed(1)}%</div>
            <div className="text-xs text-[var(--text-muted)]">{forecaster.resolvedPredictions} resolved</div>
          </motion.div>

          <motion.div
            className="glass-card p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-green-400" />
              <span className="text-xs text-[var(--text-muted)]">Brier Score</span>
            </div>
            <div className="text-2xl font-bold mono">{forecaster.brierScore.toFixed(3)}</div>
            <div className="text-xs text-green-400">Lower is better</div>
          </motion.div>

          <motion.div
            className="glass-card p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Bot size={16} className="text-[var(--ai-primary)]" />
              <span className="text-xs text-[var(--text-muted)]">vs AI</span>
            </div>
            <div className="text-2xl font-bold mono">
              <span className="text-green-400">{forecaster.vsAiWins}</span>
              <span className="text-[var(--text-muted)]">-</span>
              <span className="text-[var(--no-primary)]">{forecaster.vsAiLosses}</span>
            </div>
            <div className="text-xs text-[var(--text-muted)]">{vsAiWinRate}% win rate</div>
          </motion.div>

          <motion.div
            className="glass-card p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Flame size={16} className="text-orange-400" />
              <span className="text-xs text-[var(--text-muted)]">Streak</span>
            </div>
            <div className="text-2xl font-bold mono text-orange-400">{forecaster.streak}</div>
            <div className="text-xs text-[var(--text-muted)]">Current</div>
          </motion.div>
        </div>

        {/* Category Breakdown */}
        <motion.div
          className="glass-card p-5 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="font-semibold mb-4">Performance by Category</h3>
          <div className="space-y-3">
            {forecaster.categories.map((cat, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm w-24 truncate">{cat.name}</span>
                <div className="flex-1 h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--yes-primary)] rounded-full"
                    style={{ width: `${cat.accuracy}%` }}
                  />
                </div>
                <span
                  className={`text-sm mono w-12 text-right ${
                    cat.accuracy >= 65 ? 'text-green-400' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {cat.accuracy}%
                </span>
                <span className="text-xs text-[var(--text-muted)] w-8 text-right">({cat.count})</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Predictions */}
        <motion.div
          className="glass-card p-5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <h3 className="font-semibold mb-4">Recent Predictions</h3>
          <div className="space-y-3">
            {forecaster.recentPredictions.map((pred) => (
              <div
                key={pred.id}
                className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm flex-1">{pred.question}</p>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      pred.outcome === true
                        ? 'bg-green-500/20 text-green-400'
                        : pred.outcome === false
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}
                  >
                    {pred.outcome === true ? 'Correct' : pred.outcome === false ? 'Wrong' : 'Pending'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>
                    Predicted: <span className="text-[var(--yes-primary)] font-medium">{pred.prediction}%</span> YES
                  </span>
                  {pred.resolvedAt && <span>Resolved {pred.resolvedAt}</span>}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Member Since */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Calendar size={12} />
            <span>
              Member since {new Date(forecaster.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
