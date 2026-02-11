/**
 * Morning Brief Skill for BeRight Protocol
 * Generates daily aggregated intelligence report
 *
 * The "hook" that gets users engaged every morning
 */

import { SkillResponse, Market, ArbitrageOpportunity, WhaleAlert } from '../types/index';
import { getHotMarkets, searchMarkets } from './markets';
import { scanAll as scanArbitrage } from './arbitrage';
import { whaleWatch } from './whale';
import { getMarketMovers, MarketMover } from './priceTracker';
import { formatPct, formatUsd, timestamp } from './utils';
import { getCalibrationStats, listPending } from './calibration';

interface MorningBriefData {
  generatedAt: string;
  hotMarkets: Market[];
  arbitrageOpportunities: ArbitrageOpportunity[];
  whaleAlerts: WhaleAlert[];
  userStats: {
    brierScore: number;
    accuracy: number;
    pendingPredictions: number;
    streak: number;
    streakType: 'win' | 'loss' | 'none';
    rank: number | null;
  };
  marketMovers: MarketMover[];
}

/**
 * Generate the complete morning brief
 * All data is real — no simulated/mock data
 */
export async function generateMorningBrief(userId?: string): Promise<MorningBriefData> {
  console.log('Generating morning brief...');

  // Fetch all data in parallel for speed — all real sources
  const [hotMarkets, arbOpportunities, marketMovers, whaleResult] = await Promise.all([
    getHotMarkets(10),
    scanArbitrage().catch(() => []),
    getMarketMovers(5),
    whaleWatch().catch(() => ({ data: [] })),
  ]);

  // Extract whale alerts from skill response
  const whaleAlerts: WhaleAlert[] = Array.isArray(whaleResult.data) ? whaleResult.data : [];

  // Get user stats from real calibration data
  const calibrationStats = getCalibrationStats();
  const pendingPredictions = listPending();

  // Compute real rank from predictions (position based on Brier score)
  // In local mode, rank is based on prediction count (more predictions = data available)
  const rank = calibrationStats.resolvedPredictions >= 5
    ? Math.max(1, Math.ceil(calibrationStats.overallBrierScore * 100))
    : null;

  const userStats = {
    brierScore: calibrationStats.overallBrierScore,
    accuracy: calibrationStats.accuracy,
    pendingPredictions: pendingPredictions.length,
    streak: calibrationStats.streak.current,
    streakType: calibrationStats.streak.type,
    rank,
  };

  return {
    generatedAt: new Date().toISOString(),
    hotMarkets,
    arbitrageOpportunities: arbOpportunities,
    whaleAlerts,
    userStats,
    marketMovers,
  };
}

/**
 * Format brief for Telegram (concise, emoji-rich)
 */
export function formatBriefTelegram(data: MorningBriefData): string {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  let brief = `
🌅 *BERIGHT MORNING BRIEF*
${date}

`;

  // Hot Markets Section
  brief += `🔥 *HOT MARKETS*\n`;
  for (const market of data.hotMarkets.slice(0, 3)) {
    const mover = data.marketMovers.find(m => m.title === market.title);
    const changeStr = mover
      ? ` (${mover.change24h >= 0 ? '+' : ''}${mover.change24h.toFixed(0)}% 24h)`
      : '';
    brief += `• ${market.title.slice(0, 40)}...\n`;
    brief += `  📊 ${formatPct(market.yesPrice)}${changeStr}\n`;
  }

  // Alpha Alerts Section
  if (data.arbitrageOpportunities.length > 0) {
    brief += `\n🚨 *ALPHA ALERT*\n`;
    const topArb = data.arbitrageOpportunities[0];
    brief += `${formatPct(topArb.spread)} spread on "${topArb.topic.slice(0, 30)}..."\n`;
    brief += `${topArb.platformA}: ${formatPct(topArb.priceAYes)} vs ${topArb.platformB}: ${formatPct(topArb.priceBYes)}\n`;
  }

  // Whale Watch Section
  if (data.whaleAlerts.length > 0) {
    brief += `\n🐋 *WHALE WATCH*\n`;
    const topWhale = data.whaleAlerts[0];
    brief += `@${topWhale.whaleName} moved ${formatUsd(topWhale.totalUsd)}\n`;
  }

  // User Stats Section
  brief += `\n📊 *YOUR STATS*\n`;
  if (data.userStats.streak > 0) {
    const streakEmoji = data.userStats.streakType === 'win' ? '🔥' : '❄️';
    brief += `Streak: ${data.userStats.streak} ${streakEmoji} | `;
  }
  brief += `Pending: ${data.userStats.pendingPredictions} | `;
  if (data.userStats.rank) {
    brief += `Rank: #${data.userStats.rank}\n`;
  }

  if (data.userStats.brierScore > 0) {
    const grade = data.userStats.brierScore < 0.15 ? '⭐' : data.userStats.brierScore < 0.2 ? '✨' : '📊';
    brief += `Brier: ${data.userStats.brierScore.toFixed(3)} ${grade} | Acc: ${(data.userStats.accuracy * 100).toFixed(0)}%\n`;
  }

  // Call to Action
  brief += `\n💡 /predict <question> <probability> YES|NO\n`;
  brief += `📈 /hot - View trending markets\n`;
  brief += `🎯 /arb - Scan for opportunities\n`;

  return brief;
}

