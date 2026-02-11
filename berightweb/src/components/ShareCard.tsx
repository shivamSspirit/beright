'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Prediction } from '@/lib/types';
import { X, Download, Twitter, Copy, Check } from 'lucide-react';
import { useState, useRef } from 'react';

interface ShareCardProps {
  isOpen: boolean;
  prediction: Prediction | null;
  userDirection: 'yes' | 'no';
  userConfidence: number;
  onClose: () => void;
}

export default function ShareCard({
  isOpen,
  prediction,
  userDirection,
  userConfidence,
  onClose
}: ShareCardProps) {
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  if (!prediction) return null;

  const aiAgrees = Math.abs(prediction.aiPrediction - userConfidence) < 15;
  const userMoreBullish = userConfidence > prediction.aiPrediction;

  const shareText = `My take on "${prediction.question}"\n\n🧠 Me: ${userConfidence}% ${userDirection.toUpperCase()}\n🤖 AI: ${prediction.aiPrediction}% YES\n\n${aiAgrees ? 'AI and I agree!' : userMoreBullish ? "I'm more bullish than AI" : "I'm more bearish than AI"}\n\nMake your predictions at beright.ai`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTwitterShare = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-md"
            initial={{ y: 50, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="glass-card p-6">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <X size={20} className="text-[var(--text-muted)]" />
              </button>

              <h3 className="text-lg font-semibold mb-4">Share Your Take</h3>

              {/* Shareable Card Preview */}
              <div
                ref={cardRef}
                className="relative rounded-2xl overflow-hidden mb-6"
                style={{
                  background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)'
                }}
              >
                {/* Decorative elements */}
                <div className="absolute top-0 left-0 w-32 h-32 bg-[var(--yes-primary)]/20 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-[var(--no-primary)]/20 rounded-full blur-3xl" />

                <div className="relative p-6">
                  {/* Logo */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[var(--yes-primary)] to-[var(--ai-primary)] flex items-center justify-center">
                      <span className="text-xs font-bold">B</span>
                    </div>
                    <span className="font-semibold text-sm">BeRight</span>
                  </div>

                  {/* Question */}
                  <p className="text-lg font-semibold mb-6 leading-snug">
                    {prediction.question}
                  </p>

                  {/* Predictions */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className={`p-4 rounded-xl ${
                      userDirection === 'yes'
                        ? 'bg-[var(--yes-primary)]/20 border border-[var(--yes-primary)]/30'
                        : 'bg-[var(--no-primary)]/20 border border-[var(--no-primary)]/30'
                    }`}>
                      <div className="text-xs text-[var(--text-muted)] mb-1">MY TAKE</div>
                      <div className={`text-2xl font-bold mono ${
                        userDirection === 'yes' ? 'text-[var(--yes-primary)]' : 'text-[var(--no-primary)]'
                      }`}>
                        {userConfidence}%
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] uppercase">
                        {userDirection}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[var(--ai-primary)]/20 border border-[var(--ai-primary)]/30">
                      <div className="text-xs text-[var(--text-muted)] mb-1">AI SAYS</div>
                      <div className="text-2xl font-bold mono text-[var(--ai-primary)]">
                        {prediction.aiPrediction}%
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] uppercase">
                        YES
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                    aiAgrees
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-[var(--ai-primary)]/20 text-[var(--ai-primary)]'
                  }`}>
                    {aiAgrees
                      ? '🤝 AI and I agree'
                      : userMoreBullish
                        ? '📈 More bullish than AI'
                        : '📉 More bearish than AI'
                    }
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-black/30 flex items-center justify-between">
                  <span className="text-xs text-[var(--text-muted)]">beright.ai</span>
                  <span className="text-xs text-[var(--text-muted)]">Human vs AI</span>
                </div>
              </div>

              {/* Share Actions */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={handleTwitterShare}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#1DA1F2]/10 border border-[#1DA1F2]/30 hover:bg-[#1DA1F2]/20 transition-colors"
                >
                  <Twitter size={20} className="text-[#1DA1F2]" />
                  <span className="text-xs text-[var(--text-secondary)]">Twitter</span>
                </button>

                <button
                  onClick={handleCopy}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 border border-[var(--border-subtle)] hover:bg-white/10 transition-colors"
                >
                  {copied ? (
                    <Check size={20} className="text-green-400" />
                  ) : (
                    <Copy size={20} className="text-[var(--text-secondary)]" />
                  )}
                  <span className="text-xs text-[var(--text-secondary)]">
                    {copied ? 'Copied!' : 'Copy'}
                  </span>
                </button>

                <button
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 border border-[var(--border-subtle)] hover:bg-white/10 transition-colors"
                >
                  <Download size={20} className="text-[var(--text-secondary)]" />
                  <span className="text-xs text-[var(--text-secondary)]">Save</span>
                </button>
              </div>

              <button
                onClick={onClose}
                className="w-full mt-4 py-3 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                Continue without sharing
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
