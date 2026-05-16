/**
 * Semantic Predict Skill
 *
 * Natural language prediction parsing and execution.
 * Combines:
 * 1. NLP parsing to extract market, direction, amount
 * 2. Market search to find matching DFlow markets
 * 3. Jupiter quote (simulated in demo mode)
 * 4. On-chain commit to calibration program
 *
 * Examples:
 * - "Predict YES on Chiefs Super Bowl with 0.5 SOL"
 * - "bet 1 SOL on NO for Bitcoin $100k"
 * - "putting 0.25 SOL on YES for Fed rate cut"
 */

import { getQuote, executeSwap } from './swap';
import { commitPredictionWithCalibration } from '../lib/onchain/commit';
import { llmChat } from '../lib/llm';
import { polymarketProvider } from '../lib/dataFabric/providers/polymarket';
import { kalshiProvider } from '../lib/dataFabric/providers/kalshi';
import { getMetaculusQuestion } from './metaculus';

// =============================================================================
// TYPES
// =============================================================================

export interface ParsedPredictionCommand {
  market: string;
  direction: 'YES' | 'NO';
  amount: number;
  token: string;
  probability?: number;
  reasoning?: string;
}

export interface MarketMatch {
  ticker: string;
  eventTicker?: string;
  title: string;
  question?: string;
  yesPrice: number;
  noPrice: number;
  volume?: number;
  closeTime?: string;
  similarity: number;
  status?: string;
  platform?: string;
}

export interface JupiterQuoteResult {
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  outputAmount: number;
  rate: number;
  priceImpact: number;
  txSignature: string;
  isSimulation: boolean;
}

export interface OnChainResult {
  memoTx: string;
  calibrationTx?: string;
  forecasterPda: string;
  explorerUrl: string;
}

export interface SemanticPredictionInput {
  market: string;
  direction: 'YES' | 'NO';
  amount: number;
  token: string;
  userId: string;
  walletAddress?: string;
}

export interface SemanticPredictionResult {
  marketMatch: MarketMatch | null;
  jupiterQuote: JupiterQuoteResult | null;
  onChainResult: OnChainResult | null;
  success: boolean;
  error?: string;
}

// =============================================================================
// URL PARSING - Detect and fetch market from pasted links
// =============================================================================

export type SupportedPlatform = 'polymarket' | 'kalshi' | 'metaculus';

export interface ParsedMarketUrl {
  platform: SupportedPlatform;
  marketId: string;
  url: string;
}

export interface FetchedMarketFromUrl {
  platform: SupportedPlatform;
  marketId: string;
  title: string;
  question?: string;
  yesPrice: number;
  noPrice: number;
  volume?: number;
  url: string;
}

/**
 * URL patterns for prediction market platforms
 */
const URL_PATTERNS = {
  // Polymarket: https://polymarket.com/event/slug or https://polymarket.com/event/event-slug/market-slug
  polymarket: /polymarket\.com\/event\/([^\/\s?]+)(?:\/([^\/\s?]+))?/i,

  // Kalshi: https://kalshi.com/markets/ticker or https://kalshi.com/event/slug
  kalshi: /kalshi\.com\/(?:markets|event)\/([^\/\s?]+)/i,

  // Metaculus: https://metaculus.com/questions/12345/slug/
  metaculus: /metaculus\.com\/questions\/(\d+)/i,
};

/**
 * Detect if text contains a market URL
 */
export function detectMarketUrl(text: string): ParsedMarketUrl | null {
  // Check Polymarket
  const polyMatch = text.match(URL_PATTERNS.polymarket);
  if (polyMatch) {
    // Use market slug if available, otherwise event slug
    const marketId = polyMatch[2] || polyMatch[1];
    return {
      platform: 'polymarket',
      marketId,
      url: polyMatch[0].startsWith('http') ? polyMatch[0] : `https://${polyMatch[0]}`,
    };
  }

  // Check Kalshi
  const kalshiMatch = text.match(URL_PATTERNS.kalshi);
  if (kalshiMatch) {
    return {
      platform: 'kalshi',
      marketId: kalshiMatch[1].toUpperCase(),
      url: kalshiMatch[0].startsWith('http') ? kalshiMatch[0] : `https://${kalshiMatch[0]}`,
    };
  }

  // Check Metaculus
  const metaculusMatch = text.match(URL_PATTERNS.metaculus);
  if (metaculusMatch) {
    return {
      platform: 'metaculus',
      marketId: metaculusMatch[1],
      url: metaculusMatch[0].startsWith('http') ? metaculusMatch[0] : `https://${metaculusMatch[0]}`,
    };
  }

  return null;
}

