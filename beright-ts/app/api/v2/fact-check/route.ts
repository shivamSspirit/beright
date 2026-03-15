/**
 * AI Fact-Check API
 *
 * Triggered when user swipes on a prediction market card.
 * Searches the web for relevant facts and provides insights.
 *
 * POST /api/v2/fact-check
 * Body: { marketId, question, userChoice: 'YES' | 'NO', currentProbability }
 */

import { NextRequest, NextResponse } from 'next/server';
import { llmChat } from '../../../../lib/llm';
import { searchWeb } from '../../../../lib/tavily';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface FactCheckRequest {
  marketId: string;
  question: string;
  userChoice: 'YES' | 'NO';
  currentProbability: number;
  platform?: string;
}

interface FactCheckInsight {
  summary: string;
  supportingFacts: string[];
  challengingFacts: string[];
  recommendation: 'CONFIRMS' | 'CHALLENGES' | 'NEUTRAL';
  confidence: 'low' | 'medium' | 'high';
  sources: Array<{ title: string; url: string }>;
  aiAnalysis: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const body: FactCheckRequest = await request.json();
    const { marketId, question, userChoice, currentProbability, platform } = body;

    if (!question || !userChoice) {
      return NextResponse.json(
        { error: 'Missing required fields: question, userChoice' },
        { status: 400 }
      );
    }

    // Step 1: Search the web for relevant facts
    let webResults: any[] = [];
    let sources: Array<{ title: string; url: string }> = [];

    try {
      const searchQuery = `${question} latest news facts 2026`;
      const searchResult = await searchWeb(searchQuery, { maxResults: 5 });

      if (searchResult.results) {
        webResults = searchResult.results;
        sources = webResults.map((r: any) => ({
          title: r.title || 'Source',
          url: r.url || '',
        }));
      }
    } catch (searchError) {
      console.error('[FactCheck] Web search failed:', searchError);
      // Continue without web results - LLM can still provide analysis
    }

    // Step 2: Build context for LLM analysis
    const webContext = webResults.length > 0
      ? webResults.map((r: any) => `- ${r.title}: ${r.content?.slice(0, 300) || r.snippet || ''}`).join('\n')
      : 'No recent web results available.';

    // Step 3: Ask LLM to analyze and fact-check
    const prompt = `You are a fact-checker for prediction markets. A user is about to predict "${userChoice}" on this market:

MARKET: "${question}"
CURRENT PROBABILITY: ${(currentProbability * 100).toFixed(1)}% YES
USER'S CHOICE: ${userChoice}
PLATFORM: ${platform || 'Unknown'}

RECENT WEB INFORMATION:
${webContext}

Based on the available information, provide a fact-check analysis:

1. SUMMARY: One sentence summary of the key facts (max 100 chars)
2. SUPPORTING FACTS: 2-3 bullet points that SUPPORT the user choosing ${userChoice}
3. CHALLENGING FACTS: 2-3 bullet points that CHALLENGE or contradict ${userChoice}
4. RECOMMENDATION: Does the evidence CONFIRMS, CHALLENGES, or is NEUTRAL to their ${userChoice} choice?
5. CONFIDENCE: How confident are you in this analysis? (low/medium/high)
6. ANALYSIS: 2-3 sentences with your overall assessment

Respond in this exact JSON format:
{
  "summary": "...",
  "supportingFacts": ["...", "..."],
  "challengingFacts": ["...", "..."],
  "recommendation": "CONFIRMS|CHALLENGES|NEUTRAL",
  "confidence": "low|medium|high",
  "aiAnalysis": "..."
}`;

    let insight: FactCheckInsight;

    try {
      const llmResponse = await llmChat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 1000,
      });

      const responseText = llmResponse.content || '';

      // Parse JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        insight = {
          summary: parsed.summary || 'Analysis complete.',
          supportingFacts: parsed.supportingFacts || [],
          challengingFacts: parsed.challengingFacts || [],
          recommendation: parsed.recommendation || 'NEUTRAL',
          confidence: parsed.confidence || 'medium',
          sources,
          aiAnalysis: parsed.aiAnalysis || 'Unable to provide detailed analysis.',
        };
      } else {
        throw new Error('Failed to parse LLM response');
      }
    } catch (llmError) {
      console.error('[FactCheck] LLM analysis failed:', llmError);

      // Fallback insight based on probability
      const probDiff = userChoice === 'YES' ? currentProbability : 1 - currentProbability;
      insight = {
        summary: 'AI analysis unavailable. Consider the current market probability.',
        supportingFacts: [
          `Current market probability: ${(currentProbability * 100).toFixed(1)}% YES`,
          'Market reflects aggregate trader sentiment',
        ],
        challengingFacts: [
          'Limited real-time data available',
          'Consider doing your own research',
        ],
        recommendation: probDiff > 0.6 ? 'CONFIRMS' : probDiff < 0.4 ? 'CHALLENGES' : 'NEUTRAL',
        confidence: 'low',
        sources,
        aiAnalysis: 'Unable to perform deep analysis. The current market probability may be a useful reference point.',
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        marketId,
        question,
        userChoice,
        currentProbability,
        insight,
        latencyMs: Date.now() - startTime,
      },
    });
  } catch (error) {
    console.error('[FactCheck] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Fact-check failed',
      },
      { status: 500 }
    );
  }
}
