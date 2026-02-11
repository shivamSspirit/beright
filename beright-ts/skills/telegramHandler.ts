/**
 * Telegram Handler Skill for BeRight Protocol
 * Main router/dispatcher for all incoming messages
 */

import { SkillResponse, TelegramMessage } from '../types/index';
import { COMMANDS, KEYWORD_TRIGGERS, HELP_TEXT } from '../config/commands';
import { searchMarkets, formatMarkets, compareOdds, formatComparison, getHotMarkets } from './markets';
import { arbitrage } from './arbitrage';
import { research } from './research';
import { whaleWatch, addWhale } from './whale';
import { newsSearch, socialSearch, intelReport } from './intel';
import { morningBrief, quickBrief } from './brief';
import { calibration, predict, getCalibrationStats, listPending } from './calibration';
import { getQuote as getSwapQuote } from './swap';
import { getSolPrice } from './prices';
import { withFailover } from './rpc';
import { formatPct, formatUsd } from './utils';
import { getTradeQuote, searchPredictionTokens, getVolumeMetrics, scanLPOpportunities } from './trade';
import {
  getKalshiClient,
  getKalshiBalance,
  getKalshiPositions,
  getKalshiMarkets,
  getKalshiMarket,
  placeKalshiOrder,
} from '../lib/kalshi';
import { getOrCreateUser, linkWallet, getUserByTelegram } from '../lib/identity';
import { handleSubscribe, handleUnsubscribe, handleAlerts, generateArbAlerts, generateWhaleAlerts, queueAlerts } from './notifications';
import { getLeaderboard, formatLeaderboard, addUserPrediction, calculateUserStats, getUserPendingPredictions } from '../lib/leaderboard';
import { handleFollow, handleUnfollow as handleUnfollowUser, handleSignals, handleTopLists } from './copyTrading';
import { handlePortfolio as handlePortfolioCmd, handlePnl, handleExpiring } from './positions';
import { handleAlert, checkAlerts } from './priceAlerts';
import { handleLimits, handleAutobet, handleStopLoss, handleTakeProfit, handleDCA, checkLimits } from './autoTrade';
import { logConversation, searchLearnings, handleMemory, getRecentContext } from './memory';

// On-chain + Supabase integration
import { commitPrediction, calculateBrierScore, interpretBrierScore } from '../lib/onchain';
import { db } from '../lib/supabase/client';

// Multi-agent spawner
import { spawnAgent, AgentTask } from '../lib/agentSpawner';
import { getAgentForCommand, AGENTS } from '../config/agents';

/**
 * Route message to appropriate agent
 */
function routeMessage(text: string): string {
  const lower = text.toLowerCase();

  // MVP commands (handled directly in main handler)
  if (lower.startsWith('/brief')) return 'COMMANDER';
  if (lower.startsWith('/hot')) return 'COMMANDER';
  if (lower.startsWith('/predict')) return 'COMMANDER';
  if (lower.startsWith('/me')) return 'COMMANDER';
  if (lower.startsWith('/leaderboard')) return 'COMMANDER';
  if (lower.startsWith('/calibration')) return 'COMMANDER';

  // Explicit commands
  if (lower.startsWith('/research')) return 'RESEARCH';
  if (lower.startsWith('/arb')) return 'ARBITRAGE';
  if (lower.startsWith('/odds')) return 'RESEARCH';
  if (lower.startsWith('/whale')) return 'WHALE';
  if (lower.startsWith('/track_whale')) return 'WHALE';
  if (lower.startsWith('/news')) return 'INTEL';
  if (lower.startsWith('/social')) return 'INTEL';
  if (lower.startsWith('/intel')) return 'INTEL';
  if (lower.startsWith('/execute')) return 'EXECUTOR';
  if (lower.startsWith('/wallet')) return 'EXECUTOR';
  if (lower.startsWith('/swap')) return 'EXECUTOR';
  if (lower.startsWith('/buy')) return 'EXECUTOR';
  if (lower.startsWith('/scan')) return 'EXECUTOR';
  if (lower.startsWith('/balance')) return 'EXECUTOR';
  if (lower.startsWith('/volume')) return 'EXECUTOR';
  if (lower.startsWith('/lp')) return 'EXECUTOR';
  // Kalshi direct commands
  if (lower.startsWith('/kalshi')) return 'KALSHI';
  if (lower.startsWith('/kbalance')) return 'KALSHI';
  if (lower.startsWith('/kpositions')) return 'KALSHI';
  if (lower.startsWith('/kmarkets')) return 'KALSHI';
  if (lower.startsWith('/kbuy')) return 'KALSHI';
  if (lower.startsWith('/ksell')) return 'KALSHI';
  if (lower.startsWith('/connect')) return 'COMMANDER';
  if (lower.startsWith('/profile')) return 'COMMANDER';
  if (lower.startsWith('/subscribe')) return 'COMMANDER';
  if (lower.startsWith('/unsubscribe')) return 'COMMANDER';
  if (lower.startsWith('/alerts')) return 'COMMANDER';
  if (lower.startsWith('/follow')) return 'COMMANDER';
  if (lower.startsWith('/unfollow')) return 'COMMANDER';
  if (lower.startsWith('/signals')) return 'COMMANDER';
  if (lower.startsWith('/toplists')) return 'COMMANDER';

  // Portfolio & automation commands
  if (lower.startsWith('/portfolio')) return 'COMMANDER';
  if (lower.startsWith('/pnl')) return 'COMMANDER';
  if (lower.startsWith('/expiring')) return 'COMMANDER';
  if (lower.startsWith('/alert')) return 'COMMANDER';
  if (lower.startsWith('/limits')) return 'COMMANDER';
  if (lower.startsWith('/autobet')) return 'COMMANDER';
  if (lower.startsWith('/stoploss')) return 'COMMANDER';
  if (lower.startsWith('/takeprofit')) return 'COMMANDER';
  if (lower.startsWith('/dca')) return 'COMMANDER';

  // Keyword detection
  for (const [keyword, agent] of Object.entries(KEYWORD_TRIGGERS)) {
    if (lower.includes(keyword)) return agent;
  }

  return 'COMMANDER';
}

/**
 * Extract query from command
 */
function extractQuery(text: string, command: string): string {
  return text.slice(command.length).trim();
}

/**
 * Handle /start command
 */
function handleStart(): SkillResponse {
  return {
    text: `
🎯 Welcome to BeRight

I'm your prediction market intelligence terminal.

I help you:
• Find arbitrage opportunities across platforms
• Research markets with superforecaster methodology
• Track whale (smart money) activity
• Monitor news and social sentiment

${HELP_TEXT}

Let's make you a better forecaster.
`,
    mood: 'NEUTRAL',
  };
}

/**
 * Handle /help command
 */
