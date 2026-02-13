'use client';

import { useState, useEffect, useRef } from 'react';
import { Crown, Medal, Award, Flame, ChevronRight, TrendingUp, Target, Zap, Share2, X } from 'lucide-react';
import { useLeaderboard, useBackendStatus } from '@/hooks/useMarkets';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';

// Avatar emojis for users
const avatars = ['🎯', '🔮', '📊', '🎲', '📈', '⚡', '👑', '🧠', '🚀', '💎', '🦁', '🐺', '🦊', '🦅', '🐋'];
const getAvatar = (index: number): string => avatars[index % avatars.length];

// League tiers
const leagues = [
  { name: 'Bronze', minXP: 0, color: '#CD7F32', icon: '🥉' },
  { name: 'Silver', minXP: 500, color: '#C0C0C0', icon: '🥈' },
  { name: 'Gold', minXP: 1000, color: '#FFD700', icon: '🥇' },
  { name: 'Platinum', minXP: 2500, color: '#E5E4E2', icon: '💎' },
  { name: 'Diamond', minXP: 5000, color: '#B9F2FF', icon: '💠' },
];

type RankingDimension = 'profit' | 'accuracy' | 'streak' | 'alpha';
type TimeFilter = 'today' | 'week' | 'month' | 'all';

interface LeaderboardUser {
  rank: number;
  displayName: string;
  avatar: string;
  avatarUrl: string | null;
  walletAddress: string | null;
  profit: number;
  accuracy: number;
  streak: number;
  alpha: number;
  predictions: number;
  xp: number;
  league: string;
  change: number;
}

