/**
 * Generate Verification Code API
 *
 * POST /api/v2/verification/generate-code
 *
 * Generates a verification code for profile-based platform verification.
 * User adds this code to their external platform bio to prove ownership.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/middleware/auth';

// =============================================================================
// VALIDATION
// =============================================================================

export const POST = requireAuth(async (_request: NextRequest) => NextResponse.json({
  success: false,
  error: { code: 'LEGACY_IDENTITY_FLOW_RETIRED', message: 'Generate a short-lived identity challenge through /api/v2/identity/challenges' },
}, { status: 410 }));
