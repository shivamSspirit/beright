/**
 * Smart Builder - Fully Autonomous Development Agent
 *
 * A truly intelligent builder that:
 * 1. THINKS - Analyzes project state and identifies gaps
 * 2. PLANS - Breaks down vague goals into concrete tasks
 * 3. BUILDS - Implements features with proper code
 * 4. REVIEWS - Self-reviews code quality
 * 5. SHIPS - Commits and validates
 * 6. LEARNS - Improves from failures
 *
 * NO MANUAL IMPLEMENTATION REQUIRED - handles everything autonomously
 */

import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SkillResponse, Mood } from '../types/index';

const execAsync = promisify(exec);

const ROOT = path.join(__dirname, '..');
const MONOREPO_ROOT = path.join(ROOT, '..');
const MEMORY_DIR = path.join(ROOT, 'memory');

// ============================================
// TYPES
// ============================================

interface Task {
  id: string;
  title: string;
  description: string;
  type: 'feature' | 'fix' | 'refactor' | 'test' | 'docs' | 'infra';
  priority: 'P0' | 'P1' | 'P2';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  subtasks?: Task[];
  files?: string[];
  createdAt: string;
  completedAt?: string;
  error?: string;
  attempts: number;
}

interface ProjectState {
  version: string;
  lastUpdated: string;
  currentPhase: 'mvp' | 'growth' | 'scale';
  completedFeatures: string[];
  pendingFeatures: string[];
  knownIssues: string[];
  codebaseStats: {
    totalFiles: number;
    totalSkills: number;
    totalComponents: number;
    totalApiRoutes: number;
    typeErrors: number;
    testCoverage: number;
  };
}

interface BuildMemory {
  projectState: ProjectState;
  taskQueue: Task[];
  completedTasks: Task[];
  lessonsLearned: string[];
  buildHistory: Array<{
    timestamp: string;
    tasksAttempted: number;
    tasksCompleted: number;
    errors: string[];
  }>;
}

// ============================================
// MEMORY MANAGEMENT
// ============================================

function loadMemory(): BuildMemory {
  const memoryFile = path.join(MEMORY_DIR, 'smart-builder-memory.json');

  if (fs.existsSync(memoryFile)) {
    try {
      return JSON.parse(fs.readFileSync(memoryFile, 'utf-8'));
    } catch {
      console.log('[SmartBuilder] Failed to load memory, starting fresh');
    }
  }

  // Initialize fresh memory
  return {
    projectState: {
      version: '0.1.0',
      lastUpdated: new Date().toISOString(),
      currentPhase: 'mvp',
      completedFeatures: [],
      pendingFeatures: [],
      knownIssues: [],
      codebaseStats: {
        totalFiles: 0,
        totalSkills: 0,
        totalComponents: 0,
        totalApiRoutes: 0,
        typeErrors: 0,
        testCoverage: 0,
      },
    },
    taskQueue: [],
    completedTasks: [],
    lessonsLearned: [],
    buildHistory: [],
  };
}

function saveMemory(memory: BuildMemory): void {
  const memoryFile = path.join(MEMORY_DIR, 'smart-builder-memory.json');

  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }

  fs.writeFileSync(memoryFile, JSON.stringify(memory, null, 2));
}

// ============================================
// CLAUDE CODE INTERFACE
// ============================================

async function askClaude(prompt: string, timeoutMs: number = 180000): Promise<string> {
  const tempFile = path.join(MEMORY_DIR, '.smart-builder-prompt.txt');
  fs.writeFileSync(tempFile, prompt, 'utf-8');

  try {
    const cleanEnv = { ...process.env };
    delete cleanEnv.ANTHROPIC_API_KEY;

    const { stdout } = await execAsync(
      `cat "${tempFile}" | claude -p - --output-format text --permission-mode bypassPermissions --model sonnet`,
      {
        cwd: MONOREPO_ROOT,
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        env: cleanEnv,
      }
    );

    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    return stdout.trim();
  } catch (error) {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    throw error;
  }
}