/**
 * Fetch market details from a detected URL
 */
export async function fetchMarketFromUrl(
  parsed: ParsedMarketUrl
): Promise<FetchedMarketFromUrl | null> {
  console.log(`[SemanticPredict] Fetching ${parsed.platform} market: ${parsed.marketId}`);

  try {
    switch (parsed.platform) {
      case 'polymarket': {
        // Try direct fetch first
        let market = await polymarketProvider.fetchMarket(parsed.marketId);

        // If direct fetch fails, try searching by slug keywords
        if (!market) {
          console.log(`[SemanticPredict] Direct fetch failed, searching by slug keywords...`);
          // Convert slug to search keywords
          const slugWords = parsed.marketId
            .replace(/^will-/i, '')
            .replace(/-/g, ' ')
            .split(' ')
            .filter(w => w.length > 3);

          // Fetch all markets and find best match manually
          const allMarketsResult = await polymarketProvider.fetchMarkets({ limit: 100 });

          if (allMarketsResult.markets && allMarketsResult.markets.length > 0) {
            // Score each market by how many slug words it contains
            let bestMatch: typeof allMarketsResult.markets[0] | null = null;
            let bestScore = 0;

            for (const m of allMarketsResult.markets) {
              const titleLower = (m.title || m.question || '').toLowerCase();
              let score = 0;

              for (const word of slugWords) {
                if (titleLower.includes(word.toLowerCase())) {
                  score++;
                }
              }

              // Also check if URL matches
              if (m.url && m.url.toLowerCase().includes(parsed.marketId.toLowerCase())) {
                score += 10; // Strong match
              }

              if (score > bestScore) {
                bestScore = score;
                bestMatch = m;
              }
            }

            if (bestMatch && bestScore >= 2) {
              console.log(`[SemanticPredict] Found match: "${bestMatch.title}" (score: ${bestScore})`);
              market = bestMatch;
            }
          }
        }

        if (!market) return null;
        return {
          platform: 'polymarket',
          marketId: market.id,
          title: market.title,
          question: market.question,
          yesPrice: market.yesPrice,
          noPrice: market.noPrice,
          volume: market.volume,
          url: market.url || `https://polymarket.com/event/${parsed.marketId}`,
        };
      }

      case 'kalshi': {
        const market = await kalshiProvider.fetchMarket(parsed.marketId);
        if (!market) return null;
        return {
          platform: 'kalshi',
          marketId: market.id,
          title: market.title,
          question: market.question,
          yesPrice: market.yesPrice,
          noPrice: market.noPrice,
          volume: market.volume,
          url: market.url || `https://kalshi.com/markets/${parsed.marketId.toLowerCase()}`,
        };
      }

      case 'metaculus': {
        const market = await getMetaculusQuestion(parseInt(parsed.marketId));
        if (!market) return null;
        return {
          platform: 'metaculus',
          marketId: market.marketId || parsed.marketId,
          title: market.title,
          question: market.question,
          yesPrice: market.yesPrice,
          noPrice: market.noPrice,
          volume: market.volume,
          url: market.url || `https://metaculus.com/questions/${parsed.marketId}/`,
        };
      }

      default:
        return null;
    }
  } catch (error) {
    console.error(`[SemanticPredict] Failed to fetch ${parsed.platform} market:`, error);
    return null;
  }
}

/**
 * Parse prediction command from text with optional market URL
 * If URL is detected, fetches market details and allows direction/amount extraction
 */
