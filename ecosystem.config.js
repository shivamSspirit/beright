/**
 * PM2 Ecosystem Configuration - Local Development
 *
 * Usage: pm2 start ecosystem.config.js
 *
 * For Railway deployment, see: beright-ts/RAILWAY.md
 * Railway uses: beright-ts/ecosystem.railway.config.cjs
 */

module.exports = {
  apps: [
    // Main API Server (Next.js on port 3001)
    {
      name: 'api',
      cwd: './beright-ts',
      script: 'npm',
      args: 'run start:local',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },

    // Telegram Bot (long-running)
    {
      name: 'telegram',
      cwd: './beright-ts',
      script: 'npx',
      args: 'ts-node skills/telegram.ts',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      restart_delay: 5000,
      max_restarts: 10,
      error_file: './logs/telegram-error.log',
      out_file: './logs/telegram-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },

    // Heartbeat Agent (cognitive loop - 30 min interval)
    {
      name: 'heartbeat',
      cwd: './beright-ts',
      script: 'npx',
      args: 'ts-node skills/heartbeat.ts loop 1800',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      restart_delay: 10000,
      max_restarts: 5,
      error_file: './logs/heartbeat-error.log',
      out_file: './logs/heartbeat-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
  ]
};
