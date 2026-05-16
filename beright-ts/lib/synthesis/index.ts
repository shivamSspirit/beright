/**
 * Synthesis Agent
 *
 * Aggregates multiple signals into cohesive market narratives.
 * Runs periodically (every 6 hours) to generate intelligence reports.
 *
 * Pipeline:
 *   1. Collect recent signals (ALERT + WATCH)
 *   2. Group by market/theme
 *   3. LLM synthesis into narrative
 *   4. Generate recommendations
 *   5. Store and distribute
 *
 * Usage:
 *   const report = await synthesizeReport();
 *   const formatted = formatSynthesisForTelegram(report);
 */

import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import { llmChat } from '../llm';
import { EvaluatedSignal, SIGNAL_META } from '../signals/types';
import { getRecentSignals } from '../signals';
import { getRankedMarkets } from '../momentum';
import {
  SynthesisInput,
  SynthesisReport,
  MarketTheme,
  SynthesisConfig,
  DEFAULT_SYNTHESIS_CONFIG,
} from './types';

export * from './types';

const SYNTHESIS_SYSTEM_PROMPT = `You are the Synthesis Agent for BeRight Protocol, a prediction market intelligence platform.

Your job is to analyze multiple market signals and synthesize them into a coherent intelligence report.

You will be given:
1. A list of recent signals (volume surges, odds shifts, arbitrage opportunities, etc.)
2. Market momentum data
3. Social sentiment data

You must respond with valid JSON matching this exact schema:
{
  "headline": "<1 sentence capturing the most important market development>",
  "summary": "<2-3 sentence overview of current market conditions>",
  "themes": [
    {
      "name": "<theme name, e.g., 'Political Markets', 'Crypto Volatility'>",
      "sentiment": "bullish" | "bearish" | "neutral",
      "confidence": <0-100>,
      "narrative": "<2-3 sentences explaining this theme>"
    }
  ],
  "topSignals": [
    {
      "marketTitle": "<market name>",
      "signalType": "<signal type>",
      "importance": <1-10>,
      "reasoning": "<why this signal matters>"
    }
  ],
  "overallSentiment": "bullish" | "bearish" | "neutral" | "mixed",
  "sentimentScore": <-1 to 1>,
  "recommendations": [
    {
      "action": "BUY" | "SELL" | "WATCH" | "AVOID",
      "market": "<market title>",
      "reasoning": "<brief explanation>",
      "confidence": <0-100>
    }
  ]
}

Rules:
- Be concise and actionable
- Focus on the most important developments
- Identify patterns across signals
- Recommendations should be specific and justified
- Use numbers and percentages when available`;

/**
 * Collect synthesis input from recent data
 */
async function collectInput(
  hoursBack: number = 6
): Promise<SynthesisInput | null> {
  if (!isSupabaseConfigured) return null;

  const end = new Date();
  const start = new Date(end.getTime() - hoursBack * 60 * 60 * 1000);

  try {
    // Get recent signals
    const signals = await getRecentSignals({
      limit: 50,
    });

    // Filter to time range
    const recentSignals = signals.filter(s => {
      const signalTime = new Date(s.detectedAt);
      return signalTime >= start && signalTime <= end;
    });

    // Get hot markets
    const hotMarkets = await getRankedMarkets({ limit: 10 });

    // Get social velocity data
    const { data: socialData } = await supabaseAdmin
      .from('social_velocity')
      .select('market_id, avg_sentiment_24h, mentions_24h, top_mentions')
      .order('velocity_24h', { ascending: false })
      .limit(10);

    const topMentions = (socialData || []).flatMap((s: any) =>
      (s.top_mentions || []).slice(0, 2).map((m: any) => ({
        content: m.content || '',
        sentiment: s.avg_sentiment_24h || 0,
        source: m.source || 'unknown',
      }))
    );

    const avgSentiment = topMentions.length > 0
      ? topMentions.reduce((sum, m) => sum + m.sentiment, 0) / topMentions.length
      : 0;

    return {
      signals: recentSignals,
      momentumData: {
        hotMarkets: hotMarkets.map(m => ({
          marketId: m.marketId,
          title: m.marketTitle,
          score: m.momentumScore,
        })),
        trendingCategories: [...new Set(hotMarkets.map(m => m.platform).filter(Boolean))],
      },
      socialData: {
        topMentions,
        overallSentiment: avgSentiment,
      },
      timeRange: { start, end },
    };
  } catch (err) {
    console.warn('[Synthesis] Failed to collect input:', err);
    return null;
  }
}

/**
 * Build prompt context from input
 */
