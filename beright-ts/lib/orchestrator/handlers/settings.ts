/**
 * Settings Handler
 *
 * Manage user preferences and settings.
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
  getUserProfile,
  updateUserPreferences,
  UserProfile,
} from '../../cognitiveMemory';

// =============================================================================
// TYPES
// =============================================================================

export interface SettingsResult {
  timestamp: string;
  action: 'view' | 'update';
  success: boolean;
  message?: string;
  settings?: {
    userId: string;
    memberSince: string;
    lastActive: string;
    totalMessages: number;
    // Preferences
    riskTolerance?: 'low' | 'medium' | 'high';
    communicationStyle?: string;
    preferredTopics?: string[];
    favoriteCommands?: string[];
    // Track record
    predictionsCount?: number;
    calibrationScore?: number;
  };
  updated?: {
    field: string;
    value: string;
  };
}

// =============================================================================
// HANDLER
// =============================================================================

export const settingsHandler: CommandHandler<SettingsResult> = {
  id: 'settings',
  skillsUsed: ['memory'],

  async execute(context: CommandContext): Promise<CommandResult<SettingsResult>> {
    const startTime = Date.now();

    try {
      const userId = context.userId || context.gatewayContext?.chatId?.toString() || 'anonymous';
      const rawMessage = context.message?.text || '';
      const args = rawMessage.replace(/^\/(settings|config|preferences)\s*/i, '').trim();

      // Get current profile
      const profile = getUserProfile(userId);

      // Check for update commands
      if (args) {
        const parts = args.toLowerCase().split(/\s+/);

        // Set risk tolerance: /settings risk low|medium|high
        if (parts[0] === 'risk' && parts[1]) {
          const validRisk = ['low', 'medium', 'high'];
          if (validRisk.includes(parts[1])) {
            updateUserPreferences(userId, {
              riskTolerance: parts[1] as 'low' | 'medium' | 'high',
            });

            const result: SettingsResult = {
              timestamp: new Date().toISOString(),
              action: 'update',
              success: true,
              message: `Risk tolerance set to ${parts[1]}`,
              updated: {
                field: 'riskTolerance',
                value: parts[1],
              },
            };

            return {
              success: true,
              data: result,
              meta: {
                handlerId: 'settings',
                routeId: context.route.id,
                executedAt: new Date(),
                durationMs: Date.now() - startTime,
                skillsUsed: ['memory'],
                apiCallsMade: 0,
              },
              hints: {
                mood: 'NEUTRAL',
                suggestedActions: ['/settings'],
              },
            };
          } else {
            return {
              success: false,
              error: {
                code: 'INVALID_RISK',
                message: 'Risk tolerance must be: low, medium, or high',
                retryable: false,
                recoveryAction: '/settings risk medium',
              },
              meta: {
                handlerId: 'settings',
                routeId: context.route.id,
                executedAt: new Date(),
                durationMs: Date.now() - startTime,
                skillsUsed: [],
                apiCallsMade: 0,
              },
              hints: {
                mood: 'EDUCATIONAL',
              },
            };
          }
        }

        // Set communication style: /settings style brief|detailed|technical
        if (parts[0] === 'style' && parts[1]) {
          const validStyles = ['brief', 'detailed', 'technical', 'casual'];
          if (validStyles.includes(parts[1])) {
            updateUserPreferences(userId, {
              communicationStyle: parts[1],
            });

            const result: SettingsResult = {
              timestamp: new Date().toISOString(),
              action: 'update',
              success: true,
              message: `Communication style set to ${parts[1]}`,
              updated: {
                field: 'communicationStyle',
                value: parts[1],
              },
            };

            return {
              success: true,
              data: result,
              meta: {
                handlerId: 'settings',
                routeId: context.route.id,
                executedAt: new Date(),
                durationMs: Date.now() - startTime,
                skillsUsed: ['memory'],
                apiCallsMade: 0,
              },
              hints: {
                mood: 'NEUTRAL',
                suggestedActions: ['/settings'],
              },
            };
          }
        }

        // Add topic: /settings topic <topic>
        if (parts[0] === 'topic' && parts.slice(1).length > 0) {
          const topic = parts.slice(1).join(' ');
          updateUserPreferences(userId, {
            preferredTopics: [topic],
          });

          const result: SettingsResult = {
            timestamp: new Date().toISOString(),
            action: 'update',
            success: true,
            message: `Added "${topic}" to your interests`,
            updated: {
              field: 'preferredTopics',
              value: topic,
            },
          };

          return {
            success: true,
            data: result,
            meta: {
              handlerId: 'settings',
              routeId: context.route.id,
              executedAt: new Date(),
              durationMs: Date.now() - startTime,
              skillsUsed: ['memory'],
              apiCallsMade: 0,
            },
            hints: {
              mood: 'NEUTRAL',
              suggestedActions: ['/settings', '/recs'],
            },
          };
        }
      }

      // Default: show current settings
      const result: SettingsResult = {
        timestamp: new Date().toISOString(),
        action: 'view',
        success: true,
        settings: {
          userId: profile.userId,
          memberSince: profile.firstSeen,
          lastActive: profile.lastSeen,
          totalMessages: profile.totalMessages,
          riskTolerance: profile.riskTolerance,
          communicationStyle: profile.communicationStyle,
          preferredTopics: profile.preferredTopics,
          favoriteCommands: profile.favoriteCommands,
          predictionsCount: profile.predictionsCount,
          calibrationScore: profile.calibrationScore,
        },
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'settings',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['memory'],
          apiCallsMade: 0,
        },
        hints: {
          mood: 'NEUTRAL',
          suggestedActions: ['/settings risk medium', '/settings style brief'],
        },
      };
    } catch (error) {
      console.error('[SettingsHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'SETTINGS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to manage settings',
          retryable: true,
        },
        meta: {
          handlerId: 'settings',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['memory'],
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

registerHandler(settingsHandler);

export default settingsHandler;
