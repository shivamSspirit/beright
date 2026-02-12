/**
 * BeRight Agent Runner
 *
 * ONE COMMAND TO RUN EVERYTHING:
 *   npm run agent
 *
 * This starts ALL autonomous systems:
 * - Telegram Bot (receives user commands) - SINGLE INSTANCE via lock
 * - Heartbeat (24/7 scanning & alerts)
 * - All sub-agents (Scout, Analyst, Trader, Builder)
 * - Cognitive Loop (self-learning)
 * - Notification Delivery (push alerts to users)
 *
 * ARCHITECTURE NOTES:
 * - Only Telegram bot POLLS for messages (requires lock)
 * - Heartbeat SENDS messages via API (no polling, no conflict)
 * - Other agents SEND via notification service (no polling)
 *
 * This separation of concerns prevents the Telegram "Conflict" error.
 */

import 'dotenv/config';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { getLockStatus, forceReleaseLock } from '../lib/telegramLock';

// Configuration
const HEARTBEAT_INTERVAL = 300; // 5 minutes in seconds

// Track running processes
const processes: Map<string, ChildProcess> = new Map();

// Track which processes should NOT auto-restart (e.g., if lock conflict)
const noAutoRestart = new Set<string>();

/**
 * Start a subprocess
 */
function startProcess(name: string, command: string, args: string[]): ChildProcess {
  console.log(`[AgentRunner] Starting ${name}...`);

  const proc = spawn(command, args, {
    cwd: path.join(__dirname, '..'),
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  proc.stdout?.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line: string) => {
      console.log(`[${name}] ${line}`);
    });
  });

  proc.stderr?.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line: string) => {
      // Check for lock conflict error - don't auto-restart in this case
      if (line.includes('TELEGRAM BOT ALREADY RUNNING') || line.includes('Lock held by')) {
        noAutoRestart.add(name);
      }
      console.error(`[${name}] ${line}`);
    });
  });

  proc.on('exit', (code) => {
    console.log(`[AgentRunner] ${name} exited with code ${code}`);
    processes.delete(name);

    // Don't auto-restart if lock conflict or clean exit
    if (noAutoRestart.has(name)) {
      console.log(`[AgentRunner] ${name} not restarting (lock conflict or intentional stop)`);
      noAutoRestart.delete(name);
      return;
    }

    // Auto-restart if unexpected exit
    if (code !== 0 && code !== null) {
      console.log(`[AgentRunner] Restarting ${name} in 5 seconds...`);
      setTimeout(() => {
        // For Telegram, check lock status before restarting
        if (name === 'Telegram') {
          const lockStatus = getLockStatus();
          if (lockStatus.locked && !lockStatus.isStale) {
            console.log(`[AgentRunner] Telegram lock still held, skipping restart`);
            return;
          }
        }
        const newProc = startProcess(name, command, args);
        processes.set(name, newProc);
      }, 5000);
    }
  });

  processes.set(name, proc);
  return proc;
}

/**
 * Graceful shutdown
 */
function shutdown() {
  console.log('\n[AgentRunner] Shutting down all agents...');

  for (const [name, proc] of processes) {
    console.log(`[AgentRunner] Stopping ${name}...`);
    proc.kill('SIGTERM');
  }

  setTimeout(() => {
    console.log('[AgentRunner] Shutdown complete');
    process.exit(0);
  }, 2000);
}

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

/**
 * Main entry point
 */
async function main() {
  // Check for command line arguments
  if (process.argv.includes('--force-unlock')) {
    console.log('[AgentRunner] Force unlocking Telegram bot...');
    forceReleaseLock();
    console.log('[AgentRunner] Lock cleared.');
    return;
  }

  console.log(`
════════════════════════════════════════════════════════════
     BERIGHT AUTONOMOUS AGENT SYSTEM
════════════════════════════════════════════════════════════

  Starting all agents with ONE command...

  COMPONENTS:
  ├── Telegram Bot     - Receive user commands (SINGLE INSTANCE)
  ├── Heartbeat        - 24/7 autonomous scanning (SENDS alerts)
  ├── Scout Agent      - Fast market scanning
  ├── Analyst Agent    - Deep research
  ├── Trader Agent     - Trade execution
  ├── Builder Agent    - Self-improvement
  └── Cognitive Loop   - Self-learning system

  SEPARATION OF CONCERNS:
  ├── Telegram Bot POLLS for incoming messages (locked)
  ├── Heartbeat SENDS alerts via Telegram API (no poll)
  └── Other agents SEND via notification service (no poll)

  This prevents "Conflict: terminated by other getUpdates request"

════════════════════════════════════════════════════════════
`);

  // Check required env vars
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('[AgentRunner] ERROR: TELEGRAM_BOT_TOKEN not set in .env');
    console.error('[AgentRunner] The Telegram bot will not start.');
    console.error('[AgentRunner] Continuing with heartbeat only...\n');
  }

  // Start Telegram Bot - with lock check
  if (process.env.TELEGRAM_BOT_TOKEN) {
    // Check if another instance is already running
    const lockStatus = getLockStatus();
    if (lockStatus.locked && !lockStatus.isStale) {
      console.log(`[AgentRunner] WARNING: Telegram bot already running (PID: ${lockStatus.owner?.pid})`);
      console.log(`[AgentRunner] Will NOT start another instance to avoid conflicts.`);
      console.log(`[AgentRunner] Use --force-unlock if the lock is stale.\n`);
    } else {
      if (lockStatus.locked && lockStatus.isStale) {
        console.log(`[AgentRunner] Found stale Telegram lock, clearing...`);
        forceReleaseLock();
      }
      startProcess('Telegram', 'npx', ['ts-node', 'skills/telegram.ts']);
      // Wait for telegram to initialize
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Start Heartbeat (autonomous scanning)
  // Heartbeat uses sendTelegramMessage() which does NOT poll - it just sends
  // This is the key separation of concerns: poll vs send
  startProcess('Heartbeat', 'npx', ['ts-node', 'skills/heartbeat.ts', 'loop', String(HEARTBEAT_INTERVAL)]);

  console.log(`
════════════════════════════════════════════════════════════
  ALL AGENTS RUNNING!

  Users can now:
  • Send commands via Telegram
  • Receive automatic alerts
  • Get arbitrage opportunities pushed to them

  Press Ctrl+C to stop all agents
════════════════════════════════════════════════════════════
`);

  // Keep process alive
  setInterval(() => {
    const runningCount = processes.size;
    const timestamp = new Date().toISOString().slice(11, 19);
    console.log(`[AgentRunner] [${timestamp}] ${runningCount} agents running`);
  }, 60000); // Log every minute
}

// Run
main().catch(err => {
  console.error('[AgentRunner] Fatal error:', err);
  process.exit(1);
});
