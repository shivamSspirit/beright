/**
 * Web Formatter
 *
 * Native web formatting for the canonical BeRight runtime.
 */

import { FormattedResponse } from '../types';
import { CommandContext, CommandResult, ErrorResult } from '../../orchestrator/types';
import { Formatter, getFormatterRegistry } from './types';

function formatResponseForWeb(text: string): string {
  let formatted = text;

  formatted = formatted.replace(/^```markdown\s*/i, '').replace(/```\s*$/, '');
  formatted = formatted.replace(/^```\s*/gm, '').replace(/```\s*$/gm, '');
  formatted = formatted.replace(/\*([^*]+)\*/g, '**$1**');
  formatted = formatted.replace(/_([^_]+)_/g, '*$1*');
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  return formatted.trim();
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function probability(value: unknown): string {
  const parsed = numberValue(value);
  if (parsed === null) return '—';
  const normalized = parsed > 1 ? parsed : parsed * 100;
  return `${normalized.toFixed(normalized < 10 ? 1 : 0)}%`;
}

function money(value: unknown): string {
  const parsed = numberValue(value);
  if (parsed === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: parsed < 1 ? 3 : 2,
  }).format(parsed);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function formatMarkets(markets: unknown[]): string {
  if (markets.length === 0) return 'No matching prediction markets are available right now.';
  const rows = markets.slice(0, 6).map((entry, index) => {
    const market = asRecord(entry) || {};
    const title = String(market.question || market.title || market.ticker || 'Untitled market');
    const yes = probability(market.yesPrice);
    const no = probability(market.noPrice);
    const ticker = market.ticker ? ` · ${String(market.ticker)}` : '';
    return `${index + 1}. **${title}**${ticker}\n   YES ${yes} · NO ${no}`;
  });
  return `Found ${markets.length} prediction market${markets.length === 1 ? '' : 's'}.\n\n${rows.join('\n\n')}`;
}

function formatStructuredData(data: unknown): string {
  if (typeof data === 'string') return data;
  const record = asRecord(data);
  if (!record) return data === undefined ? 'Request completed.' : JSON.stringify(data, null, 2);
  if (typeof record.text === 'string') return record.text;
  if (Array.isArray(record.markets)) return formatMarkets(record.markets);

  if (typeof record.marketTitle === 'string' && typeof record.side === 'string') {
    const quotes = asRecord(record.quotes);
    const recommended = String(record.recommended || 'best available route');
    const recommendedQuote = quotes ? asRecord(quotes[recommended]) : null;
    const effectivePrice = recommendedQuote?.effectivePrice;
    return [
      `**${record.marketTitle}**`,
      `${record.side} · ${money(record.amountUsd)}`,
      `Best route: ${recommended}`,
      effectivePrice === undefined ? null : `Estimated price: ${probability(effectivePrice)}`,
      typeof record.reason === 'string' ? record.reason : null,
      'Review current liquidity and price impact before signing.',
    ].filter(Boolean).join('\n');
  }

  const synthesis = asRecord(record.synthesis);
  if (synthesis) {
    const narrative = synthesis.narrative || synthesis.summary || synthesis.answer;
    if (typeof narrative === 'string') return narrative;
  }

  return JSON.stringify(data, null, 2);
}

export class WebFormatter implements Formatter {
  name = 'web' as const;

  format(result: CommandResult, context: CommandContext): FormattedResponse {
    if (!result.success && result.error) {
      return this.formatError(result.error, context);
    }

    const text = formatStructuredData(result.data);

    return {
      text: formatResponseForWeb(text),
      parseMode: 'plain',
      buttons: result.hints?.suggestedActions?.map((action) => ({
        label: action,
        type: action.startsWith('/') ? 'command' as const : 'callback' as const,
        value: action,
      })),
    };
  }

  formatError(error: ErrorResult, _context: CommandContext): FormattedResponse {
    return {
      text: formatResponseForWeb(error.message),
      parseMode: 'plain',
    };
  }
}

getFormatterRegistry().register(new WebFormatter());

let webFormatterInstance: WebFormatter | null = null;

export function getWebFormatter(): WebFormatter {
  if (!webFormatterInstance) {
    webFormatterInstance = new WebFormatter();
  }
  return webFormatterInstance;
}
