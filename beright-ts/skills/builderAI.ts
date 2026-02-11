/**
 * Builder AI - Autonomous Self-Building Agent
 *
 * Uses Claude Code CLI (Max subscription) to autonomously:
 * - Analyze codebase for tasks
 * - Implement features and fixes
 * - Test changes
 * - Commit to git
 *
 * NO API KEY NEEDED - Uses your Claude Max plan via Claude Code CLI
 */

import 'dotenv/config';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SkillResponse, Mood } from '../types/index';

const execAsync = promisify(exec);

const ROOT = path.join(__dirname, '..');
const MONOREPO_ROOT = path.join(ROOT, '..');

interface CodeChange {
  filePath: string;
  content: string;
  action: 'create' | 'modify' | 'delete';
}

interface BuildTask {
  description: string;
  type: 'feat' | 'fix' | 'refactor' | 'test' | 'docs';
  priority: 'P0' | 'P1' | 'P2';
  files?: string[];
}

interface ImplementationResult {
  success: boolean;
  changes: CodeChange[];
  explanation: string;
  error?: string;
}

// Build state file
const STATE_FILE = path.join(ROOT, 'memory', 'builder-state.json');

interface BuilderState {
  totalBuilds: number;
  totalCommits: number;
  lastBuildAt: string;
  completedTasks: string[];
  failedTasks: string[];
}

function loadState(): BuilderState {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  }
  return {
    totalBuilds: 0,
    totalCommits: 0,
    lastBuildAt: new Date().toISOString(),
    completedTasks: [],
    failedTasks: [],
  };
}

