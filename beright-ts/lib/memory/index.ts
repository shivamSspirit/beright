/**
 * Memory Module for BeRight Agents
 *
 * OpenClaw-compatible persistent memory system with semantic search.
 *
 * Usage in agents:
 * ```typescript
 * import { MEMORY_TOOLS, createMemoryContext } from '@/lib/memory';
 *
 * // Add memory tools to your agent's tools array
 * const AGENT_TOOLS = [...YOUR_TOOLS, ...MEMORY_TOOLS];
 *
 * // Create context for tool execution
 * const memoryContext = createMemoryContext(walletAddress, conversationId);
 * ```
 *
 * Semantic Search (requires OPENAI_API_KEY):
 * ```typescript
 * import { semanticSearchMemory, semanticSearchConversations } from '@/lib/memory';
 *
 * // Find memories conceptually related to a query
 * const memories = await semanticSearchMemory(walletAddress, "risk tolerance");
 *
 * // Find conversations about a topic
 * const conversations = await semanticSearchConversations(walletAddress, "market predictions");
 * ```
 */

// Core memory tools for agents
export {
  MEMORY_TOOLS,
  createMemoryContext,
  executeMemoryTool,
  saveMemory,
  getMemory,
  searchMemory,
  saveDailyNote,
  getDailyNotes,
  getConversationContext,
  searchConversations,
} from './tools';

export type { MemoryEntry, MemoryEntryType, MemoryToolParams, MemoryTool } from './tools';

// Semantic search (pgvector + OpenAI embeddings)
export {
  semanticSearchMemory,
  semanticSearchConversations,
  findSimilarMemories,
  embedMemoryEntry,
  embedMessage,
  batchEmbedMemoryEntries,
  isSemanticSearchAvailable,
  getSemanticStatus,
  generateContentEmbedding,
} from './semantic';
