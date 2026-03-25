'use client';

import { useState } from 'react';
import { useMode } from '@/context/ModeContext';
import Link from 'next/link';

export default function WaitlistPage() {
  const { isDemo } = useMode();
  const [email, setEmail] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [tier, setTier] = useState('pro');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          walletAddress: walletAddress || undefined,
          tier,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setIsSubmitted(true);
      } else {
        setError(data.error || 'Failed to join waitlist');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (isSubmitted) {
    return (
      <div className="waitlist-page">
        <div className="waitlist-card success">
          <div className="success-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h1>You're on the list!</h1>
          <p>We'll notify you when BeRight production is ready.</p>
          <p className="position">You're in a great position for early access.</p>
          <Link href="/" className="back-btn">
            Continue Exploring Demo
          </Link>
        </div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="waitlist-page">
      <div className="waitlist-card">
        <div className="header">
          <h1>Join the Waitlist</h1>
          <p>Get early access to BeRight production with real trading.</p>
        </div>

        <div className="demo-notice">
          <span className="notice-badge">Currently in Demo</span>
          <p>You're exploring BeRight on Devnet with paper trading. Join the waitlist to be notified when production launches with real markets.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="wallet">Solana Wallet Address (optional)</label>
            <input
              type="text"
              id="wallet"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="Your Solana wallet address"
            />
            <span className="hint">Link your wallet for priority access</span>
          </div>

          <div className="form-group">
            <label>Interested Tier</label>
            <div className="tier-options">
              <button
                type="button"
                className={`tier-btn ${tier === 'free' ? 'active' : ''}`}
                onClick={() => setTier('free')}
              >
                <span className="tier-name">Free</span>
                <span className="tier-desc">Basic access</span>
              </button>
              <button
                type="button"
                className={`tier-btn ${tier === 'pro' ? 'active' : ''}`}
                onClick={() => setTier('pro')}
              >
                <span className="tier-name">Pro</span>
                <span className="tier-desc">Full trading</span>
              </button>
              <button
                type="button"
                className={`tier-btn ${tier === 'whale' ? 'active' : ''}`}
                onClick={() => setTier('whale')}
              >
                <span className="tier-name">Whale</span>
                <span className="tier-desc">Copy trading</span>
              </button>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="submit-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Joining...' : 'Join Waitlist'}
          </button>
        </form>

        <div className="footer">
          <p>Already have access? <Link href="/">Go to app</Link></p>
        </div>
      </div>
      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .waitlist-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: linear-gradient(180deg, #080C14 0%, #0A1020 100%);
  }

  .waitlist-card {
    width: 100%;
    max-width: 480px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 32px;
  }

  .waitlist-card.success {
    text-align: center;
  }

  .success-icon {
    color: #22C55E;
    margin-bottom: 24px;
  }

  .success-icon svg {
    width: 64px;
    height: 64px;
  }

  .header {
    text-align: center;
    margin-bottom: 24px;
  }

  .header h1 {
    font-size: 28px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 8px 0;
  }

  .header p {
    color: rgba(255, 255, 255, 0.6);
    font-size: 15px;
    margin: 0;
  }

  h1 {
    font-size: 28px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 12px 0;
  }

  p {
    color: rgba(255, 255, 255, 0.6);
    font-size: 15px;
    margin: 0 0 8px 0;
  }

  .position {
    color: #00FFB2;
    font-weight: 500;
    margin-top: 16px;
  }

  .demo-notice {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 24px;
  }

  .notice-badge {
    display: inline-block;
    background: #F59E0B;
    color: #000;
    font-size: 11px;
    font-weight: 700;
    padding: 4px 8px;
    border-radius: 4px;
    margin-bottom: 8px;
  }

  .demo-notice p {
    color: rgba(255, 255, 255, 0.8);
    font-size: 13px;
    line-height: 1.5;
    margin: 0;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  label {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
  }

  input {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 15px;
    color: #fff;
    transition: border-color 0.2s;
  }

  input:focus {
    outline: none;
    border-color: #00FFB2;
  }

  input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }

  .tier-options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .tier-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 12px 8px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .tier-btn:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .tier-btn.active {
    border-color: #00FFB2;
    background: rgba(0, 255, 178, 0.1);
  }

  .tier-name {
    font-size: 14px;
    font-weight: 600;
    color: #fff;
  }

  .tier-desc {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
  }

  .error-message {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #EF4444;
    padding: 12px;
    border-radius: 8px;
    font-size: 13px;
  }

  .submit-btn {
    background: linear-gradient(135deg, #00FFB2 0%, #0066FF 100%);
    border: none;
    border-radius: 8px;
    padding: 14px 24px;
    font-size: 15px;
    font-weight: 600;
    color: #fff;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .submit-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .back-btn {
    display: inline-block;
    margin-top: 24px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 12px 24px;
    font-size: 14px;
    font-weight: 500;
    color: #fff;
    text-decoration: none;
    transition: background 0.2s;
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .footer {
    text-align: center;
    margin-top: 24px;
    padding-top: 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .footer p {
    font-size: 13px;
  }

  .footer a {
    color: #00FFB2;
    text-decoration: none;
  }

  .footer a:hover {
    text-decoration: underline;
  }
`;