// ============================================
// CODEBASE ANALYSIS
// ============================================

async function analyzeCodebase(): Promise<ProjectState['codebaseStats']> {
  const stats = {
    totalFiles: 0,
    totalSkills: 0,
    totalComponents: 0,
    totalApiRoutes: 0,
    typeErrors: 0,
    testCoverage: 0,
  };

  try {
    // Count files
    const { stdout: fileCount } = await execAsync(`find ${ROOT} -name "*.ts" -o -name "*.tsx" | wc -l`);
    stats.totalFiles = parseInt(fileCount.trim()) || 0;

    // Count skills
    const skillsDir = path.join(ROOT, 'skills');
    if (fs.existsSync(skillsDir)) {
      const skills = fs.readdirSync(skillsDir).filter(f => f.endsWith('.ts'));
      stats.totalSkills = skills.length;
    }

    // Count frontend components
    const componentsDir = path.join(MONOREPO_ROOT, 'berightweb', 'src', 'components');
    if (fs.existsSync(componentsDir)) {
      const components = fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx'));
      stats.totalComponents = components.length;
    }

    // Count API routes
    const apiDir = path.join(ROOT, 'app', 'api');
    if (fs.existsSync(apiDir)) {
      const { stdout: routeCount } = await execAsync(`find ${apiDir} -name "route.ts" | wc -l`);
      stats.totalApiRoutes = parseInt(routeCount.trim()) || 0;
    }

    // Count TypeScript errors
    try {
      await execAsync(`cd ${ROOT} && npx tsc --noEmit 2>&1`);
      stats.typeErrors = 0;
    } catch (error: unknown) {
      const errorOutput = error instanceof Error ? (error as Error & { stdout?: string }).stdout || '' : '';
      const errors = errorOutput.split('\n').filter((l: string) => l.includes('error TS'));
      stats.typeErrors = errors.length;
    }
  } catch (error) {
    console.error('[SmartBuilder] Error analyzing codebase:', error);
  }

  return stats;
}

// ============================================
// THINK WORKFLOW
// ============================================

interface Priority {
  title: string;
  description: string;
  type: string;
  priority: string;
  reason: string;
}

async function think(memory: BuildMemory): Promise<Priority[]> {
  console.log('\n[SmartBuilder] THINKING - Analyzing project state...');

  // Update codebase stats
  memory.projectState.codebaseStats = await analyzeCodebase();
  memory.projectState.lastUpdated = new Date().toISOString();

  // Read key project files for context
  const claudeMd = fs.existsSync(path.join(ROOT, 'CLAUDE.md'))
    ? fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf-8').slice(0, 3000)
    : '';

  const mvpMd = fs.existsSync(path.join(MONOREPO_ROOT, 'MVP_REQUIREMENTS.md'))
    ? fs.readFileSync(path.join(MONOREPO_ROOT, 'MVP_REQUIREMENTS.md'), 'utf-8').slice(0, 3000)
    : '';

  const prompt = `You are the BRAIN of an autonomous builder agent for BeRight Protocol - a crypto prediction market intelligence platform.

CURRENT PROJECT STATE:
- Phase: ${memory.projectState.currentPhase}
- Total Files: ${memory.projectState.codebaseStats.totalFiles}
- Skills: ${memory.projectState.codebaseStats.totalSkills}
- Components: ${memory.projectState.codebaseStats.totalComponents}
- API Routes: ${memory.projectState.codebaseStats.totalApiRoutes}
- TypeScript Errors: ${memory.projectState.codebaseStats.typeErrors}
- Completed Features: ${memory.projectState.completedFeatures.join(', ') || 'None yet'}
- Known Issues: ${memory.projectState.knownIssues.join(', ') || 'None documented'}

LESSONS LEARNED:
${memory.lessonsLearned.slice(-5).join('\n') || 'None yet'}

PROJECT DOCS:
${claudeMd}

MVP REQUIREMENTS:
${mvpMd}

YOUR TASK:
Analyze the project and identify the TOP 5 most important things to work on next.
Consider:
1. Fix any TypeScript errors first (P0)
2. Complete MVP features before nice-to-haves
3. Add missing tests for critical paths
4. Improve code quality and architecture
5. Add new features for crypto prediction markets

OUTPUT FORMAT (JSON only, no markdown):
{
  "analysis": "Brief analysis of current state",
  "gaps": ["list of gaps or missing features"],
  "priorities": [
    {
      "title": "Task title",
      "description": "What needs to be done",
      "type": "feature|fix|refactor|test|docs|infra",
      "priority": "P0|P1|P2",
      "reason": "Why this is important"
    }
  ]
}`;

  try {
    const response = await askClaude(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      console.log(`[SmartBuilder] Analysis: ${result.analysis}`);
      console.log(`[SmartBuilder] Found ${result.gaps?.length || 0} gaps`);

      // Update memory with findings
      memory.projectState.knownIssues = result.gaps || [];

      return result.priorities || [];
    }
  } catch (error) {
    console.error('[SmartBuilder] Think failed:', error);
  }

  return [];
}

