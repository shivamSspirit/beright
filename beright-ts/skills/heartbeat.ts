/**
 * Heartbeat Skill for BeRight Protocol
 *
 * UPGRADED TO AGENTIC ARCHITECTURE
 *
 * Now integrates with the cognitive loop for truly autonomous operation:
 * - Cognitive Loop: perceive → deliberate → act → reflect
 * - Goal-driven behavior with persistent goals
 * - Episodic memory for learning from past actions
 * - Multi-agent coordination
 *
 * Legacy features (still active):
 * - Arbitrage scanning across 5 platforms
 * - Whale tracking with real SOL prices
 * - Price snapshot recording for real market movers
 * - Decision engine scoring for each opportunity
 * - On-chain audit logging of all decisions
 * - Self-calibration via Brier scores
 */

// CRITICAL: Load environment variables FIRST before any other imports
// This ensures all modules that read process.env get the correct values
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { SkillResponse, ArbitrageOpportunity } from '../types/index';
import { HEARTBEAT } from '../config/thresholds';
import { arbitrage } from './arbitrage';
import { whaleWatch } from './whale';
// Professional arbitrage monitor for early detection
import {
  heartbeatArbScan,
  arbSubscribers,
  setTelegramSender as setArbTelegramSender,
  broadcastOpportunityToSubscribers,
} from './arbMonitor';
import { sendTelegramMessage } from '../services/notificationDelivery';
import { recordSnapshot } from './priceTracker';
import { decide, DecisionInput } from './decisionEngine';
import { logHeartbeat } from './onchain';
import { getCalibrationStats } from './calibration';
import { timestamp, sleep } from './utils';
import { checkAndSendNotifications, generateArbAlerts, generateWhaleAlerts, queueAlerts } from './notifications';
import { checkAlerts as checkPriceAlerts, getPendingTriggers, formatTriggeredAlert } from './priceAlerts';
import { checkRules as checkAutoRules, getPendingExecutions } from './autoTrade';
import { refreshPositionPrices, getExpiringPositions } from './positions';
import { buildOnce as runBuilderOnce } from './buildLoop';
import { runProactiveAgent } from './proactiveAgent';
import * as fs from 'fs';

// Cognitive Loop Integration
import {
  runCognitiveLoopOnce,
  getCognitiveStateSummary,
  getCognitiveMetrics,
  injectSignal,
  addSignal,
  coordinate as coordinateAgents,
  getAgentsSummary,
} from '../lib/cognitive';

// Builder runs every 7 minutes
const BUILDER_INTERVAL = 7 * 60 * 1000;

// Cognitive Loop runs every 2 minutes
const COGNITIVE_INTERVAL = 2 * 60 * 1000;

interface HeartbeatState {
  lastArbScan: string | null;
  lastWhaleScan: string | null;
  lastResolutionCheck: string | null;
  lastMorningBrief: string | null;
  lastPriceSnapshot: string | null;
  lastNotificationCheck: string | null;
  lastPriceAlertCheck: string | null;
  lastAutoRuleCheck: string | null;
  lastPositionRefresh: string | null;
  lastBuilderRun: string | null;
  lastCognitiveRun: string | null;  // NEW: Cognitive loop timing
  lastAgentCoordination: string | null;  // NEW: Multi-agent coordination
  lastProArbScan: string | null;  // Professional arb monitor scan
  totalScans: number;
  totalArbsFound: number;
  totalWhaleAlerts: number;
  totalDecisions: number;
  totalAlertsQueued: number;
  totalPriceAlertsTriggered: number;
  totalAutoExecutions: number;
  totalBuilderRuns: number;
  totalCognitiveCycles: number;  // NEW: Track cognitive cycles
  totalProArbAlerts: number;  // Professional arb monitor alerts
  lastProactiveRun: string | null;  // Proactive agent scan
  totalProactiveAlerts: number;  // Proactive agent alerts sent
}

const STATE_FILE = path.join(process.cwd(), 'memory', 'heartbeat-state.json');
const PRICE_SNAPSHOT_INTERVAL = 5 * 60 * 1000; // every 5 minutes

/**
 * Load heartbeat state
 */
