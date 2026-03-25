/**
 * useScrollReveal - GSAP scroll-triggered reveal animation
 *
 * Reveals an element when it enters the viewport with customizable animation.
 *
 * @example
 * function Component() {
 *   const ref = useScrollReveal<HTMLDivElement>();
 *   return <div ref={ref}>Animates on scroll</div>;
 * }
 *
 * @example With options
 * const ref = useScrollReveal<HTMLDivElement>({
 *   y: 60,
 *   duration: 1,
 *   delay: 0.2,
 * });
 */

'use client';

import { useRef, useLayoutEffect } from 'react';
import { gsap, ScrollTrigger, EASES, DURATIONS, SCROLL_TRIGGER_DEFAULTS } from '@/lib/gsap-config';

export interface ScrollRevealOptions {
  /** Vertical offset to animate from (default: 40) */
  y?: number;
  /** Horizontal offset to animate from (default: 0) */
  x?: number;
  /** Initial opacity (default: 0) */
  opacity?: number;
  /** Initial scale (default: 1) */
  scale?: number;
  /** Animation duration in seconds (default: 0.8) */
  duration?: number;
  /** Animation delay in seconds (default: 0) */
  delay?: number;
  /** Easing function (default: 'power2.out') */
  ease?: string;
  /** When to start animation (default: 'top 85%') */
  start?: string;
  /** When to end animation (default: 'bottom 15%') */
  end?: string;
  /** Whether to reverse on scroll up (default: true) */
  scrub?: boolean | number;
  /** Disable animation (for testing/accessibility) */
  disabled?: boolean;
  /** Callback when animation completes */
  onComplete?: () => void;
}

export function useScrollReveal<T extends HTMLElement>(
  options: ScrollRevealOptions = {}
): React.RefObject<T | null> {
  const ref = useRef<T>(null);

  const {
    y = 40,
    x = 0,
    opacity = 0,
    scale = 1,
    duration = DURATIONS.slow,
    delay = 0,
    ease = EASES.smooth,
    start = SCROLL_TRIGGER_DEFAULTS.start,
    end = SCROLL_TRIGGER_DEFAULTS.end,
    scrub = false,
    disabled = false,
    onComplete,
  } = options;

  useLayoutEffect(() => {
    if (disabled || typeof window === 'undefined') return;

    const el = ref.current;
    if (!el) return;

    // Set initial state
    gsap.set(el, {
      opacity,
      y,
      x,
      scale,
    });

    const ctx = gsap.context(() => {
      gsap.to(el, {
        opacity: 1,
        y: 0,
        x: 0,
        scale: 1,
        duration,
        delay,
        ease,
        onComplete,
        scrollTrigger: {
          trigger: el,
          start,
          end,
          toggleActions: scrub ? undefined : 'play none none reverse',
          scrub: scrub === true ? 1 : scrub,
        },
      });
    });

    return () => {
      ctx.revert();
    };
  }, [y, x, opacity, scale, duration, delay, ease, start, end, scrub, disabled, onComplete]);

  return ref;
}

export default useScrollReveal;
