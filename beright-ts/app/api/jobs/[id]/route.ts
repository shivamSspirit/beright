/**
 * Job Status API
 *
 * GET /api/jobs/:id - Get job status and result
 * DELETE /api/jobs/:id - Cancel/delete a job
 */

import { NextRequest, NextResponse } from 'next/server';
import { getJob, deleteJob } from '../../../../lib/jobs/jobQueue';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = getJob(id);

  if (!job) {
    return NextResponse.json(
      { error: 'Job not found', id },
      { status: 404 }
    );
  }

  // Return appropriate fields based on status
  const response: any = {
    id: job.id,
    status: job.status,
    progress: job.progress,
    progressMessage: job.progressMessage,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };

  if (job.status === 'complete') {
    response.result = job.result;
  }

  if (job.status === 'failed') {
    response.error = job.error;
  }

  return NextResponse.json(response);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = deleteJob(id);

  if (!deleted) {
    return NextResponse.json(
      { error: 'Job not found', id },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, id });
}
