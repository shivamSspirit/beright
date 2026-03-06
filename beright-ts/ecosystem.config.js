/**
 * PM2 Ecosystem Configuration - Local Development
 *
 * Run with: pm2 start ecosystem.config.js
 * Monitor with: pm2 monit
 * Logs: pm2 logs
 * Stop all: pm2 stop all
 *
 * Individual services:
 *   pm2 start ecosystem.config.js --only telegram-bot
 *   pm2 start ecosystem.config.js --only gateway
 */

module.exports = {
  apps: [
    {
      name: 'gateway',
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
      error_file: 'logs/gateway-error.log',
      out_file: 'logs/gateway-out.log',
      merge_logs: true,
      max_memory_restart: '512M',
      kill_timeout: 10000,
    },
    {
      name: 'telegram-bot',
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
      error_file: 'logs/telegram-error.log',
      out_file: 'logs/telegram-out.log',
      merge_logs: true,
      max_memory_restart: '300M',
    },
  ],
};
