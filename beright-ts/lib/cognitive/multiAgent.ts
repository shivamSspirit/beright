/**
 * Multi-Agent Coordinator - True agent coordination with independent goals
 *
 * Unlike the previous agentSpawner which was just function dispatch,
 * this coordinator manages agents that have their own goals, beliefs,
 * and can negotiate with each other.
 *
 * Integrates with OpenClaw's multi-agent routing for true agent isolation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Goal, AgentEvent, Signal } from './types';
import { createGoal, achieveGoal, failGoal, getGoalsByPriority } from './goalManager';
import { addBelief, addSignal } from './worldState';
import { recordEpisode } from './memory';

const AGENTS_STATE_FILE = path.join(process.cwd(), 'memory', 'agents-state.json');

// ============================================
// TYPES
// ============================================

export interface AgentDefinition {
  id: string;
  name: string;
  role: AgentRole;
  capabilities: string[];
  systemPrompt: string;
  model: 'sonnet' | 'opus' | 'haiku';
  maxConcurrentGoals: number;
}

export type AgentRole = 'scout' | 'analyst' | 'trader' | 'orchestrator';

export interface AgentState {
  id: string;
  role: AgentRole;
  status: 'idle' | 'working' | 'blocked' | 'offline';
  currentGoals: string[];
  beliefs: string[];
  lastActivity: Date;
  metrics: {
    tasksCompleted: number;
    tasksFailed: number;
    averageResponseTime: number;
  };
}

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: MessageType;
  content: string;
  payload?: unknown;
  timestamp: Date;
  requiresResponse: boolean;
  responseDeadline?: Date;
}

export type MessageType =
  | 'task_request'
  | 'task_response'
  | 'belief_share'
  | 'goal_claim'
  | 'conflict_resolution'
  | 'status_update';

export interface ConflictResolution {
  conflictId: string;
  agents: string[];
  issue: string;
  resolution: 'priority_wins' | 'negotiation' | 'escalate' | 'abandon';
  winner?: string;
  compromise?: string;
}

// ============================================
// AGENT DEFINITIONS
// ============================================

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    id: 'orchestrator',
    name: 'BeRight Orchestrator',
    role: 'orchestrator',
    capabilities: ['coordination', 'planning', 'conflict_resolution', 'goal_generation'],
    systemPrompt: `You are the BeRight Orchestrator - the central coordinator of a multi-agent prediction market system.

Your responsibilities:
1. Generate and prioritize goals based on market opportunities
2. Delegate tasks to specialist agents (Scout, Analyst, Trader)
3. Resolve conflicts between agents
4. Maintain overall system coherence
5. Report to users when attention is needed

You have access to the full world state and can create goals for any agent.`,
    model: 'opus',
    maxConcurrentGoals: 5,
  },
  {
    id: 'scout',
    name: 'Market Scout',
    role: 'scout',
    capabilities: ['market_scanning', 'arbitrage_detection', 'news_monitoring', 'whale_tracking'],
    systemPrompt: `You are the Market Scout - a fast-moving agent that scans for opportunities.

Your responsibilities:
1. Continuously scan markets for arbitrage opportunities
2. Monitor news feeds for market-moving events
3. Track whale wallet activity
4. Alert the system to opportunities

You prioritize speed over depth. If something looks interesting, flag it for the Analyst.`,
    model: 'haiku',
    maxConcurrentGoals: 10,
  },
  {
    id: 'analyst',
    name: 'Research Analyst',
    role: 'analyst',
    capabilities: ['deep_research', 'probability_estimation', 'claim_verification', 'calibration'],
    systemPrompt: `You are the Research Analyst - a careful, methodical agent that provides deep analysis.

Your responsibilities:
1. Perform superforecaster-style analysis on markets
2. Verify claims and fact-check information
3. Estimate probabilities with proper calibration
4. Identify cognitive biases in predictions

You prioritize accuracy over speed. Take time to consider base rates and outside views.`,
    model: 'opus',
    maxConcurrentGoals: 3,
  },
  {
    id: 'trader',
    name: 'Trade Executor',
    role: 'trader',
    capabilities: ['trade_execution', 'risk_management', 'position_monitoring', 'portfolio_management'],
    systemPrompt: `You are the Trade Executor - an agent responsible for safe, efficient trade execution.

Your responsibilities:
1. Execute trades with proper risk management
2. Monitor open positions
3. Manage stop-losses and take-profits
4. Track portfolio performance

You never execute without proper authorization. Always verify before acting.`,
    model: 'sonnet',
    maxConcurrentGoals: 5,
  },
];

// ============================================
// STATE MANAGEMENT
// ============================================

interface CoordinatorState {
  agents: Map<string, AgentState>;
  messageQueue: AgentMessage[];
  pendingConflicts: ConflictResolution[];
  lastCoordination: Date;
}

let coordinatorState: CoordinatorState = loadCoordinatorState();

function loadCoordinatorState(): CoordinatorState {
  const defaults: CoordinatorState = {
    agents: new Map(),
    messageQueue: [],
    pendingConflicts: [],
    lastCoordination: new Date(),
  };

  // Initialize agent states
  for (const def of AGENT_DEFINITIONS) {
    defaults.agents.set(def.id, {
      id: def.id,
      role: def.role,
      status: 'idle',
      currentGoals: [],
      beliefs: [],
      lastActivity: new Date(),
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        averageResponseTime: 0,
      },
    });
  }

  try {
    if (fs.existsSync(AGENTS_STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(AGENTS_STATE_FILE, 'utf-8'));
      for (const [id, state] of Object.entries(data.agents || {})) {
        if (defaults.agents.has(id)) {
          defaults.agents.set(id, {
            ...defaults.agents.get(id)!,
            ...(state as Partial<AgentState>),
            lastActivity: new Date((state as any).lastActivity || Date.now()),
          });
        }
      }
      defaults.messageQueue = data.messageQueue || [];
      defaults.pendingConflicts = data.pendingConflicts || [];
    }
  } catch (error) {
    console.warn('[MultiAgent] Failed to load state:', error);
  }

  return defaults;
}

function saveCoordinatorState(): void {
  try {
    const dir = path.dirname(AGENTS_STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const serializable = {
      agents: Object.fromEntries(coordinatorState.agents),
      messageQueue: coordinatorState.messageQueue,
      pendingConflicts: coordinatorState.pendingConflicts,
      lastCoordination: coordinatorState.lastCoordination.toISOString(),
    };

    fs.writeFileSync(AGENTS_STATE_FILE, JSON.stringify(serializable, null, 2));
  } catch (error) {
    console.error('[MultiAgent] Failed to save state:', error);
  }
}

// ============================================
// AGENT MANAGEMENT
// ============================================

/**
 * Get agent definition by ID
 */
