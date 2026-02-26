'use client';

import Link from 'next/link';

const RESOLUTION_SOURCES = [
  {
    category: 'Crypto & Finance',
    icon: '₿',
    sources: ['CoinGecko', 'CoinMarketCap', 'Bloomberg', 'Reuters', 'FRED'],
    examples: ['BTC price targets', 'ETH ATH', 'Fed rate decisions', 'CPI data'],
  },
  {
    category: 'Politics & Elections',
    icon: '🏛',
    sources: ['Associated Press (AP)', 'Reuters', 'Official Government Sources'],
    examples: ['Election results', 'Legislative votes', 'Appointments'],
  },
  {
    category: 'Sports',
    icon: '⚽',
    sources: ['ESPN', 'Official League APIs', 'Sports Reference'],
    examples: ['Game outcomes', 'Championships', 'Player stats'],
  },
  {
    category: 'Technology',
    icon: '💻',
    sources: ['Official Company Announcements', 'SEC Filings', 'Press Releases'],
    examples: ['Product launches', 'Earnings', 'M&A announcements'],
  },
  {
    category: 'Science & Weather',
    icon: '🔬',
    sources: ['NOAA', 'NASA', 'Peer-reviewed Publications', 'WHO'],
    examples: ['Temperature records', 'Space missions', 'Disease outbreaks'],
  },
];

const DISPUTE_PROCESS = [
  {
    step: 1,
    title: 'Initial Resolution',
    description: 'Market resolves based on oracle consensus from primary data sources.',
    duration: 'Immediate',
  },
  {
    step: 2,
    title: 'Challenge Period',
    description: 'Participants can challenge the resolution by staking tokens and providing evidence.',
    duration: '24-48 hours',
  },
  {
    step: 3,
    title: 'Evidence Review',
    description: 'Disputed resolutions are reviewed by the resolution committee with submitted evidence.',
    duration: '24-72 hours',
  },
  {
    step: 4,
    title: 'Community Vote',
    description: 'If unresolved, token holders vote on the outcome. Staked tokens from losing side are slashed.',
    duration: '48-72 hours',
  },
  {
    step: 5,
    title: 'Final Resolution',
    description: 'Outcome is finalized and payouts are distributed. No further appeals.',
    duration: 'Immediate',
  },
];

