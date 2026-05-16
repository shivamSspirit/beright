'use client';

import { useState, useCallback } from 'react';
import { Share2, Twitter, Copy, Check, MessageCircle } from 'lucide-react';
import {
  ShareContext,
  shareNative,
  copyShareLink,
  getTwitterShareUrl,
  getTelegramShareUrl,
} from '@/lib/referral';
import styles from './ShareButton.module.css';

interface ShareButtonProps {
  context: ShareContext;
  referralCode?: string;
  variant?: 'icon' | 'button' | 'expanded';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onShare?: () => void;
}

export default function ShareButton({
  context,
  referralCode,
  variant = 'button',
  size = 'md',
  className = '',
  onShare,
}: ShareButtonProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    // Try native share first (mobile)
    const shared = await shareNative(context, referralCode);
    if (shared) {
      onShare?.();
      return;
    }
    // Fallback: show dropdown
    setShowDropdown(true);
  }, [context, referralCode, onShare]);

  const handleCopy = useCallback(async () => {
    const success = await copyShareLink(context, referralCode);
    if (success) {
      setCopied(true);
      onShare?.();
      setTimeout(() => {
        setCopied(false);
        setShowDropdown(false);
      }, 1500);
    }
  }, [context, referralCode, onShare]);

  const handleTwitter = useCallback(() => {
    window.open(getTwitterShareUrl(context, referralCode), '_blank');
    onShare?.();
    setShowDropdown(false);
  }, [context, referralCode, onShare]);

  const handleTelegram = useCallback(() => {
    window.open(getTelegramShareUrl(context, referralCode), '_blank');
    onShare?.();
    setShowDropdown(false);
  }, [context, referralCode, onShare]);

  const sizeClass = styles[size];

  if (variant === 'icon') {
    return (
      <div className={styles.wrapper}>
        <button
          className={`${styles.iconBtn} ${sizeClass} ${className}`}
          onClick={handleShare}
          aria-label="Share"
        >
          <Share2 size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
        </button>
        {showDropdown && (
          <ShareDropdown
            onCopy={handleCopy}
            onTwitter={handleTwitter}
            onTelegram={handleTelegram}
            onClose={() => setShowDropdown(false)}
            copied={copied}
          />
        )}
      </div>
    );
  }

  if (variant === 'expanded') {
    return (
      <div className={`${styles.expandedContainer} ${className}`}>
        <button className={styles.expandedBtn} onClick={handleTwitter}>
          <Twitter size={18} />
          <span>Twitter</span>
        </button>
        <button className={styles.expandedBtn} onClick={handleTelegram}>
          <MessageCircle size={18} />
          <span>Telegram</span>
        </button>
        <button className={styles.expandedBtn} onClick={handleCopy}>
          {copied ? <Check size={18} /> : <Copy size={18} />}
          <span>{copied ? 'Copied!' : 'Copy Link'}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <button
        className={`${styles.btn} ${sizeClass} ${className}`}
        onClick={handleShare}
      >
        <Share2 size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />
        <span>Share</span>
      </button>
      {showDropdown && (
        <ShareDropdown
          onCopy={handleCopy}
          onTwitter={handleTwitter}
          onTelegram={handleTelegram}
          onClose={() => setShowDropdown(false)}
          copied={copied}
        />
      )}
    </div>
  );
}

interface ShareDropdownProps {
  onCopy: () => void;
  onTwitter: () => void;
  onTelegram: () => void;
  onClose: () => void;
  copied: boolean;
}

function ShareDropdown({
  onCopy,
  onTwitter,
  onTelegram,
  onClose,
  copied,
}: ShareDropdownProps) {
  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.dropdown}>
        <button className={styles.dropdownItem} onClick={onTwitter}>
          <Twitter size={16} />
          <span>Share on Twitter</span>
        </button>
        <button className={styles.dropdownItem} onClick={onTelegram}>
          <MessageCircle size={16} />
          <span>Share on Telegram</span>
        </button>
        <div className={styles.dropdownDivider} />
        <button className={styles.dropdownItem} onClick={onCopy}>
          {copied ? <Check size={16} className={styles.success} /> : <Copy size={16} />}
          <span>{copied ? 'Copied!' : 'Copy Link'}</span>
        </button>
      </div>
    </>
  );
}
