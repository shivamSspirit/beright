/**
 * Trader Skill - Telegram Commands
 *
 * Commands:
 * /trader - Main trading dashboard
 * /paper - Paper trading controls
 * /paptrade - Execute a paper trade
 * /pappositions - View paper positions
 * /performance - View performance metrics
 * /signals - View pending signals
 * /risk - View risk metrics
 * /strategies - View and configure strategies
 */

import { TelegramMessage, SkillResponse } from '../types/index';
import { getTradeExecutionLayer } from '../services/tradeExecutionLayer';
import { getPaperTradingEngine } from '../services/paperTradingEngine';
import { getRiskManager } from '../services/riskManager';
import { getStrategyFramework } from '../services/strategyFramework';

// Re-export TelegramMessage as TelegramContext for compatibility
export type TelegramContext = TelegramMessage & { userId?: string };

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(value: number): string {
  return value >= 0
    ? `$${value.toFixed(2)}`
    : `-$${Math.abs(value).toFixed(2)}`;
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(2)}%`;
}

function formatPnL(pnl: number, pnlPct: number): string {
  const emoji = pnl >= 0 ? '🟢' : '🔴';
  return `${emoji} ${formatCurrency(pnl)} (${formatPercent(pnlPct)})`;
}

// ============================================
// MAIN TRADER COMMAND
// ============================================

export async function handleTrader(ctx: TelegramContext): Promise<string> {
  const userId = ctx.userId || ctx.from?.id?.toString() || 'anonymous';
  const args = ctx.text?.split(' ').slice(1) || [];
  const subCommand = args[0]?.toLowerCase();

  const layer = getTradeExecutionLayer(userId);
  const config = layer.getConfig();

  if (subCommand === 'start') {
    await layer.start();
    return `🤖 *Trader Started*

Mode: \`${config.mode.toUpperCase()}\`
Auto-execute: \`${config.autoExecute ? 'ON' : 'OFF'}\`
Strategies: ${config.enabledStrategies.length} active

The trader will scan for opportunities every ${config.scanIntervalMs / 60000} minutes.

Use \`/trader stop\` to stop.`;
  }

  if (subCommand === 'stop') {
    await layer.stop();
    const stats = layer.getSessionStats();
    return `🛑 *Trader Stopped*

📊 *Session Summary:*
Running time: ${stats.runningTime}
Signals generated: ${stats.signalsGenerated}
Signals executed: ${stats.signalsExecuted}
Win rate: ${(stats.winRate * 100).toFixed(1)}%
Total P&L: ${formatCurrency(stats.totalPnl)}`;
  }

  if (subCommand === 'auto') {
    const enable = args[1]?.toLowerCase() === 'on';
    layer.setAutoExecute(enable);
    return `⚙️ Auto-execute ${enable ? 'ENABLED' : 'DISABLED'}

${enable
      ? 'The trader will now automatically execute trades when signals are generated.'
      : 'The trader will generate signals but wait for manual approval.'}`;
  }

  if (subCommand === 'scan') {
    const result = await layer.runScanCycle();
    const signals = layer.getPendingSignals();

    let response = `🔍 *Scan Complete*

Markets scanned: ${result.marketsScanned}
Signals generated: ${result.signalsGenerated}
Trades executed: ${result.tradesExecuted}`;

    if (signals.length > 0) {
      response += '\n\n📡 *Pending Signals:*\n';
      for (const s of signals.slice(0, 5)) {
        response += `• ${s.strategyType}: ${s.direction} ${s.marketTicker}\n`;
        response += `  Conf: ${s.confidence.toFixed(0)}% | Edge: ${(s.edge * 100).toFixed(1)}%\n`;
      }
    }

    return response;
  }

  // Default: show dashboard
  const portfolio = layer.getPortfolio();
  const stats = layer.getSessionStats();
  const risk = layer.getRiskSummary();

  return `🤖 *BeRight Trader*
═══════════════════════════

📊 *Portfolio*
Balance: ${formatCurrency(portfolio.totalValue)}
Cash: ${formatCurrency(portfolio.cashBalance)}
Positions: ${portfolio.positionCount}

💰 *Performance*
Total P&L: ${formatPnL(portfolio.totalPnl, portfolio.totalPnlPercent)}
Win Rate: ${(portfolio.winRate * 100).toFixed(1)}%
Max Drawdown: ${(portfolio.maxDrawdownPercent * 100).toFixed(1)}%

⚙️ *Status*
Mode: \`${config.mode.toUpperCase()}\`
Auto-execute: \`${config.autoExecute ? 'ON' : 'OFF'}\`
Running: ${stats.signalsGenerated > 0 ? 'Active' : 'Idle'}

⚠️ *Risk*
Portfolio Risk: ${risk.portfolioRisk.toFixed(0)}/100
Circuit Breaker: ${risk.circuitBreakerActive ? '🔴 ACTIVE' : '🟢 OK'}

*Commands:*
\`/trader start\` - Start trading
\`/trader stop\` - Stop trading
\`/trader auto on|off\` - Toggle auto-execute
\`/trader scan\` - Run scan cycle
\`/positions\` - View positions
\`/signals\` - View signals
\`/performance\` - Detailed stats`;
}