export default function ResolutionPage() {
  return (
    <div className="resolution-page">
      {/* Header */}
      <header className="docs-header">
        <Link href="/" className="logo">
          <span className="logo-be">Be</span>
          <span className="logo-right">Right</span>
        </Link>
        <nav className="nav-links">
          <Link href="/docs" className="nav-link">Docs</Link>
          <Link href="/docs/api" className="nav-link">API</Link>
          <Link href="/docs/faq" className="nav-link">FAQ</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="page-hero">
        <div className="hero-icon">⚖️</div>
        <h1>Market Resolution</h1>
        <p>How prediction markets are resolved fairly and transparently</p>
      </section>

      {/* Overview */}
      <section className="content-section">
        <div className="section-inner">
          <h2>How Resolution Works</h2>
          <p className="intro">
            Every prediction market has a clear resolution criteria and uses authoritative data sources
            to determine outcomes. Resolution is designed to be transparent, verifiable, and fair to all participants.
          </p>

          <div className="process-overview">
            <div className="process-card">
              <span className="process-num">1</span>
              <h3>Event Occurs</h3>
              <p>The predicted event happens (or doesn't) according to the market's criteria.</p>
            </div>
            <div className="process-arrow">→</div>
            <div className="process-card">
              <span className="process-num">2</span>
              <h3>Data Verification</h3>
              <p>Multiple authoritative sources confirm the outcome.</p>
            </div>
            <div className="process-arrow">→</div>
            <div className="process-card">
              <span className="process-num">3</span>
              <h3>Resolution</h3>
              <p>Market resolves YES or NO, shares are redeemed for $1 or $0.</p>
            </div>
            <div className="process-arrow">→</div>
            <div className="process-card">
              <span className="process-num">4</span>
              <h3>Payout</h3>
              <p>Winning positions are paid out instantly to wallets.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Oracle System */}
      <section className="content-section alt">
        <div className="section-inner">
          <h2>Oracle System</h2>
          <p className="intro">
            BeRight uses a multi-layered oracle system to ensure accurate and tamper-resistant resolution.
          </p>

          <div className="oracle-grid">
            <div className="oracle-card primary">
              <div className="oracle-header">
                <span className="oracle-badge">Primary</span>
                <h3>UMA Optimistic Oracle</h3>
              </div>
              <p>
                Decentralized oracle that allows anyone to propose outcomes with a bond.
                If disputed, it goes to UMA's DVM (Data Verification Mechanism) for token holder voting.
              </p>
              <ul>
                <li>Crypto-native disputes</li>
                <li>Economic security via bonding</li>
                <li>Decentralized final say</li>
              </ul>
            </div>

            <div className="oracle-card">
              <div className="oracle-header">
                <span className="oracle-badge secondary">Secondary</span>
                <h3>Chainlink Data Feeds</h3>
              </div>
              <p>
                For price-based markets, Chainlink provides decentralized price feeds
                aggregated from multiple exchanges.
              </p>
              <ul>
                <li>Real-time price data</li>
                <li>Tamper-resistant</li>
                <li>Industry standard</li>
              </ul>
            </div>

            <div className="oracle-card">
              <div className="oracle-header">
                <span className="oracle-badge secondary">Secondary</span>
                <h3>Manual Resolution</h3>
              </div>
              <p>
                For complex events without on-chain data sources, a committee of
                verifiers cross-references multiple authoritative sources.
              </p>
              <ul>
                <li>Human verification</li>
                <li>Multiple source requirement</li>
                <li>Dispute-able outcome</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Data Sources */}
      <section className="content-section">
        <div className="section-inner">
          <h2>Resolution Data Sources</h2>
          <p className="intro">
            Each market category uses specific authoritative sources for resolution.
          </p>

          <div className="sources-grid">
            {RESOLUTION_SOURCES.map((cat) => (
              <div key={cat.category} className="source-card">
                <div className="source-header">
                  <span className="source-icon">{cat.icon}</span>
                  <h3>{cat.category}</h3>
                </div>
                <div className="source-list">
                  <span className="source-label">Sources:</span>
                  <div className="source-tags">
                    {cat.sources.map((s) => (
                      <span key={s} className="source-tag">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="source-examples">
                  <span className="source-label">Example Markets:</span>
                  <ul>
                    {cat.examples.map((ex) => (
                      <li key={ex}>{ex}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dispute Process */}
      <section className="content-section alt">
        <div className="section-inner">
          <h2>Dispute Process</h2>
          <p className="intro">
            If you believe a market was resolved incorrectly, you can challenge the outcome.
          </p>

          <div className="dispute-timeline">
            {DISPUTE_PROCESS.map((step, i) => (
              <div key={step.step} className="dispute-step">
                <div className="step-marker">
                  <span className="step-num">{step.step}</span>
                  {i < DISPUTE_PROCESS.length - 1 && <div className="step-line" />}
                </div>
                <div className="step-content">
                  <div className="step-header">
                    <h3>{step.title}</h3>
                    <span className="step-duration">{step.duration}</span>
                  </div>
                  <p>{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="dispute-note">
            <span className="note-icon">⚠️</span>
            <div>
              <strong>Dispute Bond Required</strong>
              <p>
                To prevent frivolous disputes, challengers must stake a bond (typically 2% of market volume or $100 minimum).
                If the dispute fails, the bond is forfeited. If successful, the bond is returned plus a reward.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Resolution Timing */}
      <section className="content-section">
        <div className="section-inner">
          <h2>Resolution Timing</h2>

          <div className="timing-grid">
            <div className="timing-card">
              <span className="timing-icon">⚡</span>
              <h3>Instant Resolution</h3>
              <p>Price-based markets using Chainlink oracles</p>
              <span className="timing-value">&lt; 1 minute</span>
            </div>
            <div className="timing-card">
              <span className="timing-icon">🕐</span>
              <h3>Standard Resolution</h3>
              <p>Event-based markets with clear outcomes</p>
              <span className="timing-value">1-24 hours</span>
            </div>
            <div className="timing-card">
              <span className="timing-icon">📋</span>
              <h3>Complex Resolution</h3>
              <p>Markets requiring manual verification</p>
              <span className="timing-value">24-72 hours</span>
            </div>
            <div className="timing-card">
              <span className="timing-icon">⚖️</span>
              <h3>Disputed Resolution</h3>
              <p>Markets with active challenges</p>
              <span className="timing-value">3-7 days</span>
            </div>
          </div>
        </div>
      </section>

      {/* Edge Cases */}
      <section className="content-section alt">
        <div className="section-inner">
          <h2>Edge Cases & Special Situations</h2>

          <div className="edge-cases">
            <div className="edge-case">
              <h3>🚫 Market Voided</h3>
              <p>
                If a market's resolution criteria becomes impossible to determine (e.g., event cancelled,
                ambiguous outcome), the market may be voided. All shares are refunded at purchase price.
              </p>
            </div>
            <div className="edge-case">
              <h3>🔄 Early Resolution</h3>
              <p>
                Some markets may resolve before their end date if the outcome becomes certain
                (e.g., candidate drops out, mathematical elimination). Early resolution follows
                the same verification process.
              </p>
            </div>
            <div className="edge-case">
              <h3>📊 Partial Resolution</h3>
              <p>
                Multi-outcome markets may resolve partially as individual outcomes become certain.
                Remaining outcomes continue trading until fully resolved.
              </p>
            </div>
            <div className="edge-case">
              <h3>⏰ Resolution Delay</h3>
              <p>
                If authoritative sources conflict or data is delayed, resolution may be postponed
                until clarity is achieved. Participants are notified of delays.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="page-cta">
        <h2>Questions about resolution?</h2>
        <p>Check our FAQ or reach out to the community</p>
        <div className="cta-buttons">
          <Link href="/docs/faq#resolution" className="cta-btn primary">
            Resolution FAQ
          </Link>
          <a href="https://t.me/berightaii" className="cta-btn secondary" target="_blank" rel="noopener">
            Ask on Telegram
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="docs-footer">
        <div className="footer-brand">
          <span className="logo-be">Be</span>
          <span className="logo-right">Right</span>
        </div>
        <div className="footer-links">
          <Link href="/docs/fees">Fees</Link>
          <Link href="/docs/api">API</Link>
          <Link href="/docs/faq">FAQ</Link>
        </div>
      </footer>

      <style jsx>{`
        .resolution-page {
          min-height: 100vh;
          background: #080C14;
          color: #fff;
          font-family: 'Outfit', system-ui, sans-serif;
        }

        /* Header */
        .docs-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 40px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          position: sticky;
          top: 0;
          background: rgba(3, 3, 5, 0.95);
          backdrop-filter: blur(12px);
          z-index: 100;
        }

        .logo {
          display: flex;
          text-decoration: none;
          font-size: 22px;
          font-weight: 800;
        }

        .logo-be { color: #fff; }
        .logo-right {
          background: linear-gradient(135deg, #10B981, #00C2FF, #8B5CF6);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .nav-links {
          display: flex;
          gap: 32px;
        }

        .nav-link {
          color: rgba(255, 255, 255, 0.6);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s;
        }

        .nav-link:hover {
          color: #fff;
        }

        /* Hero */
        .page-hero {
          text-align: center;
          padding: 80px 24px 60px;
          background: linear-gradient(180deg, rgba(139, 92, 246, 0.03) 0%, transparent 100%);
        }

        .hero-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .page-hero h1 {
          font-size: 42px;
          font-weight: 800;
          margin: 0 0 12px;
          letter-spacing: -1px;
        }

        .page-hero p {
          font-size: 18px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
        }

        /* Content Sections */
        .content-section {
          padding: 80px 24px;
        }

        .content-section.alt {
          background: rgba(255, 255, 255, 0.01);
        }

        .section-inner {
          max-width: 1000px;
          margin: 0 auto;
        }

        .content-section h2 {
          font-size: 28px;
          font-weight: 800;
          margin: 0 0 12px;
          text-align: center;
        }

        .intro {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.6);
          text-align: center;
          max-width: 700px;
          margin: 0 auto 40px;
          line-height: 1.6;
        }

        /* Process Overview */
        .process-overview {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .process-card {
          flex: 1;
          min-width: 180px;
          max-width: 220px;
          padding: 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          text-align: center;
        }

        .process-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #10B981, #00C2FF);
          border-radius: 50%;
          font-size: 14px;
          font-weight: 800;
          color: #000;
          margin-bottom: 12px;
        }

        .process-card h3 {
          font-size: 15px;
          font-weight: 700;
          margin: 0 0 8px;
        }

        .process-card p {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0;
          line-height: 1.5;
        }

        .process-arrow {
          font-size: 20px;
          color: rgba(255, 255, 255, 0.2);
        }

        /* Oracle Grid */
        .oracle-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
        }

        .oracle-card {
          padding: 28px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
        }

        .oracle-card.primary {
          border-color: rgba(16, 185, 129, 0.2);
          background: rgba(16, 185, 129, 0.02);
        }

        .oracle-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .oracle-badge {
          padding: 4px 10px;
          background: rgba(16, 185, 129, 0.15);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #10B981;
        }

        .oracle-badge.secondary {
          background: rgba(139, 92, 246, 0.15);
          color: #A78BFA;
        }

        .oracle-card h3 {
          font-size: 16px;
          font-weight: 700;
          margin: 0;
        }

        .oracle-card p {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.6;
          margin: 0 0 16px;
        }

        .oracle-card ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .oracle-card li {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          padding: 6px 0;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
        }

        .oracle-card li::before {
          content: '✓';
          margin-right: 8px;
          color: #10B981;
        }

        /* Sources Grid */
        .sources-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
        }

        .source-card {
          padding: 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
        }

        .source-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .source-icon {
          font-size: 24px;
        }

        .source-card h3 {
          font-size: 16px;
          font-weight: 700;
          margin: 0;
        }

        .source-list {
          margin-bottom: 16px;
        }

        .source-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .source-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .source-tag {
          padding: 4px 10px;
          background: rgba(0, 194, 255, 0.1);
          border-radius: 6px;
          font-size: 12px;
          color: #00C2FF;
        }

        .source-examples ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .source-examples li {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          padding: 4px 0;
        }

        .source-examples li::before {
          content: '•';
          margin-right: 8px;
          color: rgba(255, 255, 255, 0.3);
        }

        /* Dispute Timeline */
        .dispute-timeline {
          max-width: 700px;
          margin: 0 auto 40px;
        }

        .dispute-step {
          display: flex;
          gap: 20px;
        }

        .step-marker {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .step-num {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: rgba(139, 92, 246, 0.15);
          border: 2px solid #8B5CF6;
          border-radius: 50%;
          font-size: 14px;
          font-weight: 700;
          color: #A78BFA;
        }

        .step-line {
          width: 2px;
          flex: 1;
          min-height: 40px;
          background: rgba(139, 92, 246, 0.2);
        }

        .step-content {
          flex: 1;
          padding-bottom: 32px;
        }

        .step-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .step-content h3 {
          font-size: 16px;
          font-weight: 700;
          margin: 0;
        }

        .step-duration {
          padding: 4px 10px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        .step-content p {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
          line-height: 1.5;
        }

        .dispute-note {
          display: flex;
          gap: 16px;
          padding: 20px 24px;
          background: rgba(255, 193, 7, 0.05);
          border: 1px solid rgba(255, 193, 7, 0.2);
          border-radius: 12px;
          max-width: 700px;
          margin: 0 auto;
        }

        .note-icon {
          font-size: 24px;
          flex-shrink: 0;
        }

        .dispute-note strong {
          display: block;
          font-size: 14px;
          margin-bottom: 6px;
        }

        .dispute-note p {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
          line-height: 1.5;
        }

        /* Timing Grid */
        .timing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 20px;
        }

        .timing-card {
          padding: 28px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          text-align: center;
        }

        .timing-icon {
          font-size: 32px;
          display: block;
          margin-bottom: 12px;
        }

        .timing-card h3 {
          font-size: 16px;
          font-weight: 700;
          margin: 0 0 8px;
        }

        .timing-card p {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0 0 16px;
        }

        .timing-value {
          display: inline-block;
          padding: 6px 14px;
          background: rgba(16, 185, 129, 0.1);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 700;
          color: #10B981;
          font-family: 'JetBrains Mono', monospace;
        }

        /* Edge Cases */
        .edge-cases {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
        }

        .edge-case {
          padding: 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
        }

        .edge-case h3 {
          font-size: 16px;
          font-weight: 700;
          margin: 0 0 12px;
        }

        .edge-case p {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
          line-height: 1.6;
        }

        /* CTA */
        .page-cta {
          text-align: center;
          padding: 80px 24px;
          background: linear-gradient(180deg, transparent 0%, rgba(16, 185, 129, 0.02) 100%);
        }

        .page-cta h2 {
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 8px;
        }

        .page-cta p {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 28px;
        }

        .cta-buttons {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .cta-btn {
          padding: 14px 28px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s;
        }

        .cta-btn.primary {
          background: linear-gradient(135deg, #10B981, #10B981);
          color: #000;
        }

        .cta-btn.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
        }

        .cta-btn.secondary {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #fff;
        }

        .cta-btn.secondary:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        /* Footer */
        .docs-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 30px 40px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .footer-brand {
          font-size: 18px;
          font-weight: 800;
        }

        .footer-links {
          display: flex;
          gap: 24px;
        }

        .footer-links a {
          color: rgba(255, 255, 255, 0.5);
          text-decoration: none;
          font-size: 14px;
          transition: color 0.2s;
        }

        .footer-links a:hover {
          color: #fff;
        }

        @media (max-width: 768px) {
          .docs-header {
            padding: 16px 20px;
          }

          .page-hero h1 {
            font-size: 28px;
          }

          .process-overview {
            flex-direction: column;
          }

          .process-arrow {
            transform: rotate(90deg);
          }

          .process-card {
            max-width: none;
          }

          .step-marker {
            display: none;
          }

          .step-content {
            padding-left: 0;
            border-left: 2px solid rgba(139, 92, 246, 0.2);
            padding-left: 20px;
          }

          .docs-footer {
            flex-direction: column;
            gap: 20px;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
}
