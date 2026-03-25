# BeRight Component Patterns

Quick reference for unified Chainlift-inspired components.

---

## 1. GSAP Animation Hook

```tsx
// hooks/useGsap.ts
import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function useScrollReveal<T extends HTMLElement>(options?: {
  y?: number;
  duration?: number;
  delay?: number;
  stagger?: number;
}) {
  const ref = useRef<T>(null);
  const { y = 40, duration = 0.8, delay = 0, stagger = 0 } = options || {};

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const targets = stagger > 0 ? el.children : el;

    const ctx = gsap.context(() => {
      gsap.fromTo(targets,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration,
          delay,
          stagger,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          }
        }
      );
    });

    return () => ctx.revert();
  }, [y, duration, delay, stagger]);

  return ref;
}

// Usage
function MarketsList() {
  const gridRef = useScrollReveal<HTMLDivElement>({ stagger: 0.1 });

  return (
    <div ref={gridRef} className="markets-grid">
      {markets.map(m => <MarketCard key={m.id} {...m} />)}
    </div>
  );
}
```

---

## 2. Button Component

```tsx
// components/ui/Button.tsx
import styles from './Button.module.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  fullWidth,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        ${styles.btn}
        ${styles[variant]}
        ${styles[size]}
        ${fullWidth ? styles.fullWidth : ''}
        ${loading ? styles.loading : ''}
        ${className || ''}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className={styles.spinner} /> : icon}
      <span>{children}</span>
    </button>
  );
}
```

```css
/* Button.module.css */
.btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

/* State layer */
.btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: currentColor;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}

.btn:hover::before { opacity: 0.08; }
.btn:focus-visible::before { opacity: 0.12; }
.btn:active::before { opacity: 0.16; }

/* Sizes */
.sm { padding: 8px 16px; font-size: 13px; border-radius: 8px; }
.md { padding: 12px 24px; font-size: 14px; border-radius: 10px; }
.lg { padding: 16px 32px; font-size: 16px; border-radius: 12px; }

/* Variants */
.primary {
  background: linear-gradient(135deg, #10B981, #0EA572);
  color: #000;
}

.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
}

.secondary {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #fff;
}

.secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.ghost {
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
}

.ghost:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.danger {
  background: rgba(239, 68, 68, 0.15);
  color: #EF4444;
}

.danger:hover {
  background: rgba(239, 68, 68, 0.25);
}

.fullWidth { width: 100%; }
.loading { pointer-events: none; opacity: 0.7; }

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

## 3. Card Component

```tsx
// components/ui/Card.tsx
import styles from './Card.module.css';

