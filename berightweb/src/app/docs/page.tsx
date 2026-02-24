'use client';

import Link from 'next/link';

const DOCS_SECTIONS = [
  {
    title: 'Getting Started',
    icon: '🚀',
    description: 'Learn how BeRight works and start making predictions',
    links: [
      { label: 'What is BeRight?', href: '/docs/faq#what-is-beright' },
      { label: 'How to Connect', href: '/docs/faq#connect-wallet' },
      { label: 'Making Your First Prediction', href: '/docs/faq#first-prediction' },
    ],
  },
  {
    title: 'API Reference',
    icon: '⚡',
    description: 'Integrate BeRight data into your applications',
    links: [
      { label: 'Markets API', href: '/docs/api#markets' },
      { label: 'Arbitrage API', href: '/docs/api#arbitrage' },
      { label: 'Forecasters API', href: '/docs/api#forecasters' },
    ],
  },
  {
    title: 'Resolution',
    icon: '⚖️',
    description: 'How markets are resolved and disputes handled',
    links: [
      { label: 'Oracle System', href: '/docs/resolution' },
      { label: 'Data Sources', href: '/docs/resolution#data-sources' },
      { label: 'Dispute Process', href: '/docs/resolution#dispute-process' },
    ],
  },
  {
    title: 'Fees & Pricing',
    icon: '💰',
    description: 'Transparent fee structure across all platforms',
    links: [
      { label: 'BeRight Fees', href: '/docs/fees' },
      { label: 'Platform Comparison', href: '/docs/fees#platform-comparison' },
      { label: 'Fee Examples', href: '/docs/fees#examples' },
    ],
  },
  {
    title: 'FAQ',
    icon: '❓',
    description: 'Common questions and answers',
    links: [
      { label: 'How does scoring work?', href: '/docs/faq#scoring' },
      { label: 'What is Brier Score?', href: '/docs/faq#brier-score' },
      { label: 'How do markets resolve?', href: '/docs/faq#resolution' },
    ],
  },
  {
    title: 'Telegram Bot',
    icon: '🤖',
    description: 'Use BeRight directly from Telegram',
    links: [
      { label: 'Bot Commands', href: '/docs/faq#telegram-commands' },
      { label: 'Setting Up Alerts', href: '/docs/faq#alerts' },
      { label: 'Linking Your Wallet', href: '/docs/faq#link-wallet' },
    ],
  },
];