// ============================================
// PAPER TRADING COMMAND
// ============================================

export async function handlePaper(ctx: TelegramContext): Promise<string> {
  const userId = ctx.userId || ctx.from?.id?.toString() || 'anonymous';
  const args = ctx.text?.split(' ').slice(1) || [];
  const subCommand = args[0]?.toLowerCase();

  const engine = getPaperTradingEngine(userId);

  if (subCommand === 'start') {
    await engine.start();
    return `📝 *Paper Trading Started*

Initial Balance: ${formatCurrency(engine.getPortfolio().initialBalance)}

This is simulated trading - no real money is at risk.
Use \`/trade\` to place paper trades.`;
  }

  if (subCommand === 'reset') {
    // Stop and create new engine
    engine.stop();
    const newBalance = args[1] ? parseFloat(args[1]) : 1000;
    const newEngine = getPaperTradingEngine(userId, newBalance);
    await newEngine.start();

    return `🔄 *Paper Portfolio Reset*

New balance: ${formatCurrency(newBalance)}
All positions closed.`;
  }

  // Default: show paper portfolio
  const portfolio = engine.getPortfolio();
  const perf = engine.getPerformanceSummary();

  return `📝 *Paper Trading*
═══════════════════════════

💵 *Balance*
Initial: ${formatCurrency(portfolio.initialBalance)}
Current: ${formatCurrency(portfolio.totalValue)}
P&L: ${formatPnL(portfolio.totalPnl, portfolio.totalPnlPercent)}

📈 *Stats*
Total Trades: ${portfolio.totalTrades}
Win Rate: ${(perf.winRate * 100).toFixed(1)}%
Profit Factor: ${perf.profitFactor.toFixed(2)}
Max Drawdown: ${(perf.maxDrawdownPct * 100).toFixed(1)}%

📂 *Positions*
Open: ${portfolio.positionCount}
Unrealized P&L: ${formatCurrency(portfolio.unrealizedPnl)}

*Commands:*
\`/paper start\` - Start paper trading
\`/paper reset [amount]\` - Reset portfolio
\`/trade\` - Place a trade
\`/positions\` - View positions`;
}

// ============================================
// TRADE COMMAND
// ============================================

export async function handleTrade(ctx: TelegramContext): Promise<string> {
  const userId = ctx.userId || ctx.from?.id?.toString() || 'anonymous';
  const args = ctx.text?.split(' ').slice(1) || [];

  if (args.length < 4) {
    return `💱 *Execute Trade*

Usage: \`/trade <direction> <ticker> <quantity> <price>\`

Examples:
\`/trade YES BTCUSD-100K 10 0.45\`
\`/trade NO TRUMP-WIN 5 0.60\`

Parameters:
• direction: YES or NO
• ticker: Market ticker
• quantity: Number of contracts
• price: Entry price (0.01 - 0.99)`;
  }

  const direction = args[0].toUpperCase() as 'YES' | 'NO';
  const ticker = args[1].toUpperCase();
  const quantity = parseFloat(args[2]);
  const price = parseFloat(args[3]);

  // Validate
  if (direction !== 'YES' && direction !== 'NO') {
    return '❌ Direction must be YES or NO';
  }
  if (isNaN(quantity) || quantity <= 0) {
    return '❌ Invalid quantity';
  }
  if (isNaN(price) || price <= 0 || price >= 1) {
    return '❌ Price must be between 0.01 and 0.99';
  }

  const layer = getTradeExecutionLayer(userId);
  const result = await layer.manualTrade({
    platform: 'kalshi',
    marketId: ticker,
    marketTicker: ticker,
    marketTitle: ticker,
    direction,
    quantity,
    price,
  });

  if (result.success && result.trade) {
    const trade = result.trade;
    return `✅ *Trade Executed*

${trade.direction} ${trade.quantity} @ ${formatCurrency(trade.entryPrice)}
Market: \`${trade.marketTicker}\`
Value: ${formatCurrency(trade.entryValueUsd)}

Stop Loss: ${trade.stopLossPrice ? formatCurrency(trade.stopLossPrice) : 'None'}
Take Profit: ${trade.takeProfitPrice ? formatCurrency(trade.takeProfitPrice) : 'None'}

Use \`/positions\` to view.`;
  }

  return `❌ *Trade Failed*

${result.error || 'Unknown error'}

Check your balance and risk limits with \`/risk\`.`;
}

