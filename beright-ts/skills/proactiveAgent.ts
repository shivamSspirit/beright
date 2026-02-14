/**
 * Proactive Agent - 24/7 Autonomous Market Intelligence
 *
 * This is your personal AI analyst watching prediction markets around the clock.
 * It proactively finds and pushes actionable intelligence to you.
 *
 * ALERT TYPES:
 * 1. CLOSING SOON - Markets about to close (act now or miss out)
 * 2. BIG MOVERS - Significant price swings (something's happening)
 * 3. HOT ALPHA - High-volume opportunities with edge
 * 4. SPREAD ALERT - Market inefficiencies to exploit
 * 5. NEW MARKETS - Fresh opportunities just listed
 * 6. WHALE SIGNAL - Smart money is moving
 * 7. MORNING BRIEF - Daily summary of markets and opportunities
 */

import * as fs from 'fs';
import * as path from 'path';
import { SkillResponse } from '../types/index';
import { Market } from '../types/market';
import { searchMarkets, getHotMarkets } from './markets';
import { formatPct, formatUsd, timestamp } from './utils';
import { sendTelegramMessage } from '../services/notificationDelivery';
import { generateMorningBrief, formatBriefTelegram } from './brief';

const MEMORY_DIR = path.join(process.cwd(), 'memory');
const AGENT_STATE_FILE = path.join(MEMORY_DIR, 'proactive-agent.json');
const SUBSCRIBERS_FILE = path.join(MEMORY_DIR, 'agent-subscribers.json');

// ============================================
// TYPES
// ============================================

interface AgentState {
  lastScan: string;
  lastAlertsSent: Record<string, string>; // marketId -> timestamp (prevent duplicates)
  alertsSentToday: number;
  marketsTracked: string[];
  priceSnapshots: Record<string, { price: number; timestamp: string }[]>;
  knownMarkets: string[]; // For new market detection
  lastBriefSent: Record<string, string>; // telegramId -> date string (YYYY-MM-DD)
}

interface AgentSubscriber {
  telegramId: string;
  username?: string;
  subscribedAt: string;
  settings: {
    closingSoon: boolean;      // Markets closing in 1hr
    bigMovers: boolean;        // >10% price swings
    hotAlpha: boolean;         // High volume opportunities
    spreadAlerts: boolean;     // Market inefficiencies
    newMarkets: boolean;       // Newly listed markets
    whaleSignals: boolean;     // Smart money moves
    morningBrief: boolean;     // Daily morning brief
    briefHour: number;         // Hour to send brief (0-23, default 8 = 8 AM)
    timezone: string;          // User timezone (default 'UTC')
    quietHours?: { start: number; end: number }; // e.g., {start: 23, end: 7}
  };
  alertsReceived: number;
}

interface ProactiveAlert {
  type: 'CLOSING_SOON' | 'BIG_MOVER' | 'HOT_ALPHA' | 'SPREAD_ALERT' | 'NEW_MARKET' | 'WHALE_SIGNAL';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  market: string;
  marketId?: string;
  message: string;
  actionable: string;
  data?: any;
}

// ============================================
// STATE MANAGEMENT
// ============================================

function loadState(): AgentState {
  try {
    if (fs.existsSync(AGENT_STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(AGENT_STATE_FILE, 'utf-8'));
      return {
        lastScan: data.lastScan || new Date().toISOString(),
        lastAlertsSent: data.lastAlertsSent || {},
        alertsSentToday: data.alertsSentToday || 0,
        marketsTracked: data.marketsTracked || [],
        priceSnapshots: data.priceSnapshots || {},
        knownMarkets: data.knownMarkets || [],
        lastBriefSent: data.lastBriefSent || {},
      };
    }
  } catch (e) {
    console.error('Error loading agent state:', e);
  }
  return {
    lastScan: new Date().toISOString(),
    lastAlertsSent: {},
    alertsSentToday: 0,
    marketsTracked: [],
    priceSnapshots: {},
    knownMarkets: [],
    lastBriefSent: {},
  };
}

