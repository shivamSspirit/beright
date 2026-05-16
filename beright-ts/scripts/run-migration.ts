/**
 * Run Supabase migrations via the service role client
 * Usage: npx tsx scripts/run-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  // Read the RLS migration file
  const migrationPath = path.join(__dirname, '../supabase/migrations/20250317_rls_policies.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Running RLS migration...');
  console.log('SQL length:', sql.length, 'characters');

  // Execute the SQL
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    // Try splitting into individual statements if bulk fails
    console.log('Bulk execution failed, trying statement by statement...');

    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let succeeded = 0;
    let failed = 0;

    for (const statement of statements) {
      const { error: stmtError } = await supabase.rpc('exec_sql', {
        sql_query: statement + ';'
      });

      if (stmtError) {
        console.error('Failed:', statement.substring(0, 60) + '...');
        console.error('Error:', stmtError.message);
        failed++;
      } else {
        succeeded++;
      }
    }

    console.log(`Results: ${succeeded} succeeded, ${failed} failed`);
  } else {
    console.log('Migration completed successfully!');
  }
}

runMigration().catch(console.error);
