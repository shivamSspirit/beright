/**
 * GSAP Configuration for BeRight
 * Chainlift-inspired animation system
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

// Register plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

// Custom easing curves (Chainlift-inspired)
export const EASES = {
  // Standard Material Design 3 eases
  smooth: 'power2.out',
  smoothInOut: 'power2.inOut',

  // Entrance/Exit
  enter: 'power2.out',
  exit: 'power2.in',

  // Emphasis
  bounce: 'back.out(1.7)',
  elastic: 'elastic.out(1, 0.5)',

  // Subtle
  gentle: 'power1.out',

  // Sharp
  sharp: 'power3.out',
} as const;

// Animation durations (in seconds)
export const DURATIONS = {
  instant: 0.1,
  fast: 0.2,
  normal: 0.3,
  medium: 0.5,
  slow: 0.8,
  slower: 1.2,
} as const;

// ScrollTrigger defaults
export const SCROLL_TRIGGER_DEFAULTS = {
  start: 'top 85%',
  end: 'bottom 15%',
  toggleActions: 'play none none reverse',
} as const;

// Animation presets for common patterns
export const ANIMATION_PRESETS = {
  fadeUp: {
    from: { opacity: 0, y: 40 },
    to: { opacity: 1, y: 0 },
    duration: DURATIONS.medium,
    ease: EASES.smooth,
  },
  fadeIn: {
    from: { opacity: 0 },
    to: { opacity: 1 },
    duration: DURATIONS.normal,
    ease: EASES.gentle,
  },
  scaleIn: {
    from: { opacity: 0, scale: 0.9 },
    to: { opacity: 1, scale: 1 },
    duration: DURATIONS.normal,
    ease: EASES.smooth,
  },
  slideRight: {
    from: { opacity: 0, x: -30 },
    to: { opacity: 1, x: 0 },
    duration: DURATIONS.medium,
    ease: EASES.smooth,
  },
  slideLeft: {
    from: { opacity: 0, x: 30 },
    to: { opacity: 1, x: 0 },
    duration: DURATIONS.medium,
    ease: EASES.smooth,
  },
} as const;

// Stagger configurations
export const STAGGER_PRESETS = {
  fast: 0.05,
  normal: 0.1,
  slow: 0.15,
  cascade: {
    amount: 0.3,
    from: 'start',
  },
  center: {
    amount: 0.3,
    from: 'center',
  },
} as const;

// Export GSAP for convenience
export { gsap, ScrollTrigger, useGSAP };