// ============================================
// POSITIONS COMMAND
// ============================================

export async function handlePositions(ctx: TelegramContext): Promise<string> {
  const userId = ctx.userId || ctx.from?.id?.toString() || 'anonymous';

  const layer = getTradeExecutionLayer(userId);
  const positions = layer.getPositions();

  if (positions.length === 0) {
    return `📂 *Positions*

No open positions.

Use \`/trade\` to open a position.`;
  }

  let response = `📂 *Open Positions* (${positions.length})
═══════════════════════════\n\n`;

  for (const pos of positions) {
    const pnlEmoji = pos.unrealizedPnl >= 0 ? '🟢' : '🔴';
    response += `${pnlEmoji} *${pos.marketTicker}*\n`;
    response += `${pos.direction} ${pos.quantity} @ ${formatCurrency(pos.avgEntryPrice)}\n`;
    response += `Current: ${formatCurrency(pos.currentPrice)} | P&L: ${formatPercent(pos.unrealizedPnlPercent)}\n`;
    if (pos.daysToExpiry !== null) {
      response += `Expires: ${pos.daysToExpiry.toFixed(1)} days\n`;
    }
    response += `Risk: ${pos.riskScore}/100\n\n`;
  }

  response += `\n💡 Use \`/close <id>\` to close a position`;

  return response;
}

// ============================================
// CLOSE POSITION COMMAND
// ============================================

export async function handleClose(ctx: TelegramContext): Promise<string> {
  const userId = ctx.userId || ctx.from?.id?.toString() || 'anonymous';
  const args = ctx.text?.split(' ').slice(1) || [];

  if (args.length === 0) {
    const layer = getTradeExecutionLayer(userId);
    const positions = layer.getPositions();

    if (positions.length === 0) {
      return '📂 No positions to close.';
    }

    let response = `🚪 *Close Position*

Usage: \`/close <id or ticker>\`

Open positions:\n`;

    for (const pos of positions) {
      response += `• \`${pos.id.slice(0, 8)}\` - ${pos.marketTicker} (${pos.direction})\n`;
    }

    return response;
  }

  const identifier = args[0];
  const layer = getTradeExecutionLayer(userId);
  const positions = layer.getPositions();

  // Find position by ID or ticker
  const position = positions.find(
    p => p.id.startsWith(identifier) || p.marketTicker.toLowerCase() === identifier.toLowerCase()
  );

  if (!position) {
    return `❌ Position not found: ${identifier}`;
  }

  const result = await layer.closePosition(position.id, 'manual');

  if (result.success) {
    const pnlEmoji = result.pnl >= 0 ? '🟢' : '🔴';
    return `✅ *Position Closed*

${position.marketTicker} (${position.direction})
P&L: ${pnlEmoji} ${formatCurrency(result.pnl)}`;
  }

  return `❌ *Close Failed*

${result.error || 'Unknown error'}`;
}

// ============================================
// SIGNALS COMMAND
// ============================================