function saveState(state: AgentState): void {
  try {
    if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
    fs.writeFileSync(AGENT_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Error saving agent state:', e);
  }
}

function loadSubscribers(): Record<string, AgentSubscriber> {
  try {
    if (fs.existsSync(SUBSCRIBERS_FILE)) {
      return JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Error loading subscribers:', e);
  }
  return {};
}

function saveSubscribers(subs: Record<string, AgentSubscriber>): void {
  try {
    if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subs, null, 2));
  } catch (e) {
    console.error('Error saving subscribers:', e);
  }
}

// ============================================
// SUBSCRIBER MANAGEMENT
// ============================================

export function subscribeToAgent(telegramId: string, username?: string): SkillResponse {
  const subs = loadSubscribers();

  if (subs[telegramId]) {
    return {
      text: `
*YOU'RE ALREADY SUBSCRIBED*

Your 24/7 AI agent is watching markets for you.

Current settings:
${formatSubscriberSettings(subs[telegramId])}

Use /agent settings to customize alerts.
`,
      mood: 'NEUTRAL',
    };
  }

  subs[telegramId] = {
    telegramId,
    username,
    subscribedAt: new Date().toISOString(),
    settings: {
      closingSoon: true,
      bigMovers: true,
      hotAlpha: true,
      spreadAlerts: true,
      newMarkets: true,
      whaleSignals: true,
      morningBrief: true,
      briefHour: 8, // 8 AM default
      timezone: 'UTC',
    },
    alertsReceived: 0,
  };
  saveSubscribers(subs);

  return {
    text: `
*24/7 AI AGENT ACTIVATED*
${'─'.repeat(30)}

Your personal prediction market analyst is now watching:

*ENABLED ALERTS:*
⏰ *CLOSING SOON* - Markets about to close
📈 *BIG MOVERS* - Price swings >10%
🔥 *HOT ALPHA* - High volume opportunities
💰 *SPREAD ALERTS* - Market inefficiencies
🆕 *NEW MARKETS* - Fresh opportunities
🐋 *WHALE SIGNALS* - Smart money moves
🌅 *MORNING BRIEF* - Daily summary at 8 AM UTC

I'll proactively send you actionable intelligence.

_Use /agent off to pause or /agent settings to customize_
`,
    mood: 'BULLISH',
  };
}

export function unsubscribeFromAgent(telegramId: string): SkillResponse {
  const subs = loadSubscribers();

  if (!subs[telegramId]) {
    return {
      text: `You're not subscribed to the AI agent. Use /agent to activate.`,
      mood: 'NEUTRAL',
    };
  }

  delete subs[telegramId];
  saveSubscribers(subs);

  return {
    text: `
*AI AGENT PAUSED*

Your 24/7 market analyst has been deactivated.
You won't receive proactive alerts until you resubscribe.

Use /agent to reactivate anytime.
`,
    mood: 'NEUTRAL',
  };
}

function formatSubscriberSettings(sub: AgentSubscriber): string {
  const s = sub.settings;
  const briefTime = s.briefHour !== undefined ? `${s.briefHour}:00 ${s.timezone || 'UTC'}` : '8:00 UTC';
  return `
 ${s.closingSoon ? '✅' : '❌'} Closing Soon
 ${s.bigMovers ? '✅' : '❌'} Big Movers
 ${s.hotAlpha ? '✅' : '❌'} Hot Alpha
 ${s.spreadAlerts ? '✅' : '❌'} Spread Alerts
 ${s.newMarkets ? '✅' : '❌'} New Markets
 ${s.whaleSignals ? '✅' : '❌'} Whale Signals
 ${s.morningBrief ? '✅' : '❌'} Morning Brief (${briefTime})
`.trim();
}

export function getAgentStatus(telegramId: string): SkillResponse {
  const subs = loadSubscribers();
  const state = loadState();
  const sub = subs[telegramId];

  if (!sub) {
    return {
      text: `
*AI AGENT STATUS*
${'─'.repeat(30)}

Status: *NOT SUBSCRIBED*

Use /agent to activate your 24/7 market analyst.
`,
      mood: 'NEUTRAL',
    };
  }

  return {
    text: `
*AI AGENT STATUS*
${'─'.repeat(30)}

Status: *ACTIVE*
Since: ${new Date(sub.subscribedAt).toLocaleDateString()}
Alerts received: ${sub.alertsReceived}
Last scan: ${new Date(state.lastScan).toLocaleTimeString()}
Markets tracked: ${state.marketsTracked.length}

*YOUR SETTINGS:*
${formatSubscriberSettings(sub)}

_/agent off to pause | /agent settings to customize_
`,
    mood: 'BULLISH',
  };
}

