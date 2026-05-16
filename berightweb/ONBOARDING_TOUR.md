# BeRight Onboarding Tour System

## Overview

The onboarding tour provides an interactive, tooltip-based walkthrough for new users in demo mode. It guides users through key features and interactions, helping them understand what they can do and how to use the platform.

## Features

- **Context-aware tours** - Different tours for different pages (terminal, markets, market details)
- **Spotlight highlighting** - Draws attention to specific UI elements with animated spotlight
- **Auto-positioning** - Tooltips intelligently position themselves to stay within viewport
- **Progress tracking** - Shows current step (e.g., "3 / 7") and progress bar
- **localStorage persistence** - Tour only shows once per user, stored in localStorage
- **Restart functionality** - Users can replay the tour anytime via "?" button
- **Mobile responsive** - Tooltips adapt to mobile screens
- **Demo mode only** - Tours only activate when `isDemo === true`

## Tour Locations

### 1. Terminal Tour (`/beright-terminal`)
**Storage Key**: `beright-terminal-tour-completed`

Guides users through:
1. **Welcome** - Introduction to the AI-powered terminal
2. **CLI Input** - How to use commands and natural language
3. **Agent Fleet** - Understanding the 4 AI agents (SCOUT, ANALYST, TRADER, WHALE)
4. **Markets Tab** - Browsing live market feed
5. **Portfolio Sidebar** - Tracking positions and P&L
6. **Signals Feed** - Real-time intelligence via SSE
7. **Try Commands** - Suggestions for first commands to try

### 2. Markets Tour (`/markets`) - *To be implemented*
**Storage Key**: `beright-markets-tour-completed`

Will guide users through:
1. **Welcome** - Introduction to prediction marketplace
2. **Prediction Cards** - Swiping and browsing markets
3. **Fact Check** - AI-powered analysis
4. **Make Prediction** - Clicking YES/NO buttons
5. **Sign Transaction** - Connecting wallet and signing on devnet

### 3. Market Detail Tour (`/market/[id]`) - *To be implemented*
**Storage Key**: `beright-market-detail-tour-completed`

Will guide users through:
1. **Market Overview** - Understanding odds, volume, liquidity
2. **Price Chart** - Reading probability changes over time
3. **Trade Panel** - Placing trades
4. **Liquidity Stats** - Checking available liquidity

## How to Use

### 1. Import Components

```typescript
import OnboardingTour, { useRestartTour } from '@/components/OnboardingTour';
import { getTourSteps } from '@/config/tour-steps';
```

### 2. Add Tour to Page

```typescript
export default function MyPage() {
  const { isDemo } = useMode();
  const restartTour = useRestartTour('my-tour-storage-key');

  return (
    <>
      {/* Only show in demo mode */}
      {isDemo && (
        <OnboardingTour
          steps={getTourSteps('terminal')} // or 'markets', 'market-detail'
          storageKey="my-tour-storage-key"
          onComplete={() => console.log('Tour completed!')}
          onSkip={() => console.log('Tour skipped')}
        />
      )}

      {/* Add restart button */}
      <button onClick={restartTour} title="Restart tour">
        ?
      </button>

      {/* Your page content with data-tour attributes */}
      <div data-tour="my-element-id">
        Element that will be highlighted
      </div>
    </>
  );
}
```

### 3. Add `data-tour` Attributes

Add `data-tour` attributes to elements you want to highlight:

```tsx
<div data-tour="cli-input">
  <CLIInput onCommand={handleCommand} />
</div>

<aside data-tour="agent-fleet">
  <AgentFleet agents={agents} />
</aside>

<div data-tour="signals-feed">
  <SignalsFeed signals={signals} />
</div>
```

### 4. Define Tour Steps

Add steps to `/src/config/tour-steps.ts`:

```typescript
export const MY_TOUR_STEPS: TourStep[] = [
  {
    id: 'step-1',
    target: '[data-tour="my-element"]', // CSS selector
    title: 'Welcome!',
    description: 'This is the first step of the tour.',
    placement: 'bottom', // top | bottom | left | right
    action: 'Try clicking the button', // Optional CTA
    highlightPadding: 12, // Optional padding around spotlight
  },
  {
    id: 'step-2',
    target: '[data-tour="another-element"]',
    title: 'Second Step',
    description: 'Here\'s another important feature.',
    placement: 'right',
  },
];
```