export async function handleSignals(ctx: TelegramContext): Promise<string> {
  const userId = ctx.userId || ctx.from?.id?.toString() || 'anonymous';
  const args = ctx.text?.split(' ').slice(1) || [];

  const layer = getTradeExecutionLayer(userId);
  const signals = layer.getPendingSignals();

  if (args[0] === 'execute' && args[1]) {
    const signalId = args[1];
    const signal = signals.find(s => s.id.startsWith(signalId));

    if (!signal) {
      return `❌ Signal not found: ${signalId}`;
    }

    const executed = await layer.executeSignal(signal);
    if (executed) {
      return `✅ Signal executed: ${signal.direction} on ${signal.marketTicker}`;
    }
    return `❌ Signal execution failed`;
  }

  if (signals.length === 0) {
    return `📡 *Signals*

No pending signals.

Signals are generated when the trader finds opportunities.
Use \`/trader scan\` to run a scan.`;
  }

  let response = `📡 *Pending Signals* (${signals.length})
═══════════════════════════\n\n`;

  for (const signal of signals.slice(0, 10)) {
    const urgencyEmoji = {
      immediate: '🚨',
      soon: '⚡',
      optional: '💡',
    }[signal.urgency];

    response += `${urgencyEmoji} *${signal.strategyType.toUpperCase()}*\n`;
    response += `${signal.direction} ${signal.marketTicker}\n`;
    response += `Confidence: ${signal.confidence.toFixed(0)}% | Edge: ${(signal.edge * 100).toFixed(1)}%\n`;
    response += `Size: ${(signal.recommendedSize * 100).toFixed(1)}% of portfolio\n`;
    response += `ID: \`${signal.id.slice(0, 8)}\`\n\n`;
  }

  response += `\n💡 Use \`/signals execute <id>\` to execute`;

  return response;
}

// ============================================
// PERFORMANCE COMMAND
// ============================================

export async function handlePerformance(ctx: TelegramContext): Promise<string> {
  const userId = ctx.userId || ctx.from?.id?.toString() || 'anonymous';

  const layer = getTradeExecutionLayer(userId);
  const portfolio = layer.getPortfolio();
  const stats = layer.getSessionStats();

  const engine = getPaperTradingEngine(userId);
  const perf = engine.getPerformanceSummary();

  return `📈 *Performance Report*
═══════════════════════════

💰 *Returns*
Total Return: ${formatPnL(perf.totalReturn, perf.totalReturnPct)}
Realized P&L: ${formatCurrency(portfolio.realizedPnl)}
Unrealized P&L: ${formatCurrency(portfolio.unrealizedPnl)}

📊 *Trading Stats*
Total Trades: ${perf.tradesCount}
Win Rate: ${(perf.winRate * 100).toFixed(1)}%
Profit Factor: ${perf.profitFactor.toFixed(2)}

📉 *Risk Metrics*
Max Drawdown: ${(perf.maxDrawdownPct * 100).toFixed(1)}%
Sharpe Ratio: ${perf.sharpeRatio?.toFixed(2) || 'N/A'}

💵 *Win/Loss*
Avg Win: ${formatCurrency(perf.avgWin)}
Avg Loss: ${formatCurrency(perf.avgLoss)}
Largest Win: ${formatCurrency(portfolio.largestWin)}
Largest Loss: ${formatCurrency(portfolio.largestLoss)}

⏱️ *Session*
Running: ${stats.runningTime}
Signals: ${stats.signalsGenerated} generated, ${stats.signalsExecuted} executed`;
}

// ============================================
// RISK COMMAND
// ============================================

export async function handleRisk(ctx: TelegramContext): Promise<string> {
  const userId = ctx.userId || ctx.from?.id?.toString() || 'anonymous';

  const layer = getTradeExecutionLayer(userId);
  const risk = layer.getRiskSummary();
  const config = layer.getConfig();

  const riskManager = getRiskManager(userId);
  const riskConfig = riskManager.getConfig();

  const riskLevel = risk.portfolioRisk < 30 ? '🟢 LOW'
    : risk.portfolioRisk < 60 ? '🟡 MODERATE'
      : '🔴 HIGH';

  return `⚠️ *Risk Dashboard*
═══════════════════════════

📊 *Current Risk*
Portfolio Risk: ${risk.portfolioRisk.toFixed(0)}/100 ${riskLevel}
Concentration: ${risk.concentrationRisk.toFixed(0)}/100
Drawdown: ${(risk.drawdownPct * 100).toFixed(1)}%
Daily Loss: ${(risk.dailyLossPct * 100).toFixed(1)}%

🚨 *Circuit Breaker*
Status: ${risk.circuitBreakerActive ? '🔴 TRIGGERED' : '🟢 OK'}

📏 *Limits*
Max Position: ${formatCurrency(riskConfig.maxPositionSizeUsd)} / ${(riskConfig.maxPositionSizePct * 100).toFixed(0)}%
Max Daily Loss: ${formatCurrency(riskConfig.maxDailyLossUsd)} / ${(riskConfig.maxDailyLossPct * 100).toFixed(0)}%
Max Drawdown: ${(riskConfig.maxDrawdownPct * 100).toFixed(0)}%
Max Category: ${(riskConfig.maxCategoryExposurePct * 100).toFixed(0)}%

🛡️ *Defaults*
Stop Loss: ${(riskConfig.defaultStopLossPct * 100).toFixed(0)}%
Take Profit: ${(riskConfig.defaultTakeProfitPct * 100).toFixed(0)}%

${risk.warnings.length > 0 ? `\n⚠️ *Warnings:*\n${risk.warnings.map(w => `• ${w}`).join('\n')}` : ''}`;
}

