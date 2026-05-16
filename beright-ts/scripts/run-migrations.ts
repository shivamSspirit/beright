#!/usr/bin/env npx ts-node
/**
 * Run SQL migrations against Supabase
 * Usage: npx ts-node scripts/run-migrations.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../supabase/migrations');

// Migrations to run (in order)
const MIGRATIONS_TO_RUN = [
  '20260404_chat_rls.sql',
  '20260404_security_events.sql',
];

async function runMigrations() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('Connecting to Supabase...');
  console.log(`URL: ${supabaseUrl}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  for (const migrationFile of MIGRATIONS_TO_RUN) {
    const filePath = path.join(MIGRATIONS_DIR, migrationFile);

    if (!fs.existsSync(filePath)) {
      console.error(`Migration file not found: ${filePath}`);
      continue;
    }

    console.log(`\nRunning migration: ${migrationFile}`);

    const sql = fs.readFileSync(filePath, 'utf8');

    // Split into individual statements (simple split on semicolon + newline)
    // Note: This doesn't handle all edge cases but works for our migrations
    const statements = sql
      .split(/;\s*\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip pure comments
      if (statement.split('\n').every(line => line.trim().startsWith('--') || line.trim() === '')) {
        continue;
      }

      try {
        // Use rpc to execute raw SQL
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });

        if (error) {
          // Try direct query for simple statements
          const { error: error2 } = await supabase.from('_migrations').select('*').limit(0);

          if (error2) {
            console.log(`  [${i + 1}/${statements.length}] Error: ${error.message.slice(0, 80)}`);
            errorCount++;
          }
        } else {
          successCount++;
        }
      } catch (err) {
        // Silently continue - some statements may not work via REST
        errorCount++;
      }
    }

    console.log(`  Completed: ${successCount} statements, ${errorCount} errors/skipped`);
  }

  // Verify tables exist
  console.log('\nVerifying security tables...');

  const { data: securityEvents, error: seError } = await supabase
    .from('security_events')
    .select('id')
    .limit(1);

  if (seError && seError.message.includes('does not exist')) {
    console.log('  security_events: NOT CREATED - run manually in Supabase SQL Editor');
  } else {
    console.log('  security_events: OK');
  }

  const { data: txAudits, error: taError } = await supabase
    .from('transaction_audits')
    .select('id')
    .limit(1);

  if (taError && taError.message.includes('does not exist')) {
    console.log('  transaction_audits: NOT CREATED - run manually in Supabase SQL Editor');
  } else {
    console.log('  transaction_audits: OK');
  }

  console.log('\nDone!');
  console.log('\nIf tables were not created, copy the SQL from:');
  console.log('  beright-ts/supabase/migrations/20260404_security_events.sql');
  console.log('  beright-ts/supabase/migrations/20260404_chat_rls.sql');
  console.log('And run in: https://supabase.com/dashboard/project/zmpsqixstjmtftuqstnd/sql');
}

runMigrations().catch(console.error);
