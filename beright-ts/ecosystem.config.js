/**
 * PM2 Ecosystem Configuration
 *
 * Run with: pm2 start ecosystem.config.js
 * Monitor with: pm2 monit
 * Logs: pm2 logs autonomous-trader
 * Stop: pm2 stop autonomous-trader
 *
 * Deploy from local:
 *   pm2 deploy ecosystem.config.js production setup  (first time)
 *   pm2 deploy ecosystem.config.js production        (subsequent deploys)
 */

module.exports = {
  apps: [
    {
      name: 'autonomous-trader',
      script: 'npx',
      args: 'ts-node services/autonomousTrader.ts',
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
      },
      // Log configuration
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/trader-error.log',
      out_file: 'logs/trader-out.log',
      merge_logs: true,
      // Memory limit - restart if exceeds 500MB
      max_memory_restart: '500M',
      // Graceful shutdown
      kill_timeout: 10000,
      wait_ready: true,
      listen_timeout: 5000,
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
        NODE_ENV: 'production',
      },
      error_file: 'logs/telegram-error.log',
      out_file: 'logs/telegram-out.log',
      merge_logs: true,
      max_memory_restart: '300M',
    },
  ],

  // Deployment Configuration
  deploy: {
    production: {
      // SSH user@host
      user: 'ubuntu',
      host: process.env.EC2_HOST || 'your-ec2-ip',
      ref: 'origin/main',
      repo: process.env.GIT_REPO || 'git@github.com:your-username/beright.git',
      path: '/home/ubuntu/beright',
      'pre-deploy-local': '',
      'post-deploy': 'cd beright-ts && npm install && pm2 reload ecosystem.config.js && pm2 save',
      'pre-setup': '',
      env: {
        NODE_ENV: 'production',
      },
    },
  },
};