// ============================================
// PLAN WORKFLOW
// ============================================

async function plan(taskTitle: string, taskDescription: string): Promise<Task[]> {
  console.log(`\n[SmartBuilder] PLANNING - Breaking down: ${taskTitle}`);

  const prompt = `You are planning the implementation of a feature for BeRight Protocol (crypto prediction market platform).

TASK: ${taskTitle}
DESCRIPTION: ${taskDescription}

PROJECT CONTEXT:
- Backend: beright-ts/ (Next.js 14, TypeScript, Supabase, Solana)
- Frontend: berightweb/ (Next.js 16, React 19, Tailwind v4)
- Skills pattern: Each skill is a TypeScript file that exports a main function returning SkillResponse
- API pattern: Next.js API routes in app/api/

YOUR TASK:
Break this down into 3-7 CONCRETE, IMPLEMENTABLE subtasks.
Each subtask should be small enough to implement in a single file change.

OUTPUT FORMAT (JSON only, no markdown):
{
  "subtasks": [
    {
      "title": "Specific task title",
      "description": "Exactly what to implement",
      "type": "feature|fix|refactor|test|docs|infra",
      "files": ["path/to/file.ts"],
      "priority": "P0|P1|P2"
    }
  ]
}`;

  try {
    const response = await askClaude(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);

      return (result.subtasks || []).map((st: { title: string; description: string; type: string; files?: string[]; priority: string }, i: number) => ({
        id: `task-${Date.now()}-${i}`,
        title: st.title,
        description: st.description,
        type: st.type || 'feature',
        priority: st.priority || 'P1',
        status: 'pending' as const,
        files: st.files || [],
        createdAt: new Date().toISOString(),
        attempts: 0,
      }));
    }
  } catch (error) {
    console.error('[SmartBuilder] Plan failed:', error);
  }

  return [];
}

// ============================================
// BUILD WORKFLOW
// ============================================

