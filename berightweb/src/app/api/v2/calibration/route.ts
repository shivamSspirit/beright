import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { BN, Program, AnchorProvider, web3 } from '@coral-xyz/anchor';
import calibrationIdl from '@/lib/calibration-idl.json';

/**
 * Calibration Program API
 *
 * GET: Fetch forecaster state and predictions from devnet
 * POST: Build unsigned transactions for initialization/recording
 *
 * Program ID: GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ (devnet)
 */

// Always use devnet for calibration - program is deployed on devnet
const DEVNET_RPC = process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey(calibrationIdl.address);

/**
 * Derive forecaster state PDA
 */
function deriveForecasterPda(forecasterPubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('forecaster_v2'), forecasterPubkey.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Derive prediction record PDA
 */
function derivePredictionPda(
  forecasterPubkey: PublicKey,
  marketIdHash: Buffer,
  timestampSeed: BN
): [PublicKey, number] {
  const timestampBuffer = Buffer.alloc(8);
  timestampBuffer.writeBigInt64LE(BigInt(timestampSeed.toString()));

  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('prediction'),
      forecasterPubkey.toBuffer(),
      marketIdHash,
      timestampBuffer,
    ],
    PROGRAM_ID
  );
}

/**
 * Hash market ID to 32 bytes
 */
function hashMarketId(marketId: string): Buffer {
  const hash = Buffer.alloc(32);
  const marketBytes = Buffer.from(marketId, 'utf-8');
  marketBytes.copy(hash, 0, 0, Math.min(marketBytes.length, 32));
  return hash;
}

/**
 * Get read-only Anchor program instance
 */
function getReadOnlyProgram(): Program {
  const connection = new Connection(DEVNET_RPC, 'confirmed');

  // Create a dummy wallet for read-only operations
  const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: async () => { throw new Error('Read-only'); },
    signAllTransactions: async () => { throw new Error('Read-only'); },
  };

  const provider = new AnchorProvider(
    connection,
    dummyWallet as any,
    { commitment: 'confirmed' }
  );

  return new Program(calibrationIdl as any, provider);
}

