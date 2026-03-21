/**
 * Subscription Types for BeRight Protocol
 *
 * Tier-based access control with Stripe integration.
 */

// ============================================================================
// SUBSCRIPTION TIERS
// ============================================================================

export type SubscriptionTier = 'free' | 'pro' | 'alpha' | 'whale' | 'enterprise';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete' | 'unpaid';
export type BillingInterval = 'month' | 'year';

export interface TierConfig {
  id: SubscriptionTier;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  features: TierFeatures;
  limits: TierLimits;
  badge: string;
  color: string;
}

export interface TierFeatures {
  // Access
  dashboardAccess: boolean;
  telegramBot: boolean;
  apiAccess: boolean;

  // Agents
  scoutAgent: boolean;
  analystAgent: boolean;
  traderAgent: boolean;
  xdegenAgent: boolean;

  // Features
  arbitrageAlerts: boolean;
  signalIntelligence: boolean;
  deepResearch: boolean;
  portfolioTracking: boolean;
  autoExecution: boolean;
  customAlerts: boolean;
  prioritySupport: boolean;
  whiteGlove: boolean;
}

export interface TierLimits {
  // Queries per day
  queriesPerDay: number;

  // Agent calls
  scoutCallsPerDay: number;
  analystCallsPerDay: number;
  traderCallsPerDay: number;

  // Alerts
  alertsPerDay: number;
  watchlistSize: number;

  // API
  apiCallsPerMinute: number;
  apiCallsPerDay: number;
}

// ============================================================================
// SUBSCRIPTION DATA
// ============================================================================

export interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  billingInterval: BillingInterval;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionUsage {
  userId: string;
  date: string; // YYYY-MM-DD
  queriesUsed: number;
  scoutCallsUsed: number;
  analystCallsUsed: number;
  traderCallsUsed: number;
  alertsSent: number;
  apiCallsUsed: number;
}

// ============================================================================
// DATABASE ROWS
// ============================================================================

export interface SubscriptionRow {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  billing_interval: BillingInterval;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionUsageRow {
  id: string;
  user_id: string;
  date: string;
  queries_used: number;
  scout_calls_used: number;
  analyst_calls_used: number;
  trader_calls_used: number;
  alerts_sent: number;
  api_calls_used: number;
}

// ============================================================================
// API TYPES
// ============================================================================

export interface CreateCheckoutRequest {
  tier: Exclude<SubscriptionTier, 'free'>;
  interval: BillingInterval;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateCheckoutResponse {
  checkoutUrl: string;
  sessionId: string;
}

export interface SubscriptionResponse {
  subscription: Subscription | null;
  tier: SubscriptionTier;
  features: TierFeatures;
  limits: TierLimits;
  usage: SubscriptionUsage | null;
}

export interface PortalResponse {
  portalUrl: string;
}
