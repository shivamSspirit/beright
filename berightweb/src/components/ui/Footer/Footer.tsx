/**
 * Footer - Unified footer component for BeRight
 *
 * Consistent footer with navigation links and branding.
 *
 * @example
 * <Footer />
 *
 * @example Minimal variant
 * <Footer variant="minimal" />
 */

'use client';

import Link from 'next/link';
import styles from './Footer.module.css';

export interface FooterLink {
  href: string;
  label: string;
  external?: boolean;
}

export interface FooterSection {
  title: string;
  links: FooterLink[];
}

export interface FooterProps {
  /** Footer style variant */
  variant?: 'default' | 'minimal';
  /** Override default sections */
  sections?: FooterSection[];
  /** Show social links */
  showSocials?: boolean;
}

const DEFAULT_SECTIONS: FooterSection[] = [
  {
    title: 'Product',
    links: [
      { href: '/markets', label: 'Markets' },
      { href: '/leaderboard', label: 'Leaderboard' },
      { href: '/beright-terminal', label: 'Terminal' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '/docs', label: 'Documentation' },
      { href: '/docs/api', label: 'API Reference' },
      { href: '/docs/faq', label: 'FAQ' },
      { href: '/docs/fees', label: 'Fees' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/docs/terms', label: 'Terms of Service' },
      { href: '/docs/privacy', label: 'Privacy Policy' },
    ],
  },
];

const SOCIAL_LINKS = [
  { href: 'https://twitter.com/beright', label: 'Twitter', icon: 'X' },
  { href: 'https://discord.gg/beright', label: 'Discord', icon: 'DC' },
];

export function Footer({
  variant = 'default',
  sections = DEFAULT_SECTIONS,
  showSocials = true,
}: FooterProps) {
  const currentYear = new Date().getFullYear();

  if (variant === 'minimal') {
    return (
      <footer className={styles.footerMinimal}>
        <div className={styles.minimalInner}>
          <div className={styles.brand}>
            <span className={styles.logoBe}>Be</span>
            <span className={styles.logoRight}>Right</span>
          </div>
          <nav className={styles.minimalLinks}>
            <Link href="/docs">Docs</Link>
            <Link href="/docs/api">API</Link>
            <Link href="/docs/faq">FAQ</Link>
          </nav>
          <span className={styles.copyright}>
            &copy; {currentYear} BeRight
          </span>
        </div>
      </footer>
    );
  }

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        {/* Brand Section */}
        <div className={styles.brandSection}>
          <Link href="/" className={styles.logo}>
            <span className={styles.logoBe}>Be</span>
            <span className={styles.logoRight}>Right</span>
          </Link>
          <p className={styles.tagline}>
            AI-powered prediction market intelligence
          </p>
          {showSocials && (
            <div className={styles.socials}>
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.href}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label={social.label}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Link Sections */}
        <div className={styles.sections}>
          {sections.map((section) => (
            <div key={section.title} className={styles.section}>
              <h4 className={styles.sectionTitle}>{section.title}</h4>
              <ul className={styles.sectionLinks}>
                {section.links.map((link) => (
                  <li key={link.href}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.link}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className={styles.link}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className={styles.bottom}>
        <div className={styles.bottomInner}>
          <span className={styles.copyright}>
            &copy; {currentYear} BeRight. All rights reserved.
          </span>
          <span className={styles.poweredBy}>
            Powered by Solana
          </span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
