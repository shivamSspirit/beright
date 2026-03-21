/**
 * BeRight Orchestrator
 *
 * Contains the autonomous cycle logic that was previously embedded in
 * skills/heartbeat.ts. Extracting here makes the cycle:
 *   1. Testable — import runOrchestratorCycle() without a live scheduler
 *   2. Reusable — other modules can trigger a cycle without starting the loop
 *   3. Composable — each step is an independently-importable function
 *
 * heartbeat.ts becomes a thin cron wrapper:
 *   setInterval(() => runOrchestratorCycle(deps), intervalMs)
 */

import * as fs from 'fs';
import * as path from 'path';
import { SkillResponse, ArbitrageOpportunity } from '../types/index';
import { HEARTBEAT } from '../config/thresholds';

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────

export interface HeartbeatState {
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
  lastCognitiveRun: string | null;
  lastAgentCoordination: string | null;
  lastProArbScan: string | null;
  lastProactiveRun: string | null;
  lastSignalRun: string | null;
  lastMomentumRun: string | null;  // NEW: Momentum engine
  lastSocialRun: string | null;    // NEW: Social listener
  lastSynthesisRun: string | null; // NEW: Synthesis agent
  totalScans: number;
  totalArbsFound: number;
  totalWhaleAlerts: number;
  totalDecisions: number;
  totalAlertsQueued: number;
  totalPriceAlertsTriggered: number;
  totalAutoExecutions: number;
  totalBuilderRuns: number;
  totalCognitiveCycles: number;
  totalProArbAlerts: number;
  totalProactiveAlerts: number;
  totalSignalAlerts: number;
  totalMomentumUpdates: number;  // NEW: Momentum engine
  totalSocialMentions: number;  // NEW: Social listener
  totalSynthesisReports: number; // NEW: Synthesis agent
}

const STATE_FILE = path.join(process.cwd(), 'memory', 'heartbeat-state.json');

const STATE_DEFAULTS: HeartbeatState = {
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
  lastProactiveRun: null,
  lastSignalRun: null,
  lastMomentumRun: null,  // NEW: Momentum engine
  lastSocialRun: null,    // NEW: Social listener
  lastSynthesisRun: null, // NEW: Synthesis agent
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
  totalProactiveAlerts: 0,
  totalSignalAlerts: 0,
  totalMomentumUpdates: 0,  // NEW: Momentum engine
  totalSocialMentions: 0,   // NEW: Social listener
  totalSynthesisReports: 0, // NEW: Synthesis agent
};

export function loadState(): HeartbeatState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const loaded = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as Partial<HeartbeatState>;
      return {
        ...STATE_DEFAULTS,
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
    console.error('[orchestrator] Could not load state:', error);
  }
  return { ...STATE_DEFAULTS };
}

export function saveState(state: HeartbeatState): void {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('[orchestrator] Could not save state:', error);
  }
}

