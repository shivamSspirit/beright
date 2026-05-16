/**
 * Backend Development Skill
 *
 * Helps Builder agent create and modify TypeScript skills,
 * API routes, and backend infrastructure.
 */

import { SkillResponse, Mood } from '../types/index';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const BACKEND_ROOT = path.join(__dirname, '..');
const SKILLS_DIR = path.join(BACKEND_ROOT, 'skills');
const API_DIR = path.join(BACKEND_ROOT, 'app', 'api');
const LIB_DIR = path.join(BACKEND_ROOT, 'lib');
const TYPES_DIR = path.join(BACKEND_ROOT, 'types');

// Skill template
const SKILL_TEMPLATE = (name: string, description: string) => `/**
 * ${name} Skill
 *
 * ${description}
 */

import { SkillResponse, Mood } from '../types/index';

/**
 * Main skill function
 */
export async function ${name.toLowerCase()}(command?: string, ...args: string[]): Promise<SkillResponse> {
  try {
    // TODO: Implement skill logic

    return {
      text: \`${name} skill executed successfully\`,
      mood: 'NEUTRAL' as Mood,
      data: { command, args },
    };
  } catch (error) {
    return {
      text: \`${name} skill error: \${error}\`,
      mood: 'ERROR' as Mood,
    };
  }
}

export default ${name.toLowerCase()};

// CLI support
if (require.main === module) {
  const args = process.argv.slice(2);
  ${name.toLowerCase()}(args[0], ...args.slice(1)).then(result => {
    console.log(result.text);
    process.exit(result.mood === 'ERROR' ? 1 : 0);
  });
}
`;

// API route template
const API_ROUTE_TEMPLATE = (name: string) => `import { NextRequest, NextResponse } from 'next/server';
import { withApiMiddleware } from '@/lib/apiMiddleware';
import logger from '@/lib/logger';

async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  try {
    // TODO: Implement API logic

    return NextResponse.json({
      success: true,
      data: {},
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error, route: '${name}' }, 'API error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withApiMiddleware(handler, { rateLimit: true });
`;

/**
 * Create a new skill file
 */
export async function createSkill(
  name: string,
  description: string = 'New skill'
): Promise<SkillResponse> {
  const skillPath = path.join(SKILLS_DIR, `${name}.ts`);

  if (fs.existsSync(skillPath)) {
    return {
      text: `Skill ${name} already exists`,
      mood: 'ERROR' as Mood,
    };
  }

  try {
    const content = SKILL_TEMPLATE(name, description);
    fs.writeFileSync(skillPath, content);

    return {
      text: `Created skill: ${skillPath}`,
      mood: 'BULLISH' as Mood,
      data: { path: skillPath, name },
    };
  } catch (error) {
    return {
      text: `Failed to create skill: ${error}`,
      mood: 'ERROR' as Mood,
    };
  }
}

/**
 * Create a new API route
 */
export async function createApiRoute(
  routeName: string
): Promise<SkillResponse> {
  const routeDir = path.join(API_DIR, routeName);
  const routePath = path.join(routeDir, 'route.ts');

  if (fs.existsSync(routePath)) {
    return {
      text: `API route ${routeName} already exists`,
      mood: 'ERROR' as Mood,
    };
  }

  try {
    if (!fs.existsSync(routeDir)) {
      fs.mkdirSync(routeDir, { recursive: true });
    }

    const content = API_ROUTE_TEMPLATE(routeName);
    fs.writeFileSync(routePath, content);

    return {
      text: `Created API route: /api/${routeName}`,
      mood: 'BULLISH' as Mood,
      data: { path: routePath, route: `/api/${routeName}` },
    };
  } catch (error) {
    return {
      text: `Failed to create API route: ${error}`,
      mood: 'ERROR' as Mood,
    };
  }
}

/**
 * List all skills
 */
