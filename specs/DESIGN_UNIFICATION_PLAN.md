# BeRight Design Unification Plan

**Reference**: chainlift.io (Premium GSAP + Material Design 3)
**Scope**: 9 Core Pages
**Target**: Premium agency-level unified design system

---

## Executive Summary

BeRight currently has a fragmented design system across 9 pages using 3 different styling approaches (styled-jsx, CSS modules, inline styles). This plan unifies everything into a premium Chainlift-inspired design system with GSAP animations and Material Design 3 patterns.

---

## Current State Audit

### Page-by-Page Analysis

| Page | LOC (styles) | Approach | Issues |
|------|--------------|----------|--------|
| `/` | ~150 | Inline JSX | Minimal, just loading states |
| `/markets` | ~1,700 | styled-jsx | Massive inline block, hard to maintain |
| `/leaderboard` | ~500 | CSS modules | Clean but isolated from system |
| `/beright-terminal` | ~800 | styled-jsx + modules | Terminal-specific design OK |
| `/profile` | ~600 | CSS modules | "Plate/Inset" pattern unique here |
| `/docs` | ~400 | CSS modules | Sidebar pattern, inconsistent nav |
| `/docs/faq` | ~900 | styled-jsx | Accordion pattern, duplicated styles |
| `/docs/api` | ~1,400 | styled-jsx | Code blocks, endpoint cards |
| `/docs/fees` | ~600 | styled-jsx | Table patterns, tip cards |

**Total Inline Styles**: ~4,600+ lines of styled-jsx that should be extracted

### Key Problems

1. **No Shared Components**: Every page redefines cards, buttons, headers, footers
2. **Inconsistent Patterns**:
   - Cards: `.market-card`, `.beright-fee-card`, `.example-card`, `.tip-card` (all different)
   - Buttons: `.cta-btn`, `.connect-btn`, `.action-btn` (no consistency)
   - Headers: Custom per page, no shared navigation
3. **No Animations**: Static pages, no scroll-based reveals or micro-interactions
4. **Missing State Layers**: No hover/focus/pressed states per Material Design 3
5. **Color Inconsistency**: Mix of hardcoded values and token references

---

## Chainlift Patterns to Adopt

### 1. GSAP Integration

```javascript
// gsap-config.ts
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(ScrollTrigger, CustomEase);

// Custom eases matching Chainlift
CustomEase.create('smooth', '0.4, 0, 0.2, 1');
CustomEase.create('bounce', '0.34, 1.56, 0.64, 1');
CustomEase.create('enter', '0, 0, 0.2, 1');
CustomEase.create('exit', '0.4, 0, 1, 1');
```

### 2. Animation Patterns

```typescript
// hooks/useScrollReveal.ts
export function useScrollReveal(ref: RefObject<HTMLElement>, options?: ScrollTriggerOptions) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    gsap.fromTo(el,
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'smooth',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none reverse',
          ...options
        }
      }
    );
  }, []);
}

// Usage in any component
const sectionRef = useRef<HTMLDivElement>(null);
useScrollReveal(sectionRef);
```

### 3. Material Design 3 State Layers

```css
/* tokens.css additions */
:root {
  /* State layer opacities */
  --state-hover: 0.08;
  --state-focus: 0.12;
  --state-pressed: 0.12;
  --state-dragged: 0.16;

  /* State layer colors (applied over primary) */
  --surface-state-hover: rgba(255, 255, 255, 0.08);
  --surface-state-focus: rgba(0, 194, 255, 0.12);
  --surface-state-pressed: rgba(0, 194, 255, 0.16);

  /* Elevation shadows */
  --elevation-1: 0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.15);
  --elevation-2: 0 2px 4px rgba(0, 0, 0, 0.3), 0 4px 8px rgba(0, 0, 0, 0.15);
  --elevation-3: 0 4px 8px rgba(0, 0, 0, 0.3), 0 8px 16px rgba(0, 0, 0, 0.15);
}
```

---

## Unified Component Library

### Core Components to Create

