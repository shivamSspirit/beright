/**
 * Telegram Lock Manager
 *
 * PREVENTS MULTIPLE BOT INSTANCES FROM POLLING TELEGRAM SIMULTANEOUSLY
 *
 * The Telegram Bot API only allows ONE getUpdates request at a time per bot.
 * Multiple instances cause: "Conflict: terminated by other getUpdates request"
 *
 * This lock ensures:
 * 1. Only ONE process polls Telegram
 * 2. Dead processes don't hold locks forever (stale detection)
 * 3. Clean shutdown releases locks
 *
 * Architecture:
 * - telegram.ts: POLLING (acquires lock)
 * - heartbeat.ts: SENDING ONLY (no lock needed)
 * - other agents: SENDING ONLY (no lock needed)
 */

import * as fs from 'fs';
import * as path from 'path';

const LOCK_FILE = path.join(process.cwd(), 'memory', '.telegram.lock');
const LOCK_STALE_MS = 60 * 1000; // Lock considered stale after 60 seconds without heartbeat

interface LockData {
  pid: number;
  startedAt: string;
  lastHeartbeat: string;
  hostname: string;
}

/**
 * Check if a process is still running
 */
function isProcessRunning(pid: number): boolean {
  try {
    // Sending signal 0 doesn't kill the process, just checks if it exists
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the current lock file
 */
function readLock(): LockData | null {
  try {
    if (!fs.existsSync(LOCK_FILE)) {
      return null;
    }
    const content = fs.readFileSync(LOCK_FILE, 'utf-8');
    return JSON.parse(content) as LockData;
  } catch {
    return null;
  }
}

/**
 * Write lock file
 */
function writeLock(data: LockData): void {
  const dir = path.dirname(LOCK_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(LOCK_FILE, JSON.stringify(data, null, 2));
}

/**
 * Remove lock file
 */
function removeLock(): void {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  } catch (err) {
    console.error('[TelegramLock] Failed to remove lock:', err);
  }
}

/**
 * Check if current lock is stale (dead process or no heartbeat)
 */
function isLockStale(lock: LockData): boolean {
  // Check if process is still running
  if (!isProcessRunning(lock.pid)) {
    console.log(`[TelegramLock] Lock held by dead process (PID ${lock.pid})`);
    return true;
  }

  // Check if heartbeat is recent
  const lastHeartbeat = new Date(lock.lastHeartbeat).getTime();
  const elapsed = Date.now() - lastHeartbeat;
  if (elapsed > LOCK_STALE_MS) {
    console.log(`[TelegramLock] Lock stale - no heartbeat for ${Math.round(elapsed / 1000)}s`);
    return true;
  }

  return false;
}

/**
 * Acquire the Telegram polling lock
 *
 * Returns true if lock acquired, false if another instance is running
 */
export function acquireLock(): { acquired: boolean; error?: string } {
  const existingLock = readLock();

  if (existingLock) {
    // Check if existing lock is still valid
    if (!isLockStale(existingLock)) {
      return {
        acquired: false,
        error: `Another Telegram bot instance is running (PID: ${existingLock.pid}, started: ${existingLock.startedAt})`,
      };
    }

    // Lock is stale, remove it
    console.log('[TelegramLock] Removing stale lock...');
    removeLock();
  }

  // Create new lock
  const lockData: LockData = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    hostname: require('os').hostname(),
  };

  writeLock(lockData);
  console.log(`[TelegramLock] Lock acquired (PID: ${process.pid})`);

  return { acquired: true };
}

/**
 * Release the Telegram polling lock
 *
 * Only removes lock if it belongs to current process
 */
export function releaseLock(): void {
  const existingLock = readLock();

  if (!existingLock) {
    return;
  }

  if (existingLock.pid !== process.pid) {
    console.warn(`[TelegramLock] Cannot release lock owned by PID ${existingLock.pid}`);
    return;
  }

  removeLock();
  console.log('[TelegramLock] Lock released');
}

/**
 * Update lock heartbeat to prove process is still alive
 *
 * Should be called periodically (e.g., every 30 seconds)
 */
export function heartbeatLock(): void {
  const existingLock = readLock();

  if (!existingLock || existingLock.pid !== process.pid) {
    // Lock doesn't exist or belongs to another process
    return;
  }

  // Update heartbeat timestamp
  existingLock.lastHeartbeat = new Date().toISOString();
  writeLock(existingLock);
}

/**
 * Start automatic lock heartbeat
 *
 * Keeps the lock fresh while process is running
 */
export function startLockHeartbeat(): NodeJS.Timeout {
  return setInterval(() => {
    heartbeatLock();
  }, 30 * 1000); // Every 30 seconds
}

/**
 * Check if we currently hold the lock
 */
export function hasLock(): boolean {
  const existingLock = readLock();
  return existingLock !== null && existingLock.pid === process.pid;
}

/**
 * Get lock status for debugging
 */
export function getLockStatus(): {
  locked: boolean;
  owner?: { pid: number; startedAt: string; hostname: string };
  isOurs: boolean;
  isStale: boolean;
} {
  const lock = readLock();

  if (!lock) {
    return { locked: false, isOurs: false, isStale: false };
  }

  return {
    locked: true,
    owner: {
      pid: lock.pid,
      startedAt: lock.startedAt,
      hostname: lock.hostname,
    },
    isOurs: lock.pid === process.pid,
    isStale: isLockStale(lock),
  };
}

/**
 * Force release lock (use with caution!)
 *
 * Only use when you're sure the locking process is dead
 */
export function forceReleaseLock(): void {
  console.warn('[TelegramLock] Force releasing lock!');
  removeLock();
}

// Cleanup on process exit
process.on('exit', () => {
  if (hasLock()) {
    releaseLock();
  }
});

process.on('SIGINT', () => {
  if (hasLock()) {
    releaseLock();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (hasLock()) {
    releaseLock();
  }
  process.exit(0);
});
