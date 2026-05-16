/**
 * BeRight UI Components
 *
 * Unified component library using design tokens
 *
 * Usage:
 * import { Button, Card, Badge } from '@/components/ui';
 * import { Button, type ButtonProps } from '@/components/ui';
 */

// Button
export { default as Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

// Card
export { default as Card, CardHeader, CardBody, CardFooter } from './Card';
export type { CardProps, CardVariant, CardPadding, CardHeaderProps, CardBodyProps, CardFooterProps } from './Card';

// Badge
export { default as Badge } from './Badge';
export type { BadgeProps, BadgeVariant, BadgeSize } from './Badge';

// Skeleton (Loading states)
export { default as Skeleton, SkeletonText, SkeletonAvatar, SkeletonCard, SkeletonLeaderboardRow } from './Skeleton';

// Section (GSAP animated)
export { Section, type SectionProps } from './Section';

// Header
export { Header, type HeaderProps, type NavItem } from './Header';

// Footer
export { Footer, type FooterProps, type FooterSection, type FooterLink } from './Footer';

// PageWrapper (Layout)
export { PageWrapper, type PageWrapperProps } from './PageWrapper';

// Table
export { Table, type TableProps, type TableColumn } from './Table';

// Accordion
export { Accordion, type AccordionProps, type AccordionItem } from './Accordion';

// CodeBlock
export { CodeBlock, type CodeBlockProps } from './CodeBlock';

// Select
export { Select, type SelectProps, type SelectOption } from './Select';

// Animation hooks (re-export for convenience)
export { useScrollReveal, useStagger } from '@/hooks/gsap';