function loadState(): HeartbeatState {
  const defaults: HeartbeatState = {
    lastArbScan: null,
    lastWhaleScan: null,
    lastResolutionCheck: null,
    lastMorningBrief: null,
    lastPriceSnapshot: null,
    lastNotificationCheck: null,
    lastPriceAlertCheck: null,
    lastAutoRuleCheck: null,
    lastPositionRefresh: null,
    lastBuilderRun: null,
    lastCognitiveRun: null,
    lastAgentCoordination: null,
    lastProArbScan: null,
    totalScans: 0,
    totalArbsFound: 0,
    totalWhaleAlerts: 0,
    totalDecisions: 0,
    totalAlertsQueued: 0,
    totalPriceAlertsTriggered: 0,
    totalAutoExecutions: 0,
    totalBuilderRuns: 0,
    totalCognitiveCycles: 0,
    totalProArbAlerts: 0,
    lastProactiveRun: null,
    totalProactiveAlerts: 0,
  };
  try {
    if (fs.existsSync(STATE_FILE)) {
      const loaded = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      return {
        ...defaults,
        ...loaded,
        // Ensure counters are always numbers (fix legacy null/undefined)
        totalScans: loaded.totalScans ?? 0,
        totalArbsFound: loaded.totalArbsFound ?? 0,
        totalWhaleAlerts: loaded.totalWhaleAlerts ?? 0,
        totalDecisions: loaded.totalDecisions ?? 0,
        totalAlertsQueued: loaded.totalAlertsQueued ?? 0,
        totalBuilderRuns: loaded.totalBuilderRuns ?? 0,
        totalCognitiveCycles: loaded.totalCognitiveCycles ?? 0,
        totalProArbAlerts: loaded.totalProArbAlerts ?? 0,
      };
    }
  } catch (error) {
    console.error('Could not load heartbeat state:', error);
  }
  return defaults;
}

/**
 * Save heartbeat state
 */
function saveState(state: HeartbeatState): void {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Could not save heartbeat state:', error);
  }
}

/**
 * Check if interval has passed since last run
 */
function shouldRun(lastRun: string | null, intervalMs: number): boolean {
  if (!lastRun) return true;
  const elapsed = Date.now() - new Date(lastRun).getTime();
  return elapsed >= intervalMs;
}

/**
 * Record price snapshots for real market movers
 */
async function runPriceSnapshot(state: HeartbeatState): Promise<number> {
  if (!shouldRun(state.lastPriceSnapshot, PRICE_SNAPSHOT_INTERVAL)) {
    return 0;
  }

  console.log(`[${timestamp()}] Recording price snapshot...`);
  const count = await recordSnapshot();
  state.lastPriceSnapshot = timestamp();
  saveState(state);
  console.log(`  Recorded ${count} market prices`);
  return count;
}

/**
 * Run arbitrage scan + decision engine
 */
async function runArbScan(state: HeartbeatState): Promise<{ response: SkillResponse | null; arbsFound: number; decisionsLogged: number }> {
  if (!shouldRun(state.lastArbScan, HEARTBEAT.arbitrageScan)) {
    return { response: null, arbsFound: 0, decisionsLogged: 0 };
  }

  console.log(`[${timestamp()}] Running arbitrage scan across 5 platforms...`);
  const result = await arbitrage();

  state.lastArbScan = timestamp();
  state.totalScans++;
  saveState(state);

  const opportunities = (result.data as ArbitrageOpportunity[]) || [];
  let decisionsLogged = 0;

  if (opportunities.length > 0) {
    console.log(`  Found ${opportunities.length} arbitrage opportunities`);
    state.totalArbsFound += opportunities.length;
    saveState(state);

    // Queue arb alerts for subscribers
    const arbAlerts = generateArbAlerts(opportunities);
    if (arbAlerts.length > 0) {
      queueAlerts(arbAlerts);
      state.totalAlertsQueued += arbAlerts.length;
      console.log(`  Queued ${arbAlerts.length} arb alerts for subscribers`);
    }

    // Run decision engine on top opportunities
    for (const opp of opportunities.slice(0, 3)) {
      const input: DecisionInput = {
        topic: opp.topic,
        arbitrage: opp,
      };

      try {
        const decision = await decide(input);
        decisionsLogged++;
        state.totalDecisions++;

        console.log(`  Decision: ${decision.action} on "${opp.topic.slice(0, 40)}" (conf: ${decision.adjustedConfidence}%)`);
      } catch (err) {
        console.warn(`  Decision engine error: ${err instanceof Error ? err.message : err}`);
      }
    }

    saveState(state);
    return { response: result, arbsFound: opportunities.length, decisionsLogged };
  }

  console.log('  No arbitrage opportunities found');
  return { response: null, arbsFound: 0, decisionsLogged: 0 };
}