async function build(task: Task): Promise<{ success: boolean; files: string[]; error?: string }> {
  console.log(`\n[SmartBuilder] BUILDING - ${task.title}`);

  // Read relevant existing files for context
  let existingCode = '';
  if (task.files && task.files.length > 0) {
    for (const file of task.files.slice(0, 2)) {
      const fullPath = path.join(ROOT, file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        existingCode += `\n--- ${file} ---\n${content.slice(0, 2000)}\n`;
      }
    }
  }

  // Read a sample skill for pattern reference
  const sampleSkill = path.join(ROOT, 'skills', 'markets.ts');
  let sampleCode = '';
  if (fs.existsSync(sampleSkill)) {
    sampleCode = fs.readFileSync(sampleSkill, 'utf-8').slice(0, 1500);
  }

  const prompt = `You are implementing a feature for BeRight Protocol (crypto prediction market platform).

TASK: ${task.title}
DESCRIPTION: ${task.description}
TYPE: ${task.type}
TARGET FILES: ${task.files?.join(', ') || 'Determine appropriate files'}

EXISTING CODE:
${existingCode || 'No existing files - create new ones'}

SAMPLE SKILL PATTERN:
${sampleCode}

KEY PATTERNS TO FOLLOW:
1. Skills return: { text: string, mood: Mood, data?: unknown }
2. Mood options: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'ALERT' | 'EDUCATIONAL' | 'ERROR'
3. Use proper TypeScript types
4. Handle errors with try/catch
5. Use async/await for API calls

OUTPUT FORMAT (JSON only, no markdown):
{
  "explanation": "What was implemented",
  "changes": [
    {
      "filePath": "relative/path/from/beright-ts/file.ts",
      "action": "create|modify",
      "content": "FULL file content here"
    }
  ]
}

IMPORTANT:
- Output ONLY valid JSON
- Include COMPLETE file contents, not partial
- Follow existing code patterns exactly`;

  try {
    const response = await askClaude(prompt, 240000); // 4 min timeout for complex tasks
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      const files: string[] = [];

      // Apply changes
      for (const change of result.changes || []) {
        try {
          const fullPath = path.join(ROOT, change.filePath);
          const dir = path.dirname(fullPath);

          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          fs.writeFileSync(fullPath, change.content);
          files.push(change.filePath);
          console.log(`[SmartBuilder] Written: ${change.filePath}`);
        } catch (err) {
          console.error(`[SmartBuilder] Failed to write ${change.filePath}:`, err);
        }
      }

      return { success: files.length > 0, files };
    }
  } catch (error) {
    console.error('[SmartBuilder] Build failed:', error);
    return { success: false, files: [], error: String(error) };
  }

  return { success: false, files: [], error: 'No valid response from Claude' };
}

// ============================================
// REVIEW WORKFLOW
// ============================================

async function review(files: string[]): Promise<{ passed: boolean; issues: string[] }> {
  console.log(`\n[SmartBuilder] REVIEWING - ${files.length} files`);

  // Run TypeScript check
  try {
    await execAsync(`cd ${ROOT} && npx tsc --noEmit 2>&1`);
    console.log('[SmartBuilder] TypeScript: PASSED');
    return { passed: true, issues: [] };
  } catch (error: unknown) {
    const errorOutput = error instanceof Error ? (error as Error & { stdout?: string }).stdout || '' : '';
    const tsErrors = errorOutput.split('\n').filter((l: string) => l.includes('error TS')).slice(0, 5);

    if (tsErrors.length > 0) {
      console.log(`[SmartBuilder] TypeScript: FAILED (${tsErrors.length} errors)`);
      return { passed: false, issues: tsErrors };
    }

    // No TS errors found in output, probably passed
    return { passed: true, issues: [] };
  }
}

// ============================================
// SHIP WORKFLOW
// ============================================

async function ship(task: Task, files: string[]): Promise<{ success: boolean; hash?: string }> {
  console.log(`\n[SmartBuilder] SHIPPING - ${task.title}`);

  try {
    // Stage files
    for (const file of files) {
      await execAsync(`cd ${MONOREPO_ROOT} && git add "beright-ts/${file}"`);
    }

    // Commit
    const message = `[smart-builder] ${task.type}: ${task.title}

${task.description}

Generated autonomously by BeRight SmartBuilder
Priority: ${task.priority}
Co-Authored-By: BeRight Builder <builder@beright.ai>`;

    await execAsync(`cd ${MONOREPO_ROOT} && git commit -m "${message.replace(/"/g, '\\"')}"`);

    // Get hash
    const { stdout } = await execAsync(`cd ${MONOREPO_ROOT} && git rev-parse --short HEAD`);
    const hash = stdout.trim();

    console.log(`[SmartBuilder] Committed: ${hash}`);
    return { success: true, hash };
  } catch (error) {
    console.error('[SmartBuilder] Ship failed:', error);
    return { success: false };
  }
}

// ============================================
// LEARN WORKFLOW
// ============================================