## Tour Step Options

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier for the step |
| `target` | string | ✓ | CSS selector for element to highlight |
| `title` | string | ✓ | Tooltip title |
| `description` | string | ✓ | Tooltip description text |
| `placement` | string | - | Tooltip position: `top`, `bottom`, `left`, `right` (default: `bottom`) |
| `action` | string | - | Optional CTA text (e.g., "Try swiping the card") |
| `highlightPadding` | number | - | Padding around highlighted element (default: 8px) |

## User Experience Flow

1. **First Visit**: User enters demo mode and connects wallet
2. **Auto-start**: Tour starts automatically after 1 second delay
3. **Step Navigation**: User clicks "Next" to progress through steps
4. **Spotlight**: Current element is highlighted with animated glow
5. **Tooltip**: Positioned intelligently near highlighted element
6. **Actions**: Optional CTAs guide users to try interactions
7. **Completion**: On last step, "Finish" button completes tour
8. **Persistence**: Tour completion saved to localStorage
9. **Restart**: "?" button in header allows replaying the tour

## Design Principles

### 1. **Show, Don't Tell**
Instead of explaining features, guide users to interact with them:
- ❌ "This is the CLI input where you can type commands"
- ✅ "Type '/hot' or ask a question in plain English"

### 2. **Explain WHY, Not Just WHAT**
Help users understand the value:
- ❌ "This is the agent fleet panel"
- ✅ "Four specialized agents work for you: SCOUT finds opportunities, ANALYST does deep research, TRADER executes trades, and WHALE tracks smart money"

### 3. **Progressive Disclosure**
Don't overwhelm users:
- Start with overview
- Then specific features
- End with encouraging them to explore

### 4. **Contextual Help**
Tours adapt to the page context:
- Terminal page → Terminal tour
- Markets page → Markets tour
- Market detail → Detail tour

## Technical Details

### Components

- **OnboardingTour** (`/src/components/OnboardingTour.tsx`) - Main tour component
- **OnboardingTour.module.css** - Tour styles with animations
- **tour-steps.ts** (`/src/config/tour-steps.ts`) - Tour step definitions
- **useRestartTour** - Hook to restart tours programmatically

### State Management

- Tour state managed via React useState
- Completion tracked in localStorage
- Tour starts on component mount if not completed
- Auto-positioning recalculates on scroll/resize

### Accessibility

- Keyboard navigation (ESC to skip)
- Focus management on active element
- High contrast spotlight (passes WCAG AA)
- Mobile-friendly tooltips

## Future Enhancements

- [ ] Keyboard shortcuts (Arrow keys for navigation)
- [ ] Voice-over support
- [ ] Analytics tracking for tour completion rates
- [ ] A/B testing different tour flows
- [ ] Video tutorials embedded in tooltips
- [ ] Interactive demos (e.g., simulated trades)
- [ ] Multi-language support
- [ ] Tour for each major feature release

## Testing

To test the tour:

1. Clear localStorage: `localStorage.removeItem('beright-terminal-tour-completed')`
2. Refresh page in demo mode
3. Tour should auto-start after 1 second
4. Test all navigation (Next, Previous, Skip)
5. Verify tooltip positioning on different screen sizes
6. Test restart functionality via "?" button

## Troubleshooting

### Tour doesn't start
- Check `isDemo === true`
- Check localStorage is cleared
- Verify `data-tour` attributes exist on target elements
- Check browser console for errors

### Tooltip positioned incorrectly
- Ensure target element is visible when step activates
- Adjust `highlightPadding` if too much/little space
- Try different `placement` option

### Element not highlighted
- Verify CSS selector in `target` is correct
- Check element exists in DOM when tour starts
- Use browser DevTools to test selector: `document.querySelector('[data-tour="my-element"]')`

---

**Built with ❤️ for BeRight demo users**