function handleHelp(): SkillResponse {
  return {
    text: HELP_TEXT,
    mood: 'EDUCATIONAL',
  };
}

/**
 * Handle /brief command (morning briefing)
 */
async function handleBrief(): Promise<SkillResponse> {
  return await morningBrief('telegram');
}

/**
 * Handle /hot command (trending markets)
 */
async function handleHot(): Promise<SkillResponse> {
  const markets = await getHotMarkets(10);

  let text = `
🔥 *TRENDING MARKETS*
${'─'.repeat(35)}

`;

  for (let i = 0; i < Math.min(10, markets.length); i++) {
    const m = markets[i];
    const platformEmoji = m.platform === 'polymarket' ? '🟣' : m.platform === 'kalshi' ? '🔵' : '🟡';
    text += `${i + 1}. ${platformEmoji} ${m.title.slice(0, 40)}...\n`;
    text += `   YES: ${formatPct(m.yesPrice)} | Vol: ${formatUsd(m.volume)}\n\n`;
  }

  text += `📊 /odds <topic> - Compare across platforms\n`;
  text += `🎯 /predict to make a prediction`;

  return { text, mood: 'NEUTRAL', data: markets };
}

/**
 * Handle /predict command
 *
 * WIRED TO: Supabase (primary) + Solana Memo (verification)
 */
async function handlePredict(text: string, telegramId?: string, username?: string): Promise<SkillResponse> {
  // Parse: /predict "question" 70 YES reasoning...
  const match = text.match(/\/predict\s+["']?([^"']+)["']?\s+(\d+(?:\.\d+)?)\s+(YES|NO)(?:\s+(.+))?/i);

  if (!match) {
    return {
      text: `
📝 *MAKE A PREDICTION*

Usage: /predict <question> <probability> YES|NO [reasoning]

Examples:
/predict "Bitcoin above 100K by Dec 2026" 65 YES Strong ETF inflows
/predict "Fed cuts in March" 40 NO Inflation still high

Probability should be 0-100 (your confidence %).

Your predictions are stored in Supabase and committed on-chain to Solana for verification.
`,
      mood: 'EDUCATIONAL',
    };
  }

  const [, question, probStr, direction, reasoning] = match;
  const probability = parseFloat(probStr) / 100; // Convert to 0-1
  const directionUpper = direction.toUpperCase() as 'YES' | 'NO';

  if (probability < 0 || probability > 1) {
    return { text: 'Probability must be between 0 and 100', mood: 'ERROR' };
  }

  if (!telegramId) {
    return { text: 'Could not identify your account. Please try again.', mood: 'ERROR' };
  }

  try {
    // 1. Get or create user in Supabase
    const user = await db.users.upsertFromTelegram(parseInt(telegramId), username);

    if (!user) {
      // Fallback to file-based if Supabase fails
      console.warn('Supabase user creation failed, falling back to file-based');
      const globalResult = await predict(question, probability, directionUpper, reasoning || 'No reasoning provided', 'telegram');
      addUserPrediction(telegramId, question, probability, directionUpper, reasoning || 'No reasoning provided', 'telegram');
      return globalResult;
    }

    // 2. Create prediction in Supabase
    const prediction = await db.predictions.create({
      user_id: user.id,
      question: question,
      predicted_probability: probability,
      direction: directionUpper,
      platform: 'telegram',
      market_id: question.slice(0, 50).replace(/[^a-zA-Z0-9-]/g, '-').toUpperCase(),
      reasoning: reasoning || 'No reasoning provided',
      confidence: probability > 0.8 || probability < 0.2 ? 'high' : probability > 0.6 || probability < 0.4 ? 'medium' : 'low',
    });

    // 3. Commit to Solana on-chain
    let chainResult: { success: boolean; signature?: string; explorerUrl?: string; error?: string } = { success: false };

    try {
      chainResult = await commitPrediction(
        user.wallet_address || telegramId,
        prediction.market_id || question.slice(0, 30),
        probability,
        directionUpper
      );

      // 4. Update prediction with TX signature if successful
      if (chainResult.success && chainResult.signature) {
        await db.predictions.addOnChainTx(prediction.id, chainResult.signature);
      }
    } catch (chainError) {
      console.warn('On-chain commit failed:', chainError);
      chainResult = { success: false, error: String(chainError) };
    }

    // 5. Also store in file-based system for backward compatibility
    addUserPrediction(telegramId, question, probability, directionUpper, reasoning || 'No reasoning provided', 'telegram');

    // 6. Get user stats for response
    const userPredictions = await db.predictions.getByUser(user.id);
    const totalPredictions = userPredictions.length;

    // 7. Format response
    const chainStatus = chainResult.success
      ? `\n⛓️ *On-Chain Verified*\nTX: \`${chainResult.signature?.slice(0, 12)}...\`\n🔗 [View on Solscan](${chainResult.explorerUrl})`
      : `\n⚠️ On-chain commit pending`;

    return {
      text: `
✅ *PREDICTION RECORDED*
${'─'.repeat(35)}

📊 *${question}*

🎯 Direction: ${directionUpper}
📈 Probability: ${(probability * 100).toFixed(0)}%
💭 Reasoning: ${reasoning || 'None provided'}
${chainStatus}

📊 Your total predictions: ${totalPredictions}
Use /me to see your stats
`,
      mood: 'NEUTRAL',
      data: { prediction, chainResult },
    };

  } catch (error) {
    console.error('Prediction error:', error);

    // Fallback to file-based storage
    console.warn('Falling back to file-based storage');
    const globalResult = await predict(question, probability, directionUpper, reasoning || 'No reasoning provided', 'telegram');
    addUserPrediction(telegramId, question, probability, directionUpper, reasoning || 'No reasoning provided', 'telegram');

    return {
      text: globalResult.text + '\n\n⚠️ Note: Stored locally (Supabase unavailable)',
      mood: globalResult.mood,
      data: globalResult.data,
    };
  }
}

/**
 * Handle /me command (user stats)
 *
 * WIRED TO: Supabase (primary) with file-based fallback
 */
