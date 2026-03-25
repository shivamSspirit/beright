'use client';

import Link from 'next/link';
import {
  PageWrapper,
  Section,
  Card,
  CardHeader,
  CardBody,
  Table,
  Badge,
  Button,
  useStagger,
} from '@/components/ui';
import styles from './fees.module.css';

// Data
const PLATFORM_FEES = [
  { platform: 'Polymarket', icon: '🟣', tradingFee: '0%', withdrawalFee: '~$0.50', depositFee: '0%', notes: 'No trading fees. Gas fees for on-chain transactions.' },
  { platform: 'Kalshi', icon: '🟡', tradingFee: '~7%', withdrawalFee: '$0', depositFee: '$0', notes: 'Fee on winnings only. No fee on losses.' },
  { platform: 'Manifold', icon: '🟢', tradingFee: '0%', withdrawalFee: 'N/A', depositFee: 'N/A', notes: 'Play money. Free to use.' },
  { platform: 'DFlow', icon: '⚪', tradingFee: '~0.5%', withdrawalFee: '~$0.001', depositFee: '~$0.001', notes: 'Solana gas fees only (~$0.001).' },
];

const BERIGHT_FEES = [
  { feature: 'API Access', price: 'Free', limits: '100 req/min', description: 'Full access to markets, arbitrage, and forecaster data.' },
  { feature: 'Telegram Bot', price: 'Free', limits: 'Unlimited commands', description: 'All bot features including /arb, /hot, /research.' },
  { feature: 'Signal Alerts', price: 'Free', limits: 'All signals', description: 'Arbitrage, whale, and price alerts via Telegram.' },
  { feature: 'Calibration Tracking', price: 'Free', limits: 'Unlimited predictions', description: 'Track your Brier score and forecasting accuracy.' },
  { feature: 'Vault (On-chain)', price: '0.5%', limits: 'On withdrawals only', description: 'Protocol fee on vault withdrawals. No deposit fees.' },
];

const PLATFORM_DETAILS = [
  { name: 'Polymarket', icon: '🟣', badge: 'Best for Large Trades', badgeVariant: 'success' as const,
    rows: [
      { label: 'Trading Fee', value: '0%', highlight: true },
      { label: 'Deposit (USDC)', value: '~$0.50 gas' },
      { label: 'Withdraw (USDC)', value: '~$0.50 gas' },
      { label: 'Min Deposit', value: 'None' },
    ],
    note: 'Polymarket charges no trading fees — you keep all your winnings. Only pay Polygon gas fees (~$0.50) for deposits and withdrawals. Best for trades over $100.' },
  { name: 'Kalshi', icon: '🟡', badge: 'US Regulated', badgeVariant: 'ai' as const,
    rows: [
      { label: 'Trading Fee', value: '~7% on winnings' },
      { label: 'Fee on Losses', value: '$0', highlight: true },
      { label: 'Deposit (USD)', value: 'Free (ACH)' },
      { label: 'Withdraw (USD)', value: 'Free' },
    ],
    note: 'Kalshi takes ~7% of winnings only. If you lose, you pay no fee. CFTC-regulated, USD deposits via bank transfer.' },
  { name: 'DFlow', icon: '⚪', badge: 'Lowest Fees', badgeVariant: 'info' as const,
    rows: [
      { label: 'Trading Fee', value: '~0.5%' },
      { label: 'Gas (Solana)', value: '~$0.001', highlight: true },
      { label: 'Deposit', value: '~$0.001' },
      { label: 'Withdraw', value: '~$0.001' },
    ],
    note: 'DFlow runs on Solana with near-zero gas fees. Best for frequent trading and small positions.' },
  { name: 'Manifold', icon: '🟢', badge: 'Play Money', badgeVariant: 'warning' as const,
    rows: [
      { label: 'All Fees', value: 'Free', highlight: true },
      { label: 'Real Money', value: 'No' },
      { label: 'Payouts', value: 'Mana (play money)' },
    ],
    note: 'Manifold uses play money (Mana). Great for practicing and building your track record.' },
];

