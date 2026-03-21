/**
 * POST /api/stripe/portal
 *
 * Create a Stripe billing portal session for managing subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createBillingPortalSession,
  getUserSubscription,
  isStripeConfigured,
} from '../../../../lib/stripe/client';

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
    const { userId, returnUrl } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    // Get user's subscription to find their Stripe customer ID
    const subscription = await getUserSubscription(userId);

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No subscription found for user' },
        { status: 404 }
      );
    }

    // Build return URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const defaultReturnUrl = `${baseUrl}/subscription`;

    // Create billing portal session
    const portalUrl = await createBillingPortalSession(
      subscription.stripeCustomerId,
      returnUrl || defaultReturnUrl
    );

    if (!portalUrl) {
      return NextResponse.json(
        { error: 'Failed to create billing portal session' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      portalUrl,
    });
  } catch (error) {
    console.error('[Portal] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