/**
 * Run whale scan
 */
async function runWhaleScan(state: HeartbeatState): Promise<{ response: SkillResponse | null; alertsFound: number }> {
  if (!shouldRun(state.lastWhaleScan, HEARTBEAT.whaleScan)) {
    return { response: null, alertsFound: 0 };
  }

  console.log(`[${timestamp()}] Running whale scan (real SOL price)...`);
  const result = await whaleWatch();

  state.lastWhaleScan = timestamp();
  saveState(state);

  const whaleMovements = (result.data as any[]) || [];
  if (whaleMovements.length > 0) {
    console.log(`  Found ${whaleMovements.length} whale alerts`);
    state.totalWhaleAlerts += whaleMovements.length;
    saveState(state);

    // Queue whale alerts for subscribers
    const whaleAlertsList = generateWhaleAlerts(whaleMovements);
    if (whaleAlertsList.length > 0) {
      queueAlerts(whaleAlertsList);
      state.totalAlertsQueued += whaleAlertsList.length;
      console.log(`  Queued ${whaleAlertsList.length} whale alerts for subscribers`);
    }

    return { response: result, alertsFound: whaleMovements.length };
  }

  console.log('  No whale activity detected');
  return { response: null, alertsFound: 0 };
}

/**
 * Run single heartbeat check — the full autonomous loop
 */
