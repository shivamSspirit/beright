/**
 * Cognitive Loop Hook Handler
 *
 * Integrates the BeRight cognitive system with OpenClaw's event system.
 * Triggers cognitive cycles on gateway events.
 */

interface HookEvent {
  type: string;
  action?: string;
  sessionKey?: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

interface HookResponse {
  handled: boolean;
  message?: string;
}

/**
 * Main hook handler - called by OpenClaw on registered events
 */
export default async function handler(event: HookEvent): Promise<HookResponse> {
  // Only process relevant events
  if (!['gateway:startup', 'command:new', 'agent:bootstrap'].includes(event.type)) {
    return { handled: false };
  }

  console.log(`[cognitive-loop] Triggered by ${event.type}`);

  try {
    // Dynamic import to avoid bundling issues
    const { runCognitiveLoopOnce, getCognitiveStateSummary } = await import('../../lib/cognitive/cognitiveLoop');

    // Run one cognitive cycle
    const result = await runCognitiveLoopOnce();

    if (result.success) {
      console.log(`[cognitive-loop] Cycle completed: ${result.summary}`);

      // Update HEARTBEAT.md with current state
      await updateHeartbeatFile();

      return {
        handled: true,
        message: result.summary,
      };
    } else {
      console.log(`[cognitive-loop] Cycle skipped: ${result.summary}`);
      return {
        handled: true,
        message: result.summary,
      };
    }
  } catch (error) {
    console.error('[cognitive-loop] Error:', error);
    return {
      handled: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update HEARTBEAT.md with current cognitive state
 * This file is read by OpenClaw's heartbeat mechanism
 */
async function updateHeartbeatFile(): Promise<void> {
  try {
    const fs = await import('fs');
    const path = await import('path');

    const { getCognitiveStateSummary } = await import('../../lib/cognitive/cognitiveLoop');
    const { getGoalsByPriority } = await import('../../lib/cognitive/goalManager');
    const { getUnprocessedSignals } = await import('../../lib/cognitive/worldState');

    const goals = getGoalsByPriority();
    const signals = getUnprocessedSignals();

    let content = `# BeRight Agent Heartbeat Checklist

*Last updated: ${new Date().toISOString()}*

## Current Focus

`;

    if (goals.length > 0) {
      const topGoal = goals[0];
      content += `**${topGoal.description}**\n`;
      content += `- Type: ${topGoal.type}\n`;
      content += `- Priority: ${topGoal.priority}\n`;
      content += `- Status: ${topGoal.status}\n\n`;
    } else {
      content += `No active goals. Consider generating proactive opportunities.\n\n`;
    }

    content += `## Pending Signals (${signals.length})\n\n`;

    if (signals.length > 0) {
      for (const signal of signals.slice(0, 5)) {
        content += `- [${signal.type}] ${signal.content.slice(0, 60)}...\n`;
      }
      if (signals.length > 5) {
        content += `- ... and ${signals.length - 5} more\n`;
      }
    } else {
      content += `No pending signals.\n`;
    }

    content += `\n## Active Goals (${goals.length})\n\n`;

    for (const goal of goals.slice(0, 5)) {
      const emoji = {
        active: '🎯',
        in_progress: '🔄',
        blocked: '🚫',
      }[goal.status] || '📋';

      content += `${emoji} **[${goal.priority}]** ${goal.description}\n`;
    }

    content += `\n## Instructions for Heartbeat

When this file is loaded during heartbeat:

1. Check if there are pending signals that need processing
2. If the top goal is 'in_progress', continue working on it
3. If no goals exist, scan for opportunities:
   - Check for arbitrage opportunities
   - Monitor whale activity
   - Review position risk
4. Report HEARTBEAT_OK if nothing needs attention
5. Otherwise, generate an alert with the relevant finding

## Alert Criteria

Generate an alert (don't return HEARTBEAT_OK) if:
- Arbitrage opportunity > 3% spread detected
- Whale movement > $10,000 value
- Position at > 10% loss
- Price alert triggered
- Prediction resolved (for calibration update)
`;

    const heartbeatPath = path.join(process.cwd(), 'HEARTBEAT.md');
    fs.writeFileSync(heartbeatPath, content);

    console.log('[cognitive-loop] Updated HEARTBEAT.md');
  } catch (error) {
    console.warn('[cognitive-loop] Failed to update HEARTBEAT.md:', error);
  }
}
