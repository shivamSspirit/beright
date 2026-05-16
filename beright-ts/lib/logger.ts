/**
 * Structured Logger for BeRight Protocol
 *
 * Uses pino for production-grade structured logging.
 * All logs are JSON-formatted for easy parsing by log aggregators.
 *
 * Features:
 * - Structured JSON output
 * - Request tracing via requestId
 * - Agent/skill context
 * - Duration tracking
 * - Error serialization
 * - Child loggers for context
 */

import pino from 'pino';

// Log levels
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// Standard log context fields
export interface LogContext {
  requestId?: string;
  userId?: string;
  agent?: 'scout' | 'analyst' | 'trader' | 'commander';
  skill?: string;
  platform?: string;
  marketId?: string;
  duration?: number;
  [key: string]: unknown;
}

// Error context for structured error logging
export interface ErrorContext extends LogContext {
  error: {
    message: string;
    name: string;
    stack?: string;
    code?: string;
  };
}

// Create base logger
const baseLogger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: {
    service: 'beright-protocol',
    version: process.env.npm_package_version || '1.0.0',
    env: process.env.NODE_ENV || 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  // In development, use pretty printing if available
  transport: process.env.NODE_ENV !== 'production' && process.env.LOG_PRETTY === 'true'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

/**
 * Logger class with context support
 */
class Logger {
  private logger: pino.Logger;
  private context: LogContext;

  constructor(logger: pino.Logger, context: LogContext = {}) {
    this.logger = logger;
    this.context = context;
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    return new Logger(
      this.logger.child(context),
      { ...this.context, ...context }
    );
  }

  /**
   * Create a logger for a specific request
   */
  forRequest(requestId: string, userId?: string): Logger {
    return this.child({ requestId, userId });
  }

  /**
   * Create a logger for a specific agent
   */
  forAgent(agent: LogContext['agent'], skill?: string): Logger {
    return this.child({ agent, skill });
  }

  /**
   * Create a logger for a specific skill
   */
  forSkill(skill: string): Logger {
    return this.child({ skill });
  }

  /**
   * Log at trace level
   */
  trace(msg: string, context?: LogContext): void {
    this.logger.trace(context || {}, msg);
  }

  /**
   * Log at debug level
   */
  debug(msg: string, context?: LogContext): void {
    this.logger.debug(context || {}, msg);
  }

  /**
   * Log at info level
   */
  info(msg: string, context?: LogContext): void {
    this.logger.info(context || {}, msg);
  }

  /**
   * Log at warn level
   */
  warn(msg: string, context?: LogContext): void {
    this.logger.warn(context || {}, msg);
  }

  /**
   * Log at error level with proper error serialization
   */
  error(msg: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = this.serializeError(error);
    this.logger.error({ ...context, ...errorContext }, msg);
  }

  /**
   * Log at fatal level
   */
  fatal(msg: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = this.serializeError(error);
    this.logger.fatal({ ...context, ...errorContext }, msg);
  }

  /**
   * Log API request
   */
  logRequest(req: {
    method: string;
    path: string;
    requestId: string;
    userId?: string;
    userAgent?: string;
    ip?: string;
  }): void {
    this.info('API request', {
      requestId: req.requestId,
      userId: req.userId,
      method: req.method,
      path: req.path,
      userAgent: req.userAgent,
      ip: req.ip,
    });
  }

  /**
   * Log API response
   */
  logResponse(res: {
    requestId: string;
    status: number;
    duration: number;
    cached?: boolean;
  }): void {
    const level = res.status >= 500 ? 'error' : res.status >= 400 ? 'warn' : 'info';
    this[level]('API response', {
      requestId: res.requestId,
      status: res.status,
      duration: res.duration,
      cached: res.cached,
    });
  }

  /**
   * Log skill execution
   */
  logSkillExecution(skill: {
    name: string;
    agent?: 'scout' | 'analyst' | 'trader' | 'commander';
    duration: number;
    success: boolean;
    error?: string;
  }): void {
    const level = skill.success ? 'info' : 'error';
    this[level](`Skill execution: ${skill.name}`, {
      skill: skill.name,
      agent: skill.agent,
      duration: skill.duration,
      success: skill.success,
      error: skill.error,
    });
  }

  /**
   * Log market data fetch
   */
  logMarketFetch(fetch: {
    platform: string;
    query?: string;
    resultCount: number;
    duration: number;
    cached: boolean;
  }): void {
    this.debug('Market data fetch', {
      platform: fetch.platform,
      query: fetch.query,
      resultCount: fetch.resultCount,
      duration: fetch.duration,
      cached: fetch.cached,
    });
  }

  /**
   * Log arbitrage detection
   */
  logArbitrage(arb: {
    platformA: string;
    platformB: string;
    spread: number;
    topic: string;
  }): void {
    this.info('Arbitrage detected', {
      platformA: arb.platformA,
      platformB: arb.platformB,
      spread: arb.spread,
      topic: arb.topic,
    });
  }

  /**
   * Log whale activity
   */
  logWhaleActivity(whale: {
    wallet: string;
    action: string;
    amount: number;
    market?: string;
  }): void {
    this.info('Whale activity', {
      wallet: whale.wallet.substring(0, 8) + '...', // Truncate for privacy
      action: whale.action,
      amount: whale.amount,
      market: whale.market,
    });
  }

  /**
   * Log trade execution
   */
  logTrade(trade: {
    market: string;
    direction: 'YES' | 'NO';
    amount: number;
    success: boolean;
    txSignature?: string;
    error?: string;
  }): void {
    const level = trade.success ? 'info' : 'error';
    this[level]('Trade execution', {
      market: trade.market,
      direction: trade.direction,
      amount: trade.amount,
      success: trade.success,
      txSignature: trade.txSignature,
      error: trade.error,
    });
  }

  /**
   * Log rate limit hit
   */
  logRateLimit(limit: {
    identifier: string;
    limitType: string;
    remaining: number;
    reset: number;
  }): void {
    this.warn('Rate limit hit', {
      identifier: limit.identifier,
      limitType: limit.limitType,
      remaining: limit.remaining,
      reset: limit.reset,
    });
  }

  /**
   * Log heartbeat execution
   */
  logHeartbeat(heartbeat: {
    scanType: string;
    duration: number;
    resultsCount: number;
    alertsQueued: number;
  }): void {
    this.debug('Heartbeat scan', {
      scanType: heartbeat.scanType,
      duration: heartbeat.duration,
      resultsCount: heartbeat.resultsCount,
      alertsQueued: heartbeat.alertsQueued,
    });
  }

  /**
   * Serialize error for structured logging
   */
  private serializeError(error: Error | unknown): { error?: ErrorContext['error'] } {
    if (!error) return {};

    if (error instanceof Error) {
      return {
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack,
          code: (error as any).code,
        },
      };
    }

    return {
      error: {
        message: String(error),
        name: 'UnknownError',
      },
    };
  }

  /**
   * Create a timer for duration logging
   */
  startTimer(): () => number {
    const start = Date.now();
    return () => Date.now() - start;
  }
}

// Export singleton logger
export const logger = new Logger(baseLogger);

// Export child loggers for specific contexts
export const agentLogger = {
  scout: logger.forAgent('scout'),
  analyst: logger.forAgent('analyst'),
  trader: logger.forAgent('trader'),
  commander: logger.forAgent('commander'),
};

// Export skill loggers
export function getSkillLogger(skillName: string): Logger {
  return logger.forSkill(skillName);
}

// Export request logger
export function getRequestLogger(requestId: string, userId?: string): Logger {
  return logger.forRequest(requestId, userId);
}

// Convenience exports
export default logger;
