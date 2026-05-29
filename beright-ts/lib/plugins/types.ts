/**
 * Plugin System Type Definitions
 * BeRight-compatible plugin architecture for BeRight Protocol
 */

// ============================================================================
// PLUGIN MANIFEST (control plane - metadata only)
// ============================================================================

export interface PluginManifest {
  /** Unique plugin identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Plugin description */
  description: string;

  /** Semantic version */
  version: string;

  /** Plugin author */
  author?: string;

  /** Plugin capabilities */
  provides: PluginCapability[];

  /** Required environment variables */
  requires?: {
    env?: string[];
    plugins?: string[];
  };

  /** Configuration schema (JSON Schema) */
  configSchema?: Record<string, unknown>;

  /** Plugin entry point (relative to manifest) */
  entry?: string;
}

// ============================================================================
// PLUGIN CAPABILITIES
// ============================================================================

export type PluginCapability =
  | 'data-source'      // Market data provider
  | 'execution'        // Trade execution
  | 'analysis'         // Analysis/ML tools
  | 'notification'     // Alert delivery
  | 'storage'          // Persistence layer
  | 'llm-provider'     // LLM integration
  | 'agent'            // Agent implementation
  | 'skill';           // Skill implementation

// ============================================================================
// PLUGIN REGISTRATION API
// ============================================================================

export interface PluginAPI {
  /** Register a data source */
  registerDataSource(source: DataSourcePlugin): void;

  /** Register an execution engine */
  registerExecutionEngine(engine: ExecutionPlugin): void;

  /** Register a tool for agents */
  registerTool(tool: AgentTool): void;

  /** Register a notification channel */
  registerNotificationChannel(channel: NotificationPlugin): void;

  /** Get configuration value */
  getConfig<T>(key: string): T | undefined;

  /** Log with plugin context */
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void;
}

// ============================================================================
// PLUGIN IMPLEMENTATIONS
// ============================================================================

export interface DataSourcePlugin {
  id: string;
  name: string;
  platforms: string[];

  /** Fetch markets from this source */
  fetchMarkets(query?: string): Promise<Market[]>;

  /** Fetch hot/trending markets */
  fetchHotMarkets(limit?: number): Promise<Market[]>;

  /** Health check */
  healthCheck(): Promise<boolean>;
}

export interface ExecutionPlugin {
  id: string;
  name: string;
  platforms: string[];

  /** Get quote for trade */
  getQuote(params: QuoteParams): Promise<Quote>;

  /** Execute trade */
  execute(params: ExecuteParams): Promise<ExecutionResult>;

  /** Get positions */
  getPositions(): Promise<Position[]>;
}

export interface NotificationPlugin {
  id: string;
  name: string;
  channel: 'telegram' | 'discord' | 'webhook' | 'email';

  /** Send notification */
  send(message: string, options?: NotificationOptions): Promise<boolean>;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
  allowedAgents?: string[];
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

// ============================================================================
// PLUGIN ENTRY POINT
// ============================================================================

export interface PluginEntry {
  manifest: PluginManifest;
  register: (api: PluginAPI) => void | Promise<void>;
}

export function definePluginEntry(entry: PluginEntry): PluginEntry {
  return entry;
}

// ============================================================================
// DATA TYPES
// ============================================================================

export interface Market {
  id: string;
  title: string;
  platform: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity?: number;
  closeDate?: Date;
  url: string;
}

export interface QuoteParams {
  marketId: string;
  side: 'yes' | 'no';
  amount: number;
  platform?: string;
}

export interface Quote {
  marketId: string;
  side: 'yes' | 'no';
  price: number;
  amount: number;
  fees: number;
  slippage: number;
  expiresAt: Date;
}

export interface ExecuteParams {
  quote: Quote;
  confirm: boolean;
}

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  position?: Position;
}

export interface Position {
  id: string;
  marketId: string;
  side: 'yes' | 'no';
  amount: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  platform: string;
}

export interface NotificationOptions {
  priority?: 'low' | 'normal' | 'high';
  parseMode?: 'text' | 'markdown' | 'html';
  silent?: boolean;
}
