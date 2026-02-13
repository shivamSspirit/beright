'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useUser } from '@/context/UserContext';

interface ConnectWalletPromptProps {
  title?: string;
  description?: string;
  onClose?: () => void;
}

export default function ConnectWalletPrompt({
  title = 'Connect Wallet',
  description = 'Link your wallet to make predictions and compete on the leaderboard',
  onClose,
}: ConnectWalletPromptProps) {
  const { login, isLoading } = useUser();
  const [isConnecting, setIsConnecting] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Only render portal on client
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleConnect = async () => {
    if (isConnecting || isLoading) return;

    setIsConnecting(true);
    try {
      await login();
    } catch (error) {
      console.warn('[ConnectWallet] Login error:', error);
    } finally {
      setTimeout(() => setIsConnecting(false), 500);
    }
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const buttonDisabled = isLoading || isConnecting;

  const modalContent = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 9999,
        padding: '20px',
      }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 30, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '380px',
          background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '24px',
          padding: '40px 32px',
          textAlign: 'center',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              color: '#888',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = '#888';
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Wallet Icon */}
        <div
          style={{
            width: '100px',
            height: '100px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.2) 0%, rgba(0, 176, 255, 0.2) 100%)',
            borderRadius: '50%',
            margin: '0 auto 24px',
            boxShadow: '0 0 40px rgba(0, 230, 118, 0.15)',
          }}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#00E676" strokeWidth="1.5">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <path d="M22 10H18C16.9 10 16 10.9 16 12C16 13.1 16.9 14 18 14H22" />
            <circle cx="18" cy="12" r="1" fill="#00E676" />
          </svg>
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: '#fff',
            margin: '0 0 12px',
            fontFamily: 'inherit',
          }}
        >
          {title}
        </h2>

        {/* Description */}
        <p
          style={{
            fontSize: '15px',
            color: '#888',
            margin: '0 0 28px',
            lineHeight: 1.6,
          }}
        >
          {description}
        </p>

        {/* Features */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            marginBottom: '32px',
            textAlign: 'left',
          }}
        >
          {[
            'Make predictions on real markets',
            'Track your accuracy & Brier score',
            'Compete on the leaderboard',
          ].map((feature, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '14px',
                color: '#ccc',
              }}
            >
              <span
                style={{
                  width: '22px',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0, 230, 118, 0.15)',
                  borderRadius: '50%',
                  color: '#00E676',
                  fontSize: '12px',
                  flexShrink: 0,
                }}
              >
                ✓
              </span>
              <span>{feature}</span>
            </div>
          ))}
        </div>

        {/* Connect Button */}
        <button
          onClick={handleConnect}
          disabled={buttonDisabled}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            width: '100%',
            padding: '16px 24px',
            background: buttonDisabled
              ? 'linear-gradient(135deg, #00E676 0%, #00B0FF 100%)'
              : 'linear-gradient(135deg, #00E676 0%, #00B0FF 100%)',
            border: 'none',
            borderRadius: '14px',
            fontSize: '16px',
            fontWeight: 600,
            color: '#000',
            cursor: buttonDisabled ? 'not-allowed' : 'pointer',
            opacity: buttonDisabled ? 0.7 : 1,
            transition: 'all 0.2s',
            boxShadow: '0 4px 20px rgba(0, 230, 118, 0.3)',
            fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => {
            if (!buttonDisabled) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 230, 118, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 230, 118, 0.3)';
          }}
        >
          {buttonDisabled ? (
            <div
              style={{
                width: '24px',
                height: '24px',
                border: '3px solid transparent',
                borderTopColor: '#000',
                borderRadius: '50%',
                animation: 'cwp-spin 0.8s linear infinite',
              }}
            />
          ) : (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M22 10H18C16.9 10 16 10.9 16 12C16 13.1 16.9 14 18 14H22" />
              </svg>
              Connect Wallet
            </>
          )}
        </button>

        {/* Security Note */}
        <p
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            marginTop: '16px',
            fontSize: '12px',
            color: '#666',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <circle cx="12" cy="16" r="1" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          Secure connection via Privy
        </p>
      </motion.div>

      {/* Global keyframe animation for spinner */}
      <style>{`
        @keyframes cwp-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </motion.div>
  );

  // Use portal to render at document body level
  if (!mounted) return null;

  return createPortal(modalContent, document.body);
}
