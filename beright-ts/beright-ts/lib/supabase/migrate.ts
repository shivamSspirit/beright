/**
 * Supabase Migration Utility
 * 
 * Run this script to initialize the database schema:
 *   npx ts-node lib/supabase/migrate.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { supabaseAdmin } from './client';

async function migrate() {
  console.log('Starting Supabase migration...');

  try {
    // Read schema.sql
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    console.log('Executing schema.sql...');
    
    // Split SQL statements (basic splitting by semicolons)
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;

      try {
        // Use rpc or raw SQL execution
        const { error } = await supabaseAdmin.rpc('exec', { sql: statement });
        
        if (error) {
          console.error(`Statement ${i + 1} failed:`, error.message);
        } else {
          console.log(`✓ Statement ${i + 1} executed`);
        }
      } catch (err) {
        console.error(`Statement ${i + 1} error:`, err);
      }
    }

    console.log('\n✓ Migration completed!');
    console.log('\nNext steps:');
    console.log('1. Verify tables exist: npx ts-node lib/supabase/test-connection.ts');
    console.log('2. Update RLS policies in Supabase dashboard if needed');
    console.log('3. Enable Realtime for beright_events table in Supabase dashboard');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Alternative: Manual migration instructions
function printManualInstructions() {
  console.log('\n='.repeat(60));
  console.log('MANUAL MIGRATION INSTRUCTIONS');
  console.log('='.repeat(60));
  console.log('\nIf automatic migration fails, follow these steps:\n');
  console.log('1. Open your Supabase project dashboard');
  console.log('2. Go to SQL Editor');
  console.log('3. Copy the contents of beright-ts/lib/supabase/schema.sql');
  console.log('4. Paste and execute in the SQL Editor');
  console.log('5. Go to Database > Replication');
  console.log('6. Enable realtime for the "beright_events" table');
  console.log('\n' + '='.repeat(60) + '\n');
}

if (require.main === module) {
  printManualInstructions();
  console.log('\nAttempting automatic migration...\n');
  migrate().catch(console.error);
}

export { migrate };
