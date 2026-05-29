#!/usr/bin/env npx ts-node
/**
 * xDegen Auto-Poster Startup Script
 *
 * Run this to start autonomous X/Twitter posting.
 *
 * Usage:
 *   npx ts-node agents/xdegen/start.ts
 *
 * Or with PM2:
 *   pm2 start agents/xdegen/start.ts --name xdegen
 */

import dotenv from 'dotenv';
import AutoPost from './autoPost';

// Load environment
dotenv.config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Posting frequency
  intervalMinutes: parseInt(process.env.XDEGEN_INTERVAL_MINUTES || '60'),

  // Quiet hours (don't post during these hours)
  quietHoursStart: parseInt(process.env.XDEGEN_QUIET_START || '2'),
  quietHoursEnd: parseInt(process.env.XDEGEN_QUIET_END || '7'),

  // Limits
  maxPostsPerDay: parseInt(process.env.XDEGEN_MAX_POSTS_DAY || '10'),

  // Content mix (adjust probabilities)
  contentMix: {
    arbitrage: 0.30,     // 30% arb alerts
    hotMarket: 0.25,     // 25% trending markets
    education: 0.15,     // 15% educational
    aiNarrative: 0.10,   // 10% AI agent narrative
    contrarian: 0.10,    // 10% hot takes
    breakingNews: 0.10,  // 10% breaking news
  },
};

// ============================================================================
// STARTUP
// ============================================================================

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ██╗  ██╗██████╗ ███████╗ ██████╗ ███████╗███╗   ██╗    ║
║   ╚██╗██╔╝██╔══██╗██╔════╝██╔════╝ ██╔════╝████╗  ██║    ║
║    ╚███╔╝ ██║  ██║█████╗  ██║  ███╗█████╗  ██╔██╗ ██║    ║
║    ██╔██╗ ██║  ██║██╔══╝  ██║   ██║██╔══╝  ██║╚██╗██║    ║
║   ██╔╝ ██╗██████╔╝███████╗╚██████╔╝███████╗██║ ╚████║    ║
║   ╚═╝  ╚═╝╚═════╝ ╚══════╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝    ║
║                                                           ║
║   Autonomous X/Twitter Posting for BeRight Protocol       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// Check Twitter API configuration
const hasTwitterApi = !!(
  process.env.TWITTER_API_KEY &&
  process.env.TWITTER_API_SECRET &&
  process.env.TWITTER_ACCESS_TOKEN &&
  process.env.TWITTER_ACCESS_SECRET
);

if (hasTwitterApi) {
  console.log('✅ Twitter API configured - LIVE POSTING ENABLED');
} else {
  console.log('⚠️  Twitter API not configured - SIMULATION MODE');
  console.log('   Set these env vars for live posting:');
  console.log('   - TWITTER_API_KEY');
  console.log('   - TWITTER_API_SECRET');
  console.log('   - TWITTER_ACCESS_TOKEN');
  console.log('   - TWITTER_ACCESS_SECRET');
}

console.log('\n📋 Configuration:');
console.log(`   Interval: Every ${CONFIG.intervalMinutes} minutes`);
console.log(`   Quiet hours: ${CONFIG.quietHoursStart}:00 - ${CONFIG.quietHoursEnd}:00`);
console.log(`   Max posts/day: ${CONFIG.maxPostsPerDay}`);
console.log(`   Content mix: ${Object.entries(CONFIG.contentMix).map(([k, v]) => `${k}:${Math.round(v * 100)}%`).join(', ')}`);

console.log('\n🚀 Starting autonomous posting...\n');

// Start the auto-poster
AutoPost.start(CONFIG);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down xDegen...');
  AutoPost.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Shutting down xDegen...');
  AutoPost.stop();
  process.exit(0);
});

// Keep alive
console.log('Press Ctrl+C to stop\n');