export function updateAgentSettings(telegramId: string, setting: string, value: boolean | number | string): SkillResponse {
  const subs = loadSubscribers();
  const sub = subs[telegramId];

  if (!sub) {
    return {
      text: `You're not subscribed. Use /agent first.`,
      mood: 'NEUTRAL',
    };
  }

  const settingMap: Record<string, keyof AgentSubscriber['settings']> = {
    'closing': 'closingSoon',
    'movers': 'bigMovers',
    'alpha': 'hotAlpha',
    'spread': 'spreadAlerts',
    'new': 'newMarkets',
    'whale': 'whaleSignals',
    'brief': 'morningBrief',
  };

  const key = settingMap[setting.toLowerCase()];
  if (key && key in sub.settings) {
    (sub.settings as any)[key] = value;
    saveSubscribers(subs);
    return {
      text: `✅ *${setting.toUpperCase()}* alerts ${value ? 'enabled' : 'disabled'}`,
      mood: 'NEUTRAL',
    };
  }

  return {
    text: `
*AVAILABLE SETTINGS:*
• closing - Markets closing soon
• movers - Big price movements
• alpha - Hot opportunities
• spread - Market inefficiencies
• new - New markets
• whale - Smart money signals
• brief - Morning brief

Usage: /agent enable closing or /agent disable movers
`,
    mood: 'NEUTRAL',
  };
}

// ============================================
// ALERT DETECTION LOGIC
// ============================================

async function detectClosingSoon(markets: Market[], state: AgentState): Promise<ProactiveAlert[]> {
  const alerts: ProactiveAlert[] = [];
  const now = Date.now();

  for (const market of markets) {
    if (!market.endDate) continue;

    const closeTime = new Date(market.endDate).getTime();
    const hoursUntilClose = (closeTime - now) / (1000 * 60 * 60);

    // Skip if already alerted for this market today
    const alertKey = `closing_${market.marketId}`;
    if (state.lastAlertsSent[alertKey]) {
      const lastAlert = new Date(state.lastAlertsSent[alertKey]).getTime();
      if (now - lastAlert < 12 * 60 * 60 * 1000) continue; // 12hr cooldown
    }

    if (hoursUntilClose > 0 && hoursUntilClose <= 1) {
      alerts.push({
        type: 'CLOSING_SOON',
        priority: 'HIGH',
        title: '⏰ CLOSING IN <1 HOUR',
        market: market.title,
        marketId: market.marketId || undefined,
        message: `Market closes in ${Math.round(hoursUntilClose * 60)} minutes!`,
        actionable: `Current: ${formatPct(market.yesPrice)} YES`,
        data: { hoursUntilClose, probability: market.yesPrice },
      });
      state.lastAlertsSent[alertKey] = new Date().toISOString();
    } else if (hoursUntilClose > 1 && hoursUntilClose <= 6) {
      alerts.push({
        type: 'CLOSING_SOON',
        priority: 'MEDIUM',
        title: '⏰ CLOSING TODAY',
        market: market.title,
        marketId: market.marketId || undefined,
        message: `Market closes in ${Math.round(hoursUntilClose)} hours`,
        actionable: `Current: ${formatPct(market.yesPrice)} YES`,
        data: { hoursUntilClose, probability: market.yesPrice },
      });
      state.lastAlertsSent[alertKey] = new Date().toISOString();
    }
  }

  return alerts;
}