export function getAgentDefinition(agentId: string): AgentDefinition | undefined {
  return AGENT_DEFINITIONS.find(a => a.id === agentId);
}

/**
 * Get agent state
 */
export function getAgentState(agentId: string): AgentState | undefined {
  return coordinatorState.agents.get(agentId);
}

/**
 * Update agent status
 */
export function updateAgentStatus(agentId: string, status: AgentState['status']): void {
  const agent = coordinatorState.agents.get(agentId);
  if (agent) {
    agent.status = status;
    agent.lastActivity = new Date();
    saveCoordinatorState();
  }
}

/**
 * Get best agent for a task
 */
export function selectAgentForTask(task: string, requiredCapabilities: string[] = []): AgentDefinition | null {
  const taskLower = task.toLowerCase();

  // Score each agent
  let bestAgent: AgentDefinition | null = null;
  let bestScore = 0;

  for (const agent of AGENT_DEFINITIONS) {
    const state = coordinatorState.agents.get(agent.id);
    if (!state || state.status === 'offline') continue;

    let score = 0;

    // Capability match
    for (const cap of requiredCapabilities) {
      if (agent.capabilities.includes(cap)) {
        score += 10;
      }
    }

    // Task keyword matching
    if (agent.role === 'scout' &&
        (taskLower.includes('scan') || taskLower.includes('monitor') ||
         taskLower.includes('find') || taskLower.includes('detect'))) {
      score += 5;
    }

    if (agent.role === 'analyst' &&
        (taskLower.includes('research') || taskLower.includes('analyze') ||
         taskLower.includes('verify') || taskLower.includes('calibrat'))) {
      score += 5;
    }

    if (agent.role === 'trader' &&
        (taskLower.includes('trade') || taskLower.includes('execute') ||
         taskLower.includes('buy') || taskLower.includes('sell'))) {
      score += 5;
    }

    // Workload consideration
    const currentLoad = state.currentGoals.length / agent.maxConcurrentGoals;
    score -= currentLoad * 5;

    // Status bonus
    if (state.status === 'idle') score += 3;

    if (score > bestScore) {
      bestScore = score;
      bestAgent = agent;
    }
  }

  return bestAgent;
}

