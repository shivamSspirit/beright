/**
 * Stripe Client for BeRight Protocol
 *
 * Handles all Stripe operations:
 * - Checkout session creation
 * - Customer management
 * - Subscription management
 * - Billing portal
 * - Webhook processing
 */

import Stripe from 'stripe';
import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import { getStripePriceId, getTierConfig, TIERS } from './config';
import {
  SubscriptionTier,
  SubscriptionStatus,
  BillingInterval,
  Subscription,
  SubscriptionRow,
  SubscriptionUsage,
  SubscriptionUsageRow,
} from '../../types/subscription';

// ============================================================================
// STRIPE CLIENT
// ============================================================================

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

let stripe: Stripe | null = null;

/**
 * Get or create Stripe client
 */
export function getStripeClient(): Stripe | null {
  if (!STRIPE_SECRET_KEY) {
    console.warn('[Stripe] STRIPE_SECRET_KEY not configured');
    return null;
  }

  if (!stripe) {
    stripe = new Stripe(STRIPE_SECRET_KEY);
  }

  return stripe;
}

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return !!STRIPE_SECRET_KEY;
}

// ============================================================================
// CUSTOMER MANAGEMENT
// ============================================================================

/**
 * Get or create Stripe customer for a user
 */
export async function getOrCreateCustomer(
  userId: string,
  email: string,
  name?: string
): Promise<string | null> {
  const client = getStripeClient();
  if (!client) return null;

  // Check if customer already exists in our database
  if (isSupabaseConfigured) {
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (subscription?.stripe_customer_id) {
      return subscription.stripe_customer_id;
    }
  }

  // Create new Stripe customer
  try {
    const customer = await client.customers.create({
      email,
      name,
      metadata: {
        userId,
        platform: 'beright',
      },
    });

    return customer.id;
  } catch (err) {
    console.error('[Stripe] Failed to create customer:', err);
    return null;
  }
}

/**
 * Get Stripe customer by ID
 */
export async function getCustomer(customerId: string): Promise<Stripe.Customer | null> {
  const client = getStripeClient();
  if (!client) return null;

  try {
    const customer = await client.customers.retrieve(customerId);
    if (customer.deleted) return null;
    return customer as Stripe.Customer;
  } catch (err) {
    console.error('[Stripe] Failed to get customer:', err);
    return null;
  }
}

// ============================================================================
// CHECKOUT
// ============================================================================

/**
 * Create a checkout session for subscription
 */
export async function createCheckoutSession(opts: {
  userId: string;
  email: string;
  tier: Exclude<SubscriptionTier, 'free'>;
  interval: BillingInterval;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; url: string } | null> {
  const client = getStripeClient();
  if (!client) return null;

  const priceId = getStripePriceId(opts.tier, opts.interval);
  if (!priceId) {
    console.error(`[Stripe] No price ID configured for tier ${opts.tier} ${opts.interval}`);
    return null;
  }

  // Get or create customer
  const customerId = await getOrCreateCustomer(opts.userId, opts.email);
  if (!customerId) return null;

  try {
    const session = await client.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
      metadata: {
        userId: opts.userId,
        tier: opts.tier,
        interval: opts.interval,
      },
      subscription_data: {
        metadata: {
          userId: opts.userId,
          tier: opts.tier,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    return {
      sessionId: session.id,
      url: session.url!,
    };
  } catch (err) {
    console.error('[Stripe] Failed to create checkout session:', err);
    return null;
  }
}

// ============================================================================
// BILLING PORTAL
// ============================================================================

/**
 * Create a billing portal session for customer
 */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string | null> {
  const client = getStripeClient();
  if (!client) return null;

  try {
    const session = await client.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session.url;
  } catch (err) {
    console.error('[Stripe] Failed to create billing portal session:', err);
    return null;
  }
}

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

/**
 * Get user subscription from database
 */
export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;

    return rowToSubscription(data as SubscriptionRow);
  } catch (err) {
    console.error('[Stripe] Failed to get user subscription:', err);
    return null;
  }
}

/**
 * Get user's current tier (from subscription or default to free)
 */
export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  const subscription = await getUserSubscription(userId);

  if (!subscription) return 'free';
  if (subscription.status !== 'active' && subscription.status !== 'trialing') return 'free';

  return subscription.tier;
}