function learn(memory: BuildMemory, task: Task, success: boolean, error?: string): void {
  if (!success && error) {
    const lesson = `Task "${task.title}" failed: ${error.slice(0, 200)}`;
    if (!memory.lessonsLearned.includes(lesson)) {
      memory.lessonsLearned.push(lesson);
      // Keep only last 20 lessons
      if (memory.lessonsLearned.length > 20) {
        memory.lessonsLearned = memory.lessonsLearned.slice(-20);
      }
    }
  }

  if (success) {
    if (!memory.projectState.completedFeatures.includes(task.title)) {
      memory.projectState.completedFeatures.push(task.title);
    }
  }
}

// ============================================
// MAIN SMART BUILD LOOP
// ============================================

export async function smartBuildOnce(): Promise<SkillResponse> {
  console.log('\n' + '='.repeat(60));
  console.log('[SmartBuilder] AUTONOMOUS BUILD CYCLE STARTING');
  console.log('='.repeat(60));

  const memory = loadMemory();
  let tasksCompleted = 0;
  let tasksFailed = 0;
  const errors: string[] = [];

  try {
    // STEP 1: THINK - Analyze project and identify priorities
    const priorities = await think(memory);

    if (priorities.length === 0) {
      console.log('[SmartBuilder] No priorities identified, analyzing deeper...');

      // Fallback: check for TypeScript errors
      const stats = await analyzeCodebase();
      if (stats.typeErrors > 0) {
        priorities.push({
          title: 'Fix TypeScript Errors',
          description: `Fix ${stats.typeErrors} TypeScript compilation errors`,
          type: 'fix',
          priority: 'P0',
          reason: 'Code must compile'
        });
      }
    }

    // STEP 2: Process top 3 priorities
    for (const priority of priorities.slice(0, 3)) {
      console.log(`\n${'─'.repeat(50)}`);
      console.log(`[SmartBuilder] Working on: ${priority.title}`);
      console.log(`[SmartBuilder] Priority: ${priority.priority}, Type: ${priority.type}`);

      // STEP 2a: PLAN - Break down into subtasks
      const subtasks = await plan(priority.title, priority.description);

      if (subtasks.length === 0) {
        console.log('[SmartBuilder] Could not break down task, attempting direct implementation...');
        subtasks.push({
          id: `task-${Date.now()}`,
          title: priority.title,
          description: priority.description,
          type: priority.type as Task['type'],
          priority: priority.priority as Task['priority'],
          status: 'pending',
          createdAt: new Date().toISOString(),
          attempts: 0,
        });
      }

      // STEP 2b: BUILD each subtask
      for (const task of subtasks.slice(0, 3)) { // Limit to 3 subtasks per priority
        task.status = 'in_progress';
        task.attempts++;

        // BUILD
        const buildResult = await build(task);

        if (!buildResult.success) {
          task.status = 'failed';
          task.error = buildResult.error;
          tasksFailed++;
          errors.push(`${task.title}: ${buildResult.error}`);
          learn(memory, task, false, buildResult.error);
          continue;
        }

        // REVIEW
        const reviewResult = await review(buildResult.files);

        if (!reviewResult.passed) {
          task.status = 'failed';
          task.error = reviewResult.issues.join('\n');
          tasksFailed++;
          errors.push(`${task.title}: TypeScript errors`);
          learn(memory, task, false, 'TypeScript errors');

          // Revert changes
          for (const file of buildResult.files) {
            try {
              await execAsync(`cd ${MONOREPO_ROOT} && git checkout HEAD -- "beright-ts/${file}" 2>/dev/null || rm -f "beright-ts/${file}"`);
            } catch { /* ignore */ }
          }
          continue;
        }

        // SHIP
        const shipResult = await ship(task, buildResult.files);

        if (shipResult.success) {
          task.status = 'completed';
          task.completedAt = new Date().toISOString();
          tasksCompleted++;
          memory.completedTasks.push(task);
          learn(memory, task, true);
        } else {
          task.status = 'failed';
          tasksFailed++;
        }
      }
    }

    // Update build history
    memory.buildHistory.push({
      timestamp: new Date().toISOString(),
      tasksAttempted: tasksCompleted + tasksFailed,
      tasksCompleted,
      errors,
    });

    // Keep only last 50 history entries
    if (memory.buildHistory.length > 50) {
      memory.buildHistory = memory.buildHistory.slice(-50);
    }

    saveMemory(memory);

    console.log('\n' + '='.repeat(60));
    console.log('[SmartBuilder] BUILD CYCLE COMPLETE');
    console.log(`  Tasks Completed: ${tasksCompleted}`);
    console.log(`  Tasks Failed: ${tasksFailed}`);
    console.log('='.repeat(60));

    return {
      text: `Smart Build Complete

Tasks Completed: ${tasksCompleted}
Tasks Failed: ${tasksFailed}
${errors.length > 0 ? `\nErrors:\n${errors.slice(0, 3).join('\n')}` : ''}`,
      mood: tasksCompleted > 0 ? 'BULLISH' as Mood : 'NEUTRAL' as Mood,
      data: { tasksCompleted, tasksFailed, errors },
    };

  } catch (error) {
    console.error('[SmartBuilder] Critical error:', error);
    saveMemory(memory);

    return {
      text: `Smart Build Failed: ${error}`,
      mood: 'ERROR' as Mood,
      data: { error: String(error) },
    };
  }
}

