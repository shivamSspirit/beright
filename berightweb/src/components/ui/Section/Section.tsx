/**
 * Section - Animated page section with GSAP scroll reveal
 *
 * A consistent container for page sections with optional scroll-triggered animations.
 *
 * @example
 * <Section>
 *   <h2>Section Title</h2>
 *   <p>Section content</p>
 * </Section>
 *
 * @example With variants
 * <Section variant="alt" size="lg" animate>
 *   <h2>Large alternate section</h2>
 * </Section>
 */

'use client';

import { forwardRef, useRef, useLayoutEffect } from 'react';
import { gsap, ScrollTrigger, EASES, DURATIONS } from '@/lib/gsap-config';
import styles from './Section.module.css';

export interface SectionProps {
  /** HTML id attribute */
  id?: string;
  /** Background variant */
  variant?: 'default' | 'alt' | 'gradient' | 'dark';
  /** Padding size */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Enable scroll reveal animation */
  animate?: boolean;
  /** Animation configuration */
  animationOptions?: {
    y?: number;
    duration?: number;
    delay?: number;
  };
  /** Max width of inner content */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  /** Additional CSS classes */
  className?: string;
  /** Section content */
  children: React.ReactNode;
}

export const Section = forwardRef<HTMLElement, SectionProps>(function Section(
  {
    id,
    variant = 'default',
    size = 'md',
    animate = true,
    animationOptions = {},
    maxWidth = 'xl',
    className,
    children,
  },
  forwardedRef
) {
  const internalRef = useRef<HTMLElement>(null);
  const ref = (forwardedRef as React.RefObject<HTMLElement>) || internalRef;

  const { y = 40, duration = DURATIONS.slow, delay = 0 } = animationOptions;

  useLayoutEffect(() => {
    if (!animate || typeof window === 'undefined') return;

    const el = ref.current;
    if (!el) return;

    // Find the inner content wrapper
    const inner = el.querySelector(`.${styles.inner}`);
    if (!inner) return;

    // Set initial state
    gsap.set(inner, {
      opacity: 0,
      y,
    });

    const ctx = gsap.context(() => {
      gsap.to(inner, {
        opacity: 1,
        y: 0,
        duration,
        delay,
        ease: EASES.smooth,
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none reverse',
        },
      });
    });

    return () => {
      ctx.revert();
    };
  }, [animate, y, duration, delay, ref]);

  const sectionClasses = [
    styles.section,
    styles[variant],
    styles[`size-${size}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const innerClasses = [styles.inner, styles[`width-${maxWidth}`]]
    .filter(Boolean)
    .join(' ');

  return (
    <section id={id} ref={ref} className={sectionClasses}>
      <div className={innerClasses}>{children}</div>
    </section>
  );
});

export default Section;