// ============================================
// MESSAGE PASSING
// ============================================

/**
 * Send message to an agent
 */
export function sendMessage(
  from: string,
  to: string,
  type: MessageType,
  content: string,
  payload?: unknown,
  requiresResponse = false
): AgentMessage {
  const message: AgentMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    from,
    to,
    type,
    content,
    payload,
    timestamp: new Date(),
    requiresResponse,
    responseDeadline: requiresResponse ? new Date(Date.now() + 60000) : undefined,
  };

  coordinatorState.messageQueue.push(message);
  saveCoordinatorState();

  console.log(`[MultiAgent] Message ${from} → ${to}: ${content.slice(0, 50)}`);

  return message;
}

/**
 * Get pending messages for an agent
 */
export function getMessages(agentId: string): AgentMessage[] {
  return coordinatorState.messageQueue.filter(m => m.to === agentId);
}

/**
 * Acknowledge/remove a message
 */
export function acknowledgeMessage(messageId: string): void {
  coordinatorState.messageQueue = coordinatorState.messageQueue.filter(m => m.id !== messageId);
  saveCoordinatorState();
}

// ============================================
// GOAL DELEGATION
// ============================================

/**
 * Delegate a goal to the best available agent
 */
export async function delegateGoal(
  goalDescription: string,
  goalType: Goal['type'],
  priority: number
): Promise<{ agentId: string; goalId: string } | null> {
  // Select best agent
  const agent = selectAgentForTask(goalDescription);
  if (!agent) {
    console.warn('[MultiAgent] No suitable agent found for:', goalDescription);
    return null;
  }

  // Check agent capacity
  const state = coordinatorState.agents.get(agent.id);
  if (!state) return null;

  if (state.currentGoals.length >= agent.maxConcurrentGoals) {
    console.warn(`[MultiAgent] Agent ${agent.id} at capacity`);

    // Try to find alternative
    const alternative = AGENT_DEFINITIONS.find(a => {
      const s = coordinatorState.agents.get(a.id);
      return s && s.currentGoals.length < a.maxConcurrentGoals && a.id !== agent.id;
    });

    if (!alternative) return null;
  }

  // Create goal
  const goal = createGoal(goalType, goalDescription, {
    priority,
    metadata: { assignedAgent: agent.id },
  });

  // Assign to agent
  state.currentGoals.push(goal.id);
  state.status = 'working';
  state.lastActivity = new Date();

  // Send task message
  sendMessage(
    'orchestrator',
    agent.id,
    'task_request',
    `New goal assigned: ${goalDescription}`,
    { goalId: goal.id, priority }
  );

  saveCoordinatorState();

  console.log(`[MultiAgent] Delegated goal to ${agent.id}: ${goalDescription}`);

  return { agentId: agent.id, goalId: goal.id };
}

