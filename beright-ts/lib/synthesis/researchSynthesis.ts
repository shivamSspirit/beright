/**
 * Research Synthesis - Groq LLM Integration for Superforecaster Analysis
 *
 * Follows OpenClaw Two-Tier Pattern:
 * - Tier 1: Deterministic data gathering (markets, news, facts) ← Already done
 * - Tier 2: LLM reasoning and synthesis ← This module
 *
 * Uses Groq's llama-3.3-70b for GPT-4 quality reasoning at minimal cost.
 */

import { llmChat } from '../llm';

// ============================================
// SUPERFORECASTER SYSTEM PROMPT
// ============================================

const SUPERFORECASTER_PROMPT = `You are a Superforecaster Research Analyst for BeRight Protocol.

METHODOLOGY (Philip Tetlock's Superforecasting):
1. Outside View: Start with base rates from similar historical events
2. Inside View: Analyze the specific factors in the current data
3. Synthesis: Weight evidence carefully and generate calibrated probability
4. Key Uncertainties: Identify what could change the outcome significantly

CALIBRATION RULES:
- 50% means "coin flip" - use sparingly
- 70%+ requires strong evidence
- 90%+ requires overwhelming evidence
- Always consider the opposite view before finalizing

Given market data, news, and social signals, provide a calibrated analysis.

Respond ONLY with valid JSON matching this exact schema:
{
  "probability": <0-100 integer>,
  "confidence": "high" | "medium" | "low",
  "narrative": "<2-3 paragraph synthesis connecting all signals, explaining reasoning>",
  "bullishFactors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "bearishFactors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "keyUncertainties": ["<uncertainty 1>", "<uncertainty 2>"],
  "tradingEdge": "<why market might be mispriced, or 'no edge detected'>",
  "recommendation": "BUY" | "SELL" | "HOLD" | "WATCH"
}

IMPORTANT: Your narrative must explain HOW you arrived at the probability, referencing specific data points.`;

// ============================================
// TYPES
// ============================================

export interface ResearchSynthesis {
  probability: number;
  confidence: 'high' | 'medium' | 'low';
  narrative: string;
  bullishFactors: string[];
  bearishFactors: string[];
  keyUncertainties: string[];
  tradingEdge: string;
  recommendation: 'BUY' | 'SELL' | 'HOLD' | 'WATCH';
  tokensUsed?: number;
  model?: string;
}

export interface ResearchContext {
  query: string;
  markets: any[];
  news: any;
  reddit: any;
  facts: any;
  analysis: any;
  tavilyReport?: string;
}

// ============================================
// MAIN SYNTHESIS FUNCTION
// ============================================

/**
 * Synthesize research data using Groq LLM (llama-3.3-70b)
 *
 * @param context - All gathered research data
 * @returns Structured synthesis or null if LLM unavailable
 */
