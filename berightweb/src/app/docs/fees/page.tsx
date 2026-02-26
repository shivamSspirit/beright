'use client';

import Link from 'next/link';

const PLATFORM_FEES = [
  {
    platform: 'Polymarket',
    icon: '🟣',
    tradingFee: '0%',
    withdrawalFee: '~$0.50',
    depositFee: '0%',
    notes: 'No trading fees. Gas fees for on-chain transactions.',
  },
  {
    platform: 'Kalshi',
    icon: '🟡',
    tradingFee: '~7%',
    withdrawalFee: '$0',
    depositFee: '$0',
    notes: 'Fee on winnings only. No fee on losses.',
  },
  {
    platform: 'Manifold',
    icon: '🟢',
    tradingFee: '0%',
    withdrawalFee: 'N/A',
    depositFee: 'N/A',
    notes: 'Play money. Free to use.',
  },
  {
    platform: 'DFlow',
    icon: '⚪',
    tradingFee: '~0.5%',
    withdrawalFee: '~$0.001',
    depositFee: '~$0.001',
    notes: 'Solana gas fees only (~$0.001).',
  },
];

const BERIGHT_FEES = [
  {
    feature: 'API Access',
    price: 'Free',
    limits: '100 req/min',
    description: 'Full access to markets, arbitrage, and forecaster data.',
  },
  {
    feature: 'Telegram Bot',
    price: 'Free',
    limits: 'Unlimited commands',
    description: 'All bot features including /arb, /hot, /research.',
  },
  {
    feature: 'Signal Alerts',
    price: 'Free',
    limits: 'All signals',
    description: 'Arbitrage, whale, and price alerts via Telegram.',
  },
  {
    feature: 'Calibration Tracking',
    price: 'Free',
    limits: 'Unlimited predictions',
    description: 'Track your Brier score and forecasting accuracy.',
  },
  {
    feature: 'Vault (On-chain)',
    price: '0.5%',
    limits: 'On withdrawals only',
    description: 'Protocol fee on vault withdrawals. No deposit fees.',
  },
];

const FEE_EXAMPLES = [
  {
    scenario: 'Buy $100 YES on Polymarket',
    breakdown: [
      { item: 'Trading fee', value: '$0.00' },
      { item: 'Gas fee (deposit)', value: '~$0.50' },
      { item: 'Total cost', value: '$100.50', highlight: true },
    ],
  },
  {
    scenario: 'Win $100 on Kalshi',
    breakdown: [
      { item: 'Gross winnings', value: '$100.00' },
      { item: 'Kalshi fee (7%)', value: '-$7.00' },
      { item: 'Net payout', value: '$93.00', highlight: true },
    ],
  },
  {
    scenario: 'Arbitrage: Buy Kalshi + Sell Poly',
    breakdown: [
      { item: 'Buy YES Kalshi', value: '$48.00' },
      { item: 'Buy NO Poly', value: '$45.00' },
      { item: 'Gas fees (2x)', value: '~$1.00' },
      { item: 'Total investment', value: '$94.00' },
      { item: 'Guaranteed return', value: '$100.00' },
      { item: 'Net profit (pre-tax)', value: '$6.00', highlight: true },
    ],
  },
];