interface CardProps {
  variant?: 'default' | 'elevated' | 'outlined' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export function Card({
  variant = 'default',
  padding = 'md',
  header,
  footer,
  className,
  children,
  onClick,
}: CardProps) {
  return (
    <div
      className={`
        ${styles.card}
        ${styles[variant]}
        ${styles[`padding-${padding}`]}
        ${className || ''}
      `}
      onClick={onClick}
    >
      {header && <div className={styles.header}>{header}</div>}
      <div className={styles.content}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
```

```css
/* Card.module.css */
.card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  overflow: hidden;
}

.elevated {
  background: rgba(255, 255, 255, 0.04);
  border: none;
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.2),
    0 4px 12px rgba(0, 0, 0, 0.1);
}

.outlined {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.interactive {
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.interactive:hover {
  transform: translateY(-4px);
  border-color: rgba(0, 194, 255, 0.3);
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.2),
    0 0 0 1px rgba(0, 194, 255, 0.2);
}

/* Padding variants */
.padding-none .content { padding: 0; }
.padding-sm .content { padding: 16px; }
.padding-md .content { padding: 24px; }
.padding-lg .content { padding: 32px; }

.header {
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  background: rgba(255, 255, 255, 0.02);
}

.footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  background: rgba(255, 255, 255, 0.01);
}
```

---

## 4. Section Component (with GSAP)

```tsx
// components/ui/Section.tsx
import { useScrollReveal } from '@/hooks/useGsap';
import styles from './Section.module.css';

interface SectionProps {
  id?: string;
  variant?: 'default' | 'alt' | 'gradient';
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
  children: React.ReactNode;
}

export function Section({
  id,
  variant = 'default',
  size = 'md',
  animate = true,
  children,
}: SectionProps) {
  const ref = animate ? useScrollReveal<HTMLElement>() : null;

  return (
    <section
      id={id}
      ref={ref}
      className={`${styles.section} ${styles[variant]} ${styles[size]}`}
    >
      <div className={styles.inner}>
        {children}
      </div>
    </section>
  );
}
```

```css
/* Section.module.css */
.section {
  width: 100%;
}

.default { background: transparent; }
.alt { background: rgba(255, 255, 255, 0.01); }
.gradient {
  background: linear-gradient(180deg,
    rgba(16, 185, 129, 0.03) 0%,
    transparent 100%
  );
}

.sm { padding: 48px 24px; }
.md { padding: 80px 24px; }
.lg { padding: 120px 24px; }

.inner {
  max-width: 1200px;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .sm { padding: 32px 16px; }
  .md { padding: 48px 16px; }
  .lg { padding: 64px 16px; }
}
```

---

## 5. Accordion Component

```tsx
// components/ui/Accordion.tsx
import { useState, useRef } from 'react';
import { gsap } from 'gsap';
import styles from './Accordion.module.css';

interface AccordionItem {
  id: string;
  question: string;
  answer: React.ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
}

export function Accordion({ items, allowMultiple = false }: AccordionProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const contentRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const toggle = (id: string) => {
    const isOpen = openIds.has(id);
    const content = contentRefs.current.get(id);

    if (!content) return;

    if (isOpen) {
      // Close
      gsap.to(content, {
        height: 0,
        duration: 0.3,
        ease: 'power2.inOut',
        onComplete: () => {
          setOpenIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      });
    } else {
      // Open
      if (!allowMultiple) {
        // Close others
        openIds.forEach(openId => {
          const otherContent = contentRefs.current.get(openId);
          if (otherContent) {
            gsap.to(otherContent, { height: 0, duration: 0.3, ease: 'power2.inOut' });
          }
        });
        setOpenIds(new Set([id]));
      } else {
        setOpenIds(prev => new Set([...prev, id]));
      }

      gsap.fromTo(content,
        { height: 0 },
        { height: 'auto', duration: 0.4, ease: 'power2.out' }
      );
    }
  };

  return (
    <div className={styles.accordion}>
      {items.map(item => (
        <div
          key={item.id}
          className={`${styles.item} ${openIds.has(item.id) ? styles.open : ''}`}
        >
          <button
            className={styles.trigger}
            onClick={() => toggle(item.id)}
            aria-expanded={openIds.has(item.id)}
          >
            <span>{item.question}</span>
            <span className={styles.icon}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </span>
          </button>
          <div
            ref={el => el && contentRefs.current.set(item.id, el)}
            className={styles.content}
          >
            <div className={styles.answer}>{item.answer}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 6. Table Component

```tsx
// components/ui/Table.tsx
import styles from './Table.module.css';

interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: string;
  render?: (item: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
}

export function Table<T>({ columns, data, keyField }: TableProps<T>) {
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={String(col.key)} style={{ width: col.width }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(item => (
            <tr key={String(item[keyField])}>
              {columns.map(col => (
                <td key={String(col.key)}>
                  {col.render
                    ? col.render(item)
                    : String(item[col.key as keyof T])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

```css
/* Table.module.css */
.tableWrapper {
  overflow-x: auto;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th {
  padding: 16px 20px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.table td {
  padding: 16px 20px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.table tbody tr:last-child td {
  border-bottom: none;
}

.table tbody tr:hover {
  background: rgba(255, 255, 255, 0.02);
}
```

---

## 7. Header Component

```tsx
// components/ui/Header.tsx
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Header.module.css';

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/markets', label: 'Markets' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/docs', label: 'Docs' },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>
        <span className={styles.logoBe}>Be</span>
        <span className={styles.logoRight}>Right</span>
      </Link>

      <nav className={styles.nav}>
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`
              ${styles.navLink}
              ${pathname === item.href ? styles.active : ''}
            `}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className={styles.actions}>
        {/* Wallet connect button, etc. */}
      </div>
    </header>
  );
}
```

```css
/* Header.module.css */
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: rgba(8, 12, 20, 0.9);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.logo {
  display: flex;
  text-decoration: none;
  font-size: 22px;
  font-weight: 800;
}

.logoBe { color: #fff; }
.logoRight {
  background: linear-gradient(135deg, #10B981, #00C2FF, #8B5CF6);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.nav {
  display: flex;
  gap: 8px;
}

.navLink {
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
  text-decoration: none;
  transition: all 0.2s;
}

.navLink:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.06);
}

.navLink.active {
  color: #fff;
  background: rgba(16, 185, 129, 0.15);
}

@media (max-width: 768px) {
  .nav { display: none; }
  .header { padding: 12px 16px; }
}
```

---

## Usage Example: Refactored Fees Page

```tsx
// app/docs/fees/page.tsx (AFTER refactor)
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { useScrollReveal } from '@/hooks/useGsap';

const COLUMNS = [
  { key: 'platform', header: 'Platform', render: (p) => (
    <span className="flex items-center gap-2">
      <span>{p.icon}</span> {p.platform}
    </span>
  )},
  { key: 'tradingFee', header: 'Trading Fee' },
  { key: 'withdrawalFee', header: 'Withdrawal' },
  { key: 'notes', header: 'Notes' },
];

export default function FeesPage() {
  const gridRef = useScrollReveal<HTMLDivElement>({ stagger: 0.1 });

  return (
    <>
      <Section variant="gradient" size="lg">
        <h1>Fees & Pricing</h1>
        <p>Transparent fee structure for BeRight and supported platforms</p>
      </Section>

      <Section>
        <h2>Platform Fee Comparison</h2>
        <Table columns={COLUMNS} data={PLATFORM_FEES} keyField="platform" />
      </Section>

      <Section variant="alt">
        <h2>Tips to Minimize Fees</h2>
        <div ref={gridRef} className="grid grid-cols-2 gap-4">
          {TIPS.map(tip => (
            <Card key={tip.id} variant="outlined">
              <span className="tip-num">{tip.num}</span>
              <h3>{tip.title}</h3>
              <p>{tip.description}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section>
        <h2>Ready to start?</h2>
        <div className="flex gap-4 justify-center">
          <Button variant="primary" size="lg">Browse Markets</Button>
          <Button variant="secondary" size="lg">API Docs</Button>
        </div>
      </Section>
    </>
  );
}
```

**Result**: ~80 lines vs original ~600 lines (87% reduction)

---

## Quick Wins Checklist

- [ ] Copy `useScrollReveal` hook to project
- [ ] Create `Button.tsx` + `Button.module.css`
- [ ] Create `Card.tsx` + `Card.module.css`
- [ ] Create `Section.tsx` + `Section.module.css`
- [ ] Install GSAP: `npm i gsap @gsap/react`
- [ ] Add animation tokens to `tokens.css`
- [ ] Refactor `/docs/fees` as pilot page
