'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  Target,
  Trophy,
  Zap,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  X
} from 'lucide-react';
import styles from './OnboardingModal.module.css';

interface OnboardingStep {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: string;
  action?: {
    label: string;
    onClick?: () => void;
  };
}

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  walletAddress?: string | null;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    icon: <Sparkles size={32} />,
    title: 'Welcome to BeRight',
    description: 'The AI-powered prediction market where your forecasting skills build your reputation and earn rewards.',
    highlight: 'Be right. Get paid.',
  },
  {
    id: 'predict',
    icon: <Target size={32} />,
    title: 'Make Predictions',
    description: 'Swipe through market cards to make quick YES/NO predictions on real-world events. The more accurate you are, the higher you climb.',
    highlight: 'Swipe right for YES, left for NO',
  },
  {
    id: 'brier',
    icon: <TrendingUp size={32} />,
    title: 'Build Your Brier Score',
    description: 'Your Brier Score measures prediction accuracy (lower is better). Top forecasters with proven track records attract followers and earn from delegated stakes.',
    highlight: '0.0 = Perfect • 1.0 = Always wrong',
  },
  {
    id: 'compete',
    icon: <Trophy size={32} />,
    title: 'Climb the Leaderboard',
    description: 'Compete against other forecasters, build streaks, and unlock achievement badges. Top performers get featured on the Alpha Board.',
    highlight: 'Weekly prizes for top 10',
  },
  {
    id: 'earn',
    icon: <Zap size={32} />,
    title: 'Earn Rewards',
    description: 'Accurate predictions earn XP and unlock higher leagues. Invite friends with your referral code to earn bonus rewards together.',
    highlight: 'Skill → Reputation → Rewards',
  },
];

export default function OnboardingModal({
  isOpen,
  onClose,
  onComplete,
  walletAddress
}: OnboardingModalProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');

  const totalSteps = ONBOARDING_STEPS.length;
  const step = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  const goToStep = (index: number, dir: 'next' | 'prev') => {
    if (isAnimating || index < 0 || index >= totalSteps) return;
    setDirection(dir);
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(index);
      setIsAnimating(false);
    }, 200);
  };

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      goToStep(currentStep + 1, 'next');
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      goToStep(currentStep - 1, 'prev');
    }
  };

  const handleComplete = () => {
    onComplete();
    onClose();
  };

  const handleSkip = () => {
    onComplete();
    onClose();
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'Escape') {
        handleSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep, isAnimating]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleSkip}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Skip button */}
        <button className={styles.skipBtn} onClick={handleSkip} aria-label="Skip onboarding">
          <X size={20} />
        </button>

        {/* Progress dots */}
        <div className={styles.progress}>
          {ONBOARDING_STEPS.map((_, index) => (
            <button
              key={index}
              className={`${styles.dot} ${index === currentStep ? styles.active : ''} ${index < currentStep ? styles.completed : ''}`}
              onClick={() => goToStep(index, index > currentStep ? 'next' : 'prev')}
              aria-label={`Go to step ${index + 1}`}
            />
          ))}
        </div>

        {/* Step content */}
        <div
          className={`${styles.content} ${isAnimating ? (direction === 'next' ? styles.slideOutLeft : styles.slideOutRight) : ''}`}
        >
          <div className={styles.iconWrapper}>
            {step.icon}
          </div>

          <h2 className={styles.title}>{step.title}</h2>

          <p className={styles.description}>{step.description}</p>

          {step.highlight && (
            <div className={styles.highlight}>
              {step.highlight}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className={styles.navigation}>
          <button
            className={`${styles.navBtn} ${styles.prevBtn}`}
            onClick={handlePrev}
            disabled={isFirstStep}
          >
            <ChevronLeft size={20} />
            <span>Back</span>
          </button>

          <button
            className={`${styles.navBtn} ${styles.nextBtn} ${isLastStep ? styles.completeBtn : ''}`}
            onClick={handleNext}
          >
            <span>{isLastStep ? 'Get Started' : 'Next'}</span>
            {!isLastStep && <ChevronRight size={20} />}
          </button>
        </div>

        {/* Step counter */}
        <div className={styles.stepCounter}>
          {currentStep + 1} / {totalSteps}
        </div>
      </div>
    </div>
  );
}

// Hook to manage onboarding state
export function useOnboarding() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Check localStorage for onboarding completion
    const completed = localStorage.getItem('beright_onboarding_completed');
    setHasCompletedOnboarding(completed === 'true');

    // Show onboarding if not completed
    if (completed !== 'true') {
      // Small delay for smoother UX
      setTimeout(() => setShowOnboarding(true), 500);
    }
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem('beright_onboarding_completed', 'true');
    localStorage.setItem('beright_onboarding_completed_at', new Date().toISOString());
    setHasCompletedOnboarding(true);
    setShowOnboarding(false);
  };

  const resetOnboarding = () => {
    localStorage.removeItem('beright_onboarding_completed');
    localStorage.removeItem('beright_onboarding_completed_at');
    setHasCompletedOnboarding(false);
    setShowOnboarding(true);
  };

  const closeOnboarding = () => {
    setShowOnboarding(false);
  };

  return {
    hasCompletedOnboarding,
    showOnboarding,
    completeOnboarding,
    resetOnboarding,
    closeOnboarding,
    openOnboarding: () => setShowOnboarding(true),
  };
}
