/**
 * PM2 Ecosystem Configuration - Local Development
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 status
 *   pm2 logs
 *   pm2 stop all
 *
 * For Railway deployment, use: ecosystem.railway.config.cjs
 * See: RAILWAY.md for deployment guide
 */

const path = require('path');

module.exports = {
  apps: [
    // API Server (Next.js dev mode)
    {
      name: 'api',
      script: 'npm',
      args: 'run dev',
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: path.join(__dirname, 'logs/api-error.log'),
      out_file: path.join(__dirname, 'logs/api-out.log'),
      merge_logs: true,
      max_memory_restart: '512M',
    },

    // Telegram Bot
    {
      name: 'telegram',
      script: 'npx',
      args: 'ts-node skills/telegram.ts',
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'development',
      },
      error_file: path.join(__dirname, 'logs/telegram-error.log'),
      out_file: path.join(__dirname, 'logs/telegram-out.log'),
      merge_logs: true,
      max_memory_restart: '256M',
    },

    // Heartbeat (cognitive loop)
    {
      name: 'heartbeat',
      script: 'npx',
      args: 'ts-node skills/heartbeat.ts loop 1800',
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 10000,
      env: {
        NODE_ENV: 'development',
      },
      error_file: path.join(__dirname, 'logs/heartbeat-error.log'),
      out_file: path.join(__dirname, 'logs/heartbeat-out.log'),
      merge_logs: true,
      max_memory_restart: '256M',
    },
  ],
};
