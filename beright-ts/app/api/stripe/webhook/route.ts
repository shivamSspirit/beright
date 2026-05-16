/**
 * POST /api/stripe/webhook
 *
 * Handle Stripe webhook events
 *
 * Events handled:
 * - checkout.session.completed
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_failed
 * - invoice.paid
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook, processWebhookEvent, isStripeConfigured } from '../../../../lib/stripe/client';
import { supabaseAdmin, isSupabaseConfigured } from '../../../../lib/supabase/client';

// Disable body parsing - we need the raw body for signature verification
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!isStripeConfigured()) {
      console.warn('[Webhook] Stripe not configured');
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 503 }
      );
    }

    // Get raw body and signature
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('[Webhook] Missing stripe-signature header');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    const event = verifyWebhook(body, signature);
    if (!event) {
      console.error('[Webhook] Invalid signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

    // Check for duplicate event (idempotency)
    if (isSupabaseConfigured) {
      const { data: existingEvent } = await supabaseAdmin
        .from('stripe_events')
        .select('id, processed_at')
        .eq('stripe_event_id', event.id)
        .single();

      if (existingEvent?.processed_at) {
        console.log(`[Webhook] Event ${event.id} already processed`);
        return NextResponse.json({ received: true, duplicate: true });
      }

      // Store event
      await supabaseAdmin.from('stripe_events').upsert({
        stripe_event_id: event.id,
        event_type: event.type,
        payload: event.data.object,
        created_at: new Date().toISOString(),
      }, { onConflict: 'stripe_event_id' });
    }

    // Process the event
    let success = false;
    let error: string | undefined;

    try {
      success = await processWebhookEvent(event);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      console.error(`[Webhook] Error processing ${event.type}:`, error);
    }

    // Update event status
    if (isSupabaseConfigured) {
      await supabaseAdmin
        .from('stripe_events')
        .update({
          processed_at: success ? new Date().toISOString() : null,
          error: error || null,
        })
        .eq('stripe_event_id', event.id);
    }

    if (!success) {
      console.error(`[Webhook] Failed to process event ${event.id}`);
      // Return 200 anyway to prevent Stripe from retrying
      // We've logged the error and can investigate
    }

    return NextResponse.json({
      received: true,
      eventId: event.id,
      eventType: event.type,
      success,
    });
  } catch (error) {
    console.error('[Webhook] Unexpected error:', error);
    // Return 500 so Stripe retries the webhook
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