```
berightweb/src/components/ui/
├── Button/
│   ├── Button.tsx
│   ├── Button.module.css
│   └── index.ts
├── Card/
│   ├── Card.tsx           # Base card with variants
│   ├── MarketCard.tsx     # Extends Card for markets
│   ├── StatCard.tsx       # For stats/metrics
│   └── Card.module.css
├── Navigation/
│   ├── Header.tsx         # Unified header
│   ├── Footer.tsx         # Unified footer
│   ├── Sidebar.tsx        # Docs sidebar
│   └── BottomNav.tsx      # Mobile nav
├── Layout/
│   ├── PageWrapper.tsx    # Standard page container
│   ├── Section.tsx        # Content section with animations
│   └── Grid.tsx           # Responsive grid system
├── Data/
│   ├── Table.tsx          # Data tables (fees, etc.)
│   ├── Accordion.tsx      # FAQ accordions
│   ├── CodeBlock.tsx      # API code examples
│   └── Badge.tsx          # Status badges
└── Animation/
    ├── FadeIn.tsx         # GSAP fade-in wrapper
    ├── SlideUp.tsx        # GSAP slide-up wrapper
    └── StaggerChildren.tsx # GSAP stagger container
```

### Button Component Spec

```tsx
// Button.tsx
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  size: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

// Styles from tokens.css
.btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 600;
  border-radius: var(--radius-md);
  transition: all 0.2s var(--ease-smooth);
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
}

.btn:hover::before { opacity: var(--state-hover); }
.btn:focus-visible::before { opacity: var(--state-focus); }
.btn:active::before { opacity: var(--state-pressed); }

/* Variants */
.btn-primary {
  background: var(--color-primary);
  color: var(--color-bg-primary);
}

.btn-secondary {
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border-default);
  color: var(--color-text-primary);
}
```

### Card Component Spec

```tsx
// Card.tsx - Base card with consistent patterns
interface CardProps {
  variant: 'default' | 'elevated' | 'outlined' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

// Styles
.card {
  background: var(--color-surface-primary);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.card-elevated {
  background: var(--color-surface-elevated);
  box-shadow: var(--elevation-2);
  border: none;
}

.card-interactive {
  cursor: pointer;
  transition: all 0.3s var(--ease-smooth);
}

.card-interactive:hover {
  transform: translateY(-4px);
  box-shadow: var(--elevation-3);
  border-color: var(--color-primary);
}
```

---

## Page-Specific Refactoring

### 1. Home Page (`/`)
- **Current**: SwipeCards or LandingPage based on auth
- **Changes**:
  - Add GSAP entrance animation for landing hero
  - Parallax scroll on landing sections
  - Smooth card stacking animations (keep Framer Motion for swipe, add GSAP for reveals)

### 2. Markets Page (`/markets`)
- **Current**: 1,700 lines styled-jsx
- **Changes**:
  - Extract to `markets.module.css` (~400 lines)
  - Use shared `<Card>` and `<Table>` components
  - Add GSAP stagger on market cards load
  - Filter dropdown → shared `<Select>` component

### 3. Leaderboard (`/leaderboard`)
- **Current**: CSS modules, podium design
- **Changes**:
  - Keep CSS modules approach (cleanest)
  - Add GSAP number counter animations
  - Podium entrance with stagger
  - Share card patterns with other pages

### 4. Terminal (`/beright-terminal`)
- **Current**: Unique 3-column layout
- **Changes**:
  - Keep distinct design (terminal aesthetic)
  - Add subtle GSAP transitions between views
  - Terminal typing effect improvements
  - This page can remain intentionally different

### 5. Profile (`/profile`)
- **Current**: "Plate/Inset" design, ~1200 lines
- **Changes**:
  - Keep industrial metallic theme
  - Extract common stats cards to shared components
  - Add GSAP counter animations for stats
  - Achievements grid entrance animation

### 6. Docs Main (`/docs`)
- **Current**: Sidebar + content sections
- **Changes**:
  - Shared `<Sidebar>` component for all docs pages
  - Section reveal animations on scroll
  - Code block syntax highlighting component
  - Navigation breadcrumbs

### 7. Docs FAQ (`/docs/faq`)
- **Current**: 900 lines styled-jsx, accordion
- **Changes**:
  - Shared `<Accordion>` component
  - GSAP height animation for open/close
  - Category filtering as shared pattern
  - Reduce to ~200 lines with components

### 8. Docs API (`/docs/api`)
- **Current**: 1,400 lines styled-jsx
- **Changes**:
  - Shared `<CodeBlock>` with copy button
  - Shared `<EndpointCard>` component
  - GSAP reveals for sections
  - Reduce to ~300 lines with components

