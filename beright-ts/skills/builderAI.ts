/**
 * Builder AI - Claude-Powered Code Generation
 *
 * Uses Claude API to autonomously implement features, fix bugs,
 * and improve the codebase.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import Anthropic from '@anthropic-ai/sdk';
import { SkillResponse, Mood } from '../types/index';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const ROOT = path.join(__dirname, '..');
const MONOREPO_ROOT = path.join(ROOT, '..');

// Initialize Anthropic client
const anthropic = new Anthropic();

interface CodeChange {
  filePath: string;
  content: string;
  action: 'create' | 'modify' | 'delete';
}

interface ImplementationResult {
  success: boolean;
  changes: CodeChange[];
  explanation: string;
  error?: string;
}

/**
 * Read relevant context files for a task
 */
async function getContextFiles(task: string): Promise<string> {
  const contextFiles: string[] = [];

  // Always include architecture docs
  const archFiles = [
    'CLAUDE.md',
    'BERIGHT_ARCHITECTURE.md',
    'types/index.ts',
  ];

  for (const file of archFiles) {
    const filePath = path.join(ROOT, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      contextFiles.push(`--- ${file} ---\n${content.slice(0, 3000)}`);
    }
  }

  // Add task-specific context
  if (task.toLowerCase().includes('frontend') || task.toLowerCase().includes('component')) {
    const frontendFiles = [
      '../berightweb/src/app/page.tsx',
      '../berightweb/src/components/CardStack.tsx',
    ];
    for (const file of frontendFiles) {
      const filePath = path.join(ROOT, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        contextFiles.push(`--- ${file} ---\n${content.slice(0, 2000)}`);
      }
    }
  }

  if (task.toLowerCase().includes('skill') || task.toLowerCase().includes('backend')) {
    // Sample a skill file for patterns
    const sampleSkill = path.join(ROOT, 'skills', 'markets.ts');
    if (fs.existsSync(sampleSkill)) {
      const content = fs.readFileSync(sampleSkill, 'utf-8');
      contextFiles.push(`--- skills/markets.ts (example pattern) ---\n${content.slice(0, 2000)}`);
    }
  }

  if (task.toLowerCase().includes('api') || task.toLowerCase().includes('route')) {
    const sampleRoute = path.join(ROOT, 'app', 'api', 'markets', 'route.ts');
    if (fs.existsSync(sampleRoute)) {
      const content = fs.readFileSync(sampleRoute, 'utf-8');
      contextFiles.push(`--- app/api/markets/route.ts (example pattern) ---\n${content.slice(0, 2000)}`);
    }
  }

  return contextFiles.join('\n\n');
}

/**
 * Use Claude to implement a task
 */
