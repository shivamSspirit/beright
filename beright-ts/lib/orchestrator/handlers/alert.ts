/**
 * Alert Handler
 *
 * Manage price alerts on prediction markets.
 *
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import {
  createAlert,
  deleteAlert,
  getUserAlerts,
  PriceAlert,
} from '../../../skills/priceAlerts';

// =============================================================================
// TYPES
// =============================================================================

export interface AlertInfo {
  id: string;
  marketQuery: string;
  marketTitle?: string;
  platform?: string;
  direction: 'YES' | 'NO';
  condition: 'above' | 'below';
  threshold: number;
  currentPrice?: number;
  status: 'active' | 'triggered' | 'expired' | 'deleted';
  createdAt: string;
  triggeredAt?: string;
  triggerCount: number;
}

export interface AlertResult {
  timestamp: string;
  action: 'create' | 'delete' | 'list';
  success: boolean;
  message?: string;
  // For create
  alert?: AlertInfo;
  // For list
  alerts?: AlertInfo[];
  totalAlerts?: number;
}

// =============================================================================
// HANDLER
// =============================================================================

export const alertHandler: CommandHandler<AlertResult> = {
  id: 'alert',
  skillsUsed: ['priceAlerts', 'markets'],

  async execute(context: CommandContext): Promise<CommandResult<AlertResult>> {
    const startTime = Date.now();

    try {
      const userId = context.userId || context.gatewayContext?.chatId?.toString() || 'anonymous';
      const rawMessage = context.message?.text || '';
      const args = rawMessage.replace(/^\/alert\s*/i, '').trim();

      // List alerts if no args
      if (!args) {
        const userAlerts = getUserAlerts(userId);

        const alerts: AlertInfo[] = userAlerts.map(a => ({
          id: a.id,
          marketQuery: a.marketQuery,
          marketTitle: a.marketTitle,
          platform: a.platform,
          direction: a.direction,
          condition: a.condition,
          threshold: a.threshold,
          currentPrice: a.currentPrice,
          status: a.status,
          createdAt: a.createdAt,
          triggeredAt: a.triggeredAt,
          triggerCount: a.triggerCount,
        }));

        const result: AlertResult = {
          timestamp: new Date().toISOString(),
          action: 'list',
          success: true,
          alerts,
          totalAlerts: alerts.length,
        };

        return {
          success: true,
          data: result,
          meta: {
            handlerId: 'alert',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['priceAlerts'],
            apiCallsMade: 0,
          },
          hints: {
            mood: alerts.length > 0 ? 'NEUTRAL' : 'EDUCATIONAL',
            suggestedActions: alerts.length === 0
              ? ['/alert bitcoin below 80', '/alert fed rate above 60']
              : ['/alert delete <id>'],
          },
        };
      }

      // Delete alert: /alert delete <id>
      const deleteMatch = args.match(/^delete\s+(\S+)/i);
      if (deleteMatch) {
        const alertId = deleteMatch[1];
        const success = deleteAlert(userId, alertId);

        const result: AlertResult = {
          timestamp: new Date().toISOString(),
          action: 'delete',
          success,
          message: success
            ? `Deleted alert ${alertId}`
            : `Alert not found or already deleted`,
        };

        return {
          success: true,
          data: result,
          meta: {
            handlerId: 'alert',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['priceAlerts'],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'NEUTRAL',
            suggestedActions: ['/alert'],
          },
        };
      }

      // Parse: /alert <market> above/below <threshold> [YES/NO]
      const createMatch = args.match(/^(.+?)\s+(above|below)\s+(\d+(?:\.\d+)?)\s*(YES|NO)?$/i);

      if (!createMatch) {
        return {
          success: false,
          error: {
            code: 'INVALID_FORMAT',
            message: 'Invalid format. Usage: /alert <market> above|below <price> [YES|NO]',
            retryable: false,
            recoveryAction: 'Example: /alert bitcoin 100k below 80',
          },
          meta: {
            handlerId: 'alert',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'EDUCATIONAL',
            suggestedActions: ['/alert bitcoin below 80', '/alert fed rate above 60'],
          },
        };
      }

      const [, marketQuery, condition, thresholdStr, directionStr] = createMatch;
      const threshold = parseFloat(thresholdStr);
      const direction = (directionStr?.toUpperCase() as 'YES' | 'NO') || 'YES';
      const conditionType = condition.toLowerCase() as 'above' | 'below';

      if (threshold < 0 || threshold > 100) {
        return {
          success: false,
          error: {
            code: 'INVALID_THRESHOLD',
            message: 'Threshold must be between 0 and 100 (percentage)',
            retryable: false,
          },
          meta: {
            handlerId: 'alert',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'NEUTRAL',
          },
        };
      }

      // Create the alert
      const alert = await createAlert(userId, marketQuery, conditionType, threshold, direction);

      const alertInfo: AlertInfo = {
        id: alert.id,
        marketQuery: alert.marketQuery,
        marketTitle: alert.marketTitle,
        platform: alert.platform,
        direction: alert.direction,
        condition: alert.condition,
        threshold: alert.threshold,
        currentPrice: alert.currentPrice,
        status: alert.status,
        createdAt: alert.createdAt,
        triggerCount: alert.triggerCount,
      };

      const result: AlertResult = {
        timestamp: new Date().toISOString(),
        action: 'create',
        success: true,
        message: 'Alert created successfully',
        alert: alertInfo,
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'alert',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['priceAlerts', 'markets'],
          apiCallsMade: 1,
        },
        hints: {
          mood: 'BULLISH',
          suggestedActions: ['/alert'],
        },
      };
    } catch (error) {
      console.error('[AlertHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'ALERT_FAILED',
          message: error instanceof Error ? error.message : 'Failed to process alert',
          retryable: true,
        },
        meta: {
          handlerId: 'alert',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['priceAlerts'],
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

registerHandler(alertHandler);

export default alertHandler;
