/**
 * Router Layer Types
 *
 * The Router is where intelligence enters the system.
 * It handles:
 * - Pattern matching for commands (/hot, /research)
 * - Semantic understanding for natural language
 * - Route configuration and metadata
 *
 * The Router is NOT pattern matching - it's understanding.
 *
 * @see docs/ADR-001-GATEWAY-SKILL-SEPARATION.md
 */

// =============================================================================
// USER GOALS & DOMAINS
// =============================================================================

/**
 * User goals - what the user is trying to accomplish
 *
 * These map to OpenClaw's semantic agent goals.
 * Used for semantic routing fallback when no command matches.
 */
export type UserGoal =
  | 'DISCOVER_OPPORTUNITIES'      // Looking for markets/trades
  | 'GET_ANALYSIS'                // Want deep research
  | 'EXECUTE_TRADE'               // Ready to trade
  | 'CHECK_POSITIONS'             // View portfolio
  | 'GET_PRICE'                   // Quick price check
  | 'SET_ALERT'                   // Configure notifications
  | 'UNDERSTAND_MARKET'           // Learn about a topic
  | 'COMPARE_OPTIONS'             // Arbitrage, comparisons
  | 'MANAGE_WALLET'               // Wallet operations
  | 'GET_RECOMMENDATIONS'         // What should I do?
  | 'TRACK_WHALE'                 // Monitor large players
  | 'CALIBRATE'                   // Check prediction accuracy
  | 'GET_HELP'                    // Help/onboarding
  | 'CHAT'                        // General conversation
  | 'UNKNOWN';                    // Could not determine

/**
 * Domains - what area the request is about
 */
export type Domain =
  | 'PREDICTION_MARKETS'          // Polymarket, Kalshi, DFlow
  | 'CRYPTO'                      // Crypto prices, swaps
  | 'SPORTS'                      // Sports betting markets
  | 'POLITICS'                    // Political markets
  | 'FINANCE'                     // Stocks, indices
  | 'WEATHER'                     // Weather markets
  | 'PORTFOLIO'                   // User's positions/wallet
  | 'SYSTEM'                      // Help, settings
  | 'GENERAL';                    // Unclassified

// =============================================================================
// ROUTE DEFINITION
// =============================================================================

/**
 * User tier levels
 */
export type UserTier = 'free' | 'pro' | 'whale';

/**
 * Rate limit configuration
 */
export interface RateLimit {
  /** Maximum requests in window */
  requests: number;
  /** Window duration in milliseconds */
  window: number;
}

/**
 * Route definition
 *
 * Defines how a command or intent maps to a handler.
 * This is the configuration-driven approach that replaces
 * the legacy Telegram command monolith.
 */
export interface Route {
  /** Unique route identifier */
  id: string;

  /** Handler name (maps to handlers/[handler].ts) */
  handler: string;

  /** Command patterns (e.g., ['/hot', '/trending', '/top']) */
  patterns: string[];

  /** Natural language aliases for semantic matching */
  aliases?: string[];

  /** User goals this route satisfies (for semantic fallback) */
  goals?: UserGoal[];

  /** Domains this route handles */
  domains?: Domain[];

  // =========================================================================
  // Access Control
  // =========================================================================

  /** Requires authenticated user */
  requiresAuth: boolean;

  /** Requires connected wallet */
  requiresWallet: boolean;

  /** Minimum user tier */
  tier: UserTier;

  /** Rate limiting (optional) */
  rateLimit?: RateLimit;

  // =========================================================================
  // Metadata
  // =========================================================================

  /** Human-readable description */
  description?: string;

  /** Example usage */
  examples?: string[];

  /** Categories for help/discovery */
  categories?: string[];

  /** Is this route hidden from help listings? */
  hidden?: boolean;

  /** Is this route currently enabled? */
  enabled?: boolean;

  // =========================================================================
  // Behavior Hints
  // =========================================================================

  /** Should show typing indicator while processing? */
  showTyping?: boolean;

  /** Expected duration (helps with timeout decisions) */
  expectedDurationMs?: number;