function buildContext(input: SynthesisInput): string {
  const lines: string[] = [];

  // Signals section
  lines.push('## RECENT SIGNALS');
  if (input.signals.length === 0) {
    lines.push('No recent signals detected.');
  } else {
    for (const sig of input.signals.slice(0, 20)) {
      const meta = SIGNAL_META[sig.type];
      lines.push(`- ${meta.emoji} ${meta.label} [${sig.action}] ${sig.marketTitle.slice(0, 50)} — ${sig.confidence}% conf`);
      if (sig.reasoning) {
        lines.push(`  Reason: ${sig.reasoning.slice(0, 100)}`);
      }
    }
  }

  // Momentum section
  if (input.momentumData) {
    lines.push('');
    lines.push('## HOT MARKETS (by momentum)');
    for (const m of input.momentumData.hotMarkets.slice(0, 5)) {
      lines.push(`- ${m.title.slice(0, 50)} — Score: ${m.score.toFixed(0)}`);
    }

    if (input.momentumData.trendingCategories.length > 0) {
      lines.push(`Trending categories: ${input.momentumData.trendingCategories.join(', ')}`);
    }
  }

  // Social section
  if (input.socialData) {
    lines.push('');
    lines.push('## SOCIAL SENTIMENT');
    lines.push(`Overall sentiment: ${input.socialData.overallSentiment > 0.1 ? 'Bullish' : input.socialData.overallSentiment < -0.1 ? 'Bearish' : 'Neutral'} (${(input.socialData.overallSentiment * 100).toFixed(0)}%)`);

    if (input.socialData.topMentions.length > 0) {
      lines.push('Top mentions:');
      for (const m of input.socialData.topMentions.slice(0, 3)) {
        lines.push(`- [${m.source}] "${m.content.slice(0, 80)}..."`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Run synthesis and generate report
 */
export async function synthesizeReport(
  config: Partial<SynthesisConfig> = {}
): Promise<SynthesisReport | null> {
  const finalConfig = { ...DEFAULT_SYNTHESIS_CONFIG, ...config };
  const startTime = Date.now();

  console.log('[Synthesis] Generating report...');

  // Collect input
  const input = await collectInput(6); // Last 6 hours
  if (!input) {
    console.warn('[Synthesis] No input data available');
    return null;
  }

  if (input.signals.length === 0 && (!input.momentumData || input.momentumData.hotMarkets.length === 0)) {
    console.log('[Synthesis] Insufficient data for synthesis');
    return null;
  }

  // Build context
  const context = buildContext(input);

  // Call LLM
  try {
    const response = await llmChat({
      system: SYNTHESIS_SYSTEM_PROMPT,
      user: `Generate an intelligence report for the following market data:\n\n${context}`,
      maxTokens: 1500,
      temperature: 0.3,
      quality: finalConfig.model === 'quality' ? 'smart' : 'fast',
    });

    if (response.provider === 'none') {
      throw new Error('No LLM provider available');
    }

    // Parse response
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Build report
    const report: SynthesisReport = {
      id: `synth_${Date.now()}`,
      createdAt: new Date(),
      timeRange: input.timeRange,
      headline: parsed.headline || 'Market Intelligence Report',
      summary: parsed.summary || 'No summary available.',
      themes: (parsed.themes || []).slice(0, finalConfig.maxThemes).map((t: any) => ({
        name: t.name,
        signals: [],
        sentiment: t.sentiment || 'neutral',
        confidence: t.confidence || 50,
        narrative: t.narrative || '',
      })),
      topSignals: (parsed.topSignals || []).map((s: any) => {
        const matchingSignal = input.signals.find(sig =>
          sig.marketTitle.toLowerCase().includes(s.marketTitle?.toLowerCase().slice(0, 20) || '')
        );
        return {
          signal: matchingSignal || {
            type: 'volume_surge',
            marketId: '',
            marketTitle: s.marketTitle || '',
            platform: 'unknown',
            strength: 0,
            rawData: {},
            detectedAt: new Date().toISOString(),
            action: 'WATCH',
            confidence: 50,
            reasoning: '',
            alertText: '',
          },
          importance: s.importance || 5,
          reasoning: s.reasoning || '',
        };
      }),
      overallSentiment: parsed.overallSentiment || 'neutral',
      sentimentScore: parsed.sentimentScore || 0,
      recommendations: finalConfig.includeRecommendations
        ? (parsed.recommendations || []).slice(0, finalConfig.maxRecommendations)
        : [],
      signalsProcessed: input.signals.length,
      tokensUsed: response.tokensUsed || 0,
      modelId: response.model || 'unknown',
    };

    // Save to database
    await saveReport(report);

    console.log(`[Synthesis] Report generated in ${Date.now() - startTime}ms`);
    return report;
  } catch (err) {
    console.warn('[Synthesis] Failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Save synthesis report to database
 */
async function saveReport(report: SynthesisReport): Promise<void> {
  if (!isSupabaseConfigured) return;

  try {
    await supabaseAdmin.from('synthesis_reports').insert({
      id: report.id,
      created_at: report.createdAt.toISOString(),
      time_range_start: report.timeRange.start.toISOString(),
      time_range_end: report.timeRange.end.toISOString(),
      headline: report.headline,
      summary: report.summary,
      themes: report.themes,
      top_signals: report.topSignals.map(s => ({
        marketTitle: s.signal.marketTitle,
        signalType: s.signal.type,
        importance: s.importance,
        reasoning: s.reasoning,
      })),
      overall_sentiment: report.overallSentiment,
      sentiment_score: report.sentimentScore,
      recommendations: report.recommendations,
      signals_processed: report.signalsProcessed,
      tokens_used: report.tokensUsed,
      model_id: report.modelId,
    });
  } catch (err) {
    console.warn('[Synthesis] Failed to save report:', err);
  }
}

/**
 * Get recent synthesis reports
 */
export async function getRecentReports(limit: number = 5): Promise<SynthesisReport[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabaseAdmin
      .from('synthesis_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      createdAt: new Date(row.created_at),
      timeRange: {
        start: new Date(row.time_range_start),
        end: new Date(row.time_range_end),
      },
      headline: row.headline,
      summary: row.summary,
      themes: row.themes || [],
      topSignals: (row.top_signals || []).map((s: any) => ({
        signal: {
          type: s.signalType,
          marketId: '',
          marketTitle: s.marketTitle,
          platform: 'unknown',
          strength: 0,
          rawData: {},
          detectedAt: new Date().toISOString(),
          action: 'WATCH',
          confidence: 50,
          reasoning: '',
          alertText: '',
        },
        importance: s.importance,
        reasoning: s.reasoning,
      })),
      overallSentiment: row.overall_sentiment,
      sentimentScore: row.sentiment_score,
      recommendations: row.recommendations || [],
      signalsProcessed: row.signals_processed,
      tokensUsed: row.tokens_used,
      modelId: row.model_id,
    }));
  } catch {
    return [];
  }
}

/**
 * Format synthesis report for Telegram
 */
export function formatSynthesisForTelegram(report: SynthesisReport): string {
  const sentimentEmoji = {
    bullish: '📈',
    bearish: '📉',
    neutral: '➡️',
    mixed: '🔀',
  }[report.overallSentiment];

  let text = `*MARKET INTELLIGENCE REPORT*\n${'─'.repeat(32)}\n\n`;

  // Headline
  text += `*${report.headline}*\n\n`;

  // Summary
  text += `${report.summary}\n\n`;

  // Overall sentiment
  text += `${sentimentEmoji} *Sentiment:* ${report.overallSentiment.toUpperCase()} (${(report.sentimentScore * 100).toFixed(0)}%)\n\n`;

  // Themes
  if (report.themes.length > 0) {
    text += `*KEY THEMES*\n`;
    for (const theme of report.themes.slice(0, 3)) {
      const emoji = theme.sentiment === 'bullish' ? '📈' : theme.sentiment === 'bearish' ? '📉' : '➡️';
      text += `${emoji} *${theme.name}* — ${theme.confidence}% conf\n`;
      text += `_${theme.narrative.slice(0, 120)}_\n\n`;
    }
  }

  // Top signals
  if (report.topSignals.length > 0) {
    text += `*TOP SIGNALS*\n`;
    for (const { signal, importance, reasoning } of report.topSignals.slice(0, 3)) {
      const meta = SIGNAL_META[signal.type];
      text += `${meta.emoji} ${signal.marketTitle.slice(0, 40)}\n`;
      text += `_${reasoning.slice(0, 80)}_\n\n`;
    }
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    text += `*RECOMMENDATIONS*\n`;
    for (const rec of report.recommendations.slice(0, 3)) {
      const emoji = rec.action === 'BUY' ? '🟢' : rec.action === 'SELL' ? '🔴' : rec.action === 'WATCH' ? '🟡' : '⚪';
      text += `${emoji} ${rec.action}: ${rec.market.slice(0, 35)}\n`;
      text += `_${rec.reasoning.slice(0, 60)}_\n\n`;
    }
  }

  // Footer
  text += `_${report.signalsProcessed} signals analyzed • ${new Date().toLocaleTimeString()}_`;

  return text;
}
