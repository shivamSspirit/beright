/**
 * On-Chain Calibration API
 *
 * GET /api/v2/calibration?wallet=<address>  → Get on-chain Brier scores
 * GET /api/v2/calibration?leaderboard=true  → Top on-chain verified forecasters
 *
 * Demo Mode: Returns mock leaderboard data
 * Production Mode: Returns real on-chain data
 */

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { isDemo } from '../../../../lib/mode';
import { getDemoLeaderboard, getDemoForecasterByWallet } from '../../../../lib/demo/mockLeaderboard';

// Dynamic import to avoid build issues with Anchor
async function getOnChainStats(walletAddress: string) {
  try {
    const { getForecasterStats, deriveForecasterPda, CALIBRATION_PROGRAM_ID } = await import('../../../../lib/onchain/calibration');

    const pubkey = new PublicKey(walletAddress);
    const stats = await getForecasterStats(pubkey);

    if (!stats) {
      return null;
    }

    // Calculate tier based on Brier score and predictions
    let tier: 'superforecaster' | 'elite' | 'verified' | 'rookie' | 'unranked' = 'unranked';
    if (stats.resolvedPredictions < 10) tier = 'unranked';
    else if (stats.resolvedPredictions < 20) tier = 'rookie';
    else if (stats.avgBrierScore < 0.12 && stats.resolvedPredictions >= 100) tier = 'superforecaster';
    else if (stats.avgBrierScore < 0.18 && stats.resolvedPredictions >= 50) tier = 'elite';
    else if (stats.avgBrierScore < 0.25 && stats.resolvedPredictions >= 20) tier = 'verified';
    else tier = 'rookie';

    // Calculate grade
    let grade = 'F';
    if (stats.avgBrierScore < 0.1) grade = 'S';
    else if (stats.avgBrierScore < 0.15) grade = 'A';
    else if (stats.avgBrierScore < 0.2) grade = 'B';
    else if (stats.avgBrierScore < 0.25) grade = 'C';
    else if (stats.avgBrierScore < 0.3) grade = 'D';

    const [forecasterPda] = deriveForecasterPda(pubkey);

    return {
      walletAddress,
      forecasterPda: forecasterPda.toBase58(),
      programId: CALIBRATION_PROGRAM_ID.toBase58(),
      isOnChainVerified: true,
      brierScore: stats.avgBrierScore,
      accuracy: stats.accuracy,
      totalPredictions: stats.totalPredictions,
      resolvedPredictions: stats.resolvedPredictions,
      correctPredictions: stats.correctPredictions,
      streak: stats.streakCorrect,
      maxStreak: stats.maxStreakCorrect,
      marketsTraded: stats.marketsTraded,
      tier,
      grade,
      calibrationBuckets: stats.calibrationBuckets,
      lastPrediction: stats.lastPredictionTs.toISOString(),
      createdAt: stats.createdAt.toISOString(),
    };
  } catch (error) {
    console.error('[Calibration API] Error fetching on-chain stats:', error);
    return null;
  }
}

// Known on-chain forecasters (expand this list or fetch from Supabase)
const KNOWN_FORECASTERS = [
  { wallet: '8X7vZpVYitCw7mb2ny9TWzubebZGanqEEW1fMnn28Rzf', name: 'BeRightBot' },
  // Add more as they register
];

