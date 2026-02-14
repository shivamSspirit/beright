/**
 * Smart Predict Skill
 *
 * Enhanced prediction workflow that:
 * 1. Analyzes the prediction question
 * 2. Searches for matching DFlow markets
 * 3. Provides intelligence (base rates, bias warnings)
 * 4. Links prediction to actual market for auto-resolution
 * 5. Commits to Supabase + on-chain
 *
 * Goal: Make predictions that auto-resolve with verifiable outcomes
 */

import { SkillResponse } from '../types/index';
import { searchEvents, getMarket, DFlowMarket, DFlowEvent } from '../lib/dflow/api';
import { getIntelligence } from './intelligence';
import { db, supabase } from '../lib/supabase/client';
import { commitPrediction } from '../lib/onchain/commit';
import { getMarketWatcher } from '../services/marketWatcher';
import { textSimilarity } from './utils';

// Types
interface MarketMatch {
  ticker: string;
  eventTicker: string;
  title: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  closeTime?: string;
  similarity: number;
  status: string;
}

interface SmartPredictResult {
  prediction?: {
    id: string;
    question: string;
    probability: number;
    direction: 'YES' | 'NO';
    marketTicker?: string;
    onChainTx?: string;
  };
  matchedMarket?: MarketMatch;
  intelligence?: {
    baseRate: number;
    recommendedRange: { low: number; high: number };
    biasWarnings: string[];
  };
  alternatives?: MarketMatch[];
}

/**
 * Find matching DFlow markets for a prediction question
 */
async function findMatchingMarkets(question: string): Promise<MarketMatch[]> {
  const matches: MarketMatch[] = [];

  try {
    // Search DFlow events
    const searchResult = await searchEvents(question, {
      limit: 20,
      withNestedMarkets: true,
    });

    if (!searchResult.success || !searchResult.data) {
      return matches;
    }

    // Extract and score markets
    for (const event of searchResult.data) {
      if (!event.markets) continue;

      for (const market of event.markets) {
        if (market.status !== 'active') continue;

        // Calculate similarity between question and market title
        const titleSimilarity = textSimilarity(question.toLowerCase(), market.title.toLowerCase());
        const eventSimilarity = textSimilarity(question.toLowerCase(), event.title.toLowerCase());
        const similarity = Math.max(titleSimilarity, eventSimilarity);

        if (similarity > 0.3) { // Minimum 30% similarity
          matches.push({
            ticker: market.ticker,
            eventTicker: event.ticker,
            title: market.title,
            question: event.title,
            yesPrice: parseFloat(market.yesBid || '0.5'),
            noPrice: parseFloat(market.noBid || '0.5'),
            volume: market.volume || 0,
            closeTime: market.closeTime ? new Date(market.closeTime).toISOString() : undefined,
            similarity,
            status: market.status,
          });
        }
      }
    }

    // Sort by similarity (highest first)
    matches.sort((a, b) => b.similarity - a.similarity);

    return matches.slice(0, 5); // Top 5 matches
  } catch (err) {
    console.error('[SmartPredict] Market search error:', err);
    return matches;
  }
}

/**
 * Create a smart prediction with market linking
 */
