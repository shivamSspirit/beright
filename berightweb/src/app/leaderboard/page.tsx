'use client';

import { useState } from 'react';
import { Crown, Medal, Award, Flame, ChevronRight } from 'lucide-react';
import { useLeaderboard, useBackendStatus } from '@/hooks/useMarkets';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';

// Avatar emojis for users
const avatars = ['🎯', '🔮', '📊', '🎲', '📈', '⚡', '👑', '🧠', '🚀', '💎'];
const getAvatar = (index: number): string => avatars[index % avatars.length];

export default function LeaderboardPage() {
  const { isConnected } = useBackendStatus();
  const { data, loading, usingMock } = useLeaderboard({ limit: 50 });
  const [activeTab, setActiveTab] = useState<'accuracy' | 'streak' | 'volume'>('accuracy');

  const aiAccuracy = 71.2;
  const leaderboard = data?.leaderboard || [];

  // Split into podium (top 3) and rest
  const podium = leaderboard.slice(0, 3);
  const restOfList = leaderboard.slice(3);

  // Reorder podium for display: [2nd, 1st, 3rd]
  const podiumDisplay = podium.length >= 3
    ? [podium[1], podium[0], podium[2]]
    : podium;

  return (
    <div className="leaderboard-page">
      {/* Header */}
      <header className="lb-header">
        <div className="lb-header-content">
          <Link href="/" className="lb-back">
            <ChevronRight className="rotate-180" size={20} />
          </Link>
          <div className="lb-title">
            <h1>Ranks</h1>
            <span className="lb-badge">
              {isConnected ? 'Live' : 'Demo'}
            </span>
          </div>
          <div className="lb-header-spacer" />
        </div>
      </header>

      {/* Main Content */}
      <main className="lb-main">
        {/* AI Benchmark - Simple */}
        <div className="ai-benchmark">
          <div className="ai-icon">🤖</div>
          <div className="ai-info">
            <span className="ai-label">AI Benchmark</span>
            <span className="ai-accuracy">{aiAccuracy}%</span>
          </div>
          <div className="ai-status">
            <span className="beat-count">{leaderboard.filter(u => u.accuracy > aiAccuracy).length}</span>
            <span className="beat-label">beating AI</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="lb-tabs">
          {[
            { key: 'accuracy', label: 'Top Accuracy' },
            { key: 'streak', label: 'Hot Streak' },
            { key: 'volume', label: 'Most Active' },
          ].map((tab) => (
            <button
              key={tab.key}
              className={`lb-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="lb-loading">
            <div className="lb-spinner" />
            <span>Loading rankings...</span>
          </div>
        )}

        {/* Podium - Top 3 */}
        {!loading && podium.length >= 3 && (
          <div className="podium-section">
            <div className="podium">
              {podiumDisplay.map((user, displayIndex) => {
                const actualRank = displayIndex === 1 ? 1 : displayIndex === 0 ? 2 : 3;
                const isFirst = actualRank === 1;
                const isSecond = actualRank === 2;

                return (
                  <div
                    key={user.rank}
                    className={`podium-item podium-${actualRank}`}
                  >
                    <div className={`podium-avatar ${isFirst ? 'first' : isSecond ? 'second' : 'third'}`}>
                      <span className="avatar-emoji">{getAvatar(user.rank - 1)}</span>
                      <div className="podium-crown">
                        {actualRank === 1 && <Crown size={20} />}
                        {actualRank === 2 && <Medal size={16} />}
                        {actualRank === 3 && <Award size={16} />}
                      </div>
                    </div>
                    <span className="podium-name">{user.displayName.split(/(?=[A-Z])/)[0]}</span>
                    <span className={`podium-accuracy ${user.accuracy > aiAccuracy ? 'beating' : ''}`}>
                      {user.accuracy.toFixed(1)}%
                    </span>
                    {user.streak >= 3 && (
                      <span className="podium-streak">
                        <Flame size={12} />
                        {user.streak}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* List - Rest of Rankings */}
        {!loading && restOfList.length > 0 && (
          <div className="rankings-list">
            {restOfList.map((user, index) => (
              <div
                key={user.rank}
                className={`rank-item ${user.accuracy > aiAccuracy ? 'beating-ai' : ''}`}
              >
                <span className="rank-number">{user.rank}</span>
                <div className="rank-avatar">
                  {getAvatar(user.rank - 1)}
                </div>
                <div className="rank-info">
                  <span className="rank-name">{user.displayName}</span>
                  <span className="rank-predictions">{user.predictions} predictions</span>
                </div>
                <div className="rank-stats">
                  <span className={`rank-accuracy ${user.accuracy > aiAccuracy ? 'green' : ''}`}>
                    {user.accuracy.toFixed(1)}%
                  </span>
                  {user.streak >= 3 && (
                    <span className="rank-streak">
                      <Flame size={10} />
                      {user.streak}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && leaderboard.length === 0 && (
          <div className="lb-empty">
            <span className="empty-icon">🏆</span>
            <h3>No Rankings Yet</h3>
            <p>Make predictions to join the leaderboard!</p>
            <Link href="/" className="empty-cta">
              Start Predicting
            </Link>
          </div>
        )}

        {/* CTA */}
        {!loading && leaderboard.length > 0 && (
          <div className="lb-cta">
            <p>Make more predictions to climb the ranks!</p>
            <Link href="/" className="cta-button">
              Predict Now
            </Link>
          </div>
        )}

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
          padding: 16px 20px;
          max-width: 500px;
          margin: 0 auto;
        }

        .lb-back {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.6);
          transition: color 0.2s;
        }

        .lb-back:hover {
          color: #fff;
        }

        .lb-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .lb-title h1 {
          font-size: 20px;
          font-weight: 700;
          color: #fff;
          margin: 0;
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

        .lb-header-spacer {
          width: 40px;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           MAIN
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .lb-main {
          max-width: 500px;
          margin: 0 auto;
          padding: 20px 16px;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           AI BENCHMARK
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .ai-benchmark {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(139, 92, 246, 0.05));
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 16px;
          margin-bottom: 24px;
        }

        .ai-icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(139, 92, 246, 0.2);
          border-radius: 12px;
          font-size: 22px;
        }

        .ai-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .ai-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        .ai-accuracy {
          font-size: 20px;
          font-weight: 700;
          color: #8B5CF6;
          font-family: 'DM Mono', monospace;
        }

        .ai-status {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }

        .beat-count {
          font-size: 18px;
          font-weight: 700;
          color: #00E676;
          font-family: 'DM Mono', monospace;
        }

        .beat-label {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           TABS
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .lb-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 28px;
          overflow-x: auto;
          padding-bottom: 4px;
          -webkit-overflow-scrolling: touch;
        }

        .lb-tabs::-webkit-scrollbar {
          display: none;
        }

        .lb-tab {
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 20px;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.2s;
        }

        .lb-tab:hover {
          color: rgba(255, 255, 255, 0.8);
          background: rgba(255, 255, 255, 0.06);
        }

        .lb-tab.active {
          color: #000;
          background: #00E676;
          border-color: #00E676;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           LOADING
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .lb-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          gap: 16px;
          color: rgba(255, 255, 255, 0.4);
          font-size: 14px;
        }

        .lb-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(255, 255, 255, 0.1);
          border-top-color: #00E676;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           PODIUM
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .podium-section {
          margin-bottom: 32px;
        }

        .podium {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 12px;
          padding: 20px 0;
        }

        .podium-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .podium-1 {
          order: 2;
        }

        .podium-2 {
          order: 1;
        }

        .podium-3 {
          order: 3;
        }

        .podium-avatar {
          position: relative;
          width: 64px;
          height: 64px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid rgba(255, 255, 255, 0.1);
        }

        .podium-avatar.first {
          width: 80px;
          height: 80px;
          border-radius: 24px;
          background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 193, 7, 0.1));
          border-color: rgba(255, 215, 0, 0.4);
          box-shadow: 0 0 30px rgba(255, 215, 0, 0.2);
        }

        .podium-avatar.second {
          background: linear-gradient(135deg, rgba(192, 192, 192, 0.15), rgba(156, 163, 175, 0.1));
          border-color: rgba(192, 192, 192, 0.3);
        }

        .podium-avatar.third {
          background: linear-gradient(135deg, rgba(205, 127, 50, 0.15), rgba(180, 83, 9, 0.1));
          border-color: rgba(205, 127, 50, 0.3);
        }

        .avatar-emoji {
          font-size: 28px;
        }

        .podium-avatar.first .avatar-emoji {
          font-size: 36px;
        }

        .podium-crown {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
        }

        .podium-1 .podium-crown {
          color: #FFD700;
          top: -14px;
        }

        .podium-2 .podium-crown {
          color: #C0C0C0;
        }

        .podium-3 .podium-crown {
          color: #CD7F32;
        }

        .podium-name {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          max-width: 80px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: center;
        }

        .podium-accuracy {
          font-size: 16px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.7);
          font-family: 'DM Mono', monospace;
        }

        .podium-1 .podium-accuracy {
          font-size: 20px;
        }

        .podium-accuracy.beating {
          color: #00E676;
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

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           RANKINGS LIST
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .rankings-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .rank-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 14px;
          transition: background 0.2s;
        }

        .rank-item:hover {
          background: rgba(255, 255, 255, 0.04);
        }

        .rank-item.beating-ai {
          border-color: rgba(0, 230, 118, 0.15);
        }

        .rank-number {
          width: 28px;
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.35);
          text-align: center;
          font-family: 'DM Mono', monospace;
        }

        .rank-avatar {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          font-size: 18px;
        }

        .rank-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
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

        .rank-accuracy {
          font-size: 15px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.7);
          font-family: 'DM Mono', monospace;
        }

        .rank-accuracy.green {
          color: #00E676;
        }

        .rank-streak {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 2px 6px;
          background: rgba(255, 107, 53, 0.15);
          color: #FF6B35;
          font-size: 10px;
          font-weight: 600;
          border-radius: 8px;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           EMPTY STATE
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .lb-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 60px 20px;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .lb-empty h3 {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 8px;
        }

        .lb-empty p {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0 0 24px;
        }

        .empty-cta {
          padding: 12px 24px;
          background: #00E676;
          color: #000;
          font-size: 14px;
          font-weight: 600;
          border-radius: 12px;
          text-decoration: none;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .empty-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 230, 118, 0.3);
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           CTA
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .lb-cta {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 32px 20px;
          margin-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .lb-cta p {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.4);
          margin: 0 0 16px;
        }

        .cta-button {
          padding: 14px 32px;
          background: linear-gradient(135deg, #00E676, #00C853);
          color: #000;
          font-size: 15px;
          font-weight: 700;
          border-radius: 14px;
          text-decoration: none;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px rgba(0, 230, 118, 0.3);
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           DEMO BADGE
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .lb-demo-badge {
          text-align: center;
          padding: 16px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.3);
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           RESPONSIVE
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        @media (max-width: 359px) {
          .lb-header-content {
            padding: 12px 16px;
          }

          .lb-title h1 {
            font-size: 18px;
          }

          .lb-main {
            padding: 16px 12px;
          }

          .ai-benchmark {
            padding: 12px;
            gap: 10px;
          }

          .ai-icon {
            width: 38px;
            height: 38px;
            font-size: 18px;
          }

          .ai-accuracy {
            font-size: 18px;
          }

          .podium-avatar {
            width: 54px;
            height: 54px;
          }

          .podium-avatar.first {
            width: 68px;
            height: 68px;
          }

          .avatar-emoji {
            font-size: 24px;
          }

          .podium-avatar.first .avatar-emoji {
            font-size: 30px;
          }

          .rank-item {
            padding: 12px;
            gap: 10px;
          }

          .rank-avatar {
            width: 36px;
            height: 36px;
            font-size: 16px;
          }

          .rank-name {
            font-size: 13px;
          }
        }

        @media (min-width: 481px) {
          .lb-main {
            padding: 24px 20px;
          }

          .podium-avatar {
            width: 72px;
            height: 72px;
          }

          .podium-avatar.first {
            width: 90px;
            height: 90px;
          }

          .avatar-emoji {
            font-size: 32px;
          }

          .podium-avatar.first .avatar-emoji {
            font-size: 40px;
          }

          .podium-name {
            font-size: 14px;
          }

          .podium-accuracy {
            font-size: 18px;
          }

          .podium-1 .podium-accuracy {
            font-size: 24px;
          }
        }
      `}</style>
    </div>
  );
}
