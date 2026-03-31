/**
 * Orchestrator Layer Types
 *
 * The Orchestrator is where agency emerges.
 * It handles:
 * - Multi-agent coordination (Scout → Analyst → Trader)
 * - Planning and execution
 * - Context management
 * - Learning from outcomes
 *
 * The Orchestrator is NOT dispatch - it's coordination.
 *
 * @see docs/ADR-001-GATEWAY-SKILL-SEPARATION.md
 */

import { NormalizedMessage, GatewayContext, GatewayType } from '../gateway/types';
import { Route, RouteMatch, SemanticUnderstanding, UserTier } from '../router/types';

// =============================================================================
// MEMORY & CONTEXT
// =============================================================================

/**
 * User profile with preferences and history
 */
export interface UserProfile {
  /** User ID */
  userId: string;

  /** User tier */
  tier: UserTier;

  /** Preferred trading platforms */
  preferredPlatforms?: string[];

  /** Risk tolerance */
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive';

  /** Topics of interest */
  interests?: string[];

  /** Notification preferences */
  notifications?: {
    priceAlerts: boolean;
    whaleAlerts: boolean;
    positionUpdates: boolean;
  };

  /** Last activity timestamp */
  lastSeen?: Date;

  /** Total trades executed */
  totalTrades?: number;

  /** Calibration score (Brier) */
  calibrationScore?: number;

  /** Custom settings */
  settings?: Record<string, unknown>;
}

/**
 * Conversation message for history
 */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    handlerId?: string;
    routeId?: string;
    sentiment?: string;
  };
}

/**
 * Episode from episodic memory
 */
export interface Episode {
  id: string;
  timestamp: Date;
  input: string;
  understanding: SemanticUnderstanding;
  handlerId: string;
  output: unknown;
  outcome?: {
    success: boolean;
    userFeedback?: 'positive' | 'negative' | 'neutral';
    followUpAction?: string;
  };
}

/**
 * Working memory for current session
 */
export type WorkingMemory = Map<string, unknown>;

/**
 * Memory context passed through the pipeline
 */
export interface MemoryContext {
  /** Recent conversation history */
  conversation: ConversationMessage[];

  /** User profile and preferences */
  userProfile?: UserProfile;

  /** Past actions and outcomes */
  episodic?: Episode[];

  /** Current session state */
  working: WorkingMemory;
}

// =============================================================================
// WALLET CONTEXT
// =============================================================================

/**
 * Wallet information for trading context
 */
export interface WalletInfo {
  /** Public key / address */
  publicKey: string;

  /** SOL balance */
  solBalance?: number;

  /** USDC balance */
  usdcBalance?: number;

  /** Connected wallet type */
  walletType: 'privy' | 'phantom' | 'keypair' | 'turnkey';

  /** Is wallet ready for trading? */
  isReady: boolean;
}

// =============================================================================
// COMMAND CONTEXT
// =============================================================================

/**
 * Full context for command execution
 *
 * This is the canonical context object passed to handlers.
 * Contains everything a handler needs to execute business logic.
 */
export interface CommandContext {
  // ===========================================================================
  // Request
  // ===========================================================================

  /** Normalized message */
  message: NormalizedMessage;

  /** Matched route */
  route: Route;

  /** Route match details */
  routeMatch: RouteMatch;

  /** Gateway-specific context */
  gatewayContext: GatewayContext;

  // ===========================================================================
  // User
  // ===========================================================================

  /** User identifier */
  userId: string;

  /** User tier */
  userTier: UserTier;

  /** Wallet info (if available) */
  wallet?: WalletInfo;

  /** Is user authenticated? */
  isAuthenticated: boolean;

  // ===========================================================================
  // Understanding
  // ===========================================================================

  /** Semantic understanding (from router) */
  understanding?: SemanticUnderstanding;

  /** Parsed arguments */
  arguments: string[];

  /** Extracted parameters */
  params: Record<string, unknown>;

  // ===========================================================================
  // Memory
  // ===========================================================================

  /** Memory context */
  memory: MemoryContext;

  // ===========================================================================
  // Execution Metadata
  // ===========================================================================

  /** Request ID for tracing */
  requestId: string;

  /** Request start time */
  startTime: Date;

  /** Cancellation token */
  abortSignal?: AbortSignal;
}

// =============================================================================
// COMMAND RESULT
// =============================================================================

/**
 * Mood hint for formatters
 *
 * Matches types/response.ts Mood type for compatibility.
 */
export type Mood = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'ALERT' | 'EDUCATIONAL' | 'ERROR';

/**
 * Response hints for formatters
 */
export interface ResponseHints {
  /** Suggested mood/emoji */
  mood?: Mood;

  /** Urgency level */
  urgency?: 'low' | 'medium' | 'high';