async function detectBigMovers(markets: Market[], state: AgentState): Promise<ProactiveAlert[]> {
  const alerts: ProactiveAlert[] = [];
  const now = new Date().toISOString();

  for (const market of markets) {
    if (!market.marketId || !market.yesPrice) continue;

    // Get or initialize price history
    if (!state.priceSnapshots[market.marketId]) {
      state.priceSnapshots[market.marketId] = [];
    }

    const history = state.priceSnapshots[market.marketId];
    const currentPrice = market.yesPrice;

    // Add current snapshot
    history.push({ price: currentPrice, timestamp: now });

    // Keep only last 24 hours of data (288 snapshots at 5-min intervals)
    if (history.length > 288) {
      state.priceSnapshots[market.marketId] = history.slice(-288);
    }

    // Need at least 2 hours of data
    if (history.length < 24) continue;

    // Calculate 1-hour and 6-hour changes
    const oneHourAgo = history[Math.max(0, history.length - 12)];
    const sixHoursAgo = history[Math.max(0, history.length - 72)];

    const change1h = oneHourAgo ? Math.abs(currentPrice - oneHourAgo.price) * 100 : 0;
    const change6h = sixHoursAgo ? Math.abs(currentPrice - sixHoursAgo.price) * 100 : 0;

    const alertKey = `mover_${market.marketId}`;
    const lastAlert = state.lastAlertsSent[alertKey];
    const cooldown = lastAlert ? Date.now() - new Date(lastAlert).getTime() > 2 * 60 * 60 * 1000 : true;

    if (change1h >= 10 && cooldown) {
      const direction = currentPrice > oneHourAgo.price ? '📈' : '📉';
      alerts.push({
        type: 'BIG_MOVER',
        priority: 'HIGH',
        title: `${direction} BIG MOVE: ${change1h.toFixed(0)}% in 1hr`,
        market: market.title,
        marketId: market.marketId || undefined,
        message: `Price moved from ${formatPct(oneHourAgo.price)} to ${formatPct(currentPrice)}`,
        actionable: currentPrice > oneHourAgo.price ? 'Momentum is BULLISH' : 'Momentum is BEARISH',
        data: { change1h, change6h, currentPrice },
      });
      state.lastAlertsSent[alertKey] = now;
    } else if (change6h >= 15 && cooldown) {
      const direction = currentPrice > sixHoursAgo.price ? '📈' : '📉';
      alerts.push({
        type: 'BIG_MOVER',
        priority: 'MEDIUM',
        title: `${direction} TRENDING: ${change6h.toFixed(0)}% in 6hrs`,
        market: market.title,
        marketId: market.marketId || undefined,
        message: `Steady movement from ${formatPct(sixHoursAgo.price)} to ${formatPct(currentPrice)}`,
        actionable: 'Sustained trend - may continue',
        data: { change1h, change6h, currentPrice },
      });
      state.lastAlertsSent[alertKey] = now;
    }
  }

  return alerts;
}

