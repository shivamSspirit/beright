/**
 * /api/stripe/subscription
 *
 * GET - Get user's subscription details
 * DELETE - Cancel subscription
 * PATCH - Reactivate canceled subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserSubscription,
  getUserTier,
  getTodayUsage,
  cancelSubscription,
  reactivateSubscription,
  isStripeConfigured,
} from '../../../../lib/stripe/client';
import { getTierFeatures, getTierLimits, getTierConfig } from '../../../../lib/stripe/config';

/**
 * GET /api/stripe/subscription
 *
 * Get user's subscription details, features, and usage
 */
export async function GET(request: NextRequest) {
  try {
    // Get user ID from query or header
    const userId = request.nextUrl.searchParams.get('userId') ||
                   request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    // Get subscription
    const subscription = await getUserSubscription(userId);
    const tier = subscription?.status === 'active' || subscription?.status === 'trialing'
      ? subscription.tier
      : 'free';

    // Get tier config
    const tierConfig = getTierConfig(tier);
    const features = getTierFeatures(tier);
    const limits = getTierLimits(tier);

    // Get today's usage
    const usage = await getTodayUsage(userId);

    return NextResponse.json({
      subscription: subscription ? {
        id: subscription.id,
        tier: subscription.tier,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        billingInterval: subscription.billingInterval,
      } : null,
      tier,
      tierInfo: {
        name: tierConfig.name,
        description: tierConfig.description,
        badge: tierConfig.badge,
        color: tierConfig.color,
        priceMonthly: tierConfig.priceMonthly,
        priceYearly: tierConfig.priceYearly,
      },
      features,
      limits,
      usage,
      stripeConfigured: isStripeConfigured(),
    });
  } catch (error) {
    console.error('[Subscription] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/stripe/subscription
 *
 * Cancel subscription (at period end)
 */
export async function DELETE(request: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 503 }
      );
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    const success = await cancelSubscription(userId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to cancel subscription' },
        { status: 500 }
      );
    }

    // Get updated subscription
    const subscription = await getUserSubscription(userId);

    return NextResponse.json({
      success: true,
      message: 'Subscription will be canceled at the end of the billing period',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: subscription?.currentPeriodEnd,
    });
  } catch (error) {
    console.error('[Subscription] DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/stripe/subscription
 *
 * Reactivate a canceled subscription (before period end)
 */
export async function PATCH(request: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 503 }
      );
    }

    const { userId, action } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    if (action === 'reactivate') {
      const success = await reactivateSubscription(userId);

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to reactivate subscription' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Subscription reactivated',
        cancelAtPeriodEnd: false,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Subscription] PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