### 9. Docs Fees (`/docs/fees`)
- **Current**: 600 lines styled-jsx, tables + tips
- **Changes**:
  - Shared `<Table>` component
  - Shared `<TipCard>` component
  - Platform comparison → reusable grid
  - Reduce to ~200 lines with components

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
1. Install GSAP packages: `gsap`, `@gsap/react`
2. Create `gsap-config.ts` with custom eases
3. Add state layer tokens to `tokens.css`
4. Create animation hooks: `useScrollReveal`, `useStagger`
5. Create base `<Section>` component with reveal

### Phase 2: Core Components (Week 2)
1. `<Button>` with all variants + state layers
2. `<Card>` base + `<StatCard>`, `<FeatureCard>`
3. `<Header>` unified with mobile menu
4. `<Footer>` unified
5. `<PageWrapper>` layout container

### Phase 3: Data Components (Week 3)
1. `<Table>` for fees/platforms
2. `<Accordion>` with GSAP animation
3. `<CodeBlock>` with Prism highlighting
4. `<Badge>` status indicators
5. `<Select>` custom dropdown

### Phase 4: Page Migrations
1. Start with `/docs/fees` (smallest, test components)
2. Then `/docs/faq` (test Accordion)
3. Then `/docs/api` (test CodeBlock)
4. Then `/docs` main
5. Then `/markets` (biggest refactor)
6. Then `/leaderboard` and `/profile`
7. Finally `/` landing page polish

---

## Design Tokens Updates

```css
/* Add to tokens.css */

/* Animation durations */
--duration-instant: 100ms;
--duration-fast: 200ms;
--duration-normal: 300ms;
--duration-slow: 500ms;
--duration-slower: 800ms;

/* Animation easings */
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
--ease-enter: cubic-bezier(0, 0, 0.2, 1);
--ease-exit: cubic-bezier(0.4, 0, 1, 1);

/* Z-index scale */
--z-dropdown: 1000;
--z-sticky: 1100;
--z-modal-backdrop: 1200;
--z-modal: 1300;
--z-popover: 1400;
--z-tooltip: 1500;
--z-toast: 1600;

/* Content widths */
--content-sm: 640px;
--content-md: 768px;
--content-lg: 1024px;
--content-xl: 1280px;
--content-2xl: 1440px;
```

---

## Dependencies to Add

```json
{
  "dependencies": {
    "gsap": "^3.12.5",
    "@gsap/react": "^2.1.0",
    "prism-react-renderer": "^2.3.1"
  }
}
```

**Note**: GSAP is free for non-commercial use. For BeRight's production use, you'll want the GSAP Club membership ($99/year) which includes:
- ScrollTrigger (included free)
- DrawSVGPlugin (premium)
- MorphSVGPlugin (premium)
- CustomEase (included free)

For now, ScrollTrigger + CustomEase are sufficient and free.

---

## File Reduction Estimates

| Page | Current LOC | After Refactor | Reduction |
|------|-------------|----------------|-----------|
| `/markets` | 1,700 | ~400 | 76% |
| `/docs/faq` | 900 | ~200 | 78% |
| `/docs/api` | 1,400 | ~300 | 79% |
| `/docs/fees` | 600 | ~150 | 75% |
| `/profile` | 600 | ~300 | 50% |
| **Total** | ~5,200 | ~1,350 | **74%** |

---

## Quality Checklist

- [ ] All buttons use `<Button>` component
- [ ] All cards use `<Card>` variants
- [ ] Unified header/footer across all pages
- [ ] GSAP scroll animations on all sections
- [ ] State layers on all interactive elements
- [ ] Consistent color token usage (no hardcoded colors)
- [ ] Mobile-first responsive design
- [ ] Accessibility: focus states, ARIA labels
- [ ] Performance: GSAP animations at 60fps
- [ ] Dark mode ready (already have tokens)

---

## Next Steps

1. **Approve this plan** - Review and confirm approach
2. **Start Phase 1** - GSAP setup + animation hooks
3. **Create component storybook** (optional) - Visual testing
4. **Migrate page by page** - Starting with smallest (fees)

Ready to begin implementation on your approval.