async function detectHotAlpha(markets: Market[]): Promise<ProactiveAlert[]> {
  const alerts: ProactiveAlert[] = [];
  const now = Date.now();

  // 1. HIGH VOLUME + UNCERTAIN OUTCOME (hot contested markets)
  const hotMarkets = markets
    .filter(m => m.volume && m.volume > 50000)
    .sort((a, b) => (b.volume || 0) - (a.volume || 0))
    .slice(0, 10);

  for (const market of hotMarkets) {
    const uncertainty = Math.abs(0.5 - (market.yesPrice || 0.5));

    if (uncertainty < 0.15) {
      alerts.push({
        type: 'HOT_ALPHA',
        priority: 'MEDIUM',
        title: '🔥 HOT CONTESTED MARKET',
        market: market.title,
        marketId: market.marketId || undefined,
        message: `High volume (${formatUsd(market.volume || 0)}) with uncertain outcome`,
        actionable: `Currently ${formatPct(market.yesPrice)} YES - market is undecided`,
        data: { volume: market.volume, probability: market.yesPrice, type: 'contested' },
      });
    }
  }

  // 2. EARLY ENTRY OPPORTUNITIES (new markets with low competition)
  // Look for markets created recently (< 48h) with low volume but interesting probability
  const earlyEntryMarkets = markets.filter(m => {
    if (!m.createdAt) return false;
    const ageHours = (now - new Date(m.createdAt).getTime()) / (1000 * 60 * 60);
    const isNew = ageHours <= 48;
    const isLowVolume = (m.volume || 0) < 50000;
    const hasInterestingOdds = m.yesPrice >= 0.1 && m.yesPrice <= 0.9; // Not too extreme
    return isNew && isLowVolume && hasInterestingOdds;
  });

  for (const market of earlyEntryMarkets.slice(0, 3)) {
    const ageHours = Math.round((now - new Date(market.createdAt!).getTime()) / (1000 * 60 * 60));

    alerts.push({
      type: 'HOT_ALPHA',
      priority: 'MEDIUM',
      title: '🚀 EARLY ENTRY OPPORTUNITY',
      market: market.title,
      marketId: market.marketId || undefined,
      message: `New market (${ageHours}h old) with low volume (${formatUsd(market.volume || 0)})`,
      actionable: `Get in at ${formatPct(market.yesPrice)} before the crowd!`,
      data: { volume: market.volume, probability: market.yesPrice, ageHours, type: 'early_entry' },
    });
  }

  // 3. EXTREME ODDS SHIFT POTENTIAL (markets near resolution with strong odds)
  const extremeMarkets = markets.filter(m => {
    if (!m.endDate) return false;
    const hoursUntilClose = (new Date(m.endDate).getTime() - now) / (1000 * 60 * 60);
    const isClosingSoon = hoursUntilClose > 0 && hoursUntilClose <= 72; // Within 3 days
    const hasExtremeOdds = m.yesPrice <= 0.15 || m.yesPrice >= 0.85;
    return isClosingSoon && hasExtremeOdds;
  });

  for (const market of extremeMarkets.slice(0, 2)) {
    const direction = market.yesPrice >= 0.85 ? 'YES' : 'NO';
    const odds = market.yesPrice >= 0.85 ? market.yesPrice : (1 - market.yesPrice);

    alerts.push({
      type: 'HOT_ALPHA',
      priority: 'LOW',
      title: '🎲 HIGH CONVICTION MARKET',
      market: market.title,
      marketId: market.marketId || undefined,
      message: `Market heavily favors ${direction} at ${formatPct(odds)}`,
      actionable: `Closing soon - contrarian bet could 10x if wrong!`,
      data: { probability: market.yesPrice, direction, type: 'extreme_odds' },
    });
  }

  return alerts;
}

async function detectSpreadInefficiency(markets: Market[]): Promise<ProactiveAlert[]> {
  const alerts: ProactiveAlert[] = [];

  // 1. Detect wide orderbook spreads (good for market making or waiting for better price)
  for (const market of markets) {
    if (market.orderbook && market.orderbook.spread > 0) {
      const spread = market.orderbook.spread;
      const yesBid = market.orderbook.yesBid;
      const yesAsk = market.orderbook.yesAsk;

      // Wide spread (>5%) indicates opportunity or illiquidity
      if (spread >= 0.05 && yesBid > 0 && yesAsk > 0) {
        alerts.push({
          type: 'SPREAD_ALERT',
          priority: 'MEDIUM',
          title: '💰 WIDE SPREAD OPPORTUNITY',
          market: market.title,
          marketId: market.marketId || undefined,
          message: `Bid: ${formatPct(yesBid)} | Ask: ${formatPct(yesAsk)} | Spread: ${formatPct(spread)}`,
          actionable: `${formatPct(spread)} spread - potential for limit orders or market making`,
          data: { yesBid, yesAsk, spread, platform: market.platform },
        });
      }
    }
  }

  // 2. Detect cross-platform arbitrage (same market, different prices)
  // Group markets by similarity to find same market on different platforms
  const marketsByTitle: Record<string, Market[]> = {};
  for (const market of markets) {
    // Normalize title for grouping
    const key = market.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
    if (!marketsByTitle[key]) marketsByTitle[key] = [];
    marketsByTitle[key].push(market);
  }

  // Find arbitrage across platforms
  for (const [, sameMarkets] of Object.entries(marketsByTitle)) {
    if (sameMarkets.length < 2) continue;

    // Compare prices across platforms
    for (let i = 0; i < sameMarkets.length; i++) {
      for (let j = i + 1; j < sameMarkets.length; j++) {
        const m1 = sameMarkets[i];
        const m2 = sameMarkets[j];
        if (m1.platform === m2.platform) continue;

        const priceDiff = Math.abs(m1.yesPrice - m2.yesPrice);
        if (priceDiff >= 0.05) { // 5%+ difference
          const cheaper = m1.yesPrice < m2.yesPrice ? m1 : m2;
          const expensive = m1.yesPrice < m2.yesPrice ? m2 : m1;

          alerts.push({
            type: 'SPREAD_ALERT',
            priority: 'HIGH',
            title: '🎯 CROSS-PLATFORM ARBITRAGE',
            market: m1.title,
            marketId: m1.marketId || undefined,
            message: `${cheaper.platform}: ${formatPct(cheaper.yesPrice)} vs ${expensive.platform}: ${formatPct(expensive.yesPrice)}`,
            actionable: `${formatPct(priceDiff)} price difference - buy low, sell high!`,
            data: {
              platform1: cheaper.platform, price1: cheaper.yesPrice,
              platform2: expensive.platform, price2: expensive.yesPrice,
              spread: priceDiff
            },
          });
        }
      }
    }
  }

  return alerts;
}

