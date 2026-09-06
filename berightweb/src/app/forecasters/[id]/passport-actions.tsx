'use client';

import { useState } from 'react';
import { Check, Copy, Download, Send, Share2, ShieldCheck } from 'lucide-react';
import styles from './page.module.css';

type PassportActionsProps = {
  subjectId: string;
  displayName: string;
};

export function PassportActions({ subjectId, displayName }: PassportActionsProps) {
  const [message, setMessage] = useState<string | null>(null);
  const encoded = encodeURIComponent(subjectId);
  const bundleUrl = `/api/v2/passports/${encoded}/evidence-bundle`;
  const verifyUrl = `/api/v2/passports/${encoded}/verify`;

  function shareDetails() {
    const url = `${window.location.origin}/forecasters/${encoded}`;
    return {
      url,
      text: `View ${displayName}'s evidence-backed Polymarket Passport on BeRight.`,
    };
  }

  async function copyApiUrl() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/api/v2/passports/${encoded}`);
      setMessage('API URL copied');
    } catch {
      setMessage('Could not copy the API URL');
    }
  }

  async function verify() {
    setMessage('Verifying published evidence…');
    try {
      const response = await fetch(verifyUrl, { method: 'POST' });
      setMessage(response.ok ? 'Replay matched the published score' : 'Replay could not be verified');
    } catch {
      setMessage('Verification service is unavailable');
    }
  }

  function shareOnX() {
    const { text, url } = shareDetails();
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  function shareOnTelegram() {
    const { text, url } = shareDetails();
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  async function sharePassport() {
    const { text, url } = shareDetails();
    try {
      if (navigator.share) {
        await navigator.share({ title: `${displayName} · Polymarket Passport`, text, url });
        setMessage('Passport shared');
        return;
      }
      await navigator.clipboard.writeText(url);
      setMessage('Passport link copied');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setMessage('Could not share this Passport');
    }
  }

  return (
    <div className={styles.passportActions}>
      <a className={styles.externalLink} href={bundleUrl} download>
        <Download size={16} aria-hidden="true" />
        Evidence bundle
      </a>
      <button type="button" className={styles.actionButton} onClick={() => void verify()}>
        <ShieldCheck size={16} aria-hidden="true" />
        Verify
      </button>
      <button type="button" className={styles.actionButton} onClick={() => void copyApiUrl()}>
        {message === 'API URL copied'
          ? <Check size={16} aria-hidden="true" />
          : <Copy size={16} aria-hidden="true" />}
        Copy API
      </button>
      <button type="button" className={styles.actionButton} onClick={shareOnX} aria-label="Share Passport on X">
        <span className={styles.xMark} aria-hidden="true">X</span>
        Share
      </button>
      <button type="button" className={styles.actionButton} onClick={shareOnTelegram} aria-label="Share Passport on Telegram">
        <Send size={16} aria-hidden="true" />
        Telegram
      </button>
      <button type="button" className={styles.actionButton} onClick={() => void sharePassport()} aria-label="Share Passport using another app">
        <Share2 size={16} aria-hidden="true" />
        More
      </button>
      {message && <span className={styles.actionMessage} role="status">{message}</span>}
    </div>
  );
}