const FEE_EXAMPLES = [
  { scenario: 'Buy $100 YES on Polymarket', breakdown: [
      { item: 'Trading fee', value: '$0.00' },
      { item: 'Gas fee (deposit)', value: '~$0.50' },
      { item: 'Total cost', value: '$100.50', highlight: true },
    ]},
  { scenario: 'Win $100 on Kalshi', breakdown: [
      { item: 'Gross winnings', value: '$100.00' },
      { item: 'Kalshi fee (7%)', value: '-$7.00' },
      { item: 'Net payout', value: '$93.00', highlight: true },
    ]},
  { scenario: 'Arbitrage: Buy Kalshi + Sell Poly', breakdown: [
      { item: 'Buy YES Kalshi', value: '$48.00' },
      { item: 'Buy NO Poly', value: '$45.00' },
      { item: 'Gas fees (2x)', value: '~$1.00' },
      { item: 'Total investment', value: '$94.00' },
      { item: 'Guaranteed return', value: '$100.00' },
      { item: 'Net profit (pre-tax)', value: '$6.00', highlight: true },
    ]},
];

const TIPS = [
  { num: 1, title: 'Batch Transactions', text: 'Deposit larger amounts less frequently to reduce gas fees. One $500 deposit costs the same as ten $50 deposits.' },
  { num: 2, title: 'Choose the Right Platform', text: 'Use Polymarket for large trades (0% fee), DFlow for small frequent trades (~$0.001 gas).' },
  { num: 3, title: 'Factor Fees into Arb Calculations', text: 'A 5% arb spread becomes ~3.5% after fees. Our /arb command shows net profit after fees.' },
  { num: 4, title: 'Use Gas Price Trackers', text: 'For Polygon/ETH transactions, trade during low-gas periods (usually weekends, early morning UTC).' },
];