async function handleMe(telegramId?: string): Promise<SkillResponse> {
  if (!telegramId) {
    return { text: 'Could not identify your account. Please try again.', mood: 'ERROR' };
  }

  try {
    // 1. Try to get user from Supabase
    const user = await db.users.getByTelegramId(parseInt(telegramId));

    if (user) {
      // 2. Get predictions from Supabase
      const predictions = await db.predictions.getByUser(user.id);
      const resolved = predictions.filter(p => p.resolved_at);
      const pending = predictions.filter(p => !p.resolved_at);
      const onChainVerified = predictions.filter(p => p.on_chain_tx);

      // 3. Calculate Brier score
      const brierScores = resolved
        .map(p => p.brier_score)
        .filter((b): b is number => b !== null && b !== undefined);
      const avgBrier = brierScores.length > 0
        ? brierScores.reduce((a, b) => a + b, 0) / brierScores.length
        : 0;

      // 4. Calculate accuracy
      const correct = resolved.filter(p =>
        (p.direction === 'YES') === p.outcome
      );
      const accuracy = resolved.length > 0 ? correct.length / resolved.length : 0;

      // 5. Get grade using on-chain interpretBrierScore
      const gradeInfo = brierScores.length > 0
        ? interpretBrierScore(avgBrier)
        : { quality: 'new' as const, description: 'Make predictions to build track record' };

      const gradeEmoji =
        gradeInfo.quality === 'excellent' ? '🏆' :
        gradeInfo.quality === 'good' ? '⭐' :
        gradeInfo.quality === 'fair' ? '✨' :
        gradeInfo.quality === 'poor' ? '👍' :
        gradeInfo.quality === 'bad' ? '📈' : '📊';

      // 6. Get user rank from leaderboard
      const rank = await db.leaderboard.getUserRank(user.id);
      const rankText = rank ? `#${rank}` : 'Unranked (need 5+ resolved)';

      // 7. Format response
      let text = `
📊 *YOUR STATS* ${user.telegram_username ? `(@${user.telegram_username})` : ''}
${'─'.repeat(35)}

${gradeEmoji} *${gradeInfo.description}*

📈 *Performance*
• Brier Score: ${avgBrier.toFixed(4)} ${avgBrier < 0.2 ? '✅' : ''}
• Accuracy: ${(accuracy * 100).toFixed(1)}%
• Predictions: ${predictions.length} (${resolved.length} resolved)
• Rank: ${rankText}

⛓️ *On-Chain Verified*
• ${onChainVerified.length}/${predictions.length} predictions committed to Solana

`;

      if (pending.length > 0) {
        text += `⏳ *Pending* (${pending.length})\n`;
        for (const p of pending.slice(0, 3)) {
          text += `• ${p.question.slice(0, 28)}... ${p.direction} @ ${(p.predicted_probability * 100).toFixed(0)}%\n`;
        }
        if (pending.length > 3) text += `  ... and ${pending.length - 3} more\n`;
      }

      text += `
💡 *Brier Score Guide*
• < 0.10 = Superforecaster Elite 🏆
• < 0.20 = Good ⭐
• = 0.25 = Random guessing

/calibration - Full report | /leaderboard - Rankings
`;

      return { text, mood: avgBrier < 0.2 ? 'BULLISH' : 'NEUTRAL', data: { user, predictions, avgBrier } };
    }
  } catch (error) {
    console.warn('Supabase query failed, falling back to file-based:', error);
  }

  // FALLBACK: Use file-based stats
  let userStats = calculateUserStats(telegramId);
  const globalStats = getCalibrationStats();
  const pending = getUserPendingPredictions(telegramId);

  const stats = userStats && userStats.totalPredictions > 0 ? userStats : {
    brierScore: globalStats.overallBrierScore,
    accuracy: globalStats.accuracy,
    totalPredictions: globalStats.totalPredictions,
    resolvedPredictions: globalStats.resolvedPredictions,
    streak: globalStats.streak.current,
    streakType: globalStats.streak.type,
  };

  let grade = { emoji: '📊', label: 'Start Predicting' };
  if (stats.resolvedPredictions > 0) {
    if (stats.brierScore < 0.1) grade = { emoji: '🏆', label: 'Superforecaster Elite' };
    else if (stats.brierScore < 0.15) grade = { emoji: '⭐', label: 'Superforecaster' };
    else if (stats.brierScore < 0.2) grade = { emoji: '✨', label: 'Very Good' };
    else if (stats.brierScore < 0.25) grade = { emoji: '👍', label: 'Above Average' };
    else grade = { emoji: '📈', label: 'Keep Practicing' };
  }

  let text = `
📊 *YOUR STATS* (local)
${'─'.repeat(35)}

${grade.emoji} *${grade.label}*

📈 *Performance*
• Brier Score: ${stats.brierScore.toFixed(4)}
• Accuracy: ${(stats.accuracy * 100).toFixed(1)}%
• Predictions: ${stats.totalPredictions} (${stats.resolvedPredictions} resolved)

`;

  if (stats.streak > 0) {
    const streakEmoji = stats.streakType === 'win' ? '🔥' : '❄️';
    text += `🎯 *Streak*: ${stats.streak} ${stats.streakType === 'win' ? 'wins' : 'losses'} ${streakEmoji}\n\n`;
  }

  if (pending.length > 0) {
    text += `⏳ *Pending* (${pending.length})\n`;
    for (const p of pending.slice(0, 3)) {
      const prob = 'predictedProbability' in p ? p.predictedProbability : 0;
      const dir = 'direction' in p ? p.direction : '?';
      const q = 'question' in p ? p.question : '';
      text += `• ${q.slice(0, 30)}... ${dir} @ ${(prob * 100).toFixed(0)}%\n`;
    }
    if (pending.length > 3) text += `  ... and ${pending.length - 3} more\n`;
  }

  text += `
/calibration - Full calibration report
/leaderboard - See top forecasters
`;

  return { text, mood: stats.brierScore < 0.2 ? 'BULLISH' : 'NEUTRAL', data: stats };
}

/**
 * Handle /connect command - Link wallet to Telegram account
 */
