/**
 * Waitlist API
 *
 * Collects email signups for production access.
 * Stores in Supabase waitlist table.
 *
 * POST /api/waitlist - Add to waitlist
 * GET /api/waitlist - Get waitlist stats (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase/client';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Solana wallet address regex (base58, 32-44 chars)
const WALLET_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * POST /api/waitlist
 * Add email to waitlist
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, walletAddress, tier, referralCode } = body;

    // Validate email
    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Valid email address required' },
        { status: 400 }
      );
    }

    // Validate wallet if provided
    if (walletAddress && !WALLET_REGEX.test(walletAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid Solana wallet address' },
        { status: 400 }
      );
    }

    // Validate tier if provided
    const validTiers = ['free', 'pro', 'whale'];
    const selectedTier = tier && validTiers.includes(tier) ? tier : 'pro';

    // Check if email already exists
    const { data: existing } = await supabaseAdmin
      .from('waitlist')
      .select('id, created_at')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      // Already on waitlist - return success anyway (don't reveal this info)
      return NextResponse.json({
        success: true,
        message: 'You\'re on the list!',
        alreadyExists: true,
      });
    }

    // Insert into waitlist
    const { data, error } = await supabaseAdmin
      .from('waitlist')
      .insert({
        email: email.toLowerCase(),
        wallet_address: walletAddress || null,
        tier_interest: selectedTier,
        referral_code: referralCode || null,
        created_at: new Date().toISOString(),
        notified: false,
      })
      .select('id, created_at')
      .single();

    if (error) {
      console.error('[Waitlist] Insert error:', error);

      // Handle unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json({
          success: true,
          message: 'You\'re on the list!',
          alreadyExists: true,
        });
      }

      return NextResponse.json(
        { success: false, error: 'Failed to join waitlist' },
        { status: 500 }
      );
    }

    console.log(`[Waitlist] New signup: ${email}, tier: ${selectedTier}`);

    return NextResponse.json({
      success: true,
      message: 'You\'re on the list!',
      data: {
        id: data.id,
        createdAt: data.created_at,
      },
    });
  } catch (error) {
    console.error('[Waitlist] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/waitlist
 * Get waitlist stats (could add admin auth later)
 */
export async function GET(request: NextRequest) {
  try {
    // Get total count
    const { count: totalCount } = await supabaseAdmin
      .from('waitlist')
      .select('*', { count: 'exact', head: true });

    // Get counts by tier
    const { data: tierCounts } = await supabaseAdmin
      .from('waitlist')
      .select('tier_interest')
      .not('tier_interest', 'is', null);

    const tierDistribution: Record<string, number> = {
      free: 0,
      pro: 0,
      whale: 0,
    };

    tierCounts?.forEach((row: { tier_interest: string }) => {
      if (row.tier_interest && tierDistribution[row.tier_interest] !== undefined) {
        tierDistribution[row.tier_interest]++;
      }
    });

    // Get recent signups (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { count: recentCount } = await supabaseAdmin
      .from('waitlist')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString());

    return NextResponse.json({
      success: true,
      data: {
        total: totalCount || 0,
        recentWeek: recentCount || 0,
        byTier: tierDistribution,
      },
    });
  } catch (error) {
    console.error('[Waitlist] Stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get stats' },
      { status: 500 }
    );
  }
}
