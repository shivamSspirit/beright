/**
 * Gateway Layer Types
 *
 * Defines interfaces for gateways (Telegram, Web, API, Discord, CLI).
 * Gateways are responsible for:
 * - Receiving input from external sources
 * - Normalizing messages into a standard format
 * - Delivering formatted responses back
 *
 * They do NOT contain business logic or formatting decisions.
 *
 * @see docs/ADR-001-GATEWAY-SKILL-SEPARATION.md
 */

// =============================================================================
// NORMALIZED MESSAGE
// =============================================================================

/**
 * Attachment from user message (images, files, etc.)
 */
export interface Attachment {
  type: 'image' | 'file' | 'audio' | 'video' | 'location' | 'contact';
  url?: string;
  mimeType?: string;
  filename?: string;
  size?: number;
  /** For images: base64 encoded or URL */
  data?: string;
  /** For location */
  coordinates?: { lat: number; lng: number };
}

/**
 * Normalized message format
 *
 * All gateways convert their native message format to this structure.
 * This is the canonical representation of a user message.
 */
export interface NormalizedMessage {
  /** Unique message ID */
  id: string;

  /** User identifier (platform-specific, but stable per user) */
  userId: string;

  /** Chat/channel/thread identifier */
  chatId: string;

  /** Raw text content */
  text: string;

  /** Parsed command (e.g., '/hot', '/research') */
  command?: string;

  /** Arguments after command (e.g., ['bitcoin', '50']) */
  arguments?: string[];

  /** Attached media or files */
  attachments?: Attachment[];

  /** ID of message this is replying to */
  replyTo?: string;

  /** Original message being replied to (if available) */
  replyToText?: string;

  /** Message timestamp */
  timestamp: Date;

  /** Gateway that received this message */
  gateway: GatewayType;

  /** Original gateway-specific message (for debugging/fallback) */
  raw: unknown;
}

// =============================================================================
// GATEWAY TYPES
// =============================================================================

/** Supported gateway types */
export type GatewayType = 'telegram' | 'web' | 'api' | 'discord' | 'cli' | 'slack' | 'whatsapp';

/** Parse mode for text formatting */
export type ParseMode = 'Markdown' | 'MarkdownV2' | 'HTML' | 'plain';

/**
 * Button for interactive responses
 */
export interface Button {
  /** Button text label */
  label: string;
  /** Action type */
  type: 'url' | 'callback' | 'command';
  /** URL for url type, callback data for callback, command for command */
  value: string;
}

/**
 * Media attachment for responses
 */
export interface Media {
  type: 'image' | 'chart' | 'file' | 'audio';
  url?: string;
  data?: string; // Base64
  caption?: string;
  filename?: string;
}

/**
 * Formatted response ready to send via gateway
 *
 * This is the output of Formatters, ready for gateway-specific sending.
 */
export interface FormattedResponse {
  /** Main text content */
  text: string;

  /** Text formatting mode */
  parseMode?: ParseMode;

  /** Interactive buttons (inline keyboard for Telegram, buttons for web) */
  buttons?: Button[];

  /** Media attachments */
  media?: Media[];

  /** For streaming responses */
  stream?: AsyncIterable<string>;

  /** Should this replace/edit a previous message? */
  editMessageId?: string;

  /** Disable link previews */
  disablePreview?: boolean;

  /** Disable notification sound */
  silent?: boolean;
}

// =============================================================================
// GATEWAY INTERFACE
// =============================================================================

/**
 * Message handler callback type
 */
export type MessageHandler = (message: NormalizedMessage) => Promise<void>;

/**
 * Subscription handler for real-time events
 */
export type SubscriptionHandler = (
  userId: string,
  topic: string,
  handler: (event: StreamEvent) => void
) => () => void; // Returns unsubscribe function

/**
 * Stream event for real-time updates
 */
export interface StreamEvent {
  type: string;
  data: unknown;
  timestamp: Date;
}

/**
 * Gateway Interface
 *
 * All gateways must implement this interface.
 * Gateways handle:
 * - Lifecycle (start/stop)
 * - Message normalization
 * - Response delivery
 *
 * They do NOT handle:
 * - Business logic
 * - Routing decisions
 * - Response formatting (delegated to Formatters)
 */
export interface Gateway {
  /** Gateway identifier */
  name: GatewayType;

  // =========================================================================
  // Lifecycle
  // =========================================================================

  /** Start the gateway (connect, begin polling, etc.) */
  start(): Promise<void>;

  /** Stop the gateway gracefully */
  stop(): Promise<void>;

  /** Check if gateway is running */
  isRunning(): boolean;

  // =========================================================================
  // Message Handling
  // =========================================================================

  /** Register handler for incoming messages */
  onMessage(handler: MessageHandler): void;

  /** Send a formatted response to a user */
  send(userId: string, response: FormattedResponse): Promise<void>;

  /** Send to a specific chat (may differ from userId for groups) */
  sendToChat(chatId: string, response: FormattedResponse): Promise<void>;

  // =========================================================================
  // Real-time (Optional)
  // =========================================================================

  /** Register handler for subscription requests (optional) */
  onSubscribe?(handler: SubscriptionHandler): void;

  /** Push real-time event to user (optional) */
  push?(userId: string, event: StreamEvent): Promise<void>;

  // =========================================================================
  // Gateway-Specific Features (Optional)
  // =========================================================================

  /** Edit a previously sent message */
  editMessage?(chatId: string, messageId: string, response: FormattedResponse): Promise<void>;

  /** Delete a message */
  deleteMessage?(chatId: string, messageId: string): Promise<void>;

  /** Send typing indicator */
  sendTyping?(chatId: string): Promise<void>;
}

// =============================================================================
// GATEWAY CONTEXT
// =============================================================================

/**
 * Gateway-specific context passed through the pipeline
 *
 * Contains information about the originating gateway that may affect
 * formatting or behavior.
 */
export interface GatewayContext {
  /** Which gateway this request came from */
  gateway: GatewayType;

  /** Original chat ID for response routing */
  chatId: string;

  /** User's preferred language (if known) */
  locale?: string;

  /** Timezone offset (if known) */
  timezoneOffset?: number;

  /** Is this a group chat or DM? */
  isGroup?: boolean;

  /** Can the gateway handle inline buttons? */
  supportsButtons?: boolean;

  /** Can the gateway handle images/media? */
  supportsMedia?: boolean;

  /** Can the gateway handle streaming responses? */
  supportsStreaming?: boolean;

  /** Maximum text length before truncation */
  maxTextLength?: number;
}

// =============================================================================
// NORMALIZER HELPER TYPE
// =============================================================================

/**
 * Normalizer function type
 *
 * Each gateway provides a normalizer that converts its native message
 * format to NormalizedMessage.
 */
export type MessageNormalizer<T> = (rawMessage: T, gateway: GatewayType) => NormalizedMessage;
