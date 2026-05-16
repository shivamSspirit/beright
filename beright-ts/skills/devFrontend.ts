/**
 * Frontend Development Skill
 *
 * Helps Builder agent create and modify React/Next.js components
 * in the berightweb frontend.
 */

import { SkillResponse, Mood } from '../types/index';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const FRONTEND_ROOT = path.join(__dirname, '..', '..', 'berightweb');
const COMPONENTS_DIR = path.join(FRONTEND_ROOT, 'src', 'components');
const PAGES_DIR = path.join(FRONTEND_ROOT, 'src', 'app');

// Component templates
const COMPONENT_TEMPLATE = (name: string, props: string = '') => `'use client';

import React from 'react';

interface ${name}Props {
  ${props || '// Add props here'}
}

export function ${name}({ ${props ? props.split(':')[0] : ''} }: ${name}Props) {
  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold">${name}</h2>
      {/* Add component content */}
    </div>
  );
}

export default ${name};
`;

const PAGE_TEMPLATE = (pageName: string, title: string) => `import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '${title} | BeRight Protocol',
  description: '${title} page for BeRight Protocol',
};

export default function ${pageName}Page() {
  return (
    <main className="min-h-screen bg-black text-white p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">${title}</h1>
        {/* Add page content */}
      </div>
    </main>
  );
}
`;

const HOOK_TEMPLATE = (hookName: string) => `import { useState, useEffect } from 'react';

export function ${hookName}() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Add fetch logic here
        setData(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { data, loading, error };
}

export default ${hookName};
`;

/**
 * Create a new React component
 */
export async function createComponent(
  name: string,
  props?: string,
  customContent?: string
): Promise<SkillResponse> {
  const componentPath = path.join(COMPONENTS_DIR, `${name}.tsx`);

  if (fs.existsSync(componentPath)) {
    return {
      text: `Component ${name} already exists at ${componentPath}`,
      mood: 'ERROR' as Mood,
    };
  }

  const content = customContent || COMPONENT_TEMPLATE(name, props);

  try {
    fs.writeFileSync(componentPath, content);
    return {
      text: `Created component: ${componentPath}`,
      mood: 'BULLISH' as Mood,
      data: { path: componentPath, name },
    };
  } catch (error) {
    return {
      text: `Failed to create component: ${error}`,
      mood: 'ERROR' as Mood,
    };
  }
}

/**
 * Create a new page in the app router
 */
export async function createPage(
  pageName: string,
  route: string,
  title: string,
  customContent?: string
): Promise<SkillResponse> {
  const pageDir = path.join(PAGES_DIR, route);
  const pagePath = path.join(pageDir, 'page.tsx');

  if (fs.existsSync(pagePath)) {
    return {
      text: `Page already exists at ${pagePath}`,
      mood: 'ERROR' as Mood,
    };
  }

  try {
    if (!fs.existsSync(pageDir)) {
      fs.mkdirSync(pageDir, { recursive: true });
    }

    const content = customContent || PAGE_TEMPLATE(pageName, title);
    fs.writeFileSync(pagePath, content);

    return {
      text: `Created page: ${pagePath}`,
      mood: 'BULLISH' as Mood,
      data: { path: pagePath, route },
    };
  } catch (error) {
    return {
      text: `Failed to create page: ${error}`,
      mood: 'ERROR' as Mood,
    };
  }
}

/**
 * Create a new custom hook
 */
export async function createHook(
  hookName: string,
  customContent?: string
): Promise<SkillResponse> {
  const hooksDir = path.join(FRONTEND_ROOT, 'src', 'hooks');
  const hookPath = path.join(hooksDir, `${hookName}.ts`);

  if (fs.existsSync(hookPath)) {
    return {
      text: `Hook ${hookName} already exists`,
      mood: 'ERROR' as Mood,
    };
  }

  try {
    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true });
    }

    const content = customContent || HOOK_TEMPLATE(hookName);
    fs.writeFileSync(hookPath, content);

    return {
      text: `Created hook: ${hookPath}`,
      mood: 'BULLISH' as Mood,
      data: { path: hookPath, name: hookName },
    };
  } catch (error) {
    return {
      text: `Failed to create hook: ${error}`,
      mood: 'ERROR' as Mood,
    };
  }
}

/**
 * List all existing components
 */
export async function listComponents(): Promise<SkillResponse> {
  try {
    const files = fs.readdirSync(COMPONENTS_DIR)
      .filter(f => f.endsWith('.tsx'))
      .map(f => f.replace('.tsx', ''));

    return {
      text: `Found ${files.length} components:\n${files.map(f => `- ${f}`).join('\n')}`,
      mood: 'NEUTRAL' as Mood,
      data: { components: files },
    };
  } catch (error) {
    return {
      text: `Failed to list components: ${error}`,
      mood: 'ERROR' as Mood,
    };
  }
}

/**
 * List all pages
 */
