/**
 * PM2 Ecosystem Configuration for Railway
 *
 * MEMORY-OPTIMIZED: Only runs essential API service
 * Total memory: ~400MB (fits in Railway starter plan)
 *
 * To enable additional services, upgrade Railway plan or
 * uncomment the services below.
 */

const path = require('path');

// Use Railway volume for persistent storage
const DATA_DIR = process.env.BERIGHT_STATE_DIR || '/data/state';
const LOGS_DIR = process.env.BERIGHT_LOGS_DIR || '/data/logs';
const MEMORY_DIR = process.env.BERIGHT_MEMORY_DIR || '/data/memory';

module.exports = {
  apps: [
    // ============================================
    // CORE API (Always run - required for web)
    // ============================================
    {
      name: 'api',
      script: 'npm',
      args: 'start',
      cwd: '/app',
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
    // OPTIONAL: Telegram Bot
    // Uncomment if you have enough memory (adds ~200MB)
    // ============================================
    // {
    //   name: 'telegram',
    //   script: 'npx',
    //   args: 'ts-node --transpile-only skills/telegram.ts',
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
    //   error_file: path.join(LOGS_DIR, 'telegram-error.log'),
    //   out_file: path.join(LOGS_DIR, 'telegram-out.log'),
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
