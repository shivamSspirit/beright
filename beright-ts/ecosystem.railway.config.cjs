/**
 * PM2 Ecosystem Configuration for Railway
 *
 * MEMORY-OPTIMIZED: Only runs essential API service
 * Total memory: ~400MB (fits in Railway starter plan)
 *
 * To enable additional services, upgrade Railway plan or
 * uncomment the services below.
 */

const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
  } catch {
    return null;
  }
}

// Prefer Railway volume if mounted; fall back to /tmp so PM2 can always write logs.
const FALLBACK_BASE = '/tmp/beright';
const DATA_DIR =
  ensureDir(process.env.BERIGHT_STATE_DIR || '/data/state')
  || ensureDir(path.join(FALLBACK_BASE, 'state'))
  || '/tmp';
const LOGS_DIR =
  ensureDir(process.env.BERIGHT_LOGS_DIR || '/data/logs')
  || ensureDir(path.join(FALLBACK_BASE, 'logs'))
  || '/tmp';
const MEMORY_DIR =
  ensureDir(process.env.BERIGHT_MEMORY_DIR || '/data/memory')
  || ensureDir(path.join(FALLBACK_BASE, 'memory'))
  || '/tmp';

module.exports = {
  apps: [
    // ============================================
    // CORE API (Always run - required for web)
    // ============================================
    {
      name: 'api',
      script: 'npm',
      args: 'start',
      cwd: '/app/beright-ts',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 8080,
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      error_file: path.join(LOGS_DIR, 'api-error.log'),
      out_file: path.join(LOGS_DIR, 'api-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      restart_delay: 1000,
      max_restarts: 20,
    },

    // ============================================
    // OPTIONAL: OpenClaw Gateway
    // Uncomment if you have enough memory (adds ~200MB)
    // ============================================
    // {
    //   name: 'openclaw-gateway',
    //   script: 'openclaw',
    //   args: 'gateway',
    //   cwd: '/app',
    //   env: {
    //     NODE_ENV: 'production',
    //     MEMORY_DIR: MEMORY_DIR,
    //   },
    //   instances: 1,
    //   exec_mode: 'fork',
    //   autorestart: true,
    //   watch: false,
    //   max_memory_restart: '200M',
    //   error_file: path.join(LOGS_DIR, 'openclaw-gateway-error.log'),
    //   out_file: path.join(LOGS_DIR, 'openclaw-gateway-out.log'),
    //   log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    //   restart_delay: 5000,
    //   max_restarts: 10,
    // },

    // ============================================
    // OPTIONAL: Heartbeat Agent
    // Uncomment if you have enough memory (adds ~200MB)
    // ============================================
    // {
    //   name: 'heartbeat',
    //   script: 'npx',
    //   args: 'ts-node --transpile-only skills/heartbeat.ts loop 1800',
    //   cwd: '/app',
    //   env: {
    //     NODE_ENV: 'production',
    //     TS_NODE_TRANSPILE_ONLY: 'true',
    //     MEMORY_DIR: MEMORY_DIR,
    //   },
    //   instances: 1,
    //   exec_mode: 'fork',
    //   autorestart: true,
    //   watch: false,
    //   max_memory_restart: '200M',
    //   error_file: path.join(LOGS_DIR, 'heartbeat-error.log'),
    //   out_file: path.join(LOGS_DIR, 'heartbeat-out.log'),
    //   log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    //   restart_delay: 10000,
    //   max_restarts: 5,
    // },
  ],
};
