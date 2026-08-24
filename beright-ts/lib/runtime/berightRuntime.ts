/**
 * BeRight Runtime
 *
 * Canonical execution bridge for BeRight product requests.
 *
 * This module standardizes the runtime path:
 *   message -> router -> orchestrator -> formatter
 *
 * It keeps BeRight business logic independent from transport-specific wrappers.
 */

import type { CommandContext, CommandResult } from '../orchestrator/types';
import type { GatewayContext, GatewayType, NormalizedMessage, FormattedResponse } from '../gateway/types';
import { getRouter } from '../router/unifiedRouter';
import { getOrchestrator } from '../orchestrator/orchestrator';
import { getFormatter } from '../gateway/formatters/types';
import { syncToOrchestrator } from '../orchestrator/handlers/registry';

// Import handler/formatter modules for registration side effects.
import '../orchestrator/index';
import '../gateway/formatters/json';
import '../gateway/formatters/web';

export interface RuntimeExecutionRequest {
  gateway: GatewayType;
  userId: string;
  chatId: string;
  text: string;
  raw?: unknown;
  isAuthenticated?: boolean;
  wallet?: CommandContext['wallet'];
  memory?: CommandContext['memory'];
  gatewayContext?: Partial<GatewayContext>;
  executionPolicy?: 'allow' | 'prepare_only';
}

export interface RuntimeExecutionResult {
  context: CommandContext;
  result: CommandResult;
  formatted: FormattedResponse;
}

let initialized = false;

interface PreparedExecutionData {
  text: string;
  mood: 'NEUTRAL';
  agentUsed: 'beright-runtime';
  capabilityUsed: 'TRADER';
  data: {
    kind: 'execution_review';
    routeId: string;
    originalCommand: string;
    quoteCommand: string | null;
    requiresWalletSignature: true;
    executable: false;
  };
}

function isExecutionRoute(route: RuntimeExecutionResult['context']['route']): boolean {
  return route.goals?.some((goal) => goal === 'EXECUTE_TRADE' || goal === 'MANAGE_WALLET') === true;
}

function buildQuoteCommand(context: CommandContext): string | null {
  if (context.route.id !== 'trade') return null;

  const ticker = typeof context.params.ticker === 'string'
    ? context.params.ticker
    : context.arguments?.[0];
  const side = typeof context.params.side === 'string'
    ? context.params.side.toUpperCase()
    : context.arguments?.[1]?.toUpperCase();
  const amount = typeof context.params.amount === 'string'
    ? context.params.amount
    : context.arguments?.[2];

  if (!ticker || (side !== 'YES' && side !== 'NO')) return '/quote';
  return `/quote ${ticker} ${side} ${amount || '10'}`;
}

function prepareExecution(context: CommandContext): CommandResult<PreparedExecutionData> {
  const quoteCommand = buildQuoteCommand(context);
  return {
    success: true,
    data: {
      text: quoteCommand
        ? 'I prepared this as a quote-first trade review. Check the live price and risk, then approve the final transaction in your wallet.'
        : 'This action can move funds. Open its review flow and approve the exact transaction in your wallet.',
      mood: 'NEUTRAL',
      agentUsed: 'beright-runtime',
      capabilityUsed: 'TRADER',
      data: {
        kind: 'execution_review',
        routeId: context.route.id,
        originalCommand: context.message.text,
        quoteCommand,
        requiresWalletSignature: true,
        executable: false,
      },
    },
    meta: {
      handlerId: 'execution-preparer',
      routeId: context.route.id,
      executedAt: new Date(),
      durationMs: 0,
      skillsUsed: ['execution-policy'],
      apiCallsMade: 0,
    },
    hints: {
      mood: 'NEUTRAL',
      category: 'execution_review',
      suggestedActions: quoteCommand ? [quoteCommand] : ['/markets'],
    },
  };
}

function getDefaultGatewayContext(gateway: GatewayType, chatId: string): GatewayContext {
  switch (gateway) {
    case 'web':
      return {
        gateway: 'web',
        chatId,
        isGroup: false,
        supportsButtons: true,
        supportsMedia: true,
        supportsStreaming: true,
        maxTextLength: 32768,
      };
    case 'api':
      return {
        gateway: 'api',
        chatId,
        isGroup: false,
        supportsButtons: false,
        supportsMedia: false,
        supportsStreaming: false,
        maxTextLength: 32768,
      };
    default:
      return {
        gateway,
        chatId,
        isGroup: false,
        supportsButtons: true,
        supportsMedia: true,
        supportsStreaming: false,
        maxTextLength: 4096,
      };
  }
}

function buildNormalizedMessage(request: RuntimeExecutionRequest): NormalizedMessage {
  const trimmed = request.text.trim();
  const parts = trimmed.startsWith('/') ? trimmed.split(/\s+/) : [];

  return {
    id: `${request.gateway}-${Date.now()}`,
    userId: request.userId,
    chatId: request.chatId,
    text: trimmed,
    command: parts[0]?.toLowerCase(),
    arguments: parts.length > 0 ? parts.slice(1) : undefined,
    timestamp: new Date(),
    gateway: request.gateway,
    raw: request.raw ?? { gateway: request.gateway },
  };
}

export function initializeBeRightRuntime(): void {
  if (initialized) {
    return;
  }

  syncToOrchestrator();
  initialized = true;
}

export async function executeBeRightRuntimeRequest(
  request: RuntimeExecutionRequest
): Promise<RuntimeExecutionResult> {
  initializeBeRightRuntime();

  const normalizedMessage = buildNormalizedMessage(request);
  const routeMatch = await getRouter().match(normalizedMessage.text, {
    userId: request.userId,
  });

  const context = await getOrchestrator().buildContext(normalizedMessage, routeMatch, {
    gatewayContext: {
      ...getDefaultGatewayContext(request.gateway, request.chatId),
      ...request.gatewayContext,
    },
    userId: request.userId,
    isAuthenticated: request.isAuthenticated ?? false,
    memory: request.memory,
    wallet: request.wallet,
  });

  const result = request.executionPolicy === 'prepare_only' && isExecutionRoute(context.route)
    ? prepareExecution(context)
    : await getOrchestrator().execute(context);
  const formatter = getFormatter(request.gateway);
  const formatted = formatter
    ? formatter.format(result, context)
    : { text: typeof result.data === 'string' ? result.data : JSON.stringify(result.data) };

  return {
    context,
    result,
    formatted,
  };
}
