/**
 * Check Verification Code API
 *
 * POST /api/v2/verification/check-code
 *
 * Checks if the verification code is present in user's external platform bio.
 * If found, marks the code as used and returns success.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/middleware/auth';

// =============================================================================
// VALIDATION
// =============================================================================

export const POST = requireAuth(async (_request: NextRequest) => NextResponse.json({
  success: false,
  error: { code: 'LEGACY_IDENTITY_FLOW_RETIRED', message: 'Submit profile proof through /api/v2/identity/claims' },
}, { status: 410 }));
