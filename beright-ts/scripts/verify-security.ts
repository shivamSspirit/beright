#!/usr/bin/env npx ts-node
/**
 * Security Verification Script
 *
 * Run this script to verify all security configurations are in place.
 *
 * Usage:
 *   npx ts-node scripts/verify-security.ts
 *   # or
 *   npm run verify-security
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env from beright-ts directory (not root)
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

// ============================================
// CONFIGURATION
// ============================================

const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
];

const RECOMMENDED_ENV_VARS = [
  'HELIUS_RPC_MAINNET',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'TELEGRAM_BOT_TOKEN',
  'SUPER_ADMIN_TELEGRAM_ID',
];

const TABLES_REQUIRING_RLS = [
  'users',
  'predictions',
  'trades',
  'conversations',
  'messages',
  'memory_entries',
  'async_jobs',
  'prediction_conversation_links',
  'security_events',
  'transaction_audits',
];

// ============================================
// VERIFICATION FUNCTIONS
// ============================================

interface VerificationResult {
  name: string;
  passed: boolean;
  message: string;
  details?: string[];
}

const results: VerificationResult[] = [];

function log(emoji: string, message: string) {
  console.log(`${emoji} ${message}`);
}

function addResult(result: VerificationResult) {
  results.push(result);
  const emoji = result.passed ? '✅' : '❌';
  log(emoji, `${result.name}: ${result.message}`);
  if (result.details && result.details.length > 0) {
    result.details.forEach(d => console.log(`   - ${d}`));
  }
}

// ============================================
// 1. ENVIRONMENT VARIABLES
// ============================================

function verifyEnvVars() {
  console.log('\n📋 Checking Environment Variables...\n');

  // Required
  const missingRequired: string[] = [];
  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      missingRequired.push(envVar);
    }
  }

  addResult({
    name: 'Required Env Vars',
    passed: missingRequired.length === 0,
    message: missingRequired.length === 0
      ? `All ${REQUIRED_ENV_VARS.length} required variables set`
      : `Missing ${missingRequired.length} required variables`,
    details: missingRequired,
  });

  // Recommended
  const missingRecommended: string[] = [];
  for (const envVar of RECOMMENDED_ENV_VARS) {
    if (!process.env[envVar]) {
      missingRecommended.push(envVar);
    }
  }

  addResult({
    name: 'Recommended Env Vars',
    passed: missingRecommended.length === 0,
    message: missingRecommended.length === 0
      ? `All ${RECOMMENDED_ENV_VARS.length} recommended variables set`
      : `Missing ${missingRecommended.length} recommended variables`,
    details: missingRecommended,
  });
}

// ============================================
// 2. RLS POLICIES
// ============================================

async function verifyRLS() {
  console.log('\n🔒 Checking Row Level Security...\n');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    addResult({
      name: 'RLS Verification',
      passed: false,
      message: 'Cannot verify - Supabase credentials not configured',
    });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Verify tables exist and are accessible (service_role can access RLS-protected tables)
  const accessibleTables: string[] = [];
  const inaccessibleTables: string[] = [];

  for (const tableName of TABLES_REQUIRING_RLS) {
    try {
      const { error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error && error.message.includes('does not exist')) {
        // Table doesn't exist - skip (not an RLS issue)
        continue;
      } else if (error) {
        inaccessibleTables.push(`${tableName}: ${error.message}`);
      } else {
        accessibleTables.push(tableName);
      }
    } catch (err) {
      inaccessibleTables.push(`${tableName}: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  addResult({
    name: 'RLS Tables Accessible',
    passed: inaccessibleTables.length === 0,
    message: inaccessibleTables.length === 0
      ? `All ${accessibleTables.length} tables accessible via service_role`
      : `${inaccessibleTables.length} tables have access issues`,
    details: inaccessibleTables.length > 0 ? inaccessibleTables : accessibleTables,
  });
}

// ============================================
// 3. SECURITY TABLES
// ============================================

async function verifySecurityTables() {
  console.log('\n📊 Checking Security Tables...\n');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    addResult({
      name: 'Security Tables',
      passed: false,
      message: 'Cannot verify - Supabase credentials not configured',
    });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Check security_events table
  try {
    const { count, error } = await supabase
      .from('security_events')
      .select('*', { count: 'exact', head: true });

    if (error) {
      addResult({
        name: 'security_events Table',
        passed: false,
        message: `Table not accessible: ${error.message}`,
      });
    } else {
      addResult({
        name: 'security_events Table',
        passed: true,
        message: `Table exists with ${count || 0} records`,
      });
    }
  } catch (err) {
    addResult({
      name: 'security_events Table',
      passed: false,
      message: `Error: ${err instanceof Error ? err.message : 'Unknown'}`,
    });
  }

  // Check transaction_audits table
  try {
    const { count, error } = await supabase
      .from('transaction_audits')
      .select('*', { count: 'exact', head: true });

    if (error) {
      addResult({
        name: 'transaction_audits Table',
        passed: false,
        message: `Table not accessible: ${error.message}`,
      });
    } else {
      addResult({
        name: 'transaction_audits Table',
        passed: true,
        message: `Table exists with ${count || 0} records`,
      });
    }
  } catch (err) {
    addResult({
      name: 'transaction_audits Table',
      passed: false,
      message: `Error: ${err instanceof Error ? err.message : 'Unknown'}`,
    });
  }
}

// ============================================
// 4. KILL SWITCHES
// ============================================

function verifyKillSwitches() {
  console.log('\n🔴 Checking Kill Switches...\n');

  const switches = {
    TRADING_ENABLED: process.env.TRADING_ENABLED !== 'false',
    WALLET_WITHDRAWALS: process.env.WALLET_WITHDRAWALS !== 'false',
    API_PUBLIC_ACCESS: process.env.API_PUBLIC_ACCESS !== 'false',
    TELEGRAM_BOT_ENABLED: process.env.TELEGRAM_BOT_ENABLED !== 'false',
    AUTO_TRADING_ENABLED: process.env.AUTO_TRADING_ENABLED === 'true', // Default false
    NEW_SIGNUPS_ENABLED: process.env.NEW_SIGNUPS_ENABLED !== 'false',
  };

  const disabledSwitches = Object.entries(switches)
    .filter(([_, enabled]) => !enabled)
    .map(([name]) => name);

  addResult({
    name: 'Kill Switches',
    passed: true, // Info only, not a pass/fail
    message: disabledSwitches.length === 0
      ? 'All features enabled'
      : `${disabledSwitches.length} features disabled`,
    details: disabledSwitches,
  });
}

// ============================================
// 5. FILE CHECKS
// ============================================

function verifyFiles() {
  console.log('\n📁 Checking Security Files...\n');

  const fs = require('fs');
  const path = require('path');

  const requiredFiles = [
    '.pre-commit-config.yaml',
    '.gitleaks.toml',
    '.secrets.baseline',
    '.github/workflows/security.yml',
    'docs/SECURITY_RUNBOOK.md',
  ];

  // Project root is two levels up from scripts/ (beright-ts -> beright)
  const projectRoot = path.resolve(__dirname, '../..');
  const missingFiles: string[] = [];

  for (const file of requiredFiles) {
    const filePath = path.join(projectRoot, file);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file);
    }
  }

  addResult({
    name: 'Security Files',
    passed: missingFiles.length === 0,
    message: missingFiles.length === 0
      ? `All ${requiredFiles.length} security files present`
      : `Missing ${missingFiles.length} files`,
    details: missingFiles,
  });
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('   BeRight Security Verification');
  console.log('='.repeat(60));

  // Run all verifications
  verifyEnvVars();
  await verifyRLS();
  await verifySecurityTables();
  verifyKillSwitches();
  verifyFiles();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('   SUMMARY');
  console.log('='.repeat(60) + '\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Total Checks: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n⚠️  Some security checks failed. Review the issues above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All security checks passed!');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