/**
 * Report goal completion
 */
export function reportGoalCompletion(agentId: string, goalId: string, success: boolean, result?: string): void {
  const state = coordinatorState.agents.get(agentId);
  if (!state) return;

  // Remove from agent's goals
  state.currentGoals = state.currentGoals.filter(g => g !== goalId);

  // Update metrics
  if (success) {
    state.metrics.tasksCompleted++;
    achieveGoal(goalId, result);
  } else {
    state.metrics.tasksFailed++;
    failGoal(goalId, result || 'Agent reported failure');
  }

  // Update status
  state.status = state.currentGoals.length > 0 ? 'working' : 'idle';
  state.lastActivity = new Date();

  // Notify orchestrator
  sendMessage(
    agentId,
    'orchestrator',
    'task_response',
    success ? `Goal ${goalId} completed successfully` : `Goal ${goalId} failed: ${result}`,
    { goalId, success, result }
  );

  saveCoordinatorState();

  // Record episode
  recordEpisode(
    `Agent ${agentId} working on goal`,
    `Completed goal: ${success ? 'success' : 'failure'}`,
    success ? 'success' : 'failure',
    { relatedGoalId: goalId }
  );
}

// ============================================
// CONFLICT RESOLUTION
// ============================================

/**
 * Detect conflicts between agents
 */
export function detectConflicts(): ConflictResolution[] {
  const conflicts: ConflictResolution[] = [];

  // Check for duplicate goals
  const goalAssignments = new Map<string, string[]>();

  for (const [agentId, state] of coordinatorState.agents) {
    for (const goalId of state.currentGoals) {
      if (!goalAssignments.has(goalId)) {
        goalAssignments.set(goalId, []);
      }
      goalAssignments.get(goalId)!.push(agentId);
    }
  }

  for (const [goalId, agents] of goalAssignments) {
    if (agents.length > 1) {
      conflicts.push({
        conflictId: `conflict-${Date.now()}-${goalId}`,
        agents,
        issue: `Multiple agents assigned to goal ${goalId}`,
        resolution: 'priority_wins',
      });
    }
  }

  return conflicts;
}

/**
 * Resolve a conflict
 */
export function resolveConflict(conflict: ConflictResolution): void {
  console.log(`[MultiAgent] Resolving conflict: ${conflict.issue}`);

  switch (conflict.resolution) {
    case 'priority_wins': {
      // Higher priority agent keeps the goal
      const states = conflict.agents.map(id => ({
        id,
        state: coordinatorState.agents.get(id)!,
      }));

      // Sort by metrics (completed tasks = experience)
      states.sort((a, b) =>
        b.state.metrics.tasksCompleted - a.state.metrics.tasksCompleted
      );

      conflict.winner = states[0].id;

      // Remove goal from losers
      for (const { id, state } of states.slice(1)) {
        state.currentGoals = state.currentGoals.filter(g => !conflict.issue.includes(g));
        state.status = state.currentGoals.length > 0 ? 'working' : 'idle';
      }

      break;
    }

    case 'negotiation':
      // Could implement more sophisticated negotiation
      conflict.compromise = 'Split the work - one agent researches, other executes';
      break;

    case 'escalate':
      // Add to pending for human review
      coordinatorState.pendingConflicts.push(conflict);
      break;

    case 'abandon':
      // All agents drop the conflicting goal
      for (const agentId of conflict.agents) {
        const state = coordinatorState.agents.get(agentId);
        if (state) {
          state.currentGoals = state.currentGoals.filter(g => !conflict.issue.includes(g));
          state.status = state.currentGoals.length > 0 ? 'working' : 'idle';
        }
      }
      break;
  }

  saveCoordinatorState();
}

// ============================================
// COORDINATION CYCLE
// ============================================

/**
 * Run one coordination cycle
 */
