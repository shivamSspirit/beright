/**
 * BeRight Conviction - Main Exports
 *
 * Conviction markets where crypto projects stake real money on their
 * own milestones, creating verifiable on-chain accountability.
 *
 * Usage:
 *   import { conviction } from '../lib/conviction';
 *
 *   // Create a project
 *   const { project } = await conviction.projects.create({ ... });
 *
 *   // Create a conviction market
 *   const { market } = await conviction.markets.create({ ... });
 *
 *   // Calculate conviction score
 *   const score = await conviction.scoring.calculate(projectId);
 */

// Types
export * from './types';

// Milestone templates
export {
  MILESTONE_TEMPLATES,
  getMilestoneTemplate,
  getAllMilestoneTemplates,
  generateQuestion,
  validatePlaceholders,
  getSuggestedResolutionDate,
  validateStakeAmount,
  getMilestonesByResolutionSource,
} from './milestones';

// Projects
export {
  projects,
  createProject,
  getProjectById,
  getProjectBySlug,
  getProjectByWallet,
  listProjects,
  updateProjectMetrics,
  verifyProject,
  updateProjectGeoScore,
  getProjectLeaderboard,
} from './projects';

// Markets
export {
  markets,
  createMarket,
  getMarketById,
  listMarkets,
  getMarketsByProject,
  getActiveMarkets,
  getClosingSoonMarkets,
  recordProjectStake,
  updateMarketPrices,
  resolveMarket,
  closeExpiredMarkets,
  getMarketStats,
} from './markets';

// Scoring
export {
  scoring,
  calculateConvictionScore,
  recalculateAllScores,
  getTopProjects,
  getScoreHistory,
} from './scoring';

// Manifold Integration
export {
  manifold,
  isManifoldConfigured,
  createManifoldMarket,
  syncManifoldMarket,
  syncManifoldMarkets,
  resolveManifoldMarket,
  getManifoldMarketUrl,
  isManifoldHealthy,
} from './manifold';

// On-chain Escrow
export {
  escrow,
  ConvictionEscrowClient,
  getEscrowClient,
  resetEscrowClient,
  deriveMarketPda,
  deriveVaultPda,
  deriveEscrowPdas,
  createEscrowMarket,
  getEscrowMarket,
  getEscrowMarketByProject,
  ESCROW_PROGRAM_ID,
  MIN_STAKE_SOL,
  MIN_STAKE_LAMPORTS,
} from './escrow';
export type {
  EscrowStakePosition,
  EscrowMarketStatus,
  EscrowMarketOutcome,
  EscrowMarketAccount,
  CreateEscrowMarketRequest,
  CreateEscrowMarketResponse,
  StakeEscrowRequest,
  ResolveEscrowRequest,
  ClaimEscrowRequest,
} from './escrow';

// ============================================================================
// UNIFIED API
// ============================================================================

import { projects } from './projects';
import { markets } from './markets';
import { scoring } from './scoring';
import { manifold } from './manifold';
import { escrow } from './escrow';
import * as milestones from './milestones';

/**
 * Unified conviction API
 */
export const conviction = {
  projects,
  markets,
  scoring,
  manifold,
  escrow,
  milestones: {
    templates: milestones.MILESTONE_TEMPLATES,
    getTemplate: milestones.getMilestoneTemplate,
    getAll: milestones.getAllMilestoneTemplates,
    generateQuestion: milestones.generateQuestion,
    validatePlaceholders: milestones.validatePlaceholders,
    getSuggestedDate: milestones.getSuggestedResolutionDate,
    validateStake: milestones.validateStakeAmount,
  },
};

export default conviction;
