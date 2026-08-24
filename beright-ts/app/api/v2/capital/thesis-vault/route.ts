import { NextResponse } from 'next/server';
import { createSolanaGrowthDevnetBlueprint } from '@/lib/capital';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: createSolanaGrowthDevnetBlueprint(),
    meta: {
      custody: 'program-pda',
      network: 'devnet',
      predictionExecution: 'external_adapter_required',
      defiExecution: 'external_adapter_required',
      navAuthority: 'configured-signer-or-multisig',
      audited: false,
      deployableWithRealValue: false,
      programId: 'F2WkXzns4p5pe8NAuK6V5NhZ4bdpXxAE9h5kLAMtxqCT', // pragma: allowlist secret
      programDeployed: true,
      programStatus: 'deployed',
    },
  });
}
