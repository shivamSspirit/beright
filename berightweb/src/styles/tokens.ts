/**
 * BeRight Design Tokens (TypeScript)
 * Single source of truth for all design values
 *
 * Usage:
 * import { colors, spacing, typography } from '@/styles/tokens';
 */

// ═══════════════════════════════════════════════════════════════════════════
// COLORS
// ═══════════════════════════════════════════════════════════════════════════

export const colors = {
  // Primary Accent - Teal Green (main brand color)
  primary: '#00FFB2',
  primaryDim: 'rgba(0, 255, 178, 0.15)',
  primaryGlow: 'rgba(0, 255, 178, 0.4)',
  primaryHover: '#00E6A0',

  // Secondary Accent - Purple (AI, special features)
  secondary: '#7B61FF',
  secondaryDim: 'rgba(123, 97, 255, 0.15)',
  secondaryGlow: 'rgba(123, 97, 255, 0.4)',

  // Warning/Streak - Orange (fire, streaks, warnings)
  warning: '#FF6B35',
  warningDim: 'rgba(255, 107, 53, 0.15)',
  warningGlow: 'rgba(255, 107, 53, 0.4)',

  // Semantic Colors
  success: '#00FFB2',  // Same as primary
  error: '#FF4757',
  errorDim: 'rgba(255, 71, 87, 0.15)',
  errorGlow: 'rgba(255, 71, 87, 0.4)',

  // Binary States (Yes/No)
  yes: '#00FFB2',
  yesDim: 'rgba(0, 255, 178, 0.15)',
  yesGlow: 'rgba(0, 255, 178, 0.4)',
  no: '#FF4757',
  noDim: 'rgba(255, 71, 87, 0.15)',
  noGlow: 'rgba(255, 71, 87, 0.4)',

  // Backgrounds - Dark Scale
  bgBase: '#0A0A0F',
  bgSurface1: '#111118',
  bgSurface2: '#1A1A24',
  bgSurface3: '#242432',
  bgElevated: '#2A2A3A',

  // Text Hierarchy
  textPrimary: '#FFFFFF',
  textSecondary: '#8B8FA8',
  textMuted: '#5A5E78',
  textGhost: '#3D4058',

  // Borders
  border: 'rgba(255, 255, 255, 0.08)',
  borderHover: 'rgba(255, 255, 255, 0.15)',
  borderFocus: 'rgba(0, 255, 178, 0.5)',

  // Glass/Overlay
  glassBg: 'rgba(17, 17, 24, 0.85)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  overlay: 'rgba(10, 10, 15, 0.8)',

  // League Colors
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
  diamond: '#B9F2FF',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// TYPOGRAPHY
// ═══════════════════════════════════════════════════════════════════════════

export const typography = {
  // Font Families
  fontSans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontMono: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Consolas', monospace",

  // Font Sizes (px)
  text2xs: '9px',
  textXs: '10px',
  textSm: '12px',
  textBase: '14px',
  textLg: '16px',
  textXl: '20px',
  text2xl: '24px',
  text3xl: '32px',
  text4xl: '42px',
  textHero: '56px',

  // Font Weights
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,

  // Line Heights
  leadingNone: 1,
  leadingTight: 1.2,
  leadingSnug: 1.35,
  leadingNormal: 1.5,
  leadingRelaxed: 1.65,

  // Letter Spacing
  trackingTighter: '-0.03em',
  trackingTight: '-0.015em',
  trackingNormal: '0',
  trackingWide: '0.025em',
  trackingWider: '0.05em',
  trackingWidest: '0.1em',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// SPACING (4px base)
// ═══════════════════════════════════════════════════════════════════════════

export const spacing = {
  px: '1px',
  0: '0',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// BORDER RADIUS
// ═══════════════════════════════════════════════════════════════════════════

export const radius = {
  none: '0',
  sm: '4px',
  md: '8px',       // Pills
  lg: '12px',      // Cards
  xl: '16px',
  '2xl': '24px',   // Buttons
  '3xl': '32px',
  full: '9999px',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// SHADOWS
// ═══════════════════════════════════════════════════════════════════════════

export const shadows = {
  xs: '0 1px 2px rgba(0, 0, 0, 0.3)',
  sm: '0 2px 4px rgba(0, 0, 0, 0.3)',
  md: '0 4px 12px rgba(0, 0, 0, 0.4)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.5)',
  xl: '0 16px 48px rgba(0, 0, 0, 0.6)',

  // Glow effects
  glowPrimary: '0 0 20px rgba(0, 255, 178, 0.3)',
  glowPrimaryLg: '0 0 40px rgba(0, 255, 178, 0.4)',
  glowSecondary: '0 0 20px rgba(123, 97, 255, 0.3)',
  glowWarning: '0 0 20px rgba(255, 107, 53, 0.3)',
  glowError: '0 0 20px rgba(255, 71, 87, 0.3)',

  // Inset
  insetSm: 'inset 0 1px 2px rgba(0, 0, 0, 0.4)',
  insetMd: 'inset 0 2px 8px rgba(0, 0, 0, 0.5)',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// TRANSITIONS
// ═══════════════════════════════════════════════════════════════════════════

export const transitions = {
  fast: '0.1s ease',
  base: '0.15s ease',
  normal: '0.2s ease',
  slow: '0.3s ease',
  slower: '0.5s ease',

  // Easing
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// Z-INDEX
// ═══════════════════════════════════════════════════════════════════════════

export const zIndex = {
  below: -1,
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  toast: 80,
  max: 9999,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// BREAKPOINTS
// ═══════════════════════════════════════════════════════════════════════════

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT TOKENS
// ═══════════════════════════════════════════════════════════════════════════

export const components = {
  // Bottom Navigation
  bottomNav: {
    height: '72px',
    bgColor: colors.bgSurface1,
    borderColor: colors.border,
  },

  // Page Header
  pageHeader: {
    height: '56px',
    bgColor: colors.glassBg,
  },

  // Cards
  card: {
    bg: colors.bgSurface1,
    border: colors.border,
    radius: radius.lg,
    padding: spacing[6],
  },

  // Buttons
  button: {
    radiusSm: radius.md,
    radiusMd: radius.lg,
    radiusLg: radius['2xl'],
  },

  // Input
  input: {
    bg: colors.bgSurface2,
    border: colors.border,
    radius: radius.md,
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// CSS VARIABLE GENERATOR (for use in global CSS)
// ═══════════════════════════════════════════════════════════════════════════

export function generateCSSVariables(): string {
  return `
:root {
  /* Colors - Primary */
  --color-primary: ${colors.primary};
  --color-primary-dim: ${colors.primaryDim};
  --color-primary-glow: ${colors.primaryGlow};
  --color-primary-hover: ${colors.primaryHover};

  /* Colors - Secondary */
  --color-secondary: ${colors.secondary};
  --color-secondary-dim: ${colors.secondaryDim};
  --color-secondary-glow: ${colors.secondaryGlow};

  /* Colors - Warning */
  --color-warning: ${colors.warning};
  --color-warning-dim: ${colors.warningDim};
  --color-warning-glow: ${colors.warningGlow};

  /* Colors - Error */
  --color-error: ${colors.error};
  --color-error-dim: ${colors.errorDim};
  --color-error-glow: ${colors.errorGlow};

  /* Colors - Yes/No */
  --color-yes: ${colors.yes};
  --color-yes-dim: ${colors.yesDim};
  --color-yes-glow: ${colors.yesGlow};
  --color-no: ${colors.no};
  --color-no-dim: ${colors.noDim};
  --color-no-glow: ${colors.noGlow};

  /* Colors - Backgrounds */
  --color-bg-base: ${colors.bgBase};
  --color-bg-surface-1: ${colors.bgSurface1};
  --color-bg-surface-2: ${colors.bgSurface2};
  --color-bg-surface-3: ${colors.bgSurface3};
  --color-bg-elevated: ${colors.bgElevated};

  /* Colors - Text */
  --color-text-primary: ${colors.textPrimary};
  --color-text-secondary: ${colors.textSecondary};
  --color-text-muted: ${colors.textMuted};
  --color-text-ghost: ${colors.textGhost};

  /* Colors - Borders */
  --color-border: ${colors.border};
  --color-border-hover: ${colors.borderHover};
  --color-border-focus: ${colors.borderFocus};

  /* Colors - Glass */
  --color-glass-bg: ${colors.glassBg};
  --color-glass-border: ${colors.glassBorder};
  --color-overlay: ${colors.overlay};

  /* Typography */
  --font-sans: ${typography.fontSans};
  --font-mono: ${typography.fontMono};

  /* Spacing */
  --space-1: ${spacing[1]};
  --space-2: ${spacing[2]};
  --space-3: ${spacing[3]};
  --space-4: ${spacing[4]};
  --space-5: ${spacing[5]};
  --space-6: ${spacing[6]};
  --space-8: ${spacing[8]};
  --space-10: ${spacing[10]};
  --space-12: ${spacing[12]};

  /* Border Radius */
  --radius-sm: ${radius.sm};
  --radius-md: ${radius.md};
  --radius-lg: ${radius.lg};
  --radius-xl: ${radius.xl};
  --radius-2xl: ${radius['2xl']};
  --radius-full: ${radius.full};

  /* Shadows */
  --shadow-sm: ${shadows.sm};
  --shadow-md: ${shadows.md};
  --shadow-lg: ${shadows.lg};
  --shadow-glow-primary: ${shadows.glowPrimary};
  --shadow-glow-secondary: ${shadows.glowSecondary};

  /* Transitions */
  --transition-fast: ${transitions.fast};
  --transition-base: ${transitions.base};
  --transition-normal: ${transitions.normal};
  --transition-spring: ${transitions.spring};

  /* Z-Index */
  --z-dropdown: ${zIndex.dropdown};
  --z-sticky: ${zIndex.sticky};
  --z-fixed: ${zIndex.fixed};
  --z-modal: ${zIndex.modal};
  --z-toast: ${zIndex.toast};

  /* Components */
  --bottom-nav-height: ${components.bottomNav.height};
  --page-header-height: ${components.pageHeader.height};
}
  `.trim();
}

// Default export for convenience
const tokens = {
  colors,
  typography,
  spacing,
  radius,
  shadows,
  transitions,
  zIndex,
  breakpoints,
  components,
  generateCSSVariables,
};

export default tokens;
