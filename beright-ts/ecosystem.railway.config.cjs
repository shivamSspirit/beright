/**
 * PM2 Ecosystem Configuration for Railway
 *
 * Optimized for Railway deployment with persistent volume at /data
 *
 * Services:
 * - Next.js API (port 8080 - required by Railway)
 * - Telegram Bot
 * - Heartbeat Agent (30-min cognitive loop)
 * - Scanner (optional - market opportunity detection)
 * - AutoPredict (optional - continuous forecasting)
 */

const path = require('path');

// Use Railway volume for persistent storage
const DATA_DIR = process.env.BERIGHT_STATE_DIR || '/data/state';
const LOGS_DIR = process.env.BERIGHT_LOGS_DIR || '/data/logs';
const MEMORY_DIR = process.env.BERIGHT_MEMORY_DIR || '/data/memory';

module.exports = {
  apps: [
    // ============================================
    // CORE SERVICES (Always run)
    // ============================================

    // Main API Server (Next.js on port 8080 for Railway)
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
      max_memory_restart: '512M',
      error_file: path.join(LOGS_DIR, 'api-error.log'),
      out_file: path.join(LOGS_DIR, 'api-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // API is critical - restart fast
      restart_delay: 1000,
      max_restarts: 20,
    },

    // Telegram Bot (long-running)
    {
      name: 'telegram',
      script: 'npx',
      args: 'ts-node --transpile-only skills/telegram.ts',
      cwd: '/app',
      env: {
        NODE_ENV: 'production',
        TS_NODE_TRANSPILE_ONLY: 'true',
        MEMORY_DIR: MEMORY_DIR,
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      error_file: path.join(LOGS_DIR, 'telegram-error.log'),
      out_file: path.join(LOGS_DIR, 'telegram-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      restart_delay: 5000,
      max_restarts: 10,
    },

    // Heartbeat Agent (cognitive loop every 30 min)
    {
      name: 'heartbeat',
      script: 'npx',
      args: 'ts-node --transpile-only skills/heartbeat.ts loop 1800',
      cwd: '/app',
      env: {
        NODE_ENV: 'production',
        TS_NODE_TRANSPILE_ONLY: 'true',
        MEMORY_DIR: MEMORY_DIR,
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      error_file: path.join(LOGS_DIR, 'heartbeat-error.log'),
      out_file: path.join(LOGS_DIR, 'heartbeat-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      restart_delay: 10000,
      max_restarts: 5,
    },

    // ============================================
    // OPTIONAL SERVICES (Enable as needed)
    // ============================================

    // Autonomous Scanner (market opportunity detection)
    // Uncomment to enable
    // {
    //   name: 'scanner',
    //   script: 'npx',
    //   args: 'ts-node --transpile-only services/autonomousScanner.ts daemon',
    //   cwd: '/app',
    //   env: {
    //     NODE_ENV: 'production',
    //     TS_NODE_TRANSPILE_ONLY: 'true',
    //   },
    //   instances: 1,
    //   exec_mode: 'fork',
    //   autorestart: true,
    //   watch: false,
    //   max_memory_restart: '256M',
    //   error_file: path.join(LOGS_DIR, 'scanner-error.log'),
    //   out_file: path.join(LOGS_DIR, 'scanner-out.log'),
    //   log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    //   restart_delay: 30000,
    //   max_restarts: 5,
    // },

    // AutoPredict Engine (continuous forecasting)
    // Uncomment to enable
    // {
    //   name: 'autopredict',
    //   script: 'npx',
    //   args: 'ts-node --transpile-only services/autoPredictionEngine.ts start',
    //   cwd: '/app',
    //   env: {
    //     NODE_ENV: 'production',
    //     TS_NODE_TRANSPILE_ONLY: 'true',
    //   },
    //   instances: 1,
    //   exec_mode: 'fork',
    //   autorestart: true,
    //   watch: false,
    //   max_memory_restart: '256M',
    //   error_file: path.join(LOGS_DIR, 'autopredict-error.log'),
    //   out_file: path.join(LOGS_DIR, 'autopredict-out.log'),
    //   log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    //   restart_delay: 60000,
    //   max_restarts: 3,
    // },

    // Autonomous Trader
    // Uncomment to enable (requires SOLANA_PRIVATE_KEY)
    // {
    //   name: 'trader',
    //   script: 'npx',
    //   args: 'ts-node --transpile-only services/autonomousTrader.ts',
    //   cwd: '/app',
    //   env: {
    //     NODE_ENV: 'production',
    //     TS_NODE_TRANSPILE_ONLY: 'true',
    //   },
    //   instances: 1,
    //   exec_mode: 'fork',
    //   autorestart: true,
    //   watch: false,
    //   max_memory_restart: '384M',
    //   error_file: path.join(LOGS_DIR, 'trader-error.log'),
    //   out_file: path.join(LOGS_DIR, 'trader-out.log'),
    //   log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    //   restart_delay: 10000,
    //   max_restarts: 10,
    // },
  ],
};
