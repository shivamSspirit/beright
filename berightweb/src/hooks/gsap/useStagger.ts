/**
 * useStagger - GSAP staggered children animation
 *
 * Animates children elements with a stagger effect when container enters viewport.
 *
 * @example
 * function Component() {
 *   const ref = useStagger<HTMLDivElement>();
 *   return (
 *     <div ref={ref}>
 *       <div>Child 1</div>
 *       <div>Child 2</div>
 *       <div>Child 3</div>
 *     </div>
 *   );
 * }
 *
 * @example With options
 * const ref = useStagger<HTMLUListElement>({
 *   stagger: 0.15,
 *   y: 30,
 *   selector: 'li',  // Only animate li children
 * });
 */

'use client';

import { useRef, useLayoutEffect } from 'react';
import { gsap, ScrollTrigger, EASES, DURATIONS, SCROLL_TRIGGER_DEFAULTS } from '@/lib/gsap-config';

export interface StaggerOptions {
  /** Delay between each child animation (default: 0.1) */
  stagger?: number;
  /** Vertical offset to animate from (default: 30) */
  y?: number;
  /** Horizontal offset to animate from (default: 0) */
  x?: number;
  /** Initial opacity (default: 0) */
  opacity?: number;
  /** Initial scale (default: 1) */
  scale?: number;
  /** Animation duration in seconds (default: 0.5) */
  duration?: number;
  /** Animation delay before first child (default: 0) */
  delay?: number;
  /** Easing function (default: 'power2.out') */
  ease?: string;
  /** CSS selector for children to animate (default: ':scope > *') */
  selector?: string;
  /** When to start animation (default: 'top 85%') */
  start?: string;
  /** Stagger from: 'start', 'center', 'end', 'edges', or 'random' */
  from?: 'start' | 'center' | 'end' | 'edges' | 'random';
  /** Disable animation */
  disabled?: boolean;
  /** Callback when all animations complete */
  onComplete?: () => void;
}

export function useStagger<T extends HTMLElement>(
  options: StaggerOptions = {}
): React.RefObject<T | null> {
  const ref = useRef<T>(null);

  const {
    stagger = 0.1,
    y = 30,
    x = 0,
    opacity = 0,
    scale = 1,
    duration = DURATIONS.medium,
    delay = 0,
    ease = EASES.smooth,
    selector = ':scope > *',
    start = SCROLL_TRIGGER_DEFAULTS.start,
    from = 'start',
    disabled = false,
    onComplete,
  } = options;

  useLayoutEffect(() => {
    if (disabled || typeof window === 'undefined') return;

    const container = ref.current;
    if (!container) return;

    const children = container.querySelectorAll(selector);
    if (children.length === 0) return;

    // Set initial state for all children
    gsap.set(children, {
      opacity,
      y,
      x,
      scale,
    });

    const ctx = gsap.context(() => {
      gsap.to(children, {
        opacity: 1,
        y: 0,
        x: 0,
        scale: 1,
        duration,
        delay,
        ease,
        stagger: {
          each: stagger,
          from,
        },
        onComplete,
        scrollTrigger: {
          trigger: container,
          start,
          toggleActions: 'play none none reverse',
        },
      });
    });

    return () => {
      ctx.revert();
    };
  }, [stagger, y, x, opacity, scale, duration, delay, ease, selector, start, from, disabled, onComplete]);

  return ref;
}

export default useStagger;
