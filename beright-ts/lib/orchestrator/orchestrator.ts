/**
 * Command Orchestrator
 *
 * The Orchestrator is where agency emerges.
 * It coordinates:
 * - Handler execution
 * - Multi-agent planning (Scout → Analyst → Trader)
 * - Pre/post hooks
 * - Error handling
 * - Learning from outcomes
 *
 */

import { v4 as uuid } from 'uuid';
import {
  CommandContext,
  CommandResult,
  CommandHandler,
  OrchestratorHooks,
  ErrorResult,
  ExecutionMeta,
  ExecutionPlan,
  AgentResult,
  AgentType,
  StreamingCommandResult,
  StreamChunk,
  MemoryContext,
  WorkingMemory,
} from './types';
import { RouteMatch } from '../router/types';
import { NormalizedMessage, GatewayContext } from '../gateway/types';

// =============================================================================
// ORCHESTRATOR CLASS
// =============================================================================

/**
 * Command Orchestrator
 *
 * Central coordinator for command execution.
 */
export class CommandOrchestrator {
  private handlers: Map<string, CommandHandler> = new Map();
  private hooks: OrchestratorHooks = {};
  private agents: Map<AgentType, CommandHandler> = new Map();

  // ===========================================================================
  // HANDLER REGISTRATION
  // ===========================================================================

  /**
   * Register a command handler
   */
  registerHandler(handler: CommandHandler): void {
    this.handlers.set(handler.id, handler);
  }

  /**
   * Register multiple handlers
   */
  registerHandlers(handlers: CommandHandler[]): void {
    for (const handler of handlers) {
      this.registerHandler(handler);
    }
  }

  /**
   * Get a registered handler
   */
  getHandler(id: string): CommandHandler | undefined {
    return this.handlers.get(id);
  }

  /**
   * Check if a handler exists
   */
  hasHandler(id: string): boolean {
    return this.handlers.has(id);
  }

  // ===========================================================================
  // HOOK REGISTRATION
  // ===========================================================================

  /**
   * Set orchestrator hooks
   */
  setHooks(hooks: OrchestratorHooks): void {
    this.hooks = hooks;
  }

  /**
   * Add a pre-execution hook
   */
  addPreHook(hook: NonNullable<OrchestratorHooks['pre']>[number]): void {
    this.hooks.pre = this.hooks.pre || [];
    this.hooks.pre.push(hook);
  }

  /**
   * Add a post-execution hook
   */
  addPostHook(hook: NonNullable<OrchestratorHooks['post']>[number]): void {
    this.hooks.post = this.hooks.post || [];
    this.hooks.post.push(hook);
  }

  /**
   * Add an error hook
   */
  addErrorHook(hook: NonNullable<OrchestratorHooks['onError']>[number]): void {
    this.hooks.onError = this.hooks.onError || [];
    this.hooks.onError.push(hook);
  }

  // ===========================================================================
  // CONTEXT BUILDING
  // ===========================================================================

  /**
   * Build CommandContext from message and route match
   */
  async buildContext(
    message: NormalizedMessage,
    routeMatch: RouteMatch,
    options: {
      gatewayContext: GatewayContext;
      userId: string;
      isAuthenticated: boolean;
      memory?: MemoryContext;
      wallet?: CommandContext['wallet'];
    }
  ): Promise<CommandContext> {
    const { gatewayContext, userId, isAuthenticated, memory, wallet } = options;

    return {
      // Request
      message,
      route: routeMatch.route,
      routeMatch,
      gatewayContext,

      // User
      userId,
      userTier: 'free', // TODO: Fetch from user profile
      wallet,
      isAuthenticated,

      // Understanding
      understanding: routeMatch.understanding,
      arguments: routeMatch.arguments || [],
      params: routeMatch.params || {},

      // Memory
      memory: memory || {
        conversation: [],
        working: new Map(),
      },

      // Execution
      requestId: uuid(),
      startTime: new Date(),
    };
  }

  // ===========================================================================
  // EXECUTION
  // ===========================================================================

  /**
   * Execute a command
   *
   * Main entry point for command execution.
   */
  async execute(context: CommandContext): Promise<CommandResult> {
    const handler = this.handlers.get(context.route.handler);

    if (!handler) {
      return this.createErrorResult(
        context,
        'HANDLER_NOT_FOUND',
        `Handler '${context.route.handler}' not found`,
        false
      );
    }

    try {
      // Run pre-hooks
      await this.runPreHooks(context);

      // Validate if handler supports it
      if (handler.validate) {
        const validation = await handler.validate(context);
        if (!validation.valid) {
          return this.createErrorResult(
            context,
            'VALIDATION_FAILED',
            validation.error || 'Validation failed',
            false
          );
        }
      }

      // Execute handler
      const startTime = Date.now();
      const result = await handler.execute(context);
      const durationMs = Date.now() - startTime;

      // Ensure meta is populated
      result.meta = {
        ...result.meta,
        handlerId: handler.id,
        routeId: context.route.id,
        executedAt: new Date(),
        durationMs,
        skillsUsed: handler.skillsUsed || [],
        apiCallsMade: result.meta?.apiCallsMade || 0,
      };

      // Run post-hooks
      await this.runPostHooks(context, result);

      // Record episode if configured
      if (context.route.recordEpisode) {
        await this.recordEpisode(context, result);
      }

      return result;

    } catch (error) {
      // Run error hooks
      await this.runErrorHooks(context, error as Error);

      // Return error result
      return this.createErrorResult(
        context,
        'EXECUTION_ERROR',
        error instanceof Error ? error.message : 'Unknown error',
        true
      );
    }
  }