export default function FeesPage() {
  const featureGridRef = useStagger<HTMLDivElement>({ stagger: 0.08 });
  const platformGridRef = useStagger<HTMLDivElement>({ stagger: 0.1 });
  const tipsGridRef = useStagger<HTMLDivElement>({ stagger: 0.08 });

  return (
    <PageWrapper showHeader={false} showFooter={false}>
      {/* Hero */}
      <Section variant="gradient" size="lg" className={styles.hero}>
        <div className={styles.heroIcon}>💰</div>
        <h1 className={styles.heroTitle}>Fees & Pricing</h1>
        <p className={styles.heroSubtitle}>Transparent fee structure for BeRight and supported platforms</p>
      </Section>

      {/* BeRight Fees */}
      <Section>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>BeRight Platform Fees</h2>
          <p className={styles.sectionIntro}>
            BeRight is free to use. We believe in democratizing access to prediction market intelligence.
          </p>
        </div>

        <div className={styles.freeBanner}>
          <span className={styles.freeBadge}>FREE</span>
          <div className={styles.freeBannerText}>
            <h3>All Core Features</h3>
            <p>API access, Telegram bot, arbitrage alerts, calibration tracking — all free.</p>
          </div>
        </div>

        <div ref={featureGridRef} className={styles.featureGrid}>
          {BERIGHT_FEES.map((fee) => (
            <Card key={fee.feature} variant="default" padding="md">
              <div className={styles.featureCard}>
                <div className={styles.featureHeader}>
                  <h3 className={styles.featureName}>{fee.feature}</h3>
                  <Badge variant={fee.price === 'Free' ? 'success' : 'default'}>{fee.price}</Badge>
                </div>
                <p className={styles.featureDesc}>{fee.description}</p>
                <span className={styles.featureLimits}>{fee.limits}</span>
              </div>
            </Card>
          ))}
        </div>

        <div className={styles.infoNote}>
          <span className={styles.noteIcon}>💡</span>
          <div className={styles.noteContent}>
            <strong>How we sustain the platform</strong>
            <p>BeRight is funded by vault protocol fees (0.5% on withdrawals) and future premium features. Core intelligence features will always remain free.</p>
          </div>
        </div>
      </Section>

      {/* Platform Fee Comparison Table */}
      <Section variant="alt">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Platform Fee Comparison</h2>
          <p className={styles.sectionIntro}>Understanding fees across different prediction market platforms.</p>
        </div>

        <Table
          columns={[
            { key: 'platform', header: 'Platform', render: (row) => (
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}>
                <span style={{ fontSize: 18 }}>{row.icon}</span> {row.platform}
              </span>
            )},
            { key: 'tradingFee', header: 'Trading Fee' },
            { key: 'withdrawalFee', header: 'Withdrawal' },
            { key: 'depositFee', header: 'Deposit' },
            { key: 'notes', header: 'Notes', hideOnMobile: true },
          ]}
          data={PLATFORM_FEES}
          keyField="platform"
        />
      </Section>

      {/* Detailed Platform Breakdown */}
      <Section>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Detailed Platform Breakdown</h2>
        </div>

        <div ref={platformGridRef} className={styles.platformGrid}>
          {PLATFORM_DETAILS.map((platform) => (
            <Card key={platform.name} variant="default" padding="none">
              <CardHeader>
                <div className={styles.platformCardHeader}>
                  <span className={styles.platformIcon}>{platform.icon}</span>
                  <h3 className={styles.platformName}>{platform.name}</h3>
                  <Badge variant={platform.badgeVariant} size="sm">{platform.badge}</Badge>
                </div>
              </CardHeader>
              <CardBody>
                {platform.rows.map((row, i) => (
                  <div key={i} className={styles.platformRow}>
                    <span className={styles.platformLabel}>{row.label}</span>
                    <span className={`${styles.platformValue} ${row.highlight ? styles.highlight : ''}`}>
                      {row.value}
                    </span>
                  </div>
                ))}
                <p className={styles.platformNote}>{platform.note}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </Section>

      {/* Fee Examples */}
      <Section variant="alt">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Real-World Fee Examples</h2>
          <p className={styles.sectionIntro}>See exactly what you&apos;ll pay in common trading scenarios.</p>
        </div>

        <div className={styles.exampleGrid}>
          {FEE_EXAMPLES.map((ex) => (
            <Card key={ex.scenario} variant="default" padding="md">
              <h3 className={styles.exampleTitle}>{ex.scenario}</h3>
              {ex.breakdown.map((item, i) => (
                <div key={i} className={`${styles.breakdownRow} ${item.highlight ? styles.highlight : ''}`}>
                  <span className={styles.breakdownLabel}>{item.item}</span>
                  <span className={styles.breakdownValue}>{item.value}</span>
                </div>
              ))}
            </Card>
          ))}
        </div>
      </Section>

      {/* Tips */}
      <Section>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Tips to Minimize Fees</h2>
        </div>

        <div ref={tipsGridRef} className={styles.tipsGrid}>
          {TIPS.map((tip) => (
            <Card key={tip.num} variant="outline" padding="md">
              <span className={styles.tipNumber}>{tip.num}</span>
              <h3 className={styles.tipTitle}>{tip.title}</h3>
              <p className={styles.tipText}>{tip.text}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Tax Notice */}
      <Section variant="alt">
        <div className={styles.taxNotice}>
          <span className={styles.taxIcon}>📋</span>
          <div>
            <h3 className={styles.taxTitle}>Tax Considerations</h3>
            <p className={styles.taxText}>
              Prediction market winnings may be taxable income in your jurisdiction.
              BeRight does not provide tax advice. Consult a tax professional for guidance.
              Keep records of all trades for tax reporting purposes.
            </p>
            <p className={styles.taxHighlight}>
              <strong>US Users:</strong> Kalshi provides 1099 forms for tax reporting.
              Crypto platform trades (Polymarket, DFlow) require self-reporting.
            </p>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <Section variant="gradient" className={styles.cta}>
        <h2 className={styles.ctaTitle}>Ready to start trading?</h2>
        <p className={styles.ctaSubtitle}>Use BeRight&apos;s free tools to find the best opportunities</p>
        <div className={styles.ctaButtons}>
          <Link href="/markets">
            <Button variant="primary" size="lg">Browse Markets</Button>
          </Link>
          <Link href="/docs/api">
            <Button variant="secondary" size="lg">API Documentation</Button>
          </Link>
        </div>
      </Section>
    </PageWrapper>
  );
}
