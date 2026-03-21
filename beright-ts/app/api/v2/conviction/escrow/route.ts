/**
 * BeRight Conviction Escrow API
 *
 * Endpoints for on-chain escrow operations - creating markets,
 * staking, resolving, and claiming.
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  deriveEscrowPdas,
  getEscrowMarket,
  getEscrowMarketByProject,
  MIN_STAKE_SOL,
  ESCROW_PROGRAM_ID,
  ConvictionEscrowClient,
} from '../../../../../lib/conviction/escrow';

// ============================================================================
// CONNECTION
// ============================================================================

function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const WalletAddressSchema = z
  .string()
  .min(32)
  .max(44)
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Invalid Solana address');

const GetEscrowSchema = z.object({
  projectWallet: WalletAddressSchema.optional(),
  marketPda: WalletAddressSchema.optional(),
}).refine(
  (data) => data.projectWallet || data.marketPda,
  'Either projectWallet or marketPda is required'
);

const CreateEscrowTxSchema = z.object({
  projectWallet: WalletAddressSchema,
  resolver: WalletAddressSchema,
  stakePosition: z.enum(['yes', 'no']).default('yes'),
  resolutionDate: z
    .number()
    .or(z.string().transform((s) => Math.floor(new Date(s).getTime() / 1000)))
    .refine((v) => v > Math.floor(Date.now() / 1000), 'Resolution date must be in the future'),
  stakeAmountSol: z
    .number()
    .positive()
    .refine((v) => v >= MIN_STAKE_SOL, `Minimum stake is ${MIN_STAKE_SOL} SOL`),
});

const StakeTxSchema = z.object({
  projectWallet: WalletAddressSchema,
});

const ResolveTxSchema = z.object({
  projectWallet: WalletAddressSchema,
  resolver: WalletAddressSchema,
  outcome: z.enum(['yes', 'no', 'invalid']),
});

const ClaimTxSchema = z.object({
  projectWallet: WalletAddressSchema,
  claimer: WalletAddressSchema,
});

// ============================================================================
// GET /api/v2/conviction/escrow
// ============================================================================

/**
 * Get escrow market data
 *
 * Query Parameters:
 * - projectWallet: Get market by project wallet
 * - marketPda: Get market by PDA address
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = GetEscrowSchema.safeParse(
      Object.fromEntries(searchParams.entries())
    );

    if (!params.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: params.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const connection = getConnection();
    const { projectWallet, marketPda } = params.data;

    let market = null;
    let pdas = null;
    let vaultBalance = 0;

    if (marketPda) {
      const marketPdaPubkey = new PublicKey(marketPda);
      market = await getEscrowMarket(connection, marketPdaPubkey);
    } else if (projectWallet) {
      const projectPubkey = new PublicKey(projectWallet);
      pdas = deriveEscrowPdas(projectPubkey);
      market = await getEscrowMarketByProject(connection, projectPubkey);

      if (market) {
        vaultBalance = await connection.getBalance(pdas.vaultPda);
      }
    }

    if (!market) {
      return NextResponse.json(
        {
          success: false,
          error: 'Escrow market not found',
          code: 'MARKET_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        market: {
          projectWallet: market.projectWallet.toString(),
          resolver: market.resolver.toString(),
          stakeAmount: market.stakeAmount.toNumber() / LAMPORTS_PER_SOL,
          stakeAmountLamports: market.stakeAmount.toString(),
          stakePosition: market.stakePosition,
          resolutionDate: market.resolutionDate.toNumber(),
          resolutionDateISO: new Date(market.resolutionDate.toNumber() * 1000).toISOString(),
          status: market.status,
          outcome: market.outcome,
          createdAt: market.createdAt.toNumber(),
          createdAtISO: new Date(market.createdAt.toNumber() * 1000).toISOString(),
        },
        pdas: pdas ? {
          marketPda: pdas.marketPda.toString(),
          vaultPda: pdas.vaultPda.toString(),
          marketBump: pdas.marketBump,
          vaultBump: pdas.vaultBump,
        } : undefined,
        vaultBalanceSol: vaultBalance / LAMPORTS_PER_SOL,
        vaultBalanceLamports: vaultBalance,
      },
      meta: {
        programId: ESCROW_PROGRAM_ID.toString(),
        network: process.env.SOLANA_NETWORK || 'devnet',
      },
    });
  } catch (error) {
    console.error('[API v2/conviction/escrow] GET Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/v2/conviction/escrow
// ============================================================================

/**
 * Build escrow transaction
 *
 * Request Body:
 * - action: 'create' | 'stake' | 'resolve' | 'claim'
 * - ... action-specific params
 *
 * Returns serialized transaction for client to sign
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action as string;

    if (!action) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing action parameter',
          validActions: ['create', 'stake', 'resolve', 'claim', 'derive-pdas'],
        },
        { status: 400 }
      );
    }

    const connection = getConnection();
    const client = new ConvictionEscrowClient(connection);

    switch (action) {
      case 'derive-pdas': {
        const parsed = z.object({ projectWallet: WalletAddressSchema }).safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid request',
              details: parsed.error.flatten().fieldErrors,
            },
            { status: 400 }
          );
        }

        const projectPubkey = new PublicKey(parsed.data.projectWallet);
        const pdas = deriveEscrowPdas(projectPubkey);

        return NextResponse.json({
          success: true,
          data: {
            marketPda: pdas.marketPda.toString(),
            vaultPda: pdas.vaultPda.toString(),
            marketBump: pdas.marketBump,
            vaultBump: pdas.vaultBump,
          },
        });
      }

      case 'create': {
        const parsed = CreateEscrowTxSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid request',
              details: parsed.error.flatten().fieldErrors,
            },
            { status: 400 }
          );
        }

        const projectPubkey = new PublicKey(parsed.data.projectWallet);
        const resolverPubkey = new PublicKey(parsed.data.resolver);

        // Check if market already exists
        const existingMarket = await client.marketExists(projectPubkey);
        if (existingMarket) {
          return NextResponse.json(
            {
              success: false,
              error: 'Market already exists for this project wallet',
              code: 'MARKET_EXISTS',
            },
            { status: 409 }
          );
        }

        const result = client.buildCreateMarketTransaction({
          projectWallet: projectPubkey,
          resolver: resolverPubkey,
          stakePosition: parsed.data.stakePosition,
          resolutionDate: parsed.data.resolutionDate,
          stakeAmountSol: parsed.data.stakeAmountSol,
        });

        // Get recent blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        result.transaction.recentBlockhash = blockhash;
        result.transaction.feePayer = projectPubkey;

        return NextResponse.json({
          success: true,
          data: {
            transaction: result.transaction
              .serialize({ requireAllSignatures: false })
              .toString('base64'),
            marketPda: result.marketPda.toString(),
            vaultPda: result.vaultPda.toString(),
            marketBump: result.marketBump,
            vaultBump: result.vaultBump,
            blockhash,
            lastValidBlockHeight,
          },
          meta: {
            action: 'create',
            stakeAmountSol: parsed.data.stakeAmountSol,
            stakeAmountLamports: Math.floor(parsed.data.stakeAmountSol * LAMPORTS_PER_SOL),
          },
        });
      }

      case 'stake': {
        const parsed = StakeTxSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid request',
              details: parsed.error.flatten().fieldErrors,
            },
            { status: 400 }
          );
        }

        const projectPubkey = new PublicKey(parsed.data.projectWallet);
        const pdas = deriveEscrowPdas(projectPubkey);

        const transaction = client.buildStakeTransaction({
          marketPda: pdas.marketPda,
          projectWallet: projectPubkey,
        });

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = projectPubkey;

        return NextResponse.json({
          success: true,
          data: {
            transaction: transaction
              .serialize({ requireAllSignatures: false })
              .toString('base64'),
            marketPda: pdas.marketPda.toString(),
            vaultPda: pdas.vaultPda.toString(),
            blockhash,
            lastValidBlockHeight,
          },
          meta: { action: 'stake' },
        });
      }

      case 'resolve': {
        const parsed = ResolveTxSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid request',
              details: parsed.error.flatten().fieldErrors,
            },
            { status: 400 }
          );
        }

        const projectPubkey = new PublicKey(parsed.data.projectWallet);
        const resolverPubkey = new PublicKey(parsed.data.resolver);
        const pdas = deriveEscrowPdas(projectPubkey);

        const transaction = client.buildResolveTransaction({
          marketPda: pdas.marketPda,
          resolver: resolverPubkey,
          outcome: parsed.data.outcome,
        });

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = resolverPubkey;

        return NextResponse.json({
          success: true,
          data: {
            transaction: transaction
              .serialize({ requireAllSignatures: false })
              .toString('base64'),
            marketPda: pdas.marketPda.toString(),
            blockhash,
            lastValidBlockHeight,
          },
          meta: { action: 'resolve', outcome: parsed.data.outcome },
        });
      }

      case 'claim': {
        const parsed = ClaimTxSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid request',
              details: parsed.error.flatten().fieldErrors,
            },
            { status: 400 }
          );
        }

        const projectPubkey = new PublicKey(parsed.data.projectWallet);
        const claimerPubkey = new PublicKey(parsed.data.claimer);
        const pdas = deriveEscrowPdas(projectPubkey);

        const transaction = client.buildClaimTransaction({
          marketPda: pdas.marketPda,
          claimer: claimerPubkey,
        });

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = claimerPubkey;

        return NextResponse.json({
          success: true,
          data: {
            transaction: transaction
              .serialize({ requireAllSignatures: false })
              .toString('base64'),
            marketPda: pdas.marketPda.toString(),
            vaultPda: pdas.vaultPda.toString(),
            blockhash,
            lastValidBlockHeight,
          },
          meta: { action: 'claim' },
        });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}`,
            validActions: ['create', 'stake', 'resolve', 'claim', 'derive-pdas'],
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API v2/conviction/escrow] POST Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
