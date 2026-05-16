/**
 * POST /api/stripe/checkout
 *
 * Create a Stripe checkout session for subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession, isStripeConfigured } from '../../../../lib/stripe/client';
import { SubscriptionTier, BillingInterval } from '../../../../types/subscription';
import { TIERS } from '../../../../lib/stripe/config';

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { tier, interval, userId, email, successUrl, cancelUrl } = body;

    // Validate required fields
    if (!tier || !userId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: tier, userId, email' },
        { status: 400 }
      );
    }

    // Validate tier
    const validTiers: SubscriptionTier[] = ['pro', 'alpha', 'whale', 'enterprise'];
    if (!validTiers.includes(tier)) {
      return NextResponse.json(
        { error: `Invalid tier: ${tier}. Must be one of: ${validTiers.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate interval
    const billingInterval: BillingInterval = interval === 'year' ? 'year' : 'month';

    // Get tier config
    const tierConfig = TIERS[tier as SubscriptionTier];

    // Build URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const defaultSuccessUrl = `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
    const defaultCancelUrl = `${baseUrl}/subscription/cancel`;

    // Create checkout session
    const session = await createCheckoutSession({
      userId,
      email,
      tier: tier as Exclude<SubscriptionTier, 'free'>,
      interval: billingInterval,
      successUrl: successUrl || defaultSuccessUrl,
      cancelUrl: cancelUrl || defaultCancelUrl,
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId: session.sessionId,
      checkoutUrl: session.url,
      tier: tierConfig.name,
      price: billingInterval === 'year' ? tierConfig.priceYearly : tierConfig.priceMonthly,
      interval: billingInterval,
    });
  } catch (error) {
    console.error('[Checkout] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/stripe/checkout
 *
 * Get available subscription tiers and pricing
 */
export async function GET() {
  const tiers = Object.values(TIERS).map(tier => ({
    id: tier.id,
    name: tier.name,
    description: tier.description,
    priceMonthly: tier.priceMonthly,
    priceYearly: tier.priceYearly,
    features: tier.features,
    limits: tier.limits,
    badge: tier.badge,
    color: tier.color,
  }));

  return NextResponse.json({
    tiers,
    stripeConfigured: isStripeConfigured(),
  });
}