export default function LeaderboardPage() {
  const { isConnected } = useBackendStatus();
  const { data, loading, usingMock } = useLeaderboard({ limit: 50 });
  const [activeTab, setActiveTab] = useState<RankingDimension>('accuracy');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [showNudge, setShowNudge] = useState(true);
  const podiumRef = useRef<HTMLDivElement>(null);

  // Transform API data to LeaderboardUser format
  const leaderboardData: LeaderboardUser[] = (data?.leaderboard || []).map((entry, index) => {
    // Get display name: username > truncated wallet > "User X"
    const walletAddr = entry.walletAddress || entry.wallet_address;
    const username = entry.username || entry.displayName;
    const displayName = username
      ? username
      : walletAddr
        ? `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}`
        : `User ${index + 1}`;

    return {
      rank: entry.rank || index + 1,
      displayName,
      avatar: getAvatar(index),
      avatarUrl: entry.avatarUrl || entry.avatar_url || null,
      walletAddress: walletAddr || null,
      profit: 0, // Not available from API yet
      accuracy: entry.accuracy || 0,
      streak: entry.streak || 0,
      alpha: 0, // Not available from API yet
      predictions: entry.predictions || 0,
      xp: Math.floor((entry.accuracy || 0) * 10 + (entry.predictions || 0) * 5),
      league: entry.accuracy >= 80 ? 'Diamond' : entry.accuracy >= 70 ? 'Platinum' : entry.accuracy >= 60 ? 'Gold' : 'Silver',
      change: 0, // Not available from API yet
    };
  });

  // Get sorted data based on active dimension
  const getSortedData = () => {
    const sorted = [...leaderboardData].sort((a, b) => {
      switch (activeTab) {
        case 'accuracy': return b.accuracy - a.accuracy;
        case 'streak': return b.streak - a.streak;
        case 'profit': return b.profit - a.profit;
        case 'alpha': return b.alpha - a.alpha;
        default: return b.accuracy - a.accuracy;
      }
    });
    return sorted.map((user, i) => ({ ...user, rank: i + 1 }));
  };

  const sortedData = getSortedData();
  const podium = sortedData.slice(0, 3);
  const restOfList = sortedData.slice(3, 20);

  // Current user data from API
  const currentUser: LeaderboardUser = data?.userStats ? {
    rank: data.userRank || 0,
    displayName: 'You',
    avatar: '🎯',
    avatarUrl: data.userStats.avatarUrl || null,
    walletAddress: data.userStats.walletAddress || null,
    profit: 0,
    accuracy: data.userStats.accuracy || 0,
    streak: data.userStats.streak || 0,
    alpha: 0,
    predictions: data.userStats.predictions || 0,
    xp: Math.floor((data.userStats.accuracy || 0) * 10 + (data.userStats.predictions || 0) * 5),
    league: (data.userStats.accuracy || 0) >= 80 ? 'Diamond' : (data.userStats.accuracy || 0) >= 70 ? 'Platinum' : (data.userStats.accuracy || 0) >= 60 ? 'Gold' : 'Silver',
    change: 0,
  } : {
    rank: 0,
    displayName: 'You',
    avatar: '🎯',
    avatarUrl: null,
    walletAddress: null,
    profit: 0,
    accuracy: 0,
    streak: 0,
    alpha: 0,
    predictions: 0,
    xp: 0,
    league: 'Bronze',
    change: 0,
  };

  // Calculate proximity to next rank milestone
  const xpToNextRank = 1000 - currentUser.xp;
  const progressToNextRank = (currentUser.xp / 1000) * 100;

  // Get metric value based on active tab
  const getMetricValue = (user: LeaderboardUser) => {
    switch (activeTab) {
      case 'accuracy': return `${user.accuracy.toFixed(1)}%`;
      case 'streak': return `${user.streak}`;
      case 'profit': return user.profit > 0 ? `+$${user.profit.toLocaleString()}` : '-';
      case 'alpha': return user.alpha > 0 ? `${user.alpha}%` : '-';
      default: return `${user.accuracy.toFixed(1)}%`;
    }
  };

  const getMetricLabel = () => {
    switch (activeTab) {
      case 'profit': return 'Profit';
      case 'accuracy': return 'Accuracy';
      case 'streak': return 'Streak';
      case 'alpha': return 'Alpha';
      default: return 'Profit';
    }
  };

  return (
    <div className="leaderboard-page">
      {/* Header */}
      <header className="lb-header">
        <div className="lb-header-content">
          <Link href="/" className="lb-back">
            <ChevronRight className="rotate-180" size={20} />
          </Link>
          <div className="lb-title">
            <h1>Leaderboard</h1>
            <span className="lb-badge">
              {isConnected ? 'Live' : 'Demo'}
            </span>
          </div>
          <button className="share-btn" aria-label="Share">
            <Share2 size={18} />
          </button>
        </div>

        {/* Dimension Tabs */}
        <div className="dimension-tabs">
          {[
            { key: 'profit', label: 'Profit', icon: TrendingUp },
            { key: 'accuracy', label: 'Accuracy', icon: Target },
            { key: 'streak', label: 'Streak', icon: Flame },
            { key: 'alpha', label: 'Alpha', icon: Zap },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                className={`dim-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key as RankingDimension)}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Time Filter */}
        <div className="time-filters">
          {[
            { key: 'today', label: 'Today' },
            { key: 'week', label: 'This Week' },
            { key: 'month', label: 'This Month' },
            { key: 'all', label: 'All Time' },
          ].map((filter) => (
            <button
              key={filter.key}
              className={`time-pill ${timeFilter === filter.key ? 'active' : ''}`}
              onClick={() => setTimeFilter(filter.key as TimeFilter)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="lb-main">
        {/* Proximity Nudge */}
        {showNudge && currentUser.rank > 0 && currentUser.rank <= 50 && (
          <div className="nudge-banner">
            <div className="nudge-content">
              <span className="nudge-icon">🔥</span>
              <span className="nudge-text">
                You're ranked <strong>#{currentUser.rank}</strong> - keep predicting to climb higher!
              </span>
            </div>
            <button className="nudge-close" onClick={() => setShowNudge(false)}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="lb-loading">
            <div className="lb-spinner" />
            <span>Loading rankings...</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && leaderboardData.length === 0 && (
          <div className="lb-empty">
            <span className="empty-icon">📊</span>
            <span className="empty-text">No leaderboard data available yet</span>
            <span className="empty-sub">Make predictions to appear on the leaderboard</span>
          </div>
        )}

        {/* Podium - Top 3 */}
        {!loading && podium.length >= 3 && (
          <div className="podium-section" ref={podiumRef}>
            <div className="podium">
              {/* 2nd Place - Left */}
              <div className="podium-item second">
                <div className="podium-rank">2</div>
                <div className="podium-avatar silver">
                  {podium[1].avatarUrl ? (
                    <img src={podium[1].avatarUrl} alt="" className="avatar-img" />
                  ) : (
                    <span className="avatar-emoji">{podium[1].avatar}</span>
                  )}
                  <Medal className="rank-icon" size={16} />
                </div>
                <span className="podium-name">{podium[1].displayName}</span>
                <span className="podium-metric">{getMetricValue(podium[1])}</span>
                {podium[1].streak >= 5 && (
                  <span className="podium-streak">
                    <Flame size={10} />
                    {podium[1].streak}
                  </span>
                )}
              </div>

              {/* 1st Place - Center */}
              <div className="podium-item first">
                <div className="crown-container">
                  <Crown className="crown" size={28} />
                </div>
                <div className="podium-rank">1</div>
                <div className="podium-avatar gold">
                  {podium[0].avatarUrl ? (
                    <img src={podium[0].avatarUrl} alt="" className="avatar-img" />
                  ) : (
                    <span className="avatar-emoji">{podium[0].avatar}</span>
                  )}
                  <div className="glow-ring" />
                </div>
                <span className="podium-name">{podium[0].displayName}</span>
                <span className="podium-metric hero">{getMetricValue(podium[0])}</span>
                {podium[0].streak >= 5 && (
                  <span className="podium-streak fire">
                    <Flame size={12} />
                    {podium[0].streak}
                  </span>
                )}
                <span className="podium-league">{podium[0].league} League</span>
              </div>

              {/* 3rd Place - Right */}
              <div className="podium-item third">
                <div className="podium-rank">3</div>
                <div className="podium-avatar bronze">
                  {podium[2].avatarUrl ? (
                    <img src={podium[2].avatarUrl} alt="" className="avatar-img" />
                  ) : (
                    <span className="avatar-emoji">{podium[2].avatar}</span>
                  )}
                  <Award className="rank-icon" size={16} />
                </div>
                <span className="podium-name">{podium[2].displayName}</span>
                <span className="podium-metric">{getMetricValue(podium[2])}</span>
                {podium[2].streak >= 5 && (
                  <span className="podium-streak">
                    <Flame size={10} />
                    {podium[2].streak}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Your Rank Card */}
        <div className="your-rank-card">
          <div className="rank-card-header">
            <div className="your-rank-info">
              <span className="your-rank-label">Your Rank</span>
              <div className="your-rank-display">
                <span className="your-rank-num">#{currentUser.rank}</span>
                <span className={`rank-change ${currentUser.change >= 0 ? 'up' : 'down'}`}>
                  {currentUser.change >= 0 ? '↑' : '↓'} {Math.abs(currentUser.change)}
                </span>
              </div>
            </div>
            <div className="your-league">
              <span className="league-icon">🥇</span>
              <span className="league-name">{currentUser.league}</span>
            </div>
          </div>

          <div className="your-stats-row">
            <div className="stat-item">
              <span className="stat-val">{currentUser.predictions}</span>
              <span className="stat-label">Predictions</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-val green">{currentUser.accuracy.toFixed(1)}%</span>
              <span className="stat-label">Accuracy</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-val fire">
                <Flame size={12} className="inline" />
                {currentUser.streak}
              </span>
              <span className="stat-label">Streak</span>
            </div>
          </div>

          {/* XP Progress */}
          <div className="xp-progress">
            <div className="xp-header">
              <span className="xp-label">{currentUser.xp} XP</span>
              <span className="xp-target">{xpToNextRank} XP to Platinum</span>
            </div>
            <div className="xp-bar">
              <div className="xp-fill" style={{ width: `${progressToNextRank}%` }} />
            </div>
          </div>

        </div>

        {/* Rankings List */}
        {!loading && restOfList.length > 0 && (
          <div className="rankings-section">
            <div className="rankings-header">
              <span className="rankings-title">Top Traders</span>
              <span className="metric-label">{getMetricLabel()}</span>
            </div>
            <div className="rankings-list">
              {restOfList.map((user, index) => (
                <div
                  key={user.rank}
                  className={`rank-item ${user.displayName === 'You' ? 'is-you' : ''}`}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="rank-left">
                    <span className="rank-number">{user.rank}</span>
                    <div className={`rank-change-indicator ${user.change >= 0 ? 'up' : 'down'}`}>
                      {user.change >= 0 ? '↑' : '↓'}
                    </div>
                  </div>
                  <div className="rank-avatar">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="rank-avatar-img" />
                    ) : (
                      user.avatar
                    )}
                  </div>
                  <div className="rank-info">
                    <span className="rank-name">{user.displayName}</span>
                    <span className="rank-predictions">{user.predictions} trades</span>
                  </div>
                  <div className="rank-stats">
                    <span className={`rank-metric ${activeTab === 'profit' ? 'green' : ''}`}>
                      {getMetricValue(user)}
                    </span>
                    {user.streak >= 5 && (
                      <span className="rank-streak">
                        <Flame size={10} />
                        {user.streak}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Share CTA */}
        <div className="share-cta">
          <button className="share-rank-btn">
            <Share2 size={18} />
            <span>Share Your Rank</span>
          </button>
          <p className="share-desc">Generate an Instagram-ready stat card</p>
        </div>

        {/* Demo indicator */}
        {usingMock && (
          <div className="lb-demo-badge">
            Demo data
          </div>
        )}
      </main>

      <BottomNav />

      <style jsx>{`
        .leaderboard-page {
          min-height: 100dvh;
          background: #0A0A0F;
          padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           HEADER
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .lb-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(10, 10, 15, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: env(safe-area-inset-top, 0px);
        }

        .lb-header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px 10px;
          max-width: 600px;
          margin: 0 auto;
        }

        .lb-back {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.6);
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          transition: all 0.2s;
        }

        .lb-back:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.08);
        }

        .lb-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .lb-title h1 {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin: 0;
          letter-spacing: -0.02em;
        }

        .lb-badge {
          padding: 4px 10px;
          background: rgba(0, 230, 118, 0.15);
          color: #00E676;
          font-size: 10px;
          font-weight: 600;
          border-radius: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .share-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.6);
          background: rgba(255, 255, 255, 0.05);
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .share-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }

        /* Dimension Tabs */
        .dimension-tabs {
          display: flex;
          gap: 6px;
          padding: 0 16px;
          max-width: 600px;
          margin: 0 auto;
          overflow-x: auto;
          scrollbar-width: none;
        }

        .dimension-tabs::-webkit-scrollbar {
          display: none;
        }

        .dim-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .dim-tab:hover {
          color: rgba(255, 255, 255, 0.8);
          background: rgba(255, 255, 255, 0.06);
        }

        .dim-tab.active {
          color: #000;
          background: #00E676;
          border-color: #00E676;
        }

        .dim-tab.active svg {
          color: #000;
        }

        /* Time Filters */
        .time-filters {
          display: flex;
          gap: 4px;
          padding: 12px 16px;
          max-width: 600px;
          margin: 0 auto;
          overflow-x: auto;
          scrollbar-width: none;
        }

        .time-filters::-webkit-scrollbar {
          display: none;
        }

        .time-pill {
          padding: 6px 12px;
          font-size: 11px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.4);
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .time-pill:hover {
          color: rgba(255, 255, 255, 0.7);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .time-pill.active {
          color: #fff;
          background: rgba(99, 102, 241, 0.2);
          border-color: rgba(99, 102, 241, 0.4);
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           MAIN
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .lb-main {
          max-width: 600px;
          margin: 0 auto;
          padding: 16px;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           NUDGE BANNER
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .nudge-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          background: linear-gradient(135deg, rgba(255, 149, 0, 0.15), rgba(255, 107, 53, 0.1));
          border: 1px solid rgba(255, 149, 0, 0.3);
          border-radius: 12px;
          margin-bottom: 16px;
          animation: nudgePulse 3s ease-in-out infinite;
        }

        @keyframes nudgePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 149, 0, 0.2); }
          50% { box-shadow: 0 0 20px 4px rgba(255, 149, 0, 0.15); }
        }

        .nudge-content {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .nudge-icon {
          font-size: 18px;
          animation: fireFlicker 0.5s ease-in-out infinite alternate;
        }

        @keyframes fireFlicker {
          from { transform: scale(1) rotate(-3deg); }
          to { transform: scale(1.1) rotate(3deg); }
        }

        .nudge-text {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.9);
        }

        .nudge-text strong {
          color: #FF9500;
        }

        .nudge-close {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.05);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .nudge-close:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           LOADING
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .lb-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 50px 20px;
          gap: 14px;
          color: rgba(255, 255, 255, 0.4);
          font-size: 13px;
        }

        .lb-spinner {
          width: 28px;
          height: 28px;
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-top-color: #00E676;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .lb-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          gap: 12px;
          text-align: center;
        }

        .empty-icon {
          font-size: 48px;
          opacity: 0.6;
        }

        .empty-text {
          font-size: 16px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
        }

        .empty-sub {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.4);
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           PODIUM
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .podium-section {
          margin-bottom: 20px;
          padding: 16px 0;
        }

        .podium {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 12px;
        }

        .podium-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          animation: podiumEnter 0.5s ease-out backwards;
        }

        .podium-item.second { animation-delay: 100ms; }
        .podium-item.first { animation-delay: 0ms; }
        .podium-item.third { animation-delay: 200ms; }

        @keyframes podiumEnter {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .podium-rank {
          font-size: 11px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.3);
          margin-bottom: 4px;
        }

        .crown-container {
          position: absolute;
          top: -16px;
          animation: crownBounce 2s ease-in-out infinite;
        }

        @keyframes crownBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }

        .crown {
          color: #FFD700;
          filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.6));
        }

        .podium-avatar {
          position: relative;
          width: 60px;
          height: 60px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid;
        }

        .podium-item.first .podium-avatar {
          width: 80px;
          height: 80px;
          border-radius: 24px;
        }

        .podium-avatar.gold {
          background: linear-gradient(145deg, rgba(255, 215, 0, 0.25), rgba(255, 193, 7, 0.15));
          border-color: #FFD700;
          box-shadow: 0 0 30px rgba(255, 215, 0, 0.4), inset 0 0 20px rgba(255, 215, 0, 0.1);
        }

        .podium-avatar.silver {
          background: linear-gradient(145deg, rgba(192, 192, 192, 0.2), rgba(156, 163, 175, 0.1));
          border-color: #C0C0C0;
        }

        .podium-avatar.bronze {
          background: linear-gradient(145deg, rgba(205, 127, 50, 0.2), rgba(180, 83, 9, 0.1));
          border-color: #CD7F32;
        }

        .glow-ring {
          position: absolute;
          inset: -4px;
          border-radius: 28px;
          border: 2px solid rgba(255, 215, 0, 0.3);
          animation: glowPulse 2s ease-in-out infinite;
        }

        @keyframes glowPulse {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
        }

        .avatar-emoji {
          font-size: 28px;
        }

        .podium-item.first .avatar-emoji {
          font-size: 38px;
        }

        .avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: inherit;
        }

        .rank-icon {
          position: absolute;
          bottom: -6px;
          right: -6px;
          padding: 3px;
          background: #12121A;
          border-radius: 50%;
        }

        .podium-item.second .rank-icon {
          color: #C0C0C0;
        }

        .podium-item.third .rank-icon {
          color: #CD7F32;
        }

        .podium-name {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          max-width: 80px;
          text-align: center;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .podium-item.first .podium-name {
          font-size: 15px;
        }

        .podium-metric {
          font-size: 14px;
          font-weight: 700;
          color: #00E676;
          font-family: var(--font-mono, 'JetBrains Mono', monospace);
        }

        .podium-metric.hero {
          font-size: 20px;
          text-shadow: 0 0 20px rgba(0, 230, 118, 0.5);
        }

        .podium-streak {
          display: flex;
          align-items: center;
          gap: 3px;
          padding: 3px 8px;
          background: rgba(255, 107, 53, 0.15);
          color: #FF6B35;
          font-size: 11px;
          font-weight: 600;
          border-radius: 10px;
        }

        .podium-streak.fire {
          background: rgba(255, 107, 53, 0.25);
          box-shadow: 0 0 12px rgba(255, 107, 53, 0.3);
          animation: fireGlow 1.5s ease-in-out infinite;
        }

        @keyframes fireGlow {
          0%, 100% { box-shadow: 0 0 12px rgba(255, 107, 53, 0.3); }
          50% { box-shadow: 0 0 20px rgba(255, 107, 53, 0.5); }
        }

        .podium-league {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          margin-top: 2px;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           YOUR RANK CARD
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .your-rank-card {
          background: linear-gradient(145deg, #18182A, #12121F);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 16px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .rank-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .your-rank-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .your-rank-display {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin-top: 4px;
        }

        .your-rank-num {
          font-size: 32px;
          font-weight: 800;
          color: #fff;
          font-family: var(--font-mono, 'JetBrains Mono', monospace);
        }

        .rank-change {
          font-size: 13px;
          font-weight: 600;
          font-family: var(--font-mono, monospace);
        }

        .rank-change.up {
          color: #00E676;
        }

        .rank-change.down {
          color: #FF5252;
        }

        .your-league {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(255, 215, 0, 0.1);
          border: 1px solid rgba(255, 215, 0, 0.25);
          border-radius: 10px;
        }

        .league-icon {
          font-size: 16px;
        }

        .league-name {
          font-size: 12px;
          font-weight: 600;
          color: #FFD700;
        }

        .your-stats-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 0;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          margin-bottom: 14px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          flex: 1;
        }

        .stat-val {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          font-family: var(--font-mono, monospace);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .stat-val.green {
          color: #00E676;
        }

        .stat-val.fire {
          color: #FF9500;
        }

        .stat-label {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-divider {
          width: 1px;
          height: 32px;
          background: rgba(255, 255, 255, 0.08);
        }

        /* XP Progress */
        .xp-progress {
          margin-bottom: 14px;
        }

        .xp-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .xp-label {
          font-size: 12px;
          font-weight: 600;
          color: #6366F1;
        }

        .xp-target {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
        }

        .xp-bar {
          height: 8px;
          background: rgba(99, 102, 241, 0.15);
          border-radius: 4px;
          overflow: hidden;
        }

        .xp-fill {
          height: 100%;
          background: linear-gradient(90deg, #6366F1, #818CF8);
          border-radius: 4px;
          transition: width 0.5s ease;
        }

        /* Rival Section */
        .rival-section {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 12px;
          padding: 12px;
        }

        .rival-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .rival-label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.6);
        }

        .rival-name {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
        }

        .rival-compare {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
        }

        .rival-stat {
          flex: 1;
          text-align: center;
        }

        .you-val {
          font-size: 15px;
          font-weight: 700;
          color: #00E676;
          font-family: var(--font-mono, monospace);
          display: block;
        }

        .rival-val {
          font-size: 15px;
          font-weight: 700;
          color: #FF5252;
          font-family: var(--font-mono, monospace);
          display: block;
        }

        .compare-label {
          font-size: 9px;
          color: rgba(255, 255, 255, 0.35);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .rival-vs {
          font-size: 10px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.2);
        }

        .rival-gap {
          text-align: center;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
        }

        .gap-amount {
          color: #FF5252;
          font-weight: 600;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           RANKINGS LIST
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .rankings-section {
          margin-bottom: 24px;
        }

        .rankings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .rankings-title {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.6);
        }

        .metric-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.3);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .rankings-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .rank-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 12px;
          transition: all 0.2s;
          animation: rankEnter 0.3s ease-out backwards;
        }

        @keyframes rankEnter {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .rank-item:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.08);
        }

        .rank-item.is-you {
          background: rgba(99, 102, 241, 0.1);
          border-color: rgba(99, 102, 241, 0.3);
        }

        .rank-left {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          width: 28px;
        }

        .rank-number {
          font-size: 13px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.5);
          font-family: var(--font-mono, monospace);
        }

        .rank-change-indicator {
          font-size: 9px;
          font-weight: 600;
        }

        .rank-change-indicator.up {
          color: #00E676;
        }

        .rank-change-indicator.down {
          color: #FF5252;
        }

        .rank-avatar {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          font-size: 18px;
          overflow: hidden;
        }

        .rank-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .rank-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .rank-name {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .rank-predictions {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.35);
        }

        .rank-stats {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }

        .rank-metric {
          font-size: 14px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.8);
          font-family: var(--font-mono, monospace);
        }

        .rank-metric.green {
          color: #00E676;
        }

        .rank-streak {
          display: flex;
          align-items: center;
          gap: 3px;
          padding: 2px 6px;
          background: rgba(255, 107, 53, 0.15);
          color: #FF6B35;
          font-size: 10px;
          font-weight: 600;
          border-radius: 6px;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           SHARE CTA
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .share-cta {
          text-align: center;
          padding: 20px;
          margin-top: 12px;
        }

        .share-rank-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          background: linear-gradient(135deg, #6366F1, #818CF8);
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .share-rank-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(99, 102, 241, 0.4);
        }

        .share-rank-btn:active {
          transform: scale(0.98);
        }

        .share-desc {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.35);
          margin-top: 10px;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           DEMO BADGE
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .lb-demo-badge {
          text-align: center;
          padding: 14px;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.3);
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           RESPONSIVE
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        @media (max-width: 359px) {
          .lb-header-content {
            padding: 10px 12px 8px;
          }

          .lb-title h1 {
            font-size: 16px;
          }

          .dimension-tabs {
            padding: 0 12px;
            gap: 4px;
          }

          .dim-tab {
            padding: 6px 10px;
            font-size: 11px;
          }

          .time-filters {
            padding: 10px 12px;
          }

          .time-pill {
            padding: 5px 10px;
            font-size: 10px;
          }

          .lb-main {
            padding: 12px;
          }

          .nudge-banner {
            padding: 10px;
          }

          .nudge-text {
            font-size: 11px;
          }

          .podium {
            gap: 8px;
          }

          .podium-avatar {
            width: 50px;
            height: 50px;
            border-radius: 14px;
          }

          .podium-item.first .podium-avatar {
            width: 66px;
            height: 66px;
            border-radius: 18px;
          }

          .avatar-emoji {
            font-size: 22px;
          }

          .podium-item.first .avatar-emoji {
            font-size: 30px;
          }

          .podium-name {
            font-size: 11px;
            max-width: 60px;
          }

          .podium-metric {
            font-size: 12px;
          }

          .podium-metric.hero {
            font-size: 16px;
          }

          .your-rank-card {
            padding: 12px;
          }

          .your-rank-num {
            font-size: 26px;
          }

          .stat-val {
            font-size: 14px;
          }

          .rank-item {
            padding: 10px;
          }

          .rank-avatar {
            width: 32px;
            height: 32px;
            font-size: 16px;
          }

          .rank-name {
            font-size: 12px;
          }

          .rank-metric {
            font-size: 12px;
          }
        }

        @media (min-width: 640px) {
          .lb-header-content {
            max-width: 700px;
            padding: 16px 24px 12px;
          }

          .lb-main {
            max-width: 700px;
            padding: 20px 24px;
          }

          .podium {
            gap: 20px;
            padding: 24px 0;
          }

          .podium-avatar {
            width: 70px;
            height: 70px;
          }

          .podium-item.first .podium-avatar {
            width: 94px;
            height: 94px;
          }

          .avatar-emoji {
            font-size: 32px;
          }

          .podium-item.first .avatar-emoji {
            font-size: 44px;
          }

          .podium-name {
            font-size: 14px;
            max-width: 100px;
          }

          .podium-metric.hero {
            font-size: 24px;
          }
        }

        @media (min-width: 768px) {
          .lb-header-content,
          .lb-main,
          .dimension-tabs,
          .time-filters {
            max-width: 800px;
          }

          .your-rank-num {
            font-size: 36px;
          }
        }

        @media (min-width: 1024px) {
          .lb-header-content,
          .lb-main,
          .dimension-tabs,
          .time-filters {
            max-width: 900px;
          }

          .dim-tab:hover {
            transform: translateY(-1px);
          }

          .rank-item:hover {
            transform: translateX(4px);
          }
        }

        @media (max-height: 500px) and (orientation: landscape) {
          .lb-header {
            position: relative;
          }

          .podium {
            padding: 12px 0;
            gap: 16px;
          }

          .podium-avatar {
            width: 50px;
            height: 50px;
          }

          .podium-item.first .podium-avatar {
            width: 64px;
            height: 64px;
          }

          .your-rank-card {
            padding: 12px;
          }

          .your-rank-num {
            font-size: 24px;
          }
        }
      `}</style>
    </div>
  );
}
