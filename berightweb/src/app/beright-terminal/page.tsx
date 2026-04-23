'use client';

/**
 * BeRight Terminal v3 - Clean Professional Design
 *
 * Redesigned trading terminal with:
 * - Three-column layout (Agent Fleet | Markets | Portfolio)
 * - Inter + JetBrains Mono fonts
 * - Clean black background with green accents
 * - Pill-style navigation
 * - CLI input at bottom
 *
 * To restore the legacy Matrix-style terminal:
 * 1. Import from './components' instead of './v3/BeRightTerminal'
 * 2. See terminal.module.css for legacy styles
 * 3. Legacy components: MatrixRain, BootSequence, MarketTicker, etc.
 */

import { PageWrapper } from '@/components/ui';
import BeRightTerminal from './v3/BeRightTerminal';
import { useEffect } from 'react';

export default function BeRightTerminalPage() {
  // Terminal should behave like an "app shell" with internal scrolling only.
  // Lock the document scroll so the fixed global chrome (Header/BottomNav) never
  // causes the terminal header/input to slide behind it on mobile.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const html = document.documentElement;
    const body = document.body;

    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  return (
    <PageWrapper showHeader={false} showFooter={false}>
      <BeRightTerminal />
    </PageWrapper>
  );
}