async function detectNewMarkets(markets: Market[], state: AgentState): Promise<ProactiveAlert[]> {
  const alerts: ProactiveAlert[] = [];
  const now = Date.now();
  const NEW_MARKET_THRESHOLD_HOURS = 24; // Markets created within last 24 hours are "new"
  const thresholdMs = NEW_MARKET_THRESHOLD_HOURS * 60 * 60 * 1000;

  // Find markets that were ACTUALLY created recently (based on createdAt from API)
  const newMarkets = markets.filter(m => {
    if (!m.createdAt || !m.marketId) return false;
    const createdTime = new Date(m.createdAt).getTime();
    const ageMs = now - createdTime;
    return ageMs > 0 && ageMs <= thresholdMs;
  });

  // Filter out markets we've already alerted about
  const unseenNewMarkets = newMarkets.filter(m => !state.knownMarkets.includes(m.marketId!));

  for (const market of unseenNewMarkets.slice(0, 3)) { // Max 3 new market alerts
    const ageHours = Math.round((now - new Date(market.createdAt!).getTime()) / (1000 * 60 * 60));

    alerts.push({
      type: 'NEW_MARKET',
      priority: 'LOW',
      title: '🆕 NEW MARKET',
      market: market.title,
      marketId: market.marketId || undefined,
      message: `Listed ${ageHours < 1 ? 'less than 1 hour' : `${ageHours} hour${ageHours === 1 ? '' : 's'}`} ago on ${market.platform}`,
      actionable: `Starting at ${formatPct(market.yesPrice)} YES - early opportunity`,
      data: { platform: market.platform, probability: market.yesPrice, createdAt: market.createdAt },
    });
  }

  // Update known markets with IDs we've alerted about (keep last 1000)
  const alertedIds = unseenNewMarkets.slice(0, 3).map(m => m.marketId!);
  state.knownMarkets = [...new Set([...state.knownMarkets, ...alertedIds])].slice(-1000);

  return alerts;
}

// ============================================
// MORNING BRIEF SCHEDULER
// ============================================

/**
 * Check and send morning briefs to subscribers based on their preferred time
 */
