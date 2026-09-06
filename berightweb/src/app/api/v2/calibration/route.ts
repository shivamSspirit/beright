import { NextRequest, NextResponse } from 'next/server';
import { BN } from '@coral-xyz/anchor';
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import calibrationIdl from '@/lib/calibration-idl.json';

const DEVNET_RPC = process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey(calibrationIdl.address);
const INITIALIZE_DISCRIMINATOR = Buffer.from([16, 22, 244, 53, 163, 61, 216, 211]);
const RECORD_DISCRIMINATOR = Buffer.from([6, 250, 152, 187, 248, 58, 42, 136]);

export const dynamic = 'force-dynamic';

function deriveForecasterPda(forecaster: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('forecaster_v2'), forecaster.toBuffer()], PROGRAM_ID)[0];
}

function derivePredictionPda(forecaster: PublicKey, marketId: Buffer, timestamp: BN): PublicKey {
  const timestampBuffer = Buffer.alloc(8);
  timestampBuffer.writeBigInt64LE(BigInt(timestamp.toString()));
  return PublicKey.findProgramAddressSync(
    [Buffer.from('prediction'), forecaster.toBuffer(), marketId, timestampBuffer],
    PROGRAM_ID,
  )[0];
}

function marketIdBytes(marketId: string): Buffer {
  const result = Buffer.alloc(32);
  Buffer.from(marketId, 'utf8').copy(result, 0, 0, 32);
  return result;
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: {
        code: 'LEGACY_SCORING_RETIRED',
        message: 'The calibration score API is retired. Use the Polymarket Passport API.',
      },
    },
    { status: 410 },
  );
}

/**
 * Retains only the wallet-signed forecast recorder used by execution screens.
 * It builds an unsigned devnet transaction and does not calculate reputation.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action !== 'record' || typeof body.authority !== 'string') {
      return NextResponse.json({ success: false, error: 'Only the record action is supported' }, { status: 400 });
    }
    if (typeof body.marketId !== 'string' || body.marketId.length === 0
      || typeof body.predictedProbability !== 'number' || !Number.isFinite(body.predictedProbability)
      || body.predictedProbability < 0 || body.predictedProbability > 1
      || (body.direction !== 'yes' && body.direction !== 'no')) {
      return NextResponse.json({ success: false, error: 'Invalid forecast parameters' }, { status: 400 });
    }

    let authority: PublicKey;
    try {
      authority = new PublicKey(body.authority);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid authority address' }, { status: 400 });
    }

    const category = typeof body.category === 'number' && Number.isInteger(body.category)
      ? Math.max(0, Math.min(255, body.category))
      : 0;
    const connection = new Connection(DEVNET_RPC, 'confirmed');
    const forecasterPda = deriveForecasterPda(authority);
    const needsInitialization = await connection.getAccountInfo(forecasterPda, 'confirmed') === null;
    const marketId = marketIdBytes(body.marketId);
    const timestamp = new BN(Math.floor(Date.now() / 1000));
    const predictionPda = derivePredictionPda(authority, marketId, timestamp);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    const transaction = new Transaction({ blockhash, lastValidBlockHeight, feePayer: authority });

    if (needsInitialization) {
      transaction.add(new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: authority, isSigner: true, isWritable: true },
          { pubkey: forecasterPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: INITIALIZE_DISCRIMINATOR,
      }));
    }

    const args = Buffer.alloc(32 + 8 + 8 + 1 + 64 + 1);
    let offset = 0;
    marketId.copy(args, offset); offset += 32;
    args.writeBigInt64LE(BigInt(timestamp.toString()), offset); offset += 8;
    args.writeDoubleLE(body.predictedProbability, offset); offset += 8;
    args.writeUInt8(body.direction === 'yes' ? 0 : 1, offset); offset += 1;
    offset += 64;
    args.writeUInt8(category, offset);
    transaction.add(new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: forecasterPda, isSigner: false, isWritable: true },
        { pubkey: predictionPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([RECORD_DISCRIMINATOR, args]),
    }));

    return NextResponse.json({
      success: true,
      data: {
        transaction: transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64'),
        forecasterPda: forecasterPda.toBase58(),
        predictionPda: predictionPda.toBase58(),
        timestampSeed: timestamp.toString(),
        includesInit: needsInitialization,
      },
    });
  } catch (error) {
    console.error('[Forecast Recorder API]', error);
    return NextResponse.json({ success: false, error: 'Failed to build forecast transaction' }, { status: 500 });
  }
}