export async function parseUrlPrediction(
  text: string
): Promise<{ market: FetchedMarketFromUrl; direction: 'YES' | 'NO'; amount: number; token: string } | null> {
  // Detect market URL in text
  const urlParsed = detectMarketUrl(text);
  if (!urlParsed) return null;

  // Fetch market details
  const market = await fetchMarketFromUrl(urlParsed);
  if (!market) return null;

  console.log(`[SemanticPredict] Fetched market from URL: ${market.title}`);

  // Extract direction and amount from text (outside the URL)
  // Remove URL from text for cleaner parsing
  const textWithoutUrl = text.replace(URL_PATTERNS.polymarket, '')
    .replace(URL_PATTERNS.kalshi, '')
    .replace(URL_PATTERNS.metaculus, '')
    .replace(/https?:\/\/[^\s]+/g, '')
    .trim();

  // Default direction based on what looks favorable
  let direction: 'YES' | 'NO' = 'YES';
  let amount = 0.1; // Default amount
  let token = 'SOL';

  // Check for NO indicators
  const noPattern = /\b(no|against|short|sell|don't think|won't|wont)\b/i;
  if (noPattern.test(textWithoutUrl)) {
    direction = 'NO';
  }

  // Check for YES indicators
  const yesPattern = /\b(yes|for|long|buy|think|will|gonna)\b/i;
  if (yesPattern.test(textWithoutUrl)) {
    direction = 'YES';
  }

  // Extract amount
  const amountMatch = textWithoutUrl.match(/([\d.]+)\s*(sol|usdc)?/i);
  if (amountMatch) {
    amount = parseFloat(amountMatch[1]) || 0.1;
    token = (amountMatch[2] || 'SOL').toUpperCase();
  }

  return { market, direction, amount, token };
}

// =============================================================================
// NLP PARSING
// =============================================================================

/**
 * Regex patterns for natural language prediction commands
 */
const PATTERNS = {
  // "predict YES on X with Y SOL"
  predictWithAmount: /(?:predict|bet|wager)\s+(yes|no)\s+(?:on|for)\s+(.+?)\s+(?:with|for)\s+([\d.]+)\s*(sol|usdc)?/i,

  // "Y SOL on YES for X"
  amountFirst: /([\d.]+)\s*(sol|usdc)?\s+on\s+(yes|no)\s+(?:for|on)\s+(.+)/i,

  // "putting X SOL on YES for Y"
  puttingOn: /(?:putting|put)\s+([\d.]+)\s*(sol|usdc)?\s+on\s+(yes|no)\s+(?:for|on|that)\s+(.+)/i,

  // "bet X on Y" (amount, then market - direction inferred)
  betOnMarket: /(?:bet|wager)\s+([\d.]+)\s*(sol|usdc)?\s+(?:on|that)\s+(.+)/i,

  // "I think X will happen, putting Y"
  beliefStatement: /(?:i\s+think|i\s+believe)\s+(.+?)(?:\s*,?\s*(?:putting|betting|with|,))?\s*([\d.]+)?\s*(sol|usdc)?/i,

  // Trailing pattern: "Market text? YES 0.1 sol" or "Market text YES 0.1 SOL"
  // Catches messages where user pastes market title and adds YES/NO + amount at the end
  trailingDirectionAmount: /^(.+?)\??\s+(yes|no)\s+([\d.]+)\s*(sol|usdc)?$/i,
};

/**
 * Keywords to detect YES/NO direction
 */
const YES_INDICATORS = ['yes', 'will', 'wins', 'win', 'gonna', 'going to', 'succeed', 'passes'];
const NO_INDICATORS = ['no', 'won\'t', 'wont', 'lose', 'loses', 'fail', 'against', 'not'];

/**
 * Infer direction from text context
 */
function inferDirection(text: string): 'YES' | 'NO' {
  const lower = text.toLowerCase();

  // Check for NO indicators first (more specific)
  for (const indicator of NO_INDICATORS) {
    if (lower.includes(indicator)) return 'NO';
  }

  // Default to YES
  return 'YES';
}

/**
 * Parse natural language prediction command
 */
