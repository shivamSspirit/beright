/**
 * Discord Bot Client
 *
 * Sends alerts and reports to Discord channels.
 * Supports:
 *   - Signal alerts to #alerts channel
 *   - Synthesis reports to #intel channel
 *   - Arbitrage opportunities to #arb channel
 *
 * Setup:
 *   1. Create Discord application at discord.com/developers
 *   2. Add bot to server with message permissions
 *   3. Set DISCORD_BOT_TOKEN and DISCORD_CHANNEL_IDS in env
 *
 * Usage:
 *   await sendDiscordAlert(signal);
 *   await sendDiscordReport(report);
 */

import { EvaluatedSignal, SIGNAL_META } from '../signals/types';
import { SynthesisReport } from '../synthesis/types';

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
}

interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
}

// Discord API
const DISCORD_API = 'https://discord.com/api/v10';

// Channel configuration
export interface DiscordChannelConfig {
  alerts?: string;    // Signal alerts
  intel?: string;     // Synthesis reports
  arb?: string;       // Arbitrage opportunities
  general?: string;   // General updates
}

let channelConfig: DiscordChannelConfig = {};

/**
 * Initialize Discord client with channel IDs
 */
export function initDiscord(config: DiscordChannelConfig): void {
  channelConfig = config;
}

/**
 * Send message to Discord channel
 */
async function sendToChannel(
  channelId: string,
  message: DiscordMessage
): Promise<boolean> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.warn('[Discord] DISCORD_BOT_TOKEN not set');
    return false;
  }

  try {
    const response = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const error = await response.text();
      console.warn('[Discord] API error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[Discord] Send failed:', err);
    return false;
  }
}

/**
 * Send signal alert to Discord
 */
export async function sendSignalAlert(signal: EvaluatedSignal): Promise<boolean> {
  const channelId = channelConfig.alerts || process.env.DISCORD_ALERTS_CHANNEL;
  if (!channelId) return false;

  const meta = SIGNAL_META[signal.type];

  const color = signal.action === 'ALERT' ? 0xFF0000 : // Red
                signal.action === 'WATCH' ? 0xFFFF00 : // Yellow
                0x808080; // Gray

  const embed: DiscordEmbed = {
    title: `${meta.emoji} ${meta.label}`,
    description: signal.marketTitle,
    color,
    fields: [
      { name: 'Action', value: signal.action, inline: true },
      { name: 'Confidence', value: `${signal.confidence}%`, inline: true },
      { name: 'Platform', value: signal.platform, inline: true },
    ],
    footer: { text: 'BeRight Signal Intelligence' },
    timestamp: new Date().toISOString(),
  };

  if (signal.reasoning) {
    embed.fields!.push({ name: 'Reasoning', value: signal.reasoning.slice(0, 200) });
  }

  return sendToChannel(channelId, { embeds: [embed] });
}

/**
 * Send synthesis report to Discord
 */
export async function sendSynthesisReport(report: SynthesisReport): Promise<boolean> {
  const channelId = channelConfig.intel || process.env.DISCORD_INTEL_CHANNEL;
  if (!channelId) return false;

  const sentimentColor = {
    bullish: 0x00FF00,
    bearish: 0xFF0000,
    neutral: 0x808080,
    mixed: 0xFFFF00,
  }[report.overallSentiment];

  const embed: DiscordEmbed = {
    title: '📊 Market Intelligence Report',
    description: `**${report.headline}**\n\n${report.summary}`,
    color: sentimentColor,
    fields: [
      {
        name: 'Sentiment',
        value: `${report.overallSentiment.toUpperCase()} (${(report.sentimentScore * 100).toFixed(0)}%)`,
        inline: true
      },
      {
        name: 'Signals Analyzed',
        value: `${report.signalsProcessed}`,
        inline: true
      },
    ],
    footer: { text: 'BeRight Synthesis Agent' },
    timestamp: new Date().toISOString(),
  };

  // Add themes
  if (report.themes.length > 0) {
    const themesText = report.themes
      .slice(0, 3)
      .map(t => `• **${t.name}**: ${t.narrative.slice(0, 80)}`)
      .join('\n');
    embed.fields!.push({ name: 'Key Themes', value: themesText });
  }

  // Add recommendations
  if (report.recommendations.length > 0) {
    const recsText = report.recommendations
      .slice(0, 3)
      .map(r => `${r.action} ${r.market.slice(0, 30)}`)
      .join('\n');
    embed.fields!.push({ name: 'Recommendations', value: recsText });
  }

  return sendToChannel(channelId, { embeds: [embed] });
}

/**
 * Send arbitrage alert to Discord
 */
export async function sendArbAlert(arb: {
  topic: string;
  platformA: string;
  platformB: string;
  profitPercent: number;
  urlA?: string;
  urlB?: string;
}): Promise<boolean> {
  const channelId = channelConfig.arb || process.env.DISCORD_ARB_CHANNEL;
  if (!channelId) return false;

  const embed: DiscordEmbed = {
    title: '🚨 Arbitrage Opportunity',
    description: arb.topic.slice(0, 200),
    color: 0xFF6600, // Orange
    fields: [
      { name: 'Profit', value: `${arb.profitPercent.toFixed(2)}%`, inline: true },
      { name: 'Platforms', value: `${arb.platformA} ↔ ${arb.platformB}`, inline: true },
    ],
    footer: { text: 'Act fast - opportunities close quickly!' },
    timestamp: new Date().toISOString(),
  };

  if (arb.urlA || arb.urlB) {
    let links = '';
    if (arb.urlA) links += `[${arb.platformA}](${arb.urlA}) `;
    if (arb.urlB) links += `[${arb.platformB}](${arb.urlB})`;
    embed.fields!.push({ name: 'Links', value: links });
  }

  return sendToChannel(channelId, { embeds: [embed] });
}

/**
 * Send general update to Discord
 */
export async function sendDiscordMessage(
  message: string,
  channel: 'alerts' | 'intel' | 'arb' | 'general' = 'general'
): Promise<boolean> {
  const channelId = channelConfig[channel] || process.env[`DISCORD_${channel.toUpperCase()}_CHANNEL`];
  if (!channelId) return false;

  return sendToChannel(channelId, { content: message });
}

/**
 * Check if Discord is configured
 */
export function isDiscordConfigured(): boolean {
  return !!(process.env.DISCORD_BOT_TOKEN && (
    channelConfig.alerts ||
    channelConfig.intel ||
    channelConfig.arb ||
    channelConfig.general ||
    process.env.DISCORD_ALERTS_CHANNEL ||
    process.env.DISCORD_INTEL_CHANNEL
  ));
}
