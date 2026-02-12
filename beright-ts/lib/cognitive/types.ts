/**
 * Cognitive Architecture Types for BeRight Agentic System
 *
 * These types define the core data structures for a truly agentic system
 * that can perceive, deliberate, act, and learn autonomously.
 */

// ============================================
// WORLD STATE - Agent's model of the world
// ============================================

export interface WorldState {
  beliefs: Belief[];
  markets: Map<string, MarketState>;
  positions: PositionState[];
  predictions: PredictionState[];
  signals: Signal[];
  lastUpdated: Date;
}

export interface Belief {
  id: string;
  content: string;
  confidence: number;  // 0-1
  source: 'observation' | 'inference' | 'external' | 'user';
  createdAt: Date;
  expiresAt?: Date;
  evidence: string[];
}

export interface MarketState {
  id: string;
  platform: string;
  title: string;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  lastPrice?: number;
  priceChangePercent?: number;
  lastUpdated: Date;
}

export interface PositionState {
  id: string;
  marketId: string;
  direction: 'YES' | 'NO';
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  openedAt: Date;
}

export interface PredictionState {
  id: string;
  question: string;
  predictedProbability: number;
  direction: 'YES' | 'NO';
  status: 'pending' | 'resolved' | 'expired';
  outcome?: boolean;
  brierScore?: number;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface Signal {
  id: string;
  type: SignalType;
  source: string;
  content: string;
  strength: number;  // 0-1
  timestamp: Date;
  processed: boolean;
}

export type SignalType =
  | 'price_movement'
  | 'volume_spike'
  | 'whale_activity'
  | 'news_sentiment'
  | 'arbitrage_opportunity'
  | 'prediction_resolution'
  | 'user_request'
  | 'scheduled_task';

// ============================================
// GOALS - Agent's intentions and objectives
// ============================================

export interface Goal {
  id: string;
  type: GoalType;
  description: string;
  priority: number;  // 0-100, higher = more urgent
  status: GoalStatus;
  parentGoalId?: string;  // For goal decomposition
  subGoalIds: string[];
  successCriteria: string;
  deadline?: Date;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

export type GoalType =
  | 'monitor'      // Watch something
  | 'research'     // Investigate a topic
  | 'trade'        // Execute a trade
  | 'alert'        // Notify user
  | 'learn'        // Improve calibration
  | 'maintain'     // System maintenance
  | 'proactive';   // Self-generated opportunity

export type GoalStatus =
  | 'active'
  | 'in_progress'
  | 'achieved'
  | 'failed'
  | 'abandoned'
  | 'blocked';

// ============================================
// PLANS - How to achieve goals
// ============================================

export interface Plan {
  id: string;
  goalId: string;
  steps: PlanStep[];
  currentStepIndex: number;
  estimatedDuration: number;  // milliseconds
  successProbability: number;  // 0-1
  fallbackPlanId?: string;
  createdAt: Date;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'aborted';
}

export interface PlanStep {
  id: string;
  action: string;
  skill: string;  // Which skill to invoke
  params: Record<string, unknown>;
  preconditions: Condition[];
  expectedOutcome: string;
  abortConditions: Condition[];
  timeout: number;  // milliseconds
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';
  result?: StepResult;
}

export interface Condition {
  type: 'belief' | 'state' | 'time' | 'external';
  expression: string;
  params?: Record<string, unknown>;
}

export interface StepResult {
  success: boolean;
  output?: unknown;
  error?: string;
  duration: number;
  timestamp: Date;
}

// ============================================
// EPISODES - Memory of past experiences
// ============================================

export interface Episode {
  id: string;
  timestamp: Date;
  context: string;
  actionTaken: string;
  outcome: EpisodeOutcome;
  lessonLearned?: string;
  relatedGoalId?: string;
  signals: string[];  // Signal IDs that triggered this
  embedding?: number[];  // For semantic search
}

export type EpisodeOutcome = 'success' | 'failure' | 'partial' | 'pending';

// ============================================
// REFLECTION - Self-improvement insights
// ============================================

export interface ReflectionResult {
  timestamp: Date;
  episodesAnalyzed: number;
  patternsIdentified: Pattern[];
  biasesDetected: Bias[];
  calibrationAdjustment: number;
  recommendedChanges: BehaviorChange[];
}

export interface Pattern {
  id: string;
  description: string;
  frequency: number;
  successRate: number;
  context: string;
}

export interface Bias {
  type: BiasType;
  magnitude: number;  // How strong the bias is
  context: string;
  evidence: string[];
}

export type BiasType =
  | 'overconfidence'
  | 'underconfidence'
  | 'recency'
  | 'anchoring'
  | 'confirmation'
  | 'availability';

export interface BehaviorChange {
  id: string;
  type: 'confidence_adjustment' | 'strategy_change' | 'avoid_pattern' | 'prefer_pattern';
  description: string;
  params: Record<string, unknown>;
  applied: boolean;
  appliedAt?: Date;
}

// ============================================
// EVENTS - For event-driven architecture
// ============================================

export interface AgentEvent {
  id: string;
  type: EventType;
  priority: number;  // 0-100
  payload: unknown;
  timestamp: Date;
  source: string;
  requiresImmediateAction: boolean;
  processed: boolean;
  processedAt?: Date;
}

export type EventType =
  | 'market_update'
  | 'price_alert_triggered'
  | 'arbitrage_detected'
  | 'whale_movement'
  | 'news_update'
  | 'prediction_resolved'
  | 'user_command'
  | 'scheduled_task'
  | 'goal_completed'
  | 'goal_failed'
  | 'reflection_due'
  | 'heartbeat';

// ============================================
// COGNITIVE LOOP STATE
// ============================================

export interface CognitiveState {
  currentPhase: CognitivePhase;
  worldState: WorldState;
  activeGoals: Goal[];
  currentPlan?: Plan;
  workingMemory: WorkingMemory;
  lastReflection?: ReflectionResult;
  metrics: CognitiveMetrics;
}

export type CognitivePhase =
  | 'perceive'
  | 'update_beliefs'
  | 'evaluate'
  | 'deliberate'
  | 'plan'
  | 'act'
  | 'reflect';

export interface WorkingMemory {
  recentEvents: AgentEvent[];
  activeContext: string[];
  currentFocus?: string;
  pendingDecisions: Decision[];
}

export interface Decision {
  id: string;
  question: string;
  options: string[];
  deadline?: Date;
  priority: number;
}

export interface CognitiveMetrics {
  totalCycles: number;
  goalsAchieved: number;
  goalsFailed: number;
  averageCycleTime: number;
  averageGoalCompletionTime: number;
  calibrationScore: number;  // Brier score
  lastCycleTime: number;
}