export async function smartPredict(
  question: string,
  probability: number,
  direction: 'YES' | 'NO',
  userId: string,
  options?: {
    reasoning?: string;
    forceMarketTicker?: string; // Override automatic matching
    skipIntelligence?: boolean;
  }
): Promise<SmartPredictResult> {
  const result: SmartPredictResult = {};

  // 1. Find matching markets
  let matchedMarket: MarketMatch | undefined;
  let alternatives: MarketMatch[] = [];

  if (options?.forceMarketTicker) {
    // Use specified market
    const market = await getMarket(options.forceMarketTicker);
    if (market.success && market.data) {
      matchedMarket = {
        ticker: market.data.ticker,
        eventTicker: market.data.eventTicker || '',
        title: market.data.title,
        question: market.data.title,
        yesPrice: parseFloat(market.data.yesBid || '0.5'),
        noPrice: parseFloat(market.data.noBid || '0.5'),
        volume: market.data.volume || 0,
        closeTime: market.data.closeTime ? new Date(market.data.closeTime).toISOString() : undefined,
        similarity: 1.0,
        status: market.data.status,
      };
    }
  } else {
    // Auto-find matching markets
    const matches = await findMatchingMarkets(question);
    if (matches.length > 0) {
      matchedMarket = matches[0];
      alternatives = matches.slice(1);
    }
  }

  result.matchedMarket = matchedMarket;
  result.alternatives = alternatives;

  // 2. Get intelligence (unless skipped)
  if (!options?.skipIntelligence) {
    try {
      const intel = await getIntelligence(question, matchedMarket?.ticker);
      result.intelligence = {
        baseRate: intel.baseRate.rate,
        recommendedRange: intel.recommendedRange,
        biasWarnings: intel.biasWarnings,
      };
    } catch (err) {
      console.warn('[SmartPredict] Intelligence fetch failed:', err);
    }
  }

  // 3. Create prediction in Supabase
  try {
    const prediction = await db.predictions.create({
      user_id: userId,
      question: question,
      predicted_probability: probability,
      direction: direction,
      platform: 'dflow',
      market_id: matchedMarket?.ticker || question.slice(0, 50).replace(/[^a-zA-Z0-9-]/g, '-').toUpperCase(),
      market_url: matchedMarket ? `https://kalshi.com/markets/${(matchedMarket.ticker || '').replace(/-\d{1,2}[A-Z]{3}\d{2}$/, '').replace(/-\d+$/, '').replace(/-[A-Z]{1,3}$/, '').toLowerCase()}` : undefined,
      reasoning: options?.reasoning || 'No reasoning provided',
      confidence: probability > 0.8 || probability < 0.2 ? 'high' : probability > 0.6 || probability < 0.4 ? 'medium' : 'low',
    });

    result.prediction = {
      id: prediction.id,
      question: question,
      probability: probability,
      direction: direction,
      marketTicker: matchedMarket?.ticker,
    };

    // 4. Commit to on-chain
    try {
      const user = await db.users.getById(userId);
      const chainResult = await commitPrediction(
        user?.wallet_address || userId,
        matchedMarket?.ticker || prediction.market_id || question.slice(0, 30),
        probability,
        direction
      );

      if (chainResult.success && chainResult.signature) {
        await db.predictions.addOnChainTx(prediction.id, chainResult.signature);
        result.prediction.onChainTx = chainResult.signature;
      }
    } catch (chainError) {
      console.warn('[SmartPredict] On-chain commit failed:', chainError);
    }

    // 5. Register with MarketWatcher for auto-resolution
    if (matchedMarket?.ticker) {
      try {
        const watcher = getMarketWatcher();
        await watcher.watchPrediction(prediction.id, matchedMarket.ticker);
        console.log(`[SmartPredict] Registered for auto-resolution: ${matchedMarket.ticker}`);
      } catch (watcherError) {
        console.warn('[SmartPredict] MarketWatcher registration failed:', watcherError);
      }
    }

  } catch (err) {
    console.error('[SmartPredict] Prediction creation failed:', err);
    throw err;
  }

  return result;
}

/**
 * Format smart predict result as markdown
 */
