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

import BeRightTerminal from './v3/BeRightTerminal';

export default function BeRightTerminalPage() {
  return <BeRightTerminal />;
}
