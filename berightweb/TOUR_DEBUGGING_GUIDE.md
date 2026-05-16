# Onboarding Tour Debugging Guide

## Not Seeing Tooltips? Follow These Steps

### Step 1: Open Browser Console

1. Open your browser (Chrome/Firefox/Safari)
2. Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
3. Click on the "Console" tab

### Step 2: Navigate to Terminal in Demo Mode

1. Go to `http://localhost:3000/beright-terminal`
2. Make sure you're in **demo mode**
3. Connect your wallet (Jupe wallet adapter with devnet)

### Step 3: Check Console Logs

Look for these log messages:

#### Expected Logs:

```
[BeRightTerminal] Tour conditions: {
  isDemo: true,
  authenticated: true,
  ready: true,
  willShowTour: true
}
```

```
[OnboardingTour] Initialization: {
  storageKey: "beright-terminal-tour-completed",
  completed: null,
  forceShow: false,
  willShow: true,
  stepsCount: 7
}
```

```
[OnboardingTour] Starting tour in 1 second...
```

```
[OnboardingTour] Tour activated!
```

```
[OnboardingTour] Step 1 : {
  stepId: "welcome-terminal",
  selector: "[data-tour=\"terminal-main\"]",
  elementFound: true,
  tooltipRef: true
}
```

### Step 4: Common Issues & Fixes

#### Issue 1: `isDemo: false`

**Problem**: Tour only works in demo mode
**Fix**:
1. Check your mode context
2. Ensure demo mode is enabled in your app settings

#### Issue 2: `authenticated: false`

**Problem**: Tour requires wallet connection
**Fix**:
1. Connect your Solana wallet
2. Make sure wallet adapter is working
3. Check for wallet connection errors in console

#### Issue 3: `completed: "true"`

**Problem**: Tour was already completed
**Fix**:
Clear localStorage:
```javascript
localStorage.removeItem('beright-terminal-tour-completed')
```
Then refresh the page.

#### Issue 4: `elementFound: false`

**Problem**: Target element not found
**Fix**:
Check the console for:
```
[OnboardingTour] Target element not found: [data-tour="terminal-main"]
[OnboardingTour] Available elements with data-tour: ["agent-fleet", "portfolio-sidebar", ...]
```

If `terminal-main` is missing, it means the component hasn't rendered yet. This is timing issue.

#### Issue 5: `stepsCount: 0`

**Problem**: No tour steps loaded
**Fix**:
Check if `/src/config/tour-steps.ts` is importing correctly

### Step 5: Force Show Tour (For Testing)

To bypass all checks and force the tour to show:

1. Open `/src/app/beright-terminal/v3/BeRightTerminal.tsx`
2. Find this line:
```tsx
forceShow={false} // Set to true to always show tour for testing
```
3. Change it to:
```tsx
forceShow={true} // Set to true to always show tour for testing
```
4. Save and refresh

The tour will now **always** show, regardless of localStorage or other conditions.

### Step 6: Check CSS Loading

If the tour activates but you don't see any visual elements:

1. Open DevTools → Elements
2. Look for elements with class `.overlay` or `.tooltip`
3. Check if CSS is loaded:
   - Right-click on element → Inspect
   - Check "Styles" panel
   - Look for `OnboardingTour.module.css` styles

If styles are missing:
- Clear Next.js cache: `rm -rf .next`
- Restart dev server: `npm run dev`

### Step 7: Timing Issues

If elements are sometimes found and sometimes not:

**Problem**: Target elements render after tour initializes

**Fix**: Increase delay in `OnboardingTour.tsx`:
```tsx
setTimeout(() => {
  setIsActive(true);
}, 2000); // Changed from 1000ms to 2000ms
```

### Step 8: Check Network Tab

1. Open DevTools → Network tab
2. Refresh page
3. Look for:
   - `OnboardingTour.module.css` - Should load successfully
   - `tour-steps.ts` - Should be in bundle
   - No 404 errors

### Quick Checklist

- [ ] Browser console is open
- [ ] On `/beright-terminal` page
- [ ] In demo mode (`isDemo: true`)
- [ ] Wallet connected (`authenticated: true`)
- [ ] localStorage cleared or `forceShow={true}`
- [ ] Console shows tour activation logs
- [ ] No JavaScript errors in console
- [ ] CSS files are loading
- [ ] Target elements exist (check data-tour attributes)

## Still Not Working?

### Last Resort: Manual Test

Add this to `BeRightTerminal.tsx` right after `return (`:

```tsx
return (
  <div className={styles.terminalPage}>
    {/* TEST: Always show tour */}
    <OnboardingTour
      steps={[
        {
          id: 'test',
          target: 'body', // Target body element (always exists)
          title: 'Test Tooltip',
          description: 'If you see this, the tour system is working!',
          placement: 'bottom',
        },
      ]}
      storageKey="test-tour"
      forceShow={true}
      debug={true}
    />
    {/* Rest of your code... */}
```

If this shows a tooltip, the tour system works. The issue is with:
1. Target element selectors
2. Tour conditions (isDemo, authenticated)
3. localStorage blocking

### Get More Help

If still stuck, share these from console:
1. All `[BeRightTerminal]` logs
2. All `[OnboardingTour]` logs
3. Any JavaScript errors
4. Screenshot of Elements panel showing data-tour attributes
5. Your browser/OS version

## Common Next.js Issues

### Hot Reload Not Updating

```bash
# Kill dev server
# Delete .next folder
rm -rf .next

# Restart
npm run dev
```

### Module Not Found

```bash
# Clear node modules
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

### TypeScript Errors

```bash
# Check types
npx tsc --noEmit

# If errors, fix them before testing tour
```

---

**Debug mode is enabled by default now**, so all logs should appear automatically.

Good luck! 🚀