export async function synthesizeResearch(
  context: ResearchContext
): Promise<ResearchSynthesis | null> {
  const startTime = Date.now();

  try {
    // Build context string for LLM
    const userMessage = buildResearchContext(context);

    // Call Groq LLM with smart model (llama-3.3-70b)
    const response = await llmChat({
      system: SUPERFORECASTER_PROMPT,
      user: userMessage,
      maxTokens: 1024,
      temperature: 0.3, // Deterministic for analytical output
      quality: 'smart', // llama-3.3-70b for better reasoning
    });

    // Check if LLM available
    if (response.provider === 'none') {
      console.warn('[ResearchSynthesis] No LLM provider available, skipping synthesis');
      return null;
    }

    // Parse JSON response - handle special characters that break JSON.parse
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[ResearchSynthesis] No JSON found in LLM response');
      console.debug('[ResearchSynthesis] Raw response:', response.text.slice(0, 200));
      return null;
    }

    // Clean the JSON string - remove control characters except newlines/tabs
    let jsonString = jsonMatch[0]
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
      .replace(/\n/g, '\\n')  // Escape newlines in string values
      .replace(/\r/g, '')     // Remove carriage returns
      .replace(/\t/g, ' ');   // Replace tabs with spaces

    // Fix common JSON issues from LLMs
    // Handle unescaped quotes inside strings (crude but effective)
    jsonString = jsonString.replace(/"([^"]*)":\s*"([^"]*)"/g, (match, key, value) => {
      const escapedValue = value.replace(/(?<!\\)"/g, '\\"');
      return `"${key}": "${escapedValue}"`;
    });

    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseError) {
      // Try a more aggressive cleanup
      const cleanJson = jsonMatch[0]
        .replace(/[\x00-\x1F\x7F]/g, ' ')  // Replace all control chars with space
        .replace(/\s+/g, ' ');              // Collapse multiple spaces

      try {
        parsed = JSON.parse(cleanJson);
      } catch (finalError) {
        console.warn('[ResearchSynthesis] JSON parse failed after cleanup');
        console.debug('[ResearchSynthesis] Raw JSON:', jsonMatch[0].slice(0, 300));
        return null;
      }
    }

    // Validate required fields
    if (typeof parsed.probability !== 'number' || !parsed.narrative) {
      console.warn('[ResearchSynthesis] Invalid response structure');
      return null;
    }

    const synthesis: ResearchSynthesis = {
      probability: Math.max(0, Math.min(100, Math.round(parsed.probability))),
      confidence: parsed.confidence || 'medium',
      narrative: parsed.narrative,
      bullishFactors: parsed.bullishFactors || [],
      bearishFactors: parsed.bearishFactors || [],
      keyUncertainties: parsed.keyUncertainties || [],
      tradingEdge: parsed.tradingEdge || 'no edge detected',
      recommendation: parsed.recommendation || 'WATCH',
      tokensUsed: response.tokensUsed,
      model: response.model,
    };

    const elapsed = Date.now() - startTime;
    console.log(
      `[ResearchSynthesis] Complete: ${synthesis.recommendation} (${synthesis.probability}%) in ${elapsed}ms, ${response.tokensUsed} tokens`
    );

    return synthesis;
  } catch (error) {
    console.error('[ResearchSynthesis] Failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

// ============================================
// CONTEXT BUILDER
// ============================================

/**
 * Build structured context string for LLM
 */
function buildResearchContext(ctx: ResearchContext): string {
  const sections: string[] = [];

  // Query
  sections.push(`RESEARCH QUERY: ${ctx.query}`);

  // Market Data
  if (ctx.markets && ctx.markets.length > 0) {
    const marketLines = ctx.markets.slice(0, 10).map((m) => {
      const price = m.yesPrice ? `${(m.yesPrice * 100).toFixed(1)}%` : 'N/A';
      const vol = m.volume ? `$${formatVolume(m.volume)}` : 'N/A';
      return `- ${m.platform || 'Unknown'}: ${(m.title || '').slice(0, 60)} = ${price} YES (${vol} vol)`;
    });
    sections.push(`MARKET DATA (${ctx.markets.length} markets):\n${marketLines.join('\n')}`);
  } else {
    sections.push('MARKET DATA: No prediction markets found for this query.');
  }

  // Consensus Analysis
  if (ctx.analysis) {
    sections.push(`CONSENSUS ANALYSIS:
- Consensus Price: ${ctx.analysis.consensusPrice || 'N/A'}%
- Price Range: ${ctx.analysis.priceRange || 'N/A'}
- Data Quality: ${ctx.analysis.dataQuality || 'unknown'}
- Market Summary: ${ctx.analysis.marketSummary || 'No summary available'}`);
  }

  // News Signals
  if (ctx.news) {
    const headlines = ctx.news.articles?.slice(0, 5).map((a: any) => a.title).join('; ') || 'none';
    sections.push(`NEWS SIGNALS:
- Sentiment: ${ctx.news.sentiment || 'neutral'}
- Source Confidence: ${ctx.news.sourceConfidence || 'unknown'}
- Article Count: ${ctx.news.articleCount || 0}
- Key Headlines: ${headlines}`);
  }

  // Social Signals
  if (ctx.reddit) {
    sections.push(`SOCIAL SIGNALS (Reddit):
- Engagement Level: ${ctx.reddit.engagementLevel || 'unknown'}
- Post Count: ${ctx.reddit.postCount || 0}
- Total Comments: ${ctx.reddit.totalComments || 0}
- Top Subreddits: ${ctx.reddit.topSubreddits?.join(', ') || 'none'}`);
  }

  // Tavily Report (if available from deepResearch)
  if (ctx.tavilyReport && ctx.tavilyReport.length > 50) {
    sections.push(`TAVILY RESEARCH REPORT:\n${ctx.tavilyReport.slice(0, 1500)}`);
  }

  // Verified Facts
  if (ctx.facts?.facts && ctx.facts.facts.length > 0) {
    const factsList = ctx.facts.facts.slice(0, 7).map((f: string) => `- ${f}`).join('\n');
    sections.push(`VERIFIED FACTS:\n${factsList}`);
  } else {
    sections.push('VERIFIED FACTS: No verified facts available for this query.');
  }

  // Final instruction
  sections.push(
    'Based on this data, provide your superforecaster analysis with calibrated probability and clear reasoning.'
  );

  return sections.join('\n\n');
}

/**
 * Format volume for display
 */
function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(1)}M`;
  }
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}K`;
  }
  return volume.toFixed(0);
}

// ============================================
// EXPORTS
// ============================================

export default {
  synthesizeResearch,
};
