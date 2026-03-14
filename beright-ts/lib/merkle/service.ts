/**
 * BeRight Merkle Service
 *
 * Manages merkle trees for forecaster prediction commitments.
 * Handles storage, updates, and proof generation.
 *
 * Integration with:
 * - Supabase: Store trees and proofs
 * - Solana: Sync roots on-chain
 *
 * @author BeRight Protocol
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  buildMerkleTree,
  buildPredictionTree,
  hashPrediction,
  generateProof,
  verifyProof,
  addPrediction,
  isValidRoot,
  serializeTree,
  deserializeTree,
  rootToBytes,
} from './tree';
import type { PredictionRecord, MerkleTree, MerkleProof } from '@/types/forecaster';

// =============================================================================
// TYPES
// =============================================================================

interface ForecasterMerkleState {
  forecasterPubkey: string;
  currentRoot: string;
  leafCount: number;
  leaves: string[];
  lastUpdatedAt: string;
  lastSyncedRoot: string | null;
  lastSyncedAt: string | null;
}

interface CommitResult {
  success: boolean;
  leafHash: string;
  newRoot: string;
  leafIndex: number;
  proof: MerkleProof;
  needsSync: boolean;
}

interface SyncResult {
  success: boolean;
  txSignature: string | null;
  root: string;
  error?: string;
}

// =============================================================================
// MERKLE SERVICE
// =============================================================================

export class MerkleService {
  private supabase: SupabaseClient;
  private cache: Map<string, ForecasterMerkleState> = new Map();

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // ===========================================================================
  // STATE MANAGEMENT
  // ===========================================================================

  /**
   * Get merkle state for a forecaster
   */
  async getState(forecasterPubkey: string): Promise<ForecasterMerkleState | null> {
    // Check cache first
    const cached = this.cache.get(forecasterPubkey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const { data, error } = await this.supabase
      .from('forecaster_merkle_state')
      .select('*')
      .eq('forecaster_pubkey', forecasterPubkey)
      .single();

    if (error || !data) {
      return null;
    }

    const state: ForecasterMerkleState = {
      forecasterPubkey: data.forecaster_pubkey,
      currentRoot: data.current_root,
      leafCount: data.leaf_count,
      leaves: data.leaves || [],
      lastUpdatedAt: data.last_updated_at,
      lastSyncedRoot: data.last_synced_root,
      lastSyncedAt: data.last_synced_at,
    };

    this.cache.set(forecasterPubkey, state);
    return state;
  }

  /**
   * Initialize merkle state for a new forecaster
   */
  async initializeState(forecasterPubkey: string): Promise<ForecasterMerkleState> {
    const emptyTree = buildMerkleTree([]);

    const state: ForecasterMerkleState = {
      forecasterPubkey,
      currentRoot: emptyTree.root,
      leafCount: 0,
      leaves: [],
      lastUpdatedAt: new Date().toISOString(),
      lastSyncedRoot: null,
      lastSyncedAt: null,
    };

    const { error } = await this.supabase.from('forecaster_merkle_state').upsert({
      forecaster_pubkey: state.forecasterPubkey,
      current_root: state.currentRoot,
      leaf_count: state.leafCount,
      leaves: state.leaves,
      last_updated_at: state.lastUpdatedAt,
      last_synced_root: state.lastSyncedRoot,
      last_synced_at: state.lastSyncedAt,
    });

    if (error) {
      throw new Error(`Failed to initialize merkle state: ${error.message}`);
    }

    this.cache.set(forecasterPubkey, state);
    return state;
  }

  /**
   * Update merkle state in database
   */
  private async saveState(state: ForecasterMerkleState): Promise<void> {
    const { error } = await this.supabase.from('forecaster_merkle_state').upsert({
      forecaster_pubkey: state.forecasterPubkey,
      current_root: state.currentRoot,
      leaf_count: state.leafCount,
      leaves: state.leaves,
      last_updated_at: state.lastUpdatedAt,
      last_synced_root: state.lastSyncedRoot,
      last_synced_at: state.lastSyncedAt,
    });

    if (error) {
      throw new Error(`Failed to save merkle state: ${error.message}`);
    }

    this.cache.set(state.forecasterPubkey, state);
  }

  // ===========================================================================
  // COMMITMENT OPERATIONS
  // ===========================================================================

  /**
   * Commit a prediction to the merkle tree
   *
   * Returns the new root and proof for the prediction.
   */
  async commitPrediction(
    forecasterPubkey: string,
    prediction: PredictionRecord
  ): Promise<CommitResult> {
    // Get or initialize state
    let state = await this.getState(forecasterPubkey);
    if (!state) {
      state = await this.initializeState(forecasterPubkey);
    }

    // Hash the prediction
    const leafHash = hashPrediction(prediction);

    // Add to tree
    const newTree = addPrediction(state.leaves, prediction);

    // Update state
    const newState: ForecasterMerkleState = {
      ...state,
      currentRoot: newTree.root,
      leafCount: newTree.leafCount,
      leaves: newTree.leaves,
      lastUpdatedAt: new Date().toISOString(),
    };

    // Save state
    await this.saveState(newState);

    // Generate proof
    const leafIndex = newTree.leaves.indexOf(leafHash);
    const proof = generateProof(newTree.leaves, leafIndex);

    // Update prediction record with proof
    await this.supabase
      .from('predictions')
      .update({
        leaf_hash: leafHash,
        merkle_proof: proof.proof,
      })
      .eq('id', prediction.id);

    return {
      success: true,
      leafHash,
      newRoot: newTree.root,
      leafIndex,
      proof,
      needsSync: state.lastSyncedRoot !== newTree.root,
    };
  }

  /**
   * Batch commit multiple predictions
   */
  async commitPredictions(
    forecasterPubkey: string,
    predictions: PredictionRecord[]
  ): Promise<CommitResult[]> {
    const results: CommitResult[] = [];

    for (const prediction of predictions) {
      const result = await this.commitPrediction(forecasterPubkey, prediction);
      results.push(result);
    }

    return results;
  }

  // ===========================================================================
  // PROOF OPERATIONS
  // ===========================================================================

  /**
   * Generate proof for a prediction
   */
  async generateProofForPrediction(
    forecasterPubkey: string,
    predictionId: string
  ): Promise<MerkleProof | null> {
    const state = await this.getState(forecasterPubkey);
    if (!state) {
      return null;
    }

    // Get prediction from database
    const { data: prediction, error } = await this.supabase
      .from('predictions')
      .select('leaf_hash')
      .eq('id', predictionId)
      .single();

    if (error || !prediction?.leaf_hash) {
      return null;
    }

    // Find leaf index
    const leafIndex = state.leaves.indexOf(prediction.leaf_hash);
    if (leafIndex === -1) {
      return null;
    }

    return generateProof(state.leaves, leafIndex);
  }

  /**
   * Verify a proof against current root
   */
  async verifyPredictionProof(
    forecasterPubkey: string,
    proof: MerkleProof
  ): Promise<boolean> {
    const state = await this.getState(forecasterPubkey);
    if (!state) {
      return false;
    }

    // Check proof is for current root
    if (proof.root !== state.currentRoot) {
      return false;
    }

    return verifyProof(proof);
  }

  // ===========================================================================
  // SYNC OPERATIONS
  // ===========================================================================

  /**
   * Check if forecaster needs on-chain sync
   */
  async needsSync(forecasterPubkey: string): Promise<boolean> {
    const state = await this.getState(forecasterPubkey);
    if (!state) {
      return false;
    }

    return state.lastSyncedRoot !== state.currentRoot;
  }

  /**
   * Get root bytes for Solana transaction
   */
  async getRootBytes(forecasterPubkey: string): Promise<Uint8Array | null> {
    const state = await this.getState(forecasterPubkey);
    if (!state || !isValidRoot(state.currentRoot)) {
      return null;
    }

    return rootToBytes(state.currentRoot);
  }

  /**
   * Mark root as synced on-chain
   */
  async markSynced(
    forecasterPubkey: string,
    txSignature: string
  ): Promise<SyncResult> {
    const state = await this.getState(forecasterPubkey);
    if (!state) {
      return {
        success: false,
        txSignature: null,
        root: '',
        error: 'Forecaster state not found',
      };
    }

    const newState: ForecasterMerkleState = {
      ...state,
      lastSyncedRoot: state.currentRoot,
      lastSyncedAt: new Date().toISOString(),
    };

    await this.saveState(newState);

    // Update forecaster profile
    await this.supabase
      .from('forecaster_profiles')
      .update({
        predictions_root: state.currentRoot,
        last_on_chain_sync: newState.lastSyncedAt,
      })
      .eq('pubkey', forecasterPubkey);

    return {
      success: true,
      txSignature,
      root: state.currentRoot,
    };
  }

  // ===========================================================================
  // REBUILD OPERATIONS
  // ===========================================================================

  /**
   * Rebuild merkle tree from all predictions
   *
   * Use this if state gets out of sync or for migration.
   */
  async rebuildTree(forecasterPubkey: string): Promise<MerkleTree> {
    // Fetch all predictions for forecaster
    const { data: predictions, error } = await this.supabase
      .from('predictions')
      .select('*')
      .eq('forecaster_pubkey', forecasterPubkey)
      .order('predicted_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch predictions: ${error.message}`);
    }

    // Build tree
    const tree = buildPredictionTree(predictions || []);

    // Update state
    const state: ForecasterMerkleState = {
      forecasterPubkey,
      currentRoot: tree.root,
      leafCount: tree.leafCount,
      leaves: tree.leaves,
      lastUpdatedAt: new Date().toISOString(),
      lastSyncedRoot: null,
      lastSyncedAt: null,
    };

    await this.saveState(state);

    // Update all prediction proofs
    for (let i = 0; i < (predictions || []).length; i++) {
      const proof = generateProof(tree.leaves, i);
      await this.supabase
        .from('predictions')
        .update({
          leaf_hash: tree.leaves[i],
          merkle_proof: proof.proof,
        })
        .eq('id', predictions![i].id);
    }

    return tree;
  }

  // ===========================================================================
  // CACHE MANAGEMENT
  // ===========================================================================

  /**
   * Clear cache for a forecaster
   */
  clearCache(forecasterPubkey: string): void {
    this.cache.delete(forecasterPubkey);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.cache.clear();
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let instance: MerkleService | null = null;

export function getMerkleService(): MerkleService {
  if (!instance) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    instance = new MerkleService(supabaseUrl, supabaseKey);
  }

  return instance;
}

export default MerkleService;
