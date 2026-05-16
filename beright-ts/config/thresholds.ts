/**
 * Thresholds Configuration for BeRight Protocol
 * Trading limits, alert thresholds, and analysis parameters
 */

import { TradingConfig } from '../types';

// Arbitrage Detection
export const ARBITRAGE = {
  minSpread: 0.03,          // 3% minimum spread to report
  minVolume: 1000,          // $1K minimum volume to consider
  similarityThreshold: 0.35, // 35% minimum for market matching
  maxOpportunities: 10,      // Max opportunities to return
};

// Whale Tracking
export const WHALE = {
  minTradeUsd: 10000,           // $10K minimum to track
  highAccuracyThreshold: 0.7,   // 70% historical accuracy
  alertCooldownMinutes: 30,     // Don't re-alert same wallet within 30 min
};

// Trading Limits
export const TRADING: TradingConfig = {
  maxPositionUsd: 100,      // Max $100 per position
  maxPortfolioUsd: 500,     // Max $500 total
  defaultSlippage: 0.03,    // 3% default slippage
  maxSlippage: 0.10,        // 10% max slippage
  kellyMultiplier: 0.5,     // Half-Kelly for safety
  autoExecute: false,       // Require confirmation by default
};

// Research Analysis
export const RESEARCH = {
  minDataPoints: 3,         // Min data points for confidence
  bullishThreshold: 2,      // Bullish if bull_count > bear_count + 2
  bearishThreshold: 2,      // Bearish if bear_count > bull_count + 2
  maxArticles: 20,          // Max articles to analyze
};

// Heartbeat Intervals (milliseconds)
export const HEARTBEAT = {
  arbitrageScan: 5 * 60 * 1000,     // 5 minutes
  whaleScan: 15 * 60 * 1000,        // 15 minutes
  resolutionCheck: 60 * 60 * 1000,  // 1 hour
  morningBrief: '0 6 * * *',        // 6 AM daily (cron format)
};

// Sentiment Analysis Keywords
export const SENTIMENT = {
  bullish: ['surge', 'jump', 'rally', 'gain', 'rise', 'up', 'positive', 'win', 'success', 'breakthrough', 'soar'],
  bearish: ['fall', 'drop', 'crash', 'decline', 'loss', 'down', 'negative', 'fail', 'defeat', 'plunge', 'sink'],
};

// Stop words for text analysis
export const STOP_WORDS = new Set([
  'will', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'by', 'be', 'is', 'are',
  'was', 'were', 'before', 'after', 'this', 'that', 'has', 'have', 'had', 'do', 'does',
  'did', 'can', 'could', 'would', 'should', 'may', 'might', 'must', 'during', 'than',
]);
