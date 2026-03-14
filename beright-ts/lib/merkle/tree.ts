/**
 * BeRight Merkle Tree System
 *
 * Provides merkle tree functionality for prediction commitments.
 * - Store minimal 32-byte root on-chain
 * - Full prediction data lives off-chain (Supabase)
 * - Any prediction can be verified against the root using proof
 *
 * Uses SHA-256 for Solana compatibility.
 *
 * @author BeRight Protocol
 */

import { createHash } from 'crypto';
import type { PredictionRecord, MerkleTree, MerkleProof } from '@/types/forecaster';

// =============================================================================
// HASHING
// =============================================================================

/**
 * SHA-256 hash function (Solana-compatible)
 */
export function sha256(data: string | Buffer): Buffer {
  return createHash('sha256').update(data).digest();
}

/**
 * Hash two nodes together for merkle tree
 * Sorts nodes to ensure consistent ordering (left < right)
 */
export function hashPair(left: Buffer, right: Buffer): Buffer {
  // Sort to ensure consistent ordering regardless of insertion order
  const [a, b] = Buffer.compare(left, right) <= 0 ? [left, right] : [right, left];
  return sha256(Buffer.concat([a, b]));
}

/**
 * Convert buffer to hex string
 */
export function bufferToHex(buffer: Buffer): string {
  return buffer.toString('hex');
}

/**
 * Convert hex string to buffer
 */
export function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

// =============================================================================
// PREDICTION HASHING
// =============================================================================

/**
 * Hash a prediction record to create a merkle leaf
 *
 * Includes core immutable fields that define the prediction:
 * - Market ID & platform
 * - Direction & probability
 * - Stake amount
 * - Timestamps
 */
export function hashPrediction(prediction: PredictionRecord): string {
  const data = JSON.stringify({
    id: prediction.id,
    forecasterPubkey: prediction.forecasterPubkey,
    marketId: prediction.marketId,
    platform: prediction.platform,
    direction: prediction.direction,
    probability: prediction.probability,
    stakeUsd: prediction.stakeUsd,
    predictedAt: prediction.predictedAt,
  });

  return bufferToHex(sha256(data));
}

/**
 * Hash prediction input (before full record exists)
 */
export function hashPredictionInput(
  forecasterPubkey: string,
  marketId: string,
  platform: string,
  direction: 'YES' | 'NO',
  probability: number,
  stakeUsd: number,
  timestamp: string
): string {
  const data = JSON.stringify({
    forecasterPubkey,
    marketId,
    platform,
    direction,
    probability,
    stakeUsd,
    predictedAt: timestamp,
  });

  return bufferToHex(sha256(data));
}

// =============================================================================
// MERKLE TREE CONSTRUCTION
// =============================================================================

/**
 * Build a merkle tree from leaf hashes
 *
 * @param leaves Array of leaf hashes (hex strings)
 * @returns Complete merkle tree with root
 */
export function buildMerkleTree(leaves: string[]): MerkleTree {
  if (leaves.length === 0) {
    return {
      root: bufferToHex(sha256('empty')),
      leafCount: 0,
      depth: 0,
      leaves: [],
    };
  }

  // Convert to buffers
  let level = leaves.map(hexToBuffer);
  const depth = Math.ceil(Math.log2(level.length));

  // Pad to power of 2 with duplicated last element
  while (level.length < Math.pow(2, depth)) {
    level.push(level[level.length - 1]);
  }

  // Build tree bottom-up
  while (level.length > 1) {
    const nextLevel: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      nextLevel.push(hashPair(level[i], level[i + 1]));
    }
    level = nextLevel;
  }

  return {
    root: bufferToHex(level[0]),
    leafCount: leaves.length,
    depth,
    leaves,
  };
}

/**
 * Build merkle tree from predictions
 */
export function buildPredictionTree(predictions: PredictionRecord[]): MerkleTree {
  const leaves = predictions.map(hashPrediction);
  return buildMerkleTree(leaves);
}

// =============================================================================
// PROOF GENERATION
// =============================================================================

/**
 * Generate merkle proof for a specific leaf
 *
 * @param leaves All leaves in the tree
 * @param leafIndex Index of the leaf to prove
 * @returns Merkle proof with sibling hashes
 */
