import { supabaseAdmin, isSupabaseConfigured } from './lib/supabase/client';

async function test() {
  console.log('Supabase configured:', isSupabaseConfigured);
  
  if (!isSupabaseConfigured) {
    console.log('Supabase not configured!');
    return;
  }
  
  const { data, error } = await supabaseAdmin
    .from('oracle_forecasts')
    .insert({
      market_id: 'test-123',
      platform: 'polymarket',
      question: 'Test forecast',
      category: 'other',
      probability: 0.5,
      confidence: 'medium',
      action: 'WAIT'
    })
    .select();
  
  if (error) {
    console.log('Insert error:', error.code, '-', error.message);
  } else {
    console.log('SUCCESS! Insert worked. ID:', data[0]?.id);
    await supabaseAdmin.from('oracle_forecasts').delete().eq('market_id', 'test-123');
    console.log('Test record cleaned up');
  }
}

test();