function saveState(state: BuilderState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Run Claude Code CLI with a prompt
 * Uses your Max subscription - no API key needed
 */
async function runClaudeCode(prompt: string, timeoutMs: number = 180000): Promise<string> {
  console.log('[BuilderAI] Calling Claude Code CLI (Max plan)...');

  return new Promise((resolve, reject) => {
    let output = '';
    let errorOutput = '';

    // Use spawn instead of exec for better handling
    const child = spawn('claude', [
      '-p', prompt,
      '--output-format', 'text',
      '--permission-mode', 'bypassPermissions',
      '--model', 'sonnet',
    ], {
      cwd: MONOREPO_ROOT,
      timeout: timeoutMs,
      env: { ...process.env },
    });

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0 || output.length > 0) {
        resolve(output);
      } else {
        reject(new Error(`Claude Code exited with code ${code}: ${errorOutput}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });

    // Timeout handler
    setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Claude Code timed out'));
    }, timeoutMs);
  });
}

/**
 * Analyze codebase to find tasks
 */
async function analyzeTasks(): Promise<BuildTask[]> {
  console.log('[BuilderAI] Analyzing codebase for tasks...');

  // Read key files for context
  const files: { name: string; content: string }[] = [];

  const keyFiles = [
    'CLAUDE.md',
    'MVP_PROGRESS.md',
    'HACKATHON_WINNING_STRATEGY.md',
    'package.json',
  ];

  for (const file of keyFiles) {
    const filePath = path.join(ROOT, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      files.push({ name: file, content: content.slice(0, 1500) });
    }
  }

  // Check for TODOs
  let todos = '';
  try {
    const { stdout } = await execAsync(`cd "${ROOT}" && grep -r "TODO\\|FIXME" --include="*.ts" -n 2>/dev/null | head -10`);
    todos = stdout;
  } catch {
    // No matches
  }

  // Check TypeScript errors
  let tsErrors = '';
  try {
    const { stdout, stderr } = await execAsync(`cd "${ROOT}" && npx tsc --noEmit 2>&1 | head -10`);
    tsErrors = stdout + stderr;
  } catch (e: any) {
    tsErrors = e.stdout || '';
  }

  const prompt = `You are analyzing BeRight Protocol codebase for autonomous building.

PROJECT FILES:
${files.map(f => `--- ${f.name} ---\n${f.content}`).join('\n\n')}

TODOS IN CODE:
${todos || 'None'}

TYPESCRIPT ERRORS:
${tsErrors || 'None'}

Return a JSON array of max 5 tasks sorted by priority:
[{"description":"task","type":"fix|feat","priority":"P0|P1|P2","files":["hint.ts"]}]

Focus on: TypeScript errors (P0), missing features (P1), improvements (P2).
Return ONLY the JSON array, nothing else.`;

  try {
    const response = await runClaudeCode(prompt, 60000);
    const jsonMatch = response.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('[BuilderAI] Analysis failed:', e);
  }

  return [];
}

/**
 * Get context for task implementation
 */
function getContextForTask(task: BuildTask): string {
  const ctx: string[] = [];

  // Types
  const typesPath = path.join(ROOT, 'types', 'index.ts');
  if (fs.existsSync(typesPath)) {
    ctx.push(`--- types/index.ts ---\n${fs.readFileSync(typesPath, 'utf-8').slice(0, 1500)}`);
  }

  // Task files
  if (task.files) {
    for (const file of task.files.slice(0, 2)) {
      const fp = path.join(ROOT, file);
      if (fs.existsSync(fp)) {
        ctx.push(`--- ${file} ---\n${fs.readFileSync(fp, 'utf-8').slice(0, 2000)}`);
      }
    }
  }

  return ctx.join('\n\n');
}

/**
 * Implement a task using Claude Code
 */
async function implementTask(task: BuildTask): Promise<ImplementationResult> {
  console.log(`[BuilderAI] Implementing: ${task.description}`);

  const context = getContextForTask(task);

  const prompt = `You are BeRight Builder. Implement this task:

TASK: ${task.description}
TYPE: ${task.type}
PRIORITY: ${task.priority}

CONTEXT:
${context}

RULES:
1. Follow existing code patterns
2. Use TypeScript with types
3. Skills return: { text: string, mood: Mood, data?: unknown }
4. Keep changes minimal

Return ONLY this JSON (no markdown):
{"explanation":"one line","changes":[{"filePath":"path.ts","action":"modify","content":"full content"}]}`;

  try {
    const response = await runClaudeCode(prompt, 120000);
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return { success: false, changes: [], explanation: 'No JSON', error: response.slice(0, 100) };
    }

    const result = JSON.parse(jsonMatch[0]);
    return {
      success: true,
      changes: result.changes || [],
      explanation: result.explanation || 'Done',
    };
  } catch (e: any) {
    return { success: false, changes: [], explanation: 'Failed', error: e.message };
  }
}

/**
 * Apply changes to filesystem
 */
function applyChanges(changes: CodeChange[]): { applied: string[]; failed: string[] } {
  const applied: string[] = [];
  const failed: string[] = [];

  for (const change of changes) {
    try {
      const fullPath = path.join(ROOT, change.filePath);
      const dir = path.dirname(fullPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (change.action === 'delete') {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          applied.push(change.filePath);
        }
      } else {
        fs.writeFileSync(fullPath, change.content);
        applied.push(change.filePath);
      }
    } catch (e) {
      console.error(`[BuilderAI] Failed: ${change.filePath}`);
      failed.push(change.filePath);
    }
  }

  return { applied, failed };
}

/**
 * Validate with TypeScript
 */
async function validateChanges(): Promise<{ valid: boolean; errors: string[] }> {
  try {
    await execAsync(`cd "${ROOT}" && npx tsc --noEmit`);
    return { valid: true, errors: [] };
  } catch (e: any) {
    const output = e.stdout || e.message || '';
    const errors = output.split('\n').filter((l: string) => l.includes('error TS')).slice(0, 3);
    return { valid: errors.length === 0, errors };
  }
}

/**
 * Revert changes
 */
async function revertChanges(files: string[]): Promise<void> {
  for (const file of files) {
    try {
      await execAsync(`cd "${MONOREPO_ROOT}" && git checkout HEAD -- "beright-ts/${file}"`);
    } catch {
      const fp = path.join(ROOT, file);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
  }
}

/**
 * Commit changes
 */
async function commitChanges(message: string, files: string[]): Promise<string | null> {
  try {
    for (const file of files) {
      await execAsync(`cd "${MONOREPO_ROOT}" && git add "beright-ts/${file}"`);
    }

    const msg = `[builder-ai] ${message}\n\nAutonomously generated by BeRight BuilderAI\nCo-Authored-By: BeRight Builder <builder@beright.ai>`;
    await execAsync(`cd "${MONOREPO_ROOT}" && git commit -m "${msg.replace(/"/g, '\\"')}"`);

    const { stdout } = await execAsync(`cd "${MONOREPO_ROOT}" && git rev-parse --short HEAD`);
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Run one build cycle
 */
export async function runBuildCycle(): Promise<SkillResponse> {
  const state = loadState();
  state.totalBuilds++;
  state.lastBuildAt = new Date().toISOString();

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`[BuilderAI] Build Cycle #${state.totalBuilds} (Claude Max)`);
  console.log(`${'═'.repeat(50)}\n`);

  // 1. Find tasks
  const tasks = await analyzeTasks();
  console.log(`[BuilderAI] Found ${tasks.length} tasks\n`);

  if (tasks.length === 0) {
    saveState(state);
    return { text: 'No tasks found.', mood: 'NEUTRAL' as Mood };
  }

  let completed = 0;
  let failed = 0;
  const results: string[] = [];

  // 2. Work on tasks
  for (const task of tasks.slice(0, 3)) {
    if (state.completedTasks.includes(task.description)) {
      console.log(`  Skip: ${task.description} (done)`);
      continue;
    }

    console.log(`\n→ ${task.description} [${task.priority}]`);

    const impl = await implementTask(task);

    if (!impl.success || impl.changes.length === 0) {
      console.log(`  ✗ Failed: ${impl.error || 'no changes'}`);
      failed++;
      continue;
    }

    console.log(`  Generated ${impl.changes.length} file(s)`);

    const { applied } = applyChanges(impl.changes);
    if (applied.length === 0) {
      failed++;
      continue;
    }

    const validation = await validateChanges();
    if (!validation.valid) {
      console.log(`  ✗ TypeScript errors, reverting`);
      await revertChanges(applied);
      failed++;
      continue;
    }

    const hash = await commitChanges(task.description.slice(0, 40), applied);
    if (hash) {
      console.log(`  ✓ Committed: ${hash}`);
      state.totalCommits++;
      state.completedTasks.push(task.description);
      completed++;
      results.push(`✓ ${task.description} (${hash})`);
    }
  }

  saveState(state);

  const summary = `
Build #${state.totalBuilds} Complete
─────────────────────────
Tasks: ${tasks.length} | Done: ${completed} | Failed: ${failed}
Total commits: ${state.totalCommits}
${results.length > 0 ? '\n' + results.join('\n') : ''}`;

  console.log(summary);
  return { text: summary, mood: completed > 0 ? 'BULLISH' as Mood : 'NEUTRAL' as Mood };
}

/**
 * Run continuous loop
 */
export async function runBuildLoop(intervalSec: number = 1800): Promise<void> {
  console.log(`[BuilderAI] Loop started (every ${intervalSec}s)`);
  console.log('[BuilderAI] Ctrl+C to stop\n');

  while (true) {
    try {
      await runBuildCycle();
    } catch (e) {
      console.error('[BuilderAI] Error:', e);
    }
    console.log(`\nNext build in ${intervalSec}s...\n`);
    await new Promise(r => setTimeout(r, intervalSec * 1000));
  }
}

/**
 * Check if Claude Code CLI is available
 */
async function checkClaudeCode(): Promise<boolean> {
  try {
    await execAsync('which claude');
    return true;
  } catch {
    return false;
  }
}

/**
 * Main entry
 */
export async function builderAI(cmd?: string, ...args: string[]): Promise<SkillResponse> {
  const available = await checkClaudeCode();
  if (!available) {
    return {
      text: 'Claude Code CLI not found. Install: npm install -g @anthropic-ai/claude-code',
      mood: 'ERROR' as Mood,
    };
  }

  switch (cmd) {
    case 'once':
      return runBuildCycle();

    case 'loop':
      await runBuildLoop(parseInt(args[0]) || 1800);
      return { text: 'Loop stopped', mood: 'NEUTRAL' as Mood };

    case 'status':
      const s = loadState();
      return {
        text: `BuilderAI: ${s.totalBuilds} builds, ${s.totalCommits} commits\nLast: ${s.lastBuildAt}`,
        mood: 'NEUTRAL' as Mood,
        data: s,
      };

    default:
      return {
        text: `BeRight BuilderAI - Self-Building Agent (Claude Max)

Commands:
  once            Run one build cycle
  loop [sec]      Run continuous (default 1800s)
  status          Show stats

Usage:
  npx ts-node skills/builderAI.ts once
  npx ts-node skills/builderAI.ts loop 600`,
        mood: 'EDUCATIONAL' as Mood,
      };
  }
}

export default builderAI;

if (require.main === module) {
  const args = process.argv.slice(2);
  builderAI(args[0], ...args.slice(1))
    .then(r => { console.log(r.text); process.exit(r.mood === 'ERROR' ? 1 : 0); })
    .catch(e => { console.error(e); process.exit(1); });
}