export function generateProof(leaves: string[], leafIndex: number): MerkleProof {
  if (leafIndex < 0 || leafIndex >= leaves.length) {
    throw new Error(`Invalid leaf index: ${leafIndex}`);
  }

  const tree = buildMerkleTree(leaves);
  const proof: string[] = [];

  // Convert to buffers and pad
  let level = leaves.map(hexToBuffer);
  const depth = Math.ceil(Math.log2(level.length));

  while (level.length < Math.pow(2, depth)) {
    level.push(level[level.length - 1]);
  }

  // Track position through tree
  let index = leafIndex;

  // Build proof by collecting siblings
  while (level.length > 1) {
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    proof.push(bufferToHex(level[siblingIndex]));

    const nextLevel: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      nextLevel.push(hashPair(level[i], level[i + 1]));
    }

    level = nextLevel;
    index = Math.floor(index / 2);
  }

  return {
    leaf: leaves[leafIndex],
    proof,
    index: leafIndex,
    root: tree.root,
  };
}

/**
 * Generate proof for a prediction
 */
export function generatePredictionProof(
  predictions: PredictionRecord[],
  predictionId: string
): MerkleProof {
  const index = predictions.findIndex((p) => p.id === predictionId);
  if (index === -1) {
    throw new Error(`Prediction not found: ${predictionId}`);
  }

  const leaves = predictions.map(hashPrediction);
  return generateProof(leaves, index);
}

// =============================================================================
// PROOF VERIFICATION
// =============================================================================

/**
 * Verify a merkle proof
 *
 * @param proof The merkle proof to verify
 * @returns true if proof is valid
 */
export function verifyProof(proof: MerkleProof): boolean {
  let current = hexToBuffer(proof.leaf);
  let index = proof.index;

  for (const siblingHex of proof.proof) {
    const sibling = hexToBuffer(siblingHex);
    current = hashPair(current, sibling);
    index = Math.floor(index / 2);
  }

  return bufferToHex(current) === proof.root;
}

/**
 * Verify a prediction belongs to a merkle root
 */
export function verifyPrediction(
  prediction: PredictionRecord,
  proof: MerkleProof,
  expectedRoot: string
): boolean {
  const leafHash = hashPrediction(prediction);

  if (leafHash !== proof.leaf) {
    return false;
  }

  if (proof.root !== expectedRoot) {
    return false;
  }

  return verifyProof(proof);
}

// =============================================================================
// INCREMENTAL UPDATES
// =============================================================================

/**
 * Add a new prediction to an existing tree
 *
 * Returns new tree with updated root.
 * Note: This rebuilds the tree - for very large trees, consider
 * using an append-only structure.
 */
export function addPrediction(
  existingLeaves: string[],
  newPrediction: PredictionRecord
): MerkleTree {
  const newLeaf = hashPrediction(newPrediction);
  const allLeaves = [...existingLeaves, newLeaf];
  return buildMerkleTree(allLeaves);
}

/**
 * Batch add predictions
 */
export function addPredictions(
  existingLeaves: string[],
  newPredictions: PredictionRecord[]
): MerkleTree {
  const newLeaves = newPredictions.map(hashPrediction);
  const allLeaves = [...existingLeaves, ...newLeaves];
  return buildMerkleTree(allLeaves);
}

// =============================================================================
// STORAGE HELPERS
// =============================================================================

/**
 * Serialize merkle tree for storage
 */
export function serializeTree(tree: MerkleTree): string {
  return JSON.stringify(tree);
}

/**
 * Deserialize merkle tree from storage
 */
export function deserializeTree(json: string): MerkleTree {
  return JSON.parse(json) as MerkleTree;
}

/**
 * Serialize proof for storage/transmission
 */
export function serializeProof(proof: MerkleProof): string {
  return JSON.stringify(proof);
}

/**
 * Deserialize proof
 */
export function deserializeProof(json: string): MerkleProof {
  return JSON.parse(json) as MerkleProof;
}

// =============================================================================
// SOLANA INTEGRATION HELPERS
// =============================================================================

/**
 * Convert merkle root to Solana-compatible bytes (Uint8Array)
 */
export function rootToBytes(root: string): Uint8Array {
  return new Uint8Array(hexToBuffer(root));
}

/**
 * Convert Solana bytes back to root hex string
 */
export function bytesToRoot(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

/**
 * Validate root is correct format (64 hex chars = 32 bytes)
 */
export function isValidRoot(root: string): boolean {
  return /^[0-9a-f]{64}$/i.test(root);
}

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export const MerkleTreeUtils = {
  // Hashing
  sha256,
  hashPair,
  bufferToHex,
  hexToBuffer,
  hashPrediction,
  hashPredictionInput,

  // Tree operations
  buildMerkleTree,
  buildPredictionTree,

  // Proofs
  generateProof,
  generatePredictionProof,
  verifyProof,
  verifyPrediction,

  // Updates
  addPrediction,
  addPredictions,

  // Serialization
  serializeTree,
  deserializeTree,
  serializeProof,
  deserializeProof,

  // Solana
  rootToBytes,
  bytesToRoot,
  isValidRoot,
};

export default MerkleTreeUtils;