  /** Suggested follow-up actions */
  suggestedActions?: string[];

  /** Category for styling */
  category?: string;
}

/**
 * Execution metadata
 */
export interface ExecutionMeta {
  /** Handler that executed */
  handlerId: string;

  /** Route that was matched */
  routeId: string;

  /** Execution timestamp */
  executedAt: Date;

  /** Execution duration (ms) */
  durationMs: number;

  /** Skills used during execution */
  skillsUsed: string[];

  /** External API calls made */
  apiCallsMade: number;

  /** LLM tokens used (if any) */
  llmTokensUsed?: number;

  /** Cache hit? */
  cacheHit?: boolean;

  /** Data freshness */
  dataAge?: number;
}

/**
 * Error result structure
 */
export interface ErrorResult {
  /** Error code */
  code: string;

  /** Human-readable message */
  message: string;

  /** Is error retryable? */
  retryable: boolean;

  /** Suggested recovery action */
  recoveryAction?: string;

  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Command execution result
 *
 * This is returned by handlers. Contains structured data
 * that formatters transform into gateway-specific output.
 *
 * IMPORTANT: `data` should NEVER contain formatted text.
 * It should be pure structured data.
 */
export interface CommandResult<T = unknown> {
  /** Was execution successful? */
  success: boolean;

  /** Business data (NEVER formatted text) */
  data?: T;

  /** Error details (if success=false) */
  error?: ErrorResult;

  /** Execution metadata */
  meta: ExecutionMeta;

  /** Response hints for formatters */
  hints?: ResponseHints;
}

// =============================================================================
// HANDLER INTERFACE
// =============================================================================

/**
 * Command handler interface
 *
 * Handlers implement business logic for a specific command.
 * They receive CommandContext and return CommandResult.
 *
 * Handlers should:
 * - Execute business logic
 * - Return structured data
 * - NOT format output (that's the formatter's job)
 */
export interface CommandHandler<T = unknown> {
  /** Handler identifier (matches route.handler) */
  id: string;

  /** Execute the command */
  execute(context: CommandContext): Promise<CommandResult<T>>;

  /** Skills this handler uses (for tracking) */
  skillsUsed?: string[];

  /** Can this handler stream results? */
  supportsStreaming?: boolean;

  /** Validate context before execution */
  validate?(context: CommandContext): Promise<{ valid: boolean; error?: string }>;
}

// =============================================================================
// ORCHESTRATOR HOOKS
// =============================================================================

/**
 * Pre-execution hook
 */
export type PreHook = (context: CommandContext) => Promise<void>;

/**
 * Post-execution hook
 */
export type PostHook = (
  context: CommandContext,
  result: CommandResult
) => Promise<void>;

/**
 * Error hook
 */
export type ErrorHook = (
  context: CommandContext,
  error: Error
) => Promise<void>;

/**
 * Orchestrator hooks configuration
 */
export interface OrchestratorHooks {
  /** Run before handler execution */
  pre?: PreHook[];

  /** Run after successful execution */
  post?: PostHook[];

  /** Run on error */
  onError?: ErrorHook[];
}

// =============================================================================
// MULTI-AGENT TYPES (Future)
// =============================================================================

/**
 * Agent types for multi-agent coordination
 */
export type AgentType = 'forecaster' | 'scout' | 'analyst' | 'trader';

/**
 * Agent task definition
 */
export interface AgentTask {
  /** Agent to execute */
  agentId: AgentType;

  /** Task description */
  task: string;

  /** Input data */
  input: unknown;

  /** Dependencies (other task IDs that must complete first) */
  dependsOn?: string[];
}

/**
 * Execution plan for multi-agent coordination
 */
export interface ExecutionPlan {
  /** Plan ID */
  id: string;

  /** Steps in execution order */
  steps: AgentTask[];

  /** Can steps run in parallel? */
  parallel?: boolean;

  /** Plan reasoning */
  reasoning?: string;
}

/**
 * Agent result
 */
export interface AgentResult {
  /** Agent that executed */
  agentId: AgentType;

  /** Result data */
  data: unknown;

  /** Should orchestrator replan based on this result? */
  suggestsReplanning?: boolean;

  /** Suggested next steps */
  suggestions?: string[];
}

// =============================================================================
// STREAMING TYPES
// =============================================================================

/**
 * Streaming result chunk
 */
export interface StreamChunk {
  /** Chunk type */
  type: 'text' | 'data' | 'progress' | 'done' | 'error';

  /** Chunk content */
  content: unknown;

  /** Is this the final chunk? */
  final?: boolean;
}

/**
 * Streaming command result
 */
export interface StreamingCommandResult {
  /** Stream of chunks */
  stream: AsyncIterable<StreamChunk>;

  /** Final result (available after stream completes) */
  getFinalResult(): Promise<CommandResult>;
}
