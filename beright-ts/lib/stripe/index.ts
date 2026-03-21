/**
 * Stripe Module for BeRight Protocol
 *
 * Exports all Stripe-related functionality:
 * - Tier configuration and helpers
 * - Stripe client and operations
 * - Access control middleware
 */

// Configuration
export {
  TIERS,
  getTierConfig,
  getTierFeatures,
  getTierLimits,
  hasFeature,
  getLimit,
  isWithinLimit,
  getPaidTiers,
  getStripePriceId,
  compareTiers,
  isHigherTier,
} from './config';

// Client operations
export {
  getStripeClient,
  isStripeConfigured,
  getOrCreateCustomer,
  getCustomer,
  createCheckoutSession,
  createBillingPortalSession,
  getUserSubscription,
  getUserTier,
  updateSubscription,
  upsertSubscriptionFromStripe,
  cancelSubscription,
  reactivateSubscription,
  getTodayUsage,
  incrementUsage,
  verifyWebhook,
  processWebhookEvent,
} from './client';

// Middleware
export {
  getTierContext,
  checkFeatureAccess,
  checkRateLimit,
  checkAndIncrementUsage,
  checkAgentAccess,
  requireTier,
  requireFeature,
  enforceRateLimit,
} from './middleware';

// Types (re-export from types)
export type {
  SubscriptionTier,
  SubscriptionStatus,
  BillingInterval,
  TierConfig,
  TierFeatures,
  TierLimits,
  Subscription,
  SubscriptionUsage,
  SubscriptionRow,
  SubscriptionUsageRow,
  CreateCheckoutRequest,
  CreateCheckoutResponse,
  SubscriptionResponse,
  PortalResponse,
} from '../../types/subscription';
