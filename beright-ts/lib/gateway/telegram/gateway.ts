/**
 * Telegram Gateway
 *
 * This is a THIN gateway. It:
 * 1. Receives messages from Telegram
 * 2. Passes to router for intent matching
 * 3. Passes to orchestrator for execution
 * 4. Formats result for Telegram
 * 5. Sends response
 *
 * ZERO business logic. ZERO formatting decisions.
 * That's the handlers' and formatters' job.
 *
 */

import { getRouter } from '../../router/unifiedRouter';
import { getOrchestrator } from '../../orchestrator/orchestrator';
import { getTelegramFormatter } from '../formatters/telegram';
import { NormalizedMessage, GatewayContext, FormattedResponse } from '../types';
import { CommandContext } from '../../orchestrator/types';
import { v4 as uuid } from 'uuid';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Raw Telegram message (from node-telegram-bot-api)
 */
export interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    is_bot?: boolean;
  };
  chat: {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  };
  date: number;
  text?: string;
  reply_to_message?: TelegramMessage;
  entities?: Array<{
    type: string;
    offset: number;
    length: number;
  }>;
}

/**
 * Telegram response options
 */
export interface TelegramResponseOptions {
  parseMode?: 'Markdown' | 'HTML' | 'MarkdownV2';
  disableWebPagePreview?: boolean;
  disableNotification?: boolean;
  replyToMessageId?: number;
  replyMarkup?: {
    inline_keyboard?: Array<Array<{
      text: string;
      url?: string;
      callback_data?: string;
    }>>;
  };
}

/**
 * Send message function type (injected from telegram.ts)
 */
export type SendMessageFn = (
  chatId: number,
  text: string,
  options?: TelegramResponseOptions
) => Promise<void>;

// =============================================================================
// GATEWAY
// =============================================================================

/**
 * Telegram Gateway
 *
 * Stateless gateway that processes messages through the architecture.
 */
export class TelegramGateway {
  private sendMessage: SendMessageFn;

  constructor(sendMessage: SendMessageFn) {
    this.sendMessage = sendMessage;
  }

  /**
   * Handle incoming Telegram message
   *
   * This is the main entry point. The entire flow:
   * 1. Normalize message
   * 2. Route to determine intent
   * 3. Build context
   * 4. Execute via orchestrator
   * 5. Format for Telegram
   * 6. Send response
   */
  async handleMessage(message: TelegramMessage): Promise<void> {
    const startTime = Date.now();

    // 1. Extract text
    const text = message.text?.trim();
    if (!text) {
      return; // Ignore non-text messages
    }

    // 2. Normalize message
    const normalizedMessage = this.normalizeMessage(message);

    // 3. Route to determine intent
    const router = getRouter();
    const routeMatch = await router.match(text, {
      userId: String(message.from?.id || 0),
    });

    // 4. Build context
    const context = await this.buildContext(normalizedMessage, routeMatch, message);

    // 5. Execute via orchestrator
    const orchestrator = getOrchestrator();
    const result = await orchestrator.execute(context);

    // 6. Format for Telegram
    const formatter = getTelegramFormatter();
    const formatted = formatter.format(result, context);

    // 7. Send response
    await this.sendResponse(message.chat.id, formatted, message.message_id);

    // Log timing
    const duration = Date.now() - startTime;
    console.log(`[TelegramGateway] Processed in ${duration}ms: ${routeMatch.route.id}`);
  }

  /**
   * Normalize Telegram message to gateway-agnostic format
   */
  private normalizeMessage(message: TelegramMessage): NormalizedMessage {
    // Parse command if present
    let command: string | undefined;
    let args: string[] | undefined;

    const text = message.text || '';
    if (text.startsWith('/')) {
      const parts = text.split(/\s+/);
      command = parts[0].toLowerCase();
      args = parts.slice(1);
    }

    return {
      id: String(message.message_id),
      text,
      userId: String(message.from?.id || 0),
      chatId: String(message.chat.id),
      command,
      arguments: args,
      timestamp: new Date(message.date * 1000),
      replyTo: message.reply_to_message
        ? String(message.reply_to_message.message_id)
        : undefined,
      replyToText: message.reply_to_message?.text,
      gateway: 'telegram',
      raw: message,
    };
  }

  /**
   * Build command context
   */
  private async buildContext(
    message: NormalizedMessage,
    routeMatch: Awaited<ReturnType<typeof getRouter.prototype.match>>,
    rawMessage: TelegramMessage
  ): Promise<CommandContext> {
    const isGroup = rawMessage.chat.type === 'group' || rawMessage.chat.type === 'supergroup';

    const gatewayContext: GatewayContext = {
      gateway: 'telegram',
      chatId: String(rawMessage.chat.id),
      isGroup,
      supportsButtons: true,
      supportsMedia: true,
      supportsStreaming: false,
      maxTextLength: 4096,
    };

    // Use orchestrator's buildContext for consistency
    const orchestrator = getOrchestrator();
    return orchestrator.buildContext(message, routeMatch, {
      gatewayContext,
      userId: message.userId,
      isAuthenticated: true, // Telegram users are authenticated via their ID
      // TODO: Fetch wallet from user profile
      // TODO: Fetch memory context
    });
  }

  /**
   * Send formatted response to Telegram
   */
  private async sendResponse(
    chatId: number,
    formatted: FormattedResponse,
    replyToId?: number
  ): Promise<void> {
    const options: TelegramResponseOptions = {
      parseMode: formatted.parseMode as TelegramResponseOptions['parseMode'],
      disableWebPagePreview: true,
    };

    // Add reply markup if buttons present
    if (formatted.buttons && formatted.buttons.length > 0) {
      options.replyMarkup = {
        inline_keyboard: [
          formatted.buttons.map(btn => ({
            text: btn.label,
            url: btn.type === 'url' ? btn.value : undefined,
            callback_data: btn.type === 'callback' ? btn.value : undefined,
          })),
        ],
      };
    }

    await this.sendMessage(chatId, formatted.text, options);
  }

}

// =============================================================================
// FACTORY
// =============================================================================

let gatewayInstance: TelegramGateway | null = null;

/**
 * Initialize Telegram gateway with send function
 */
export function initTelegramGateway(sendMessage: SendMessageFn): TelegramGateway {
  gatewayInstance = new TelegramGateway(sendMessage);
  return gatewayInstance;
}

/**
 * Get Telegram gateway instance
 */
export function getTelegramGateway(): TelegramGateway {
  if (!gatewayInstance) {
    throw new Error('TelegramGateway not initialized. Call initTelegramGateway first.');
  }
  return gatewayInstance;
}

/**
 * Handle Telegram message (convenience function)
 */
export async function handleTelegramMessage(message: TelegramMessage): Promise<void> {
  return getTelegramGateway().handleMessage(message);
}
