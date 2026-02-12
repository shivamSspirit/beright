// PM2 Ecosystem Configuration for BeRight
// Usage: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    // Main API Server (Next.js on port 3001)
    {
      name: 'beright-api',
      cwd: './beright-ts',
      script: 'npm',
      args: 'start',
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
      name: 'telegram-bot',
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

    // Heartbeat Agent (runs every 5 minutes)
    {
      name: 'heartbeat',
      cwd: './beright-ts',
      script: 'npx',
      args: 'ts-node skills/heartbeat.ts loop 300',
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

    // Builder Agent (autonomous development - optional)
    {
      name: 'builder',
      cwd: './beright-ts',
      script: 'npx',
      args: 'ts-node skills/buildLoop.ts loop 1800',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      restart_delay: 30000,
      max_restarts: 3,
      error_file: './logs/builder-error.log',
      out_file: './logs/builder-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },

    // Autonomous Orchestrator (optional - runs all autonomous services)
    {
      name: 'orchestrator',
      cwd: './beright-ts',
      script: 'npx',
      args: 'ts-node services/autonomousOrchestrator.ts start',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      restart_delay: 60000,
      max_restarts: 3,
      error_file: './logs/orchestrator-error.log',
      out_file: './logs/orchestrator-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