export function parseNaturalLanguageCommand(text: string): ParsedPredictionCommand | null {
  const normalized = text.trim();

  // Try pattern: "predict YES on X with Y SOL"
  let match = normalized.match(PATTERNS.predictWithAmount);
  if (match) {
    return {
      direction: match[1].toUpperCase() as 'YES' | 'NO',
      market: match[2].trim(),
      amount: parseFloat(match[3]),
      token: (match[4] || 'SOL').toUpperCase(),
    };
  }

  // Try pattern: "Y SOL on YES for X"
  match = normalized.match(PATTERNS.amountFirst);
  if (match) {
    return {
      amount: parseFloat(match[1]),
      token: (match[2] || 'SOL').toUpperCase(),
      direction: match[3].toUpperCase() as 'YES' | 'NO',
      market: match[4].trim(),
    };
  }

  // Try pattern: "putting X SOL on YES for Y"
  match = normalized.match(PATTERNS.puttingOn);
  if (match) {
    return {
      amount: parseFloat(match[1]),
      token: (match[2] || 'SOL').toUpperCase(),
      direction: match[3].toUpperCase() as 'YES' | 'NO',
      market: match[4].trim(),
    };
  }

  // Try pattern: "bet X on Y" (infer direction)
  match = normalized.match(PATTERNS.betOnMarket);
  if (match) {
    const market = match[3].trim();
    return {
      amount: parseFloat(match[1]),
      token: (match[2] || 'SOL').toUpperCase(),
      direction: inferDirection(market),
      market: market,
    };
  }

  // Try pattern: "I think X will happen, putting Y"
  match = normalized.match(PATTERNS.beliefStatement);
  if (match) {
    const market = match[1].trim();
    const amount = match[2] ? parseFloat(match[2]) : 0.1; // Default 0.1 SOL
    return {
      market: market,
      direction: inferDirection(market),
      amount: amount,
      token: (match[3] || 'SOL').toUpperCase(),
    };
  }

  // Try trailing pattern: "Market text? YES 0.1 sol"
  // Catches messages where user pastes market title and adds YES/NO + amount at the end
  match = normalized.match(PATTERNS.trailingDirectionAmount);
  if (match) {
    const market = match[1].trim();
    return {
      market: market,
      direction: match[2].toUpperCase() as 'YES' | 'NO',
      amount: parseFloat(match[3]),
      token: (match[4] || 'SOL').toUpperCase(),
    };
  }

  return null;
}

/**
 * Context from previous chat messages (markets shown to user)
 */
export interface ChatContext {
  recentMarkets?: Array<{
    title: string;
    ticker?: string;
    platform?: string;
    yesPrice?: number;
    noPrice?: number;
  }>;
  lastCommand?: string;
}

/**
 * LLM-powered semantic parsing using Mistral
 * Understands natural language AND references to previous markets
 */
