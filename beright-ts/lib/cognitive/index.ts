/**
 * Cognitive Architecture Module
 *
 * This module provides the core agentic capabilities for BeRight:
 * - World State Management (beliefs, markets, positions, signals)
 * - Goal Management (creation, delegation, lifecycle)
 * - Episodic Memory (learning from past experiences)
 * - Cognitive Loop (perceive → deliberate → act → reflect)
 * - Multi-Agent Coordination (true agent independence)
 *
 * Integration with OpenClaw:
 * - Uses OpenClaw's memory system (MEMORY.md) for persistent context
 * - Integrates with heartbeat for autonomous operation
 * - Uses hooks for event-driven triggers
 * - Supports multi-agent routing for agent isolation
 */

// Core types
export * from './types';

// World State - Agent's model of the world
export {
  default as worldState,
  addBelief,
  updateBeliefConfidence,
  getBeliefs,
  believes,
  updateMarket,
  getMarket,
  getAllMarkets,
  getMovingMarkets,
  updatePosition,
  getPositions,
  getPositionsAtRisk,
  addPrediction,
  resolvePrediction,
  getPendingPredictions,
  getCalibrationMetrics,
  addSignal,
  getUnprocessedSignals,
  markSignalProcessed,
  getRecentSignals,
  getWorldState,
  getWorldStateSummary,
  resetWorldState,
} from './worldState';

// Goal Manager - Agent's intentions and objectives
export {
  default as goalManager,
  createGoal,
  createProactiveGoal,
  decomposeGoal,
  startGoal,
  achieveGoal,
  failGoal,
  abandonGoal,
  blockGoal,
  unblockGoal,
  getActiveGoals,
  getGoalsByPriority,
  getNextGoal,
  getGoalsByType,
  getGoal,
  getSubGoals,
  getOverdueGoals,
  hasSimilarGoal,
  cleanupStaleGoals,
  updatePriority,
  getGoalStats,
  getGoalSummary,
  resetGoals,
} from './goalManager';

// Episodic Memory - Learning from experiences
export {
  default as memory,
  recordEpisode,
  updateEpisodeOutcome,
  createLesson,
  applyLesson,
  updateLessonConfidence,
  getRecentEpisodes,
  getEpisodesByOutcome,
  searchEpisodes,
  getRelevantLessons,
  getLessons,
  analyzePatterns,
  detectBiases,
  getMemorySummary,
  formatForOpenClawMemory,
  syncToOpenClawMemory,
  resetMemory,
} from './memory';

// Cognitive Loop - The heart of the agentic system
export {
  default as cognitiveLoop,
  runCognitiveLoopOnce,
  getCognitiveStateSummary,
  getCognitiveMetrics,
  injectSignal,
  resetCognitiveState,
} from './cognitiveLoop';

// Multi-Agent Coordinator
export {
  default as multiAgent,
  AGENT_DEFINITIONS,
  getAgentDefinition,
  getAgentState,
  updateAgentStatus,
  selectAgentForTask,
  sendMessage,
  getMessages,
  acknowledgeMessage,
  delegateGoal,
  reportGoalCompletion,
  detectConflicts,
  resolveConflict,
  coordinate,
  getAgentsSummary,
  resetCoordinatorState,
} from './multiAgent';
