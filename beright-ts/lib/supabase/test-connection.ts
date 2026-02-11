/**
 * Test Supabase Connection
 * Run: npx ts-node lib/supabase/test-connection.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testConnection() {
  console.log('🔌 Testing Supabase Connection...\n');

  // Test with anon key
  console.log('1️⃣ Testing with anon key...');
  const anonClient = createClient(supabaseUrl, supabaseKey);

  try {
    // Try to access the API
    const { data, error } = await anonClient.from('users').select('count').limit(1);
    if (error) {
      if (error.code === '42P01') {
        console.log('   ⚠️  Table "users" does not exist yet. Run schema.sql first.');
      } else {
        console.log('   ❌ Error:', error.message);
      }
    } else {
      console.log('   ✅ Anon client connected successfully!');
    }
  } catch (e: any) {
    console.log('   ❌ Connection failed:', e.message);
  }

  // Test with service role key
  console.log('\n2️⃣ Testing with service role key...');
  const adminClient = createClient(supabaseUrl, serviceKey);

  try {
    const { data, error } = await adminClient.from('users').select('count').limit(1);
    if (error) {
      if (error.code === '42P01') {
        console.log('   ⚠️  Table "users" does not exist yet. Run schema.sql first.');
        console.log('\n📋 NEXT STEP:');
        console.log('   Go to: https://supabase.com/dashboard/project/zmpsqixstjmtftuqstnd/sql');
        console.log('   Copy the contents of lib/supabase/schema.sql and run it.');
      } else {
        console.log('   ❌ Error:', error.message);
      }
    } else {
      console.log('   ✅ Service role client connected successfully!');
      console.log('   ✅ Tables exist and are accessible!');
    }
  } catch (e: any) {
    console.log('   ❌ Connection failed:', e.message);
  }

  // Show config
  console.log('\n📊 Configuration:');
  console.log('   URL:', supabaseUrl);
  console.log('   Anon Key:', supabaseKey.substring(0, 20) + '...');
  console.log('   Service Key:', serviceKey.substring(0, 20) + '...');
}

testConnection();
