# Autonomous Prediction Agent

## Overview

BeRight Protocol's fully autonomous prediction agent operates 24/7 without human intervention. It scans markets, identifies opportunities, makes calibrated predictions, manages portfolio risk, and continuously improves through self-calibration.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTONOMOUS ORCHESTRATOR                       │
│                   (Master Controller - 24/7)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   SCANNER    │  │  PREDICTION  │  │   SELF-CALIBRATION   │  │
│  │              │──│    ENGINE    │──│       SYSTEM         │  │
│  │ Finds opps   │  │ Makes bets   │  │ Adjusts confidence   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   MARKET     │  │  PORTFOLIO   │  │     REPORTING        │  │
│  │   WATCHER    │  │   MANAGER    │  │      SERVICE         │  │
│  │ Auto-resolve │  │ Risk mgmt   │  │ Daily/weekly reports │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐                             │
│  │ NOTIFICATIONS│  │   ALERTS     │                             │
│  │   DELIVERY   │  │   SYSTEM     │                             │
│  └──────────────┘  └──────────────┘                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Autonomous Scanner
**File:** `services/autonomousScanner.ts`

Continuously scans prediction markets to find profitable opportunities:
- **Base Rate Divergence**: Identifies markets where price differs significantly from historical base rates
- **Volume Analysis**: Prioritizes high-volume markets for liquidity
- **Timing**: Flags markets closing soon for time-sensitive opportunities
- **Category Classification**: Categorizes markets (crypto, politics, economics, sports, tech, etc.)

**Opportunity Scoring:**
- Minimum score to act: 60/100
- Minimum divergence: 15%
- Minimum volume: 1,000
- Scans 50 markets per cycle

### 2. Auto-Prediction Engine
**File:** `services/autoPredictionEngine.ts`

Automatically makes predictions based on scanner opportunities:
- **Risk Management**: Max 10 predictions/day, max 3 per category
- **Edge Requirement**: Only acts when expected edge > 10%
- **Intelligence Validation**: Double-checks with AI intelligence system
- **Self-Adjustment**: Avoids categories with poor historical performance

**Configuration:**
```typescript
{
  minScoreToAct: 70,
  minConfidence: 'medium',
  maxPredictionsPerDay: 10,
  maxPerCategory: 3,
  minEdge: 0.10,
  predictionCooldownMs: 5 * 60 * 1000
}
```

### 3. Self-Calibration System
**File:** `services/selfCalibration.ts`

Continuously monitors and adjusts prediction parameters:
- **Calibration Buckets**: Tracks accuracy across probability ranges (0-20%, 20-40%, etc.)
- **Bias Detection**: Identifies overconfidence, direction bias, trend changes
- **Category Analysis**: Per-category performance tracking
- **Auto-Adjustment**: Gradually applies confidence multipliers

**Calibration Metrics:**
- Calibration Score (0-100, lower = better)
- Overconfidence Bias
- Direction Bias (YES/NO tendency)
- Recent Trend (improving/declining)

### 4. Portfolio Manager
**File:** `services/portfolioManager.ts`

Professional-grade portfolio management:
- **Position Tracking**: Real-time P&L for all active predictions
- **Risk Exposure**: Category concentration analysis
- **Diversification**: Ensures spread across categories
- **Exit Recommendations**: Take-profit (>30%), stop-loss (>-20%)

**Risk Thresholds:**
```typescript
{
  maxCategoryExposure: 0.40,      // No more than 40% in one category
  maxSinglePositionSize: 0.15,    // No single position > 15%
  takeProfitThreshold: 0.30,      // 30% gain
  stopLossThreshold: -0.20        // 20% loss
}
```

### 5. Autonomous Reporting
**File:** `services/autonomousReporting.ts`

Automated performance reporting:
- **Daily Reports**: Activity, performance, portfolio snapshot
- **Weekly Reports**: Trends, category breakdown, patterns
- **Real-time Dashboard**: Health indicators, alerts, recent activity

### 6. Autonomous Orchestrator
**File:** `services/autonomousOrchestrator.ts`

Master controller coordinating all subsystems:
- **Health Monitoring**: Checks all subsystems every minute
- **Auto-Recovery**: Restarts failed components
- **Emergency Stop**: Triggers on high Brier score or consecutive failures
- **Graceful Shutdown**: Handles SIGINT/SIGTERM properly

**Emergency Stop Conditions:**
- Brier score > 0.40
- 5+ consecutive health check failures
- Manual trigger

## Commands

### Full Autonomous Operation
```bash
# Start 24/7 autonomous agent
npm run autonomous

# Or directly
npm run orchestrator
```

