/**
 * Heartbeat Writer - Dynamic HEARTBEAT.md updates for BeRight
 *
 * Updates HEARTBEAT.md with real-time agent state:
 * - Active goals and their status
 * - Pending signals awaiting processing
 * - Agent status summary
 * - Heartbeat metrics
 */

import * as fs from 'fs';
import * as path from 'path';
import { loadState } from '../orchestrator';
import { getUnprocessedSignals, getCalibrationMetrics } from './worldState';
import { getActiveGoals, getGoalStats } from './goalManager';

/**
 * Update HEARTBEAT.md with current agent state
 */
export function updateHeartbeatMD(): void {
  try {
    const state = loadState();
    const signals = getUnprocessedSignals() || [];
    const goals = getActiveGoals() || [];
    const goalStats = getGoalStats();
    const calibration = getCalibrationMetrics();

    // Format signals list
    const signalsList = signals.length > 0
      ? signals.slice(0, 5).map(s =>
          `- [${s.type}] ${(s.content || '').slice(0, 50)}... (strength: ${(s.strength * 100).toFixed(0)}%)`
        ).join('\n')
      : 'No pending signals.';

    // Format goals list
    const goalsList = goals.length > 0
      ? goals.slice(0, 5).map(g =>
          `- [${g.priority}] ${g.description} (${g.status})`
        ).join('\n')
      : 'No active goals.';

    // Calculate agent status based on recent activity
    const now = Date.now();
    const isActive = (timestamp: string | null | undefined) => {
      if (!timestamp) return false;
      const parsed = Date.parse(timestamp);
      return !isNaN(parsed) && (now - parsed) < 10 * 60 * 1000; // Active if within 10 min
    };

    const scoutStatus = isActive(state.lastArbScan) ? 'active' : 'idle';
    const analystStatus = isActive(state.lastCognitiveRun) ? 'active' : 'idle';
    const traderStatus = isActive(state.lastAutoRuleCheck) ? 'active' : 'idle';
    const builderStatus = isActive(state.lastBuilderRun) ? 'active' : 'idle';

    const content = `# BeRight Agent Heartbeat Checklist

*This file is read by the BeRight heartbeat mechanism every 30 minutes.*
*The agent uses this to determine what needs attention.*

**Last Updated:** ${new Date().toISOString()}
**System Health:** ${goals.length > 0 || signals.length > 0 ? 'ACTIVE' : 'IDLE'}

## Current Focus

${goals.length > 0 ? goals[0].description : 'No active goals. Consider generating proactive opportunities.'}

## Pending Signals (${signals.length})

${signalsList}

## Active Goals (${goals.length})

${goalsList}

## Heartbeat Metrics

| Metric | Value |
|--------|-------|
| Total Scans | ${state.totalScans || 0} |
| Arbs Found | ${state.totalArbsFound || 0} |
| Pro Arb Alerts | ${state.totalProArbAlerts || 0} |
| Whale Alerts | ${state.totalWhaleAlerts || 0} |
| Cognitive Cycles | ${state.totalCognitiveCycles || 0} |
| Signal Alerts | ${state.totalSignalAlerts || 0} |
| Builder Runs | ${state.totalBuilderRuns || 0} |

## Calibration

- **Brier Score:** ${calibration.brierScore.toFixed(3)} ${calibration.brierScore < 0.20 ? '(Good)' : calibration.brierScore < 0.25 ? '(Average)' : '(Needs Improvement)'}
- **Accuracy:** ${(calibration.accuracy * 100).toFixed(1)}%
- **Predictions:** ${calibration.count}

## Goal Statistics

- Total Created: ${goalStats.totalCreated}
- Achieved: ${goalStats.achieved}
- Failed: ${goalStats.failed}
- Abandoned: ${goalStats.abandoned}
- Current Active: ${goalStats.active}

## Instructions for Heartbeat

When this file is loaded during heartbeat:

1. **Check Cognitive State**
   - Run the cognitive loop: perceive -> deliberate -> act -> reflect
   - Process any unprocessed signals
   - Evaluate outcomes of past actions

2. **Monitor for Opportunities**
   - Check for arbitrage opportunities > 3% spread
   - Monitor whale activity > $10,000 value
   - Review position risk (> 10% loss)
   - Check for price alert triggers

3. **Goal Management**
   - Review active goals and their priorities
   - Generate proactive goals from opportunities
   - Delegate goals to appropriate internal capabilities (Scout, Analyst, Trader)

4. **Learning & Reflection**
   - Analyze recent episodes for patterns
   - Detect cognitive biases
   - Update calibration based on prediction outcomes
   - Sync lessons to MEMORY.md

## Alert Criteria

Generate an alert (don't return HEARTBEAT_OK) if:

- Arbitrage opportunity > 3% spread detected
- Whale movement > $10,000 value
- Position at > 10% loss
- Price alert triggered
- Prediction resolved (for calibration update)
- Goal completed or failed
- Cognitive bias detected requiring correction

## Agent Status

### Scout Agent
- Role: Fast market scanning, arbitrage detection
- Status: ${scoutStatus}
- Last Scan: ${state.lastArbScan || 'never'}

### Analyst Agent
- Role: Deep research, probability estimation
- Status: ${analystStatus}
- Last Run: ${state.lastCognitiveRun || 'never'}

### Trader Agent
- Role: Trade execution, risk management
- Status: ${traderStatus}
- Last Check: ${state.lastAutoRuleCheck || 'never'}

### Builder Agent
- Role: Autonomous code generation
- Status: ${builderStatus}
- Last Build: ${state.lastBuilderRun || 'never'}

---

*Updated automatically by the heartbeat system.*
`;

    const heartbeatPath = path.join(process.cwd(), 'HEARTBEAT.md');
    fs.writeFileSync(heartbeatPath, content);
    console.log('[HeartbeatWriter] Updated HEARTBEAT.md');
  } catch (error) {
    console.warn('[HeartbeatWriter] Failed to update HEARTBEAT.md:', error);
  }
}

export default { updateHeartbeatMD };