  /** Can be cancelled mid-execution? */
  cancellable?: boolean;

  /** Should record to episodic memory? */
  recordEpisode?: boolean;
}

// =============================================================================
// SEMANTIC UNDERSTANDING
// =============================================================================

/**
 * Result of semantic understanding
 *
 * When pattern matching fails, the semantic router uses
 * LLM to understand the user's intent.
 */
export interface SemanticUnderstanding {
  /** Primary user goal */
  goal: UserGoal;

  /** Domain of the request */
  domain: Domain;

  /** Extracted topic (e.g., 'bitcoin', 'trump', 'fed') */
  topic?: string;

  /** Sub-intent for more specific routing */
  subIntent?: string;

  /** Confidence score (0-1) */
  confidence: number;

  /** Required capabilities to fulfill this request */
  requiredCapabilities?: string[];

  /** Extracted entities */
  entities?: {
    ticker?: string;
    amount?: number;
    side?: 'YES' | 'NO' | 'BUY' | 'SELL';
    platform?: string;
    timeframe?: string;
    [key: string]: unknown;
  };

  /** Original query normalized */
  normalizedQuery?: string;
}

// =============================================================================
// ROUTE MATCH RESULT
// =============================================================================

/**
 * How the route was matched
 */
export type MatchType =
  | 'exact'       // Exact command match (/hot)
  | 'pattern'     // Pattern match (/research bitcoin)
  | 'alias'       // Natural language alias
  | 'semantic'    // LLM-powered semantic understanding
  | 'fallback';   // Default route

/**
 * Result of route matching
 *
 * Contains the matched route plus metadata about how it was matched.
 */
export interface RouteMatch {
  /** The matched route */
  route: Route;

  /** How the match was made */
  matchType: MatchType;

  /** Match confidence (1.0 for exact, lower for semantic) */
  confidence: number;

  /** Parsed arguments from the command */
  arguments?: string[];

  /** Extracted parameters (from patterns like /trade {ticker} {side} {amount}) */
  params?: Record<string, unknown>;

  /** Semantic understanding (if semantic match) */
  understanding?: SemanticUnderstanding;

  /** Time taken to match (ms) */
  matchDurationMs?: number;
}

// =============================================================================
// ROUTER INTERFACE
// =============================================================================

/**
 * Router interface
 *
 * Routers determine which handler should process a message.
 * Multiple routers can be chained (pattern → semantic → fallback).
 */
export interface Router {
  /** Router identifier */
  name: string;

  /** Priority (higher = tried first) */
  priority: number;

  /**
   * Match a message to a route
   *
   * @param text - The message text
   * @param context - Optional context for better matching
   * @returns RouteMatch if matched, null if not handled by this router
   */
  match(
    text: string,
    context?: {
      userId?: string;
      conversationHistory?: string[];
      userProfile?: Record<string, unknown>;
    }
  ): Promise<RouteMatch | null>;

  /**
   * Check if this router can handle the message
   * (Faster than full match for chain optimization)
   */
  canHandle?(text: string): boolean;
}

// =============================================================================
// PATTERN PARAMETER TYPES
// =============================================================================

/**
 * Parameter definition for parameterized routes
 *
 * Used for routes like /trade {ticker} {side} {amount}
 */
export interface RouteParameter {
  /** Parameter name */
  name: string;

  /** Parameter type for parsing */
  type: 'string' | 'number' | 'boolean' | 'enum';

  /** Is this parameter required? */
  required: boolean;

  /** Default value if not provided */
  default?: unknown;

  /** Allowed values for enum type */
  enumValues?: string[];

  /** Validation pattern (regex) */
  pattern?: string;

  /** Min/max for numbers */
  min?: number;
  max?: number;
}

/**
 * Parameterized route pattern
 *
 * For complex commands like /trade BTCUSDT YES 50
 */
export interface ParameterizedPattern {
  /** Base command */
  command: string;

  /** Parameter definitions in order */
  parameters: RouteParameter[];

  /** Full pattern for documentation */
  usage: string;
}