export async function heartbeatOnce(): Promise<SkillResponse[]> {
  const state = loadState();
  const alerts: SkillResponse[] = [];

  // 1. Record price snapshots (for real market movers)
  const marketsRecorded = await runPriceSnapshot(state);

  // 2. Run arbitrage scan + decision engine
  const arbResult = await runArbScan(state);
  if (arbResult.response) alerts.push(arbResult.response);

  // 3. Run whale scan (with real SOL price)
  const whaleResult = await runWhaleScan(state);
  if (whaleResult.response) alerts.push(whaleResult.response);

  // 3.5. Run PROFESSIONAL ARBITRAGE MONITOR (early detection)
  // This runs every 30 seconds for early opportunity detection
  const PRO_ARB_INTERVAL = 30 * 1000; // 30 seconds
  if (shouldRun(state.lastProArbScan, PRO_ARB_INTERVAL)) {
    try {
      console.log(`[${timestamp()}] Running professional arbitrage monitor...`);

      // Ensure telegram sender is configured
      setArbTelegramSender(async (chatId: string, message: string) => {
        const result = await sendTelegramMessage(chatId, message, { parseMode: 'Markdown' });
        if (!result.success) {
          throw new Error(result.error || 'Failed to send alert');
        }
      });

      const proArbResult = await heartbeatArbScan();

      state.lastProArbScan = timestamp();
      saveState(state);

      if (proArbResult.opportunities.length > 0) {
        console.log(`[${timestamp()}] 🚨 PRO ARB: ${proArbResult.opportunities.length} opportunities detected!`);
        state.totalProArbAlerts += proArbResult.opportunities.length;
        saveState(state);

        // AUTOMATICALLY SEND ALERTS TO ALL SUBSCRIBED TELEGRAM USERS
        for (const opp of proArbResult.opportunities) {
          try {
            const sentCount = await broadcastOpportunityToSubscribers(opp);
            if (sentCount > 0) {
              console.log(`[${timestamp()}] ✅ Sent arb alert to ${sentCount} subscribers`);
            }
          } catch (broadcastErr) {
            console.warn(`[${timestamp()}] Failed to broadcast opportunity:`, broadcastErr);
          }

          // Also add to alerts array for heartbeat response
          alerts.push({
            text: `
🚨 *ARBITRAGE OPPORTUNITY*
${'─'.repeat(35)}

📊 *${opp.currentProfit.toFixed(2)}% PROFIT*

${opp.pair.marketA.title.slice(0, 45)}

• ${opp.pair.marketA.platform} vs ${opp.pair.marketB.platform}
• Match: ${(opp.pair.equivalenceScore * 100).toFixed(0)}%
• Peak: ${opp.peakProfit.toFixed(2)}%

⚡ ACT FAST - Opportunities close quickly!
`,
            mood: 'ALERT',
            data: opp,
          });
        }
      } else {
        console.log(`[${timestamp()}] Pro arb scan: ${proArbResult.registrySize} pairs, no opportunities`);
      }
    } catch (err) {
      console.warn('Professional arb monitor failed:', err);
    }
  }

  // 4. Check and queue notifications (morning briefs, etc.)
  try {
    const notificationCount = await checkAndSendNotifications();
    if (notificationCount > 0) {
      console.log(`[${timestamp()}] Queued ${notificationCount} scheduled notifications`);
      state.lastNotificationCheck = timestamp();
      state.totalAlertsQueued += notificationCount;
      saveState(state);
    }
  } catch (err) {
    console.warn('Notification check failed:', err);
  }

  // 5. Check price alerts
  try {
    const triggeredAlerts = await checkPriceAlerts();
    if (triggeredAlerts.length > 0) {
      console.log(`[${timestamp()}] ${triggeredAlerts.length} price alerts triggered`);
      state.lastPriceAlertCheck = timestamp();
      state.totalPriceAlertsTriggered += triggeredAlerts.length;
      saveState(state);

      // Format and queue triggered alerts
      for (const trigger of triggeredAlerts) {
        alerts.push({
          text: formatTriggeredAlert(trigger),
          mood: 'ALERT',
          data: trigger,
        });
      }
    }
  } catch (err) {
    console.warn('Price alert check failed:', err);
  }

  // 6. Check auto-trade rules (stop-loss, take-profit, DCA)
  try {
    const executions = await checkAutoRules();
    if (executions.length > 0) {
      console.log(`[${timestamp()}] ${executions.length} auto-trade rules triggered`);
      state.lastAutoRuleCheck = timestamp();
      state.totalAutoExecutions += executions.length;
      saveState(state);

      // Log pending executions (actual execution requires confirmation)
      for (const exec of executions) {
        const emoji = exec.action === 'BUY' ? '' : exec.action === 'SELL' ? '' : '';
        alerts.push({
          text: `
*AUTO-TRADE TRIGGERED*
${'─'.repeat(35)}

${emoji} ${exec.type.replace('_', ' ').toUpperCase()}

Market: ${exec.market}
Action: ${exec.action} ${exec.direction || ''} $${exec.amount?.toFixed(2) || '?'}
Reason: ${exec.reason}

⚠️ Review and confirm in /autobet
`,
          mood: 'ALERT',
          data: exec,
        });
      }
    }
  } catch (err) {
    console.warn('Auto-trade rule check failed:', err);
  }

  // 7. Refresh position prices (every 5 minutes)
  if (shouldRun(state.lastPositionRefresh, 5 * 60 * 1000)) {
    try {
      const refreshed = await refreshPositionPrices();
      if (refreshed > 0) {
        console.log(`[${timestamp()}] Refreshed ${refreshed} position prices`);
      }
      state.lastPositionRefresh = timestamp();
      saveState(state);
    } catch (err) {
      console.warn('Position refresh failed:', err);
    }
  }

  // 8. Run COGNITIVE LOOP - The heart of the agentic system
  // This is what makes the system truly autonomous - it perceives,
  // deliberates, acts, and reflects without waiting for commands.
  if (shouldRun(state.lastCognitiveRun, COGNITIVE_INTERVAL)) {
    try {
      console.log(`[${timestamp()}] Running cognitive loop...`);

      // Inject signals from this heartbeat into the cognitive system
      if (arbResult.arbsFound > 0) {
        addSignal(
          'arbitrage_opportunity',
          'heartbeat',
          `Found ${arbResult.arbsFound} arbitrage opportunities`,
          Math.min(1, arbResult.arbsFound * 0.3)
        );
      }

      if (whaleResult.alertsFound > 0) {
        addSignal(
          'whale_activity',
          'heartbeat',
          `Detected ${whaleResult.alertsFound} whale movements`,
          Math.min(1, whaleResult.alertsFound * 0.2)
        );
      }

      // Run the cognitive cycle
      const cognitiveResult = await runCognitiveLoopOnce();

      state.lastCognitiveRun = timestamp();
      state.totalCognitiveCycles++;
      saveState(state);

      if (cognitiveResult.success) {
        console.log(`[${timestamp()}] Cognitive cycle completed: ${cognitiveResult.summary}`);

        // Check if cognitive loop generated any actionable insights
        const metrics = getCognitiveMetrics();
        if (metrics.goalsAchieved > 0) {
          alerts.push({
            text: `*COGNITIVE UPDATE*\n${cognitiveResult.summary}\n\nGoals achieved: ${metrics.goalsAchieved}`,
            mood: 'BULLISH',
            data: { cognitive: true, metrics },
          });
        }
      }
    } catch (err) {
      console.warn('Cognitive loop failed:', err);
    }
  }

  // 9. Run MULTI-AGENT COORDINATION - every 5 minutes
  if (shouldRun(state.lastAgentCoordination, 5 * 60 * 1000)) {
    try {
      console.log(`[${timestamp()}] Coordinating agents...`);

      const coordination = await coordinateAgents();
      state.lastAgentCoordination = timestamp();
      saveState(state);

      if (coordination.conflictsResolved > 0 || coordination.goalsReassigned > 0) {
        console.log(`[${timestamp()}] Agent coordination: ${coordination.conflictsResolved} conflicts resolved, ${coordination.goalsReassigned} goals reassigned`);
      }
    } catch (err) {
      console.warn('Agent coordination failed:', err);
    }
  }

  // 10. Run builder (autonomous code generation) - every 7 minutes
  if (shouldRun(state.lastBuilderRun, BUILDER_INTERVAL)) {
    try {
      console.log(`[${timestamp()}] Running autonomous builder...`);
      const builderResult = await runBuilderOnce();
      state.lastBuilderRun = timestamp();
      state.totalBuilderRuns++;
      saveState(state);

      if (builderResult.mood === 'BULLISH') {
        console.log(`[${timestamp()}] Builder completed tasks successfully`);
        alerts.push({
          text: `*BUILDER UPDATE*\n${builderResult.text.slice(0, 500)}`,
          mood: 'BULLISH',
          data: builderResult.data,
        });
      } else {
        console.log(`[${timestamp()}] Builder: ${builderResult.text.slice(0, 100)}`);
      }
    } catch (err) {
      console.warn('Builder run failed:', err);
    }
  }

  // 11. Run PROACTIVE AGENT - Smart alerts for subscribers
  // Scans markets for: closing soon, big movers, hot alpha, spread inefficiencies
  const PROACTIVE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  if (shouldRun(state.lastProactiveRun, PROACTIVE_INTERVAL)) {
    try {
      console.log(`[${timestamp()}] Running proactive agent...`);
      const proactiveResult = await runProactiveAgent();
      state.lastProactiveRun = timestamp();
      state.totalProactiveAlerts = (state.totalProactiveAlerts || 0) + proactiveResult.alertsSent;
      saveState(state);

      if (proactiveResult.alertsSent > 0) {
        console.log(`[${timestamp()}] Proactive agent: ${proactiveResult.alertsGenerated} alerts generated, ${proactiveResult.alertsSent} sent`);
      } else {
        console.log(`[${timestamp()}] Proactive agent: scanned ${proactiveResult.marketsScanned} markets, no alerts`);
      }
    } catch (err) {
      console.warn('Proactive agent failed:', err);
    }
  }

  // 12. Log heartbeat to chain
  const brierScore = getCalibrationStats().overallBrierScore;
  try {
    await logHeartbeat(
      marketsRecorded,
      arbResult.arbsFound,
      whaleResult.alertsFound,
      brierScore > 0 ? brierScore : undefined
    );
  } catch (err) {
    console.warn('Heartbeat on-chain log failed:', err);
  }

  return alerts;
}

