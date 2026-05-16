/**
 * Auto-Trade Rules for BeRight Protocol
 * Automated betting rules: DCA, stop-loss, take-profit, budget limits
 *
 * Commands:
 * /autobet - View/manage auto-trade rules
 * /limits - Set daily/weekly budget limits
 * /stoploss <position> <percent> - Set stop loss
 * /takeprofit <position> <percent> - Set take profit
 * /dca <market> <amount> <interval> - Dollar cost average
 */

import * as fs from 'fs';
import * as path from 'path';
import { SkillResponse, Platform } from '../types/index';
import { getUserPositions, getPortfolioSummary, Position, closePosition } from './positions';
import { searchMarkets } from './markets';
import { formatUsd, timestamp } from './utils';

const MEMORY_DIR = path.join(process.cwd(), 'memory');
const RULES_FILE = path.join(MEMORY_DIR, 'auto-trade-rules.json');
const LIMITS_FILE = path.join(MEMORY_DIR, 'user-limits.json');
const EXECUTIONS_FILE = path.join(MEMORY_DIR, 'auto-executions.json');

// ============================================
// TYPES
// ============================================

export type RuleType = 'stop_loss' | 'take_profit' | 'dca' | 'copy_trade' | 'rebalance';

export interface AutoTradeRule {
  id: string;
  telegramId: string;
  type: RuleType;
  status: 'active' | 'paused' | 'triggered' | 'expired' | 'deleted';
  createdAt: string;
  lastChecked?: string;
  lastTriggered?: string;
  triggerCount: number;

  // Position-based rules (stop loss, take profit)
  positionId?: string;
  positionMarket?: string;

  // Threshold rules
  threshold?: number;          // Percentage for stop/take
  direction?: 'above' | 'below';

  // DCA rules
  marketQuery?: string;
  marketId?: string;
  dcaAmount?: number;          // USDC per interval
  dcaDirection?: 'YES' | 'NO';
  dcaInterval?: number;        // Minutes between buys
  dcaMaxTotal?: number;        // Max total to invest
  dcaTotalInvested?: number;   // Running total

  // Copy trade rules
  copyFromUserId?: string;
  copyPercentage?: number;     // % of their bet size
  copyMaxPerTrade?: number;

  // Notes
  notes?: string;
}

export interface UserLimits {
  telegramId: string;
  dailyLimit: number;          // Max USDC per day
  weeklyLimit: number;         // Max USDC per week
  maxPositionSize: number;     // Max per single position
  maxOpenPositions: number;    // Max concurrent positions
  dailySpent: number;
  weeklySpent: number;
  lastDailyReset: string;
  lastWeeklyReset: string;
  status: 'active' | 'paused';
}

export interface AutoExecution {
  id: string;
  ruleId: string;
  telegramId: string;
  type: RuleType;
  action: 'BUY' | 'SELL' | 'SKIP';
  market?: string;
  direction?: 'YES' | 'NO';
  amount?: number;
  reason: string;
  timestamp: string;
  executed: boolean;
  txSignature?: string;
}

// ============================================
// STORAGE
// ============================================

