/**
 * POST /api/v2/credit/check
 *
 * Check if a credit action is allowed for a forecaster.
 *
 * Request body:
 * {
 *   "pubkey": "...",
 *   "action": "borrow" | "delegate" | "manage_pool" | "access_tier" | "collateralize",
 *   "amount": 1000,  // optional, for borrow/delegate/collateralize
 *   "poolTier": "standard"  // optional, for manage_pool/access_tier
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getCreditCheckResponse,
  type CreditCheckRequest,
  type CreditAction,
  type PoolAccessTier,
  DEFAULT_CREDIT_CONFIG,
} from '@/lib/credit';

const CreditCheckSchema = z.object({
  pubkey: z.string().min(32).max(44),
  action: z.enum(['borrow', 'delegate', 'manage_pool', 'access_tier', 'collateralize']),
  amount: z.number().positive().optional(),
  poolTier: z.enum(['restricted', 'basic', 'standard', 'advanced', 'elite']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const parsed = CreditCheckSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { pubkey, action, amount, poolTier } = parsed.data;

    const checkRequest: CreditCheckRequest = {
      pubkey,
      action: action as CreditAction,
      amount,
      poolTier: poolTier as PoolAccessTier | undefined,
    };

    const response = await getCreditCheckResponse(checkRequest, DEFAULT_CREDIT_CONFIG);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Credit check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