export async function listPages(): Promise<SkillResponse> {
  const pages: string[] = [];

  function scanDir(dir: string, prefix: string = '') {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('_')) {
          const hasPage = fs.existsSync(path.join(dir, entry.name, 'page.tsx'));
          if (hasPage) {
            pages.push(`${prefix}/${entry.name}`);
          }
          scanDir(path.join(dir, entry.name), `${prefix}/${entry.name}`);
        }
      }
    } catch {}
  }

  // Check root page
  if (fs.existsSync(path.join(PAGES_DIR, 'page.tsx'))) {
    pages.push('/');
  }

  scanDir(PAGES_DIR);

  return {
    text: `Found ${pages.length} pages:\n${pages.map(p => `- ${p}`).join('\n')}`,
    mood: 'NEUTRAL' as Mood,
    data: { pages },
  };
}

/**
 * Run frontend type check
 */
export async function typeCheck(): Promise<SkillResponse> {
  try {
    const { stdout, stderr } = await execAsync(`cd ${FRONTEND_ROOT} && npx tsc --noEmit 2>&1`);
    const output = stdout + stderr;

    if (output.includes('error')) {
      const errorCount = (output.match(/error TS/g) || []).length;
      return {
        text: `TypeScript errors found: ${errorCount}\n\n${output.slice(0, 1000)}`,
        mood: 'ERROR' as Mood,
        data: { errors: errorCount, output },
      };
    }

    return {
      text: 'Frontend type check passed',
      mood: 'BULLISH' as Mood,
    };
  } catch (error) {
    return {
      text: `Type check failed: ${error}`,
      mood: 'ERROR' as Mood,
    };
  }
}

/**
 * Run frontend build
 */
export async function build(): Promise<SkillResponse> {
  try {
    const { stdout, stderr } = await execAsync(`cd ${FRONTEND_ROOT} && npm run build 2>&1`, {
      timeout: 120000, // 2 minute timeout
    });

    const output = stdout + stderr;

    if (output.includes('error') || output.includes('Error')) {
      return {
        text: `Frontend build failed:\n${output.slice(-1000)}`,
        mood: 'ERROR' as Mood,
        data: { output },
      };
    }

    return {
      text: 'Frontend build successful',
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
 * Analyze frontend for missing/incomplete components
 */
export async function analyze(): Promise<SkillResponse> {
  const issues: string[] = [];

  // Check for empty components
  try {
    const components = fs.readdirSync(COMPONENTS_DIR)
      .filter(f => f.endsWith('.tsx'));

    for (const comp of components) {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, comp), 'utf-8');
      if (content.includes('// Add component content') || content.includes('TODO')) {
        issues.push(`Incomplete component: ${comp}`);
      }
    }
  } catch {}

  // Check for missing API connections
  const apiFile = path.join(FRONTEND_ROOT, 'src', 'lib', 'api.ts');
  if (fs.existsSync(apiFile)) {
    const apiContent = fs.readFileSync(apiFile, 'utf-8');
    if (apiContent.includes('mockData') || apiContent.includes('// TODO')) {
      issues.push('API client has mock data or TODOs');
    }
  }

  // Check if pages reference API
  try {
    const checkPage = (pagePath: string) => {
      if (fs.existsSync(pagePath)) {
        const content = fs.readFileSync(pagePath, 'utf-8');
        if (content.includes('mockData')) {
          issues.push(`Page using mock data: ${pagePath}`);
        }
      }
    };

    checkPage(path.join(PAGES_DIR, 'leaderboard', 'page.tsx'));
    checkPage(path.join(PAGES_DIR, 'markets', 'page.tsx'));
    checkPage(path.join(PAGES_DIR, 'profile', 'page.tsx'));
  } catch {}

  return {
    text: issues.length > 0
      ? `Found ${issues.length} frontend issues:\n${issues.map(i => `- ${i}`).join('\n')}`
      : 'Frontend analysis complete - no issues found',
    mood: issues.length > 0 ? 'ALERT' as Mood : 'BULLISH' as Mood,
    data: { issues },
  };
}

// Main export for CLI usage
export async function devFrontend(command?: string, ...args: string[]): Promise<SkillResponse> {
  switch (command) {
    case 'component':
      return createComponent(args[0], args[1]);
    case 'page':
      return createPage(args[0], args[1], args[2]);
    case 'hook':
      return createHook(args[0]);
    case 'list-components':
      return listComponents();
    case 'list-pages':
      return listPages();
    case 'typecheck':
      return typeCheck();
    case 'build':
      return build();
    case 'analyze':
      return analyze();
    default:
      return {
        text: `Frontend Dev Skill Commands:
- component <name> [props] - Create new component
- page <name> <route> <title> - Create new page
- hook <name> - Create new hook
- list-components - List all components
- list-pages - List all pages
- typecheck - Run TypeScript check
- build - Run production build
- analyze - Find issues`,
        mood: 'EDUCATIONAL' as Mood,
      };
  }
}

export default devFrontend;

// CLI support
if (require.main === module) {
  const args = process.argv.slice(2);
  devFrontend(args[0], ...args.slice(1)).then(result => {
    console.log(result.text);
    process.exit(result.mood === 'ERROR' ? 1 : 0);
  });
}
