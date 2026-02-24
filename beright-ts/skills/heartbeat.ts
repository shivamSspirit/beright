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
import {
  HeartbeatState,
  loadState,
  saveState,
  shouldRun,
  INTERVALS,
} from '../lib/orchestrator';
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

// Signal Intelligence Engine
import { runAllDetectors } from '../lib/signals/index';
import { routeAlerts as routeSignalAlerts, setAlertRouterSender } from '../lib/alertRouter';

// Momentum Score Engine
import { runMomentumUpdate } from '../lib/momentum';

// Social Listener
import { runSocialIngestion } from '../lib/social';

// Synthesis Agent
import { synthesizeReport, formatSynthesisForTelegram } from '../lib/synthesis';

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

// Interval constants — now defined in lib/orchestrator.ts, accessed via INTERVALS
const BUILDER_INTERVAL   = INTERVALS.builder;
const COGNITIVE_INTERVAL = INTERVALS.cognitive;
const PRICE_SNAPSHOT_INTERVAL = INTERVALS.priceSnapshot;
const MOMENTUM_INTERVAL  = INTERVALS.momentum;
const SOCIAL_INTERVAL    = INTERVALS.social;
const SYNTHESIS_INTERVAL = INTERVALS.synthesis;

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
          const urlA = opp.pair.marketA.url || '#';
          const urlB = opp.pair.marketB.url || '#';

          alerts.push({
            text: `
🚨 *ARBITRAGE OPPORTUNITY*
${'─'.repeat(35)}

📊 *${opp.currentProfit.toFixed(2)}% PROFIT*

${opp.pair.marketA.title.slice(0, 45)}

*${opp.pair.marketA.platform}:* [View →](${urlA})
*${opp.pair.marketB.platform}:* [View →](${urlB})

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

  // 11.5 Run SOCIAL INGESTION — fetch Twitter/Reddit mentions
  // Run BEFORE signal pipeline so fresh data is available for social_mention detector
  if (shouldRun(state.lastSocialRun, SOCIAL_INTERVAL)) {
    try {
      console.log(`[${timestamp()}] Running social ingestion...`);
      const socialResult = await runSocialIngestion();
      state.lastSocialRun = timestamp();
      state.totalSocialMentions = (state.totalSocialMentions || 0) + socialResult.mentionsSaved;
      saveState(state);

      if (socialResult.mentionsSaved > 0) {
        console.log(`[${timestamp()}] Social: ${socialResult.mentionsFetched} fetched, ${socialResult.mentionsSaved} saved, ${socialResult.marketsUpdated} markets`);

        // Inject into cognitive loop
        addSignal(
          'social_ingestion' as any,
          'social_listener',
          `Ingested ${socialResult.mentionsSaved} social mentions`,
          Math.min(1, socialResult.mentionsSaved / 30)
        );
      }
    } catch (err) {
      console.warn('[Social] Ingestion failed:', err instanceof Error ? err.message : err);
    }
  }

  // 12. Run SIGNAL INTELLIGENCE PIPELINE — the proactive alert engine
  // Every 5 minutes: run all 12 detectors (including social), evaluate with Groq Scout, push alerts
  const SIGNAL_INTERVAL = 5 * 60 * 1000;
  if (shouldRun(state.lastSignalRun, SIGNAL_INTERVAL)) {
    try {
      console.log(`[${timestamp()}] Running signal intelligence pipeline...`);

      // Wire up Telegram sender for alert routing
      setAlertRouterSender(async (chatId: string, message: string) => {
        const result = await sendTelegramMessage(chatId, message, { parseMode: 'Markdown' });
        if (!result.success) throw new Error(result.error || 'Send failed');
      });

      const signalResults = await runAllDetectors();
      state.lastSignalRun = timestamp();
      saveState(state);

      if (signalResults.length > 0) {
        const alertCount = await routeSignalAlerts(signalResults);
        state.totalSignalAlerts += alertCount;
        saveState(state);

        console.log(`[${timestamp()}] Signal intelligence: ${signalResults.length} signals, ${alertCount} alerts sent`);

        // Inject top signals into cognitive loop for awareness
        for (const sig of signalResults.filter(s => s.action === 'ALERT').slice(0, 3)) {
          addSignal(sig.type as any, 'signal_engine', sig.marketTitle, sig.strength);
        }
      } else {
        console.log(`[${timestamp()}] Signal intelligence: no actionable signals`);
      }
    } catch (err) {
      console.warn('[Signal Pipeline] Failed:', err instanceof Error ? err.message : err);
    }
  }

  // 13. Run MOMENTUM SCORE UPDATE — rank markets by activity
  // Every 5 minutes: calculate momentum scores for all active markets
  if (shouldRun(state.lastMomentumRun, MOMENTUM_INTERVAL)) {
    try {
      console.log(`[${timestamp()}] Running momentum score update...`);
      const momentumUpdated = await runMomentumUpdate();
      state.lastMomentumRun = timestamp();
      state.totalMomentumUpdates = (state.totalMomentumUpdates || 0) + momentumUpdated;
      saveState(state);

      if (momentumUpdated > 0) {
        console.log(`[${timestamp()}] Momentum: updated ${momentumUpdated} market scores`);

        // Inject momentum signal into cognitive loop
        addSignal(
          'momentum_update' as any,
          'momentum_engine',
          `Updated ${momentumUpdated} market momentum scores`,
          Math.min(1, momentumUpdated / 50)
        );
      }
    } catch (err) {
      console.warn('[Momentum] Update failed:', err instanceof Error ? err.message : err);
    }
  }

  // 13.5 Run SYNTHESIS AGENT — market intelligence report
  // Every 6 hours: synthesize signals into cohesive narrative
  if (shouldRun(state.lastSynthesisRun, SYNTHESIS_INTERVAL)) {
    try {
      console.log(`[${timestamp()}] Running synthesis agent...`);
      const report = await synthesizeReport();
      state.lastSynthesisRun = timestamp();

      if (report) {
        state.totalSynthesisReports = (state.totalSynthesisReports || 0) + 1;
        saveState(state);

        console.log(`[${timestamp()}] Synthesis: "${report.headline.slice(0, 60)}" (${report.signalsProcessed} signals)`);

        // Inject into cognitive loop
        addSignal(
          'synthesis_report' as any,
          'synthesis_agent',
          report.headline,
          0.8
        );

        // Add formatted report to alerts
        alerts.push({
          text: formatSynthesisForTelegram(report),
          mood: 'BULLISH',
          data: report,
        });
      }
    } catch (err) {
      console.warn('[Synthesis] Report failed:', err instanceof Error ? err.message : err);
    }
  }

  // 14. Log heartbeat to chain
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
    console.log(`  Signal alerts: ${state.totalSignalAlerts || 0}`);
    console.log(`  Momentum updates: ${state.totalMomentumUpdates || 0}`);
    console.log(`  Social mentions: ${state.totalSocialMentions || 0}`);
    console.log(`  Synthesis reports: ${state.totalSynthesisReports || 0}`);
    console.log(`  Last arb scan: ${state.lastArbScan || 'never'}`);
    console.log(`  Last pro arb scan: ${state.lastProArbScan || 'never'}`);
    console.log(`  Last whale scan: ${state.lastWhaleScan || 'never'}`);
    console.log(`  Last notification: ${state.lastNotificationCheck || 'never'}`);
    console.log(`  Last price snapshot: ${state.lastPriceSnapshot || 'never'}`);
    console.log(`  Last builder run: ${state.lastBuilderRun || 'never'}`);
    console.log(`  Last signal run: ${state.lastSignalRun || 'never'}`);
    console.log(`  Last momentum run: ${state.lastMomentumRun || 'never'}`);
    console.log(`  Last social run: ${state.lastSocialRun || 'never'}`);
    console.log(`  Last synthesis run: ${state.lastSynthesisRun || 'never'}`);
  } else {
    console.log('Usage:');
    console.log('  ts-node heartbeat.ts once           - Run single check');
    console.log('  ts-node heartbeat.ts loop [seconds] - Run continuous loop');
    console.log('  ts-node heartbeat.ts stats           - View agent stats');
  }
}

export default heartbeat;