function loadRules(): AutoTradeRule[] {
  try {
    if (fs.existsSync(RULES_FILE)) {
      return JSON.parse(fs.readFileSync(RULES_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading auto-trade rules:', error);
  }
  return [];
}

function saveRules(rules: AutoTradeRule[]): void {
  try {
    if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
    fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2));
  } catch (error) {
    console.error('Error saving auto-trade rules:', error);
  }
}

function loadLimits(): Record<string, UserLimits> {
  try {
    if (fs.existsSync(LIMITS_FILE)) {
      return JSON.parse(fs.readFileSync(LIMITS_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading limits:', error);
  }
  return {};
}

function saveLimits(limits: Record<string, UserLimits>): void {
  try {
    if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
    fs.writeFileSync(LIMITS_FILE, JSON.stringify(limits, null, 2));
  } catch (error) {
    console.error('Error saving limits:', error);
  }
}

function loadExecutions(): AutoExecution[] {
  try {
    if (fs.existsSync(EXECUTIONS_FILE)) {
      return JSON.parse(fs.readFileSync(EXECUTIONS_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading executions:', error);
  }
  return [];
}

function saveExecutions(executions: AutoExecution[]): void {
  try {
    fs.writeFileSync(EXECUTIONS_FILE, JSON.stringify(executions, null, 2));
  } catch (error) {
    console.error('Error saving executions:', error);
  }
}

// ============================================
// LIMITS MANAGEMENT
// ============================================

/**
 * Get or create user limits
 */
export function getUserLimits(telegramId: string): UserLimits {
  const allLimits = loadLimits();

  if (!allLimits[telegramId]) {
    allLimits[telegramId] = {
      telegramId,
      dailyLimit: 100,          // Default $100/day
      weeklyLimit: 500,         // Default $500/week
      maxPositionSize: 50,      // Default $50 max per position
      maxOpenPositions: 10,     // Default 10 concurrent
      dailySpent: 0,
      weeklySpent: 0,
      lastDailyReset: new Date().toDateString(),
      lastWeeklyReset: getWeekStart(),
      status: 'active',
    };
    saveLimits(allLimits);
  }

  // Check for resets
  const limits = allLimits[telegramId];
  const today = new Date().toDateString();
  const thisWeek = getWeekStart();

  if (limits.lastDailyReset !== today) {
    limits.dailySpent = 0;
    limits.lastDailyReset = today;
  }

  if (limits.lastWeeklyReset !== thisWeek) {
    limits.weeklySpent = 0;
    limits.lastWeeklyReset = thisWeek;
  }

  saveLimits(allLimits);
  return limits;
}

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(now.setDate(diff)).toDateString();
}

/**
 * Update user limits
 */
export function updateLimits(
  telegramId: string,
  updates: Partial<UserLimits>
): UserLimits {
  const allLimits = loadLimits();
  const current = getUserLimits(telegramId);

  allLimits[telegramId] = { ...current, ...updates };
  saveLimits(allLimits);

  return allLimits[telegramId];
}

/**
 * Check if bet is within limits
 */
export function checkLimits(telegramId: string, amount: number): {
  allowed: boolean;
  reason?: string;
  remaining?: { daily: number; weekly: number; position: number };
} {
  const limits = getUserLimits(telegramId);

  if (limits.status === 'paused') {
    return { allowed: false, reason: 'Limits are paused. /limits resume to continue.' };
  }

  const dailyRemaining = limits.dailyLimit - limits.dailySpent;
  const weeklyRemaining = limits.weeklyLimit - limits.weeklySpent;

  if (amount > limits.maxPositionSize) {
    return {
      allowed: false,
      reason: `Exceeds max position size ($${limits.maxPositionSize})`,
      remaining: { daily: dailyRemaining, weekly: weeklyRemaining, position: limits.maxPositionSize },
    };
  }

  if (amount > dailyRemaining) {
    return {
      allowed: false,
      reason: `Exceeds daily limit. Remaining: $${dailyRemaining.toFixed(2)}`,
      remaining: { daily: dailyRemaining, weekly: weeklyRemaining, position: limits.maxPositionSize },
    };
  }

  if (amount > weeklyRemaining) {
    return {
      allowed: false,
      reason: `Exceeds weekly limit. Remaining: $${weeklyRemaining.toFixed(2)}`,
      remaining: { daily: dailyRemaining, weekly: weeklyRemaining, position: limits.maxPositionSize },
    };
  }

  // Check open positions count
  const positions = getUserPositions(telegramId, 'open');
  if (positions.length >= limits.maxOpenPositions) {
    return {
      allowed: false,
      reason: `Max open positions reached (${limits.maxOpenPositions})`,
      remaining: { daily: dailyRemaining, weekly: weeklyRemaining, position: limits.maxPositionSize },
    };
  }

  return {
    allowed: true,
    remaining: { daily: dailyRemaining, weekly: weeklyRemaining, position: limits.maxPositionSize },
  };
}

/**
 * Record spending against limits
 */
export function recordSpending(telegramId: string, amount: number): void {
  const allLimits = loadLimits();
  const limits = getUserLimits(telegramId);

  limits.dailySpent += amount;
  limits.weeklySpent += amount;

  allLimits[telegramId] = limits;
  saveLimits(allLimits);
}

// ============================================
// RULE MANAGEMENT
// ============================================

/**
 * Create a stop-loss rule
 */
export function createStopLoss(
  telegramId: string,
  positionId: string,
  percentLoss: number
): AutoTradeRule {
  const rules = loadRules();
  const positions = getUserPositions(telegramId, 'open');
  const position = positions.find(p => p.id === positionId);

  if (!position) throw new Error('Position not found');

  const rule: AutoTradeRule = {
    id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    telegramId,
    type: 'stop_loss',
    status: 'active',
    createdAt: timestamp(),
    triggerCount: 0,
    positionId,
    positionMarket: position.marketTitle,
    threshold: percentLoss,
    direction: 'below',
    notes: `Sell if down ${percentLoss}%`,
  };

  rules.push(rule);
  saveRules(rules);

  return rule;
}

/**
 * Create a take-profit rule
 */
export function createTakeProfit(
  telegramId: string,
  positionId: string,
  percentGain: number
): AutoTradeRule {
  const rules = loadRules();
  const positions = getUserPositions(telegramId, 'open');
  const position = positions.find(p => p.id === positionId);

  if (!position) throw new Error('Position not found');

  const rule: AutoTradeRule = {
    id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    telegramId,
    type: 'take_profit',
    status: 'active',
    createdAt: timestamp(),
    triggerCount: 0,
    positionId,
    positionMarket: position.marketTitle,
    threshold: percentGain,
    direction: 'above',
    notes: `Sell if up ${percentGain}%`,
  };

  rules.push(rule);
  saveRules(rules);

  return rule;
}

/**
 * Create a DCA rule
 */
export async function createDCA(
  telegramId: string,
  marketQuery: string,
  direction: 'YES' | 'NO',
  amountPerInterval: number,
  intervalMinutes: number,
  maxTotal?: number
): Promise<AutoTradeRule> {
  const rules = loadRules();

  // Find market
  const markets = await searchMarkets(marketQuery, ['polymarket', 'kalshi', 'manifold']);
  const market = markets[0];

  const rule: AutoTradeRule = {
    id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    telegramId,
    type: 'dca',
    status: 'active',
    createdAt: timestamp(),
    triggerCount: 0,
    marketQuery,
    marketId: market?.marketId ?? undefined,
    dcaAmount: amountPerInterval,
    dcaDirection: direction,
    dcaInterval: intervalMinutes,
    dcaMaxTotal: maxTotal,
    dcaTotalInvested: 0,
    notes: `Buy $${amountPerInterval} ${direction} every ${intervalMinutes}m`,
  };

  rules.push(rule);
  saveRules(rules);

  return rule;
}

/**
 * Get user's active rules
 */
export function getUserRules(telegramId: string): AutoTradeRule[] {
  const rules = loadRules();
  return rules.filter(r => r.telegramId === telegramId && r.status === 'active');
}

/**
 * Delete a rule
 */
export function deleteRule(telegramId: string, ruleId: string): boolean {
  const rules = loadRules();
  const index = rules.findIndex(r => r.id === ruleId && r.telegramId === telegramId);

  if (index === -1) return false;

  rules[index].status = 'deleted';
  saveRules(rules);
  return true;
}

/**
 * Pause/resume a rule
 */
export function toggleRule(telegramId: string, ruleId: string): AutoTradeRule | null {
  const rules = loadRules();
  const rule = rules.find(r => r.id === ruleId && r.telegramId === telegramId);

  if (!rule) return null;

  rule.status = rule.status === 'active' ? 'paused' : 'active';
  saveRules(rules);
  return rule;
}

// ============================================
// RULE EXECUTION ENGINE
// ============================================

/**
 * Check all rules and return actions to execute
 */
export async function checkRules(): Promise<AutoExecution[]> {
  const rules = loadRules();
  const executions: AutoExecution[] = [];

  const activeRules = rules.filter(r => r.status === 'active');

  for (const rule of activeRules) {
    try {
      rule.lastChecked = timestamp();

      switch (rule.type) {
        case 'stop_loss':
        case 'take_profit': {
          const exec = await checkPositionRule(rule);
          if (exec) executions.push(exec);
          break;
        }
        case 'dca': {
          const exec = await checkDCARule(rule);
          if (exec) executions.push(exec);
          break;
        }
      }
    } catch (error) {
      console.error(`Error checking rule ${rule.id}:`, error);
    }
  }

  saveRules(rules);

  // Save executions
  const allExecutions = loadExecutions();
  allExecutions.push(...executions);
  saveExecutions(allExecutions);

  return executions;
}

async function checkPositionRule(rule: AutoTradeRule): Promise<AutoExecution | null> {
  if (!rule.positionId) return null;

  const positions = getUserPositions(rule.telegramId, 'open');
  const position = positions.find(p => p.id === rule.positionId);

  if (!position) {
    // Position closed, mark rule as expired
    rule.status = 'expired';
    return null;
  }

  const pnlPct = position.unrealizedPnlPct;
  let shouldTrigger = false;
  let reason = '';

  if (rule.type === 'stop_loss' && pnlPct <= -(rule.threshold || 0)) {
    shouldTrigger = true;
    reason = `Stop loss triggered: down ${Math.abs(pnlPct).toFixed(1)}%`;
  }

  if (rule.type === 'take_profit' && pnlPct >= (rule.threshold || 0)) {
    shouldTrigger = true;
    reason = `Take profit triggered: up ${pnlPct.toFixed(1)}%`;
  }

  if (!shouldTrigger) return null;

  rule.status = 'triggered';
  rule.lastTriggered = timestamp();
  rule.triggerCount++;

  return {
    id: `exec_${Date.now()}`,
    ruleId: rule.id,
    telegramId: rule.telegramId,
    type: rule.type,
    action: 'SELL',
    market: position.marketTitle,
    direction: position.direction,
    amount: position.shares * position.currentPrice,
    reason,
    timestamp: timestamp(),
    executed: false, // Will be executed by handler
  };
}

async function checkDCARule(rule: AutoTradeRule): Promise<AutoExecution | null> {
  if (!rule.dcaInterval || !rule.dcaAmount) return null;

  // Check if enough time has passed since last trigger
  if (rule.lastTriggered) {
    const elapsed = Date.now() - new Date(rule.lastTriggered).getTime();
    const intervalMs = rule.dcaInterval * 60 * 1000;
    if (elapsed < intervalMs) return null;
  }

  // Check if we've hit max total
  if (rule.dcaMaxTotal && (rule.dcaTotalInvested || 0) >= rule.dcaMaxTotal) {
    rule.status = 'triggered';
    return null;
  }

  // Check limits
  const limitCheck = checkLimits(rule.telegramId, rule.dcaAmount);
  if (!limitCheck.allowed) {
    return {
      id: `exec_${Date.now()}`,
      ruleId: rule.id,
      telegramId: rule.telegramId,
      type: 'dca',
      action: 'SKIP',
      market: rule.marketQuery,
      direction: rule.dcaDirection,
      amount: rule.dcaAmount,
      reason: `Skipped: ${limitCheck.reason}`,
      timestamp: timestamp(),
      executed: false,
    };
  }

  rule.lastTriggered = timestamp();
  rule.triggerCount++;
  rule.dcaTotalInvested = (rule.dcaTotalInvested || 0) + rule.dcaAmount;

  return {
    id: `exec_${Date.now()}`,
    ruleId: rule.id,
    telegramId: rule.telegramId,
    type: 'dca',
    action: 'BUY',
    market: rule.marketQuery,
    direction: rule.dcaDirection,
    amount: rule.dcaAmount,
    reason: `DCA buy #${rule.triggerCount}`,
    timestamp: timestamp(),
    executed: false,
  };
}

/**
 * Get pending executions (not yet processed)
 */
export function getPendingExecutions(telegramId?: string): AutoExecution[] {
  const executions = loadExecutions();
  return executions.filter(e =>
    !e.executed && (!telegramId || e.telegramId === telegramId)
  );
}

/**
 * Mark execution as complete
 */
export function markExecuted(executionId: string, txSignature?: string): void {
  const executions = loadExecutions();
  const exec = executions.find(e => e.id === executionId);
  if (exec) {
    exec.executed = true;
    exec.txSignature = txSignature;
    saveExecutions(executions);
  }
}

// ============================================
// TELEGRAM HANDLERS
// ============================================

/**
 * Handle /limits command
 */
export function handleLimits(text: string, telegramId: string): SkillResponse {
  const args = text.replace(/^\/limits\s*/i, '').trim().toLowerCase();

  // Show limits if no args
  if (!args) {
    const limits = getUserLimits(telegramId);
    const dailyRemaining = limits.dailyLimit - limits.dailySpent;
    const weeklyRemaining = limits.weeklyLimit - limits.weeklySpent;

    return {
      text: `
*BUDGET LIMITS*
${'─'.repeat(35)}

Status: ${limits.status === 'active' ? 'ACTIVE' : 'PAUSED'}

*Daily*
Limit: $${limits.dailyLimit}
Spent: $${limits.dailySpent.toFixed(2)}
Left:  $${dailyRemaining.toFixed(2)}

*Weekly*
Limit: $${limits.weeklyLimit}
Spent: $${limits.weeklySpent.toFixed(2)}
Left:  $${weeklyRemaining.toFixed(2)}

*Per Trade*
Max position: $${limits.maxPositionSize}
Max open:     ${limits.maxOpenPositions} positions

*Commands*
/limits daily 200 - Set daily limit
/limits weekly 1000 - Set weekly limit
/limits max 100 - Set max position
/limits pause - Pause all trading
/limits resume - Resume trading
`,
      mood: limits.status === 'active' ? 'NEUTRAL' : 'ALERT',
    };
  }

  // Parse commands
  if (args === 'pause') {
    updateLimits(telegramId, { status: 'paused' });
    return { text: `Trading PAUSED. /limits resume to continue.`, mood: 'ALERT' };
  }

  if (args === 'resume') {
    updateLimits(telegramId, { status: 'active' });
    return { text: `Trading RESUMED.`, mood: 'BULLISH' };
  }

  const match = args.match(/^(daily|weekly|max|positions)\s+(\d+(?:\.\d+)?)$/);
  if (match) {
    const [, type, valueStr] = match;
    const value = parseFloat(valueStr);

    const updates: Partial<UserLimits> = {};
    if (type === 'daily') updates.dailyLimit = value;
    if (type === 'weekly') updates.weeklyLimit = value;
    if (type === 'max') updates.maxPositionSize = value;
    if (type === 'positions') updates.maxOpenPositions = Math.floor(value);

    updateLimits(telegramId, updates);
    return { text: `Updated ${type} limit to ${value}`, mood: 'NEUTRAL' };
  }

  return {
    text: `Usage: /limits [daily|weekly|max|positions] [amount]`,
    mood: 'EDUCATIONAL',
  };
}

/**
 * Handle /autobet command
 */
export async function handleAutobet(text: string, telegramId: string): Promise<SkillResponse> {
  const args = text.replace(/^\/autobet\s*/i, '').trim();

  // List rules if no args
  if (!args) {
    const rules = getUserRules(telegramId);

    if (rules.length === 0) {
      return {
        text: `
*AUTO-TRADE RULES*
${'─'.repeat(35)}

No active rules.

*Create rules:*
/stoploss <positionId> <percent>
/takeprofit <positionId> <percent>
/dca <market> <YES/NO> <amount> <minutes>

Example:
/stoploss pos_123 20
/takeprofit pos_123 50
/dca bitcoin YES 10 60
`,
        mood: 'NEUTRAL',
      };
    }

    let list = '';
    for (const r of rules) {
      const typeEmoji = r.type === 'stop_loss' ? '' :
                        r.type === 'take_profit' ? '' :
                        r.type === 'dca' ? '' : '';
      list += `
\`${r.id.slice(-8)}\` ${typeEmoji} ${r.type.replace('_', ' ')}
  ${r.notes || r.positionMarket || r.marketQuery}
  Triggers: ${r.triggerCount}
`;
    }

    return {
      text: `
*AUTO-TRADE RULES* (${rules.length})
${'─'.repeat(35)}
${list}

/autobet delete <id> - Remove rule
/autobet pause <id> - Pause rule
`,
      mood: 'NEUTRAL',
      data: rules,
    };
  }

  // Delete rule
  const deleteMatch = args.match(/^delete\s+(\S+)/i);
  if (deleteMatch) {
    const success = deleteRule(telegramId, deleteMatch[1]);
    return {
      text: success ? `Deleted rule ${deleteMatch[1]}` : `Rule not found`,
      mood: 'NEUTRAL',
    };
  }

  // Pause/resume rule
  const pauseMatch = args.match(/^pause\s+(\S+)/i);
  if (pauseMatch) {
    const rule = toggleRule(telegramId, pauseMatch[1]);
    return {
      text: rule ? `Rule ${rule.status}` : `Rule not found`,
      mood: 'NEUTRAL',
    };
  }

  return {
    text: `Usage: /autobet [delete|pause] <ruleId>`,
    mood: 'EDUCATIONAL',
  };
}

/**
 * Handle /stoploss command
 */
export function handleStopLoss(text: string, telegramId: string): SkillResponse {
  const match = text.match(/\/stoploss\s+(\S+)\s+(\d+(?:\.\d+)?)/i);

  if (!match) {
    return {
      text: `Usage: /stoploss <positionId> <percent>\nExample: /stoploss pos_abc123 20`,
      mood: 'EDUCATIONAL',
    };
  }

  const [, positionId, percentStr] = match;
  const percent = parseFloat(percentStr);

  try {
    const rule = createStopLoss(telegramId, positionId, percent);
    return {
      text: `
*STOP LOSS SET*
${'─'.repeat(35)}

Position: ${rule.positionMarket}
Trigger: Sell if down ${percent}%

Rule ID: \`${rule.id}\`

/autobet - View all rules
`,
      mood: 'BULLISH',
      data: rule,
    };
  } catch (error) {
    return {
      text: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /takeprofit command
 */
export function handleTakeProfit(text: string, telegramId: string): SkillResponse {
  const match = text.match(/\/takeprofit\s+(\S+)\s+(\d+(?:\.\d+)?)/i);

  if (!match) {
    return {
      text: `Usage: /takeprofit <positionId> <percent>\nExample: /takeprofit pos_abc123 50`,
      mood: 'EDUCATIONAL',
    };
  }

  const [, positionId, percentStr] = match;
  const percent = parseFloat(percentStr);

  try {
    const rule = createTakeProfit(telegramId, positionId, percent);
    return {
      text: `
*TAKE PROFIT SET*
${'─'.repeat(35)}

Position: ${rule.positionMarket}
Trigger: Sell if up ${percent}%

Rule ID: \`${rule.id}\`

/autobet - View all rules
`,
      mood: 'BULLISH',
      data: rule,
    };
  } catch (error) {
    return {
      text: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /dca command
 */
export async function handleDCA(text: string, telegramId: string): Promise<SkillResponse> {
  // /dca <market> <YES/NO> <amount> <minutes> [max]
  const match = text.match(/\/dca\s+(.+?)\s+(YES|NO)\s+(\d+(?:\.\d+)?)\s+(\d+)(?:\s+(\d+))?/i);

  if (!match) {
    return {
      text: `
*DCA SETUP*
${'─'.repeat(35)}

Usage: /dca <market> <YES/NO> <amount> <minutes> [maxTotal]

Examples:
/dca bitcoin YES 10 60
  Buy $10 YES every 60 minutes

/dca fed rate NO 25 120 500
  Buy $25 NO every 2h, max $500 total

/autobet - View all rules
`,
      mood: 'EDUCATIONAL',
    };
  }

  const [, marketQuery, direction, amountStr, intervalStr, maxStr] = match;
  const amount = parseFloat(amountStr);
  const interval = parseInt(intervalStr);
  const maxTotal = maxStr ? parseFloat(maxStr) : undefined;

  try {
    const rule = await createDCA(
      telegramId,
      marketQuery,
      direction.toUpperCase() as 'YES' | 'NO',
      amount,
      interval,
      maxTotal
    );

    return {
      text: `
*DCA RULE CREATED*
${'─'.repeat(35)}

Market: ${rule.marketQuery}
Direction: ${rule.dcaDirection}
Amount: $${amount} per buy
Interval: Every ${interval} minutes
${maxTotal ? `Max Total: $${maxTotal}` : ''}

Rule ID: \`${rule.id}\`

/autobet - View all rules
`,
      mood: 'BULLISH',
      data: rule,
    };
  } catch (error) {
    return {
      text: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

// ============================================
// CLI
// ============================================

if (process.argv[1]?.endsWith('autoTrade.ts')) {
  const args = process.argv.slice(2);
  const command = args[0];

  (async () => {
    if (command === 'check') {
      console.log('Checking all rules...');
      const executions = await checkRules();
      console.log(`Pending executions: ${executions.length}`);
      for (const e of executions) {
        console.log(`  ${e.type}: ${e.action} ${e.market} (${e.reason})`);
      }
    } else if (command === 'limits') {
      const telegramId = args[1] || 'test_user';
      const limits = getUserLimits(telegramId);
      console.log('Limits:', JSON.stringify(limits, null, 2));
    } else if (command === 'rules') {
      const telegramId = args[1] || 'test_user';
      const rules = getUserRules(telegramId);
      console.log(`Rules for ${telegramId}:`, rules.length);
      for (const r of rules) {
        console.log(`  ${r.id}: ${r.type} - ${r.notes}`);
      }
    } else {
      console.log(`
Usage:
  ts-node autoTrade.ts check                - Check all rules
  ts-node autoTrade.ts limits [telegramId]  - View limits
  ts-node autoTrade.ts rules [telegramId]   - View rules
`);
    }
  })();
}

export default {
  getUserLimits,
  checkLimits,
  createStopLoss,
  createTakeProfit,
  createDCA,
  checkRules,
  handleLimits,
  handleAutobet,
};
