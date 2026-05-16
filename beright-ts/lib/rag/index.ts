/**
 * RAG (Retrieval Augmented Generation) System
 *
 * Provides context augmentation for Scout's signal evaluation:
 *   - Retrieves relevant knowledge chunks
 *   - Finds similar historical signals and their outcomes
 *   - Builds augmented context for better LLM evaluation
 *
 * Usage:
 *   const context = await buildSignalContext(signal);
 *   const evaluatedSignal = await evaluateWithRAG(signal);
 */

import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import { generateEmbedding, isEmbeddingsConfigured } from '../embeddings/client';
import { RAGContext, KnowledgeChunk } from '../embeddings/types';
import { llmChat } from '../llm';
import { RawSignal, EvaluatedSignal, SIGNAL_META } from '../signals/types';

// Maximum tokens for context (leave room for response)
const MAX_CONTEXT_TOKENS = 2000;
const CHARS_PER_TOKEN = 4; // Rough estimate

/**
 * Retrieve relevant knowledge chunks for a query
 */
export async function retrieveKnowledge(
  query: string,
  options?: {
    limit?: number;
    source?: string;
  }
): Promise<RAGContext | null> {
  if (!isSupabaseConfigured || !isEmbeddingsConfigured()) return null;

  try {
    const result = await generateEmbedding(query);
    if (!result) return null;

    const limit = options?.limit || 3;

    const { data, error } = await supabaseAdmin.rpc('retrieve_knowledge', {
      query_embedding: JSON.stringify(result.embedding),
      match_count: limit,
      source_filter: options?.source || null,
    });

    if (error || !data) {
      // Fallback to direct query
      return await fallbackKnowledgeRetrieval(result.embedding, limit, options?.source);
    }

    let totalTokens = 0;
    const chunks = (data as any[]).map((row: any) => {
      const tokens = Math.ceil(row.content.length / CHARS_PER_TOKEN);
      totalTokens += tokens;
      return {
        source: row.source,
        content: row.content,
        similarity: row.similarity,
      };
    });

    return {
      chunks,
      totalTokens,
      queryEmbedding: result.embedding,
    };
  } catch (err) {
    console.warn('[RAG] retrieveKnowledge failed:', err);
    return null;
  }
}

/**
 * Fallback knowledge retrieval (manual similarity)
 */
async function fallbackKnowledgeRetrieval(
  embedding: number[],
  limit: number,
  source?: string
): Promise<RAGContext | null> {
  try {
    let query = supabaseAdmin
      .from('knowledge_chunks')
      .select('source, content, embedding')
      .limit(200);

    if (source) {
      query = query.eq('source', source);
    }

    const { data, error } = await query;
    if (error || !data) return null;

    const { cosineSimilarity } = await import('../embeddings/client');

    const scored = data.map((row: any) => {
      const storedEmbedding = typeof row.embedding === 'string'
        ? JSON.parse(row.embedding)
        : row.embedding;
      return {
        source: row.source,
        content: row.content,
        similarity: cosineSimilarity(embedding, storedEmbedding),
      };
    }).sort((a, b) => b.similarity - a.similarity).slice(0, limit);

    let totalTokens = 0;
    const chunks = scored.map(s => {
      totalTokens += Math.ceil(s.content.length / CHARS_PER_TOKEN);
      return s;
    });

    return {
      chunks,
      totalTokens,
      queryEmbedding: embedding,
    };
  } catch {
    return null;
  }
}

/**
 * Find similar historical signals with outcomes
 */
export async function findSimilarHistoricalSignals(
  signal: RawSignal,
  limit: number = 3
): Promise<Array<{
  type: string;
  marketTitle: string;
  action: string;
  confidence: number;
  reasoning: string;
  similarity: number;
}>> {
  if (!isSupabaseConfigured || !isEmbeddingsConfigured()) return [];

  try {
    // Build context text for embedding
    const contextText = buildSignalContextText(signal);
    const result = await generateEmbedding(contextText);
    if (!result) return [];

    // Search for similar signal embeddings
    const { data: similarEmbeddings } = await supabaseAdmin.rpc('find_similar_signals', {
      query_embedding: JSON.stringify(result.embedding),
      match_count: limit * 2, // Get more, filter for quality
      match_threshold: 0.6,
    });

    if (!similarEmbeddings || similarEmbeddings.length === 0) return [];

    // Get the actual signal data
    const signalIds = similarEmbeddings.map((e: any) => e.signal_id);
    const { data: signals } = await supabaseAdmin
      .from('signals')
      .select('type, market_title, action, confidence, llm_verdict')
      .in('id', signalIds);

    if (!signals) return [];

    return signals.slice(0, limit).map((s: any, i: number) => ({
      type: s.type,
      marketTitle: s.market_title,
      action: s.action,
      confidence: s.confidence,
      reasoning: s.llm_verdict?.reasoning || '',
      similarity: similarEmbeddings[i]?.similarity || 0,
    }));
  } catch (err) {
    console.warn('[RAG] findSimilarHistoricalSignals failed:', err);
    return [];
  }
}

