/**
 * Redis Module Exports
 *
 * Centralized Redis services for BeRight:
 * - Session management
 * - Job queue
 * - Direct client access
 */

export { redis } from './client';
export { SessionService } from './sessionService';
export type { SessionContext, SessionMessage } from './sessionService';

export {
  createJob,
  updateJob,
  getJob,
  getAllJobs,
  deleteJob,
  createProgressCallback,
  getJobsByConversation,
  getJobsByWallet,
  getPendingJobs,
  getQueueStats,
} from './jobQueue';
export type { Job, ProgressCallback } from './jobQueue';