// ============================================================================
// POST /api/v2/calibration - Build transactions
// ============================================================================

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const action = body.action as string;

    if (!action) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing action parameter',
          validActions: ['initialize', 'record', 'resolve', 'derive-pda'],
        },
        { status: 400 }
      );
    }

    // Import calibration module
    const {
      deriveForecasterPda,
      derivePredictionPda,
      CALIBRATION_PROGRAM_ID,
    } = await import('../../../../lib/onchain/calibration');

    const { Connection, PublicKey, Transaction, SystemProgram } = await import('@solana/web3.js');
    const { BN } = await import('@coral-xyz/anchor');

    const calibrationRpcUrl =
      process.env.CALIBRATION_RPC_URL
      || (process.env.CALIBRATION_USE_DEVNET !== 'false'
        ? 'https://api.devnet.solana.com'
        : (process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'));

    const connection = new Connection(calibrationRpcUrl, 'confirmed');

    switch (action) {
      case 'derive-pda': {
        if (!body.authority) {
          return NextResponse.json({ success: false, error: 'authority required' }, { status: 400 });
        }
        const authority = new PublicKey(body.authority);
        const [forecasterPda, bump] = deriveForecasterPda(authority);

        const result: Record<string, unknown> = {
          forecasterPda: forecasterPda.toBase58(),
          forecasterBump: bump,
        };

        if (body.marketId && body.timestampSeed) {
          const marketIdHash = Buffer.alloc(32);
          Buffer.from(body.marketId, 'utf-8').copy(marketIdHash, 0, 0, Math.min(body.marketId.length, 32));
          const [predictionPda, predBump] = derivePredictionPda(
            authority,
            marketIdHash,
            new BN(body.timestampSeed)
          );
          result.predictionPda = predictionPda.toBase58();
          result.predictionBump = predBump;
        }

        return NextResponse.json({ success: true, data: result });
      }

      case 'initialize': {
        if (!body.authority) {
          return NextResponse.json({ success: false, error: 'authority required' }, { status: 400 });
        }
        const authority = new PublicKey(body.authority);
        const [forecasterPda, bump] = deriveForecasterPda(authority);

        // Check if already initialized
        const accountInfo = await connection.getAccountInfo(forecasterPda);
        if (accountInfo) {
          return NextResponse.json(
            { success: false, error: 'Forecaster already initialized', code: 'ALREADY_INITIALIZED' },
            { status: 409 }
          );
        }

        // Build initialize instruction
        const discriminator = Buffer.from([16, 22, 244, 53, 163, 61, 216, 211]);
        const { TransactionInstruction } = await import('@solana/web3.js');

        const instruction = new TransactionInstruction({
          programId: CALIBRATION_PROGRAM_ID,
          keys: [
            { pubkey: authority, isSigner: true, isWritable: true },
            { pubkey: forecasterPda, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: discriminator,
        });

        const transaction = new Transaction().add(instruction);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = authority;

        return NextResponse.json({
          success: true,
          data: {
            transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
            forecasterPda: forecasterPda.toBase58(),
            bump,
            blockhash,
            lastValidBlockHeight,
          },
          meta: { action: 'initialize' },
        });
      }

      case 'record': {
        if (!body.authority || !body.marketId || body.predictedProbability === undefined || !body.direction) {
          return NextResponse.json(
            { success: false, error: 'authority, marketId, predictedProbability, and direction required' },
            { status: 400 }
          );
        }

        const authority = new PublicKey(body.authority);
        const [forecasterPda] = deriveForecasterPda(authority);

        // Build a single transaction that can initialize + record in one signature.
        // This matches the frontend expectation and eliminates the "NOT_INITIALIZED" UX.
        let includesInit = false;
        let includesMigrate = false;

        // If the forecaster exists but is still a legacy (V1) sized account, the V2 program will
        // fail to deserialize it for `record_prediction`. We auto-migrate (realloc) in the same tx.
        const FORECASTER_V2_ACCOUNT_LEN_BYTES = 559;
        const autoMigrate = body.autoMigrate !== false;

        // We fetch accountInfo when we need to decide init/migrate.
        // (skipInitCheck can be used by power-users, but we still migrate by default to avoid breakage)
        let forecasterAccountInfo: Awaited<ReturnType<typeof connection.getAccountInfo>> | null = null;
        if (!body.skipInitCheck || autoMigrate) {
          forecasterAccountInfo = await connection.getAccountInfo(forecasterPda, { commitment: 'confirmed' });
        }

        if (!body.skipInitCheck) {
          includesInit = !forecasterAccountInfo;
        }

        if (autoMigrate && forecasterAccountInfo && forecasterAccountInfo.data.length < FORECASTER_V2_ACCOUNT_LEN_BYTES) {
          includesMigrate = true;
        }

        const marketIdHash = Buffer.alloc(32);
        Buffer.from(body.marketId, 'utf-8').copy(marketIdHash, 0, 0, Math.min(body.marketId.length, 32));

        const timestampSeed = new BN(Math.floor(Date.now() / 1000));
        const [predictionPda, predBump] = derivePredictionPda(authority, marketIdHash, timestampSeed);

        const { TransactionInstruction } = await import('@solana/web3.js');

        const instructions = [];

        if (includesInit) {
          // Build initialize instruction
          const initDiscriminator = Buffer.from([16, 22, 244, 53, 163, 61, 216, 211]);
          const initInstruction = new TransactionInstruction({
            programId: CALIBRATION_PROGRAM_ID,
            keys: [
              { pubkey: authority, isSigner: true, isWritable: true },
              { pubkey: forecasterPda, isSigner: false, isWritable: true },
              { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            data: initDiscriminator,
          });
          instructions.push(initInstruction);
        } else if (includesMigrate) {
          // Build migrate_forecaster_to_v2 instruction
          // Discriminator = sha256("global:migrate_forecaster_to_v2")[..8]
          const migrateDiscriminator = Buffer.from([33, 239, 213, 106, 59, 15, 48, 85]);
          const migrateInstruction = new TransactionInstruction({
            programId: CALIBRATION_PROGRAM_ID,
            keys: [
              { pubkey: authority, isSigner: true, isWritable: true },
              { pubkey: forecasterPda, isSigner: false, isWritable: true },
              { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            data: migrateDiscriminator,
          });
          instructions.push(migrateInstruction);
        }

        // Build record prediction instruction
        const discriminator = Buffer.from([6, 250, 152, 187, 248, 58, 42, 136]);
        const dataBuffer = Buffer.alloc(8 + 32 + 8 + 8 + 1 + 64 + 1);
        let offset = 0;

        discriminator.copy(dataBuffer, offset); offset += 8;
        marketIdHash.copy(dataBuffer, offset); offset += 32;
        dataBuffer.writeBigInt64LE(BigInt(timestampSeed.toString()), offset); offset += 8;
        dataBuffer.writeDoubleLE(body.predictedProbability, offset); offset += 8;
        dataBuffer.writeUInt8(body.direction === 'yes' ? 0 : 1, offset); offset += 1;
        // memo_tx_signature - 64 bytes zeros
        offset += 64;
        dataBuffer.writeUInt8(body.category || 0, offset);

        const instruction = new TransactionInstruction({
          programId: CALIBRATION_PROGRAM_ID,
          keys: [
            { pubkey: authority, isSigner: true, isWritable: true },
            { pubkey: forecasterPda, isSigner: false, isWritable: true },
            { pubkey: predictionPda, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: dataBuffer,
        });

        instructions.push(instruction);

        const transaction = new Transaction().add(...instructions);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = authority;

        return NextResponse.json({
          success: true,
          data: {
            transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
            forecasterPda: forecasterPda.toBase58(),
            predictionPda: predictionPda.toBase58(),
            predictionBump: predBump,
            timestampSeed: timestampSeed.toString(),
            includesInit,
            includesMigrate,
            forecasterAccountBytes: forecasterAccountInfo?.data.length ?? null,
            blockhash,
            lastValidBlockHeight,
          },
          meta: {
            action: 'record',
            marketId: body.marketId,
            predictedProbability: body.predictedProbability,
            direction: body.direction,
          },
        });
      }

      case 'resolve': {
        if (!body.authority || !body.predictionPda || body.outcome === undefined) {
          return NextResponse.json(
            { success: false, error: 'authority, predictionPda, and outcome required' },
            { status: 400 }
          );
        }

        const authority = new PublicKey(body.authority);
        const predictionPda = new PublicKey(body.predictionPda);
        const [forecasterPda] = deriveForecasterPda(authority);

        // Build resolve instruction
        const discriminator = Buffer.from([199, 159, 54, 235, 121, 68, 53, 137]);
        const dataBuffer = Buffer.alloc(9);
        discriminator.copy(dataBuffer, 0);
        dataBuffer.writeUInt8(body.outcome ? 1 : 0, 8);

        const { TransactionInstruction } = await import('@solana/web3.js');
        const instruction = new TransactionInstruction({
          programId: CALIBRATION_PROGRAM_ID,
          keys: [
            { pubkey: authority, isSigner: true, isWritable: true },
            { pubkey: forecasterPda, isSigner: false, isWritable: true },
            { pubkey: predictionPda, isSigner: false, isWritable: true },
          ],
          data: dataBuffer,
        });

        const transaction = new Transaction().add(instruction);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = authority;

        return NextResponse.json({
          success: true,
          data: {
            transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
            predictionPda: predictionPda.toBase58(),
            blockhash,
            lastValidBlockHeight,
          },
          meta: { action: 'resolve', outcome: body.outcome },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}`, validActions: ['initialize', 'record', 'resolve', 'derive-pda'] },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API v2/calibration] POST Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/v2/calibration - Query stats
// ============================================================================

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet');
  const leaderboard = searchParams.get('leaderboard');

  // ============================================
  // DEMO MODE: Return mock data
  // ============================================
  if (isDemo()) {
    // Single wallet lookup in demo mode
    if (wallet) {
      const forecaster = getDemoForecasterByWallet(wallet);
      if (forecaster) {
        return NextResponse.json({
          success: true,
          data: {
            walletAddress: forecaster.walletAddress,
            forecasterPda: 'Demo' + forecaster.walletAddress.slice(4),
            programId: 'DemoProgramId11111111111111111111111111111',
            isOnChainVerified: true,
            brierScore: forecaster.brierScore,
            accuracy: forecaster.accuracy,
            totalPredictions: forecaster.predictions,
            resolvedPredictions: forecaster.resolvedPredictions,
            correctPredictions: Math.round(forecaster.resolvedPredictions * forecaster.accuracy / 100),
            streak: forecaster.streak,
            maxStreak: forecaster.maxStreak,
            tier: forecaster.tier,
            grade: forecaster.grade,
            displayName: forecaster.displayName,
            _demo: true,
          },
          meta: { source: 'demo', network: 'devnet' },
        });
      }
      return NextResponse.json({
        walletAddress: wallet,
        isOnChainVerified: false,
        message: 'No calibration data found (Demo Mode)',
        _demo: true,
      });
    }

    // Leaderboard in demo mode
    if (leaderboard === 'true') {
      const demoForecasters = getDemoLeaderboard(50);
      return NextResponse.json({
        success: true,
        data: {
          forecasters: demoForecasters.map(f => ({
            rank: f.rank,
            walletAddress: f.walletAddress,
            displayName: f.displayName,
            brierScore: f.brierScore,
            accuracy: f.accuracy,
            totalPredictions: f.predictions,
            resolvedPredictions: f.resolvedPredictions,
            streak: f.streak,
            tier: f.tier,
            grade: f.grade,
            onChainCount: f.onChainCount,
            isOnChainVerified: true,
            _demo: true,
          })),
          totalOnChain: demoForecasters.length,
          network: 'devnet',
        },
        meta: { source: 'demo', network: 'devnet' },
      });
    }

    // Default demo info
    return NextResponse.json({
      success: true,
      data: {
        programId: 'DemoProgramId11111111111111111111111111111',
        network: 'devnet',
        description: 'BeRight On-Chain Calibration Program (Demo Mode)',
        _demo: true,
      },
      meta: { source: 'demo', network: 'devnet' },
    });
  }

  // ============================================
  // PRODUCTION MODE: Real on-chain data
  // ============================================

  // Single wallet lookup
  if (wallet) {
    try {
      // Validate wallet address
      new PublicKey(wallet);
    } catch {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    const stats = await getOnChainStats(wallet);

    if (!stats) {
      return NextResponse.json({
        walletAddress: wallet,
        isOnChainVerified: false,
        message: 'No on-chain calibration data found for this wallet',
      });
    }

    return NextResponse.json({
      success: true,
      data: stats,
    });
  }

  // Leaderboard mode - fetch all known forecasters
  if (leaderboard === 'true') {
    const forecasters = [];

    for (const { wallet, name } of KNOWN_FORECASTERS) {
      const stats = await getOnChainStats(wallet);
      if (stats && stats.resolvedPredictions > 0) {
        forecasters.push({
          ...stats,
          displayName: name,
        });
      }
    }

    // Sort by Brier score (lower is better)
    forecasters.sort((a, b) => a.brierScore - b.brierScore);

    // Add ranks
    const ranked = forecasters.map((f, i) => ({
      ...f,
      rank: i + 1,
    }));

    return NextResponse.json({
      success: true,
      data: {
        forecasters: ranked,
        totalOnChain: ranked.length,
        network: process.env.CALIBRATION_USE_DEVNET !== 'false' ? 'devnet' : 'mainnet',
      },
    });
  }

  // Default: return info about the calibration program
  return NextResponse.json({
    success: true,
    data: {
      programId: 'GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ',
      network: process.env.CALIBRATION_USE_DEVNET !== 'false' ? 'devnet' : 'mainnet',
      description: 'BeRight On-Chain Calibration Program',
      usage: {
        singleWallet: '/api/v2/calibration?wallet=<address>',
        leaderboard: '/api/v2/calibration?leaderboard=true',
      },
    },
  });
}