/**
 * Run heartbeat loop — the autonomous agent
 */
export async function heartbeatLoop(intervalMs = 300000): Promise<never> {
  const state = loadState();

  console.log(`
${'='.repeat(60)}
  BERIGHT AUTONOMOUS AGENT
  Heartbeat interval: ${intervalMs / 1000}s
${'='.repeat(60)}

  === AGENTIC ARCHITECTURE ===
  Cognitive:  Perceive -> Deliberate -> Act -> Reflect
  Goals:      Persistent goal-driven behavior
  Memory:     Episodic learning from experiences
  Agents:     Scout, Analyst, Trader (coordinated)

  === DATA SOURCES ===
  Scanning: Polymarket, Kalshi, Manifold, Limitless, Metaculus
  Prices:   Pyth Hermes, Jupiter V6, DeFi Llama
  Chain:    Solana memo logging enabled
  Alerts:   Push notifications enabled

  === STATS ===
  Scans: ${state.totalScans} | Arbs: ${state.totalArbsFound} | Alerts: ${state.totalAlertsQueued}
  Pro Arb Alerts: ${state.totalProArbAlerts} | Cognitive Cycles: ${state.totalCognitiveCycles}

  Press Ctrl+C to stop
`);

  while (true) {
    try {
      const alerts = await heartbeatOnce();
      const updatedState = loadState();

      if (alerts.length > 0) {
        console.log(`\n${'='.repeat(50)}`);
        console.log('ALERTS GENERATED:');
        for (const alert of alerts) {
          console.log(alert.text.slice(0, 200) + '...');
        }
        console.log('='.repeat(50) + '\n');
      }

      console.log(`[${timestamp()}] Cycle complete. Scans: ${updatedState.totalScans} | Arbs: ${updatedState.totalArbsFound} | Alerts: ${updatedState.totalAlertsQueued}`);
    } catch (error) {
      console.error('Heartbeat error:', error);
    }

    console.log(`[${timestamp()}] Sleeping for ${intervalMs / 1000}s...`);
    await sleep(intervalMs);
  }
}