function formatSmartPredictResult(result: SmartPredictResult): string {
  let text = `
✅ *SMART PREDICTION RECORDED*
${'═'.repeat(50)}

`;

  if (result.prediction) {
    text += `📊 *${result.prediction.question}*

🎯 Direction: ${result.prediction.direction}
📈 Probability: ${(result.prediction.probability * 100).toFixed(0)}%
`;

    if (result.prediction.onChainTx) {
      text += `⛓️ On-Chain: \`${result.prediction.onChainTx.slice(0, 12)}...\`
`;
    }
  }

  if (result.matchedMarket) {
    text += `
🔗 *LINKED MARKET*
${'─'.repeat(40)}
${result.matchedMarket.title}
Ticker: ${result.matchedMarket.ticker}
Current: YES ${(result.matchedMarket.yesPrice * 100).toFixed(0)}¢ / NO ${(result.matchedMarket.noPrice * 100).toFixed(0)}¢
Match: ${(result.matchedMarket.similarity * 100).toFixed(0)}%
${result.matchedMarket.closeTime ? `Closes: ${new Date(result.matchedMarket.closeTime).toLocaleDateString()}` : ''}

✨ This prediction will AUTO-RESOLVE when the market closes!
`;
  } else {
    text += `
⚠️ No matching DFlow market found.
This prediction requires manual resolution.
`;
  }

  if (result.intelligence) {
    text += `
📈 *INTELLIGENCE*
${'─'.repeat(40)}
Base Rate: ${(result.intelligence.baseRate * 100).toFixed(0)}%
Recommended: ${(result.intelligence.recommendedRange.low * 100).toFixed(0)}% - ${(result.intelligence.recommendedRange.high * 100).toFixed(0)}%
`;

    if (result.intelligence.biasWarnings.length > 0) {
      text += `\n⚠️ Bias Warnings:\n`;
      for (const warning of result.intelligence.biasWarnings.slice(0, 2)) {
        text += `• ${warning}\n`;
      }
    }
  }

  if (result.alternatives && result.alternatives.length > 0) {
    text += `
📋 *ALTERNATIVE MARKETS*
${'─'.repeat(40)}
`;
    for (const alt of result.alternatives.slice(0, 3)) {
      text += `• ${alt.title.slice(0, 40)}... (${(alt.similarity * 100).toFixed(0)}% match)\n`;
    }
    text += `\nUse /predict with ticker to link to a specific market.`;
  }

  return text;
}

/**
 * Main skill function - Smart predict with all features
 */
export async function predict(
  question: string,
  probability: number,
  direction: 'YES' | 'NO',
  userId: string,
  options?: {
    reasoning?: string;
    marketTicker?: string;
  }
): Promise<SkillResponse> {
  try {
    const result = await smartPredict(question, probability, direction, userId, {
      reasoning: options?.reasoning,
      forceMarketTicker: options?.marketTicker,
    });

    const text = formatSmartPredictResult(result);

    return {
      text,
      mood: result.matchedMarket ? 'BULLISH' : 'NEUTRAL',
      data: result,
    };
  } catch (error) {
    console.error('[SmartPredict] Error:', error);
    return {
      text: `❌ Prediction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Search for markets to predict on
 */
export async function searchMarketsForPrediction(query: string): Promise<SkillResponse> {
  const matches = await findMatchingMarkets(query);

  if (matches.length === 0) {
    return {
      text: `No active markets found for "${query}"\n\nTry a different search term or make a custom prediction with /predict`,
      mood: 'NEUTRAL',
    };
  }

  let text = `
🔍 *MARKETS FOR: ${query}*
${'═'.repeat(50)}

`;

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    text += `${i + 1}. *${m.title}*
   Ticker: \`${m.ticker}\`
   YES: ${(m.yesPrice * 100).toFixed(0)}¢ | NO: ${(m.noPrice * 100).toFixed(0)}¢
   ${m.closeTime ? `Closes: ${new Date(m.closeTime).toLocaleDateString()}` : ''}

`;
  }

  text += `
📝 To predict on a market:
/smartpredict <ticker> <probability> YES|NO

Example:
/smartpredict ${matches[0].ticker} 65 YES
`;

  return {
    text,
    mood: 'NEUTRAL',
    data: matches,
  };
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  Search: npx ts-node smartPredict.ts search "bitcoin 100k"');
    console.log('  Predict: npx ts-node smartPredict.ts predict "Will BTC hit 100k?" 65 YES <userId>');
    process.exit(0);
  }

  const command = args[0];

  if (command === 'search') {
    const query = args.slice(1).join(' ');
    searchMarketsForPrediction(query).then(result => {
      console.log(result.text);
    }).catch(console.error);
  } else if (command === 'predict') {
    const question = args[1];
    const probability = parseFloat(args[2]) / 100;
    const direction = args[3]?.toUpperCase() as 'YES' | 'NO';
    const userId = args[4] || 'cli-test-user';

    if (!question || isNaN(probability) || !direction) {
      console.log('Usage: predict "question" probability YES|NO [userId]');
      process.exit(1);
    }

    predict(question, probability, direction, userId).then(result => {
      console.log(result.text);
    }).catch(console.error);
  }
}