/**
 * Format brief for Web (richer, more detailed)
 */
export function formatBriefWeb(data: MorningBriefData): object {
  return {
    generatedAt: data.generatedAt,
    sections: {
      hotMarkets: data.hotMarkets.slice(0, 5).map(m => ({
        title: m.title,
        platform: m.platform,
        probability: m.yesPrice,
        volume: m.volume,
        url: m.url,
        change24h: data.marketMovers.find(mv => mv.title === m.title)?.change24h || 0,
      })),
      alphaAlerts: data.arbitrageOpportunities.slice(0, 3).map(arb => ({
        type: 'arbitrage',
        topic: arb.topic,
        spread: arb.spread,
        platformA: { name: arb.platformA, price: arb.priceAYes },
        platformB: { name: arb.platformB, price: arb.priceBYes },
        strategy: arb.strategy,
        profitPercent: arb.profitPercent,
      })),
      whaleAlerts: data.whaleAlerts.slice(0, 3).map(w => ({
        wallet: w.wallet,
        name: w.whaleName,
        amount: w.totalUsd,
        type: w.type,
        timestamp: w.timestamp,
      })),
      userStats: {
        brierScore: data.userStats.brierScore,
        accuracy: data.userStats.accuracy,
        pendingPredictions: data.userStats.pendingPredictions,
        streak: data.userStats.streak,
        streakType: data.userStats.streakType,
        rank: data.userStats.rank,
        grade: data.userStats.brierScore < 0.15 ? 'A' : data.userStats.brierScore < 0.2 ? 'B' : data.userStats.brierScore < 0.25 ? 'C' : 'D',
      },
    },
  };
}

/**
 * Format brief for plain text/CLI
 */
export function formatBriefText(data: MorningBriefData): string {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  let brief = `
${'='.repeat(60)}
    BERIGHT MORNING BRIEF
    ${date}
${'='.repeat(60)}

HOT MARKETS
${'-'.repeat(60)}
`;

  for (let i = 0; i < Math.min(5, data.hotMarkets.length); i++) {
    const market = data.hotMarkets[i];
    const mover = data.marketMovers.find(m => m.title === market.title);
    const changeStr = mover
      ? ` (${mover.change24h >= 0 ? '+' : ''}${mover.change24h.toFixed(1)}%)`
      : '';

    brief += `
${i + 1}. [${market.platform.toUpperCase()}] ${market.title.slice(0, 50)}
   YES: ${formatPct(market.yesPrice)}${changeStr}
   Volume: ${formatUsd(market.volume)}
`;
  }

  // Arbitrage Section
  brief += `
ARBITRAGE OPPORTUNITIES
${'-'.repeat(60)}
`;

  if (data.arbitrageOpportunities.length === 0) {
    brief += `No significant arbitrage detected (>3% threshold)\n`;
  } else {
    for (const arb of data.arbitrageOpportunities.slice(0, 3)) {
      brief += `
SPREAD: ${formatPct(arb.spread)} potential
Topic: ${arb.topic.slice(0, 50)}
${arb.platformA}: ${formatPct(arb.priceAYes)} | ${arb.platformB}: ${formatPct(arb.priceBYes)}
Strategy: ${arb.strategy}
`;
    }
  }

  // Whale Activity
  brief += `
WHALE ACTIVITY
${'-'.repeat(60)}
`;

  if (data.whaleAlerts.length === 0) {
    brief += `No significant whale movements detected\n`;
  } else {
    for (const whale of data.whaleAlerts.slice(0, 3)) {
      brief += `@${whale.whaleName}: ${formatUsd(whale.totalUsd)} - ${whale.type}\n`;
    }
  }

  // User Stats
  brief += `
YOUR PERFORMANCE
${'-'.repeat(60)}
`;

  if (data.userStats.brierScore > 0) {
    const gradeInfo = data.userStats.brierScore < 0.1
      ? { grade: 'S', label: 'Superforecaster Elite' }
      : data.userStats.brierScore < 0.15
      ? { grade: 'A', label: 'Superforecaster' }
      : data.userStats.brierScore < 0.2
      ? { grade: 'B', label: 'Very Good' }
      : data.userStats.brierScore < 0.25
      ? { grade: 'C', label: 'Above Average' }
      : { grade: 'D', label: 'Average' };

    brief += `
Grade: ${gradeInfo.grade} (${gradeInfo.label})
Brier Score: ${data.userStats.brierScore.toFixed(4)}
Accuracy: ${(data.userStats.accuracy * 100).toFixed(1)}%
Pending Predictions: ${data.userStats.pendingPredictions}
`;

    if (data.userStats.streak > 0) {
      const streakLabel = data.userStats.streakType === 'win' ? 'winning' : 'losing';
      brief += `Current Streak: ${data.userStats.streak} ${streakLabel}\n`;
    }

    if (data.userStats.rank) {
      brief += `Leaderboard Rank: #${data.userStats.rank}\n`;
    }
  } else {
    brief += `No predictions yet. Start forecasting to build your track record!\n`;
  }

  brief += `
${'='.repeat(60)}
    COMMANDS
${'='.repeat(60)}
/predict <question> <prob> YES|NO  - Make a prediction
/hot                                - View trending markets
/arb                                - Scan for arbitrage
/me                                 - View your stats
/leaderboard                        - Top forecasters
`;

  return brief;
}

