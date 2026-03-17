---
name: frontend-design
description: Build polished UI components for BeRight using the established design system. Use when creating pages, components, styling with Tailwind, or converting mockups to code.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(npm *)
---

# Skill: Front-End Design

Build polished, accessible UI components for BeRight prediction market interfaces.

## When to Use

- Creating new pages or components
- Implementing design mockups or screenshots
- Adding responsive layouts
- Styling with Tailwind CSS
- Building interactive elements (swipe cards, modals, dropdowns)

## BeRight Design System

### Brand Colors (from tailwind.config.js)

```javascript
// Primary green scale
primary: {
  50: '#f0fdf4',   // Light backgrounds
  500: '#22c55e', // Main accent
  700: '#15803d', // Hover states
  900: '#14532d', // Dark text
}

// Semantic colors
bullish: '#22c55e'   // Positive/YES/green
bearish: '#ef4444'   // Negative/NO/red
neutral: '#6b7280'   // Neutral states

// Platform badges
polymarket: '#8b5cf6' // Purple
kalshi: '#3b82f6'     // Blue
manifold: '#eab308'   // Yellow
```

### Typography

```css
font-sans: Inter, system-ui, sans-serif  /* Body text */
font-mono: JetBrains Mono, monospace     /* Terminal/code */
```

### Dark Mode First

- Background: Dark grays (#0f0f1a, #1a1a2e, #1f2937)
- Text: White/gray scale (#ffffff, #d1d5db, #9ca3af, #6b7280)
- Borders: #374151
- Use `darkMode: 'class'` (Tailwind config)

### Component Patterns

**Cards/Panels:**
```tsx
<div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
```

**Buttons:**
```tsx
// Primary
<button className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg">

// Secondary
<button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">

// Danger
<button className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg">
```

**Status Indicators:**
```tsx
// Online
<span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />

// Scanning/Loading
<span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />

// Offline/Error
<span className="w-2 h-2 rounded-full bg-red-400" />
```

**Platform Badges:**
```tsx
const platformColors: Record<string, string> = {
  polymarket: 'bg-purple-600',
  kalshi: 'bg-blue-600',
  manifold: 'bg-yellow-600',
  metaculus: 'bg-blue-500',
};
```

## Phase 1: Design Analysis

### 1. Understand Requirements
- What is the user goal?
- What data will be displayed?
- What interactions are needed?
- Mobile-first or desktop-first?

### 2. Review Existing Patterns
Check existing pages for consistency:
```
beright-ts/app/page.tsx        # Terminal interface
beright-ts/app/swipe/page.tsx  # Swipe cards
beright-ts/app/globals.css     # Global styles
```

### 3. Identify Reusable Components
- Platform badges
- Price/probability displays
- Loading spinners
- Modal overlays
- Stat rows

## Phase 2: Component Structure

### File Organization
```
beright-ts/
├── app/
│   ├── [page]/page.tsx      # Page component
│   ├── layout.tsx           # Root layout
│   └── globals.css          # Global styles
├── components/              # Shared components (if needed)
└── tailwind.config.js       # Design tokens
```

### Component Rules
1. Use `'use client'` for interactive components
2. Keep components under 200 lines
3. Extract reusable logic to custom hooks
4. Type all props with interfaces
5. Use semantic HTML (button, nav, main, section)

### Responsive Breakpoints
```css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
```

## Phase 3: Implementation Checklist

### 1. Create Component Skeleton
```tsx
'use client';

import { useState } from 'react';

interface ComponentProps {
  // Define props
}

export function Component({ ...props }: ComponentProps) {
  return (
    <div className="...">
      {/* Structure */}
    </div>
  );
}
```

### 2. Add Static Layout
- Use Tailwind utility classes
- Mobile-first (start with base, add `md:`, `lg:` prefixes)
- Use Flexbox/Grid for layouts

### 3. Wire Up Data
- Fetch from API routes
- Handle loading states
- Handle error states
- Handle empty states

### 4. Add Interactions
- Hover states (`:hover`)
- Focus states (`:focus-visible`)
- Active states (`:active`)
- Transitions (`transition-colors`, `duration-200`)

### 5. Add Accessibility
- Use semantic HTML elements
- Add `aria-label` for icon-only buttons
- Ensure keyboard navigation works
- Check color contrast (WCAG AA)

## Phase 4: Verification

1. **Visual Check**
   - Mobile (< 640px)
   - Tablet (768px)
   - Desktop (1024px+)

2. **Type Check**
   ```bash
   npm run typecheck
   ```

3. **Build Check**
   ```bash
   npm run build
   ```

4. **Manual Testing**
   - Test all interactive states
   - Test with keyboard only
   - Test loading/error states

## Phase 5: Commit

```bash
git commit -m "feat(ui): [component description]

- Added [specific details]
- Styled with BeRight design system

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

## Common Patterns

### Loading Spinner
```tsx
<div className="flex items-center justify-center">
  <div className="w-8 h-8 border-2 border-gray-600 border-t-green-500 rounded-full animate-spin" />
</div>
```

### Empty State
```tsx
<div className="flex flex-col items-center justify-center py-12 text-gray-500">
  <p>No data available</p>
  <button className="mt-4 text-green-400 hover:text-green-300">
    Refresh
  </button>
</div>
```

### Modal Overlay
```tsx
<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
  <div className="bg-gray-800 rounded-xl max-w-md w-full mx-4 p-6">
    {/* Modal content */}
  </div>
</div>
```

### Price Change Indicator
```tsx
<span className={change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-gray-400'}>
  {change > 0 ? '+' : ''}{change.toFixed(1)}%
</span>
```

## Anti-Patterns to Avoid

- Adding unused CSS classes
- Inline styles instead of Tailwind
- Hardcoding colors not in design system
- Missing loading/error states
- Non-semantic HTML (`div` soup)
- Missing keyboard accessibility
- Light mode styles (we're dark mode only)
