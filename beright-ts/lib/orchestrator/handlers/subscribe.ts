/**
 * Subscribe Handler
 *
 * Manage notification subscriptions and alert settings.
 *
 * @see docs/ADR-002-TELEGRAM-AS-GATEWAY.md
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import {
  subscribe,
  unsubscribe,
  getSubscriber,
  updateSubscriber,
  getNotificationStats,
} from '../../../skills/notifications';

// =============================================================================
// TYPES
// =============================================================================

export interface AlertConfig {
  type: 'arb' | 'whale' | 'price' | 'brief';
  enabled: boolean;
  threshold?: number;
}

export interface SubscriptionInfo {
  telegramId: string;
  username?: string;
  alerts: AlertConfig[];
  briefTime: string;
  timezone: string;
  lastBriefSent?: string;
  createdAt: string;
}

export interface SubscribeResult {
  timestamp: string;
  action: 'subscribe' | 'unsubscribe' | 'update' | 'status';
  success: boolean;
  message?: string;
  subscription?: SubscriptionInfo;
  stats?: {
    totalSubscribers: number;
    briefSubscribers: number;
    arbSubscribers: number;
    whaleSubscribers: number;
    pendingAlerts: number;
  };
}

// =============================================================================
// HANDLER
// =============================================================================

export const subscribeHandler: CommandHandler<SubscribeResult> = {
  id: 'subscribe',
  skillsUsed: ['notifications'],

  async execute(context: CommandContext): Promise<CommandResult<SubscribeResult>> {
    const startTime = Date.now();

    try {
      const userId = context.userId || context.gatewayContext?.chatId?.toString() || 'anonymous';
      // Username is not available in the gateway context, use userId instead
      const username = context.userId || undefined;
      const rawMessage = context.message?.text || '';

      // Check if this is an unsubscribe command
      const isUnsubscribe = rawMessage.toLowerCase().startsWith('/unsubscribe');

      if (isUnsubscribe) {
        const success = unsubscribe(userId);

        const result: SubscribeResult = {
          timestamp: new Date().toISOString(),
          action: 'unsubscribe',
          success,
          message: success
            ? 'Successfully unsubscribed from all alerts'
            : 'You were not subscribed to alerts',
        };

        return {
          success: true,
          data: result,
          meta: {
            handlerId: 'subscribe',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['notifications'],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'NEUTRAL',
            suggestedActions: ['/subscribe'],
          },
        };
      }

      // Check for /alerts command (manage settings)
      const isAlerts = rawMessage.toLowerCase().startsWith('/alerts');
      if (isAlerts) {
        const args = rawMessage.replace(/^\/alerts\s*/i, '').trim();
        const existing = getSubscriber(userId);

        if (!existing) {
          return {
            success: false,
            error: {
              code: 'NOT_SUBSCRIBED',
              message: 'You are not subscribed to alerts',
              retryable: false,
              recoveryAction: 'Use /subscribe to start receiving alerts',
            },
            meta: {
              handlerId: 'subscribe',
              routeId: context.route.id,
              executedAt: new Date(),
              durationMs: Date.now() - startTime,
              skillsUsed: [],
              apiCallsMade: 0,
            },
            hints: {
              mood: 'NEUTRAL',
              suggestedActions: ['/subscribe'],
            },
          };
        }

        // Parse args for updates
        if (args) {
          const parts = args.toLowerCase().split(' ');

          // Toggle: /alerts on|off arb|whale|brief
          if ((parts[0] === 'on' || parts[0] === 'off') && parts[1]) {
            const alertType = parts[1] as 'arb' | 'whale' | 'brief';
            const enabled = parts[0] === 'on';
            const alerts = [...existing.alerts];
            const alertConfig = alerts.find(a => a.type === alertType);

            if (alertConfig) {
              alertConfig.enabled = enabled;
              updateSubscriber(userId, { alerts });

              const result: SubscribeResult = {
                timestamp: new Date().toISOString(),
                action: 'update',
                success: true,
                message: `${alertType.toUpperCase()} alerts turned ${parts[0].toUpperCase()}`,
                subscription: {
                  telegramId: existing.telegramId,
                  username: existing.username,
                  alerts: alerts as AlertConfig[],
                  briefTime: existing.briefTime,
                  timezone: existing.timezone,
                  lastBriefSent: existing.lastBriefSent,
                  createdAt: existing.createdAt,
                },
              };

              return {
                success: true,
                data: result,
                meta: {
                  handlerId: 'subscribe',
                  routeId: context.route.id,
                  executedAt: new Date(),
                  durationMs: Date.now() - startTime,
                  skillsUsed: ['notifications'],
                  apiCallsMade: 0,
                },
                hints: {
                  mood: 'NEUTRAL',
                  suggestedActions: ['/alerts'],
                },
              };
            }
          }

          // Threshold: /alerts threshold arb|whale <value>
          if (parts[0] === 'threshold' && parts[1] && parts[2]) {
            const alertType = parts[1] as 'arb' | 'whale';
            const threshold = parseFloat(parts[2]);

            if (!isNaN(threshold)) {
              const alerts = [...existing.alerts];
              const alertConfig = alerts.find(a => a.type === alertType);

              if (alertConfig) {
                alertConfig.threshold = threshold;
                updateSubscriber(userId, { alerts });

                const result: SubscribeResult = {
                  timestamp: new Date().toISOString(),
                  action: 'update',
                  success: true,
                  message: `${alertType.toUpperCase()} threshold set to ${alertType === 'arb' ? threshold + '%' : '$' + threshold.toLocaleString()}`,
                  subscription: {
                    telegramId: existing.telegramId,
                    username: existing.username,
                    alerts: alerts as AlertConfig[],
                    briefTime: existing.briefTime,
                    timezone: existing.timezone,
                    lastBriefSent: existing.lastBriefSent,
                    createdAt: existing.createdAt,
                  },
                };

                return {
                  success: true,
                  data: result,
                  meta: {
                    handlerId: 'subscribe',
                    routeId: context.route.id,
                    executedAt: new Date(),
                    durationMs: Date.now() - startTime,
                    skillsUsed: ['notifications'],
                    apiCallsMade: 0,
                  },
                  hints: {
                    mood: 'NEUTRAL',
                    suggestedActions: ['/alerts'],
                  },
                };
              }
            }
          }

          // Time: /alerts time HH:MM
          if (parts[0] === 'time' && parts[1]) {
            const timeMatch = parts[1].match(/(\d{1,2}):?(\d{2})?/);
            if (timeMatch) {
              const hour = timeMatch[1].padStart(2, '0');
              const minute = (timeMatch[2] || '00').padStart(2, '0');
              const briefTime = `${hour}:${minute}`;

              updateSubscriber(userId, { briefTime });

              const result: SubscribeResult = {
                timestamp: new Date().toISOString(),
                action: 'update',
                success: true,
                message: `Morning brief time set to ${briefTime} UTC`,
              };

              return {
                success: true,
                data: result,
                meta: {
                  handlerId: 'subscribe',
                  routeId: context.route.id,
                  executedAt: new Date(),
                  durationMs: Date.now() - startTime,
                  skillsUsed: ['notifications'],
                  apiCallsMade: 0,
                },
                hints: {
                  mood: 'NEUTRAL',
                  suggestedActions: ['/alerts'],
                },
              };
            }
          }
        }

        // Show current settings
        const result: SubscribeResult = {
          timestamp: new Date().toISOString(),
          action: 'status',
          success: true,
          subscription: {
            telegramId: existing.telegramId,
            username: existing.username,
            alerts: existing.alerts as AlertConfig[],
            briefTime: existing.briefTime,
            timezone: existing.timezone,
            lastBriefSent: existing.lastBriefSent,
            createdAt: existing.createdAt,
          },
        };

        return {
          success: true,
          data: result,
          meta: {
            handlerId: 'subscribe',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['notifications'],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'NEUTRAL',
            suggestedActions: ['/alerts on arb', '/alerts off whale', '/alerts time 09:00'],
          },
        };
      }

      // Default: Subscribe
      const existing = getSubscriber(userId);

      if (existing) {
        const result: SubscribeResult = {
          timestamp: new Date().toISOString(),
          action: 'status',
          success: true,
          message: 'Already subscribed',
          subscription: {
            telegramId: existing.telegramId,
            username: existing.username,
            alerts: existing.alerts as AlertConfig[],
            briefTime: existing.briefTime,
            timezone: existing.timezone,
            lastBriefSent: existing.lastBriefSent,
            createdAt: existing.createdAt,
          },
        };

        return {
          success: true,
          data: result,
          meta: {
            handlerId: 'subscribe',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['notifications'],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'NEUTRAL',
            suggestedActions: ['/alerts', '/unsubscribe'],
          },
        };
      }

      // Create new subscription
      const sub = subscribe(userId, username);

      const result: SubscribeResult = {
        timestamp: new Date().toISOString(),
        action: 'subscribe',
        success: true,
        message: 'Successfully subscribed to alerts',
        subscription: {
          telegramId: sub.telegramId,
          username: sub.username,
          alerts: sub.alerts as AlertConfig[],
          briefTime: sub.briefTime,
          timezone: sub.timezone,
          createdAt: sub.createdAt,
        },
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'subscribe',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['notifications'],
          apiCallsMade: 0,
        },
        hints: {
          mood: 'BULLISH',
          suggestedActions: ['/alerts'],
        },
      };
    } catch (error) {
      console.error('[SubscribeHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'SUBSCRIBE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to manage subscription',
          retryable: true,
        },
        meta: {
          handlerId: 'subscribe',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['notifications'],
          apiCallsMade: 0,
        },
        hints: {
          mood: 'ERROR',
        },
      };
    }
  },
};

// =============================================================================
// AUTO-REGISTER
// =============================================================================

registerHandler(subscribeHandler);

export default subscribeHandler;