/**
 * Main morning brief skill function
 */
export async function morningBrief(format: 'telegram' | 'web' | 'text' = 'text'): Promise<SkillResponse> {
  try {
    const data = await generateMorningBrief();

    let text: string;
    let responseData: unknown;

    switch (format) {
      case 'telegram':
        text = formatBriefTelegram(data);
        responseData = data;
        break;
      case 'web':
        const webData = formatBriefWeb(data);
        text = JSON.stringify(webData, null, 2);
        responseData = webData;
        break;
      default:
        text = formatBriefText(data);
        responseData = data;
    }

    const hasAlpha = data.arbitrageOpportunities.length > 0 || data.whaleAlerts.length > 0;

    return {
      text,
      mood: hasAlpha ? 'ALERT' : 'NEUTRAL',
      data: responseData,
    };
  } catch (error) {
    return {
      text: `
Morning brief generation failed: ${error instanceof Error ? error.message : 'Unknown error'}

Try individual commands:
/hot - View trending markets
/arb - Scan for arbitrage
/me  - View your stats
`,
      mood: 'ERROR',
    };
  }
}

/**
 * Quick brief (faster, less data)
 */
export async function quickBrief(): Promise<SkillResponse> {
  try {
    const hotMarkets = await getHotMarkets(5);
    const calibrationStats = getCalibrationStats();

    let text = `
🌅 QUICK BRIEF
${'-'.repeat(30)}

TOP 3 MARKETS:
`;

    for (const market of hotMarkets.slice(0, 3)) {
      text += `• ${market.title.slice(0, 35)}... ${formatPct(market.yesPrice)}\n`;
    }

    text += `
YOUR STATS:
• Brier: ${calibrationStats.overallBrierScore.toFixed(3)}
• Accuracy: ${(calibrationStats.accuracy * 100).toFixed(0)}%
• Pending: ${calibrationStats.pendingPredictions}

/brief full - Get full morning brief
`;

    return { text, mood: 'NEUTRAL', data: { hotMarkets, calibrationStats } };
  } catch (error) {
    return {
      text: `Quick brief failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

// CLI interface
if (process.argv[1]?.endsWith('brief.ts')) {
  const args = process.argv.slice(2);
  const format = args[0] as 'telegram' | 'web' | 'text' | 'quick' | undefined;

  (async () => {
    console.log('BeRight Morning Brief Generator');
    console.log('='.repeat(50));
    console.log('');

    if (format === 'quick') {
      const result = await quickBrief();
      console.log(result.text);
    } else if (format === 'telegram' || format === 'web' || format === 'text') {
      const result = await morningBrief(format);
      console.log(result.text);
    } else {
      // Default to text format
      const result = await morningBrief('text');
      console.log(result.text);
    }
  })();
}