/**
 * Update subscription in database
 */
export async function updateSubscription(
  userId: string,
  data: Partial<SubscriptionRow>
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    return !error;
  } catch (err) {
    console.error('[Stripe] Failed to update subscription:', err);
    return false;
  }
}

/**
 * Create or update subscription from Stripe event
 */
export async function upsertSubscriptionFromStripe(
  stripeSubscription: Stripe.Subscription
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const userId = stripeSubscription.metadata.userId;
  if (!userId) {
    console.error('[Stripe] Subscription missing userId in metadata');
    return false;
  }

  const tier = (stripeSubscription.metadata.tier as SubscriptionTier) || 'pro';
  const status = mapStripeStatus(stripeSubscription.status);

  // Access subscription properties (handle API variations)
  const sub = stripeSubscription as unknown as {
    customer: string;
    id: string;
    current_period_start?: number;
    current_period_end?: number;
    cancel_at_period_end?: boolean;
    items: { data: Array<{ plan: { interval: string } }> };
  };

  const subscriptionData: Partial<SubscriptionRow> = {
    user_id: userId,
    tier,
    status,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : (sub.customer as { id: string }).id,
    stripe_subscription_id: sub.id,
    current_period_start: sub.current_period_start
      ? new Date(sub.current_period_start * 1000).toISOString()
      : new Date().toISOString(),
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    billing_interval: sub.items.data[0]?.plan.interval === 'year' ? 'year' : 'month',
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .upsert(subscriptionData, { onConflict: 'user_id' });

    if (error) {
      console.error('[Stripe] Failed to upsert subscription:', error);
      return false;
    }

    console.log(`[Stripe] Subscription upserted for user ${userId}: ${tier} (${status})`);
    return true;
  } catch (err) {
    console.error('[Stripe] Failed to upsert subscription:', err);
    return false;
  }
}

/**
 * Cancel subscription (at period end)
 */
export async function cancelSubscription(userId: string): Promise<boolean> {
  const client = getStripeClient();
  if (!client) return false;

  const subscription = await getUserSubscription(userId);
  if (!subscription?.stripeSubscriptionId) return false;

  try {
    await client.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await updateSubscription(userId, { cancel_at_period_end: true });
    return true;
  } catch (err) {
    console.error('[Stripe] Failed to cancel subscription:', err);
    return false;
  }
}

/**
 * Reactivate canceled subscription
 */
