/**
 * Goal Manager - Agent's intention and objective management
 *
 * Handles goal persistence, prioritization, decomposition, and lifecycle.
 * Goals are the core driver of agentic behavior - the agent pursues goals
 * proactively rather than waiting for commands.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Goal, GoalType, GoalStatus } from './types';

const GOALS_FILE = path.join(process.cwd(), 'memory', 'goals.json');
const MAX_ACTIVE_GOALS = 20;
const GOAL_STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ============================================
// PERSISTENCE
// ============================================

interface GoalStore {
  goals: Goal[];
  lastUpdated: string;
  totalGoalsCreated: number;
  totalGoalsAchieved: number;
  totalGoalsFailed: number;
}

function loadGoals(): GoalStore {
  const defaults: GoalStore = {
    goals: [],
    lastUpdated: new Date().toISOString(),
    totalGoalsCreated: 0,
    totalGoalsAchieved: 0,
    totalGoalsFailed: 0,
  };

  try {
    if (fs.existsSync(GOALS_FILE)) {
      const data = JSON.parse(fs.readFileSync(GOALS_FILE, 'utf-8'));
      return {
        ...defaults,
        ...data,
        goals: (data.goals || []).map((g: any) => ({
          ...g,
          createdAt: new Date(g.createdAt),
          startedAt: g.startedAt ? new Date(g.startedAt) : undefined,
          completedAt: g.completedAt ? new Date(g.completedAt) : undefined,
          deadline: g.deadline ? new Date(g.deadline) : undefined,
        })),
      };
    }
  } catch (error) {
    console.warn('[GoalManager] Failed to load goals:', error);
  }

  return defaults;
}

function saveGoals(store: GoalStore): void {
  try {
    const dir = path.dirname(GOALS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    store.lastUpdated = new Date().toISOString();
    fs.writeFileSync(GOALS_FILE, JSON.stringify(store, null, 2));
  } catch (error) {
    console.error('[GoalManager] Failed to save goals:', error);
  }
}

// Singleton store
let goalStore = loadGoals();

// ============================================
// GOAL CREATION
// ============================================

/**
 * Create a new goal
 */