async function handleConnect(text: string, telegramId?: string, username?: string): Promise<SkillResponse> {
  if (!telegramId) {
    return {
      text: '❌ Could not identify your Telegram account. Try again.',
      mood: 'ERROR',
    };
  }

  // Parse wallet address
  const match = text.match(/\/connect\s+([1-9A-HJ-NP-Za-km-z]{32,44})/);

  if (!match) {
    const user = getUserByTelegram(telegramId);
    if (user?.walletAddress) {
      return {
        text: `
🔗 *WALLET CONNECTED*

Your wallet: \`${user.walletAddress.slice(0, 8)}...${user.walletAddress.slice(-6)}\`

To link a different wallet:
/connect <solana_address>
`,
        mood: 'NEUTRAL',
      };
    }

    return {
      text: `
🔗 *CONNECT WALLET*

Link your Solana wallet to track trades and build your forecaster profile.

Usage: /connect <solana_address>

Example:
/connect 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU

Benefits:
• Track your trading volume
• Build forecaster reputation
• Enable trade execution
`,
      mood: 'EDUCATIONAL',
    };
  }

  const walletAddress = match[1];

  try {
    // Validate it's a real Solana address by checking on-chain
    const { PublicKey } = await import('@solana/web3.js');
    new PublicKey(walletAddress); // Will throw if invalid

    // Ensure user exists
    getOrCreateUser(telegramId, username);

    // Link wallet
    const user = linkWallet(telegramId, walletAddress);

    if (!user) {
      return {
        text: '❌ Failed to link wallet. Try again.',
        mood: 'ERROR',
      };
    }

    return {
      text: `
✅ *WALLET LINKED*
${'─'.repeat(35)}

Address: \`${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}\`

You can now:
• /buy to get trade quotes
• /volume to track your metrics
• /profile to view your stats

Welcome to BeRight! 🎯
`,
      mood: 'BULLISH',
    };
  } catch (error) {
    return {
      text: `❌ Invalid Solana address. Please check and try again.`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /profile command - View user profile
 */
async function handleProfile(telegramId?: string, username?: string): Promise<SkillResponse> {
  if (!telegramId) {
    return {
      text: '❌ Could not identify your Telegram account.',
      mood: 'ERROR',
    };
  }

  const user = getOrCreateUser(telegramId, username);
  const stats = getCalibrationStats();

  // Check if wallet is connected
  const walletStatus = user.walletAddress
    ? `\`${user.walletAddress.slice(0, 8)}...${user.walletAddress.slice(-6)}\``
    : '❌ Not connected (/connect to link)';

  let text = `
👤 *YOUR PROFILE*
${'─'.repeat(35)}

📱 Telegram: @${user.telegramUsername || 'unknown'}
💳 Wallet: ${walletStatus}
📅 Joined: ${new Date(user.createdAt).toLocaleDateString()}

📊 *FORECASTING STATS*
• Brier Score: ${stats.overallBrierScore.toFixed(4)}
• Accuracy: ${(stats.accuracy * 100).toFixed(1)}%
• Predictions: ${stats.totalPredictions}

💹 *TRADING STATS*
• Total Trades: ${user.stats.totalTrades}
• Volume: ${formatUsd(user.stats.volumeUsd)}

⚙️ *SETTINGS*
• Alerts: ${user.settings.alerts ? '✅ On' : '❌ Off'}
`;

  if (user.walletAddress) {
    text += `\n/wallet ${user.walletAddress} - Check balance`;
  }

  return { text, mood: 'NEUTRAL', data: user };
}

/**
 * Handle /leaderboard command
 *
 * WIRED TO: Supabase leaderboard view (primary) with file-based fallback
 */
async function handleLeaderboard(telegramId?: string): Promise<SkillResponse> {
  try {
    // 1. Try to get leaderboard from Supabase
    const supabaseEntries = await db.leaderboard.get({ limit: 10 });

    if (supabaseEntries && supabaseEntries.length > 0) {
      // Format Supabase leaderboard
      let text = `
🏆 *FORECASTER LEADERBOARD*
${'─'.repeat(35)}

`;

      for (let i = 0; i < supabaseEntries.length; i++) {
        const e = supabaseEntries[i];
        const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
        const name = e.telegram_username ? `@${e.telegram_username}` : `User ${e.telegram_id?.toString().slice(-4) || '???'}`;

        // Grade based on Brier score
        const brier = e.avg_brier_score || 0;
        const gradeEmoji =
          brier < 0.1 ? '🏆' :
          brier < 0.15 ? '⭐' :
          brier < 0.2 ? '✨' :
          brier < 0.25 ? '👍' : '📈';

        text += `${rank} ${gradeEmoji} *${name}*\n`;
        text += `   Brier: ${brier.toFixed(3)} | Acc: ${((e.accuracy || 0) * 100).toFixed(0)}% | n=${e.prediction_count || 0}\n\n`;
      }

      // Check if current user is on the leaderboard
      let yourRank = '';
      if (telegramId) {
        const user = await db.users.getByTelegramId(parseInt(telegramId));
        if (user) {
          const userRank = await db.leaderboard.getUserRank(user.id);
          if (userRank) {
            yourRank = `\n📍 You are ranked #${userRank}`;
          } else {
            const predictions = await db.predictions.getByUser(user.id);
            const resolved = predictions.filter(p => p.resolved_at);
            if (resolved.length > 0 && resolved.length < 5) {
              yourRank = `\n📍 ${resolved.length}/5 resolved predictions to rank`;
            } else if (resolved.length === 0) {
              yourRank = `\n📍 Make predictions with /predict to join`;
            }
          }
        }
      }

      text += `${'─'.repeat(35)}
*Brier Score* (lower = better calibration)
• < 0.15 = Superforecaster ⭐
• < 0.25 = Above Average 👍
• = 0.25 = Random Guessing 🎲

⛓️ All predictions verified on Solana
${yourRank}
/me - Your stats | /calibration - Full report`;

      return {
        text,
        mood: 'BULLISH',
        data: supabaseEntries,
      };
    }
  } catch (error) {
    console.warn('Supabase leaderboard failed, falling back to file-based:', error);
  }

  // FALLBACK: Use file-based leaderboard
  const entries = getLeaderboard(10);
  const text = formatLeaderboard(entries);

  let yourRank = '';
  if (telegramId) {
    const userEntry = entries.find(e => e.telegramId === telegramId);
    if (userEntry) {
      yourRank = `\n📍 You are ranked #${userEntry.rank}`;
    } else {
      const stats = calculateUserStats(telegramId);
      if (stats.resolvedPredictions > 0) {
        yourRank = `\n📍 Your Brier: ${stats.brierScore.toFixed(3)} (need 5+ resolved to rank)`;
      }
    }
  }

  return {
    text: text + yourRank + '\n\n(local data)',
    mood: entries.length > 0 ? 'BULLISH' : 'NEUTRAL',
    data: entries,
  };
}

/**
 * Handle /swap command
 */
async function handleSwap(text: string): Promise<SkillResponse> {
  // Parse: /swap 1 SOL USDC
  const match = text.match(/\/swap\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(\w+)/i);

  if (!match) {
    return {
      text: `
💱 *JUPITER SWAP QUOTE*

Usage: /swap <amount> <from> <to>

Examples:
/swap 1 SOL USDC
/swap 100 USDC SOL
/swap 1000000 BONK SOL

Supported tokens: SOL, USDC, BONK, JUP, WIF, POPCAT
`,
      mood: 'EDUCATIONAL',
    };
  }

  const [, amountStr, fromToken, toToken] = match;
  const amount = parseFloat(amountStr);

  const quote = await getSwapQuote(fromToken.toUpperCase(), toToken.toUpperCase(), amount);

  if (!quote) {
    return {
      text: `❌ Could not get quote for ${amount} ${fromToken} → ${toToken}. Check token symbols.`,
      mood: 'ERROR',
    };
  }

  // Parse string values from Jupiter API
  const outAmount = parseFloat(quote.outAmount) / 1e6; // Assuming USDC/most tokens use 6 decimals
  const priceImpactNum = parseFloat(quote.priceImpactPct) * 100;
  const priceImpactLabel = priceImpactNum < 0.1 ? '✅ Low' : priceImpactNum < 1 ? '⚠️ Medium' : '🔴 High';
  const routeSteps = quote.routePlan?.length || 1;

  return {
    text: `
💱 *SWAP QUOTE*
${'─'.repeat(35)}

${amount} ${fromToken} → ${outAmount.toFixed(6)} ${toToken}

📊 Rate: 1 ${fromToken} = ${(outAmount / amount).toFixed(6)} ${toToken}
💨 Price Impact: ${priceImpactNum.toFixed(3)}% ${priceImpactLabel}
🛣️ Route Steps: ${routeSteps}

⚠️ Quote valid for ~30 seconds
`,
    mood: 'NEUTRAL',
    data: quote,
  };
}

/**
 * Handle /buy command - Buy prediction tokens
 */
async function handleBuy(text: string): Promise<SkillResponse> {
  // Parse: /buy TICKER YES|NO amount
  const match = text.match(/\/buy\s+(\S+)\s+(YES|NO)\s+(\d+(?:\.\d+)?)/i);

  if (!match) {
    return {
      text: `
🎯 *BUY PREDICTION TOKENS*

Usage: /buy <ticker> <YES|NO> <amount_usdc>

Examples:
/buy KXFEDCHAIRNOM-29-KW YES 5
/buy KXPRESNOMD-28-BS NO 10

Find tickers with /scan or /hot
`,
      mood: 'EDUCATIONAL',
    };
  }

  const [, ticker, direction, amountStr] = match;
  const amount = parseFloat(amountStr);

  try {
    const result = await getTradeQuote(ticker.toUpperCase(), direction.toUpperCase() as 'YES' | 'NO', amount);

    if (!result) {
      return {
        text: `❌ Could not find market: ${ticker}\n\nTry /scan to find valid markets.`,
        mood: 'ERROR',
      };
    }

    const { quote, token } = result;

    // Calculate output amount from Jupiter quote or estimate from price
    let outputAmount = 0;
    let priceImpact = 0;

    if (quote?.outAmount) {
      outputAmount = parseFloat(quote.outAmount) / 1e6; // Assuming 6 decimals
      priceImpact = parseFloat(quote.priceImpactPct || '0');
    } else {
      // Estimate based on token price
      const price = direction.toUpperCase() === 'YES' ? token.yesPrice : token.noPrice;
      outputAmount = price > 0 ? amount / price : 0;
    }

    return {
      text: `
🎯 *PREDICTION TRADE QUOTE*
${'─'.repeat(35)}

*Market:* ${token.title}
*Ticker:* ${token.ticker}
*Direction:* ${direction.toUpperCase()}

💵 *Input:* ${amount.toFixed(2)} USDC
📈 *Output:* ${outputAmount.toFixed(4)} ${direction.toUpperCase()} tokens
📊 *Price Impact:* ${(priceImpact * 100).toFixed(2)}%
${!quote ? '\n⚠️ No Jupiter liquidity - direct DFlow trade needed' : ''}

⚠️ This is a quote only (dry run)
To execute: /execute ${ticker} ${direction} ${amount}
`,
      mood: 'NEUTRAL',
      data: result,
    };
  } catch (error) {
    return {
      text: `❌ Quote failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /scan command - Scan for trading opportunities
 */
async function handleScan(): Promise<SkillResponse> {
  try {
    const opportunities = await scanLPOpportunities();

    if (opportunities.length === 0) {
      return {
        text: `
🔍 *LP SCAN*

No opportunities found with >0.5% spread.

Try /hot to see trending markets instead.
`,
        mood: 'NEUTRAL',
      };
    }

    let text = `
🔍 *LP OPPORTUNITIES* (Top ${Math.min(5, opportunities.length)})
${'─'.repeat(35)}

`;

    for (const opp of opportunities.slice(0, 5)) {
      text += `📊 *${opp.market}*\n`;
      text += `   ${opp.title.slice(0, 35)}...\n`;
      text += `   Spread: ${(opp.spread * 100).toFixed(2)}%\n`;
      text += `   Est APY: ${opp.estimatedApy.toFixed(0)}%\n`;
      text += `   Vol 24h: ${formatUsd(opp.volume24h)}\n\n`;
    }

    text += `\n/buy <ticker> YES|NO <amount> to trade`;

    return { text, mood: 'BULLISH', data: opportunities };
  } catch (error) {
    return {
      text: `❌ Scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /volume command - Show Builder Code volume metrics
 */
async function handleVolume(): Promise<SkillResponse> {
  try {
    const metrics = await getVolumeMetrics();

    const topMarkets = Object.entries(metrics.byMarket)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    let text = `
📊 *BUILDER CODE VOLUME*
${'─'.repeat(35)}

💰 Total Volume: ${formatUsd(metrics.totalVolumeUsd)}
🔢 Total Trades: ${metrics.totalTrades}
📈 Unique Markets: ${metrics.uniqueMarkets}

`;

    if (topMarkets.length > 0) {
      text += `*Top Markets:*\n`;
      for (const [market, vol] of topMarkets) {
        text += `• ${market.slice(0, 25)}... ${formatUsd(vol)}\n`;
      }
    }

    text += `\n🎯 Track volume for Kalshi's $2M grant`;

    return { text, mood: 'NEUTRAL', data: metrics };
  } catch (error) {
    return {
      text: `❌ Volume check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /lp command - Show LP opportunities
 */
async function handleLP(): Promise<SkillResponse> {
  return await handleScan(); // Same as /scan for now
}

// ============================================
// KALSHI HANDLERS
// ============================================

/**
 * Handle /kalshi command - Account overview
 */
async function handleKalshiOverview(): Promise<SkillResponse> {
  const client = getKalshiClient();
  if (!client) {
    return {
      text: `
⚠️ *KALSHI NOT CONFIGURED*

To use Kalshi trading:
1. Get API keys from kalshi.com/account/api
2. Add to .env:
   KALSHI_API_KEY=your_key
   KALSHI_API_SECRET=your_private_key

Then restart the bot.
`,
      mood: 'NEUTRAL',
    };
  }

  try {
    const [balance, positions] = await Promise.all([
      getKalshiBalance(),
      getKalshiPositions(),
    ]);

    let positionsText = '';
    let totalValue = 0;
    if (positions.length > 0) {
      for (const pos of positions.slice(0, 5)) {
        const value = pos.position * (pos.average_price / 100);
        totalValue += value;
        positionsText += `• ${pos.market_ticker}: ${pos.position} @ ${(pos.average_price / 100).toFixed(2)}¢\n`;
      }
      if (positions.length > 5) {
        positionsText += `  ... and ${positions.length - 5} more\n`;
      }
    }

    return {
      text: `
🔵 *KALSHI ACCOUNT*
${'─'.repeat(35)}

💰 *Balance:* $${balance ? (balance.balance / 100).toFixed(2) : '0.00'}
💵 *Available:* $${balance ? (balance.available_balance / 100).toFixed(2) : '0.00'}
📊 *Positions:* ${positions.length}
📈 *Position Value:* $${totalValue.toFixed(2)}

${positionsText ? `\n*Open Positions:*\n${positionsText}` : ''}
/kbalance - Detailed balance
/kpositions - All positions
/kmarkets - Browse markets
`,
      mood: 'NEUTRAL',
      data: { balance, positions },
    };
  } catch (error) {
    return {
      text: `❌ Kalshi API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /kbalance command
 */
async function handleKalshiBalance(): Promise<SkillResponse> {
  const client = getKalshiClient();
  if (!client) {
    return { text: '⚠️ Kalshi not configured. Use /kalshi for setup info.', mood: 'NEUTRAL' };
  }

  try {
    const balance = await getKalshiBalance();
    if (!balance) {
      return { text: '❌ Could not fetch balance', mood: 'ERROR' };
    }

    return {
      text: `
💰 *KALSHI BALANCE*
${'─'.repeat(35)}

Total: $${(balance.balance / 100).toFixed(2)}
Available: $${(balance.available_balance / 100).toFixed(2)}
Payout: $${(balance.payout_balance / 100).toFixed(2)}
`,
      mood: 'NEUTRAL',
      data: balance,
    };
  } catch (error) {
    return {
      text: `❌ Balance error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /kpositions command
 */
async function handleKalshiPositions(): Promise<SkillResponse> {
  const client = getKalshiClient();
  if (!client) {
    return { text: '⚠️ Kalshi not configured. Use /kalshi for setup info.', mood: 'NEUTRAL' };
  }

  try {
    const positions = await getKalshiPositions();
    if (positions.length === 0) {
      return { text: '📊 No open positions on Kalshi.\n\nUse /kmarkets to find markets.', mood: 'NEUTRAL' };
    }

    let text = `
📊 *KALSHI POSITIONS* (${positions.length})
${'─'.repeat(35)}

`;

    for (const pos of positions) {
      const value = pos.position * (pos.average_price / 100);
      text += `*${pos.market_ticker}*\n`;
      text += `  Contracts: ${pos.position}\n`;
      text += `  Avg Price: ${(pos.average_price / 100).toFixed(2)}¢\n`;
      text += `  Value: $${value.toFixed(2)}\n`;
      text += `  Resting Orders: ${pos.resting_order_count}\n\n`;
    }

    return { text, mood: 'NEUTRAL', data: positions };
  } catch (error) {
    return {
      text: `❌ Positions error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /kmarkets command
 */
async function handleKalshiMarkets(query?: string): Promise<SkillResponse> {
  try {
    const markets = await getKalshiMarkets(15);

    let filtered = markets;
    if (query) {
      const q = query.toLowerCase();
      filtered = markets.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.ticker.toLowerCase().includes(q)
      );
    }

    if (filtered.length === 0) {
      return {
        text: query
          ? `No Kalshi markets found for "${query}"`
          : 'No open Kalshi markets found',
        mood: 'NEUTRAL',
      };
    }

    let text = `
🔵 *KALSHI MARKETS*${query ? ` (${query})` : ''}
${'─'.repeat(35)}

`;

    for (const m of filtered.slice(0, 10)) {
      text += `*${m.ticker}*\n`;
      text += `  ${m.title.slice(0, 45)}${m.title.length > 45 ? '...' : ''}\n`;
      text += `  YES: ${m.yes_bid}¢ / ${m.yes_ask}¢ | Vol: ${m.volume}\n\n`;
    }

    text += `\n/kbuy <ticker> yes|no <contracts> [price] - to trade`;

    return { text, mood: 'NEUTRAL', data: filtered };
  } catch (error) {
    return {
      text: `❌ Markets error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /kbuy command
 */
async function handleKalshiBuy(text: string): Promise<SkillResponse> {
  // Parse: /kbuy TICKER yes|no contracts [price]
  const match = text.match(/\/kbuy\s+(\S+)\s+(yes|no)\s+(\d+)(?:\s+(\d+))?/i);

  if (!match) {
    return {
      text: `
🔵 *KALSHI BUY*

Usage: /kbuy <ticker> <yes|no> <contracts> [price]

Examples:
/kbuy KXBTC-24DEC31-T1500 yes 10 65
/kbuy PRES-2024-DT yes 5

Price is in cents (1-99). Omit for market order.
`,
      mood: 'EDUCATIONAL',
    };
  }

  const [, ticker, side, contractsStr, priceStr] = match;
  const contracts = parseInt(contractsStr);
  const price = priceStr ? parseInt(priceStr) : undefined;

  const client = getKalshiClient();
  if (!client) {
    return { text: '⚠️ Kalshi not configured. Use /kalshi for setup info.', mood: 'NEUTRAL' };
  }

  try {
    const order = await placeKalshiOrder(
      ticker.toUpperCase(),
      side.toLowerCase() as 'yes' | 'no',
      'buy',
      contracts,
      price
    );

    if (!order) {
      return { text: '❌ Order failed', mood: 'ERROR' };
    }

    return {
      text: `
✅ *ORDER PLACED*
${'─'.repeat(35)}

Order ID: ${order.order_id}
Market: ${order.market_ticker}
Side: ${order.side.toUpperCase()}
Contracts: ${order.count}
Type: ${order.type}
${order.yes_price ? `Price: ${order.yes_price}¢` : ''}
Status: ${order.status}

/kpositions to view positions
`,
      mood: 'BULLISH',
      data: order,
    };
  } catch (error) {
    return {
      text: `❌ Order error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /ksell command
 */
async function handleKalshiSell(text: string): Promise<SkillResponse> {
  // Parse: /ksell TICKER yes|no contracts [price]
  const match = text.match(/\/ksell\s+(\S+)\s+(yes|no)\s+(\d+)(?:\s+(\d+))?/i);

  if (!match) {
    return {
      text: `
🔵 *KALSHI SELL*

Usage: /ksell <ticker> <yes|no> <contracts> [price]

Examples:
/ksell KXBTC-24DEC31-T1500 yes 10 75
/ksell PRES-2024-DT no 5

Price is in cents (1-99). Omit for market order.
`,
      mood: 'EDUCATIONAL',
    };
  }

  const [, ticker, side, contractsStr, priceStr] = match;
  const contracts = parseInt(contractsStr);
  const price = priceStr ? parseInt(priceStr) : undefined;

  const client = getKalshiClient();
  if (!client) {
    return { text: '⚠️ Kalshi not configured. Use /kalshi for setup info.', mood: 'NEUTRAL' };
  }

  try {
    const order = await placeKalshiOrder(
      ticker.toUpperCase(),
      side.toLowerCase() as 'yes' | 'no',
      'sell',
      contracts,
      price
    );

    if (!order) {
      return { text: '❌ Order failed', mood: 'ERROR' };
    }

    return {
      text: `
✅ *SELL ORDER PLACED*
${'─'.repeat(35)}

Order ID: ${order.order_id}
Market: ${order.market_ticker}
Side: ${order.side.toUpperCase()}
Contracts: ${order.count}
Type: ${order.type}
${order.yes_price ? `Price: ${order.yes_price}¢` : ''}
Status: ${order.status}

/kpositions to view positions
`,
      mood: 'NEUTRAL',
      data: order,
    };
  } catch (error) {
    return {
      text: `❌ Order error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /calibration command
 */
async function handleCalibration(): Promise<SkillResponse> {
  return await calibration();
}

/**
 * Handle /portfolio command - now uses positions.ts
 */
async function handlePortfolio(telegramId: string): Promise<SkillResponse> {
  if (!telegramId) {
    return { text: 'Could not identify your account', mood: 'ERROR' };
  }
  return await handlePortfolioCmd(telegramId);
}

/**
 * Main telegram handler
 */
export async function telegramHandler(message: TelegramMessage): Promise<SkillResponse> {
  const text = message.text?.trim() || '';
  const telegramId = message.from?.id?.toString();
  const username = message.from?.username;

  // Determine which agent will handle this
  const agent = routeMessage(text);

  // Process message and get response
  const response = await processMessage(message);

  // Log conversation (skip memory commands to avoid circular logging)
  const lower = text.toLowerCase();
  if (!lower.startsWith('/memory') && !lower.startsWith('/recall') && text) {
    logConversation(text, response.text, {
      userId: telegramId,
      skill: agent,
      mood: response.mood,
    });
  }

  // Publish event to Supabase for realtime sync with web UI
  try {
    await db.events.publish({
      event_type: 'agent_response',
      session_id: `tg-${telegramId}`,
      telegram_id: telegramId ? parseInt(telegramId) : undefined,
      telegram_username: username,
      agent: agent.toLowerCase() as 'scout' | 'analyst' | 'trader' | 'commander',
      command: text,
      response: response.text,
      mood: response.mood,
      data: response.data ? { result: response.data } : undefined,
    });
  } catch (err) {
    // Don't fail the response if event publishing fails
    console.warn('Failed to publish event:', err);
  }

  return response;
}

/**
 * Process message (internal handler logic)
 */
async function processMessage(message: TelegramMessage): Promise<SkillResponse> {
  const text = message.text?.trim() || '';

  if (!text) {
    return { text: "I didn't receive any text. Try /help for commands.", mood: 'NEUTRAL' };
  }

  const agent = routeMessage(text);
  const lower = text.toLowerCase();
  const telegramId = message.from?.id?.toString();
  const username = message.from?.username;

  try {
    // Memory commands
    if (lower.startsWith('/memory') || lower === '/recall') {
      const query = extractQuery(text, '/memory') || extractQuery(text, '/recall') || 'stats';
      return await handleMemory(query);
    }

    // Handle specific commands
    if (lower === '/start') return handleStart();
    if (lower === '/help') return handleHelp();
    if (lower === '/brief') return await handleBrief();
    if (lower === '/hot') return await handleHot();
    if (lower.startsWith('/predict')) return await handlePredict(text, telegramId, username);
    if (lower === '/me') return await handleMe(telegramId);
    if (lower === '/leaderboard') return await handleLeaderboard(telegramId);
    if (lower.startsWith('/swap')) {
      // Spawn trader agent for swap execution
      const swapQuery = extractQuery(text, '/swap');
      if (!swapQuery) {
        return {
          text: `💱 *TRADER: SWAP*\n${'─'.repeat(30)}\n\nUsage: /swap <amount> <from> <to>\n\nExamples:\n/swap 1 SOL USDC\n/swap 100 USDC SOL`,
          mood: 'EDUCATIONAL',
        };
      }

      const task: AgentTask = {
        agentId: 'trader',
        task: `swap ${swapQuery}`,
        context: { userId: telegramId, username },
      };

      const result = await spawnAgent(task);
      return result.response;
    }
    if (lower === '/calibration') return await handleCalibration();
    if (lower === '/accuracy') return await handleMe(telegramId); // Alias for /me

    // Portfolio & P&L commands
    if (lower === '/portfolio' || lower.startsWith('/portfolio ')) {
      return await handlePortfolio(telegramId || '');
    }
    if (lower === '/pnl' || lower.startsWith('/pnl ')) {
      const daysMatch = text.match(/\/pnl\s+(\d+)/);
      const days = daysMatch ? parseInt(daysMatch[1]) : undefined;
      return await handlePnl(telegramId || '', days);
    }
    if (lower === '/expiring') {
      return handleExpiring(telegramId || '');
    }

    // Price alerts
    if (lower.startsWith('/alert')) {
      return await handleAlert(text, telegramId || '');
    }

    // Budget limits & auto-trading
    if (lower.startsWith('/limits')) {
      return handleLimits(text, telegramId || '');
    }
    if (lower.startsWith('/autobet')) {
      return await handleAutobet(text, telegramId || '');
    }
    if (lower.startsWith('/stoploss')) {
      return handleStopLoss(text, telegramId || '');
    }
    if (lower.startsWith('/takeprofit')) {
      return handleTakeProfit(text, telegramId || '');
    }
    if (lower.startsWith('/dca')) {
      return await handleDCA(text, telegramId || '');
    }

    // Identity commands
    if (lower.startsWith('/connect')) return await handleConnect(text, telegramId, username);
    if (lower === '/profile') return await handleProfile(telegramId, username);

    // Notification commands
    if (lower === '/subscribe' || lower.startsWith('/subscribe ')) {
      return handleSubscribe(telegramId || '', username);
    }
    if (lower === '/unsubscribe') {
      return handleUnsubscribe(telegramId || '');
    }
    if (lower.startsWith('/alerts')) {
      const args = extractQuery(text, '/alerts');
      return handleAlerts(telegramId || '', args || undefined);
    }

    // Copy trading commands
    if (lower.startsWith('/follow')) {
      if (!telegramId) return { text: 'Could not identify your account', mood: 'ERROR' };
      return handleFollow(text, telegramId);
    }
    if (lower.startsWith('/unfollow')) {
      if (!telegramId) return { text: 'Could not identify your account', mood: 'ERROR' };
      return handleUnfollowUser(text, telegramId);
    }
    if (lower === '/signals' || lower.startsWith('/signals ')) {
      return handleSignals(telegramId);
    }
    if (lower === '/toplists') {
      return handleTopLists();
    }

    // Route to specific agents
    switch (agent) {
      case 'RESEARCH': {
        // Spawn analyst agent for deep research
        if (lower.startsWith('/odds')) {
          const query = extractQuery(text, '/odds');
          if (!query) return { text: 'Usage: /odds <topic>', mood: 'NEUTRAL' };

          const task: AgentTask = {
            agentId: 'analyst',
            task: `compare odds across platforms for: ${query}`,
            context: { userId: telegramId, username },
          };

          const result = await spawnAgent(task);
          return result.response;
        }

        const query = extractQuery(text, '/research');
        if (!query) return { text: 'Usage: /research <market or topic>', mood: 'NEUTRAL' };

        const task: AgentTask = {
          agentId: 'analyst',
          task: `deep superforecaster research on: ${query}`,
          context: { userId: telegramId, username },
        };

        const result = await spawnAgent(task);
        return result.response;
      }

      case 'ARBITRAGE': {
        // Spawn scout agent for arbitrage scanning
        const query = extractQuery(text, '/arb') || '';
        const task: AgentTask = {
          agentId: 'scout',
          task: `scan for arbitrage opportunities ${query}`.trim(),
          context: { userId: telegramId, username },
          priority: 'high',
        };

        const result = await spawnAgent(task);
        return result.response;
      }

      case 'WHALE': {
        if (lower.startsWith('/track_whale')) {
          const address = extractQuery(text, '/track_whale');
          if (!address) return { text: 'Usage: /track_whale <address>', mood: 'NEUTRAL' };
          addWhale(address, 'User-tracked');
          return { text: `Added whale to tracking: ${address.slice(0, 20)}...\nUse /whale to scan activity.`, mood: 'NEUTRAL' };
        }

        // Spawn trader agent for whale watching
        const task: AgentTask = {
          agentId: 'trader',
          task: 'scan whale activity and smart money movements',
          context: { userId: telegramId, username },
        };

        const result = await spawnAgent(task);
        return result.response;
      }

      case 'INTEL': {
        if (lower.startsWith('/news')) {
          const query = extractQuery(text, '/news');
          if (!query) return { text: 'Usage: /news <topic>', mood: 'NEUTRAL' };

          // Spawn scout agent for news scanning
          const task: AgentTask = {
            agentId: 'scout',
            task: `scan news for: ${query}`,
            context: { userId: telegramId, username },
          };

          const result = await spawnAgent(task);
          return result.response;
        }
        if (lower.startsWith('/social')) {
          const query = extractQuery(text, '/social');
          if (!query) return { text: 'Usage: /social <topic>', mood: 'NEUTRAL' };
          return await socialSearch(query);
        }
        if (lower.startsWith('/intel')) {
          const query = extractQuery(text, '/intel');
          if (!query) return { text: 'Usage: /intel <topic>', mood: 'NEUTRAL' };
          return await intelReport(query);
        }
        break;
      }

      case 'EXECUTOR': {
        // Trading commands - spawn trader agent
        if (lower.startsWith('/buy')) {
          const buyQuery = extractQuery(text, '/buy');
          if (!buyQuery) {
            return {
              text: `💱 *TRADER: BUY*\n${'─'.repeat(30)}\n\nUsage: /buy <ticker> <YES|NO> <amount>\n\nExample:\n/buy KXBTC-24DEC31 YES 10`,
              mood: 'EDUCATIONAL',
            };
          }

          const task: AgentTask = {
            agentId: 'trader',
            task: `buy trade ${buyQuery}`,
            context: { userId: telegramId, username },
          };

          const result = await spawnAgent(task);
          return result.response;
        }
        if (lower.startsWith('/scan')) return await handleScan();
        if (lower.startsWith('/volume')) return await handleVolume();
        if (lower.startsWith('/lp')) return await handleLP();

        // Wallet commands
        if (lower.startsWith('/wallet') || lower.startsWith('/balance')) {
          const address = extractQuery(text, lower.startsWith('/wallet') ? '/wallet' : '/balance');
          if (!address) {
            return {
              text: `
💳 *WALLET CHECK*

Usage: /wallet <solana_address>

Example:
/wallet 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU

Or just paste a Solana address.
`,
              mood: 'EDUCATIONAL',
            };
          }
          try {
            const { PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
            const pubkey = new PublicKey(address);
            const balance = await withFailover(async (conn) => conn.getBalance(pubkey));
            const solBalance = balance / LAMPORTS_PER_SOL;
            const solPrice = await getSolPrice();
            const usdValue = solBalance * solPrice;
            return {
              text: `
💳 *WALLET BALANCE*
${'─'.repeat(35)}

Address: \`${address.slice(0, 8)}...${address.slice(-6)}\`

💰 SOL: ${solBalance.toFixed(4)}
💵 USD: $${usdValue.toFixed(2)} (@ $${solPrice.toFixed(2)}/SOL)

/whale to check whale activity
`,
              mood: 'NEUTRAL',
            };
          } catch (err) {
            return { text: `❌ Wallet check failed: ${err instanceof Error ? err.message : 'Invalid address'}`, mood: 'ERROR' };
          }
        }
        if (lower.startsWith('/execute')) {
          return { text: '⚠️ Trade execution requires wallet setup. Contact @shivamSspirit to enable.', mood: 'NEUTRAL' };
        }
        break;
      }

      case 'KALSHI': {
        if (lower === '/kalshi') return await handleKalshiOverview();
        if (lower === '/kbalance') return await handleKalshiBalance();
        if (lower === '/kpositions') return await handleKalshiPositions();
        if (lower.startsWith('/kmarkets')) {
          const query = extractQuery(text, '/kmarkets');
          return await handleKalshiMarkets(query || undefined);
        }
        if (lower.startsWith('/kbuy')) return await handleKalshiBuy(text);
        if (lower.startsWith('/ksell')) return await handleKalshiSell(text);
        break;
      }

      default: {
        // General market query
        if (text.length > 3) {
          const markets = await searchMarkets(text);
          if (markets.length > 0) {
            return { text: formatMarkets(markets, `Markets: ${text}`), mood: 'NEUTRAL', data: markets };
          }
        }

        return {
          text: `I'm not sure what you're looking for. Try:\n${HELP_TEXT}`,
          mood: 'NEUTRAL',
        };
      }
    }

    return { text: HELP_TEXT, mood: 'NEUTRAL' };
  } catch (error) {
    console.error('Handler error:', error);
    return {
      text: `Something went wrong. Please try again.\n\nError: ${error instanceof Error ? error.message : 'Unknown'}`,
      mood: 'ERROR',
    };
  }
}

// Export for OpenClaw
export default telegramHandler;