async function sendMorningBriefs(
  state: AgentState,
  subscribers: AgentSubscriber[]
): Promise<number> {
  const now = new Date();
  const currentHourUTC = now.getUTCHours();
  const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

  let briefsSent = 0;

  for (const sub of subscribers) {
    // Skip if morning brief is disabled
    if (!sub.settings.morningBrief) continue;

    // Skip if already sent today
    if (state.lastBriefSent[sub.telegramId] === todayStr) continue;

    // Check if it's the right hour for this subscriber
    const briefHour = sub.settings.briefHour ?? 8;
    const timezone = sub.settings.timezone || 'UTC';

    // For simplicity, we'll use UTC. In production, you'd convert timezone properly.
    // Check if current hour matches the subscriber's preferred hour (with 1 hour window)
    const isRightHour = currentHourUTC === briefHour || currentHourUTC === (briefHour + 1) % 24;

    if (!isRightHour) continue;

    // Check quiet hours
    if (isQuietHours(sub)) continue;

    try {
      console.log(`[${timestamp()}] Sending morning brief to ${sub.telegramId}...`);

      // Generate the brief
      const briefData = await generateMorningBrief();
      const briefMessage = formatBriefTelegram(briefData);

      // Send the brief
      await sendTelegramMessage(sub.telegramId, briefMessage, { parseMode: 'Markdown' });

      // Mark as sent for today
      state.lastBriefSent[sub.telegramId] = todayStr;
      sub.alertsReceived++;
      briefsSent++;

      console.log(`[${timestamp()}] Morning brief sent to ${sub.telegramId}`);
    } catch (e) {
      console.error(`Failed to send morning brief to ${sub.telegramId}:`, e);
    }
  }

  return briefsSent;
}

// ============================================
// MAIN AGENT LOOP
// ============================================

export async function runProactiveAgent(): Promise<{
  alertsGenerated: number;
  alertsSent: number;
  marketsScanned: number;
  briefsSent: number;
}> {
  console.log(`[${timestamp()}] Proactive Agent scanning...`);

  const state = loadState();
  const subscribers = loadSubscribers();
  const subscriberList = Object.values(subscribers);

  if (subscriberList.length === 0) {
    console.log(`[${timestamp()}] No subscribers - skipping proactive scan`);
    return { alertsGenerated: 0, alertsSent: 0, marketsScanned: 0, briefsSent: 0 };
  }

  // Send morning briefs (runs first, independent of market data)
  let briefsSent = 0;
  try {
    briefsSent = await sendMorningBriefs(state, subscriberList);
    if (briefsSent > 0) {
      console.log(`[${timestamp()}] Sent ${briefsSent} morning briefs`);
      saveState(state); // Save updated lastBriefSent
    }
  } catch (e) {
    console.error('Error sending morning briefs:', e);
  }

  // Fetch markets from multiple sources
  let markets: Market[] = [];
  try {
    const hotMarkets = await getHotMarkets(50);
    markets = hotMarkets;
  } catch (e) {
    console.error('Error fetching markets:', e);
  }

  if (markets.length === 0) {
    console.log(`[${timestamp()}] No markets found`);
    return { alertsGenerated: 0, alertsSent: 0, marketsScanned: 0, briefsSent };
  }

  state.marketsTracked = markets.map(m => m.marketId).filter(Boolean) as string[];
  state.lastScan = new Date().toISOString();

  // Run all detection algorithms
  const allAlerts: ProactiveAlert[] = [];

  try {
    const closingAlerts = await detectClosingSoon(markets, state);
    allAlerts.push(...closingAlerts);
  } catch (e) {
    console.error('Error detecting closing soon:', e);
  }

  try {
    const moverAlerts = await detectBigMovers(markets, state);
    allAlerts.push(...moverAlerts);
  } catch (e) {
    console.error('Error detecting big movers:', e);
  }

  try {
    const alphaAlerts = await detectHotAlpha(markets);
    allAlerts.push(...alphaAlerts);
  } catch (e) {
    console.error('Error detecting hot alpha:', e);
  }

  try {
    const spreadAlerts = await detectSpreadInefficiency(markets);
    allAlerts.push(...spreadAlerts);
  } catch (e) {
    console.error('Error detecting spread:', e);
  }

  try {
    const newAlerts = await detectNewMarkets(markets, state);
    allAlerts.push(...newAlerts);
  } catch (e) {
    console.error('Error detecting new markets:', e);
  }

  // Save state before sending
  saveState(state);

  // Sort by priority
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  allAlerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Send alerts to subscribers
  let alertsSent = 0;
  const maxAlertsPerCycle = 5; // Don't spam users

  for (const alert of allAlerts.slice(0, maxAlertsPerCycle)) {
    const message = formatAlertMessage(alert);

    for (const sub of subscriberList) {
      // Check if subscriber wants this type of alert
      if (!shouldSendAlert(sub, alert)) continue;

      // Check quiet hours
      if (isQuietHours(sub)) continue;

      try {
        await sendTelegramMessage(sub.telegramId, message, { parseMode: 'Markdown' });
        alertsSent++;
        sub.alertsReceived++;
      } catch (e) {
        console.error(`Failed to send alert to ${sub.telegramId}:`, e);
      }
    }
  }

  // Save updated subscriber stats
  const subsMap = loadSubscribers();
  for (const sub of subscriberList) {
    if (subsMap[sub.telegramId]) {
      subsMap[sub.telegramId].alertsReceived = sub.alertsReceived;
    }
  }
  saveSubscribers(subsMap);

  console.log(`[${timestamp()}] Proactive Agent: ${allAlerts.length} alerts generated, ${alertsSent} sent, ${briefsSent} briefs sent to ${subscriberList.length} subscribers`);

  return {
    alertsGenerated: allAlerts.length,
    alertsSent,
    marketsScanned: markets.length,
    briefsSent,
  };
}