export async function listSkills(): Promise<SkillResponse> {
  try {
    const files = fs.readdirSync(SKILLS_DIR)
      .filter(f => f.endsWith('.ts') && !f.includes('.test.'))
      .map(f => f.replace('.ts', ''));

    return {
      text: `Found ${files.length} skills:\n${files.map(f => `- ${f}`).join('\n')}`,
      mood: 'NEUTRAL' as Mood,
      data: { skills: files },
    };
  } catch (error) {
    return {
      text: `Failed to list skills: ${error}`,
      mood: 'ERROR' as Mood,
    };
  }
}

/**
 * List all API routes
 */
export async function listApiRoutes(): Promise<SkillResponse> {
  const routes: string[] = [];

  function scanDir(dir: string, prefix: string = '/api') {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const routeFile = path.join(dir, entry.name, 'route.ts');
          if (fs.existsSync(routeFile)) {
            routes.push(`${prefix}/${entry.name}`);
          }
          scanDir(path.join(dir, entry.name), `${prefix}/${entry.name}`);
        }
      }
    } catch {}
  }

  scanDir(API_DIR);

  return {
    text: `Found ${routes.length} API routes:\n${routes.map(r => `- ${r}`).join('\n')}`,
    mood: 'NEUTRAL' as Mood,
    data: { routes },
  };
}

/**
 * Run TypeScript type check
 */
export async function typeCheck(): Promise<SkillResponse> {
  try {
    const { stdout, stderr } = await execAsync(`cd ${BACKEND_ROOT} && npx tsc --noEmit 2>&1`);
    const output = stdout + stderr;

    if (output.includes('error')) {
      const errors = output.match(/error TS\d+/g) || [];
      return {
        text: `TypeScript errors found: ${errors.length}\n\n${output.slice(0, 2000)}`,
        mood: 'ERROR' as Mood,
        data: { errorCount: errors.length, output },
      };
    }

    return {
      text: 'Backend type check passed',
      mood: 'BULLISH' as Mood,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // TypeScript errors come through stderr which throws
    if (errorMsg.includes('error TS')) {
      const errors = errorMsg.match(/error TS\d+/g) || [];
      return {
        text: `TypeScript errors found: ${errors.length}\n\n${errorMsg.slice(0, 2000)}`,
        mood: 'ERROR' as Mood,
        data: { errorCount: errors.length },
      };
    }
    return {
      text: `Type check failed: ${error}`,
      mood: 'ERROR' as Mood,
    };
  }
}

/**
 * Run backend build
 */
export async function build(): Promise<SkillResponse> {
  try {
    const { stdout, stderr } = await execAsync(`cd ${BACKEND_ROOT} && npm run build 2>&1`, {
      timeout: 120000,
    });

    const output = stdout + stderr;

    if (output.includes('Error') && !output.includes('0 Error')) {
      return {
        text: `Backend build failed:\n${output.slice(-1500)}`,
        mood: 'ERROR' as Mood,
        data: { output },
      };
    }

    return {
      text: 'Backend build successful',
      mood: 'BULLISH' as Mood,
    };
  } catch (error) {
    return {
      text: `Build failed: ${error}`,
      mood: 'ERROR' as Mood,
    };
  }
}

/**
 * Find TODOs in backend code
 */
export async function findTodos(): Promise<SkillResponse> {
  const todos: Array<{ file: string; line: number; text: string }> = [];

  function scanFile(filePath: string) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        if (line.includes('TODO') || line.includes('FIXME')) {
          todos.push({
            file: path.relative(BACKEND_ROOT, filePath),
            line: idx + 1,
            text: line.trim().slice(0, 100),
          });
        }
      });
    } catch {}
  }

  function scanDir(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.includes('node_modules')) {
          scanDir(fullPath);
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          scanFile(fullPath);
        }
      }
    } catch {}
  }

  scanDir(SKILLS_DIR);
  scanDir(LIB_DIR);
  scanDir(API_DIR);

  const output = todos.slice(0, 20).map(t => `- ${t.file}:${t.line}: ${t.text}`).join('\n');

  return {
    text: `Found ${todos.length} TODOs:\n${output}${todos.length > 20 ? '\n...(truncated)' : ''}`,
    mood: todos.length > 0 ? 'ALERT' as Mood : 'BULLISH' as Mood,
    data: { todos, count: todos.length },
  };
}