export default function DocsPage() {
  return (
    <div className="docs-page">
      {/* Header */}
      <header className="docs-header">
        <Link href="/" className="logo">
          <span className="logo-be">Be</span>
          <span className="logo-right">Right</span>
        </Link>
        <nav className="nav-links">
          <Link href="/docs" className="nav-link active">Docs</Link>
          <Link href="/docs/api" className="nav-link">API</Link>
          <Link href="/docs/faq" className="nav-link">FAQ</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="docs-hero">
        <h1>Documentation</h1>
        <p>Everything you need to build with BeRight</p>
      </section>

      {/* Quick Links */}
      <section className="quick-links">
        <Link href="/docs/api" className="quick-card api">
          <span className="quick-icon">⚡</span>
          <div>
            <h3>API Reference</h3>
            <p>Full API documentation with examples</p>
          </div>
          <span className="quick-arrow">→</span>
        </Link>
        <Link href="/docs/faq" className="quick-card faq">
          <span className="quick-icon">❓</span>
          <div>
            <h3>FAQ</h3>
            <p>Answers to common questions</p>
          </div>
          <span className="quick-arrow">→</span>
        </Link>
      </section>

      {/* Sections Grid */}
      <section className="sections-grid">
        {DOCS_SECTIONS.map((section) => (
          <div key={section.title} className="section-card">
            <div className="section-header">
              <span className="section-icon">{section.icon}</span>
              <h2>{section.title}</h2>
            </div>
            <p className="section-desc">{section.description}</p>
            <ul className="section-links">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* API Highlight */}
      <section className="api-highlight">
        <h2>Quick Start: Fetch Hot Markets</h2>
        <div className="code-block">
          <div className="code-header">
            <span className="code-method get">GET</span>
            <span className="code-url">/api/markets?hot=true&limit=10</span>
          </div>
          <pre>{`curl https://beright.io/api/markets?hot=true&limit=10

{
  "markets": [
    {
      "id": "btc-100k-2026",
      "question": "Bitcoin above $100K by March 2026?",
      "yesPrice": 0.72,
      "noPrice": 0.28,
      "volume": "$4.2M",
      "platform": "polymarket"
    }
  ]
}`}</pre>
        </div>
        <Link href="/docs/api" className="view-api-btn">
          View Full API Reference →
        </Link>
      </section>

      {/* Footer */}
      <footer className="docs-footer">
        <div className="footer-brand">
          <span className="logo-be">Be</span>
          <span className="logo-right">Right</span>
        </div>
        <div className="footer-links">
          <a href="https://twitter.com/beright" target="_blank" rel="noopener">Twitter</a>
          <a href="https://discord.gg/beright" target="_blank" rel="noopener">Discord</a>
          <a href="https://t.me/berightbot" target="_blank" rel="noopener">Telegram</a>
        </div>
      </footer>

      <style jsx>{`
        .docs-page {
          min-height: 100vh;
          background: #030305;
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
        }

        .logo {
          display: flex;
          text-decoration: none;
          font-size: 22px;
          font-weight: 800;
        }

        .logo-be { color: #fff; }
        .logo-right {
          background: linear-gradient(135deg, #00E676, #00B0FF, #8B5CF6);
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

        .nav-link:hover, .nav-link.active {
          color: #fff;
        }

        /* Hero */
        .docs-hero {
          text-align: center;
          padding: 80px 24px 60px;
          background: linear-gradient(180deg, rgba(0, 230, 118, 0.03) 0%, transparent 100%);
        }

        .docs-hero h1 {
          font-size: 48px;
          font-weight: 800;
          margin: 0 0 12px;
          letter-spacing: -1px;
        }

        .docs-hero p {
          font-size: 18px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
        }

        /* Quick Links */
        .quick-links {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          max-width: 900px;
          margin: 0 auto;
          padding: 0 24px 60px;
        }

        .quick-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 24px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          text-decoration: none;
          transition: all 0.2s;
        }

        .quick-card:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.15);
          transform: translateY(-2px);
        }

        .quick-card.api {
          border-color: rgba(0, 230, 118, 0.2);
        }

        .quick-card.faq {
          border-color: rgba(139, 92, 246, 0.2);
        }

        .quick-icon {
          font-size: 32px;
        }

        .quick-card h3 {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 4px;
        }

        .quick-card p {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0;
        }

        .quick-arrow {
          margin-left: auto;
          font-size: 20px;
          color: rgba(255, 255, 255, 0.3);
          transition: transform 0.2s;
        }

        .quick-card:hover .quick-arrow {
          transform: translateX(4px);
          color: #00E676;
        }

        /* Sections Grid */
        .sections-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px 80px;
        }

        .section-card {
          padding: 28px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .section-icon {
          font-size: 24px;
        }

        .section-card h2 {
          font-size: 18px;
          font-weight: 700;
          margin: 0;
        }

        .section-desc {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0 0 20px;
          line-height: 1.5;
        }

        .section-links {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .section-links a {
          color: #00B0FF;
          text-decoration: none;
          font-size: 14px;
          transition: color 0.2s;
        }

        .section-links a:hover {
          color: #00E676;
        }

        /* API Highlight */
        .api-highlight {
          max-width: 800px;
          margin: 0 auto;
          padding: 0 24px 80px;
        }

        .api-highlight h2 {
          font-size: 22px;
          font-weight: 700;
          margin: 0 0 20px;
        }

        .code-block {
          background: #0A0A12;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          overflow: hidden;
        }

        .code-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .code-method {
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
        }

        .code-method.get {
          background: rgba(0, 230, 118, 0.15);
          color: #00E676;
        }

        .code-url {
          font-size: 13px;
          font-family: 'JetBrains Mono', monospace;
          color: rgba(255, 255, 255, 0.7);
        }

        .code-block pre {
          margin: 0;
          padding: 20px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.8);
          overflow-x: auto;
        }

        .view-api-btn {
          display: inline-block;
          margin-top: 20px;
          color: #00E676;
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
        }

        .view-api-btn:hover {
          text-decoration: underline;
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

          .nav-links {
            gap: 20px;
          }

          .docs-hero h1 {
            font-size: 32px;
          }

          .quick-links {
            grid-template-columns: 1fr;
          }

          .sections-grid {
            grid-template-columns: 1fr;
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