/**
 * Build context text for a signal (used for embedding)
 */
function buildSignalContextText(signal: RawSignal): string {
  const meta = SIGNAL_META[signal.type];
  return [
    `Signal Type: ${meta.label}`,
    `Market: ${signal.marketTitle}`,
    `Platform: ${signal.platform}`,
    `Strength: ${(signal.strength * 100).toFixed(0)}%`,
    ...Object.entries(signal.rawData)
      .filter(([k]) => k !== 'url' && k !== 'topMarkets')
      .slice(0, 5)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`),
  ].join('\n');
}

/**
 * Build augmented context for Scout evaluation
 */
export async function buildAugmentedContext(
  signal: RawSignal
): Promise<{
  historicalContext: string;
  knowledgeContext: string;
  totalTokens: number;
}> {
  const results = {
    historicalContext: '',
    knowledgeContext: '',
    totalTokens: 0,
  };

  // 1. Find similar historical signals
  const similarSignals = await findSimilarHistoricalSignals(signal, 3);
  if (similarSignals.length > 0) {
    results.historicalContext = [
      'Similar past signals:',
      ...similarSignals.map(s =>
        `- ${s.type} on "${s.marketTitle.slice(0, 40)}": ${s.action} (${s.confidence}% conf) — ${s.reasoning.slice(0, 80)}`
      ),
    ].join('\n');
    results.totalTokens += Math.ceil(results.historicalContext.length / CHARS_PER_TOKEN);
  }

  // 2. Retrieve relevant knowledge
  const query = `${signal.marketTitle} ${signal.type} prediction market`;
  const knowledge = await retrieveKnowledge(query, { limit: 2 });
  if (knowledge && knowledge.chunks.length > 0) {
    results.knowledgeContext = [
      'Relevant knowledge:',
      ...knowledge.chunks.map(c => `[${c.source}] ${c.content.slice(0, 200)}`),
    ].join('\n');
    results.totalTokens += Math.ceil(results.knowledgeContext.length / CHARS_PER_TOKEN);
  }

  // Trim if too long
  if (results.totalTokens > MAX_CONTEXT_TOKENS) {
    const ratio = MAX_CONTEXT_TOKENS / results.totalTokens;
    results.historicalContext = results.historicalContext.slice(0, Math.floor(results.historicalContext.length * ratio));
    results.knowledgeContext = results.knowledgeContext.slice(0, Math.floor(results.knowledgeContext.length * ratio));
    results.totalTokens = MAX_CONTEXT_TOKENS;
  }

  return results;
}

/**
 * Evaluate signal with RAG-augmented context
 *
 * This is an enhanced version of the standard Scout evaluation
 * that includes historical context and knowledge retrieval.
 */
export async function evaluateSignalWithRAG(
  signal: RawSignal
): Promise<EvaluatedSignal> {
  const meta = SIGNAL_META[signal.type];

  // Build base context
  const baseContext = [
    `Signal Type: ${meta.label} ${meta.emoji}`,
    `Market: ${signal.marketTitle}`,
    `Platform: ${signal.platform}`,
    `Strength: ${(signal.strength * 100).toFixed(0)}%`,
    '',
    'Raw Data:',
    ...Object.entries(signal.rawData)
      .filter(([k]) => k !== 'url' && k !== 'topMarkets')
      .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`),
  ].join('\n');

  // Get augmented context
  const augmented = await buildAugmentedContext(signal);

  // Build full prompt
  const fullContext = [
    baseContext,
    '',
    augmented.historicalContext,
    '',
    augmented.knowledgeContext,
  ].filter(Boolean).join('\n');

  // Enhanced system prompt with RAG awareness
  const systemPrompt = `You are Scout, a prediction market signal analyst for BeRight Protocol.

You are evaluating a detected market signal. You have access to:
1. The current signal details
2. Similar historical signals and their outcomes
3. Relevant knowledge about prediction markets

Respond ONLY with valid JSON matching this exact schema:
{
  "action": "ALERT" | "WATCH" | "SKIP",
  "confidence": <0-100 integer>,
  "reasoning": "<1-2 sentence explanation citing specific numbers and historical patterns>",
  "alertText": "<concise Telegram-ready alert message, max 3 lines, no markdown headers>"
}

Rules:
- ALERT: Strong signal, actionable now, users should know immediately
- WATCH: Interesting signal, worth monitoring but not urgent
- SKIP: Weak signal, noise, not worth alerting
- Consider historical patterns when evaluating
- Be conservative: only ALERT truly notable signals
- alertText must be concise and punchy, suitable for Telegram notification`;

  try {
    const response = await llmChat({
      system: systemPrompt,
      user: `Evaluate this signal with the provided context:\n\n${fullContext}`,
      maxTokens: 400,
      temperature: 0.1,
      quality: 'fast',
    });

    if (response.provider === 'none') throw new Error('No LLM provider');

    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        action: 'ALERT' | 'WATCH' | 'SKIP';
        confidence: number;
        reasoning: string;
        alertText: string;
      };

      if (parsed.action && parsed.confidence !== undefined) {
        return {
          ...signal,
          action: parsed.action,
          confidence: parsed.confidence,
          reasoning: parsed.reasoning || '',
          alertText: parsed.alertText || formatFallbackAlert(signal),
        };
      }
    }
  } catch (err) {
    console.warn('[RAG] LLM eval failed:', err instanceof Error ? err.message : err);
  }

  // Fallback to static evaluation
  return staticEvaluate(signal);
}

