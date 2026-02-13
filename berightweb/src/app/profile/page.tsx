'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import { useUser } from '@/context/UserContext';
import { useUserPredictions, useBackendStatus } from '@/hooks/useMarkets';
import {
  TrendingUp, Target, Flame, Share2, ChevronRight, Lock, Trophy, Zap, Settings, Bell, HelpCircle
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// PROFILE PAGE - User Profile with Stats Dashboard
// ═══════════════════════════════════════════════════════════════

// Achievement definitions - will be computed based on user stats
interface Achievement {
  id: string;
  name: string;
  icon: string;
  desc: string;
  unlocked: boolean;
  progress: number;
}

const getAchievements = (stats: { totalPredictions: number; accuracy: number; winStreak: number }): Achievement[] => [
  { id: 'first', name: 'First Steps', icon: '🎯', desc: 'Make your first prediction', unlocked: stats.totalPredictions >= 1, progress: Math.min(100, stats.totalPredictions * 100) },
  { id: 'streak5', name: 'Hot Streak', icon: '🔥', desc: '5 wins in a row', unlocked: stats.winStreak >= 5, progress: Math.min(100, (stats.winStreak / 5) * 100) },
  { id: 'streak10', name: 'On Fire', icon: '💥', desc: '10 wins in a row', unlocked: stats.winStreak >= 10, progress: Math.min(100, (stats.winStreak / 10) * 100) },
  { id: 'ten', name: 'Getting Started', icon: '📊', desc: 'Make 10 predictions', unlocked: stats.totalPredictions >= 10, progress: Math.min(100, (stats.totalPredictions / 10) * 100) },
  { id: 'fifty', name: 'Committed', icon: '🐋', desc: 'Make 50 predictions', unlocked: stats.totalPredictions >= 50, progress: Math.min(100, (stats.totalPredictions / 50) * 100) },
  { id: 'hundred', name: 'Veteran', icon: '👑', desc: 'Make 100 predictions', unlocked: stats.totalPredictions >= 100, progress: Math.min(100, (stats.totalPredictions / 100) * 100) },
  { id: 'accurate', name: 'Sharp Eye', icon: '🎯', desc: 'Reach 70% accuracy', unlocked: stats.accuracy >= 70, progress: Math.min(100, (stats.accuracy / 70) * 100) },
  { id: 'expert', name: 'Expert', icon: '⭐', desc: 'Reach 80% accuracy', unlocked: stats.accuracy >= 80, progress: Math.min(100, (stats.accuracy / 80) * 100) },
];

// Animated counter hook
const useAnimatedCounter = (end: number, duration: number = 2000, trigger: boolean = true) => {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!trigger) return;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      countRef.current = Math.round(end * easeOutQuart);
      setCount(countRef.current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [end, duration, trigger]);

  return count;
};