export async function coordinate(): Promise<{
  messagesProcessed: number;
  conflictsResolved: number;
  goalsReassigned: number;
}> {
  const result = {
    messagesProcessed: 0,
    conflictsResolved: 0,
    goalsReassigned: 0,
  };

  // Process pending messages
  const messages = [...coordinatorState.messageQueue];
  for (const message of messages) {
    // Check for expired messages
    if (message.responseDeadline && new Date() > message.responseDeadline) {
      acknowledgeMessage(message.id);
      result.messagesProcessed++;

      // Handle timeout
      if (message.type === 'task_request') {
        console.warn(`[MultiAgent] Task request timed out: ${message.content}`);
      }
    }
  }

  // Detect and resolve conflicts
  const conflicts = detectConflicts();
  for (const conflict of conflicts) {
    resolveConflict(conflict);
    result.conflictsResolved++;
  }

  // Check for stuck agents (no activity in 5 minutes)
  const staleThreshold = Date.now() - 5 * 60 * 1000;
  for (const [agentId, state] of coordinatorState.agents) {
    if (state.status === 'working' && state.lastActivity.getTime() < staleThreshold) {
      console.warn(`[MultiAgent] Agent ${agentId} appears stuck`);
      state.status = 'blocked';

      // Reassign their goals
      for (const goalId of state.currentGoals) {
        const newAgent = selectAgentForTask('continuation', []);
        if (newAgent && newAgent.id !== agentId) {
          const newState = coordinatorState.agents.get(newAgent.id);
          if (newState) {
            newState.currentGoals.push(goalId);
            result.goalsReassigned++;
          }
        }
      }

      state.currentGoals = [];
    }
  }

  coordinatorState.lastCoordination = new Date();
  saveCoordinatorState();

  console.log(`[MultiAgent] Coordination: ${result.messagesProcessed} msgs, ${result.conflictsResolved} conflicts, ${result.goalsReassigned} reassigned`);

  return result;
}

// ============================================
// SUMMARY
// ============================================

/**
 * Get multi-agent status summary
 */
export function getAgentsSummary(): string {
  let summary = `## Multi-Agent Status\n\n`;

  for (const [agentId, state] of coordinatorState.agents) {
    const def = getAgentDefinition(agentId);
    const statusEmoji = {
      idle: '🟢',
      working: '🔄',
      blocked: '🔴',
      offline: '⚫',
    }[state.status];

    summary += `### ${statusEmoji} ${def?.name || agentId}\n`;
    summary += `- Role: ${state.role}\n`;
    summary += `- Status: ${state.status}\n`;
    summary += `- Current Goals: ${state.currentGoals.length}\n`;
    summary += `- Tasks Completed: ${state.metrics.tasksCompleted}\n`;
    summary += `- Success Rate: ${state.metrics.tasksCompleted + state.metrics.tasksFailed > 0
      ? ((state.metrics.tasksCompleted / (state.metrics.tasksCompleted + state.metrics.tasksFailed)) * 100).toFixed(1)
      : 0}%\n\n`;
  }

  if (coordinatorState.pendingConflicts.length > 0) {
    summary += `### ⚠️ Pending Conflicts\n`;
    for (const conflict of coordinatorState.pendingConflicts) {
      summary += `- ${conflict.issue}\n`;
    }
  }

  return summary;
}

/**
 * Reset coordinator state (for testing)
 */
export function resetCoordinatorState(): void {
  coordinatorState = loadCoordinatorState();
  saveCoordinatorState();
}

export default {
  AGENT_DEFINITIONS,
  getAgentDefinition,
  getAgentState,
  updateAgentStatus,
  selectAgentForTask,
  sendMessage,
  getMessages,
  acknowledgeMessage,
  delegateGoal,
  reportGoalCompletion,
  detectConflicts,
  resolveConflict,
  coordinate,
  getAgentsSummary,
  resetCoordinatorState,
};