export async function parseWithLLM(
  text: string,
  context?: ChatContext
): Promise<ParsedPredictionCommand | null> {
  console.log('[SemanticPredict] Using Mistral LLM for semantic parsing...');

  // Build context string from recent markets
  let contextStr = '';
  if (context?.recentMarkets && context.recentMarkets.length > 0) {
    contextStr = `\n\nRECENT MARKETS (user can reference these):\n`;
    context.recentMarkets.forEach((m, i) => {
      contextStr += `${i + 1}. "${m.title}"${m.ticker ? ` [${m.ticker}]` : ''}${m.yesPrice ? ` YES:${(m.yesPrice * 100).toFixed(0)}%` : ''}\n`;
    });
  }

  try {
    const response = await llmChat({
      system: `You are a prediction market parser. Extract prediction intent from natural language.

IMPORTANT: Only respond with valid JSON. No other text.

If the user wants to make a prediction/bet on a market, extract:
- market: The topic/question they're predicting on (string)
- direction: "YES" or "NO" (their prediction stance)
- amount: Number amount to bet (default 0.1 if not specified)
- token: "SOL" or "USDC" (default "SOL")

If NOT a prediction request, respond: {"isPrediction": false}

IMPORTANT: User may reference markets from context like:
- "the first one", "market #2", "that bitcoin one"
- "predict on trump", "bet on the chiefs market"
When they do, use the FULL market title from context.

Examples:
"I want to bet on founders raising seed" → {"market": "founders raising seed", "direction": "YES", "amount": 0.1, "token": "SOL"}
"predict 0.5 sol that bitcoin hits 100k" → {"market": "bitcoin hits 100k", "direction": "YES", "amount": 0.5, "token": "SOL"}
"I think trump will win, putting 1 sol" → {"market": "trump will win", "direction": "YES", "amount": 1, "token": "SOL"}
"bet against fed rate cuts with 2 sol" → {"market": "fed rate cuts", "direction": "NO", "amount": 2, "token": "SOL"}
"predict yes on the first one" (with context) → use first market from context
"bet 1 sol on #3" (with context) → use third market from context
"what's the weather?" → {"isPrediction": false}${contextStr}`,
      user: text,
      maxTokens: 200,
      temperature: 0.1,
      quality: 'fast', // Uses Mistral Small
    });

    if (response.provider === 'none' || !response.text) {
      console.log('[SemanticPredict] LLM returned no response');
      return null;
    }

    // Parse LLM response
    const cleaned = response.text.trim();
    console.log('[SemanticPredict] LLM response:', cleaned);

    // Try to extract JSON from response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('[SemanticPredict] No JSON found in LLM response');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Check if it's not a prediction
    if (parsed.isPrediction === false) {
      console.log('[SemanticPredict] LLM determined this is not a prediction');
      return null;
    }

    // Validate required fields
    if (!parsed.market || !parsed.direction) {
      console.log('[SemanticPredict] LLM response missing required fields');
      return null;
    }

    // Normalize direction
    const direction = parsed.direction.toString().toUpperCase();
    if (direction !== 'YES' && direction !== 'NO') {
      console.log('[SemanticPredict] Invalid direction from LLM:', parsed.direction);
      return null;
    }

    return {
      market: parsed.market.toString().trim(),
      direction: direction as 'YES' | 'NO',
      amount: parseFloat(parsed.amount) || 0.1,
      token: (parsed.token || 'SOL').toString().toUpperCase(),
    };
  } catch (err) {
    console.error('[SemanticPredict] LLM parsing error:', err);
    return null;
  }
}

/**
 * Parse prediction command - Mistral LLM FIRST, regex as fallback
 *
 * Priority: Mistral LLM → Regex patterns
 * This ensures semantic understanding for all queries.
 *
 * @param text - User's message
 * @param context - Optional chat context with recent markets
 */
export async function parseSemanticCommand(
  text: string,
  context?: ChatContext
): Promise<ParsedPredictionCommand | null> {
  // Try Mistral LLM first (semantic understanding - primary)
  const llmResult = await parseWithLLM(text, context);
  if (llmResult) {
    console.log('[SemanticPredict] Parsed via Mistral LLM:', llmResult);
    return llmResult;
  }

  // Fall back to regex patterns if LLM fails
  const regexResult = parseNaturalLanguageCommand(text);
  if (regexResult) {
    console.log('[SemanticPredict] Parsed via regex fallback:', regexResult);
    return regexResult;
  }

  return null;
}

// =============================================================================
// MARKET SEARCH
// =============================================================================

/**
 * Simple text similarity using Jaccard index
 */
function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}

/**
 * Find matching markets from data fabric
 */
async function findMatchingMarkets(query: string): Promise<MarketMatch[]> {
  const matches: MarketMatch[] = [];

  try {
    // Try to import and use searchEvents from dflow API
    const { searchEvents } = await import('../lib/dflow/api');

    const searchResult = await searchEvents(query, {
      limit: 10,
      withNestedMarkets: true,
    });

    if (!searchResult.success || !searchResult.data) {
      return matches;
    }

    // Extract markets from events
    for (const event of searchResult.data) {
      if (!event.markets) continue;

      for (const market of event.markets) {
        if (market.status !== 'active') continue;

        const titleSimilarity = textSimilarity(query, market.title);
        const eventSimilarity = textSimilarity(query, event.title);
        const similarity = Math.max(titleSimilarity, eventSimilarity);

        if (similarity > 0.2) {
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
            platform: 'dflow',
          });
        }
      }
    }

    matches.sort((a, b) => b.similarity - a.similarity);
    return matches.slice(0, 5);
  } catch (err) {
    console.error('[SemanticPredict] Market search error:', err);
    return matches;
  }
}

