/**
 * Test Supabase Database
 * Run: npx ts-node lib/supabase/test-db.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  console.log('🔌 Testing Supabase...\n');

  // Check tables
  const tables = ['users', 'predictions', 'watchlist', 'alerts'];
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log('❌', table, '-', error.message);
    } else {
      console.log('✅', table, '- ready (', count, 'rows)');
    }
  }

  // Create test user
  console.log('\n📝 Creating test user...');
  const { data: user, error: userErr } = await supabase
    .from('users')
    .upsert({
      telegram_id: 5504043269,
      telegram_username: 'shivamSspirit',
      username: 'shivam'
    }, { onConflict: 'telegram_id' })
    .select()
    .single();

  if (userErr) {
    console.log('❌ User error:', userErr.message);
  } else {
    console.log('✅ User created:', user.id);

    // Create test prediction
    console.log('\n📊 Creating test prediction...');
    const { data: pred, error: predErr } = await supabase
      .from('predictions')
      .insert({
        user_id: user.id,
        question: 'Will BTC hit 100k by end of 2026?',
        platform: 'polymarket',
        predicted_probability: 0.72,
        direction: 'YES',
        confidence: 'high',
        reasoning: 'ETF flows + halving cycle'
      })
      .select()
      .single();

    if (predErr) {
      console.log('❌ Prediction error:', predErr.message);
    } else {
      console.log('✅ Prediction created:', pred.id);
    }
  }

  // Check leaderboard
  console.log('\n🏆 Checking leaderboard...');
  const { data: lb, error: lbErr } = await supabase.from('leaderboard').select('*').limit(5);
  if (lbErr) {
    console.log('❌ Leaderboard error:', lbErr.message);
  } else {
    console.log('✅ Leaderboard working:', lb.length, 'entries');
    if (lb.length > 0) {
      console.log('   Top user:', lb[0].username || lb[0].telegram_username);
    }
  }

  console.log('\n🎉 Database ready!');
}

test().catch(console.error);
