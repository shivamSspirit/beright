/**
 * Unified Agent Configuration for BeRight Protocol
 *
 * SINGLE SOURCE OF TRUTH for all agent-level settings.
 * Change here → syncs across Web, Telegram, and all gateways.
 *
 * Usage:
 *   import { getAgentSettings, AGENT_CONFIG } from '../config/agentConfig';
 *   const settings = getAgentSettings('poster');
 */

// ============================================
// AGENT OPERATIONAL SETTINGS
// ============================================

export interface AgentOperationalConfig {
  // Identity
  id: string;
  name: string;
  description: string;
  enabled: boolean;

  // Rate Limits
  rateLimit: {
    maxPerDay: number;
    maxPerHour: number;
    cooldownMs: number;
  };

  // Scheduling
  schedule: {
    intervalMs: number;        // Loop interval in ms
    activeHoursStart?: number; // UTC hour to start (0-23)
    activeHoursEnd?: number;   // UTC hour to end (0-23)
    urgentModeThresholdHours?: number; // Increase activity when deadline < X hours
  };

  // Behavior
  behavior: {
    autoExecute: boolean;      // Execute without confirmation
    notifyAdmin: boolean;      // Send telegram notification on action
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };

  // Custom settings (agent-specific)
  custom: Record<string, unknown>;
}

// ============================================
// AGENT CONFIGURATIONS
// ============================================

