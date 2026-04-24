/**
 * Signal Channels — barrel export
 *
 * Signal channels are forecaster-led subscription feeds (Supabase-backed).
 *
 * Distribution channels (new):
 *   - Discord: Community alerts
 *   - Twitter: Public alerts
 *   - MCP: Claude Code integration
 */

export * from './types';
export * from './client';
export * from './discord';
export * from './twitter';
export * from './mcp';

// =============================================================================
// Multi-Channel Distribution
// =============================================================================

import { EvaluatedSignal } from '../signals/types';
import { SynthesisReport } from '../synthesis/types';

import {
  sendSignalAlert as sendDiscordSignal,
  sendSynthesisReport as sendDiscordReport,
  sendArbAlert as sendDiscordArb,
  isDiscordConfigured,
} from './discord';

import {
  postSignalToTwitter,
  postDailySummary as postTwitterSummary,
  postArbToTwitter,
  isTwitterConfigured,
} from './twitter';

export type DistributionChannel = 'telegram' | 'discord' | 'twitter' | 'mcp';

interface BroadcastResult {
  channel: DistributionChannel;
  success: boolean;
  error?: string;
}

/**
 * Broadcast signal to multiple channels
 */
export async function broadcastSignal(
  signal: EvaluatedSignal,
  channels: DistributionChannel[] = ['discord']
): Promise<BroadcastResult[]> {
  const results: BroadcastResult[] = [];

  for (const channel of channels) {
    try {
      let success = false;

      switch (channel) {
        case 'discord':
          if (isDiscordConfigured()) {
            success = await sendDiscordSignal(signal);
          }
          break;

        case 'twitter':
          if (isTwitterConfigured()) {
            success = await postSignalToTwitter(signal);
          }
          break;

        case 'telegram':
          success = true; // Handled by alertRouter
          break;

        case 'mcp':
          success = true; // Query-based
          break;
      }

      results.push({ channel, success });
    } catch (err) {
      results.push({
        channel,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Broadcast synthesis report to all configured channels
 */
export async function broadcastReport(
  report: SynthesisReport,
  channels: DistributionChannel[] = ['discord', 'twitter']
): Promise<BroadcastResult[]> {
  const results: BroadcastResult[] = [];

  for (const channel of channels) {
    try {
      let success = false;

      switch (channel) {
        case 'discord':
          if (isDiscordConfigured()) {
            success = await sendDiscordReport(report);
          }
          break;

        case 'twitter':
          if (isTwitterConfigured()) {
            success = await postTwitterSummary(report);
          }
          break;

        default:
          success = true;
      }

      results.push({ channel, success });
    } catch (err) {
      results.push({
        channel,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Get status of all distribution channels
 */
export function getDistributionChannelStatus(): Record<DistributionChannel, boolean> {
  return {
    telegram: true,
    discord: isDiscordConfigured(),
    twitter: isTwitterConfigured(),
    mcp: true,
  };
}
