/**
 * Test if database setup is complete for memory search
 */

import { createClient } from '@supabase/supabase-js';

async function testSetup() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Testing database setup...\n');

  // Test 1: Check if memory_entries table exists
  const { data: tableData, error: tableError } = await supabase
    .from('memory_entries')
    .select('id')
    .limit(1);

  if (tableError) {
    console.log('❌ memory_entries table:', tableError.message);
  } else {
    console.log('✅ memory_entries table exists');
  }

  // Test 2: Check if embedding column exists by selecting it
  const { data: embData, error: embError } = await supabase
    .from('memory_entries')
    .select('embedding')
    .limit(1);

  if (embError && embError.message.includes('embedding')) {
    console.log('❌ embedding column: not found (run enable-memory-search.sql)');
  } else if (embError) {
    console.log('⚠️ embedding column:', embError.message);
  } else {
    console.log('✅ embedding column exists');
  }

  // Test 3: Check if match_memories RPC exists
  const testEmbedding = Array(1024).fill(0);
  const { error: rpcError } = await supabase.rpc('match_memories', {
    query_embedding: testEmbedding,
    match_wallet: 'test-wallet',
    match_threshold: 0.5,
    match_count: 1,
    filter_types: null,
    include_expired: false,
  });

  if (rpcError) {
    if (rpcError.message.includes('does not exist')) {
      console.log('❌ match_memories RPC: not found (run enable-memory-search.sql)');
    } else if (rpcError.message.includes('vector')) {
      console.log('❌ pgvector extension: not enabled (run enable-memory-search.sql)');
    } else {
      console.log('⚠️ match_memories RPC:', rpcError.message);
    }
  } else {
    console.log('✅ match_memories RPC exists');
  }

  // Test 4: Check conversations table
  const { error: convError } = await supabase
    .from('conversations')
    .select('id')
    .limit(1);

  if (convError) {
    console.log('❌ conversations table:', convError.message);
  } else {
    console.log('✅ conversations table exists');
  }

  // Test 5: Check messages table
  const { error: msgError } = await supabase
    .from('messages')
    .select('id')
    .limit(1);

  if (msgError) {
    console.log('❌ messages table:', msgError.message);
  } else {
    console.log('✅ messages table exists');
  }

  console.log('\n--- Summary ---');
  const issues = [tableError, embError, rpcError, convError, msgError].filter(Boolean);
  if (issues.length === 0) {
    console.log('All checks passed! Database is ready.');
  } else {
    console.log(`${issues.length} issue(s) found. Run the SQL scripts in Supabase Dashboard.`);
  }
}

testSetup().catch(console.error);