  /**
   * Execute with streaming support
   */
  async executeStream(context: CommandContext): Promise<StreamingCommandResult> {
    const handler = this.handlers.get(context.route.handler);

    if (!handler || !handler.supportsStreaming) {
      // Fall back to non-streaming execution
      const result = await this.execute(context);
      return this.wrapAsStream(result);
    }

    // TODO: Implement streaming execution
    // For now, fall back to non-streaming
    const result = await this.execute(context);
    return this.wrapAsStream(result);
  }

  // ===========================================================================
  // INTERNAL CAPABILITY COORDINATION (Future)
  // ===========================================================================

  /**
   * Register an internal capability handler
   */
  registerAgent(type: AgentType, handler: CommandHandler): void {
    this.agents.set(type, handler);
  }

  /**
   * Plan internal capability execution
   *
   * Given a complex request, create an execution plan
   * that coordinates multiple internal capabilities.
   */
  async plan(_context: CommandContext): Promise<ExecutionPlan> {
    // TODO: Implement capability planning
    // For now, return single-step plan
    return {
      id: uuid(),
      steps: [{
        agentId: 'scout',
        task: 'Execute single handler',
        input: _context.params,
      }],
      parallel: false,
    };
  }

  /**
   * Execute an internal capability plan
   */
  async executePlan(
    plan: ExecutionPlan,
    context: CommandContext
  ): Promise<AgentResult[]> {
    const results: AgentResult[] = [];

    for (const step of plan.steps) {
      const agent = this.agents.get(step.agentId);
      if (!agent) {
        console.warn(`[Orchestrator] Capability ${step.agentId} not found`);
        continue;
      }

      // Update context with intermediate results
      const stepContext = {
        ...context,
        params: { ...context.params, agentInput: step.input },
      };

      const result = await agent.execute(stepContext);

      results.push({
        agentId: step.agentId,
        data: result.data,
        suggestsReplanning: false,
      });

      // Check if we should replan
      // TODO: Implement replanning logic
    }

    return results;
  }

  /**
   * Synthesize results from multiple capability steps
   */
  async synthesize(
    _context: CommandContext,
    results: AgentResult[]
  ): Promise<CommandResult> {
    // TODO: Implement synthesis with LLM
    // For now, return last agent's result
    const lastResult = results[results.length - 1];

    return {
      success: true,
      data: lastResult?.data,
      meta: {
        handlerId: 'synthesizer',
        routeId: _context.route.id,
        executedAt: new Date(),
        durationMs: 0,
        skillsUsed: results.map(r => r.agentId),
        apiCallsMade: 0,
      },
    };
  }

  // ===========================================================================
  // HOOKS
  // ===========================================================================

  private async runPreHooks(context: CommandContext): Promise<void> {
    if (!this.hooks.pre) return;

    for (const hook of this.hooks.pre) {
      await hook(context);
    }
  }

  private async runPostHooks(
    context: CommandContext,
    result: CommandResult
  ): Promise<void> {
    if (!this.hooks.post) return;

    for (const hook of this.hooks.post) {
      await hook(context, result);
    }
  }

  private async runErrorHooks(
    context: CommandContext,
    error: Error
  ): Promise<void> {
    if (!this.hooks.onError) return;

    for (const hook of this.hooks.onError) {
      try {
        await hook(context, error);
      } catch (hookError) {
        console.error('[Orchestrator] Error hook failed:', hookError);
      }
    }
  }

  // ===========================================================================
  // LEARNING
  // ===========================================================================

  /**
   * Record episode to episodic memory
   */
  private async recordEpisode(
    context: CommandContext,
    result: CommandResult
  ): Promise<void> {
    // TODO: Implement episode recording
    // This will integrate with lib/cognitiveMemory.ts
    console.debug('[Orchestrator] Recording episode:', {
      routeId: context.route.id,
      success: result.success,
    });
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Create error result
   */
  private createErrorResult(
    context: CommandContext,
    code: string,
    message: string,
    retryable: boolean
  ): CommandResult {
    const error: ErrorResult = {
      code,
      message,
      retryable,
    };

    return {
      success: false,
      error,
      meta: {
        handlerId: context.route.handler,
        routeId: context.route.id,
        executedAt: new Date(),
        durationMs: Date.now() - context.startTime.getTime(),
        skillsUsed: [],
        apiCallsMade: 0,
      },
      hints: {
        mood: 'ERROR',
      },
    };
  }

  /**
   * Wrap a CommandResult as a streaming result
   */
  private wrapAsStream(result: CommandResult): StreamingCommandResult {
    async function* generateStream(): AsyncIterable<StreamChunk> {
      yield {
        type: 'data',
        content: result.data,
        final: true,
      };
    }

    return {
      stream: generateStream(),
      getFinalResult: async () => result,
    };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let orchestratorInstance: CommandOrchestrator | null = null;

/**
 * Get or create orchestrator instance
 */
export function getOrchestrator(): CommandOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new CommandOrchestrator();
  }
  return orchestratorInstance;
}

/**
 * Reset orchestrator (for testing)
 */
export function resetOrchestrator(): void {
  orchestratorInstance = null;
}