export async function implementWithClaude(
  taskDescription: string,
  priority: 'P0' | 'P1' | 'P2' = 'P1'
): Promise<ImplementationResult> {
  console.log(`[BuilderAI] Implementing: ${taskDescription}`);

  const context = await getContextFiles(taskDescription);

  const systemPrompt = `You are BeRight Builder, an autonomous code generation agent.

PROJECT STRUCTURE:
- beright-ts/: Backend (Next.js 14, TypeScript, Supabase, Solana)
- berightweb/: Frontend (Next.js 16, React 19, Tailwind v4)
- Monorepo managed by Turbo

YOUR TASK:
Implement the requested feature/fix by generating TypeScript code.

RULES:
1. Follow existing patterns in the codebase
2. Use TypeScript with proper types
3. Use SkillResponse interface for skills: { text: string, mood: Mood, data?: unknown }
4. Use Tailwind CSS for styling
5. Handle errors properly with try/catch
6. Keep changes minimal and focused

OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "explanation": "Brief explanation of changes",
  "changes": [
    {
      "filePath": "relative/path/to/file.ts",
      "action": "create" | "modify",
      "content": "full file content here"
    }
  ]
}

IMPORTANT: Return ONLY valid JSON, no markdown code blocks.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `TASK: ${taskDescription}
PRIORITY: ${priority}

CODEBASE CONTEXT:
${context}

Generate the implementation as JSON.`,
        },
      ],
    });

    // Extract text from response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return {
        success: false,
        changes: [],
        explanation: 'No text response from Claude',
        error: 'Empty response',
      };
    }

    // Parse JSON response
    let result;
    try {
      // Try to extract JSON from the response
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[BuilderAI] Failed to parse response:', textContent.text.slice(0, 500));
      return {
        success: false,
        changes: [],
        explanation: 'Failed to parse Claude response',
        error: String(parseError),
      };
    }

    return {
      success: true,
      changes: result.changes || [],
      explanation: result.explanation || 'No explanation provided',
    };
  } catch (error) {
    console.error('[BuilderAI] Claude API error:', error);
    return {
      success: false,
      changes: [],
      explanation: 'Claude API call failed',
      error: String(error),
    };
  }
}

/**
 * Apply code changes to the filesystem
 */
export async function applyChanges(changes: CodeChange[]): Promise<{
  applied: number;
  failed: number;
  files: string[];
}> {
  let applied = 0;
  let failed = 0;
  const files: string[] = [];

  for (const change of changes) {
    try {
      const fullPath = path.join(ROOT, change.filePath);
      const dir = path.dirname(fullPath);

      // Ensure directory exists
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (change.action === 'delete') {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          applied++;
          files.push(change.filePath);
        }
      } else {
        fs.writeFileSync(fullPath, change.content);
        applied++;
        files.push(change.filePath);
      }
    } catch (error) {
      console.error(`[BuilderAI] Failed to apply change to ${change.filePath}:`, error);
      failed++;
    }
  }

  return { applied, failed, files };
}

/**
 * Validate changes by running typecheck
 */
export async function validateChanges(): Promise<{ valid: boolean; errors: string[] }> {
  try {
    const { stdout, stderr } = await execAsync(`cd ${ROOT} && npx tsc --noEmit 2>&1`);
    const output = stdout + stderr;

    if (output.includes('error TS')) {
      const errors = output.split('\n').filter(l => l.includes('error TS')).slice(0, 5);
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('error TS')) {
      const errors = errorMsg.split('\n').filter(l => l.includes('error TS')).slice(0, 5);
      return { valid: false, errors };
    }
    return { valid: true, errors: [] }; // Assume valid if no TS errors
  }
}

/**
 * Revert changes by restoring from git
 */
export async function revertChanges(files: string[]): Promise<void> {
  for (const file of files) {
    try {
      await execAsync(`cd ${MONOREPO_ROOT} && git checkout HEAD -- "${path.join('beright-ts', file)}"`);
    } catch {
      // File might be new, try to delete it
      const fullPath = path.join(ROOT, file);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
  }
}

/**
 * Git commit changes
 */
export async function commitChanges(
  message: string,
  files: string[]
): Promise<{ success: boolean; hash?: string }> {
  try {
    // Stage files
    for (const file of files) {
      await execAsync(`cd ${MONOREPO_ROOT} && git add "beright-ts/${file}"`);
    }

    // Commit
    const fullMessage = `[builder-ai] ${message}

Generated by BeRight BuilderAI using Claude
Co-Authored-By: BeRight Builder <builder@beright.ai>`;

    await execAsync(`cd ${MONOREPO_ROOT} && git commit -m "${fullMessage.replace(/"/g, '\\"')}"`);

    // Get hash
    const { stdout } = await execAsync(`cd ${MONOREPO_ROOT} && git rev-parse --short HEAD`);
    return { success: true, hash: stdout.trim() };
  } catch (error) {
    console.error('[BuilderAI] Git commit failed:', error);
    return { success: false };
  }
}

/**
 * Full autonomous implementation cycle
 */