export default function FeesPage() {
  return (
    <div className="fees-page">
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
        <div className="hero-icon">💰</div>
        <h1>Fees & Pricing</h1>
        <p>Transparent fee structure for BeRight and supported platforms</p>
      </section>

      {/* BeRight Fees */}
      <section className="content-section">
        <div className="section-inner">
          <h2>BeRight Platform Fees</h2>
          <p className="intro">
            BeRight is free to use. We believe in democratizing access to prediction market intelligence.
          </p>

          <div className="beright-free-banner">
            <span className="free-badge">FREE</span>
            <div>
              <h3>All Core Features</h3>
              <p>API access, Telegram bot, arbitrage alerts, calibration tracking — all free.</p>
            </div>
          </div>

          <div className="beright-fees-grid">
            {BERIGHT_FEES.map((fee) => (
              <div key={fee.feature} className="beright-fee-card">
                <div className="fee-header">
                  <h3>{fee.feature}</h3>
                  <span className={`fee-price ${fee.price === 'Free' ? 'free' : ''}`}>
                    {fee.price}
                  </span>
                </div>
                <p className="fee-desc">{fee.description}</p>
                <span className="fee-limits">{fee.limits}</span>
              </div>
            ))}
          </div>

          <div className="revenue-note">
            <span className="note-icon">💡</span>
            <div>
              <strong>How we sustain the platform</strong>
              <p>
                BeRight is funded by vault protocol fees (0.5% on withdrawals) and future premium features.
                Core intelligence features will always remain free.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Fees Comparison */}
      <section className="content-section alt">
        <div className="section-inner">
          <h2>Platform Fee Comparison</h2>
          <p className="intro">
            Understanding fees across different prediction market platforms.
          </p>

          <div className="platform-table">
            <div className="table-header">
              <span className="col-platform">Platform</span>
              <span className="col-trading">Trading Fee</span>
              <span className="col-withdrawal">Withdrawal</span>
              <span className="col-deposit">Deposit</span>
              <span className="col-notes">Notes</span>
            </div>
            {PLATFORM_FEES.map((p) => (
              <div key={p.platform} className="table-row">
                <span className="col-platform">
                  <span className="platform-icon">{p.icon}</span>
                  {p.platform}
                </span>
                <span className="col-trading">{p.tradingFee}</span>
                <span className="col-withdrawal">{p.withdrawalFee}</span>
                <span className="col-deposit">{p.depositFee}</span>
                <span className="col-notes">{p.notes}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fee Details by Platform */}
      <section className="content-section">
        <div className="section-inner">
          <h2>Detailed Platform Breakdown</h2>

          <div className="platform-details">
            {/* Polymarket */}
            <div className="platform-detail-card">
              <div className="pd-header">
                <span className="pd-icon">🟣</span>
                <h3>Polymarket</h3>
                <span className="pd-badge best">Best for Large Trades</span>
              </div>
              <div className="pd-content">
                <div className="pd-row">
                  <span className="pd-label">Trading Fee</span>
                  <span className="pd-value highlight">0%</span>
                </div>
                <div className="pd-row">
                  <span className="pd-label">Deposit (USDC)</span>
                  <span className="pd-value">~$0.50 gas</span>
                </div>
                <div className="pd-row">
                  <span className="pd-label">Withdraw (USDC)</span>
                  <span className="pd-value">~$0.50 gas</span>
                </div>
                <div className="pd-row">
                  <span className="pd-label">Min Deposit</span>
                  <span className="pd-value">None</span>
                </div>
                <p className="pd-note">
                  Polymarket charges no trading fees — you keep all your winnings.
                  Only pay Polygon gas fees (~$0.50) for deposits and withdrawals.
                  Best for trades over $100 where gas fees are negligible.
                </p>
              </div>
            </div>

            {/* Kalshi */}
            <div className="platform-detail-card">
              <div className="pd-header">
                <span className="pd-icon">🟡</span>
                <h3>Kalshi</h3>
                <span className="pd-badge">US Regulated</span>
              </div>
              <div className="pd-content">
                <div className="pd-row">
                  <span className="pd-label">Trading Fee</span>
                  <span className="pd-value">~7% on winnings</span>
                </div>
                <div className="pd-row">
                  <span className="pd-label">Fee on Losses</span>
                  <span className="pd-value highlight">$0</span>
                </div>
                <div className="pd-row">
                  <span className="pd-label">Deposit (USD)</span>
                  <span className="pd-value">Free (ACH)</span>
                </div>
                <div className="pd-row">
                  <span className="pd-label">Withdraw (USD)</span>
                  <span className="pd-value">Free</span>
                </div>
                <p className="pd-note">
                  Kalshi takes ~7% of winnings only. If you lose, you pay no fee.
                  This means effective fees are lower for riskier bets.
                  CFTC-regulated, USD deposits via bank transfer.
                </p>
              </div>
            </div>

            {/* DFlow */}
            <div className="platform-detail-card">
              <div className="pd-header">
                <span className="pd-icon">⚪</span>
                <h3>DFlow</h3>
                <span className="pd-badge">Lowest Fees</span>
              </div>
              <div className="pd-content">
                <div className="pd-row">
                  <span className="pd-label">Trading Fee</span>
                  <span className="pd-value">~0.5%</span>
                </div>
                <div className="pd-row">
                  <span className="pd-label">Gas (Solana)</span>
                  <span className="pd-value highlight">~$0.001</span>
                </div>
                <div className="pd-row">
                  <span className="pd-label">Deposit</span>
                  <span className="pd-value">~$0.001</span>
                </div>
                <div className="pd-row">
                  <span className="pd-label">Withdraw</span>
                  <span className="pd-value">~$0.001</span>
                </div>
                <p className="pd-note">
                  DFlow runs on Solana with near-zero gas fees.
                  Best for frequent trading and small positions.
                  On-chain order books with full transparency.
                </p>
              </div>
            </div>

            {/* Manifold */}
            <div className="platform-detail-card">
              <div className="pd-header">
                <span className="pd-icon">🟢</span>
                <h3>Manifold</h3>
                <span className="pd-badge">Play Money</span>
              </div>
              <div className="pd-content">
                <div className="pd-row">
                  <span className="pd-label">All Fees</span>
                  <span className="pd-value highlight">Free</span>
                </div>
                <div className="pd-row">
                  <span className="pd-label">Real Money</span>
                  <span className="pd-value">No</span>
                </div>
                <div className="pd-row">
                  <span className="pd-label">Payouts</span>
                  <span className="pd-value">Mana (play money)</span>
                </div>
                <p className="pd-note">
                  Manifold uses play money (Mana) — no real money deposits or withdrawals.
                  Great for practicing and building your track record.
                  Calibration still counts on BeRight!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fee Examples */}
      <section className="content-section alt">
        <div className="section-inner">
          <h2>Real-World Fee Examples</h2>
          <p className="intro">
            See exactly what you'll pay in common trading scenarios.
          </p>

          <div className="examples-grid">
            {FEE_EXAMPLES.map((ex) => (
              <div key={ex.scenario} className="example-card">
                <h3>{ex.scenario}</h3>
                <div className="example-breakdown">
                  {ex.breakdown.map((item, i) => (
                    <div key={i} className={`breakdown-row ${item.highlight ? 'highlight' : ''}`}>
                      <span className="breakdown-label">{item.item}</span>
                      <span className="breakdown-value">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fee Tips */}
      <section className="content-section">
        <div className="section-inner">
          <h2>Tips to Minimize Fees</h2>

          <div className="tips-grid">
            <div className="tip-card">
              <span className="tip-num">1</span>
              <h3>Batch Transactions</h3>
              <p>
                Deposit larger amounts less frequently to reduce gas fees.
                One $500 deposit costs the same as ten $50 deposits.
              </p>
            </div>
            <div className="tip-card">
              <span className="tip-num">2</span>
              <h3>Choose the Right Platform</h3>
              <p>
                Use Polymarket for large trades (0% fee), DFlow for small frequent trades (~$0.001 gas).
              </p>
            </div>
            <div className="tip-card">
              <span className="tip-num">3</span>
              <h3>Factor Fees into Arb Calculations</h3>
              <p>
                A 5% arb spread becomes ~3.5% after fees. Our /arb command shows net profit after fees.
              </p>
            </div>
            <div className="tip-card">
              <span className="tip-num">4</span>
              <h3>Use Gas Price Trackers</h3>
              <p>
                For Polygon/ETH transactions, trade during low-gas periods (usually weekends, early morning UTC).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tax Note */}
      <section className="content-section alt">
        <div className="section-inner">
          <div className="tax-notice">
            <span className="tax-icon">📋</span>
            <div>
              <h3>Tax Considerations</h3>
              <p>
                Prediction market winnings may be taxable income in your jurisdiction.
                BeRight does not provide tax advice. Consult a tax professional for guidance.
                Keep records of all trades for tax reporting purposes.
              </p>
              <p className="tax-note">
                <strong>US Users:</strong> Kalshi provides 1099 forms for tax reporting.
                Crypto platform trades (Polymarket, DFlow) require self-reporting.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="page-cta">
        <h2>Ready to start trading?</h2>
        <p>Use BeRight's free tools to find the best opportunities</p>
        <div className="cta-buttons">
          <Link href="/markets" className="cta-btn primary">
            Browse Markets
          </Link>
          <Link href="/docs/api" className="cta-btn secondary">
            API Documentation
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="docs-footer">
        <div className="footer-brand">
          <span className="logo-be">Be</span>
          <span className="logo-right">Right</span>
        </div>
        <div className="footer-links">
          <Link href="/docs/resolution">Resolution</Link>
          <Link href="/docs/api">API</Link>
          <Link href="/docs/faq">FAQ</Link>
        </div>
      </footer>

      <style jsx>{`
        .fees-page {
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
          background: linear-gradient(180deg, rgba(16, 185, 129, 0.03) 0%, transparent 100%);
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

        /* BeRight Free Banner */
        .beright-free-banner {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 24px 32px;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(0, 194, 255, 0.1));
          border: 1px solid rgba(16, 185, 129, 0.2);
          border-radius: 16px;
          margin-bottom: 32px;
        }

        .free-badge {
          padding: 12px 24px;
          background: linear-gradient(135deg, #10B981, #10B981);
          border-radius: 12px;
          font-size: 18px;
          font-weight: 800;
          color: #000;
        }

        .beright-free-banner h3 {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 4px;
        }

        .beright-free-banner p {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
        }

        /* BeRight Fees Grid */
        .beright-fees-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }

        .beright-fee-card {
          padding: 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
        }

        .fee-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .fee-header h3 {
          font-size: 16px;
          font-weight: 700;
          margin: 0;
        }

        .fee-price {
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
        }

        .fee-price.free {
          background: rgba(16, 185, 129, 0.15);
          color: #10B981;
        }

        .fee-desc {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 12px;
          line-height: 1.5;
        }

        .fee-limits {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        }

        .revenue-note {
          display: flex;
          gap: 16px;
          padding: 20px 24px;
          background: rgba(0, 194, 255, 0.05);
          border: 1px solid rgba(0, 194, 255, 0.15);
          border-radius: 12px;
        }

        .note-icon {
          font-size: 24px;
          flex-shrink: 0;
        }

        .revenue-note strong {
          display: block;
          font-size: 14px;
          margin-bottom: 6px;
        }

        .revenue-note p {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
          line-height: 1.5;
        }

        /* Platform Table */
        .platform-table {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          overflow: hidden;
        }

        .table-header {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr 1fr 2fr;
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.03);
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .table-row {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr 1fr 2fr;
          padding: 16px 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          font-size: 14px;
          align-items: center;
        }

        .col-platform {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
        }

        .platform-icon {
          font-size: 18px;
        }

        .col-notes {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Platform Details */
        .platform-details {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
        }

        .platform-detail-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          overflow: hidden;
        }

        .pd-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .pd-icon {
          font-size: 24px;
        }

        .pd-header h3 {
          font-size: 18px;
          font-weight: 700;
          margin: 0;
          flex: 1;
        }

        .pd-badge {
          padding: 4px 10px;
          background: rgba(139, 92, 246, 0.15);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          color: #A78BFA;
        }

        .pd-badge.best {
          background: rgba(16, 185, 129, 0.15);
          color: #10B981;
        }

        .pd-content {
          padding: 20px;
        }

        .pd-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .pd-label {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
        }

        .pd-value {
          font-size: 14px;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
        }

        .pd-value.highlight {
          color: #10B981;
        }

        .pd-note {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          margin: 16px 0 0;
          line-height: 1.6;
        }

        /* Examples Grid */
        .examples-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }

        .example-card {
          padding: 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
        }

        .example-card h3 {
          font-size: 16px;
          font-weight: 700;
          margin: 0 0 20px;
        }

        .example-breakdown {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .breakdown-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .breakdown-row.highlight {
          border-bottom: none;
          padding-top: 12px;
          margin-top: 4px;
          border-top: 2px solid rgba(16, 185, 129, 0.3);
        }

        .breakdown-label {
          color: rgba(255, 255, 255, 0.6);
        }

        .breakdown-value {
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
        }

        .breakdown-row.highlight .breakdown-value {
          color: #10B981;
          font-size: 16px;
        }

        /* Tips Grid */
        .tips-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
        }

        .tip-card {
          padding: 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
        }

        .tip-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: rgba(0, 194, 255, 0.15);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 700;
          color: #00C2FF;
          margin-bottom: 12px;
        }

        .tip-card h3 {
          font-size: 16px;
          font-weight: 700;
          margin: 0 0 10px;
        }

        .tip-card p {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
          line-height: 1.5;
        }

        /* Tax Notice */
        .tax-notice {
          display: flex;
          gap: 20px;
          padding: 28px 32px;
          background: rgba(255, 193, 7, 0.05);
          border: 1px solid rgba(255, 193, 7, 0.15);
          border-radius: 16px;
        }

        .tax-icon {
          font-size: 32px;
          flex-shrink: 0;
        }

        .tax-notice h3 {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 12px;
        }

        .tax-notice p {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 12px;
          line-height: 1.6;
        }

        .tax-notice .tax-note {
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          margin: 0;
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

          .beright-free-banner {
            flex-direction: column;
            text-align: center;
          }

          .platform-table {
            overflow-x: auto;
          }

          .table-header,
          .table-row {
            min-width: 700px;
          }

          .tax-notice {
            flex-direction: column;
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