function shouldSendAlert(sub: AgentSubscriber, alert: ProactiveAlert): boolean {
  const s = sub.settings;
  switch (alert.type) {
    case 'CLOSING_SOON': return s.closingSoon;
    case 'BIG_MOVER': return s.bigMovers;
    case 'HOT_ALPHA': return s.hotAlpha;
    case 'SPREAD_ALERT': return s.spreadAlerts;
    case 'NEW_MARKET': return s.newMarkets;
    case 'WHALE_SIGNAL': return s.whaleSignals;
    default: return true;
  }
}

function isQuietHours(sub: AgentSubscriber): boolean {
  if (!sub.settings.quietHours) return false;
  const hour = new Date().getUTCHours();
  const { start, end } = sub.settings.quietHours;
  if (start < end) {
    return hour >= start && hour < end;
  } else {
    return hour >= start || hour < end;
  }
}

function formatAlertMessage(alert: ProactiveAlert): string {
  const priorityEmoji = alert.priority === 'HIGH' ? '🚨' : alert.priority === 'MEDIUM' ? '⚡' : '💡';

  return `
${priorityEmoji} *${alert.title}*
${'─'.repeat(28)}

*${alert.market}*

${alert.message}

*→ ${alert.actionable}*

_Your 24/7 AI Agent | /agent off to pause_
`.trim();
}

// ============================================
// COMMAND HANDLER
// ============================================

export async function handleAgentCommand(text: string, telegramId: string, username?: string): Promise<SkillResponse> {
  const lower = text.toLowerCase().trim();
  const args = lower.replace(/^\/agent\s*/, '').trim();

  // /agent - Subscribe or show status
  if (!args || args === 'status') {
    const subs = loadSubscribers();
    if (subs[telegramId]) {
      return getAgentStatus(telegramId);
    }
    return subscribeToAgent(telegramId, username);
  }

  // /agent off - Unsubscribe
  if (args === 'off' || args === 'stop' || args === 'pause') {
    return unsubscribeFromAgent(telegramId);
  }

  // /agent on - Subscribe
  if (args === 'on' || args === 'start') {
    return subscribeToAgent(telegramId, username);
  }

  // /agent settings - Show settings
  if (args === 'settings') {
    return getAgentStatus(telegramId);
  }

  // /agent enable <setting> or /agent disable <setting>
  if (args.startsWith('enable ')) {
    const setting = args.replace('enable ', '').trim();
    return updateAgentSettings(telegramId, setting, true);
  }
  if (args.startsWith('disable ')) {
    const setting = args.replace('disable ', '').trim();
    return updateAgentSettings(telegramId, setting, false);
  }

  // Help
  return {
    text: `
*24/7 AI AGENT COMMANDS*
${'─'.repeat(30)}

/agent - Activate agent
/agent status - Check status
/agent off - Pause alerts
/agent settings - View settings

*CUSTOMIZE:*
/agent enable closing
/agent disable movers

*ALERT TYPES:*
• closing - Markets closing soon
• movers - Big price movements
• alpha - Hot opportunities
• spread - Market inefficiencies
• new - New markets
• whale - Smart money signals
`,
    mood: 'EDUCATIONAL',
  };
}