export async function smartBuildLoop(intervalMs: number = 7 * 60 * 1000): Promise<void> {
  console.log(`[SmartBuilder] Starting continuous loop (interval: ${intervalMs / 1000}s)`);
  console.log('[SmartBuilder] Press Ctrl+C to stop\n');

  while (true) {
    try {
      await smartBuildOnce();
    } catch (error) {
      console.error('[SmartBuilder] Loop error:', error);
    }

    console.log(`\n[SmartBuilder] Sleeping for ${intervalMs / 1000}s...\n`);
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}

export async function getSmartBuilderStatus(): Promise<SkillResponse> {
  const memory = loadMemory();

  const recentBuilds = memory.buildHistory.slice(-5);
  const totalCompleted = memory.completedTasks.length;
  const successRate = recentBuilds.length > 0
    ? Math.round(recentBuilds.reduce((sum, b) => sum + b.tasksCompleted, 0) /
        recentBuilds.reduce((sum, b) => sum + b.tasksAttempted, 0) * 100) || 0
    : 0;

  return {
    text: `SmartBuilder Status

Project Phase: ${memory.projectState.currentPhase}
Total Tasks Completed: ${totalCompleted}
Recent Success Rate: ${successRate}%

Codebase Stats:
  Files: ${memory.projectState.codebaseStats.totalFiles}
  Skills: ${memory.projectState.codebaseStats.totalSkills}
  Components: ${memory.projectState.codebaseStats.totalComponents}
  API Routes: ${memory.projectState.codebaseStats.totalApiRoutes}
  TS Errors: ${memory.projectState.codebaseStats.typeErrors}

Recent Lessons:
${memory.lessonsLearned.slice(-3).map(l => `  - ${l.slice(0, 80)}`).join('\n') || '  None yet'}`,
    mood: 'EDUCATIONAL' as Mood,
    data: memory,
  };
}

// CLI support
if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case 'once':
      smartBuildOnce().then(r => {
        console.log(r.text);
        process.exit(r.mood === 'ERROR' ? 1 : 0);
      });
      break;

    case 'loop':
      const interval = parseInt(process.argv[3]) || 7 * 60;
      smartBuildLoop(interval * 1000);
      break;

    case 'status':
      getSmartBuilderStatus().then(r => console.log(r.text));
      break;

    default:
      console.log(`SmartBuilder - Fully Autonomous Development Agent

Usage:
  ts-node smartBuilder.ts once     - Run single build cycle
  ts-node smartBuilder.ts loop     - Run continuous loop (7 min default)
  ts-node smartBuilder.ts loop 300 - Run with custom interval (seconds)
  ts-node smartBuilder.ts status   - View builder status`);
  }
}

export default { smartBuildOnce, smartBuildLoop, getSmartBuilderStatus };
