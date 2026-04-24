/**
 * Web Formatter
 *
 * Reuses the Telegram presentation logic as a baseline, then normalizes
 * the output for the web terminal.
 */

import { FormattedResponse } from '../types';
import { CommandContext, CommandResult, ErrorResult } from '../../orchestrator/types';
import { Formatter, getFormatterRegistry } from './types';
import { TelegramFormatter } from './telegram';

function formatResponseForWeb(text: string): string {
  let formatted = text;

  formatted = formatted.replace(/^```markdown\s*/i, '').replace(/```\s*$/, '');
  formatted = formatted.replace(/^```\s*/gm, '').replace(/```\s*$/gm, '');
  formatted = formatted.replace(/\*([^*]+)\*/g, '**$1**');
  formatted = formatted.replace(/_([^_]+)_/g, '*$1*');
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  return formatted.trim();
}

export class WebFormatter implements Formatter {
  name = 'web' as const;
  private readonly telegramFormatter = new TelegramFormatter();

  format(result: CommandResult, context: CommandContext): FormattedResponse {
    const formatted = this.telegramFormatter.format(result, context);
    return {
      ...formatted,
      text: formatResponseForWeb(formatted.text),
      parseMode: 'plain',
    };
  }

  formatError(error: ErrorResult, context: CommandContext): FormattedResponse {
    const formatted = this.telegramFormatter.formatError(error, context);
    return {
      ...formatted,
      text: formatResponseForWeb(formatted.text),
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