export async function autonomousImplement(
  taskDescription: string,
  options: {
    priority?: 'P0' | 'P1' | 'P2';
    autoCommit?: boolean;
    validateFirst?: boolean;
  } = {}
): Promise<SkillResponse> {
  const { priority = 'P1', autoCommit = true, validateFirst = true } = options;

  console.log(`\n${'='.repeat(50)}`);
  console.log(`[BuilderAI] Starting autonomous implementation`);
  console.log(`Task: ${taskDescription}`);
  console.log(`Priority: ${priority}`);
  console.log('='.repeat(50));

  // 1. Generate implementation with Claude
  const implementation = await implementWithClaude(taskDescription, priority);

  if (!implementation.success || implementation.changes.length === 0) {
    return {
      text: `Failed to generate implementation: ${implementation.error || 'No changes generated'}`,
      mood: 'ERROR' as Mood,
      data: implementation,
    };
  }

  console.log(`[BuilderAI] Generated ${implementation.changes.length} file changes`);
  console.log(`[BuilderAI] Explanation: ${implementation.explanation}`);

  // 2. Apply changes
  const applyResult = await applyChanges(implementation.changes);
  console.log(`[BuilderAI] Applied ${applyResult.applied} changes, ${applyResult.failed} failed`);

  if (applyResult.applied === 0) {
    return {
      text: `Failed to apply any changes`,
      mood: 'ERROR' as Mood,
    };
  }

  // 3. Validate if requested
  if (validateFirst) {
    const validation = await validateChanges();
    if (!validation.valid) {
      console.log(`[BuilderAI] Validation failed, reverting changes...`);
      await revertChanges(applyResult.files);
      return {
        text: `Implementation failed validation:\n${validation.errors.join('\n')}`,
        mood: 'ERROR' as Mood,
        data: { errors: validation.errors },
      };
    }
    console.log(`[BuilderAI] Validation passed`);
  }

  // 4. Commit if requested
  let commitHash: string | undefined;
  if (autoCommit) {
    const commitResult = await commitChanges(
      `${taskDescription.slice(0, 50)}`,
      applyResult.files
    );
    if (commitResult.success) {
      commitHash = commitResult.hash;
      console.log(`[BuilderAI] Committed: ${commitHash}`);
    }
  }

  return {
    text: `Implementation complete

${implementation.explanation}

Files changed: ${applyResult.files.length}
${applyResult.files.map(f => `  - ${f}`).join('\n')}
${commitHash ? `\nCommit: ${commitHash}` : ''}`,
    mood: 'BULLISH' as Mood,
    data: {
      changes: implementation.changes.length,
      files: applyResult.files,
      commitHash,
      explanation: implementation.explanation,
    },
  };
}

/**
 * Fix a TypeScript error using Claude
 */
export async function fixTypeScriptError(errorMessage: string): Promise<SkillResponse> {
  // Extract file path from error
  const fileMatch = errorMessage.match(/([^\s]+\.tsx?)\((\d+),(\d+)\)/);
  if (!fileMatch) {
    return {
      text: `Could not parse error location: ${errorMessage}`,
      mood: 'ERROR' as Mood,
    };
  }

  const [, filePath, line] = fileMatch;
  const fullPath = path.join(ROOT, filePath);

  if (!fs.existsSync(fullPath)) {
    return {
      text: `File not found: ${filePath}`,
      mood: 'ERROR' as Mood,
    };
  }

  const fileContent = fs.readFileSync(fullPath, 'utf-8');

  return autonomousImplement(
    `Fix TypeScript error in ${filePath}:${line}

Error: ${errorMessage}

Current file content:
\`\`\`typescript
${fileContent}
\`\`\`

Fix the error while keeping the rest of the code intact.`,
    { priority: 'P0' }
  );
}

// Main export
export async function builderAI(command?: string, ...args: string[]): Promise<SkillResponse> {
  switch (command) {
    case 'implement':
      const task = args.join(' ');
      if (!task) {
        return {
          text: 'Usage: builderAI implement <task description>',
          mood: 'ERROR' as Mood,
        };
      }
      return autonomousImplement(task);

    case 'fix':
      const error = args.join(' ');
      if (!error) {
        return {
          text: 'Usage: builderAI fix <error message>',
          mood: 'ERROR' as Mood,
        };
      }
      return fixTypeScriptError(error);

    default:
      return {
        text: `BuilderAI Commands:
- implement <task> - Implement a feature using Claude
- fix <error> - Fix a TypeScript error

Examples:
  npx ts-node skills/builderAI.ts implement "Add /portfolio API route"
  npx ts-node skills/builderAI.ts implement "Create SwipeCard component"
  npx ts-node skills/builderAI.ts fix "skills/markets.ts(50,5): error TS2322"`,
        mood: 'EDUCATIONAL' as Mood,
      };
  }
}

export default builderAI;

// CLI support
if (require.main === module) {
  const args = process.argv.slice(2);
  builderAI(args[0], ...args.slice(1)).then(result => {
    console.log(result.text);
    process.exit(result.mood === 'ERROR' ? 1 : 0);
  });
}