// =============================================================================
// EXECUTION
// =============================================================================

/**
 * Execute semantic prediction workflow
 *
 * 1. Search for matching market
 * 2. Get Jupiter quote (demo mode = quote only)
 * 3. Record prediction on-chain (real devnet TX)
 * 4. Return Solscan link
 */
export async function executeSemanticPrediction(
  input: SemanticPredictionInput
): Promise<SemanticPredictionResult> {
  console.log('[SemanticPredict] Executing:', input);

  // Step 1: Find matching market
  let matchedMarket: MarketMatch | null = null;
  try {
    const markets = await findMatchingMarkets(input.market);
    matchedMarket = markets[0] || null;
    console.log('[SemanticPredict] Market match:', matchedMarket?.title || 'none');
  } catch (err) {
    console.error('[SemanticPredict] Market search failed:', err);
  }

  // Step 2: Get Jupiter quote
  let jupiterQuote: JupiterQuoteResult | null = null;
  try {
    // Convert SOL to USDC as base quote
    const quote = await getQuote(input.token, 'USDC', input.amount);

    if (quote) {
      const inputDecimals = input.token === 'SOL' ? 9 : 6;
      const outputDecimals = 6; // USDC
      const inputAmount = parseInt(quote.inAmount) / Math.pow(10, inputDecimals);
      const outputAmount = parseInt(quote.outAmount) / Math.pow(10, outputDecimals);

      jupiterQuote = {
        inputToken: input.token,
        outputToken: 'USDC',
        inputAmount: inputAmount,
        outputAmount: outputAmount,
        rate: outputAmount / inputAmount,
        priceImpact: parseFloat(quote.priceImpactPct || '0'),
        txSignature: 'QUOTE_ONLY', // Demo mode
        isSimulation: true,
      };
      console.log('[SemanticPredict] Jupiter quote:', jupiterQuote);
    }
  } catch (err) {
    console.error('[SemanticPredict] Jupiter quote failed:', err);
  }

  // Step 3: Record prediction on-chain
  let onChainResult: OnChainResult | null = null;

  // Use matched market probability, or default based on direction
  const probability = matchedMarket
    ? (input.direction === 'YES' ? matchedMarket.yesPrice : matchedMarket.noPrice)
    : (input.direction === 'YES' ? 0.5 : 0.5);

  // Generate market ID from ticker or sanitized query
  const marketId = matchedMarket?.ticker ||
    input.market.slice(0, 30).replace(/[^a-zA-Z0-9-]/g, '-').toUpperCase();

  try {
    console.log('[SemanticPredict] Recording on-chain:', {
      marketId,
      probability,
      direction: input.direction,
      user: input.walletAddress || input.userId,
    });

    const result = await commitPredictionWithCalibration(
      input.walletAddress || input.userId,
      marketId,
      probability,
      input.direction,
      0 // category
    );

    if (result.success) {
      onChainResult = {
        memoTx: result.memoTx,
        calibrationTx: result.calibrationTx,
        forecasterPda: result.forecasterPda,
        explorerUrl: `https://solscan.io/tx/${result.calibrationTx || result.memoTx}?cluster=devnet`,
      };
      console.log('[SemanticPredict] On-chain success:', onChainResult.explorerUrl);
    } else {
      console.error('[SemanticPredict] On-chain failed:', result.error);
      return {
        marketMatch: matchedMarket,
        jupiterQuote,
        onChainResult: null,
        success: false,
        error: result.error || 'On-chain commit failed',
      };
    }
  } catch (err) {
    console.error('[SemanticPredict] On-chain error:', err);
    return {
      marketMatch: matchedMarket,
      jupiterQuote,
      onChainResult: null,
      success: false,
      error: err instanceof Error ? err.message : 'On-chain commit failed',
    };
  }

  return {
    marketMatch: matchedMarket,
    jupiterQuote,
    onChainResult,
    success: true,
  };
}