/** Returns true if enough time has elapsed since the last run. */
export function shouldRun(lastRun: string | null, intervalMs: number): boolean {
  if (!lastRun) return true;
  return Date.now() - new Date(lastRun).getTime() >= intervalMs;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERVAL CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const INTERVALS = {
  priceSnapshot:      5  * 60 * 1000,   //  5 minutes
  proArb:             30 * 1000,         // 30 seconds
  proactive:          5  * 60 * 1000,   //  5 minutes
  signals:            5  * 60 * 1000,   //  5 minutes
  cognitive:          2  * 60 * 1000,   //  2 minutes
  agentCoordination:  5  * 60 * 1000,   //  5 minutes
  positionRefresh:    5  * 60 * 1000,   //  5 minutes
  builder:            7  * 60 * 1000,   //  7 minutes
  momentum:           5  * 60 * 1000,   //  5 minutes (NEW: Momentum engine)
  social:             5  * 60 * 1000,   //  5 minutes (NEW: Social listener)
  synthesis:          6  * 60 * 60 * 1000, //  6 hours (NEW: Synthesis agent)
  arb:                HEARTBEAT.arbitrageScan,
  whale:              HEARTBEAT.whaleScan,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// DEPENDENCY INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All scan/run functions that the orchestrator cycle needs.
 * heartbeat.ts wires these up at startup; tests can provide stubs.
 */
export interface OrchestratorDeps {
  arbitrageScan:        () => Promise<SkillResponse>;
  whaleScan:            () => Promise<SkillResponse>;
  proArbScan:           () => Promise<{ opportunities: { pair: { marketA: { title: string; url?: string; platform: string }; marketB: { url?: string; platform: string }; equivalenceScore: number }; currentProfit: number; peakProfit: number }[] }>;
  checkNotifications:   () => Promise<number>;
  checkPriceAlerts:     () => Promise<{ formattedText: string }[]>;
  checkAutoRules:       () => Promise<{ type: string; action: string; market: string; direction?: string; amount?: number; reason: string }[]>;
  refreshPositions:     () => Promise<number>;
  runCognitive:         () => Promise<{ success: boolean; summary: string }>;
  coordinateAgents:     () => Promise<{ conflictsResolved: number; goalsReassigned: number }>;
  runBuilder:           () => Promise<SkillResponse>;
  runProactiveAgent:    () => Promise<{ alertsSent: number; alertsGenerated: number; marketsScanned: number }>;
  runSignalPipeline:    () => Promise<{ action: string; type: string; marketTitle: string; strength: number }[]>;
  routeSignalAlerts:    (signals: unknown[]) => Promise<number>;
  recordPriceSnapshot:  () => Promise<number>;
  runMomentumUpdate:    () => Promise<number>;  // NEW: Momentum engine
  runSocialIngestion:   () => Promise<{ mentionsFetched: number; mentionsSaved: number; marketsUpdated: number }>;  // NEW: Social listener
  runSynthesis:         () => Promise<{ headline: string; signalsProcessed: number } | null>;  // NEW: Synthesis agent
  logHeartbeatOnChain:  (markets: number, arbs: number, whales: number, brier?: number) => Promise<void>;
  getBrierScore:        () => number;
  getCognitiveMetrics:  () => { goalsAchieved: number };
  addCognitiveSignal:   (type: string, source: string, desc: string, strength: number) => void;
  broadcastArbToSubs:   (opp: unknown) => Promise<number>;
  setArbSender:         (sender: (chatId: string, msg: string) => Promise<void>) => void;
  setSignalSender:      (sender: (chatId: string, msg: string) => Promise<void>) => void;
  sendTelegram:         (chatId: string, msg: string, opts?: { parseMode?: string }) => Promise<{ success: boolean; error?: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATOR CYCLE  (the former heartbeatOnce() body)
// ─────────────────────────────────────────────────────────────────────────────

export interface CycleResult {
  alerts: SkillResponse[];
  marketsRecorded: number;
  arbsFound: number;
  whaleAlerts: number;
}

/**
 * Run one full autonomous cycle. Call this from heartbeat.ts scheduler
 * or directly from tests with stubbed deps.
 */
export async function runOrchestratorCycle(
  deps: OrchestratorDeps,
  state: HeartbeatState,
): Promise<CycleResult> {
  const alerts: SkillResponse[] = [];
  const ts = () => new Date().toISOString();

  // ── 1. Price snapshots ──────────────────────────────────────────────────
  let marketsRecorded = 0;
  if (shouldRun(state.lastPriceSnapshot, INTERVALS.priceSnapshot)) {
    try {
      marketsRecorded = await deps.recordPriceSnapshot();
      state.lastPriceSnapshot = ts();
      saveState(state);
    } catch (err) {
      console.warn('[orchestrator] Price snapshot failed:', err);
    }
  }

  // ── 2. Arbitrage scan + decision engine ────────────────────────────────
  let arbsFound = 0;
  if (shouldRun(state.lastArbScan, INTERVALS.arb)) {
    try {
      const result = await deps.arbitrageScan();
      state.lastArbScan = ts();
      state.totalScans++;
      const opps = (result.data as ArbitrageOpportunity[]) || [];
      if (opps.length > 0) {
        arbsFound = opps.length;
        state.totalArbsFound += arbsFound;
        alerts.push(result);
      }
      saveState(state);
    } catch (err) {
      console.warn('[orchestrator] Arb scan failed:', err);
    }
  }

  // ── 3. Whale scan ───────────────────────────────────────────────────────
  let whaleAlerts = 0;
  if (shouldRun(state.lastWhaleScan, INTERVALS.whale)) {
    try {
      const result = await deps.whaleScan();
      state.lastWhaleScan = ts();
      const movements = (result.data as unknown[]) || [];
      if (movements.length > 0) {
        whaleAlerts = movements.length;
        state.totalWhaleAlerts += whaleAlerts;
        alerts.push(result);
      }
      saveState(state);
    } catch (err) {
      console.warn('[orchestrator] Whale scan failed:', err);
    }
  }

  // ── 3.5 Professional arbitrage monitor (30-second detection) ──────────
  if (shouldRun(state.lastProArbScan, INTERVALS.proArb)) {
    try {
      deps.setArbSender(async (chatId, msg) => {
        const r = await deps.sendTelegram(chatId, msg, { parseMode: 'Markdown' });
        if (!r.success) throw new Error(r.error || 'Send failed');
      });

      const proResult = await deps.proArbScan();
      state.lastProArbScan = ts();
      saveState(state);

      if (proResult.opportunities.length > 0) {
        state.totalProArbAlerts += proResult.opportunities.length;
        saveState(state);
        for (const opp of proResult.opportunities) {
          await deps.broadcastArbToSubs(opp).catch(() => undefined);
          alerts.push({
            text: `🚨 *ARBITRAGE* — ${opp.currentProfit.toFixed(2)}% profit on ${opp.pair.marketA.title.slice(0, 45)}`,
            mood: 'ALERT',
            data: opp,
          });
        }
      }
    } catch (err) {
      console.warn('[orchestrator] Pro arb monitor failed:', err);
    }
  }

  // ── 4. Notifications ────────────────────────────────────────────────────
  try {
    const count = await deps.checkNotifications();
    if (count > 0) {
      state.lastNotificationCheck = ts();
      state.totalAlertsQueued += count;
      saveState(state);
    }
  } catch (err) {
    console.warn('[orchestrator] Notification check failed:', err);
  }

  // ── 5. Price alerts ─────────────────────────────────────────────────────
  try {
    const triggered = await deps.checkPriceAlerts();
    if (triggered.length > 0) {
      state.lastPriceAlertCheck = ts();
      state.totalPriceAlertsTriggered += triggered.length;
      saveState(state);
      for (const t of triggered) {
        alerts.push({ text: t.formattedText, mood: 'ALERT', data: t });
      }
    }
  } catch (err) {
    console.warn('[orchestrator] Price alert check failed:', err);
  }

  // ── 6. Auto-trade rules ─────────────────────────────────────────────────
  try {
    const executions = await deps.checkAutoRules();
    if (executions.length > 0) {
      state.lastAutoRuleCheck = ts();
      state.totalAutoExecutions += executions.length;
      saveState(state);
      for (const exec of executions) {
        alerts.push({
          text: `*AUTO-TRADE* — ${exec.type.replace('_', ' ')} on ${exec.market}: ${exec.action} ${exec.direction || ''} $${exec.amount?.toFixed(2) || '?'}\n${exec.reason}`,
          mood: 'ALERT',
          data: exec,
        });
      }
    }
  } catch (err) {
    console.warn('[orchestrator] Auto-trade check failed:', err);
  }

  // ── 7. Position refresh ─────────────────────────────────────────────────
  if (shouldRun(state.lastPositionRefresh, INTERVALS.positionRefresh)) {
    try {
      await deps.refreshPositions();
      state.lastPositionRefresh = ts();
      saveState(state);
    } catch (err) {
      console.warn('[orchestrator] Position refresh failed:', err);
    }
  }

  // ── 8. Cognitive loop ───────────────────────────────────────────────────
  if (shouldRun(state.lastCognitiveRun, INTERVALS.cognitive)) {
    try {
      if (arbsFound > 0) deps.addCognitiveSignal('arbitrage_opportunity', 'heartbeat', `${arbsFound} arb opps`, Math.min(1, arbsFound * 0.3));
      if (whaleAlerts > 0) deps.addCognitiveSignal('whale_activity', 'heartbeat', `${whaleAlerts} whale movements`, Math.min(1, whaleAlerts * 0.2));

      const cogResult = await deps.runCognitive();
      state.lastCognitiveRun = ts();
      state.totalCognitiveCycles++;
      saveState(state);

      if (cogResult.success) {
        const metrics = deps.getCognitiveMetrics();
        if (metrics.goalsAchieved > 0) {
          alerts.push({ text: `*COGNITIVE* — ${cogResult.summary} (${metrics.goalsAchieved} goals achieved)`, mood: 'BULLISH', data: { cognitive: true } });
        }
      }
    } catch (err) {
      console.warn('[orchestrator] Cognitive loop failed:', err);
    }
  }

  // ── 9. Multi-agent coordination ─────────────────────────────────────────
  if (shouldRun(state.lastAgentCoordination, INTERVALS.agentCoordination)) {
    try {
      await deps.coordinateAgents();
      state.lastAgentCoordination = ts();
      saveState(state);
    } catch (err) {
      console.warn('[orchestrator] Agent coordination failed:', err);
    }
  }

  // ── 10. Builder DISABLED - saves ~$2,880/mo in LLM costs ────────────────
  // Re-enable when needed for autonomous code generation
  // if (shouldRun(state.lastBuilderRun, INTERVALS.builder)) {
  //   try {
  //     const builderResult = await deps.runBuilder();
  //     state.lastBuilderRun = ts();
  //     state.totalBuilderRuns++;
  //     saveState(state);
  //     if (builderResult.mood === 'BULLISH') {
  //       alerts.push({ text: `*BUILDER* — ${builderResult.text.slice(0, 500)}`, mood: 'BULLISH', data: builderResult.data });
  //     }
  //   } catch (err) {
  //     console.warn('[orchestrator] Builder failed:', err);
  //   }
  // }

  // ── 11. Proactive agent ─────────────────────────────────────────────────
  if (shouldRun(state.lastProactiveRun, INTERVALS.proactive)) {
    try {
      const proResult = await deps.runProactiveAgent();
      state.lastProactiveRun = ts();
      state.totalProactiveAlerts = (state.totalProactiveAlerts || 0) + proResult.alertsSent;
      saveState(state);
    } catch (err) {
      console.warn('[orchestrator] Proactive agent failed:', err);
    }
  }

  // ── 11.5 Social ingestion (fetch Twitter/Reddit) ────────────────────────
  // Run BEFORE signal pipeline so fresh mentions are available for social_mention detector
  if (shouldRun(state.lastSocialRun, INTERVALS.social)) {
    try {
      const socialResult = await deps.runSocialIngestion();
      state.lastSocialRun = ts();
      state.totalSocialMentions = (state.totalSocialMentions || 0) + socialResult.mentionsSaved;
      saveState(state);

      if (socialResult.mentionsSaved > 0) {
        deps.addCognitiveSignal('social_ingestion', 'social_listener', `${socialResult.mentionsSaved} mentions, ${socialResult.marketsUpdated} markets`, Math.min(1, socialResult.mentionsSaved / 30));
      }
    } catch (err) {
      console.warn('[orchestrator] Social ingestion failed:', err);
    }
  }

  // ── 12. Signal intelligence pipeline ────────────────────────────────────
  if (shouldRun(state.lastSignalRun, INTERVALS.signals)) {
    try {
      deps.setSignalSender(async (chatId, msg) => {
        const r = await deps.sendTelegram(chatId, msg, { parseMode: 'Markdown' });
        if (!r.success) throw new Error(r.error || 'Send failed');
      });

      const signals = await deps.runSignalPipeline();
      state.lastSignalRun = ts();
      saveState(state);

      if (signals.length > 0) {
        const alertCount = await deps.routeSignalAlerts(signals);
        state.totalSignalAlerts += alertCount;
        saveState(state);

        for (const sig of signals.filter(s => s.action === 'ALERT').slice(0, 3)) {
          deps.addCognitiveSignal(sig.type, 'signal_engine', sig.marketTitle, sig.strength);
        }
      }
    } catch (err) {
      console.warn('[orchestrator] Signal pipeline failed:', err);
    }
  }

  // ── 13. Momentum score update ─────────────────────────────────────────────
  let momentumUpdated = 0;
  if (shouldRun(state.lastMomentumRun, INTERVALS.momentum)) {
    try {
      momentumUpdated = await deps.runMomentumUpdate();
      state.lastMomentumRun = ts();
      state.totalMomentumUpdates = (state.totalMomentumUpdates || 0) + momentumUpdated;
      saveState(state);

      if (momentumUpdated > 0) {
        deps.addCognitiveSignal('momentum_update', 'momentum_engine', `${momentumUpdated} markets scored`, Math.min(1, momentumUpdated / 50));
      }
    } catch (err) {
      console.warn('[orchestrator] Momentum update failed:', err);
    }
  }

  // ── 13.5 Synthesis agent (every 6 hours) ─────────────────────────────────
  if (shouldRun(state.lastSynthesisRun, INTERVALS.synthesis)) {
    try {
      const synthesisResult = await deps.runSynthesis();
      state.lastSynthesisRun = ts();
      if (synthesisResult) {
        state.totalSynthesisReports = (state.totalSynthesisReports || 0) + 1;
        saveState(state);

        deps.addCognitiveSignal('synthesis_report', 'synthesis_agent', synthesisResult.headline, 0.8);

        alerts.push({
          text: `*SYNTHESIS REPORT*\n${synthesisResult.headline}\n_${synthesisResult.signalsProcessed} signals analyzed_`,
          mood: 'BULLISH',
          data: synthesisResult,
        });
      }
    } catch (err) {
      console.warn('[orchestrator] Synthesis failed:', err);
    }
  }

  // ── 14. On-chain heartbeat log ───────────────────────────────────────────
  try {
    await deps.logHeartbeatOnChain(
      marketsRecorded,
      arbsFound,
      whaleAlerts,
      deps.getBrierScore() || undefined,
    );
  } catch (err) {
    console.warn('[orchestrator] On-chain log failed:', err);
  }

  return { alerts, marketsRecorded, arbsFound, whaleAlerts };
}