export async function reactivateSubscription(userId: string): Promise<boolean> {
  const client = getStripeClient();
  if (!client) return false;

  const subscription = await getUserSubscription(userId);
  if (!subscription?.stripeSubscriptionId) return false;

  try {
    await client.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    await updateSubscription(userId, { cancel_at_period_end: false });
    return true;
  } catch (err) {
    console.error('[Stripe] Failed to reactivate subscription:', err);
    return false;
  }
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

/**
 * Get today's usage for a user
 */
export async function getTodayUsage(userId: string): Promise<SubscriptionUsage | null> {
  if (!isSupabaseConfigured) return null;

  const today = new Date().toISOString().split('T')[0];

  try {
    const { data, error } = await supabaseAdmin
      .from('subscription_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (error || !data) {
      // Return default usage
      return {
        userId,
        date: today,
        queriesUsed: 0,
        scoutCallsUsed: 0,
        analystCallsUsed: 0,
        traderCallsUsed: 0,
        alertsSent: 0,
        apiCallsUsed: 0,
      };
    }

    return rowToUsage(data as SubscriptionUsageRow);
  } catch (err) {
    console.error('[Stripe] Failed to get usage:', err);
    return null;
  }
}

/**
 * Increment usage counter
 */
export async function incrementUsage(
  userId: string,
  field: keyof Omit<SubscriptionUsage, 'userId' | 'date'>
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const today = new Date().toISOString().split('T')[0];
  const dbField = camelToSnake(field);

  try {
    // Upsert with increment
    const { error } = await supabaseAdmin.rpc('increment_usage', {
      p_user_id: userId,
      p_date: today,
      p_field: dbField,
    });

    // If RPC doesn't exist, do manual upsert
    if (error?.code === 'PGRST202') {
      const usage = await getTodayUsage(userId);
      if (!usage) return false;

      const newValue = (usage[field] || 0) + 1;

      const { error: upsertError } = await supabaseAdmin
        .from('subscription_usage')
        .upsert({
          user_id: userId,
          date: today,
          [dbField]: newValue,
        }, { onConflict: 'user_id,date' });

      return !upsertError;
    }

    return !error;
  } catch (err) {
    console.error('[Stripe] Failed to increment usage:', err);
    return false;
  }
}

// ============================================================================
// WEBHOOK HANDLING
// ============================================================================

/**
 * Verify and parse Stripe webhook
 */
export function verifyWebhook(
  payload: string,
  signature: string
): Stripe.Event | null {
  const client = getStripeClient();
  if (!client || !STRIPE_WEBHOOK_SECRET) return null;

  try {
    return client.webhooks.constructEvent(
      payload,
      signature,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[Stripe] Webhook verification failed:', err);
    return null;
  }
}

/**
 * Process Stripe webhook event
 */
export async function processWebhookEvent(event: Stripe.Event): Promise<boolean> {
  console.log(`[Stripe] Processing webhook: ${event.type}`);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription' && session.subscription) {
        const client = getStripeClient();
        if (!client) return false;

        const subscription = await client.subscriptions.retrieve(
          session.subscription as string
        );
        return upsertSubscriptionFromStripe(subscription);
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      return upsertSubscriptionFromStripe(subscription);
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata.userId;
      if (userId) {
        return updateSubscription(userId, {
          status: 'canceled',
          updated_at: new Date().toISOString(),
        });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as unknown as { subscription?: string | { id: string } };
      const subscriptionId = typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription?.id;
      if (subscriptionId) {
        const client = getStripeClient();
        if (!client) return false;

        const subscription = await client.subscriptions.retrieve(subscriptionId);
        const userId = subscription.metadata.userId;
        if (userId) {
          return updateSubscription(userId, {
            status: 'past_due',
            updated_at: new Date().toISOString(),
          });
        }
      }
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as unknown as { subscription?: string | { id: string } };
      const subscriptionId = typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription?.id;
      if (subscriptionId) {
        const client = getStripeClient();
        if (!client) return false;

        const subscription = await client.subscriptions.retrieve(subscriptionId);
        return upsertSubscriptionFromStripe(subscription);
      }
      break;
    }
  }

  return true;
}

// ============================================================================
// HELPERS
// ============================================================================

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  const statusMap: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
    active: 'active',
    canceled: 'canceled',
    incomplete: 'incomplete',
    incomplete_expired: 'canceled',
    past_due: 'past_due',
    paused: 'canceled',
    trialing: 'trialing',
    unpaid: 'unpaid',
  };
  return statusMap[status] || 'canceled';
}

function rowToSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    userId: row.user_id,
    tier: row.tier,
    status: row.status,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id || '',
    currentPeriodStart: new Date(row.current_period_start),
    currentPeriodEnd: new Date(row.current_period_end),
    cancelAtPeriodEnd: row.cancel_at_period_end,
    billingInterval: row.billing_interval,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function rowToUsage(row: SubscriptionUsageRow): SubscriptionUsage {
  return {
    userId: row.user_id,
    date: row.date,
    queriesUsed: row.queries_used,
    scoutCallsUsed: row.scout_calls_used,
    analystCallsUsed: row.analyst_calls_used,
    traderCallsUsed: row.trader_calls_used,
    alertsSent: row.alerts_sent,
    apiCallsUsed: row.api_calls_used,
  };
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}
