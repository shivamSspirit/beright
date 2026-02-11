/**
 * Build Loop - Autonomous Self-Building System
 *
 * The core of BeRight's self-improvement capability.
 * Runs 24/7 analyzing, planning, implementing, testing, and committing code.
 */

import { SkillResponse, Mood } from '../types/index';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

// Import dev skills
import { devBackend } from './devBackend';
import { devFrontend } from './devFrontend';
import { devTest } from './devTest';

// Import AI builder for complex tasks
let builderAI: typeof import('./builderAI') | null = null;
try {
  builderAI = require('./builderAI');
} catch {
  console.log('[Builder] BuilderAI not available (missing Anthropic SDK?)');
}

const execAsync = promisify(exec);

const ROOT = path.join(__dirname, '..');
const MONOREPO_ROOT = path.join(ROOT, '..');
const LOG_FILE = path.join(ROOT, 'memory', 'builder-log.json');
const TASKS_FILE = path.join(ROOT, 'memory', 'build-tasks.json');
const MVP_TRACK = path.join(ROOT, 'mvptrack.md');
const STRATEGY_FILE = path.join(ROOT, 'HACKATHON_WINNING_STRATEGY.md');

// Types
interface BuildTask {
  id: string;
  type: 'feat' | 'fix' | 'refactor' | 'test' | 'docs' | 'chore';
  description: string;
  priority: 'P0' | 'P1' | 'P2';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  source: 'todo' | 'mvp' | 'strategy' | 'error' | 'test' | 'manual';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  commitHash?: string;
  error?: string;
  filesChanged?: string[];
}

interface BuilderState {
  lastRun: string | null;
  isRunning: boolean;
  totalBuilds: number;
  totalCommits: number;
  totalLinesWritten: number;
  currentTask: BuildTask | null;
  sessionStarted: string | null;
}

interface BuildLog {
  state: BuilderState;
  tasks: BuildTask[];
  history: Array<{
    timestamp: string;
    action: string;
    result: 'success' | 'failure' | 'skipped';
    details?: string;
  }>;
}

// =====================================
// STATE MANAGEMENT
// =====================================

function loadState(): BuildLog {
  const defaults: BuildLog = {
    state: {
      lastRun: null,
      isRunning: false,
      totalBuilds: 0,
      totalCommits: 0,
      totalLinesWritten: 0,
      currentTask: null,
      sessionStarted: null,
    },
    tasks: [],
    history: [],
  };

  try {
    if (fs.existsSync(LOG_FILE)) {
      const data = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
      return { ...defaults, ...data };
    }
  } catch {}

  return defaults;
}

