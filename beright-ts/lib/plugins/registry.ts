/**
 * Plugin Registry
 * Central registry for all BeRight plugins (OpenClaw-compatible)
 *
 * Design principles:
 * - Manifest-first: Read metadata before loading code
 * - Lazy loading: Only load plugin code when needed
 * - Capability-based: Plugins declare what they provide
 * - Fail-safe: Missing plugins degrade gracefully
 */

import {
  PluginManifest,
  PluginEntry,
  PluginAPI,
  PluginCapability,
  DataSourcePlugin,
  ExecutionPlugin,
  NotificationPlugin,
  AgentTool,
} from './types';

// ============================================================================
// PLUGIN REGISTRY
// ============================================================================

class PluginRegistry {
  private manifests: Map<string, PluginManifest> = new Map();
  private plugins: Map<string, PluginEntry> = new Map();
  private dataSources: Map<string, DataSourcePlugin> = new Map();
  private executionEngines: Map<string, ExecutionPlugin> = new Map();
  private notificationChannels: Map<string, NotificationPlugin> = new Map();
  private tools: Map<string, AgentTool> = new Map();
  private config: Map<string, unknown> = new Map();

  /**
   * Register a plugin manifest (metadata only, no code loaded)
   */
  registerManifest(manifest: PluginManifest): void {
    if (this.manifests.has(manifest.id)) {
      console.warn(`Plugin ${manifest.id} already registered, skipping`);
      return;
    }

    // Validate required env vars
    if (manifest.requires?.env) {
      const missing = manifest.requires.env.filter(v => !process.env[v]);
      if (missing.length > 0) {
        console.warn(`Plugin ${manifest.id} missing env vars: ${missing.join(', ')}`);
      }
    }

    this.manifests.set(manifest.id, manifest);
    console.log(`[Registry] Registered manifest: ${manifest.id} (${manifest.provides.join(', ')})`);
  }

  /**
   * Load and initialize a plugin
   */
  async loadPlugin(entry: PluginEntry): Promise<void> {
    const { manifest } = entry;

    if (!this.manifests.has(manifest.id)) {
      this.registerManifest(manifest);
    }

    // Check dependencies
    if (manifest.requires?.plugins) {
      for (const dep of manifest.requires.plugins) {
        if (!this.plugins.has(dep)) {
          throw new Error(`Plugin ${manifest.id} requires ${dep} which is not loaded`);
        }
      }
    }

    // Create plugin API
    const api = this.createPluginAPI(manifest.id);

    // Initialize plugin
    await entry.register(api);

    this.plugins.set(manifest.id, entry);
    console.log(`[Registry] Loaded plugin: ${manifest.id}`);
  }

  /**
   * Create API for a specific plugin
   */
  private createPluginAPI(pluginId: string): PluginAPI {
    return {
      registerDataSource: (source: DataSourcePlugin) => {
        this.dataSources.set(source.id, source);
        console.log(`[${pluginId}] Registered data source: ${source.id}`);
      },

      registerExecutionEngine: (engine: ExecutionPlugin) => {
        this.executionEngines.set(engine.id, engine);
        console.log(`[${pluginId}] Registered execution engine: ${engine.id}`);
      },

      registerTool: (tool: AgentTool) => {
        this.tools.set(tool.name, tool);
        console.log(`[${pluginId}] Registered tool: ${tool.name}`);
      },

      registerNotificationChannel: (channel: NotificationPlugin) => {
        this.notificationChannels.set(channel.id, channel);
        console.log(`[${pluginId}] Registered notification channel: ${channel.id}`);
      },

      getConfig: <T>(key: string): T | undefined => {
        return this.config.get(key) as T | undefined;
      },

      log: (level, message, meta) => {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${pluginId}]`;

        switch (level) {
          case 'debug':
            console.debug(prefix, message, meta || '');
            break;
          case 'info':
            console.log(prefix, message, meta || '');
            break;
          case 'warn':
            console.warn(prefix, message, meta || '');
            break;
          case 'error':
            console.error(prefix, message, meta || '');
            break;
        }
      },
    };
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  /**
   * Get all registered manifests
   */
  getManifests(): PluginManifest[] {
    return Array.from(this.manifests.values());
  }

  /**
   * Get plugins by capability
   */
  getPluginsByCapability(capability: PluginCapability): PluginManifest[] {
    return Array.from(this.manifests.values())
      .filter(m => m.provides.includes(capability));
  }

  /**
   * Get all data sources
   */
  getDataSources(): DataSourcePlugin[] {
    return Array.from(this.dataSources.values());
  }

  /**
   * Get data source by ID
   */
  getDataSource(id: string): DataSourcePlugin | undefined {
    return this.dataSources.get(id);
  }

  /**
   * Get all execution engines
   */
  getExecutionEngines(): ExecutionPlugin[] {
    return Array.from(this.executionEngines.values());
  }

  /**
   * Get execution engine for platform
   */
  getExecutionEngine(platform: string): ExecutionPlugin | undefined {
    return Array.from(this.executionEngines.values())
      .find(e => e.platforms.includes(platform));
  }

  /**
   * Get all registered tools
   */
  getTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools allowed for an agent
   */
  getToolsForAgent(agentId: string): AgentTool[] {
    return Array.from(this.tools.values())
      .filter(t => !t.allowedAgents || t.allowedAgents.includes(agentId));
  }

  /**
   * Get tool by name
   */
  getTool(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get notification channel
   */
  getNotificationChannel(id: string): NotificationPlugin | undefined {
    return this.notificationChannels.get(id);
  }

  /**
   * Set configuration value
   */
  setConfig(key: string, value: unknown): void {
    this.config.set(key, value);
  }

  /**
   * Get registry stats
   */
  getStats(): RegistryStats {
    return {
      manifests: this.manifests.size,
      loadedPlugins: this.plugins.size,
      dataSources: this.dataSources.size,
      executionEngines: this.executionEngines.size,
      notificationChannels: this.notificationChannels.size,
      tools: this.tools.size,
    };
  }
}

export interface RegistryStats {
  manifests: number;
  loadedPlugins: number;
  dataSources: number;
  executionEngines: number;
  notificationChannels: number;
  tools: number;
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const registry = new PluginRegistry();
export default registry;
