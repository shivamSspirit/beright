/**
 * Plugin System Entry Point
 *
 * Usage:
 * ```typescript
 * import { registry, definePluginEntry } from './lib/plugins';
 *
 * // Define a plugin
 * const myPlugin = definePluginEntry({
 *   manifest: {
 *     id: 'my-plugin',
 *     name: 'My Plugin',
 *     version: '1.0.0',
 *     provides: ['data-source'],
 *   },
 *   register(api) {
 *     api.registerDataSource({...});
 *   }
 * });
 *
 * // Load plugins
 * await registry.loadPlugin(myPlugin);
 *
 * // Use plugins
 * const sources = registry.getDataSources();
 * ```
 */

export { registry, type RegistryStats } from './registry';
export { definePluginEntry } from './types';
export type {
  PluginManifest,
  PluginEntry,
  PluginAPI,
  PluginCapability,
  DataSourcePlugin,
  ExecutionPlugin,
  NotificationPlugin,
  AgentTool,
  Market,
  Quote,
  QuoteParams,
  ExecuteParams,
  ExecutionResult,
  Position,
  NotificationOptions,
} from './types';

// ============================================================================
// BUILT-IN PLUGIN LOADER
// ============================================================================

import { registry } from './registry';

/**
 * Load all built-in plugins
 * Call this at application startup
 */
export async function loadBuiltinPlugins(): Promise<void> {
  console.log('[Plugins] Loading built-in plugins...');

  // Register manifests for documentation (even if not fully implemented)
  const builtinManifests = [
    {
      id: 'data-fabric',
      name: 'Data Fabric',
      description: 'Unified market data across all prediction platforms',
      version: '2.0.0',
      provides: ['data-source'] as const,
      requires: {
        env: [],
      },
    },
    {
      id: 'polymarket',
      name: 'Polymarket',
      description: 'Polymarket prediction market integration',
      version: '1.0.0',
      provides: ['data-source', 'execution'] as const,
      requires: {
        env: [],
      },
    },
    {
      id: 'kalshi',
      name: 'Kalshi',
      description: 'Kalshi regulated prediction market',
      version: '1.0.0',
      provides: ['data-source', 'execution'] as const,
      requires: {
        env: ['KALSHI_API_KEY', 'KALSHI_API_SECRET'],
      },
    },
    {
      id: 'jupiter',
      name: 'Jupiter',
      description: 'Jupiter prediction market aggregator (Solana)',
      version: '1.0.0',
      provides: ['data-source', 'execution'] as const,
      requires: {
        env: ['SOLANA_PRIVATE_KEY'],
      },
    },
    {
      id: 'dflow',
      name: 'DFlow',
      description: 'DFlow tokenized Kalshi markets',
      version: '1.0.0',
      provides: ['data-source', 'execution'] as const,
      requires: {
        env: [],
      },
    },
    {
      id: 'manifold',
      name: 'Manifold Markets',
      description: 'Manifold play-money prediction market',
      version: '1.0.0',
      provides: ['data-source'] as const,
      requires: {
        env: [],
      },
    },
    {
      id: 'telegram',
      name: 'Telegram',
      description: 'Telegram bot notifications',
      version: '1.0.0',
      provides: ['notification'] as const,
      requires: {
        env: ['TELEGRAM_BOT_TOKEN'],
      },
    },
    {
      id: 'anthropic',
      name: 'Anthropic Claude',
      description: 'Claude LLM provider',
      version: '1.0.0',
      provides: ['llm-provider'] as const,
      requires: {
        env: ['ANTHROPIC_API_KEY'],
      },
    },
    {
      id: 'groq',
      name: 'Groq',
      description: 'Groq fast inference provider',
      version: '1.0.0',
      provides: ['llm-provider'] as const,
      requires: {
        env: ['GROQ_API_KEY'],
      },
    },
  ];

  for (const manifest of builtinManifests) {
    registry.registerManifest(manifest);
  }

  const stats = registry.getStats();
  console.log(`[Plugins] Registered ${stats.manifests} plugin manifests`);
}

/**
 * Get plugin status report
 */
export function getPluginStatus(): string {
  const stats = registry.getStats();
  const manifests = registry.getManifests();

  const lines = [
    '## Plugin Status',
    '',
    `Total Manifests: ${stats.manifests}`,
    `Loaded Plugins: ${stats.loadedPlugins}`,
    `Data Sources: ${stats.dataSources}`,
    `Execution Engines: ${stats.executionEngines}`,
    `Tools: ${stats.tools}`,
    '',
    '### Registered Plugins',
    '',
  ];

  for (const m of manifests) {
    const envStatus = m.requires?.env?.map(v =>
      process.env[v] ? `${v}` : `${v} (missing)`
    ).join(', ') || 'none';

    lines.push(`- **${m.name}** (${m.id})`);
    lines.push(`  - Provides: ${m.provides.join(', ')}`);
    lines.push(`  - Env: ${envStatus}`);
  }

  return lines.join('\n');
}