// ============================================
// STRATEGIES COMMAND
// ============================================

export async function handleStrategies(ctx: TelegramContext): Promise<string> {
  const userId = ctx.userId || ctx.from?.id?.toString() || 'anonymous';
  const args = ctx.text?.split(' ').slice(1) || [];

  const framework = getStrategyFramework();
  const enabled = framework.getEnabledStrategies();

  if (args[0] === 'enable' && args[1]) {
    const strategy = args[1].toLowerCase();
    framework.enableStrategy(strategy as any);
    return `✅ Strategy \`${strategy}\` enabled`;
  }

  if (args[0] === 'disable' && args[1]) {
    const strategy = args[1].toLowerCase();
    framework.disableStrategy(strategy as any);
    return `❌ Strategy \`${strategy}\` disabled`;
  }

  const strategies = [
    { name: 'arbitrage', desc: 'Cross-platform price differences', risk: 'Low' },
    { name: 'information_speed', desc: 'Act on news before markets', risk: 'Medium' },
    { name: 'mean_reversion', desc: 'Bet against extreme moves', risk: 'Medium' },
    { name: 'resolution_timing', desc: 'Time decay near expiry', risk: 'Low' },
    { name: 'consensus_flip', desc: 'Follow smart money reversals', risk: 'High' },
  ];

  let response = `📈 *Trading Strategies*
═══════════════════════════\n\n`;

  for (const s of strategies) {
    const isEnabled = enabled.includes(s.name as any);
    const emoji = isEnabled ? '✅' : '❌';
    response += `${emoji} *${s.name.toUpperCase()}*\n`;
    response += `${s.desc}\n`;
    response += `Risk: ${s.risk}\n\n`;
  }

  response += `\n*Commands:*
\`/strategies enable <name>\`
\`/strategies disable <name>\``;

  return response;
}

// ============================================
// SKILLRESPONSE WRAPPER HANDLERS
// ============================================

function wrapHandler(handler: (ctx: TelegramContext) => Promise<string>): (msg: TelegramMessage) => Promise<SkillResponse> {
  return async (msg: TelegramMessage): Promise<SkillResponse> => {
    const ctx: TelegramContext = { ...msg, userId: msg.from?.id?.toString() };
    const text = await handler(ctx);
    return { text, mood: 'BULLISH' };
  };
}

// Export handlers wrapped to return SkillResponse for telegramHandler integration
export const traderSkillHandlers = {
  '/trader': wrapHandler(handleTrader),
  '/paper': wrapHandler(handlePaper),
  '/paptrade': wrapHandler(handleTrade),
  '/pappositions': wrapHandler(handlePositions),
  '/papclose': wrapHandler(handleClose),
  '/signals': wrapHandler(handleSignals),
  '/perftrader': wrapHandler(handlePerformance),
  '/risktrader': wrapHandler(handleRisk),
  '/strategies': wrapHandler(handleStrategies),
};

// Legacy exports for direct string responses
export const traderHandlers = {
  '/trader': handleTrader,
  '/paper': handlePaper,
  '/trade': handleTrade,
  '/positions': handlePositions,
  '/close': handleClose,
  '/signals': handleSignals,
  '/performance': handlePerformance,
  '/risk': handleRisk,
  '/strategies': handleStrategies,
};

export default traderSkillHandlers;