/**
 * Analyze backend for issues
 */
export async function analyze(): Promise<SkillResponse> {
  const issues: string[] = [];

  // Check for skills without proper error handling
  try {
    const skills = fs.readdirSync(SKILLS_DIR)
      .filter(f => f.endsWith('.ts') && !f.includes('.test.'));

    for (const skill of skills) {
      const content = fs.readFileSync(path.join(SKILLS_DIR, skill), 'utf-8');

      // Check for try/catch
      if (!content.includes('try {') && !content.includes('try{')) {
        issues.push(`Missing error handling: ${skill}`);
      }

      // Check for proper typing
      if (content.includes(': any') || content.includes(':any')) {
        issues.push(`Uses 'any' type: ${skill}`);
      }

      // Check for SkillResponse return
      if (!content.includes('SkillResponse')) {
        issues.push(`Missing SkillResponse type: ${skill}`);
      }
    }
  } catch {}

  // Check API routes
  try {
    const checkRoute = (routeDir: string) => {
      const routePath = path.join(API_DIR, routeDir, 'route.ts');
      if (fs.existsSync(routePath)) {
        const content = fs.readFileSync(routePath, 'utf-8');
        if (!content.includes('withApiMiddleware')) {
          issues.push(`API route missing middleware: ${routeDir}`);
        }
      }
    };

    fs.readdirSync(API_DIR, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .forEach(e => checkRoute(e.name));
  } catch {}

  return {
    text: issues.length > 0
      ? `Found ${issues.length} backend issues:\n${issues.map(i => `- ${i}`).join('\n')}`
      : 'Backend analysis complete - no issues found',
    mood: issues.length > 0 ? 'ALERT' as Mood : 'BULLISH' as Mood,
    data: { issues },
  };
}

/**
 * Get untested skills
 */
export async function getUntestedSkills(): Promise<SkillResponse> {
  try {
    const skills = fs.readdirSync(SKILLS_DIR)
      .filter(f => f.endsWith('.ts') && !f.includes('.test.') && !f.includes('SKILL'))
      .map(f => f.replace('.ts', ''));

    const untested = skills.filter(skill => {
      const testPath = path.join(SKILLS_DIR, `${skill}.test.ts`);
      return !fs.existsSync(testPath);
    });

    return {
      text: `Found ${untested.length} untested skills:\n${untested.map(s => `- ${s}`).join('\n')}`,
      mood: untested.length > 0 ? 'ALERT' as Mood : 'BULLISH' as Mood,
      data: { untested, total: skills.length },
    };
  } catch (error) {
    return {
      text: `Failed to check tests: ${error}`,
      mood: 'ERROR' as Mood,
    };
  }
}

// Main export
export async function devBackend(command?: string, ...args: string[]): Promise<SkillResponse> {
  switch (command) {
    case 'skill':
      return createSkill(args[0], args[1]);
    case 'api':
      return createApiRoute(args[0]);
    case 'list-skills':
      return listSkills();
    case 'list-api':
      return listApiRoutes();
    case 'typecheck':
      return typeCheck();
    case 'build':
      return build();
    case 'todos':
      return findTodos();
    case 'analyze':
      return analyze();
    case 'untested':
      return getUntestedSkills();
    default:
      return {
        text: `Backend Dev Skill Commands:
- skill <name> [description] - Create new skill
- api <route> - Create new API route
- list-skills - List all skills
- list-api - List all API routes
- typecheck - Run TypeScript check
- build - Run production build
- todos - Find all TODOs
- analyze - Find code issues
- untested - Find skills without tests`,
        mood: 'EDUCATIONAL' as Mood,
      };
  }
}

export default devBackend;

// CLI support
if (require.main === module) {
  const args = process.argv.slice(2);
  devBackend(args[0], ...args.slice(1)).then(result => {
    console.log(result.text);
    process.exit(result.mood === 'ERROR' ? 1 : 0);
  });
}