/**
 * Main heartbeat skill function (for OpenClaw cron trigger)
 */
export async function heartbeat(): Promise<SkillResponse> {
  const alerts = await heartbeatOnce();
  const state = loadState();

  if (alerts.length === 0) {
    return {
      text: `Heartbeat complete. No alerts.\nTotal: ${state.totalScans} scans, ${state.totalArbsFound} arbs found, ${state.totalDecisions} decisions logged.`,
      mood: 'NEUTRAL',
    };
  }

  return {
    text: alerts.map(a => a.text).join('\n\n---\n\n'),
    mood: 'ALERT',
    data: alerts,
  };
}

// CLI interface
if (process.argv[1]?.endsWith('heartbeat.ts')) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'once') {
    heartbeatOnce().then(alerts => {
      if (alerts.length === 0) {
        console.log('No alerts generated');
      } else {
        alerts.forEach(a => console.log(a.text));
      }
    });
  } else if (command === 'loop') {
    const interval = parseInt(args[1]) || 300;
    heartbeatLoop(interval * 1000);
  } else if (command === 'stats') {
    const state = loadState();
    console.log('Heartbeat Stats:');
    console.log(`  Total scans: ${state.totalScans}`);
    console.log(`  Arbs found: ${state.totalArbsFound}`);
    console.log(`  Pro arb alerts: ${state.totalProArbAlerts}`);
    console.log(`  Whale alerts: ${state.totalWhaleAlerts}`);
    console.log(`  Decisions logged: ${state.totalDecisions}`);
    console.log(`  Alerts queued: ${state.totalAlertsQueued}`);
    console.log(`  Builder runs: ${state.totalBuilderRuns}`);
    console.log(`  Last arb scan: ${state.lastArbScan || 'never'}`);
    console.log(`  Last pro arb scan: ${state.lastProArbScan || 'never'}`);
    console.log(`  Last whale scan: ${state.lastWhaleScan || 'never'}`);
    console.log(`  Last notification: ${state.lastNotificationCheck || 'never'}`);
    console.log(`  Last price snapshot: ${state.lastPriceSnapshot || 'never'}`);
    console.log(`  Last builder run: ${state.lastBuilderRun || 'never'}`);
  } else {
    console.log('Usage:');
    console.log('  ts-node heartbeat.ts once           - Run single check');
    console.log('  ts-node heartbeat.ts loop [seconds] - Run continuous loop');
    console.log('  ts-node heartbeat.ts stats           - View agent stats');
  }
}

export default heartbeat;
