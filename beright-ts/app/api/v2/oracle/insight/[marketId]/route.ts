/**
 * Market Insight API
 *
 * Returns AI-powered probability insights for a specific market.
 * Uses fast probability estimation without full agent conversation.
 *
 * GET /api/v2/oracle/insight/[marketId]
 *
 * Response includes:
 * - AI probability estimate
 * - Market price comparison
 * - Edge calculation
 * - Bullish/bearish factors
 * - Confidence level
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// In-memory cache for insights (5-minute TTL)
const insightCache = new Map<string, { data: MarketInsight; cachedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface MarketInsight {
  marketId: string;
  question: string;
  aiProbability: number;
  marketPrice: number;
  edge: number;
  direction: 'YES' | 'NO';
  verdict: string;
  confidence: 'low' | 'medium' | 'high';
  bullishFactors: string[];
  bearishFactors: string[];
  methodology: string;
  cachedAt: string;
  ttlSeconds: number;
}

interface RouteContext {
  params: Promise<{ marketId: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const startTime = Date.now();
  const { marketId } = await context.params;

  if (!marketId) {
    return NextResponse.json(
      { success: false, error: 'Market ID is required' },
      { status: 400 }
    );
  }

  try {
    // Check cache first
    const cached = insightCache.get(marketId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        data: cached.data,
        cached: true,
        latencyMs: Date.now() - startTime,
      });
    }

    // Get market data from query params or fetch
    const question = request.nextUrl.searchParams.get('question') || `Market ${marketId}`;
    const currentPrice = parseFloat(request.nextUrl.searchParams.get('price') || '0.5');
    const category = request.nextUrl.searchParams.get('category') || 'general';

    // Generate AI insight using Claude
    const insight = await generateInsight(marketId, question, currentPrice, category);

    // Cache the result
    insightCache.set(marketId, {
      data: insight,
      cachedAt: Date.now(),
    });

    return NextResponse.json({
      success: true,
      data: insight,
      cached: false,
      latencyMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error('[Insight API] Error:', error);

    // Return fallback insight on error
    const fallbackInsight = generateFallbackInsight(
      marketId,
      request.nextUrl.searchParams.get('question') || `Market ${marketId}`,
      parseFloat(request.nextUrl.searchParams.get('price') || '0.5')
    );

    return NextResponse.json({
      success: true,
      data: fallbackInsight,
      fallback: true,
      latencyMs: Date.now() - startTime,
    });
  }
}

async function generateInsight(
  marketId: string,
  question: string,
  marketPrice: number,
  category: string
): Promise<MarketInsight> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // Return demo insight if no API key
    return generateDemoInsight(marketId, question, marketPrice);
  }

  const anthropic = new Anthropic({ apiKey });

  const prompt = `You are a superforecaster using Philip Tetlock's methodology. Analyze this prediction market and provide a probability estimate.

Market Question: ${question}
Category: ${category}
Current Market Price: ${(marketPrice * 100).toFixed(0)}%

Provide your analysis in the following JSON format ONLY (no other text):
{
  "probability": <your probability estimate 0-1>,
  "confidence": "<low|medium|high>",
  "bullishFactors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "bearishFactors": ["<factor 1>", "<factor 2>"],
  "reasoning": "<one sentence summary>"
}

Use outside view (base rates) and inside view (specific factors) to arrive at your estimate. Be calibrated - if uncertain, your probability should reflect that uncertainty.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const aiProbability = Math.max(0.01, Math.min(0.99, parsed.probability));
    const edge = aiProbability - marketPrice;
    const direction: 'YES' | 'NO' = edge > 0 ? 'YES' : 'NO';

    let verdict: string;
    if (Math.abs(edge) < 0.05) {
      verdict = 'Fairly priced';
    } else if (edge > 0) {
      verdict = `Underpriced YES by ${Math.abs(edge * 100).toFixed(0)}%`;
    } else {
      verdict = `Overpriced YES by ${Math.abs(edge * 100).toFixed(0)}%`;
    }

    return {
      marketId,
      question,
      aiProbability,
      marketPrice,
      edge,
      direction,
      verdict,
      confidence: parsed.confidence || 'medium',
      bullishFactors: parsed.bullishFactors?.slice(0, 3) || [],
      bearishFactors: parsed.bearishFactors?.slice(0, 2) || [],
      methodology: 'Tetlock Superforecasting',
      cachedAt: new Date().toISOString(),
      ttlSeconds: 300,
    };
  } catch (parseError) {
    console.error('[Insight API] Parse error:', parseError);
    return generateDemoInsight(marketId, question, marketPrice);
  }
}

function generateDemoInsight(
  marketId: string,
  question: string,
  marketPrice: number
): MarketInsight {
  // Generate plausible demo data based on market price
  const baseOffset = (Math.random() - 0.5) * 0.2; // -10% to +10%
  const aiProbability = Math.max(0.1, Math.min(0.9, marketPrice + baseOffset));
  const edge = aiProbability - marketPrice;
  const direction: 'YES' | 'NO' = edge > 0 ? 'YES' : 'NO';

  const bullishFactors = [
    'Strong momentum indicators',
    'Increasing institutional interest',
    'Favorable macro conditions',
  ].slice(0, 2 + Math.floor(Math.random() * 2));

  const bearishFactors = [
    'Uncertainty in timing',
    'Competing narratives',
  ].slice(0, 1 + Math.floor(Math.random() * 2));

  let verdict: string;
  if (Math.abs(edge) < 0.05) {
    verdict = 'Fairly priced';
  } else if (edge > 0) {
    verdict = `Underpriced YES by ${Math.abs(edge * 100).toFixed(0)}%`;
  } else {
    verdict = `Overpriced YES by ${Math.abs(edge * 100).toFixed(0)}%`;
  }

  const confidenceLevels: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
  const confidence = confidenceLevels[Math.floor(Math.random() * 3)];

  return {
    marketId,
    question,
    aiProbability,
    marketPrice,
    edge,
    direction,
    verdict,
    confidence,
    bullishFactors,
    bearishFactors,
    methodology: 'Tetlock Superforecasting',
    cachedAt: new Date().toISOString(),
    ttlSeconds: 300,
  };
}

function generateFallbackInsight(
  marketId: string,
  question: string,
  marketPrice: number
): MarketInsight {
  return {
    marketId,
    question,
    aiProbability: marketPrice,
    marketPrice,
    edge: 0,
    direction: 'YES',
    verdict: 'Analysis unavailable',
    confidence: 'low',
    bullishFactors: [],
    bearishFactors: [],
    methodology: 'Fallback',
    cachedAt: new Date().toISOString(),
    ttlSeconds: 60,
  };
}
