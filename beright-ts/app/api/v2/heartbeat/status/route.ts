/**
 * Heartbeat Status API v2
 *
 * Returns comprehensive health status of the autonomous heartbeat loop,
 * including cognitive system metrics and agent coordination state.
 *
 * @author BeRight Protocol
 */

import { NextResponse } from 'next/server';
import {
  loadState,
  HeartbeatState,
  INTERVALS,
} from '../../../../../lib/orchestrator';

// Lazy load cognitive module to avoid blocking
async function getCognitiveData() {
  try {
    const cognitive = await import('../../../../../lib/cognitive');
    return {
      metrics: cognitive.getCognitiveMetrics(),
      stateSummary: cognitive.getCognitiveStateSummary(),
      agentsSummary: cognitive.getAgentsSummary(),
      worldStateSummary: cognitive.getWorldStateSummary(),
      goalStats: cognitive.getGoalStats(),
      memorySummary: cognitive.getMemorySummary(),
    };
  } catch (err) {
    console.warn('[API v2/heartbeat/status] Cognitive module error:', err);
    return null;
  }
}

/**
 * Calculate staleness level based on last run time
 */
function getStaleness(lastRun: string | null, intervalMs: number): {
  status: 'fresh' | 'stale' | 'critical';
  elapsedMs: number | null;
  missedCycles: number;
} {
  if (!lastRun) {
    return { status: 'critical', elapsedMs: null, missedCycles: -1 };
  }

  const elapsedMs = Date.now() - new Date(lastRun).getTime();
  const missedCycles = Math.floor(elapsedMs / intervalMs);

  if (missedCycles === 0) {
    return { status: 'fresh', elapsedMs, missedCycles: 0 };
  } else if (missedCycles <= 2) {
    return { status: 'stale', elapsedMs, missedCycles };
  } else {
    return { status: 'critical', elapsedMs, missedCycles };
  }
}

/**
 * Determine overall system health from component statuses
 */
function getOverallHealth(state: HeartbeatState): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
} {
  const issues: string[] = [];

  // Check core components
  const cognitiveStale = getStaleness(state.lastCognitiveRun, INTERVALS.cognitive);
  const arbStale = getStaleness(state.lastArbScan, INTERVALS.arb);
  const signalStale = getStaleness(state.lastSignalRun, INTERVALS.signals);

  if (cognitiveStale.status === 'critical') {
    issues.push('Cognitive loop not running');
  }
  if (arbStale.status === 'critical') {
    issues.push('Arbitrage scanner not running');
  }
  if (signalStale.status === 'critical') {
    issues.push('Signal pipeline not running');
  }

  // Determine overall status
  if (issues.length === 0) {
    return { status: 'healthy', issues: [] };
  } else if (issues.length <= 2) {
    return { status: 'degraded', issues };
  } else {
    return { status: 'unhealthy', issues };
  }
}

/**
 * GET /api/v2/heartbeat/status
 *
 * Returns comprehensive heartbeat and autonomous loop status.
 */
export async function GET() {
  try {
    const startTime = Date.now();
    const state = loadState();
    const overall = getOverallHealth(state);

    // Get cognitive system metrics (with timeout protection)
    const cognitivePromise = getCognitiveData();
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
    const cognitiveData = await Promise.race([cognitivePromise, timeoutPromise]);

    const cognitiveMetrics = cognitiveData?.metrics ?? null;
    const cognitiveStateSummary = cognitiveData?.stateSummary ?? 'Not loaded';
    const agentsSummary = cognitiveData?.agentsSummary ?? 'Not loaded';
    const worldStateSummary = cognitiveData?.worldStateSummary ?? 'Not loaded';
    const goalStats = cognitiveData?.goalStats ?? null;
    const memorySummary = cognitiveData?.memorySummary ?? 'Not loaded';

    // Build component status
    const components = {
      cognitive: {
        lastRun: state.lastCognitiveRun,
        staleness: getStaleness(state.lastCognitiveRun, INTERVALS.cognitive),
        totalCycles: state.totalCognitiveCycles,
        metrics: cognitiveMetrics,
        summary: cognitiveStateSummary,
      },
      arbitrage: {
        lastScan: state.lastArbScan,
        staleness: getStaleness(state.lastArbScan, INTERVALS.arb),
        totalScans: state.totalScans,
        totalArbsFound: state.totalArbsFound,
        lastProArbScan: state.lastProArbScan,
        totalProArbAlerts: state.totalProArbAlerts,
      },
      whale: {
        lastScan: state.lastWhaleScan,
        staleness: getStaleness(state.lastWhaleScan, INTERVALS.whale),
        totalAlerts: state.totalWhaleAlerts,
      },
      signals: {
        lastRun: state.lastSignalRun,
        staleness: getStaleness(state.lastSignalRun, INTERVALS.signals),
        totalAlerts: state.totalSignalAlerts,
      },
      momentum: {
        lastRun: state.lastMomentumRun,
        staleness: getStaleness(state.lastMomentumRun, INTERVALS.momentum),
        totalUpdates: state.totalMomentumUpdates,
      },
      social: {
        lastRun: state.lastSocialRun,
        staleness: getStaleness(state.lastSocialRun, INTERVALS.social),
        totalMentions: state.totalSocialMentions,
      },
      synthesis: {
        lastRun: state.lastSynthesisRun,
        staleness: getStaleness(state.lastSynthesisRun, INTERVALS.synthesis),
        totalReports: state.totalSynthesisReports,
      },
      proactive: {
        lastRun: state.lastProactiveRun,
        staleness: getStaleness(state.lastProactiveRun, INTERVALS.proactive),
        totalAlerts: state.totalProactiveAlerts,
      },
      agentCoordination: {
        lastRun: state.lastAgentCoordination,
        staleness: getStaleness(state.lastAgentCoordination, INTERVALS.agentCoordination),
      },
    };

    // Agent system
    const agents = {
      summary: agentsSummary,
      coordination: {
        lastRun: state.lastAgentCoordination,
      },
    };

    // Decision and execution stats
    const execution = {
      totalDecisions: state.totalDecisions,
      totalAlertsQueued: state.totalAlertsQueued,
      totalPriceAlertsTriggered: state.totalPriceAlertsTriggered,
      totalAutoExecutions: state.totalAutoExecutions,
      totalBuilderRuns: state.totalBuilderRuns,
    };

    // World state and goals
    const intelligence = {
      worldState: worldStateSummary,
      goals: goalStats,
      memory: memorySummary,
    };

    return NextResponse.json({
      success: true,
      status: overall.status,
      data: {
        overall,
        components,
        agents,
        execution,
        intelligence,
      },
      meta: {
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
        version: '2.0.0',
        intervals: INTERVALS,
      },
    }, {
      status: overall.status === 'unhealthy' ? 503 : 200,
    });
  } catch (error) {
    console.error('[API v2/heartbeat/status] Error:', error);
    return NextResponse.json(
      {
        success: false,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