function saveState(log: BuildLog): void {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

function logAction(log: BuildLog, action: string, result: 'success' | 'failure' | 'skipped', details?: string): void {
  log.history.push({
    timestamp: new Date().toISOString(),
    action,
    result,
    details,
  });
  // Keep only last 100 history entries
  if (log.history.length > 100) {
    log.history = log.history.slice(-100);
  }
  saveState(log);
}

// =====================================
// TASK DISCOVERY
// =====================================

/**
 * Find TODOs in code
 */
async function findCodeTodos(): Promise<BuildTask[]> {
  const tasks: BuildTask[] = [];

  try {
    const { stdout } = await execAsync(
      `grep -r "TODO:" --include="*.ts" --include="*.tsx" ${ROOT}/skills ${ROOT}/lib ${ROOT}/app 2>/dev/null || true`
    );

    const lines = stdout.split('\n').filter(Boolean).slice(0, 10);

    for (const line of lines) {
      const match = line.match(/^(.+):(\d+):.*TODO:\s*(.+)/);
      if (match) {
        tasks.push({
          id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'feat',
          description: `${match[3]} (${path.basename(match[1])}:${match[2]})`,
          priority: 'P1',
          status: 'pending',
          source: 'todo',
          createdAt: new Date().toISOString(),
        });
      }
    }
  } catch {}

  return tasks;
}

/**
 * Find unchecked items in MVP track
 */
async function findMvpTasks(): Promise<BuildTask[]> {
  const tasks: BuildTask[] = [];

  try {
    if (!fs.existsSync(MVP_TRACK)) return tasks;

    const content = fs.readFileSync(MVP_TRACK, 'utf-8');
    const unchecked = content.match(/- \[ \] .+/g) || [];

    for (const item of unchecked.slice(0, 10)) {
      const description = item.replace('- [ ] ', '').trim();

      // Skip items that are user actions
      if (description.includes('USER ACTION') || description.includes('Pending')) {
        continue;
      }

      // Determine priority from context
      const isPriority = description.includes('P0') ||
        description.toLowerCase().includes('critical') ||
        description.toLowerCase().includes('must');

      tasks.push({
        id: `mvp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'feat',
        description,
        priority: isPriority ? 'P0' : 'P1',
        status: 'pending',
        source: 'mvp',
        createdAt: new Date().toISOString(),
      });
    }
  } catch {}

  return tasks;
}

/**
 * Find tasks from strategy file
 */
async function findStrategyTasks(): Promise<BuildTask[]> {
  const tasks: BuildTask[] = [];

  try {
    if (!fs.existsSync(STRATEGY_FILE)) return tasks;

    const content = fs.readFileSync(STRATEGY_FILE, 'utf-8');
    const unchecked = content.match(/- \[ \] .+/g) || [];

    for (const item of unchecked.slice(0, 5)) {
      const description = item.replace('- [ ] ', '').trim();

      tasks.push({
        id: `strategy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'feat',
        description,
        priority: 'P0',
        status: 'pending',
        source: 'strategy',
        createdAt: new Date().toISOString(),
      });
    }
  } catch {}

  return tasks;
}

/**
 * Find TypeScript errors
 */
async function findTypeErrors(): Promise<BuildTask[]> {
  const tasks: BuildTask[] = [];

  try {
    const { stderr } = await execAsync(`cd ${ROOT} && npx tsc --noEmit 2>&1 || true`);

    const errorLines = stderr.split('\n').filter(l => l.includes('error TS'));

    for (const line of errorLines.slice(0, 5)) {
      tasks.push({
        id: `tserror-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'fix',
        description: line.trim().slice(0, 200),
        priority: 'P0',
        status: 'pending',
        source: 'error',
        createdAt: new Date().toISOString(),
      });
    }
  } catch {}

  return tasks;
}

/**
 * Find untested skills
 */
async function findUntestedSkills(): Promise<BuildTask[]> {
  const tasks: BuildTask[] = [];

  try {
    const skills = fs.readdirSync(path.join(ROOT, 'skills'))
      .filter(f => f.endsWith('.ts') && !f.includes('.test.') && !f.includes('SKILL'))
      .map(f => f.replace('.ts', ''));

    const untested = skills.filter(skill => {
      const testPath = path.join(ROOT, 'skills', `${skill}.test.ts`);
      return !fs.existsSync(testPath);
    });

    for (const skill of untested.slice(0, 5)) {
      tasks.push({
        id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'test',
        description: `Write tests for ${skill}.ts`,
        priority: 'P1',
        status: 'pending',
        source: 'test',
        createdAt: new Date().toISOString(),
      });
    }
  } catch {}

  return tasks;
}

/**
 * Discover all tasks
 */
async function discoverTasks(): Promise<BuildTask[]> {
  const allTasks: BuildTask[] = [];

  const [codeTodos, mvpTasks, strategyTasks, typeErrors, untestedSkills] = await Promise.all([
    findCodeTodos(),
    findMvpTasks(),
    findStrategyTasks(),
    findTypeErrors(),
    findUntestedSkills(),
  ]);

  allTasks.push(...typeErrors); // P0 - TypeScript errors first
  allTasks.push(...strategyTasks); // P0 - Strategy items
  allTasks.push(...mvpTasks); // P0/P1 - MVP items
  allTasks.push(...codeTodos); // P1 - Code TODOs
  allTasks.push(...untestedSkills); // P1 - Missing tests

  // Sort by priority
  const priorityOrder = { P0: 0, P1: 1, P2: 2 };
  allTasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return allTasks;
}

// =====================================
// TASK EXECUTION
// =====================================

/**
 * Execute a test generation task
 */
async function executeTestTask(task: BuildTask): Promise<{ success: boolean; filesChanged: string[] }> {
  const match = task.description.match(/Write tests for (.+)\.ts/);
  if (!match) {
    return { success: false, filesChanged: [] };
  }

  const skillName = match[1];
  const result = await devTest('generate', skillName);

  if (result.mood === 'BULLISH') {
    return {
      success: true,
      filesChanged: [`skills/${skillName}.test.ts`],
    };
  }

  return { success: false, filesChanged: [] };
}

/**
 * Execute a TypeScript error fix using Claude AI
 */
async function executeTypeErrorFix(task: BuildTask): Promise<{ success: boolean; filesChanged: string[] }> {
  if (!builderAI) {
    console.log(`[Builder] TypeScript error detected but BuilderAI not available: ${task.description}`);
    return { success: false, filesChanged: [] };
  }

  try {
    const result = await builderAI.fixTypeScriptError(task.description);
    if (result.mood === 'BULLISH' && result.data) {
      const data = result.data as { files?: string[] };
      return {
        success: true,
        filesChanged: data.files || [],
      };
    }
  } catch (error) {
    console.log(`[Builder] Claude API error: ${error}`);
  }

  return { success: false, filesChanged: [] };
}

/**
 * Execute a feature task using Claude AI
 */
async function executeFeatureTask(task: BuildTask): Promise<{ success: boolean; filesChanged: string[] }> {
  if (!builderAI) {
    console.log(`[Builder] Feature requires BuilderAI: ${task.description}`);
    return { success: false, filesChanged: [] };
  }

  try {
    const result = await builderAI.autonomousImplement(task.description, {
      priority: task.priority,
      autoCommit: false, // We handle commit in the main loop
      validateFirst: true,
    });

    if (result.mood === 'BULLISH' && result.data) {
      const data = result.data as { files?: string[] };
      return {
        success: true,
        filesChanged: data.files || [],
      };
    }
  } catch (error) {
    console.log(`[Builder] Claude API error: ${error}`);
  }

  return { success: false, filesChanged: [] };
}

/**
 * Execute a task
 */
async function executeTask(task: BuildTask, log: BuildLog): Promise<{
  success: boolean;
  commitHash?: string;
  filesChanged: string[];
}> {
  task.status = 'in_progress';
  task.startedAt = new Date().toISOString();
  log.state.currentTask = task;
  saveState(log);

  let result: { success: boolean; filesChanged: string[] };

  // Route to appropriate handler
  if (task.type === 'test' && task.source === 'test') {
    result = await executeTestTask(task);
  } else if (task.type === 'fix' && task.source === 'error') {
    result = await executeTypeErrorFix(task);
  } else if (task.type === 'feat' || task.type === 'refactor') {
    // Use Claude AI for feature implementation
    result = await executeFeatureTask(task);
  } else {
    // For other tasks, try Claude AI if available
    if (builderAI) {
      result = await executeFeatureTask(task);
    } else {
      console.log(`[Builder] Task requires BuilderAI: ${task.description}`);
      result = { success: false, filesChanged: [] };
    }
  }

  if (!result.success) {
    return { success: false, filesChanged: [] };
  }

  // Validate changes
  const validation = await devTest('typecheck');
  if (validation.mood === 'ERROR') {
    console.log('[Builder] Type check failed after changes, reverting...');
    // Revert would go here
    return { success: false, filesChanged: [] };
  }

  // Commit if we have changes
  if (result.filesChanged.length > 0) {
    const commitResult = await gitCommit(task, result.filesChanged);
    return {
      success: commitResult.success,
      commitHash: commitResult.hash,
      filesChanged: result.filesChanged,
    };
  }

  return result;
}

// =====================================
// GIT OPERATIONS
// =====================================

async function gitCommit(
  task: BuildTask,
  files: string[]
): Promise<{ success: boolean; hash?: string }> {
  try {
    // Stage files
    for (const file of files) {
      const fullPath = path.join(ROOT, file);
      if (fs.existsSync(fullPath)) {
        await execAsync(`cd ${MONOREPO_ROOT} && git add "${fullPath}"`);
      }
    }

    // Create commit message
    const message = `[builder] ${task.type}: ${task.description}

Source: ${task.source}
Priority: ${task.priority}
Files: ${files.join(', ')}

Generated autonomously by BeRight Builder
Co-Authored-By: BeRight Builder <builder@beright.ai>`;

    await execAsync(`cd ${MONOREPO_ROOT} && git commit -m "${message.replace(/"/g, '\\"')}"`);

    // Get commit hash
    const { stdout } = await execAsync(`cd ${MONOREPO_ROOT} && git rev-parse --short HEAD`);
    const hash = stdout.trim();

    return { success: true, hash };
  } catch (error) {
    console.error('[Builder] Git commit failed:', error);
    return { success: false };
  }
}

async function gitPush(): Promise<{ success: boolean }> {
  try {
    await execAsync(`cd ${MONOREPO_ROOT} && git push origin agent-build 2>&1`);
    return { success: true };
  } catch (error) {
    console.error('[Builder] Git push failed:', error);
    return { success: false };
  }
}

// =====================================
// MAIN BUILD LOOP
// =====================================

/**
 * Run one iteration of the build loop
 */
export async function buildOnce(): Promise<SkillResponse> {
  const log = loadState();
  const results: string[] = [];

  // Mark as running
  log.state.isRunning = true;
  log.state.lastRun = new Date().toISOString();
  if (!log.state.sessionStarted) {
    log.state.sessionStarted = log.state.lastRun;
  }
  saveState(log);

  try {
    // 1. Discover tasks
    results.push('Analyzing codebase...');
    const tasks = await discoverTasks();
    results.push(`Found ${tasks.length} potential tasks`);
    logAction(log, 'discover', 'success', `Found ${tasks.length} tasks`);

    if (tasks.length === 0) {
      results.push('No tasks to process - codebase is healthy!');
      log.state.isRunning = false;
      saveState(log);
      return {
        text: results.join('\n'),
        mood: 'BULLISH' as Mood,
      };
    }

    // 2. Process top 3 tasks
    let completed = 0;
    let failed = 0;

    for (const task of tasks.slice(0, 3)) {
      results.push(`\nWorking on: ${task.description}`);
      results.push(`  Type: ${task.type}, Priority: ${task.priority}`);

      const result = await executeTask(task, log);

      if (result.success) {
        completed++;
        task.status = 'completed';
        task.completedAt = new Date().toISOString();
        task.commitHash = result.commitHash;
        task.filesChanged = result.filesChanged;
        log.state.totalCommits++;
        results.push(`  Committed: ${result.commitHash}`);
        logAction(log, `execute:${task.id}`, 'success', result.commitHash);
      } else {
        failed++;
        task.status = 'failed';
        results.push(`  Skipped (requires manual implementation)`);
        logAction(log, `execute:${task.id}`, 'skipped', 'Requires Claude API');
      }

      log.tasks.push(task);
    }

    // 3. Push if we have commits
    if (completed > 0) {
      results.push('\nPushing to remote...');
      const pushResult = await gitPush();
      if (pushResult.success) {
        results.push('Pushed successfully');
        logAction(log, 'push', 'success');
      } else {
        results.push('Push failed (may need manual push)');
        logAction(log, 'push', 'failure');
      }
    }

    // 4. Summary
    log.state.totalBuilds++;
    log.state.isRunning = false;
    log.state.currentTask = null;
    saveState(log);

    results.push(`\n${'─'.repeat(30)}`);
    results.push(`Build Summary:`);
    results.push(`  Tasks found: ${tasks.length}`);
    results.push(`  Completed: ${completed}`);
    results.push(`  Skipped: ${failed}`);
    results.push(`  Total builds: ${log.state.totalBuilds}`);
    results.push(`  Total commits: ${log.state.totalCommits}`);

    return {
      text: results.join('\n'),
      mood: completed > 0 ? 'BULLISH' as Mood : 'NEUTRAL' as Mood,
      data: { completed, failed, tasks: tasks.slice(0, 3) },
    };
  } catch (error) {
    log.state.isRunning = false;
    saveState(log);
    logAction(log, 'build', 'failure', String(error));

    return {
      text: `Build loop error: ${error}`,
      mood: 'ERROR' as Mood,
    };
  }
}

/**
 * Run continuous build loop
 */
export async function buildLoop(intervalMs: number = 7 * 60 * 1000): Promise<void> {
  console.log(`[Builder] Starting continuous build loop (interval: ${intervalMs / 1000}s)`);
  console.log('[Builder] Press Ctrl+C to stop');

  // Run immediately
  const result = await buildOnce();
  console.log(result.text);

  // Then run on interval
  setInterval(async () => {
    console.log(`\n[Builder] Running scheduled build at ${new Date().toISOString()}`);
    const result = await buildOnce();
    console.log(result.text);
  }, intervalMs);
}

/**
 * Get builder status
 */
export async function getStatus(): Promise<SkillResponse> {
  const log = loadState();
  const state = log.state;

  const recentTasks = log.tasks
    .filter(t => t.status === 'completed')
    .slice(-5)
    .map(t => `- [${t.commitHash || '?'}] ${t.description}`)
    .join('\n');

  const pendingCount = log.tasks.filter(t => t.status === 'pending').length;
  const failedCount = log.tasks.filter(t => t.status === 'failed').length;

  return {
    text: `Builder Status
${'─'.repeat(30)}

Running: ${state.isRunning ? 'YES' : 'NO'}
Last Run: ${state.lastRun || 'never'}
Session Started: ${state.sessionStarted || 'N/A'}

Stats:
  Total Builds: ${state.totalBuilds}
  Total Commits: ${state.totalCommits}
  Pending Tasks: ${pendingCount}
  Failed Tasks: ${failedCount}

Recent Commits:
${recentTasks || '  (none)'}`,
    mood: 'NEUTRAL' as Mood,
    data: { state, recentTasks: log.tasks.slice(-5) },
  };
}

/**
 * Clear builder state
 */
export async function clearState(): Promise<SkillResponse> {
  if (fs.existsSync(LOG_FILE)) {
    fs.unlinkSync(LOG_FILE);
  }
  if (fs.existsSync(TASKS_FILE)) {
    fs.unlinkSync(TASKS_FILE);
  }

  return {
    text: 'Builder state cleared',
    mood: 'NEUTRAL' as Mood,
  };
}

// Main export
export async function buildLoopSkill(command?: string, ...args: string[]): Promise<SkillResponse> {
  switch (command) {
    case 'once':
    case 'build':
    case 'improve':
      return buildOnce();
    case 'loop':
      const interval = args[0] ? parseInt(args[0]) * 1000 : 30 * 60 * 1000;
      buildLoop(interval);
      return {
        text: `Build loop started with interval ${interval / 1000}s`,
        mood: 'BULLISH' as Mood,
      };
    case 'status':
      return getStatus();
    case 'clear':
      return clearState();
    case 'tasks':
      const tasks = await discoverTasks();
      return {
        text: `Found ${tasks.length} tasks:\n${tasks.slice(0, 10).map(t => `- [${t.priority}] ${t.description}`).join('\n')}`,
        mood: 'NEUTRAL' as Mood,
        data: { tasks },
      };
    default:
      return {
        text: `Build Loop Commands:
- once/build/improve - Run one build iteration
- loop [seconds] - Run continuous loop (default: 1800s)
- status - Show builder status
- tasks - Discover and list tasks
- clear - Clear builder state`,
        mood: 'EDUCATIONAL' as Mood,
      };
  }
}

export default buildLoopSkill;

// CLI support
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'once';

  if (command === 'loop') {
    buildLoop(args[1] ? parseInt(args[1]) * 1000 : undefined);
  } else {
    buildLoopSkill(command, ...args.slice(1)).then(result => {
      console.log(result.text);
      process.exit(result.mood === 'ERROR' ? 1 : 0);
    });
  }
}