export const AGENT_CONFIG: Record<string, AgentOperationalConfig> = {
  // ──────────────────────────────────────────
  // POSTER AGENT - Forum Engagement
  // ──────────────────────────────────────────
  poster: {
    id: 'poster',
    name: 'Agent-Poster',
    description: 'Autonomous forum engagement for Colosseum hackathon',
    enabled: true,

    rateLimit: {
      maxPerDay: 10,         // Max 10 posts per day
      maxPerHour: 3,         // Max 3 posts per hour
      cooldownMs: 120000,    // 2 min between actions
    },

    schedule: {
      intervalMs: 180000,    // 3 minute loop
      urgentModeThresholdHours: 6, // Increase activity in final 6 hours
    },

    behavior: {
      autoExecute: true,
      notifyAdmin: true,
      logLevel: 'info',
    },

    custom: {
      maxCommentsPerDay: 15,
      maxVotesPerCycle: 5,
      postChance: 0.4,           // 40% chance to post each cycle
      urgentPostChance: 0.8,     // 80% in urgent mode
      fallbackEnabled: true,     // Use fallback posts if AI fails
      telegramAdminId: process.env.SUPER_ADMIN_TELEGRAM_ID || '5504043269',
    },
  },

  // ──────────────────────────────────────────
  // SCOUT AGENT - Fast Market Scanning
  // ──────────────────────────────────────────
  scout: {
    id: 'scout',
    name: 'Scout',
    description: 'Fast market scanning and opportunity detection',
    enabled: true,

    rateLimit: {
      maxPerDay: 1000,
      maxPerHour: 100,
      cooldownMs: 5000,
    },

    schedule: {
      intervalMs: 300000,    // 5 minute scan interval
    },

    behavior: {
      autoExecute: true,
      notifyAdmin: false,
      logLevel: 'info',
    },

    custom: {
      maxMarketsPerScan: 100,
      platforms: ['polymarket', 'kalshi', 'manifold'],
      hotMarketThreshold: 10000, // $10K volume = hot
    },
  },

  // ──────────────────────────────────────────
  // ANALYST AGENT - Deep Research
  // ──────────────────────────────────────────
  analyst: {
    id: 'analyst',
    name: 'Analyst',
    description: 'Deep superforecaster analysis and research',
    enabled: true,

    rateLimit: {
      maxPerDay: 50,
      maxPerHour: 10,
      cooldownMs: 30000,
    },

    schedule: {
      intervalMs: 1800000,   // 30 minute deep analysis
    },

    behavior: {
      autoExecute: false,    // Requires confirmation for expensive ops
      notifyAdmin: false,
      logLevel: 'info',
    },

    custom: {
      maxSourcesPerAnalysis: 20,
      minConfidenceToReport: 0.6,
      includeBaseRates: true,
    },
  },

  // ──────────────────────────────────────────
  // TRADER AGENT - Execution
  // ──────────────────────────────────────────
  trader: {
    id: 'trader',
    name: 'Trader',
    description: 'Trade execution and position management',
    enabled: true,

    rateLimit: {
      maxPerDay: 20,
      maxPerHour: 5,
      cooldownMs: 60000,
    },

    schedule: {
      intervalMs: 900000,    // 15 minute position check
    },

    behavior: {
      autoExecute: false,    // NEVER auto-execute trades
      notifyAdmin: true,     // Always notify on trades
      logLevel: 'warn',
    },

    custom: {
      maxPositionUsd: 100,
      maxPortfolioUsd: 500,
      defaultSlippage: 0.03,
      maxSlippage: 0.10,
      requireQuoteFirst: true,
    },
  },

  // ──────────────────────────────────────────
  // BUILDER AGENT - Autonomous Development
  // ──────────────────────────────────────────
  builder: {
    id: 'builder',
    name: 'Builder',
    description: 'Autonomous code generation and self-improvement',
    enabled: true,

    rateLimit: {
      maxPerDay: 20,
      maxPerHour: 3,
      cooldownMs: 300000,    // 5 min between builds
    },

    schedule: {
      intervalMs: 1800000,   // 30 minute build loop
    },

    behavior: {
      autoExecute: true,
      notifyAdmin: true,
      logLevel: 'info',
    },

    custom: {
      maxFilesPerCommit: 10,
      runTestsBeforeCommit: true,
      pushToRemote: false,   // Don't auto-push
      targetBranch: 'agent-build',
    },
  },

  // ──────────────────────────────────────────
  // HEARTBEAT AGENT - Periodic Tasks
  // ──────────────────────────────────────────
  heartbeat: {
    id: 'heartbeat',
    name: 'Heartbeat',
    description: 'Periodic autonomous tasks (arb scan, whale watch)',
    enabled: true,

    rateLimit: {
      maxPerDay: 288,        // Every 5 min = 288/day
      maxPerHour: 12,
      cooldownMs: 60000,
    },

    schedule: {
      intervalMs: 300000,    // 5 minute heartbeat
    },

    behavior: {
      autoExecute: true,
      notifyAdmin: false,
      logLevel: 'info',
    },

    custom: {
      tasks: ['arbitrage', 'whale', 'resolution'],
      arbScanEnabled: true,
      whaleScanEnabled: true,
      resolutionCheckEnabled: true,
    },
  },

  // ──────────────────────────────────────────
  // COLOSSEUM AGENT - Forum API
  // ──────────────────────────────────────────
  colosseum: {
    id: 'colosseum',
    name: 'Colosseum',
    description: 'Colosseum hackathon forum API wrapper',
    enabled: true,

    rateLimit: {
      maxPerDay: 500,
      maxPerHour: 50,
      cooldownMs: 2000,
    },

    schedule: {
      intervalMs: 180000,    // 3 minute engagement loop
    },

    behavior: {
      autoExecute: true,
      notifyAdmin: false,
      logLevel: 'info',
    },

    custom: {
      apiEndpoint: 'https://agents.colosseum.com/api',
      forumTags: ['progress-update', 'product-feedback', 'ideation', 'defi', 'ai', 'trading', 'infra'],
    },
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get operational settings for an agent
 */
export function getAgentSettings(agentId: string): AgentOperationalConfig | null {
  return AGENT_CONFIG[agentId] || null;
}

/**
 * Get a specific custom setting with type safety
 */
export function getAgentCustomSetting<T>(agentId: string, key: string, defaultValue: T): T {
  const config = AGENT_CONFIG[agentId];
  if (!config) return defaultValue;
  return (config.custom[key] as T) ?? defaultValue;
}

/**
 * Check if an agent is enabled
 */
export function isAgentEnabled(agentId: string): boolean {
  return AGENT_CONFIG[agentId]?.enabled ?? false;
}

/**
 * Check if agent is in urgent mode (deadline approaching)
 */
export function isUrgentMode(agentId: string, hoursRemaining: number): boolean {
  const config = AGENT_CONFIG[agentId];
  if (!config?.schedule.urgentModeThresholdHours) return false;
  return hoursRemaining < config.schedule.urgentModeThresholdHours;
}

/**
 * Get rate limit for an agent
 */
export function getAgentRateLimit(agentId: string): AgentOperationalConfig['rateLimit'] | null {
  return AGENT_CONFIG[agentId]?.rateLimit || null;
}

/**
 * List all enabled agents
 */
export function listEnabledAgents(): string[] {
  return Object.keys(AGENT_CONFIG).filter(id => AGENT_CONFIG[id]?.enabled);
}

/**
 * Get all agent configs (for API exposure)
 */
export function getAllAgentConfigs(): Record<string, AgentOperationalConfig> {
  return AGENT_CONFIG;
}