### Individual Components
```bash
# Scanner
npm run scanner              # Scan once
npm run scanner:daemon       # Continuous scanning

# Prediction Engine
npm run autopredict          # One prediction cycle
npm run autopredict:daemon   # Continuous predictions
npm run autopredict:status   # Check status

# Calibration
npm run calibration          # Run calibration once
npm run calibration:daemon   # Continuous calibration

# Portfolio
npm run portfolio            # Portfolio summary
npm run portfolio:positions  # List all positions
npm run portfolio:exits      # Exit recommendations

# Reporting
npm run report:daily         # Generate daily report
npm run report:weekly        # Generate weekly report
npm run report:dashboard     # Real-time dashboard

# Orchestrator
npm run orchestrator         # Full autonomous mode
npm run orchestrator:status  # Check all subsystems
npm run orchestrator:report  # Operational report
```

## Configuration

### Environment Variables
```bash
# Required for autonomous operation
AUTONOMOUS_AGENT_USER_ID=autonomous-agent

# Database
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Notifications (optional)
TELEGRAM_BOT_TOKEN=your_bot_token
```

### Adjusting Parameters

**Scanner Configuration** (`services/autonomousScanner.ts`):
```typescript
const SCAN_CONFIG = {
  minOpportunityScore: 60,
  minDivergence: 0.15,
  minVolume: 1000,
  marketsPerScan: 50,
  focusCategories: []  // Empty = all categories
};
```

**Prediction Engine** (`services/autoPredictionEngine.ts`):
```typescript
const ENGINE_CONFIG = {
  minScoreToAct: 70,
  maxPredictionsPerDay: 10,
  maxPerCategory: 3,
  minEdge: 0.10
};
```

**Calibration** (`services/selfCalibration.ts`):
```typescript
const CALIBRATION_CONFIG = {
  minPredictions: 20,
  calibrationIntervalMs: 6 * 60 * 60 * 1000,  // 6 hours
  significantBiasThreshold: 0.10
};
```

## Data Flow

```
1. SCAN
   Scanner finds opportunities in prediction markets
   ↓
2. SCORE
   Each opportunity scored (divergence, volume, timing)
   ↓
3. FILTER
   Engine filters by risk rules and past performance
   ↓
4. VALIDATE
   Intelligence system double-checks analysis
   ↓
5. PREDICT
   Prediction committed on-chain via smartPredict
   ↓
6. TRACK
   Portfolio manager monitors position
   ↓
7. RESOLVE
   Market watcher auto-resolves when market closes
   ↓
8. LEARN
   Calibration system adjusts based on outcome
   ↓
9. REPORT
   Daily/weekly reports generated
```

## Monitoring

### Health Check
The orchestrator performs health checks every minute:
- All 8 subsystems checked for running status
- Error counts tracked per subsystem
- Degraded/unhealthy status triggers alerts

### Status Levels
- **Healthy**: All systems operational
- **Degraded**: 1-2 issues detected
- **Unhealthy**: 3+ issues, may trigger emergency stop

### Logs
All components log with prefixes:
- `[Orchestrator]` - Main controller
- `[Scanner]` - Market scanning
- `[AutoPredict]` - Prediction making
- `[Calibration]` - Self-calibration
- `[Portfolio]` - Portfolio management
- `[Reporting]` - Report generation

## Safety Features

1. **Daily Limits**: Max predictions per day prevents overexposure
2. **Category Limits**: Prevents concentration in single category
3. **Cooldown Period**: Minimum time between predictions
4. **Edge Requirements**: Only predicts when expected profit margin exists
5. **Intelligence Validation**: AI double-checks before predicting
6. **Emergency Stop**: Auto-stops on poor performance
7. **Graceful Shutdown**: Properly saves state on exit

## Performance Metrics

### Key Metrics Tracked
- **Brier Score**: Primary calibration metric (lower = better)
- **Win Rate**: Percentage of correct predictions
- **Category Performance**: Accuracy by market category
- **Calibration Score**: How well probabilities match outcomes
- **Portfolio P&L**: Unrealized profit/loss

### Target Performance
- Brier Score < 0.25 (good)
- Brier Score < 0.15 (excellent)
- Win Rate > 55% (better than random)
- Calibration Score < 20/100 (well-calibrated)

## Extending the System

### Adding New Categories
Edit `categorizeMarket()` in `autonomousScanner.ts`:
```typescript
if (lower.match(/your|keywords/)) return 'new_category';
```

### Custom Scoring
Override `scoreOpportunity()` to add custom scoring logic.

### New Data Sources
Add new market APIs in `lib/dflow/api.ts` and wire to scanner.

### Custom Reports
Extend `AutonomousReporting` class with new report types.

## Troubleshooting

### Agent Not Making Predictions
1. Check if daily limit reached: `npm run autopredict:status`
2. Check if categories exhausted
3. Check minimum score threshold
4. Review scanner output: `npm run scanner`

### High Brier Score
1. Run calibration: `npm run calibration`
2. Check avoided categories
3. Review recent predictions: `npm run learnings`
4. Consider pausing and reviewing strategy

### Subsystem Failures
1. Check orchestrator status: `npm run orchestrator:status`
2. Review error logs
3. Restart specific subsystem or full orchestrator

## License

Part of BeRight Protocol / OpenClaw project.
