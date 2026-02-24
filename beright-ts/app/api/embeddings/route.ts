/**
 * Embeddings API
 *
 * Provides endpoints for semantic search and RAG queries.
 *
 * Endpoints:
 *   GET  /api/embeddings/stats   - Get embedding statistics
 *   POST /api/embeddings/search  - Find similar markets
 *   POST /api/embeddings/rag     - Query with RAG context
 */

import { NextRequest, NextResponse } from 'next/server';
import { findSimilarMarkets, getEmbeddingStats, isEmbeddingsConfigured } from '../../../lib/embeddings';
import { retrieveKnowledge, evaluateSignalWithRAG } from '../../../lib/rag';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'stats') {
    const stats = await getEmbeddingStats();
    return NextResponse.json({
      configured: isEmbeddingsConfigured(),
      ...stats,
    });
  }

  return NextResponse.json({
    error: 'Invalid action',
    validActions: ['stats'],
  }, { status: 400 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, query, limit, threshold, source } = body;

    if (!isEmbeddingsConfigured()) {
      return NextResponse.json({
        error: 'Embeddings not configured',
        message: 'Set OPENAI_API_KEY to enable embeddings',
      }, { status: 503 });
    }

    if (action === 'search') {
      if (!query) {
        return NextResponse.json({ error: 'Query required' }, { status: 400 });
      }

      const results = await findSimilarMarkets(query, {
        limit: limit || 5,
        threshold: threshold || 0.7,
      });

      return NextResponse.json({
        query,
        results,
        count: results.length,
      });
    }

    if (action === 'rag') {
      if (!query) {
        return NextResponse.json({ error: 'Query required' }, { status: 400 });
      }

      const context = await retrieveKnowledge(query, {
        limit: limit || 3,
        source,
      });

      return NextResponse.json({
        query,
        context: context ? {
          chunks: context.chunks.map(c => ({
            source: c.source,
            content: c.content.slice(0, 500),
            similarity: c.similarity,
          })),
          totalTokens: context.totalTokens,
        } : null,
      });
    }

    return NextResponse.json({
      error: 'Invalid action',
      validActions: ['search', 'rag'],
    }, { status: 400 });
  } catch (error) {
    console.error('[Embeddings API] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
