'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Code, ExternalLink, Settings } from 'lucide-react';
import EmbedWidget, { generateEmbedCode } from '@/components/EmbedWidget';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';

export default function EmbedDemoPage() {
  const [marketId, setMarketId] = useState('btc-150k');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showAI, setShowAI] = useState(true);
  const [compact, setCompact] = useState(false);
  const [copied, setCopied] = useState(false);

  const embedCode = generateEmbedCode({
    marketId,
    theme,
    showAI,
    compact,
  });

  const handleCopy = async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-mesh pb-24 pt-20">
      <Header />

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2 flex items-center justify-center gap-2">
            <Code size={24} className="text-[var(--ai-primary)]" />
            Embed Widget
          </h1>
          <p className="text-[var(--text-muted)] text-sm">
            Add prediction markets to your website with one line of code
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Preview */}
          <motion.div
            className="glass-card p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Preview</h2>
              <span className={`px-2 py-1 rounded-full text-xs ${
                theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
              }`}>
                {theme} theme
              </span>
            </div>

            <div className={`p-4 rounded-xl ${
              theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-gray-50'
            }`}>
              <EmbedWidget
                marketId={marketId}
                question="Will Bitcoin hit $150K by end of 2026?"
                platform="Polymarket"
                showAI={showAI}
                showConsensus={true}
                theme={theme}
                compact={compact}
              />
            </div>
          </motion.div>

          {/* Configuration */}
          <motion.div
            className="glass-card p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Settings size={18} className="text-[var(--ai-primary)]" />
              <h2 className="font-semibold">Configuration</h2>
            </div>

            <div className="space-y-4">
              {/* Market ID */}
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">
                  Market ID
                </label>
                <input
                  type="text"
                  value={marketId}
                  onChange={(e) => setMarketId(e.target.value)}
                  className="w-full px-4 py-2 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-subtle)] focus:border-[var(--yes-primary)] focus:outline-none text-sm"
                  placeholder="e.g., btc-150k"
                />
              </div>

              {/* Theme Toggle */}
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">
                  Theme
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      theme === 'dark'
                        ? 'bg-[var(--yes-primary)] text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                    }`}
                  >
                    Dark
                  </button>
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      theme === 'light'
                        ? 'bg-[var(--yes-primary)] text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                    }`}
                  >
                    Light
                  </button>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-sm">Show AI Prediction</span>
                  <button
                    onClick={() => setShowAI(!showAI)}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      showAI ? 'bg-[var(--yes-primary)]' : 'bg-[var(--bg-secondary)]'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                      showAI ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </label>

                <label className="flex items-center justify-between">
                  <span className="text-sm">Compact Mode</span>
                  <button
                    onClick={() => setCompact(!compact)}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      compact ? 'bg-[var(--yes-primary)]' : 'bg-[var(--bg-secondary)]'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                      compact ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </label>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Embed Code */}
        <motion.div
          className="glass-card p-6 mt-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Embed Code</h2>
            <button
              onClick={handleCopy}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                copied
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-white'
              }`}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
          </div>

          <pre className="bg-[var(--bg-secondary)] rounded-xl p-4 overflow-x-auto text-sm text-[var(--text-secondary)] font-mono">
            {embedCode}
          </pre>
        </motion.div>

        {/* Use Cases */}
        <motion.div
          className="grid md:grid-cols-3 gap-4 mt-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {[
            {
              title: 'News Articles',
              description: 'Embed market odds directly in your articles about future events',
              icon: '📰',
            },
            {
              title: 'Podcasts & Videos',
              description: 'Add prediction widgets to show notes and descriptions',
              icon: '🎙️',
            },
            {
              title: 'Research Reports',
              description: 'Include live market consensus in your analysis',
              icon: '📊',
            },
          ].map((useCase, i) => (
            <div key={i} className="glass-card p-4">
              <div className="text-2xl mb-2">{useCase.icon}</div>
              <h3 className="font-semibold mb-1">{useCase.title}</h3>
              <p className="text-xs text-[var(--text-muted)]">{useCase.description}</p>
            </div>
          ))}
        </motion.div>

        {/* Revenue Share CTA */}
        <motion.div
          className="glass-card p-6 mt-6 border-[var(--yes-primary)]/30 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="text-lg font-bold mb-2">Earn Revenue</h3>
          <p className="text-[var(--text-muted)] text-sm mb-4">
            Publishers earn 30% of trading fees from their embedded widgets.
            <br />
            More embeds = more revenue.
          </p>
          <button className="btn-primary">
            Apply for Publisher Program
          </button>
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
}
