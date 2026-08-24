import { v4 as uuid } from 'uuid';
import {
  CommandContext,
  CommandResult,
  CommandHandler,
  OrchestratorHooks,
  ErrorResult,
  ExecutionPlan,
  AgentResult,
  AgentType,
  StreamingCommandResult,
  StreamChunk,
  MemoryContext,
} from './types';
import { RouteMatch } from '../router/types';
import { NormalizedMessage, GatewayContext } from '../gateway/types';
import logger from '../logger';

/**
 * Central coordinator for command routing, validation, execution hooks, and
 * optional multi-capability workflows.
 */
export class CommandOrchestrator {
  private handlers: Map<string, CommandHandler> = new Map();
  private hooks: OrchestratorHooks = {};
  private agents: Map<AgentType, CommandHandler> = new Map();

  registerHandler(handler: CommandHandler): void {
    this.handlers.set(handler.id, handler);
  }

  registerHandlers(handlers: CommandHandler[]): void {
    for (const handler of handlers) {
      this.registerHandler(handler);
    }
  }

  getHandler(id: string): CommandHandler | undefined {
    return this.handlers.get(id);
  }

  hasHandler(id: string): boolean {
    return this.handlers.has(id);
  }

  setHooks(hooks: OrchestratorHooks): void {
    this.hooks = hooks;
  }

  addPreHook(hook: NonNullable<OrchestratorHooks['pre']>[number]): void {
    this.hooks.pre = this.hooks.pre || [];
    this.hooks.pre.push(hook);
  }

  addPostHook(hook: NonNullable<OrchestratorHooks['post']>[number]): void {
    this.hooks.post = this.hooks.post || [];
    this.hooks.post.push(hook);
  }

  addErrorHook(hook: NonNullable<OrchestratorHooks['onError']>[number]): void {
    this.hooks.onError = this.hooks.onError || [];
    this.hooks.onError.push(hook);
  }

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
      message,
      route: routeMatch.route,
      routeMatch,
      gatewayContext,

      userId,
      userTier: 'free',
      wallet,
      isAuthenticated,

      understanding: routeMatch.understanding,
      arguments: routeMatch.arguments || [],
      params: routeMatch.params || {},

      memory: memory || {
        conversation: [],
        working: new Map(),
      },

      requestId: uuid(),
      startTime: new Date(),
    };
  }

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
      await this.runPreHooks(context);

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

      const startTime = Date.now();
      const result = await handler.execute(context);
      const durationMs = Date.now() - startTime;

      result.meta = {
        ...result.meta,
        handlerId: handler.id,
        routeId: context.route.id,
        executedAt: new Date(),
        durationMs,
        skillsUsed: handler.skillsUsed || [],
        apiCallsMade: result.meta?.apiCallsMade || 0,
      };

      await this.runPostHooks(context, result);

      if (context.route.recordEpisode) {
        await this.recordEpisode(context, result);
      }

      return result;

    } catch (error) {
      await this.runErrorHooks(context, error as Error);

      return this.createErrorResult(
        context,
        'EXECUTION_ERROR',
        error instanceof Error ? error.message : 'Unknown error',
        true
      );
    }
  }

  async executeStream(context: CommandContext): Promise<StreamingCommandResult> {
    const result = await this.execute(context);
    return this.wrapAsStream(result);
  }

  registerAgent(type: AgentType, handler: CommandHandler): void {
    this.agents.set(type, handler);
  }

  async executePlan(
    plan: ExecutionPlan,
    context: CommandContext
  ): Promise<AgentResult[]> {
    const results: AgentResult[] = [];

    for (const step of plan.steps) {
      const agent = this.agents.get(step.agentId);
      if (!agent) {
        logger.warn('Capability handler not found', {
          agentId: step.agentId,
          requestId: context.requestId,
        });
        continue;
      }

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
    }

    return results;
  }

  async synthesize(
    context: CommandContext,
    results: AgentResult[]
  ): Promise<CommandResult> {
    const lastResult = results[results.length - 1];

    return {
      success: true,
      data: lastResult?.data,
      meta: {
        handlerId: 'synthesizer',
        routeId: context.route.id,
        executedAt: new Date(),
        durationMs: 0,
        skillsUsed: results.map(r => r.agentId),
        apiCallsMade: 0,
      },
    };
  }

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
        logger.error('Orchestrator error hook failed', hookError, {
          requestId: context.requestId,
          routeId: context.route.id,
        });
      }
    }
  }

  private async recordEpisode(
    context: CommandContext,
    result: CommandResult
  ): Promise<void> {
    logger.debug('Command episode completed', {
      requestId: context.requestId,
      routeId: context.route.id,
      success: result.success,
    });
  }

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

let orchestratorInstance: CommandOrchestrator | null = null;

export function getOrchestrator(): CommandOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new CommandOrchestrator();
  }
  return orchestratorInstance;
}

export function resetOrchestrator(): void {
  orchestratorInstance = null;
}
