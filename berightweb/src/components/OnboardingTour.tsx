'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './OnboardingTour.module.css';

export interface TourStep {
  id: string;
  target: string; // CSS selector for the element to highlight
  title: string;
  description: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  action?: string; // Optional CTA text (e.g., "Try swiping the card")
  highlightPadding?: number; // Padding around highlighted element
}

interface OnboardingTourProps {
  steps: TourStep[];
  onComplete?: () => void;
  onSkip?: () => void;
  storageKey?: string; // localStorage key to persist tour completion
}

export default function OnboardingTour({
  steps,
  onComplete,
  onSkip,
  storageKey = 'beright-tour-completed',
}: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [highlightRect, setHighlightRect] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Check if tour has been completed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const completed = localStorage.getItem(storageKey);
      if (!completed) {
        // Small delay before starting tour
        setTimeout(() => setIsActive(true), 1000);
      }
    }
  }, [storageKey]);

  // Update tooltip and highlight positions when step changes
  useEffect(() => {
    if (!isActive) return;

    const step = steps[currentStep];
    if (!step) return;

    const updatePosition = () => {
      const target = document.querySelector(step.target);
      if (!target || !tooltipRef.current) return;

      const targetRect = target.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const padding = step.highlightPadding || 8;

      // Update highlight rectangle
      setHighlightRect({
        top: targetRect.top - padding,
        left: targetRect.left - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
      });

      // Calculate tooltip position based on placement
      let top = 0;
      let left = 0;

      const placement = step.placement || 'bottom';

      switch (placement) {
        case 'top':
          top = targetRect.top - tooltipRect.height - 16;
          left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
          break;
        case 'bottom':
          top = targetRect.bottom + 16;
          left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
          break;
        case 'left':
          top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
          left = targetRect.left - tooltipRect.width - 16;
          break;
        case 'right':
          top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
          left = targetRect.right + 16;
          break;
      }

      // Keep tooltip within viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (left < 16) left = 16;
      if (left + tooltipRect.width > viewportWidth - 16) {
        left = viewportWidth - tooltipRect.width - 16;
      }
      if (top < 16) top = 16;
      if (top + tooltipRect.height > viewportHeight - 16) {
        top = viewportHeight - tooltipRect.height - 16;
      }

      setTooltipPosition({ top, left });

      // Scroll element into view if needed
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    // Initial position
    updatePosition();

    // Update on scroll/resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isActive, currentStep, steps]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Tour completed
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, 'true');
      }
      setIsActive(false);
      onComplete?.();
    }
  }, [currentStep, steps.length, storageKey, onComplete]);

  const handleSkip = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, 'true');
    }
    setIsActive(false);
    onSkip?.();
  }, [storageKey, onSkip]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  if (!isActive || !steps[currentStep]) return null;

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <>
      {/* Overlay with spotlight cutout */}
      <div className={styles.overlay}>
        <div
          className={styles.spotlight}
          style={{
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
          }}
        />
      </div>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={styles.tooltip}
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
      >
        {/* Progress bar */}
        <div className={styles.progress}>
          <div className={styles.progressBar} style={{ width: `${progress}%` }} />
        </div>

        {/* Content */}
        <div className={styles.content}>
          <div className={styles.header}>
            <span className={styles.stepCounter}>
              {currentStep + 1} / {steps.length}
            </span>
            <h3 className={styles.title}>{step.title}</h3>
          </div>

          <p className={styles.description}>{step.description}</p>

          {step.action && (
            <div className={styles.action}>
              <span className={styles.actionIcon}>→</span>
              <span className={styles.actionText}>{step.action}</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className={styles.navigation}>
          <button
            className={styles.skipBtn}
            onClick={handleSkip}
          >
            Skip Tour
          </button>

          <div className={styles.navButtons}>
            {currentStep > 0 && (
              <button
                className={styles.prevBtn}
                onClick={handlePrevious}
              >
                Previous
              </button>
            )}
            <button
              className={styles.nextBtn}
              onClick={handleNext}
            >
              {currentStep < steps.length - 1 ? 'Next' : 'Finish'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Hook to restart tour manually
export function useRestartTour(storageKey: string = 'beright-tour-completed') {
  return useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey);
      window.location.reload();
    }
  }, [storageKey]);
}
