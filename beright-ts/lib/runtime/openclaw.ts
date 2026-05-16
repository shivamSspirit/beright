/**
 * BeRight OpenClaw Runtime
 *
 * Canonical execution bridge for BeRight product requests.
 *
 * This module standardizes the OpenClaw-style runtime path:
 *   message -> router -> orchestrator -> formatter
 *
 * It exists to keep BeRight business logic independent from legacy
 * Telegram-specific wrappers while the repo migrates to an OpenClaw-only
 * runtime architecture.
 */

import type { CommandContext, CommandResult } from '../orchestrator/types';
import type { GatewayContext, GatewayType, NormalizedMessage, FormattedResponse } from '../gateway/types';
import { getRouter } from '../router/unifiedRouter';
import { getOrchestrator } from '../orchestrator/orchestrator';
import { getFormatter } from '../gateway/formatters/types';
import { getTelegramFormatter } from '../gateway/formatters/telegram';
import { syncToOrchestrator } from '../orchestrator/handlers/registry';
import type { SkillResponse, TelegramMessage } from '../../types';

// Import handler/formatter modules for registration side effects.
import '../orchestrator/index';
import '../gateway/formatters/telegram';
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
}

export interface RuntimeExecutionResult {
  context: CommandContext;
  result: CommandResult;
  formatted: FormattedResponse;
}

let initialized = false;

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

export function initializeBeRightOpenClawRuntime(): void {
  if (initialized) {
    return;
  }

  syncToOrchestrator();
  initialized = true;
}

export async function executeBeRightOpenClawRequest(
  request: RuntimeExecutionRequest
): Promise<RuntimeExecutionResult> {
  initializeBeRightOpenClawRuntime();

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

  const result = await getOrchestrator().execute(context);
  const formatter = getFormatter(request.gateway) || getTelegramFormatter();
  const formatted = formatter.format(result, context);

  return {
    context,
    result,
    formatted,
  };
}

export async function executeBeRightOpenClawTelegramMessage(
  message: TelegramMessage
): Promise<SkillResponse> {
  const text = message.text?.trim() || '';
  const userId = message.from?.id ? String(message.from.id) : String(message.chat.id);
  const chatId = String(message.chat.id);
  const isGroup = message.chat.type === 'group' || message.chat.type === 'supergroup';

  const execution = await executeBeRightOpenClawRequest({
    gateway: 'telegram',
    userId,
    chatId,
    text,
    raw: message,
    isAuthenticated: true,
    gatewayContext: {
      isGroup,
      supportsButtons: true,
      supportsMedia: true,
      supportsStreaming: false,
      maxTextLength: 4096,
    },
  });

  return {
    text: execution.formatted.text,
    mood: execution.result.hints?.mood,
    data: execution.result.data,
  };
}
