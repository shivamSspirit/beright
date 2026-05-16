/**
 * Async Jobs API
 * GET /api/v2/jobs - Get pending jobs for wallet
 * POST /api/v2/jobs - Create new job
 * PATCH /api/v2/jobs/:id - Update job status
 */

import { NextRequest, NextResponse } from 'next/server';
import { asyncJobs } from '@/lib/supabase/conversations';
import type { NewAsyncJob } from '@/lib/supabase/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'wallet parameter required' },
        { status: 400 }
      );
    }

    const jobs = await asyncJobs.getPending(walletAddress);

    return NextResponse.json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    console.error('[API] GET /jobs error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet_address, conversation_id, job_type, gateway_job_id } = body;

    if (!wallet_address || !job_type) {
      return NextResponse.json(
        { success: false, error: 'wallet_address and job_type required' },
        { status: 400 }
      );
    }

    const job = await asyncJobs.create({
      wallet_address,
      conversation_id,
      job_type,
      gateway_job_id,
    } as NewAsyncJob);

    return NextResponse.json({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error('[API] POST /jobs error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create job' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, progress, message, result, error: errorMessage } = body;

    if (!id || !action) {
      return NextResponse.json(
        { success: false, error: 'id and action required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'progress':
        await asyncJobs.updateProgress(id, progress || 0, message);
        break;
      case 'complete':
        await asyncJobs.complete(id, result || {});
        break;
      case 'fail':
        await asyncJobs.fail(id, errorMessage || 'Unknown error');
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: progress, complete, fail' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: { id, action },
    });
  } catch (error) {
    console.error('[API] PATCH /jobs error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update job' },
      { status: 500 }
    );
  }
}
