/**
 * Memory Module Exports
 *
 * Unified memory management for BeRight Protocol.
 */

export { MemoryService } from './MemoryService';
export type { MemoryContext, MemorySearchOptions, MemorySearchResult } from './MemoryService';

export {
  extractMemoriesFromMessage,
  extractPrediction,
  shouldExtractMemory,
  scoreImportance,
} from './extractMemory';

export {
  semanticSearch,
  hybridSearch,
  generateEmbedding,
  embedMemoryEntry,
  findSimilarMemories,
} from './searchMemory';
