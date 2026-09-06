/**
 * Link Platform API
 *
 * POST /api/v2/forecaster/link-platform
 *
 * Retired legacy external-platform link route.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/middleware/auth';

// =============================================================================
// VALIDATION
// =============================================================================

export const POST = requireAuth(async (_request: NextRequest) => NextResponse.json({
  success: false,
  error: { code: 'LEGACY_IDENTITY_FLOW_RETIRED', message: 'Use /api/v2/identity/challenges and /api/v2/identity/claims for replay-resistant dual ownership proof' },
}, { status: 410 }));
