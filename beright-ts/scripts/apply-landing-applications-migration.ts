#!/usr/bin/env npx ts-node
/**
 * Apply the landing_applications Supabase table migration.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run db:landing-applications
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

[
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'beright-ts/.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../beright-ts/.env'),
].forEach((envPath) => {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }
});

interface MigrationDatabase {
  public: {
    Tables: {
      landing_applications: {
        Row: { id: string };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      exec_sql: {
        Args: {
          sql?: string;
          sql_query?: string;
        };
        Returns: unknown;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

type MigrationClient = ReturnType<typeof createClient<MigrationDatabase>>;

const MIGRATION_FILE = path.join(
  __dirname,
  '../supabase/migrations/20260508_landing_applications.sql'
);

async function executeSql(
  supabase: MigrationClient,
  sql: string
): Promise<{ ok: boolean; message?: string }> {
  const firstAttempt = await supabase.rpc('exec_sql', { sql_query: sql });
  if (!firstAttempt.error) return { ok: true };

  const secondAttempt = await supabase.rpc('exec_sql', { sql });
  if (!secondAttempt.error) return { ok: true };

  return {
    ok: false,
    message: `${firstAttempt.error.message}; ${secondAttempt.error.message}`,
  };
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const supabase = createClient<MigrationDatabase>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  console.log('Applying landing_applications migration...');
  const result = await executeSql(supabase, sql);

  if (!result.ok) {
    console.error('Migration RPC failed.');
    console.error(result.message);
    console.error(`Run this SQL manually in Supabase SQL Editor: ${MIGRATION_FILE}`);
    process.exit(1);
  }

  const { error } = await supabase
    .from('landing_applications')
    .select('id')
    .limit(1);

  if (error && error.message.includes('does not exist')) {
    console.error('landing_applications table was not created.');
    process.exit(1);
  }

  if (error) {
    console.warn(`Table verification warning: ${error.message}`);
  } else {
    console.log('landing_applications table is ready.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
