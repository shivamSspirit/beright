/**
 * Job Queue - In-Memory Implementation
 *
 * Handles async job tracking for long-running operations.
 * MVP uses in-memory Map; production should use Redis.
 */

export interface Job {
  id: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  progress: number;
  progressMessage?: string;
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

// In-memory job store (replace with Redis for production)
const jobs = new Map<string, Job>();

// Cleanup expired jobs every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (job.expiresAt.getTime() < now) {
      jobs.delete(id);
    }
  }
}, 60 * 1000);

/**
 * Create a new job
 */
export function createJob(): Job {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job: Job = {
    id,
    status: 'queued',
    progress: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min TTL
  };
  jobs.set(id, job);
  return job;
}

/**
 * Update job status/progress
 */
export function updateJob(id: string, updates: Partial<Job>): void {
  const job = jobs.get(id);
  if (job) {
    Object.assign(job, updates, { updatedAt: new Date() });
  }
}

/**
 * Get job by ID
 */
export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

/**
 * Get all active jobs (for debugging)
 */
export function getAllJobs(): Job[] {
  return Array.from(jobs.values());
}

/**
 * Delete a job
 */
export function deleteJob(id: string): boolean {
  return jobs.delete(id);
}

/**
 * Progress callback type for handlers
 */
export type ProgressCallback = (pct: number, message: string) => void;

/**
 * Create a progress callback bound to a job
 */
export function createProgressCallback(jobId: string): ProgressCallback {
  return (pct: number, message: string) => {
    updateJob(jobId, { progress: pct, progressMessage: message });
  };
}
