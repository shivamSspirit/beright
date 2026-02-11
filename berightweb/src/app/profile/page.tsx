'use client';

import { useState } from 'react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import { mockUserStats } from '@/lib/mockData';
import { useUser } from '@/context/UserContext';
import { useUserPredictions, useBackendStatus } from '@/hooks/useMarkets';

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading, login, logout, walletAddress, linkTelegram } = useUser();
  const { isConnected } = useBackendStatus();
  const { stats: apiStats } = useUserPredictions();
  const [copied, setCopied] = useState(false);
  const [showTelegramLink, setShowTelegramLink] = useState(false);
  const [telegramInput, setTelegramInput] = useState('');
  const [linking, setLinking] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(true);

  const stats = user ? {
    totalPredictions: user.totalPredictions,
    accuracy: user.accuracy,
    winStreak: user.streak,
  } : mockUserStats;

  // Extended stats from API or mock
  const extendedStats = apiStats || {
    totalPredictions: mockUserStats.totalPredictions,
    resolvedPredictions: mockUserStats.resolvedPredictions,
    pendingPredictions: mockUserStats.totalPredictions - mockUserStats.resolvedPredictions,
    brierScore: mockUserStats.brierScore,
    accuracy: mockUserStats.accuracy,
    streak: { current: mockUserStats.winStreak, type: 'win' },
  };

  const vsAiWins = mockUserStats.vsAiWins;
  const vsAiLosses = mockUserStats.vsAiLosses;
  const aiAccuracy = 71.2;
  const userAccuracy = typeof extendedStats.accuracy === 'number'
    ? extendedStats.accuracy
    : parseFloat(String(extendedStats.accuracy));
  const isBeatingAI = userAccuracy > aiAccuracy;

  const handleCopyAddress = async () => {
    if (walletAddress) {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLinkTelegram = async () => {
    if (!telegramInput.trim()) return;
    setLinking(true);
    try {
      await linkTelegram(telegramInput.trim());
      setShowTelegramLink(false);
      setTelegramInput('');
    } finally {
      setLinking(false);
    }
  };

  const displayName = user?.username || (walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : 'Anonymous');

  const menuItems = [
    { icon: '🔔', label: 'Notifications', desc: 'Manage alerts', badge: 3 },
    { icon: '🛡️', label: 'Privacy', desc: 'Data settings' },
    {
      icon: '✨',
      label: 'Telegram Bot',
      desc: user?.telegramId ? 'Connected' : 'Link account',
      highlight: isAuthenticated && !user?.telegramId,
      action: () => isAuthenticated && !user?.telegramId && setShowTelegramLink(true),
    },
    { icon: '❓', label: 'Help & FAQ', desc: 'Get support' },
  ];

  const achievements = [
    { emoji: '🎯', name: 'First Pick', unlocked: stats.totalPredictions > 0 },
    { emoji: '🔥', name: '5 Streak', unlocked: stats.winStreak >= 5 },
    { emoji: '🤖', name: 'Beat AI', unlocked: true },
    { emoji: '👑', name: 'Top 10', unlocked: false },
    { emoji: '💎', name: '100 Picks', unlocked: stats.totalPredictions >= 100 },
  ];

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  // Category breakdown
  const categories = [
    { name: 'Crypto', icon: '₿', accuracy: 72, predictions: 45, color: '#F7931A' },
    { name: 'Politics', icon: '🏛', accuracy: 68, predictions: 32, color: '#6366F1' },
    { name: 'Tech', icon: '🚀', accuracy: 75, predictions: 28, color: '#8B5CF6' },
    { name: 'Economics', icon: '📊', accuracy: 65, predictions: 22, color: '#10B981' },
  ];

  return (
    <div className="profile-page">
      {/* Header */}
      <header className="profile-header">
        <Link href="/" className="back-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="header-title">Profile</h1>
        <div className="header-spacer" />
      </header>

      <main className="profile-main">
        {/* Hero Profile Card */}
        <div className="profile-hero">
          <div className="avatar-container">
            <div className="avatar">
              {isAuthenticated ? '🎯' : '👤'}
            </div>
            {user && user.rank > 0 && (
              <div className="rank-badge">#{user.rank}</div>
            )}
          </div>

          <h2 className="profile-name">{displayName}</h2>

          {isAuthenticated && walletAddress ? (
            <button onClick={handleCopyAddress} className="wallet-address">
              <span>{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
              <span className="copy-icon">{copied ? '✓' : '📋'}</span>
            </button>
          ) : (
            <p className="connect-hint">Connect wallet to save progress</p>
          )}

          {user?.telegramId && (
            <div className="telegram-badge">
              <span>✨</span>
              <span>Telegram linked</span>
            </div>
          )}

          {/* Quick Stats */}
          <div className="quick-stats">
            <div className="quick-stat">
              <span className="quick-value">{stats.totalPredictions}</span>
              <span className="quick-label">Predictions</span>
            </div>
            <div className="quick-divider" />
            <div className="quick-stat">
              <span className="quick-value accent-green">{stats.accuracy}%</span>
              <span className="quick-label">Accuracy</span>
            </div>
            <div className="quick-divider" />
            <div className="quick-stat">
              <span className="quick-value accent-orange">{stats.winStreak}</span>
              <span className="quick-label">Streak</span>
            </div>
          </div>
        </div>

        {/* Wallet Connection */}
        {isLoading ? (
          <div className="wallet-card loading">
            <div className="spinner" />
          </div>
        ) : isAuthenticated ? (
          <div className="wallet-card connected">
            <div className="wallet-icon connected">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
              </svg>
            </div>
            <div className="wallet-info">
              <span className="wallet-status">Connected</span>
              <span className="wallet-desc">Predictions tracked on-chain</span>
            </div>
            <button onClick={logout} className="disconnect-btn">
              Disconnect
            </button>
          </div>
        ) : (
          <button onClick={login} className="wallet-card connect">
            <div className="wallet-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
              </svg>
            </div>
            <div className="wallet-info">
              <span className="wallet-status">Connect Wallet</span>
              <span className="wallet-desc">Save predictions on-chain</span>
            </div>
            <span className="chevron">›</span>
          </button>
        )}

        {/* Telegram Link Modal */}
        {showTelegramLink && (
          <div className="telegram-modal">
            <div className="modal-header">
              <span className="modal-icon">🔗</span>
              <span className="modal-title">Link Telegram</span>
            </div>
            <p className="modal-desc">Enter your Telegram username to sync with the BeRight bot.</p>
            <div className="modal-input-row">
              <input
                type="text"
                value={telegramInput}
                onChange={(e) => setTelegramInput(e.target.value)}
                placeholder="@username"
                className="modal-input"
              />
              <button
                onClick={handleLinkTelegram}
                disabled={linking || !telegramInput.trim()}
                className="modal-btn"
              >
                {linking ? '...' : 'Link'}
              </button>
            </div>
            <button onClick={() => setShowTelegramLink(false)} className="modal-cancel">
              Cancel
            </button>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           STATS SECTION (Merged from Stats page)
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="stats-section">
          <button
            className="stats-section-header"
            onClick={() => setStatsExpanded(!statsExpanded)}
          >
            <div className="stats-section-title">
              <span className="stats-section-icon">📊</span>
              <span>Detailed Stats</span>
              {!isConnected && <span className="demo-tag">Demo</span>}
            </div>
            <svg
              className={`expand-icon ${statsExpanded ? 'expanded' : ''}`}
              width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {statsExpanded && (
            <div className="stats-section-content">
              {/* VS AI Card */}
              <div className="vs-ai-card">
                <div className="vs-ai-header">
                  <span className="vs-ai-title">You vs AI</span>
                  {isBeatingAI && (
                    <span className="beating-badge">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z"/>
                      </svg>
                      Winning
                    </span>
                  )}
                </div>
                <div className="vs-ai-bars">
                  <div className="vs-bar-row">
                    <span className="vs-label">You</span>
                    <div className="vs-bar-container">
                      <div className="vs-bar you" style={{ width: `${userAccuracy}%` }} />
                    </div>
                    <span className="vs-value you">{userAccuracy.toFixed(1)}%</span>
                  </div>
                  <div className="vs-bar-row">
                    <span className="vs-label">AI</span>
                    <div className="vs-bar-container">
                      <div className="vs-bar ai" style={{ width: `${aiAccuracy}%` }} />
                    </div>
                    <span className="vs-value ai">{aiAccuracy}%</span>
                  </div>
                </div>
                <div className="vs-ai-record">
                  <span className="record-wins">{vsAiWins}W</span>
                  <span className="record-separator">-</span>
                  <span className="record-losses">{vsAiLosses}L</span>
                </div>
              </div>

              {/* Brier Score + Progress */}
              <div className="metrics-row">
                <div className="metric-card">
                  <span className="metric-label">Brier Score</span>
                  <span className="metric-value green">
                    {typeof extendedStats.brierScore === 'number'
                      ? extendedStats.brierScore.toFixed(3)
                      : extendedStats.brierScore}
                  </span>
                  <span className="metric-hint">Lower is better</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Resolved</span>
                  <span className="metric-value">
                    {extendedStats.resolvedPredictions}/{extendedStats.totalPredictions}
                  </span>
                  <div className="mini-progress">
                    <div
                      className="mini-progress-fill"
                      style={{
                        width: `${((extendedStats.resolvedPredictions || 0) / (extendedStats.totalPredictions || 1)) * 100}%`
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="categories-card">
                <span className="categories-title">By Category</span>
                <div className="categories-list">
                  {categories.map((cat) => (
                    <div key={cat.name} className="category-row">
                      <span className="cat-icon" style={{ background: `${cat.color}20`, color: cat.color }}>
                        {cat.icon}
                      </span>
                      <span className="cat-name">{cat.name}</span>
                      <span className="cat-count">{cat.predictions}</span>
                      <span className={`cat-accuracy ${cat.accuracy >= 65 ? 'good' : ''}`}>
                        {cat.accuracy}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Menu Items */}
        <div className="menu-section">
          {menuItems.map((item, i) => (
            <button
              key={i}
              onClick={item.action}
              className={`menu-item ${item.highlight ? 'highlight' : ''}`}
            >
              <span className="menu-icon">{item.icon}</span>
              <div className="menu-content">
                <span className="menu-label">{item.label}</span>
                <span className="menu-desc">{item.desc}</span>
              </div>
              {item.badge && (
                <span className="menu-badge">{item.badge}</span>
              )}
              <span className="menu-chevron">›</span>
            </button>
          ))}
        </div>

        {/* Achievements */}
        <div className="achievements-section">
          <div className="section-header">
            <span className="section-title">Achievements</span>
            <span className="section-meta">{unlockedCount}/{achievements.length}</span>
          </div>
          <div className="achievements-row">
            {achievements.map((badge, i) => (
              <div key={i} className={`achievement ${badge.unlocked ? 'unlocked' : 'locked'}`}>
                <div className="achievement-icon">{badge.emoji}</div>
                <span className="achievement-name">{badge.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Public Profile Link */}
        {isAuthenticated && walletAddress && (
          <Link href={`/forecaster/${walletAddress}`} className="public-profile-btn">
            <span>View Public Profile</span>
            <span className="external-icon">↗</span>
          </Link>
        )}

        {/* App Info */}
        <div className="app-info">
          <p>BeRight v1.0.0</p>
          <p>Made for Colosseum Agent Hackathon</p>
        </div>
      </main>

      <BottomNav />

      <style jsx>{`
        .profile-page {
          min-height: 100dvh;
          background: #0A0A0F;
          padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           HEADER
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .profile-header {
          position: sticky;
          top: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          padding-top: calc(16px + env(safe-area-inset-top, 0px));
          background: rgba(10, 10, 15, 0.9);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .back-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          color: rgba(255, 255, 255, 0.8);
          transition: all 0.2s;
        }

        .back-btn:active {
          transform: scale(0.95);
          background: rgba(255, 255, 255, 0.1);
        }

        .header-title {
          font-size: 17px;
          font-weight: 700;
          color: #fff;
        }

        .header-spacer {
          width: 36px;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           MAIN
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .profile-main {
          max-width: 500px;
          margin: 0 auto;
          padding: 20px 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           HERO PROFILE
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .profile-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 32px 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 20px;
        }

        .avatar-container {
          position: relative;
          margin-bottom: 16px;
        }

        .avatar {
          width: 88px;
          height: 88px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          background: linear-gradient(135deg, rgba(0, 230, 118, 0.2), rgba(99, 102, 241, 0.2));
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
        }

        .rank-badge {
          position: absolute;
          bottom: -6px;
          right: -6px;
          padding: 4px 8px;
          background: #0A0A0F;
          border: 1px solid rgba(0, 230, 118, 0.4);
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          color: #00E676;
          font-family: var(--font-mono);
        }

        .profile-name {
          font-size: 22px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 4px;
        }

        .wallet-address {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          font-size: 13px;
          font-family: var(--font-mono);
          cursor: pointer;
          transition: color 0.2s;
        }

        .wallet-address:hover {
          color: rgba(255, 255, 255, 0.7);
        }

        .copy-icon {
          font-size: 12px;
        }

        .connect-hint {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.4);
          margin-bottom: 8px;
        }

        .telegram-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(99, 102, 241, 0.15);
          border-radius: 20px;
          font-size: 12px;
          color: #818CF8;
          margin-top: 8px;
        }

        /* Quick Stats */
        .quick-stats {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 24px;
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          width: 100%;
        }

        .quick-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .quick-value {
          font-size: 24px;
          font-weight: 800;
          color: #fff;
          font-family: var(--font-mono);
        }

        .quick-value.accent-green {
          color: #00E676;
        }

        .quick-value.accent-orange {
          color: #FF9800;
        }

        .quick-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .quick-divider {
          width: 1px;
          height: 32px;
          background: rgba(255, 255, 255, 0.08);
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           WALLET CARD
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .wallet-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          transition: all 0.2s;
        }

        .wallet-card.connect {
          cursor: pointer;
          border-color: rgba(0, 230, 118, 0.2);
        }

        .wallet-card.connect:hover {
          background: rgba(0, 230, 118, 0.05);
          border-color: rgba(0, 230, 118, 0.3);
        }

        .wallet-card.loading {
          justify-content: center;
          padding: 24px;
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-top-color: #00E676;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .wallet-icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 230, 118, 0.1);
          border-radius: 12px;
          color: #00E676;
          flex-shrink: 0;
        }

        .wallet-icon.connected {
          background: rgba(34, 197, 94, 0.15);
          color: #22C55E;
        }

        .wallet-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .wallet-status {
          font-size: 15px;
          font-weight: 600;
          color: #fff;
        }

        .wallet-card.connected .wallet-status {
          color: #22C55E;
        }

        .wallet-desc {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        }

        .disconnect-btn {
          padding: 8px 14px;
          background: rgba(255, 255, 255, 0.06);
          border: none;
          border-radius: 8px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          transition: all 0.2s;
        }

        .disconnect-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .chevron {
          font-size: 24px;
          color: rgba(255, 255, 255, 0.3);
          font-weight: 300;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           TELEGRAM MODAL
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .telegram-modal {
          padding: 20px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 16px;
        }

        .modal-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .modal-icon {
          font-size: 18px;
        }

        .modal-title {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
        }

        .modal-desc {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 16px;
          line-height: 1.5;
        }

        .modal-input-row {
          display: flex;
          gap: 10px;
        }

        .modal-input {
          flex: 1;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          font-size: 14px;
          color: #fff;
          outline: none;
          transition: border-color 0.2s;
        }

        .modal-input:focus {
          border-color: rgba(99, 102, 241, 0.5);
        }

        .modal-input::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .modal-btn {
          padding: 12px 20px;
          background: #6366F1;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s;
        }

        .modal-btn:hover:not(:disabled) {
          background: #818CF8;
        }

        .modal-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .modal-cancel {
          width: 100%;
          padding: 12px;
          margin-top: 10px;
          background: transparent;
          border: none;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          transition: color 0.2s;
        }

        .modal-cancel:hover {
          color: #fff;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           STATS SECTION (NEW)
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .stats-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          overflow: hidden;
        }

        .stats-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 16px;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background 0.2s;
        }

        .stats-section-header:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .stats-section-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 15px;
          font-weight: 600;
          color: #fff;
        }

        .stats-section-icon {
          font-size: 18px;
        }

        .demo-tag {
          padding: 3px 8px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          font-size: 10px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
        }

        .expand-icon {
          color: rgba(255, 255, 255, 0.4);
          transition: transform 0.2s;
        }

        .expand-icon.expanded {
          transform: rotate(180deg);
        }

        .stats-section-content {
          padding: 0 16px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* VS AI Card */
        .vs-ai-card {
          padding: 16px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(139, 92, 246, 0.02));
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 14px;
        }

        .vs-ai-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }

        .vs-ai-title {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
        }

        .beating-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: rgba(0, 230, 118, 0.15);
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          color: #00E676;
        }

        .vs-ai-bars {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 14px;
        }

        .vs-bar-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .vs-label {
          width: 28px;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
        }

        .vs-bar-container {
          flex: 1;
          height: 6px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 3px;
          overflow: hidden;
        }

        .vs-bar {
          height: 100%;
          border-radius: 3px;
          transition: width 0.5s ease;
        }

        .vs-bar.you {
          background: linear-gradient(90deg, #00E676, #00C853);
        }

        .vs-bar.ai {
          background: linear-gradient(90deg, #8B5CF6, #7C3AED);
        }

        .vs-value {
          width: 44px;
          font-size: 13px;
          font-weight: 700;
          font-family: var(--font-mono);
          text-align: right;
        }

        .vs-value.you {
          color: #00E676;
        }

        .vs-value.ai {
          color: #8B5CF6;
        }

        .vs-ai-record {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .record-wins {
          font-size: 16px;
          font-weight: 700;
          color: #00E676;
          font-family: var(--font-mono);
        }

        .record-separator {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.3);
        }

        .record-losses {
          font-size: 16px;
          font-weight: 700;
          color: #FF5252;
          font-family: var(--font-mono);
        }

        /* Metrics Row */
        .metrics-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .metric-card {
          padding: 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .metric-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .metric-value {
          font-size: 20px;
          font-weight: 700;
          color: #fff;
          font-family: var(--font-mono);
        }

        .metric-value.green {
          color: #00E676;
        }

        .metric-hint {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.3);
        }

        .mini-progress {
          height: 4px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          overflow: hidden;
          margin-top: 4px;
        }

        .mini-progress-fill {
          height: 100%;
          background: #00E676;
          border-radius: 2px;
        }

        /* Categories Card */
        .categories-card {
          padding: 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
        }

        .categories-title {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.3px;
          display: block;
          margin-bottom: 12px;
        }

        .categories-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .category-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .cat-icon {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          font-size: 14px;
        }

        .cat-name {
          flex: 1;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
        }

        .cat-count {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.35);
          font-family: var(--font-mono);
        }

        .cat-accuracy {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          font-family: var(--font-mono);
          width: 38px;
          text-align: right;
        }

        .cat-accuracy.good {
          color: #00E676;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           MENU SECTION
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .menu-section {
          display: flex;
          flex-direction: column;
          gap: 2px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          overflow: hidden;
        }

        .menu-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background 0.2s;
          text-align: left;
          width: 100%;
        }

        .menu-item:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .menu-item.highlight {
          background: rgba(99, 102, 241, 0.06);
        }

        .menu-item.highlight:hover {
          background: rgba(99, 102, 241, 0.1);
        }

        .menu-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 10px;
          font-size: 18px;
          flex-shrink: 0;
        }

        .menu-item.highlight .menu-icon {
          background: rgba(99, 102, 241, 0.15);
        }

        .menu-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .menu-label {
          font-size: 15px;
          font-weight: 500;
          color: #fff;
        }

        .menu-desc {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        }

        .menu-badge {
          padding: 4px 10px;
          background: #FF5252;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 700;
          color: #fff;
        }

        .menu-chevron {
          font-size: 22px;
          color: rgba(255, 255, 255, 0.2);
          font-weight: 300;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           ACHIEVEMENTS
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .achievements-section {
          padding: 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .section-title {
          font-size: 15px;
          font-weight: 600;
          color: #fff;
        }

        .section-meta {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          font-family: var(--font-mono);
        }

        .achievements-row {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
          -webkit-overflow-scrolling: touch;
        }

        .achievements-row::-webkit-scrollbar {
          display: none;
        }

        .achievement {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          width: 68px;
        }

        .achievement.locked {
          opacity: 0.35;
        }

        .achievement-icon {
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 14px;
          transition: all 0.2s;
        }

        .achievement.unlocked .achievement-icon {
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(249, 115, 22, 0.15));
          border: 1px solid rgba(251, 191, 36, 0.3);
        }

        .achievement-name {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.5);
          text-align: center;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           PUBLIC PROFILE BUTTON
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .public-profile-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 16px;
          background: rgba(0, 230, 118, 0.08);
          border: 1px solid rgba(0, 230, 118, 0.2);
          border-radius: 14px;
          font-size: 14px;
          font-weight: 600;
          color: #00E676;
          text-decoration: none;
          transition: all 0.2s;
        }

        .public-profile-btn:hover {
          background: rgba(0, 230, 118, 0.12);
          border-color: rgba(0, 230, 118, 0.3);
        }

        .external-icon {
          font-size: 16px;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           APP INFO
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .app-info {
          margin-top: 16px;
          padding-top: 16px;
          text-align: center;
        }

        .app-info p {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.25);
          margin: 0;
          line-height: 1.8;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           RESPONSIVE
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        @media (max-width: 359px) {
          .profile-main {
            padding: 16px 12px;
          }

          .profile-hero {
            padding: 24px 16px;
          }

          .avatar {
            width: 72px;
            height: 72px;
            font-size: 32px;
          }

          .profile-name {
            font-size: 20px;
          }

          .quick-stats {
            gap: 16px;
          }

          .quick-value {
            font-size: 20px;
          }

          .achievement {
            width: 60px;
          }

          .achievement-icon {
            width: 44px;
            height: 44px;
            font-size: 20px;
          }
        }
      `}</style>
    </div>
  );
}