/**
 * Execute prediction from a URL-fetched market
 *
 * Use this when user pastes a market link directly.
 * The market is already fetched from the platform API.
 */
export async function executeUrlPrediction(
  market: FetchedMarketFromUrl,
  direction: 'YES' | 'NO',
  amount: number,
  token: string,
  userId: string,
  walletAddress?: string
): Promise<SemanticPredictionResult> {
  console.log('[SemanticPredict] Executing URL prediction:', {
    platform: market.platform,
    title: market.title,
    direction,
    amount,
  });

  // Convert to MarketMatch format
  const matchedMarket: MarketMatch = {
    ticker: market.marketId,
    title: market.title,
    question: market.question,
    yesPrice: market.yesPrice,
    noPrice: market.noPrice,
    volume: market.volume,
    similarity: 1.0, // Exact match from URL
    platform: market.platform,
  };

  // Get Jupiter quote
  let jupiterQuote: JupiterQuoteResult | null = null;
  try {
    const quote = await getQuote(token, 'USDC', amount);

    if (quote) {
      const inputDecimals = token === 'SOL' ? 9 : 6;
      const outputDecimals = 6;
      const inputAmount = parseInt(quote.inAmount) / Math.pow(10, inputDecimals);
      const outputAmount = parseInt(quote.outAmount) / Math.pow(10, outputDecimals);

      jupiterQuote = {
        inputToken: token,
        outputToken: 'USDC',
        inputAmount,
        outputAmount,
        rate: outputAmount / inputAmount,
        priceImpact: parseFloat(quote.priceImpactPct || '0'),
        txSignature: 'QUOTE_ONLY',
        isSimulation: true,
      };
    }
  } catch (err) {
    console.error('[SemanticPredict] Jupiter quote failed:', err);
  }

  // Record on-chain
  let onChainResult: OnChainResult | null = null;
  const probability = direction === 'YES' ? market.yesPrice : market.noPrice;

  // Create a market ID that includes platform
  const marketIdForChain = `${market.platform.toUpperCase()}-${market.marketId.slice(0, 20)}`.replace(/[^a-zA-Z0-9-]/g, '-');

  try {
    const result = await commitPredictionWithCalibration(
      walletAddress || userId,
      marketIdForChain,
      probability,
      direction,
      0
    );

    if (result.success) {
      onChainResult = {
        memoTx: result.memoTx,
        calibrationTx: result.calibrationTx,
        forecasterPda: result.forecasterPda,
        explorerUrl: `https://solscan.io/tx/${result.calibrationTx || result.memoTx}?cluster=devnet`,
      };
      console.log('[SemanticPredict] On-chain success:', onChainResult.explorerUrl);
    } else {
      return {
        marketMatch: matchedMarket,
        jupiterQuote,
        onChainResult: null,
        success: false,
        error: result.error || 'On-chain commit failed',
      };
    }
  } catch (err) {
    console.error('[SemanticPredict] On-chain error:', err);
    return {
      marketMatch: matchedMarket,
      jupiterQuote,
      onChainResult: null,
      success: false,
      error: err instanceof Error ? err.message : 'On-chain commit failed',
    };
  }

  return {
    marketMatch: matchedMarket,
    jupiterQuote,
    onChainResult,
    success: true,
  };
}

// =============================================================================
// CLI INTERFACE
// =============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args.join(' ');

  if (!command) {
    console.log('Usage: npx ts-node semanticPredict.ts "Predict YES on Chiefs with 0.5 SOL"');
    process.exit(1);
  }

  const parsed = parseNaturalLanguageCommand(command);

  if (!parsed) {
    console.log('Could not parse command. Try:');
    console.log('  "Predict YES on [market] with [amount] SOL"');
    console.log('  "bet [amount] SOL on YES for [market]"');
    process.exit(1);
  }

  console.log('Parsed command:', JSON.stringify(parsed, null, 2));

  executeSemanticPrediction({
    ...parsed,
    userId: 'cli-test',
  }).then(result => {
    console.log('\nResult:', JSON.stringify(result, null, 2));
  }).catch(err => {
    console.error('Error:', err);
  });
}
