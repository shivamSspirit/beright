/**
 * Redis Job Queue
 *
 * Persistent job queue using Upstash Redis.
 * Jobs survive server restarts and work across multiple instances.
 *
 * Features:
 * - 10 minute TTL (auto-cleanup)
 * - Progress tracking
 * - Result storage
 * - Falls back to in-memory if Redis unavailable
 */

import { redis } from './client';

// ============================================
// TYPES
// ============================================

export interface Job {
  id: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  progress: number;
  progressMessage?: string;
  result?: unknown;
  error?: string;
  conversationId?: string;
  walletAddress?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export type ProgressCallback = (pct: number, message: string) => void;

// ============================================
// CONSTANTS
// ============================================

const JOB_PREFIX = 'job:';
const JOB_TTL = 10 * 60; // 10 minutes in seconds

// In-memory fallback
const memoryJobs = new Map<string, Job>();

// ============================================
// JOB QUEUE SERVICE
// ============================================

/**
 * Create a new job
 */
export async function createJob(options?: {
  conversationId?: string;
  walletAddress?: string;
}): Promise<Job> {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + JOB_TTL * 1000).toISOString();

  const job: Job = {
    id,
    status: 'queued',
    progress: 0,
    conversationId: options?.conversationId,
    walletAddress: options?.walletAddress,
    createdAt: now,
    updatedAt: now,
    expiresAt,
  };

  // Save to Redis
  if (redis.isAvailable) {
    try {
      await redis.setJSON(`${JOB_PREFIX}${id}`, job, JOB_TTL);
      console.log(`[JobQueue] Created job ${id} in Redis`);
      return job;
    } catch (error) {
      console.warn('[JobQueue] Redis save failed, using memory:', error);
    }
  }

  // Memory fallback
  memoryJobs.set(id, job);
  console.log(`[JobQueue] Created job ${id} in memory`);
  return job;
}

/**
 * Update job status/progress
 */
export async function updateJob(id: string, updates: Partial<Job>): Promise<void> {
  const job = await getJob(id);
  if (!job) {
    console.warn(`[JobQueue] Job ${id} not found for update`);
    return;
  }

  const updatedJob: Job = {
    ...job,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Save to Redis
  if (redis.isAvailable) {
    try {
      // Calculate remaining TTL
      const expiresAt = new Date(job.expiresAt).getTime();
      const remainingTtl = Math.max(1, Math.floor((expiresAt - Date.now()) / 1000));

      await redis.setJSON(`${JOB_PREFIX}${id}`, updatedJob, remainingTtl);
      return;
    } catch (error) {
      console.warn('[JobQueue] Redis update failed, using memory:', error);
    }
  }

  // Memory fallback
  memoryJobs.set(id, updatedJob);
}

/**
 * Get job by ID
 */
export async function getJob(id: string): Promise<Job | null> {
  // Try Redis first
  if (redis.isAvailable) {
    try {
      const job = await redis.getJSON<Job>(`${JOB_PREFIX}${id}`);
      if (job) return job;
    } catch (error) {
      console.warn('[JobQueue] Redis get failed:', error);
    }
  }

  // Memory fallback
  const memJob = memoryJobs.get(id);
  if (memJob) {
    // Check if expired
    if (new Date(memJob.expiresAt).getTime() < Date.now()) {
      memoryJobs.delete(id);
      return null;
    }
    return memJob;
  }

  return null;
}

/**
 * Get all active jobs (for debugging/monitoring)
 */
export async function getAllJobs(): Promise<Job[]> {
  const jobs: Job[] = [];

  // Get from Redis
  if (redis.isAvailable) {
    try {
      // Use SCAN to find job keys
      let cursor = 0;
      do {
        const result = await redis.scan(cursor, `${JOB_PREFIX}*`, 100);
        cursor = result.cursor;

        for (const key of result.keys) {
          const job = await redis.getJSON<Job>(key);
          if (job) jobs.push(job);
        }
      } while (cursor !== 0);

      return jobs;
    } catch (error) {
      console.warn('[JobQueue] Redis scan failed:', error);
    }
  }

  // Memory fallback
  const now = Date.now();
  for (const [id, job] of memoryJobs) {
    if (new Date(job.expiresAt).getTime() < now) {
      memoryJobs.delete(id);
    } else {
      jobs.push(job);
    }
  }

  return jobs;
}

/**
 * Delete a job
 */
export async function deleteJob(id: string): Promise<boolean> {
  if (redis.isAvailable) {
    try {
      await redis.del(`${JOB_PREFIX}${id}`);
      return true;
    } catch (error) {
      console.warn('[JobQueue] Redis delete failed:', error);
    }
  }

  return memoryJobs.delete(id);
}

/**
 * Create a progress callback bound to a job
 */
export function createProgressCallback(jobId: string): ProgressCallback {
  return (pct: number, message: string) => {
    // Fire and forget - don't await to avoid blocking
    updateJob(jobId, { progress: pct, progressMessage: message }).catch((error) => {
      console.warn(`[JobQueue] Progress update failed for ${jobId}:`, error);
    });
  };
}

/**
 * Get jobs by conversation ID
 */
export async function getJobsByConversation(conversationId: string): Promise<Job[]> {
  const allJobs = await getAllJobs();
  return allJobs.filter((job) => job.conversationId === conversationId);
}

/**
 * Get jobs by wallet address
 */
export async function getJobsByWallet(walletAddress: string): Promise<Job[]> {
  const allJobs = await getAllJobs();
  return allJobs.filter((job) => job.walletAddress === walletAddress);
}

/**
 * Get pending jobs (queued or running)
 */
export async function getPendingJobs(walletAddress?: string): Promise<Job[]> {
  const allJobs = await getAllJobs();
  return allJobs.filter(
    (job) =>
      (job.status === 'queued' || job.status === 'running') &&
      (!walletAddress || job.walletAddress === walletAddress)
  );
}

/**
 * Clean up expired memory jobs
 */
export function cleanupExpiredMemoryJobs(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [id, job] of memoryJobs) {
    if (new Date(job.expiresAt).getTime() < now) {
      memoryJobs.delete(id);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  total: number;
  queued: number;
  running: number;
  complete: number;
  failed: number;
  memoryFallbackCount: number;
  redisAvailable: boolean;
}> {
  const jobs = await getAllJobs();

  return {
    total: jobs.length,
    queued: jobs.filter((j) => j.status === 'queued').length,
    running: jobs.filter((j) => j.status === 'running').length,
    complete: jobs.filter((j) => j.status === 'complete').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
    memoryFallbackCount: memoryJobs.size,
    redisAvailable: redis.isAvailable,
  };
}

// Cleanup expired memory jobs every minute
setInterval(() => {
  const cleaned = cleanupExpiredMemoryJobs();
  if (cleaned > 0) {
    console.log(`[JobQueue] Cleaned up ${cleaned} expired jobs from memory`);
  }
}, 60 * 1000);

// Export as default for drop-in replacement
export default {
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
};