function staticEvaluate(signal: RawSignal): EvaluatedSignal {
  let action: 'ALERT' | 'WATCH' | 'SKIP';
  if (signal.strength >= 0.7) action = 'ALERT';
  else if (signal.strength >= 0.4) action = 'WATCH';
  else action = 'SKIP';

  return {
    ...signal,
    action,
    confidence: Math.round(signal.strength * 100),
    reasoning: `Static evaluation: strength ${(signal.strength * 100).toFixed(0)}%`,
    alertText: formatFallbackAlert(signal),
  };
}

function formatFallbackAlert(signal: RawSignal): string {
  const meta = SIGNAL_META[signal.type];
  return `${meta.emoji} ${meta.label}: ${signal.marketTitle.slice(0, 60)} (${(signal.strength * 100).toFixed(0)}% strength)`;
}

/**
 * Ingest knowledge chunk into the RAG system
 */
export async function ingestKnowledgeChunk(chunk: {
  source: string;
  chunkIndex: number;
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  if (!isSupabaseConfigured || !isEmbeddingsConfigured()) return false;

  try {
    const result = await generateEmbedding(chunk.content);
    if (!result) return false;

    const { error } = await supabaseAdmin
      .from('knowledge_chunks')
      .upsert({
        source: chunk.source,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        metadata: chunk.metadata || {},
        embedding: JSON.stringify(result.embedding),
        model_id: result.model,
        tokens: result.tokensUsed,
      }, {
        onConflict: 'source,chunk_index',
      });

    return !error;
  } catch {
    return false;
  }
}

/**
 * Batch ingest knowledge chunks
 */
export async function ingestKnowledge(
  source: string,
  chunks: string[],
  metadata?: Record<string, unknown>
): Promise<number> {
  let ingested = 0;

  for (let i = 0; i < chunks.length; i++) {
    const success = await ingestKnowledgeChunk({
      source,
      chunkIndex: i,
      content: chunks[i],
      metadata,
    });
    if (success) ingested++;

    // Rate limit
    await new Promise(r => setTimeout(r, 100));
  }

  return ingested;
}

/**
 * Log RAG query for debugging and improvement
 */
export async function logRAGQuery(
  query: string,
  context: RAGContext | null,
  response: string,
  latencyMs: number,
  signalId?: string
): Promise<void> {
  if (!isSupabaseConfigured) return;

  try {
    await supabaseAdmin.from('rag_queries').insert({
      query_text: query,
      query_embedding: context ? JSON.stringify(context.queryEmbedding) : null,
      retrieved_ids: context?.chunks.map(() => null) || [],
      retrieved_scores: context?.chunks.map(c => c.similarity) || [],
      context_text: context?.chunks.map(c => c.content).join('\n') || null,
      context_tokens: context?.totalTokens || 0,
      response_text: response,
      response_tokens: Math.ceil(response.length / CHARS_PER_TOKEN),
      latency_ms: latencyMs,
      signal_id: signalId || null,
    });
  } catch {
    // Silent fail for logging
  }
}
