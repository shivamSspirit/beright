/**
 * Embeddings Types
 *
 * Type definitions for the vector embedding system.
 */

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokensUsed: number;
}

export interface MarketEmbedding {
  id: string;
  marketId: string;
  platform: string;
  marketTitle: string;
  description?: string;
  category?: string;
  embedding: number[];
  modelId: string;
  tokensUsed: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SignalEmbedding {
  id: string;
  signalId: string;
  signalType: string;
  contextText: string;
  embedding: number[];
  modelId: string;
  createdAt: Date;
}

export interface KnowledgeChunk {
  id: string;
  source: string;
  chunkIndex: number;
  content: string;
  metadata: Record<string, unknown>;
  embedding: number[];
  modelId: string;
  tokens: number;
  createdAt: Date;
}

export interface SimilarityResult {
  id: string;
  title?: string;
  content?: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}

export interface RAGContext {
  chunks: {
    source: string;
    content: string;
    similarity: number;
  }[];
  totalTokens: number;
  queryEmbedding: number[];
}

export interface EmbeddingConfig {
  model: 'text-embedding-ada-002' | 'text-embedding-3-small' | 'text-embedding-3-large';
  dimensions: number;
  maxTokens: number;
  batchSize: number;
}

export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  model: 'text-embedding-ada-002',
  dimensions: 1536,
  maxTokens: 8191,
  batchSize: 100,
};