// Progress Ring component
const ProgressRing = ({ progress, size = 60, strokeWidth = 5, color = '#00E676' }: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="progress-ring">
      <circle
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth={strokeWidth}
        fill="transparent"
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
      <circle
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="transparent"
        r={radius}
        cx={size / 2}
        cy={size / 2}
        style={{
          strokeDasharray: circumference,
          strokeDashoffset: offset,
          transform: 'rotate(-90deg)',
          transformOrigin: '50% 50%',
          transition: 'stroke-dashoffset 1s ease-out',
        }}
      />
    </svg>
  );
};

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading, login, logout, walletAddress, linkTelegram, refreshUser } = useUser();
  const { isConnected } = useBackendStatus();
  const { stats: apiStats, predictions } = useUserPredictions();
  const [copied, setCopied] = useState(false);
  const [showTelegramLink, setShowTelegramLink] = useState(false);
  const [telegramInput, setTelegramInput] = useState('');
  const [linking, setLinking] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'settings'>('stats');

  // Edit profile state
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    username: '',
    email: '',
    bio: '',
    twitterHandle: '',
    discordHandle: '',
    websiteUrl: '',
  });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setProfileForm({
        username: user.username || '',
        email: user.email || '',
        bio: user.bio || '',
        twitterHandle: user.twitterHandle || '',
        discordHandle: user.discordHandle || '',
        websiteUrl: user.websiteUrl || '',
      });
    }
  }, [user]);

  // Handle profile save
  const handleSaveProfile = async () => {
    if (!walletAddress) return;
    setSaving(true);
    setProfileError(null);
    setProfileSuccess(false);

    try {
      const response = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          username: profileForm.username || undefined,
          email: profileForm.email || undefined,
          bio: profileForm.bio || undefined,
          twitterHandle: profileForm.twitterHandle || undefined,
          discordHandle: profileForm.discordHandle || undefined,
          websiteUrl: profileForm.websiteUrl || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to update profile');
      }

      setProfileSuccess(true);
      setEditMode(false);
      // Refresh user data
      if (refreshUser) refreshUser();
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const stats = {
    totalPredictions: user?.totalPredictions ?? apiStats?.totalPredictions ?? 0,
    accuracy: user?.accuracy ?? apiStats?.accuracy ?? 0,
    winStreak: user?.streak ?? apiStats?.streak?.current ?? 0,
  };

  // Animated counter for predictions
  const animatedPredictions = useAnimatedCounter(stats.totalPredictions, 1500, activeTab === 'stats');

  // Calculate XP based on predictions and accuracy
  const xp = Math.floor(stats.totalPredictions * 10 + stats.accuracy * 5);

  // Determine league based on XP
  const getLeague = (xp: number) => {
    if (xp >= 5000) return { name: 'Diamond', icon: '💠' };
    if (xp >= 2500) return { name: 'Platinum', icon: '💎' };
    if (xp >= 1000) return { name: 'Gold', icon: '🥇' };
    if (xp >= 500) return { name: 'Silver', icon: '🥈' };
    return { name: 'Bronze', icon: '🥉' };
  };
  const league = getLeague(xp);

  // Real stats from API
  const extendedStats = {
    winRate: stats.accuracy,
    streak: stats.winStreak,
    totalTrades: stats.totalPredictions,
    rank: user?.rank || 0,
    xp,
    league: league.name,
    leagueIcon: league.icon,
  };

  // Get achievements based on real stats
  const achievements = getAchievements(stats);

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
    { icon: <Bell size={18} />, label: 'Notifications', desc: 'Manage alerts', badge: 3 },
    { icon: <Settings size={18} />, label: 'Privacy', desc: 'Data settings' },
    {
      icon: <Zap size={18} />,
      label: 'Telegram Bot',
      desc: user?.telegramId ? 'Connected' : 'Link account',
      highlight: isAuthenticated && !user?.telegramId,
      action: () => isAuthenticated && !user?.telegramId && setShowTelegramLink(true),
    },
    { icon: <HelpCircle size={18} />, label: 'Help & FAQ', desc: 'Get support' },
  ];

  return (
    <div className="profile-page">
      {/* Header */}
      <header className="profile-header">
        <Link href="/" className="back-btn">
          <ChevronRight className="rotate-180" size={20} />
        </Link>
        <h1 className="header-title">Profile</h1>
        <button className="share-btn">
          <Share2 size={18} />
        </button>
      </header>

      <main className="profile-main">
        {/* Hero Profile Card */}
        <div className="profile-hero">
          <div className="avatar-container">
            <div className="avatar">
              {isAuthenticated ? '🎯' : '👤'}
            </div>
            {extendedStats.rank > 0 && (
              <div className="rank-badge">#{extendedStats.rank}</div>
            )}
            <div className="league-badge-mini">
              <span>🥇</span>
            </div>
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

          {/* Hero Stats */}
          <div className="hero-stats">
            <span className="hero-number">{animatedPredictions}</span>
            <span className="hero-label">Predictions</span>
          </div>
          {extendedStats.rank > 0 && (
            <div className="hero-subtitle">
              <Trophy size={14} />
              <span>Ranked #{extendedStats.rank}</span>
            </div>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="tab-switcher">
          <button
            className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <TrendingUp size={16} />
            <span>Stats</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
        </div>

        {activeTab === 'stats' ? (
          <>
            {/* Quick Stats Row */}
            <section className="quick-stats">
              <div className="quick-stat">
                <div className="quick-stat-ring">
                  <ProgressRing progress={extendedStats.winRate} size={44} strokeWidth={4} />
                  <span className="ring-value">{extendedStats.winRate.toFixed(0)}%</span>
                </div>
                <div className="quick-stat-label">Accuracy</div>
              </div>

              <div className="quick-stat">
                <div className="quick-stat-icon fire">
                  <Flame size={16} />
                </div>
                <div className="quick-stat-value fire">{extendedStats.streak}</div>
                <div className="quick-stat-label">Streak</div>
              </div>

              <div className="quick-stat">
                <div className="quick-stat-icon trades">
                  <Target size={16} />
                </div>
                <div className="quick-stat-value">{extendedStats.totalTrades}</div>
                <div className="quick-stat-label">Predictions</div>
              </div>

              <div className="quick-stat">
                <div className="quick-stat-icon xp">
                  <Zap size={16} />
                </div>
                <div className="quick-stat-value">{extendedStats.xp}</div>
                <div className="quick-stat-label">XP</div>
              </div>
            </section>

            {/* League Progress */}
            <section className="league-section">
              <div className="league-header">
                <div className="league-badge-full">
                  <span className="league-icon">{extendedStats.leagueIcon}</span>
                  <span className="league-name">{extendedStats.league} League</span>
                </div>
                {extendedStats.rank > 0 && (
                  <div className="league-rank">Rank #{extendedStats.rank}</div>
                )}
              </div>
              <div className="xp-progress">
                <div className="xp-text">
                  <span className="xp-current">{extendedStats.xp} XP</span>
                  <span className="xp-target">
                    {extendedStats.xp < 500 ? `${500 - extendedStats.xp} XP to Silver` :
                     extendedStats.xp < 1000 ? `${1000 - extendedStats.xp} XP to Gold` :
                     extendedStats.xp < 2500 ? `${2500 - extendedStats.xp} XP to Platinum` :
                     extendedStats.xp < 5000 ? `${5000 - extendedStats.xp} XP to Diamond` : 'Max Level!'}
                  </span>
                </div>
                <div className="xp-bar">
                  <div className="xp-fill" style={{
                    width: `${Math.min(100, extendedStats.xp < 500 ? (extendedStats.xp / 500) * 100 :
                            extendedStats.xp < 1000 ? ((extendedStats.xp - 500) / 500) * 100 :
                            extendedStats.xp < 2500 ? ((extendedStats.xp - 1000) / 1500) * 100 :
                            extendedStats.xp < 5000 ? ((extendedStats.xp - 2500) / 2500) * 100 : 100)}%`
                  }}>
                    <div className="xp-glow" />
                  </div>
                </div>
              </div>
              <div className="league-tiers">
                {[
                  { icon: '🥉', threshold: 0 },
                  { icon: '🥈', threshold: 500 },
                  { icon: '🥇', threshold: 1000 },
                  { icon: '💎', threshold: 2500 },
                  { icon: '💠', threshold: 5000 },
                ].map((tier, i) => (
                  <div key={i} className={`tier ${extendedStats.xp >= tier.threshold ? 'unlocked' : 'locked'}`}>
                    {tier.icon}
                  </div>
                ))}
              </div>
            </section>

            {/* Share Stats Card */}
            {stats.totalPredictions > 0 && (
              <section className="share-section">
                <h3>Share Your Stats</h3>
                <div className="share-card-preview">
                  <div className="share-card-inner">
                    <div className="share-card-logo">BeRight</div>
                    <div className="share-card-stats-main">
                      <div className="share-stat-big">{extendedStats.winRate.toFixed(0)}%</div>
                      <div className="share-stat-label">Accuracy</div>
                    </div>
                    <div className="share-card-stats">
                      <div>{extendedStats.totalTrades} Predictions</div>
                      <div>🔥 {extendedStats.streak} Streak</div>
                      <div>{extendedStats.league} League</div>
                    </div>
                    <div className="share-card-user">@{displayName}</div>
                  </div>
                </div>
                <div className="share-buttons">
                  <button className="share-button share">
                    <Share2 size={16} />
                    <span>Share</span>
                  </button>
                </div>
              </section>
            )}

            {/* Achievement Grid */}
            <section className="achievements-section">
              <div className="achievements-header">
                <h3>Achievements</h3>
                <span className="achievements-count">
                  {achievements.filter(a => a.unlocked).length}/{achievements.length}
                </span>
              </div>
              <div className="achievements-grid">
                {achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className={`achievement ${achievement.unlocked ? 'unlocked' : 'locked'}`}
                  >
                    <div className="achievement-icon">
                      {achievement.unlocked ? (
                        <span>{achievement.icon}</span>
                      ) : (
                        <Lock size={18} />
                      )}
                    </div>
                    <div className="achievement-info">
                      <span className="achievement-name">{achievement.name}</span>
                      {!achievement.unlocked && (
                        <div className="achievement-progress">
                          <div
                            className="achievement-progress-fill"
                            style={{ width: `${achievement.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <>
            {/* Settings Tab Content */}
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

            {/* Edit Profile Section */}
            {isAuthenticated && (
              <div className="edit-profile-section">
                <div className="edit-profile-header">
                  <h3>Profile Information</h3>
                  {!editMode ? (
                    <button className="edit-btn" onClick={() => setEditMode(true)}>
                      Edit
                    </button>
                  ) : (
                    <div className="edit-actions">
                      <button className="cancel-btn" onClick={() => setEditMode(false)} disabled={saving}>
                        Cancel
                      </button>
                      <button className="save-btn" onClick={handleSaveProfile} disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>

                {profileError && (
                  <div className="profile-error">{profileError}</div>
                )}
                {profileSuccess && (
                  <div className="profile-success">Profile updated successfully!</div>
                )}

                {editMode ? (
                  <div className="profile-form">
                    <div className="form-group">
                      <label>Username</label>
                      <input
                        type="text"
                        value={profileForm.username}
                        onChange={(e) => setProfileForm(f => ({ ...f, username: e.target.value }))}
                        placeholder="your_username"
                        maxLength={30}
                      />
                      <span className="hint">3-30 chars, alphanumeric and underscores</span>
                    </div>
                    <div className="form-group">
                      <label>Email</label>
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="you@example.com"
                      />
                    </div>
                    <div className="form-group">
                      <label>Bio</label>
                      <textarea
                        value={profileForm.bio}
                        onChange={(e) => setProfileForm(f => ({ ...f, bio: e.target.value }))}
                        placeholder="Tell us about yourself..."
                        maxLength={500}
                        rows={3}
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Twitter</label>
                        <input
                          type="text"
                          value={profileForm.twitterHandle}
                          onChange={(e) => setProfileForm(f => ({ ...f, twitterHandle: e.target.value }))}
                          placeholder="@handle"
                        />
                      </div>
                      <div className="form-group">
                        <label>Discord</label>
                        <input
                          type="text"
                          value={profileForm.discordHandle}
                          onChange={(e) => setProfileForm(f => ({ ...f, discordHandle: e.target.value }))}
                          placeholder="username#1234"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Website</label>
                      <input
                        type="url"
                        value={profileForm.websiteUrl}
                        onChange={(e) => setProfileForm(f => ({ ...f, websiteUrl: e.target.value }))}
                        placeholder="https://yoursite.com"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="profile-display">
                    {profileForm.username && (
                      <div className="profile-field">
                        <span className="field-label">Username</span>
                        <span className="field-value">@{profileForm.username}</span>
                      </div>
                    )}
                    {profileForm.email && (
                      <div className="profile-field">
                        <span className="field-label">Email</span>
                        <span className="field-value">{profileForm.email}</span>
                      </div>
                    )}
                    {profileForm.bio && (
                      <div className="profile-field">
                        <span className="field-label">Bio</span>
                        <span className="field-value bio">{profileForm.bio}</span>
                      </div>
                    )}
                    {(profileForm.twitterHandle || profileForm.discordHandle) && (
                      <div className="profile-socials">
                        {profileForm.twitterHandle && (
                          <span className="social-tag twitter">@{profileForm.twitterHandle}</span>
                        )}
                        {profileForm.discordHandle && (
                          <span className="social-tag discord">{profileForm.discordHandle}</span>
                        )}
                      </div>
                    )}
                    {profileForm.websiteUrl && (
                      <a href={profileForm.websiteUrl} target="_blank" rel="noopener noreferrer" className="website-link">
                        {profileForm.websiteUrl.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    {!profileForm.username && !profileForm.email && !profileForm.bio && (
                      <p className="no-profile">No profile information added yet. Click Edit to add your details.</p>
                    )}
                  </div>
                )}
              </div>
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
          </>
        )}
      </main>

      <BottomNav />

      <style jsx>{`
        .profile-page {
          min-height: 100dvh;
          background: #0A0A0F;
          padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
        }

        /* Header */
        .profile-header {
          position: sticky;
          top: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          padding-top: calc(14px + env(safe-area-inset-top, 0px));
          background: rgba(10, 10, 15, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .back-btn, .share-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          color: rgba(255, 255, 255, 0.8);
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-btn:active, .share-btn:active {
          transform: scale(0.95);
          background: rgba(255, 255, 255, 0.1);
        }

        .header-title {
          font-size: 17px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.02em;
        }

        /* Main */
        .profile-main {
          max-width: 600px;
          margin: 0 auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .profile-main h3 {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 12px;
        }

        /* Hero Profile */
        .profile-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px 20px;
          background: linear-gradient(180deg, rgba(0, 230, 118, 0.08) 0%, rgba(10, 10, 15, 1) 100%);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 18px;
          animation: fadeInUp 0.4s ease-out;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .avatar-container {
          position: relative;
          margin-bottom: 14px;
        }

        .avatar {
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
          background: linear-gradient(135deg, rgba(0, 230, 118, 0.2), rgba(99, 102, 241, 0.2));
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-radius: 22px;
        }

        .rank-badge {
          position: absolute;
          bottom: -6px;
          right: -6px;
          padding: 4px 8px;
          background: #0A0A0F;
          border: 1px solid rgba(0, 230, 118, 0.4);
          border-radius: 8px;
          font-size: 10px;
          font-weight: 700;
          color: #00E676;
          font-family: 'JetBrains Mono', monospace;
        }

        .league-badge-mini {
          position: absolute;
          top: -6px;
          right: -6px;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0A0A0F;
          border: 1px solid rgba(255, 215, 0, 0.4);
          border-radius: 50%;
          font-size: 14px;
        }

        .profile-name {
          font-size: 20px;
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
          font-size: 12px;
          font-family: 'JetBrains Mono', monospace;
          cursor: pointer;
          transition: color 0.2s;
        }

        .wallet-address:hover {
          color: rgba(255, 255, 255, 0.7);
        }

        .copy-icon {
          font-size: 11px;
        }

        .connect-hint {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          margin-bottom: 8px;
        }

        .telegram-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          background: rgba(99, 102, 241, 0.15);
          border-radius: 16px;
          font-size: 11px;
          color: #818CF8;
          margin-top: 4px;
        }

        /* Hero Stats */
        .hero-stats {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin: 16px 0 12px;
        }

        .hero-number {
          font-family: 'JetBrains Mono', monospace;
          font-size: 44px;
          font-weight: 800;
          color: #00E676;
          text-shadow: 0 0 40px rgba(0, 230, 118, 0.5);
          line-height: 1;
        }

        .hero-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-top: 4px;
        }

        .hero-subtitle {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(255, 215, 0, 0.1);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 16px;
          color: #FFD700;
          font-size: 12px;
          font-weight: 500;
        }

        /* Tab Switcher */
        .tab-switcher {
          display: flex;
          gap: 8px;
          padding: 4px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
        }

        .tab-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px;
          background: transparent;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab-btn:hover {
          color: rgba(255, 255, 255, 0.7);
        }

        .tab-btn.active {
          background: rgba(99, 102, 241, 0.15);
          color: #818CF8;
        }

        /* Quick Stats */
        .quick-stats {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          padding: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 14px;
        }

        .quick-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          flex: 1;
        }

        .quick-stat-icon {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
        }

        .quick-stat-icon.roi {
          background: rgba(0, 230, 118, 0.15);
          color: #00E676;
        }

        .quick-stat-icon.fire {
          background: rgba(255, 149, 0, 0.15);
          color: #FF9500;
        }

        .quick-stat-icon.trades {
          background: rgba(99, 102, 241, 0.15);
          color: #818CF8;
        }

        .quick-stat-icon.xp {
          background: rgba(255, 215, 0, 0.15);
          color: #FFD700;
        }

        .quick-stat-ring {
          position: relative;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ring-value {
          position: absolute;
          font-size: 11px;
          font-weight: 700;
          color: #00E676;
          font-family: 'JetBrains Mono', monospace;
        }

        .quick-stat-value {
          font-size: 17px;
          font-weight: 700;
          color: #fff;
          font-family: 'JetBrains Mono', monospace;
        }

        .quick-stat-value.green { color: #00E676; }
        .quick-stat-value.fire { color: #FF9500; }

        .quick-stat-label {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* League Section */
        .league-section {
          padding: 14px;
          background: linear-gradient(145deg, #18182A, #12121F);
          border: 1px solid rgba(99, 102, 241, 0.15);
          border-radius: 14px;
        }

        .league-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .league-badge-full {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .league-icon {
          font-size: 22px;
        }

        .league-name {
          font-size: 15px;
          font-weight: 700;
          color: #FFD700;
        }

        .league-rank {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          font-family: 'JetBrains Mono', monospace;
        }

        .xp-progress {
          margin-bottom: 12px;
        }

        .xp-text {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
        }

        .xp-current {
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
          position: relative;
          transition: width 0.5s ease;
        }

        .xp-glow {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 20px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4));
          animation: xpGlow 2s ease-in-out infinite;
        }

        @keyframes xpGlow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .league-tiers {
          display: flex;
          justify-content: space-between;
          padding: 0 8px;
        }

        .tier {
          font-size: 18px;
          opacity: 0.3;
          filter: grayscale(1);
          transition: all 0.2s;
        }

        .tier.unlocked {
          opacity: 1;
          filter: grayscale(0);
        }

        /* Chart Section */
        .chart-section {
          padding: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 14px;
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .chart-range {
          display: flex;
          gap: 4px;
        }

        .range-btn {
          padding: 4px 10px;
          font-size: 10px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.4);
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .range-btn:hover {
          color: rgba(255, 255, 255, 0.7);
        }

        .range-btn.active {
          color: #fff;
          background: rgba(0, 230, 118, 0.15);
          border-color: rgba(0, 230, 118, 0.3);
        }

        .chart-container {
          margin-bottom: 12px;
        }

        .chart-stats {
          display: flex;
          justify-content: space-between;
          padding-top: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .chart-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .chart-stat-label {
          font-size: 9px;
          color: rgba(255, 255, 255, 0.35);
          text-transform: uppercase;
        }

        .chart-stat-value {
          font-size: 12px;
          font-weight: 600;
          color: #fff;
          font-family: 'JetBrains Mono', monospace;
        }

        .chart-stat-value.green { color: #00E676; }
        .chart-stat-value.red { color: #FF5252; }

        /* Category Section */
        .category-section {
          padding: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 14px;
        }

        .category-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 12px;
        }

        .category-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .cat-info {
          width: 70px;
          display: flex;
          flex-direction: column;
        }

        .cat-name {
          font-size: 12px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
        }

        .cat-trades {
          font-size: 9px;
          color: rgba(255, 255, 255, 0.35);
        }

        .cat-bar-container {
          flex: 1;
          height: 6px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
          overflow: hidden;
        }

        .cat-bar {
          height: 100%;
          border-radius: 3px;
          transition: width 0.5s ease;
        }

        .cat-pct {
          width: 36px;
          font-size: 12px;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
          text-align: right;
        }

        .category-highlight {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px;
          background: rgba(255, 215, 0, 0.08);
          border-radius: 8px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.6);
        }

        .category-highlight strong {
          color: #FFD700;
        }

        /* Trades Section */
        .trades-section {
          /* No padding, cards have their own */
        }

        .trade-cards {
          display: flex;
          gap: 10px;
        }

        .trade-card {
          flex: 1;
          padding: 12px;
          border-radius: 12px;
        }

        .trade-card.best {
          background: linear-gradient(135deg, rgba(0, 230, 118, 0.1), rgba(0, 230, 118, 0.02));
          border: 1px solid rgba(0, 230, 118, 0.2);
        }

        .trade-card.worst {
          background: linear-gradient(135deg, rgba(255, 82, 82, 0.1), rgba(255, 82, 82, 0.02));
          border: 1px solid rgba(255, 82, 82, 0.2);
        }

        .trade-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .trade-card-label {
          font-size: 9px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .trade-card.best .trade-card-header { color: #00E676; }
        .trade-card.worst .trade-card-header { color: #FF5252; }

        .trade-card-market {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 6px;
          line-height: 1.3;
        }

        .trade-card-profit {
          font-size: 18px;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
        }

        .trade-card-pct {
          font-size: 10px;
          font-weight: 500;
          font-family: 'JetBrains Mono', monospace;
        }

        .green { color: #00E676; }
        .red { color: #FF5252; }

        /* Edge Section */
        .edge-section {
          padding: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 14px;
        }

        .edge-content {
          display: flex;
          gap: 10px;
        }

        .edge-strengths, .edge-improve {
          flex: 1;
          padding: 10px;
          border-radius: 10px;
        }

        .edge-strengths {
          background: rgba(0, 230, 118, 0.05);
          border: 1px solid rgba(0, 230, 118, 0.15);
        }

        .edge-improve {
          background: rgba(255, 149, 0, 0.05);
          border: 1px solid rgba(255, 149, 0, 0.15);
        }

        .edge-title {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .edge-title.strengths { color: #00E676; }
        .edge-title.improve { color: #FF9500; }

        .edge-list {
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .edge-list li {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.6);
          padding: 3px 0;
          padding-left: 10px;
          position: relative;
        }

        .edge-list li::before {
          content: '•';
          position: absolute;
          left: 0;
          color: rgba(255, 255, 255, 0.3);
        }

        /* Share Section */
        .share-section {
          /* No padding */
        }

        .share-card-preview {
          background: linear-gradient(145deg, #1A1A2E, #0D0D18);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          padding: 3px;
          margin-bottom: 10px;
        }

        .share-card-inner {
          background: linear-gradient(145deg, #0F0F1A, #0A0A12);
          border-radius: 11px;
          padding: 16px;
          text-align: center;
        }

        .share-card-logo {
          font-size: 12px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.4);
          margin-bottom: 10px;
          letter-spacing: 2px;
        }

        .share-card-stats-main {
          margin-bottom: 10px;
        }

        .share-stat-big {
          font-size: 32px;
          font-weight: 800;
          color: #00E676;
          font-family: 'JetBrains Mono', monospace;
          text-shadow: 0 0 30px rgba(0, 230, 118, 0.4);
        }

        .share-stat-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
        }

        .share-card-stats {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-bottom: 10px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.6);
        }

        .share-card-user {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.35);
        }

        .share-buttons {
          display: flex;
          gap: 10px;
        }

        .share-button {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .share-button.download {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.8);
        }

        .share-button.download:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .share-button.share {
          background: linear-gradient(135deg, #6366F1, #818CF8);
          color: #fff;
        }

        .share-button.share:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
        }

        /* Achievements Section */
        .achievements-section {
          /* No padding */
        }

        .achievements-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .achievements-count {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          font-family: 'JetBrains Mono', monospace;
        }

        .achievements-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .achievement {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          transition: all 0.2s;
        }

        .achievement.unlocked {
          border-color: rgba(255, 215, 0, 0.2);
          background: rgba(255, 215, 0, 0.05);
        }

        .achievement.unlocked:hover {
          border-color: rgba(255, 215, 0, 0.4);
          box-shadow: 0 0 20px rgba(255, 215, 0, 0.1);
        }

        .achievement.locked {
          opacity: 0.5;
        }

        .achievement-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          font-size: 16px;
        }

        .achievement.unlocked .achievement-icon {
          background: rgba(255, 215, 0, 0.1);
        }

        .achievement.locked .achievement-icon {
          color: rgba(255, 255, 255, 0.3);
        }

        .achievement-info {
          flex: 1;
          min-width: 0;
        }

        .achievement-name {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          display: block;
        }

        .achievement.locked .achievement-name {
          color: rgba(255, 255, 255, 0.5);
        }

        .achievement-progress {
          height: 3px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          margin-top: 3px;
          overflow: hidden;
        }

        .achievement-progress-fill {
          height: 100%;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 2px;
        }

        /* Settings Tab Styles */
        .wallet-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
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
          padding: 22px;
        }

        .spinner {
          width: 22px;
          height: 22px;
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-top-color: #00E676;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .wallet-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 230, 118, 0.1);
          border-radius: 10px;
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
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }

        .wallet-card.connected .wallet-status {
          color: #22C55E;
        }

        .wallet-desc {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
        }

        .disconnect-btn {
          padding: 7px 12px;
          background: rgba(255, 255, 255, 0.06);
          border: none;
          border-radius: 8px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          transition: all 0.2s;
        }

        .disconnect-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .chevron {
          font-size: 22px;
          color: rgba(255, 255, 255, 0.3);
          font-weight: 300;
        }

        /* Telegram Modal */
        .telegram-modal {
          padding: 18px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 14px;
        }

        .modal-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }

        .modal-icon {
          font-size: 16px;
        }

        .modal-title {
          font-size: 15px;
          font-weight: 600;
          color: #fff;
        }

        .modal-desc {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 14px;
          line-height: 1.5;
        }

        .modal-input-row {
          display: flex;
          gap: 8px;
        }

        .modal-input {
          flex: 1;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          font-size: 13px;
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
          padding: 10px 18px;
          background: #6366F1;
          border: none;
          border-radius: 10px;
          font-size: 13px;
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
          padding: 10px;
          margin-top: 8px;
          background: transparent;
          border: none;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          transition: color 0.2s;
        }

        .modal-cancel:hover {
          color: #fff;
        }

        /* Menu Section */
        .menu-section {
          display: flex;
          flex-direction: column;
          gap: 2px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
          overflow: hidden;
        }

        .menu-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
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
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 10px;
          color: rgba(255, 255, 255, 0.6);
          flex-shrink: 0;
        }

        .menu-item.highlight .menu-icon {
          background: rgba(99, 102, 241, 0.15);
          color: #818CF8;
        }

        .menu-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .menu-label {
          font-size: 14px;
          font-weight: 500;
          color: #fff;
        }

        .menu-desc {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
        }

        .menu-badge {
          padding: 3px 8px;
          background: #FF5252;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          color: #fff;
        }

        .menu-chevron {
          font-size: 20px;
          color: rgba(255, 255, 255, 0.2);
          font-weight: 300;
        }

        /* Public Profile Button */
        .public-profile-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          background: rgba(0, 230, 118, 0.08);
          border: 1px solid rgba(0, 230, 118, 0.2);
          border-radius: 12px;
          font-size: 13px;
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
          font-size: 14px;
        }

        /* App Info */
        .app-info {
          margin-top: 12px;
          padding-top: 12px;
          text-align: center;
        }

        .app-info p {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.25);
          margin: 0;
          line-height: 1.8;
        }

        /* Edit Profile Section */
        .edit-profile-section {
          padding: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
        }

        .edit-profile-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }

        .edit-profile-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
        }

        .edit-btn {
          padding: 6px 14px;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          color: #818CF8;
          cursor: pointer;
          transition: all 0.2s;
        }

        .edit-btn:hover {
          background: rgba(99, 102, 241, 0.25);
        }

        .edit-actions {
          display: flex;
          gap: 8px;
        }

        .cancel-btn {
          padding: 6px 12px;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          transition: all 0.2s;
        }

        .cancel-btn:hover {
          border-color: rgba(255, 255, 255, 0.2);
          color: #fff;
        }

        .save-btn {
          padding: 6px 14px;
          background: linear-gradient(135deg, #00E676, #00B0FF);
          border: none;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          color: #000;
          cursor: pointer;
          transition: all 0.2s;
        }

        .save-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 230, 118, 0.3);
        }

        .save-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .profile-error {
          padding: 10px 12px;
          background: rgba(255, 82, 82, 0.1);
          border: 1px solid rgba(255, 82, 82, 0.2);
          border-radius: 8px;
          font-size: 12px;
          color: #FF5252;
          margin-bottom: 12px;
        }

        .profile-success {
          padding: 10px 12px;
          background: rgba(0, 230, 118, 0.1);
          border: 1px solid rgba(0, 230, 118, 0.2);
          border-radius: 8px;
          font-size: 12px;
          color: #00E676;
          margin-bottom: 12px;
        }

        .profile-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group label {
          font-size: 11px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .form-group input,
        .form-group textarea {
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          font-size: 13px;
          color: #fff;
          outline: none;
          transition: all 0.2s;
          font-family: inherit;
        }

        .form-group textarea {
          resize: vertical;
          min-height: 70px;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          border-color: rgba(99, 102, 241, 0.5);
          background: rgba(255, 255, 255, 0.06);
        }

        .form-group input::placeholder,
        .form-group textarea::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .form-group .hint {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.35);
        }

        .form-row {
          display: flex;
          gap: 12px;
        }

        .form-row .form-group {
          flex: 1;
        }

        .profile-display {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .profile-field {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .field-label {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .field-value {
          font-size: 13px;
          color: #fff;
        }

        .field-value.bio {
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.5;
        }

        .profile-socials {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .social-tag {
          padding: 5px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 500;
        }

        .social-tag.twitter {
          background: rgba(29, 161, 242, 0.15);
          color: #1DA1F2;
        }

        .social-tag.discord {
          background: rgba(88, 101, 242, 0.15);
          color: #5865F2;
        }

        .website-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #818CF8;
          text-decoration: none;
          transition: color 0.2s;
        }

        .website-link:hover {
          color: #A5B4FC;
          text-decoration: underline;
        }

        .no-profile {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          text-align: center;
          padding: 16px;
          margin: 0;
        }

        /* Responsive */
        @media (max-width: 359px) {
          .profile-main {
            padding: 12px;
            gap: 10px;
          }

          .profile-hero {
            padding: 20px 14px;
          }

          .avatar {
            width: 64px;
            height: 64px;
            font-size: 28px;
          }

          .hero-number {
            font-size: 32px;
          }

          .hero-plus, .hero-dollar {
            font-size: 22px;
          }

          .quick-stats {
            padding: 10px;
            gap: 4px;
          }

          .quick-stat-value {
            font-size: 14px;
          }

          .trade-cards {
            flex-direction: column;
          }

          .edge-content {
            flex-direction: column;
          }

          .achievements-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (min-width: 640px) {
          .profile-main {
            max-width: 700px;
            padding: 20px 24px;
          }

          .hero-number {
            font-size: 52px;
          }

          .achievements-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (min-width: 768px) {
          .profile-main {
            max-width: 800px;
          }

          .achievements-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        @media (min-width: 1024px) {
          .profile-main {
            max-width: 900px;
          }

          .achievements-grid {
            grid-template-columns: repeat(5, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