export function createGoal(
  type: GoalType,
  description: string,
  options: {
    priority?: number;
    successCriteria?: string;
    deadline?: Date;
    parentGoalId?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Goal {
  const goal: Goal = {
    id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    description,
    priority: options.priority ?? 50,
    status: 'active',
    parentGoalId: options.parentGoalId,
    subGoalIds: [],
    successCriteria: options.successCriteria ?? 'Task completed successfully',
    deadline: options.deadline,
    createdAt: new Date(),
    metadata: options.metadata,
  };

  // Link to parent if exists
  if (options.parentGoalId) {
    const parent = goalStore.goals.find(g => g.id === options.parentGoalId);
    if (parent) {
      parent.subGoalIds.push(goal.id);
    }
  }

  goalStore.goals.push(goal);
  goalStore.totalGoalsCreated++;
  saveGoals(goalStore);

  console.log(`[GoalManager] Created goal: ${goal.description} (${goal.type}, priority: ${goal.priority})`);

  return goal;
}

/**
 * Create a proactive goal based on opportunity detection
 */
export function createProactiveGoal(
  description: string,
  trigger: string,
  priority = 60
): Goal {
  return createGoal('proactive', description, {
    priority,
    successCriteria: 'Opportunity acted upon or dismissed with reason',
    metadata: { trigger, proactive: true },
  });
}

/**
 * Decompose a goal into sub-goals
 */
export function decomposeGoal(
  parentGoalId: string,
  subGoals: Array<{
    type: GoalType;
    description: string;
    priority?: number;
    successCriteria?: string;
  }>
): Goal[] {
  const parent = goalStore.goals.find(g => g.id === parentGoalId);
  if (!parent) {
    throw new Error(`Parent goal ${parentGoalId} not found`);
  }

  const created: Goal[] = [];

  for (const sub of subGoals) {
    const goal = createGoal(sub.type, sub.description, {
      priority: sub.priority ?? parent.priority - 5,
      successCriteria: sub.successCriteria,
      parentGoalId,
    });
    created.push(goal);
  }

  return created;
}

// ============================================
// GOAL LIFECYCLE
// ============================================

/**
 * Start working on a goal
 */
export function startGoal(goalId: string): void {
  const goal = goalStore.goals.find(g => g.id === goalId);
  if (goal) {
    goal.status = 'in_progress';
    goal.startedAt = new Date();
    saveGoals(goalStore);
    console.log(`[GoalManager] Started goal: ${goal.description}`);
  }
}

/**
 * Mark goal as achieved
 */
export function achieveGoal(goalId: string, result?: string): void {
  const goal = goalStore.goals.find(g => g.id === goalId);
  if (goal) {
    goal.status = 'achieved';
    goal.completedAt = new Date();
    if (result) {
      goal.metadata = { ...goal.metadata, result };
    }
    goalStore.totalGoalsAchieved++;
    saveGoals(goalStore);

    console.log(`[GoalManager] Achieved goal: ${goal.description}`);

    // Check if parent goal should be updated
    checkParentGoalCompletion(goal.parentGoalId);
  }
}

/**
 * Mark goal as failed
 */
export function failGoal(goalId: string, reason: string): void {
  const goal = goalStore.goals.find(g => g.id === goalId);
  if (goal) {
    goal.status = 'failed';
    goal.completedAt = new Date();
    goal.metadata = { ...goal.metadata, failureReason: reason };
    goalStore.totalGoalsFailed++;
    saveGoals(goalStore);

    console.log(`[GoalManager] Failed goal: ${goal.description} - ${reason}`);
  }
}

/**
 * Abandon a goal (no longer relevant)
 */
export function abandonGoal(goalId: string, reason: string): void {
  const goal = goalStore.goals.find(g => g.id === goalId);
  if (goal) {
    goal.status = 'abandoned';
    goal.completedAt = new Date();
    goal.metadata = { ...goal.metadata, abandonReason: reason };
    saveGoals(goalStore);

    console.log(`[GoalManager] Abandoned goal: ${goal.description} - ${reason}`);

    // Also abandon sub-goals
    for (const subId of goal.subGoalIds) {
      abandonGoal(subId, 'Parent goal abandoned');
    }
  }
}

/**
 * Block a goal (waiting on something)
 */
export function blockGoal(goalId: string, blocker: string): void {
  const goal = goalStore.goals.find(g => g.id === goalId);
  if (goal) {
    goal.status = 'blocked';
    goal.metadata = { ...goal.metadata, blocker };
    saveGoals(goalStore);

    console.log(`[GoalManager] Blocked goal: ${goal.description} - ${blocker}`);
  }
}

/**
 * Unblock a goal
 */
export function unblockGoal(goalId: string): void {
  const goal = goalStore.goals.find(g => g.id === goalId);
  if (goal && goal.status === 'blocked') {
    goal.status = goal.startedAt ? 'in_progress' : 'active';
    saveGoals(goalStore);

    console.log(`[GoalManager] Unblocked goal: ${goal.description}`);
  }
}

/**
 * Check if parent goal should be completed based on sub-goals
 */
function checkParentGoalCompletion(parentId?: string): void {
  if (!parentId) return;

  const parent = goalStore.goals.find(g => g.id === parentId);
  if (!parent || parent.subGoalIds.length === 0) return;

  const subGoals = parent.subGoalIds.map(id =>
    goalStore.goals.find(g => g.id === id)
  ).filter(Boolean) as Goal[];

  const allAchieved = subGoals.every(g => g.status === 'achieved');
  const anyFailed = subGoals.some(g => g.status === 'failed');

  if (allAchieved) {
    achieveGoal(parentId, 'All sub-goals achieved');
  } else if (anyFailed) {
    const failedCount = subGoals.filter(g => g.status === 'failed').length;
    if (failedCount > subGoals.length / 2) {
      failGoal(parentId, `${failedCount}/${subGoals.length} sub-goals failed`);
    }
  }
}

// ============================================
// GOAL QUERIES
// ============================================

/**
 * Get all active goals (not completed/abandoned)
 */
export function getActiveGoals(): Goal[] {
  return goalStore.goals.filter(g =>
    g.status === 'active' || g.status === 'in_progress' || g.status === 'blocked'
  );
}

/**
 * Get goals by priority (highest first)
 */
export function getGoalsByPriority(): Goal[] {
  return getActiveGoals().sort((a, b) => {
    // Deadline urgency boost
    const aUrgency = a.deadline
      ? Math.max(0, 1 - (a.deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : 0;
    const bUrgency = b.deadline
      ? Math.max(0, 1 - (b.deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : 0;

    const aScore = a.priority + aUrgency * 30;
    const bScore = b.priority + bUrgency * 30;

    return bScore - aScore;
  });
}

/**
 * Get the highest priority goal that should be worked on next
 */
export function getNextGoal(): Goal | null {
  const sorted = getGoalsByPriority();

  // First try to continue an in-progress goal
  const inProgress = sorted.find(g => g.status === 'in_progress');
  if (inProgress) return inProgress;

  // Then pick highest priority active goal
  const active = sorted.find(g => g.status === 'active');
  return active || null;
}

/**
 * Get goals by type
 */
export function getGoalsByType(type: GoalType): Goal[] {
  return goalStore.goals.filter(g => g.type === type);
}

/**
 * Get goal by ID
 */
export function getGoal(id: string): Goal | undefined {
  return goalStore.goals.find(g => g.id === id);
}

/**
 * Get sub-goals of a goal
 */
export function getSubGoals(parentId: string): Goal[] {
  const parent = goalStore.goals.find(g => g.id === parentId);
  if (!parent) return [];

  return parent.subGoalIds
    .map(id => goalStore.goals.find(g => g.id === id))
    .filter(Boolean) as Goal[];
}

/**
 * Get overdue goals
 */
export function getOverdueGoals(): Goal[] {
  const now = new Date();
  return getActiveGoals().filter(g => g.deadline && g.deadline < now);
}

/**
 * Check if a similar goal already exists
 */
export function hasSimilarGoal(description: string, type?: GoalType): boolean {
  const descLower = description.toLowerCase();
  return getActiveGoals().some(g => {
    if (type && g.type !== type) return false;
    return g.description.toLowerCase().includes(descLower) ||
           descLower.includes(g.description.toLowerCase());
  });
}

// ============================================
// GOAL MAINTENANCE
// ============================================

/**
 * Clean up stale goals
 */
export function cleanupStaleGoals(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const goal of goalStore.goals) {
    if (goal.status === 'active' || goal.status === 'in_progress') {
      const age = now - goal.createdAt.getTime();
      if (age > GOAL_STALE_MS) {
        abandonGoal(goal.id, 'Stale - exceeded maximum age');
        cleaned++;
      }
    }
  }

  // Also enforce max active goals
  const active = getActiveGoals();
  if (active.length > MAX_ACTIVE_GOALS) {
    const toAbandon = active
      .sort((a, b) => a.priority - b.priority)
      .slice(0, active.length - MAX_ACTIVE_GOALS);

    for (const goal of toAbandon) {
      abandonGoal(goal.id, 'Exceeded maximum active goals limit');
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[GoalManager] Cleaned up ${cleaned} stale goals`);
  }

  return cleaned;
}

/**
 * Update goal priority
 */
export function updatePriority(goalId: string, newPriority: number): void {
  const goal = goalStore.goals.find(g => g.id === goalId);
  if (goal) {
    goal.priority = Math.max(0, Math.min(100, newPriority));
    saveGoals(goalStore);
  }
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get goal statistics
 */
export function getGoalStats(): {
  active: number;
  inProgress: number;
  blocked: number;
  achieved: number;
  failed: number;
  abandoned: number;
  totalCreated: number;
  successRate: number;
} {
  const stats = {
    active: 0,
    inProgress: 0,
    blocked: 0,
    achieved: 0,
    failed: 0,
    abandoned: 0,
    totalCreated: goalStore.totalGoalsCreated,
    successRate: 0,
  };

  for (const goal of goalStore.goals) {
    switch (goal.status) {
      case 'active': stats.active++; break;
      case 'in_progress': stats.inProgress++; break;
      case 'blocked': stats.blocked++; break;
      case 'achieved': stats.achieved++; break;
      case 'failed': stats.failed++; break;
      case 'abandoned': stats.abandoned++; break;
    }
  }

  const completed = stats.achieved + stats.failed;
  stats.successRate = completed > 0 ? stats.achieved / completed : 0;

  return stats;
}

/**
 * Get goal summary for context injection
 */
export function getGoalSummary(): string {
  const goals = getGoalsByPriority();
  const stats = getGoalStats();
  const overdue = getOverdueGoals();

  let summary = `## Active Goals (${goals.length})\n\n`;

  if (goals.length === 0) {
    summary += 'No active goals. Consider generating proactive goals based on opportunities.\n\n';
  } else {
    for (const goal of goals.slice(0, 10)) {
      const statusEmoji = {
        active: '🎯',
        in_progress: '🔄',
        blocked: '🚫',
        achieved: '✅',
        failed: '❌',
        abandoned: '⏹️',
      }[goal.status];

      summary += `${statusEmoji} **[${goal.priority}]** ${goal.description}\n`;
      summary += `   Type: ${goal.type} | Status: ${goal.status}`;
      if (goal.deadline) {
        const remaining = Math.ceil((goal.deadline.getTime() - Date.now()) / (1000 * 60 * 60));
        summary += ` | Deadline: ${remaining}h`;
      }
      summary += '\n';
    }
  }

  if (overdue.length > 0) {
    summary += `\n⚠️ **Overdue Goals**: ${overdue.length}\n`;
  }

  summary += `\n### Statistics\n`;
  summary += `- Success Rate: ${(stats.successRate * 100).toFixed(1)}%\n`;
  summary += `- Total Created: ${stats.totalCreated}\n`;
  summary += `- Achieved: ${stats.achieved} | Failed: ${stats.failed}\n`;

  return summary;
}

/**
 * Reset goals (for testing)
 */
export function resetGoals(): void {
  goalStore = {
    goals: [],
    lastUpdated: new Date().toISOString(),
    totalGoalsCreated: 0,
    totalGoalsAchieved: 0,
    totalGoalsFailed: 0,
  };
  saveGoals(goalStore);
}

export default {
  createGoal,
  createProactiveGoal,
  decomposeGoal,
  startGoal,
  achieveGoal,
  failGoal,
  abandonGoal,
  blockGoal,
  unblockGoal,
  getActiveGoals,
  getGoalsByPriority,
  getNextGoal,
  getGoalsByType,
  getGoal,
  getSubGoals,
  getOverdueGoals,
  hasSimilarGoal,
  cleanupStaleGoals,
  updatePriority,
  getGoalStats,
  getGoalSummary,
  resetGoals,
};