/**
 * GET: Fetch forecaster state
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet address required' },
        { status: 400 }
      );
    }

    let walletPubkey: PublicKey;
    try {
      walletPubkey = new PublicKey(wallet);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    const program = getReadOnlyProgram();
    const [forecasterStatePda] = deriveForecasterPda(walletPubkey);

    // Fetch forecaster state
    let forecasterAccount;
    try {
      forecasterAccount = await (program.account as any).forecasterState.fetchNullable(
        forecasterStatePda
      );
    } catch (err) {
      console.error('[Calibration API] Error fetching forecaster state:', err);
      forecasterAccount = null;
    }

    if (!forecasterAccount) {
      return NextResponse.json({
        success: true,
        data: {
          isInitialized: false,
          forecasterPda: forecasterStatePda.toBase58(),
        },
      });
    }

    // Fetch predictions for this forecaster
    let predictions: any[] = [];
    try {
      const accounts = await (program.account as any).predictionRecord.all([
        {
          memcmp: {
            offset: 8 + 1, // discriminator + bump
            bytes: walletPubkey.toBase58(),
          },
        },
      ]);

      predictions = accounts.map(({ publicKey, account }: { publicKey: PublicKey; account: any }) => {
        const marketIdBytes = Buffer.from(account.marketId as number[]);
        const marketIdStr = marketIdBytes.toString('utf-8').replace(/\0+$/, '');

        return {
          pda: publicKey.toBase58(),
          forecaster: (account.forecaster as PublicKey).toBase58(),
          marketId: marketIdStr,
          predictedProbability: account.predictedProbability as number,
          direction: (account.direction as any).yes ? 'YES' : 'NO',
          committedAt: new Date((account.committedAt as BN).toNumber() * 1000).toISOString(),
          resolvedAt: account.resolvedAt
            ? new Date((account.resolvedAt as BN).toNumber() * 1000).toISOString()
            : null,
          outcome: (account.outcome as boolean | null) ?? null,
          brierScore: (account.brierScore as number | null) ?? null,
          category: account.category as number,
        };
      });

      // Sort by committedAt descending
      predictions.sort((a, b) =>
        new Date(b.committedAt).getTime() - new Date(a.committedAt).getTime()
      );
    } catch (err) {
      console.error('[Calibration API] Error fetching predictions:', err);
    }

    // Parse calibration buckets
    const calibrationBuckets = (forecasterAccount.calibrationBuckets as number[][]).map(
      (bucket: number[], index: number) => ({
        range: `${index * 10}%-${(index + 1) * 10}%`,
        count: bucket[0] || 0,
        avgOutcome: bucket[1] || 0,
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        isInitialized: true,
        forecasterPda: forecasterStatePda.toBase58(),
        authority: (forecasterAccount.authority as PublicKey).toBase58(),
        stats: {
          totalPredictions: forecasterAccount.totalPredictions as number,
          resolvedPredictions: forecasterAccount.resolvedPredictions as number,
          pendingPredictions:
            (forecasterAccount.totalPredictions as number) -
            (forecasterAccount.resolvedPredictions as number),
          correctPredictions: forecasterAccount.correctPredictions as number,
          accuracy: forecasterAccount.accuracy as number,
          avgBrierScore: forecasterAccount.avgBrierScore as number,
          avgLogScore: forecasterAccount.avgLogScore as number,
          marketsTraded: forecasterAccount.marketsTraded as number,
          streakCorrect: forecasterAccount.streakCorrect as number,
          maxStreakCorrect: forecasterAccount.maxStreakCorrect as number,
          bestCategory: forecasterAccount.bestCategory as number,
          worstCategory: forecasterAccount.worstCategory as number,
        },
        calibrationBuckets,
        timestamps: {
          createdAt: (forecasterAccount.createdAt as BN).toNumber(),
          createdAtISO: new Date(
            (forecasterAccount.createdAt as BN).toNumber() * 1000
          ).toISOString(),
          lastPredictionTs: (forecasterAccount.lastPredictionTs as BN).toNumber(),
          lastPredictionISO:
            (forecasterAccount.lastPredictionTs as BN).toNumber() > 0
              ? new Date(
                  (forecasterAccount.lastPredictionTs as BN).toNumber() * 1000
                ).toISOString()
              : null,
        },
        version: forecasterAccount.version as number,
        predictions: predictions.slice(0, 50), // Return latest 50 predictions
      },
    });
  } catch (error) {
    console.error('[Calibration API] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch calibration data',
      },
      { status: 500 }
    );
  }
}

/**
 * POST: Build unsigned transactions
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { action, authority, marketId, predictedProbability, direction, category } = body;

    if (!action || !authority) {
      return NextResponse.json(
        { success: false, error: 'Action and authority are required' },
        { status: 400 }
      );
    }

    let authorityPubkey: PublicKey;
    try {
      authorityPubkey = new PublicKey(authority);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid authority address' },
        { status: 400 }
      );
    }

    const connection = new Connection(DEVNET_RPC, 'confirmed');
    const [forecasterStatePda] = deriveForecasterPda(authorityPubkey);

    if (action === 'initialize') {
      // Check if already initialized
      const program = getReadOnlyProgram();
      let existingAccount;
      try {
        existingAccount = await (program.account as any).forecasterState.fetchNullable(
          forecasterStatePda
        );
      } catch {
        existingAccount = null;
      }

      if (existingAccount) {
        return NextResponse.json({
          success: false,
          code: 'ALREADY_INITIALIZED',
          error: 'Forecaster already initialized',
        });
      }

      // Build initialize transaction manually (without signing)
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

      // Build the instruction data for initialize_forecaster
      // Discriminator: [16, 22, 244, 53, 163, 61, 216, 211]
      const discriminator = Buffer.from([16, 22, 244, 53, 163, 61, 216, 211]);

      const transaction = new Transaction();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = authorityPubkey;

      // Create the instruction manually
      const keys = [
        { pubkey: authorityPubkey, isSigner: true, isWritable: true },
        { pubkey: forecasterStatePda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ];

      transaction.add({
        programId: PROGRAM_ID,
        keys,
        data: discriminator,
      });

      // Serialize without signatures
      const serialized = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      return NextResponse.json({
        success: true,
        data: {
          transaction: serialized.toString('base64'),
          forecasterPda: forecasterStatePda.toBase58(),
        },
      });
    }

    if (action === 'record') {
      if (!marketId || predictedProbability === undefined || !direction) {
        return NextResponse.json(
          { success: false, error: 'marketId, predictedProbability, and direction are required' },
          { status: 400 }
        );
      }

      // Check if forecaster is initialized
      const program = getReadOnlyProgram();
      let forecasterAccount;
      try {
        forecasterAccount = await (program.account as any).forecasterState.fetchNullable(
          forecasterStatePda
        );
      } catch {
        forecasterAccount = null;
      }

      const needsInit = !forecasterAccount;

      // Hash market ID
      const marketIdHash = hashMarketId(marketId);

      // Use current timestamp (seconds) as seed
      const timestampSeed = new BN(Math.floor(Date.now() / 1000));

      // Derive prediction PDA
      const [predictionPda] = derivePredictionPda(
        authorityPubkey,
        marketIdHash,
        timestampSeed
      );

      // Build transaction with blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

      const transaction = new Transaction();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = authorityPubkey;

      // If forecaster not initialized, add init instruction FIRST
      if (needsInit) {
        const initDiscriminator = Buffer.from([16, 22, 244, 53, 163, 61, 216, 211]);
        transaction.add({
          programId: PROGRAM_ID,
          keys: [
            { pubkey: authorityPubkey, isSigner: true, isWritable: true },
            { pubkey: forecasterStatePda, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: initDiscriminator,
        });
      }

      // Build record prediction instruction
      const recordDiscriminator = Buffer.from([6, 250, 152, 187, 248, 58, 42, 136]);

      // Encode arguments: market_id[32] + timestamp_seed[8] + probability[8] + direction[1] + memo[64] + category[1]
      const argsBuffer = Buffer.alloc(32 + 8 + 8 + 1 + 64 + 1);
      let offset = 0;

      marketIdHash.copy(argsBuffer, offset);
      offset += 32;

      argsBuffer.writeBigInt64LE(BigInt(timestampSeed.toString()), offset);
      offset += 8;

      argsBuffer.writeDoubleLE(predictedProbability, offset);
      offset += 8;

      argsBuffer.writeUInt8(direction.toLowerCase() === 'yes' ? 0 : 1, offset);
      offset += 1;

      // memo_tx_signature [64 bytes] - zeros
      offset += 64;

      argsBuffer.writeUInt8(category || 0, offset);

      const recordInstructionData = Buffer.concat([recordDiscriminator, argsBuffer]);

      // Add record instruction
      transaction.add({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: authorityPubkey, isSigner: true, isWritable: true },
          { pubkey: forecasterStatePda, isSigner: false, isWritable: true },
          { pubkey: predictionPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: recordInstructionData,
      });

      const serialized = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      return NextResponse.json({
        success: true,
        data: {
          transaction: serialized.toString('base64'),
          forecasterPda: forecasterStatePda.toBase58(),
          predictionPda: predictionPda.toBase58(),
          timestampSeed: timestampSeed.toString(),
          includesInit: needsInit, // Let frontend know if init was included
        },
      });
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Calibration API] POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to build transaction',
      },
      { status: 500 }
    );
  }
}
