'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Prediction } from '@/lib/types';
import { Bot, User, ChevronDown, ChevronUp, Zap, Share2, X, TrendingUp, Users } from 'lucide-react';

interface AIDebateModalProps {
  isOpen: boolean;
  prediction: Prediction | null;
  userDirection: 'yes' | 'no';
  userConfidence: number;
  onConfirm: () => void;
  onChangePosition: () => void;
  onClose: () => void;
  onShare: () => void;
}

export default function AIDebateModal({
  isOpen,
  prediction,
  userDirection,
  userConfidence,
  onConfirm,
  onChangePosition,
  onClose,
  onShare
}: AIDebateModalProps) {
  const [showEvidence, setShowEvidence] = useState(false);
  const [isThinking, setIsThinking] = useState(true);
  const [typedText, setTypedText] = useState('');

  const aiAgrees = Math.abs((prediction?.aiPrediction || 0) - userConfidence) < 15;
  const disagreementGap = Math.abs((prediction?.aiPrediction || 0) - userConfidence);

  // Simulate AI thinking and typing
  useEffect(() => {
    if (isOpen && prediction) {
      setIsThinking(true);
      setTypedText('');

      const thinkTimer = setTimeout(() => {
        setIsThinking(false);

        // Typewriter effect
        const text = prediction.aiReasoning;
        let index = 0;
        const typeInterval = setInterval(() => {
          if (index < text.length) {
            setTypedText(text.slice(0, index + 1));
            index++;
          } else {
            clearInterval(typeInterval);
          }
        }, 15);

        return () => clearInterval(typeInterval);
      }, 1200);

      return () => clearTimeout(thinkTimer);
    }
  }, [isOpen, prediction]);

  if (!prediction) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
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
            className="relative w-full max-w-lg mx-4 mb-0 sm:mb-0 max-h-[90vh] overflow-y-auto"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="glass-card p-6 sm:p-8">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <X size={20} className="text-[var(--text-muted)]" />
              </button>

              {/* Header */}
              <div className="text-center mb-6">
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
                  aiAgrees
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-[var(--ai-primary)]/20 text-[var(--ai-primary)] border border-[var(--ai-primary)]/30'
                }`}>
                  <Bot size={16} />
                  {aiAgrees ? 'AI Agrees' : 'AI Disagrees'}
                </div>
              </div>

              {/* Comparison Display */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* User */}
                <div className={`p-4 rounded-xl border ${
                  userDirection === 'yes'
                    ? 'border-[var(--yes-primary)]/30 bg-[var(--yes-primary)]/10'
                    : 'border-[var(--no-primary)]/30 bg-[var(--no-primary)]/10'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <User size={16} className="text-[var(--text-secondary)]" />
                    <span className="text-sm text-[var(--text-secondary)]">YOU</span>
                  </div>
                  <div className={`text-3xl font-bold mono ${
                    userDirection === 'yes' ? 'text-[var(--yes-primary)]' : 'text-[var(--no-primary)]'
                  }`}>
                    {userConfidence}%
                  </div>
                  <div className="text-sm text-[var(--text-muted)] uppercase mt-1">
                    {userDirection}
                  </div>
                </div>

                {/* AI */}
                <div className="p-4 rounded-xl border border-[var(--ai-primary)]/30 bg-[var(--ai-primary)]/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot size={16} className="text-[var(--ai-primary)]" />
                    <span className="text-sm text-[var(--text-secondary)]">AI</span>
                  </div>
                  <div className="text-3xl font-bold mono text-[var(--ai-primary)]">
                    {prediction.aiPrediction}%
                  </div>
                  <div className="text-sm text-[var(--text-muted)] uppercase mt-1">
                    YES
                  </div>
                </div>
              </div>

              {/* Disagreement Gauge */}
              <div className="mb-6">
                <div className="flex justify-between text-xs text-[var(--text-muted)] mb-2">
                  <span>Agreement</span>
                  <span className="mono">{Math.max(0, 100 - disagreementGap)}%</span>
                </div>
                <div className="relative h-3 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                  <motion.div
                    className={`absolute top-0 left-0 h-full rounded-full ${
                      aiAgrees
                        ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                        : 'bg-gradient-to-r from-[var(--ai-primary)] to-purple-400'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(0, 100 - disagreementGap)}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                  />
                </div>
              </div>

              {/* Consensus Mini View */}
              <motion.div
                className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] mb-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-3">
                  BeRight Consensus
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <TrendingUp size={12} className="text-blue-400" />
                      Market
                    </span>
                    <span className="text-sm font-bold mono">{prediction.marketOdds}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <Bot size={12} className="text-[var(--ai-primary)]" />
                      AI
                    </span>
                    <span className="text-sm font-bold mono text-[var(--ai-primary)]">{prediction.aiPrediction}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <Users size={12} className="text-amber-400" />
                      Top Forecasters
                    </span>
                    <span className="text-sm font-bold mono">
                      {Math.round(prediction.marketOdds + (prediction.aiPrediction - prediction.marketOdds) * 0.3)}%
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* AI Reasoning */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--ai-primary)]/20 flex items-center justify-center glow-ai">
                    <Bot size={16} className="text-[var(--ai-primary)]" />
                  </div>
                  <span className="font-semibold text-[var(--text-secondary)]">BeRight AI</span>
                  {isThinking && (
                    <div className="ai-thinking px-3 py-1 rounded-full text-xs text-[var(--ai-primary)]">
                      thinking...
                    </div>
                  )}
                </div>

                <div className="bg-[var(--bg-secondary)] rounded-2xl rounded-tl-none p-4 min-h-[80px]">
                  {isThinking ? (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-[var(--ai-primary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-[var(--ai-primary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-[var(--ai-primary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  ) : (
                    <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                      {typedText}
                      <span className="animate-pulse">|</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Evidence Accordion */}
              <button
                onClick={() => setShowEvidence(!showEvidence)}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-[var(--border-subtle)] hover:border-[var(--border-glow)] transition-colors mb-6"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Zap size={16} className="text-[var(--ai-primary)]" />
                  View Evidence
                </span>
                {showEvidence ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              <AnimatePresence>
                {showEvidence && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mb-6"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* For */}
                      <div className="p-4 rounded-xl bg-[var(--yes-primary)]/10 border border-[var(--yes-primary)]/20">
                        <div className="text-xs font-semibold text-[var(--yes-primary)] uppercase mb-3">
                          Evidence For YES
                        </div>
                        <ul className="space-y-2">
                          {prediction.aiEvidence.for.map((item, i) => (
                            <li key={i} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                              <span className="text-[var(--yes-primary)] mt-1">+</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Against */}
                      <div className="p-4 rounded-xl bg-[var(--no-primary)]/10 border border-[var(--no-primary)]/20">
                        <div className="text-xs font-semibold text-[var(--no-primary)] uppercase mb-3">
                          Evidence For NO
                        </div>
                        <ul className="space-y-2">
                          {prediction.aiEvidence.against.map((item, i) => (
                            <li key={i} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                              <span className="text-[var(--no-primary)] mt-1">−</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={onChangePosition}
                  className="btn-secondary flex items-center justify-center gap-2"
                >
                  Change to {userDirection === 'yes' ? 'NO' : 'YES'}
                </button>
                <button
                  onClick={onConfirm}
                  className={userDirection === 'yes' ? 'btn-primary' : 'btn-danger'}
                >
                  Confirm {userDirection.toUpperCase()}
                </button>
              </div>

              {/* Share Button */}
              <button
                onClick={onShare}
                className="w-full mt-3 py-3 flex items-center justify-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <Share2 size={16} />
                <span className="text-sm">Share your take</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
