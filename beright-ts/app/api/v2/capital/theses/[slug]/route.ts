import { NextResponse } from 'next/server';
import { refreshCapitalThesis } from '@/lib/capital';

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const thesis = await refreshCapitalThesis(slug);
  if (!thesis) {
    return NextResponse.json({ success: false, error: 'Thesis not found.' }, { status: 404 });
  }
  return NextResponse.json({
    success: true,
    data: thesis,
    meta: {
      network: 'devnet',
      executionMode: 'onchain',
      custody: 'program-pda',
      navSource: 'program-accounting',
      onchainProgramDeployed: true,
      onchainProgramId: 'F2WkXzns4p5pe8NAuK6V5NhZ4bdpXxAE9h5kLAMtxqCT', // pragma: allowlist secret
      onchainProgramStatus: 'deployed',
      strategyExecution: 'external_adapter_required',
      disclaimer: 'Devnet only. This unaudited program must not hold real-value assets.',
    },
  });
}
