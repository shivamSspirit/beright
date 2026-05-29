/**
 * Agent Types for BeRight Protocol
 * Shared type definitions for all agents (Scout, Analyst, Trader, xDegen, Orchestrator)
 */

import type { SkillResponse, Mood, Market, Platform } from '../types/index';

// ============================================================================
// Agent Configuration
// ============================================================================

/**
 * Agent model options
 */
export type AgentModel =
  | 'claude-sonnet-4-5'
  | 'claude-opus-4'
  | 'claude-haiku-3'
  | 'gpt-4o'
  | 'gpt-4o-mini';

/**
 * Base agent configuration
 */
export interface AgentConfig {
  id: string;
  name: string;
  model: AgentModel;
  temperature: number;
  maxTokens: number;
  description?: string;
}

/**
 * Agent performance envelope
 */
export interface AgentEnvelope {
  maxResponseTimeMs: number;
  maxLLMCalls: number;
  cacheTTLMs?: number;
}

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Tool parameter definition
 */
export interface ToolParameterDef {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: { type: string };
  default?: unknown;
}

/**
 * Tool parameter schema
 */
export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, ToolParameterDef>;
  required?: string[];
}

/**
 * Generic tool result wrapper
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  durationMs?: number;
}

/**
 * Tool execution record
 */
export interface ToolExecution<T = unknown> {
  tool: string;
  params: Record<string, unknown>;
  result: T;
  error?: string;
  durationMs: number;
}

// ============================================================================
// Scout Agent Types
// ============================================================================

/**
 * Scout tool parameters
 */
export interface GetHotMarketsParams {
  limit?: number;
}

export interface SearchMarketsParams {
  query: string;
  limit?: number;
  platforms?: Platform[];
}

export interface CompareOddsParams {
  query: string;
}

export interface FindArbitrageParams {
  minSpread?: number;
  maxResults?: number;
}

export interface GetMarketNewsParams {
  topic: string;
  maxResults?: number;
}

/**
 * Scout tool results
 */
export interface HotMarketsResult {
  markets: Market[];
  count: number;
  platforms: Record<Platform, number>;
}

export interface SearchMarketsResult {
  markets: Market[];
  count: number;
  query: string;
}

export interface CompareOddsResult {
  query: string;
  markets: Market[];
  byPlatform: Record<Platform, Market[]>;
  arbitrageOpportunities: ArbitrageOpportunity[];
}

export interface ArbitrageOpportunity {
  topic: string;
  platformA: Platform;
  platformB: Platform;
  priceA: number;
  priceB: number;
  spread: number;
  strategy: string;
  profitPercent: number;
}

export interface ArbitrageResult {
  opportunities: ArbitrageOpportunity[];
  count: number;
  scannedMarkets: number;
}

export interface NewsResult {
  articles: NewsArticle[];
  count: number;
  topic: string;
}

export interface NewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary?: string;
}

/**
 * Scout tool definition with typed parameters and result
 */
export interface ScoutTool<TParams = Record<string, unknown>, TResult = unknown> {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  execute: (params: TParams) => Promise<TResult>;
}

/**
 * Scout agent response
 */
export interface ScoutResponse extends SkillResponse {
  toolResults?: ToolExecution[];
  latencyMs?: number;
}

// ============================================================================
// Analyst Agent Types
// ============================================================================

/**
 * Analyst research request
 */
export interface ResearchRequest {
  query: string;
  depth?: 'quick' | 'standard' | 'deep';
  includeNews?: boolean;
  includeSocial?: boolean;
  includeHistorical?: boolean;
}

/**
 * Analyst probability estimate
 */
export interface ProbabilityEstimate {
  probability: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
  keyFactors: string[];
  sources: string[];
}

/**
 * Analyst research result
 */
export interface ResearchResult {
  query: string;
  markets: Market[];
  estimate?: ProbabilityEstimate;
  news?: NewsResult;
  social?: SocialSentiment;
  synthesis: string;
}

export interface SocialSentiment {
  overall: 'bullish' | 'bearish' | 'neutral';
  volume: 'low' | 'medium' | 'high';
  sources: string[];
}

// ============================================================================
// Trader Agent Types
// ============================================================================

/**
 * Trade request
 */
export interface TradeRequest {
  platform: Platform;
  marketId: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  amount: number;
  price?: number;
  dryRun?: boolean;
}

/**
 * Trade result
 */
export interface TradeResult {
  success: boolean;
  orderId?: string;
  filledAmount?: number;
  filledPrice?: number;
  fees?: number;
  error?: string;
  dryRun: boolean;
}

/**
 * Position for portfolio
 */
export interface Position {
  platform: Platform;
  marketId: string;
  marketTitle: string;
  side: 'yes' | 'no';
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
}

/**
 * Portfolio summary
 */
export interface PortfolioSummary {
  totalValue: number;
  totalPnL: number;
  positions: Position[];
  byPlatform: Record<Platform, {
    value: number;
    pnl: number;
    positionCount: number;
  }>;
}

/**
 * Risk assessment
 */
export interface RiskAssessment {
  maxPositionSize: number;
  currentExposure: number;
  availableCapital: number;
  riskScore: 'low' | 'medium' | 'high';
  warnings: string[];
}

// ============================================================================
// xDegen Agent Types
// ============================================================================

/**
 * Social post request
 */
export interface SocialPostRequest {
  topic?: string;
  market?: Market;
  style?: 'alpha' | 'hype' | 'analysis' | 'meme';
  platform?: 'twitter' | 'telegram';
}

/**
 * Generated social post
 */
export interface SocialPost {
  text: string;
  hashtags: string[];
  mediaUrls?: string[];
  threadParts?: string[];
}

// ============================================================================
// Orchestrator Types
// ============================================================================

/**
 * Agent routing decision
 */
export interface RoutingDecision {
  agent: 'scout' | 'analyst' | 'trader' | 'xdegen';
  confidence: number;
  reasoning?: string;
}

/**
 * Agent execution context
 */
export interface AgentContext {
  userId?: string;
  chatId?: string;
  tier?: 'free' | 'basic' | 'pro' | 'whale';
  previousContext?: string;
  timestamp: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Agent executor function type
 */
export type AgentExecutor<TInput = string, TOutput = SkillResponse> = (
  input: TInput,
  context?: AgentContext
) => Promise<TOutput>;

/**
 * Tool executor function type
 */
export type ToolExecutor<TParams, TResult> = (params: TParams) => Promise<TResult>;

/**
 * Platform count helper
 */
export function countPlatforms(markets: Market[]): Record<Platform, number> {
  const counts: Partial<Record<Platform, number>> = {};
  for (const market of markets) {
    counts[market.platform] = (counts[market.platform] || 0) + 1;
  }
  return counts as Record<Platform, number>;
}
