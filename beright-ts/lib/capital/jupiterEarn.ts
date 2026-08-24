import BN from 'bn.js';
import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { lendingPda } from '@jup-ag/lend';
import {
  getDepositIxs,
  getLendingTokenDetails,
  getRedeemIxs,
  getUserLendingPositionByAsset,
  getWithdrawIxs,
} from '@jup-ag/lend/earn';
import type {
  JupiterEarnAction,
  JupiterEarnPosition,
  PreparedCapitalTransaction,
} from './types';

export const MAINNET_USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // pragma: allowlist secret
export const JUPITER_LEND_PROGRAM_ID = lendingPda.getLendingProgramId('main');

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const DEFAULT_MAX_USDC_ATOMIC = 10_000_000_000n;

const ALLOWED_PROGRAM_IDS = new Set([
  JUPITER_LEND_PROGRAM_ID.toBase58(),
  TOKEN_PROGRAM_ID.toBase58(),
  ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(),
  SystemProgram.programId.toBase58(),
  ComputeBudgetProgram.programId.toBase58(),
  MEMO_PROGRAM_ID.toBase58(),
]);

interface PrepareJupiterEarnInput {
  action: JupiterEarnAction;
  wallet: string;
  amountAtomic: string;
  connection?: Connection;
}

function parsePositiveAtomicAmount(value: string): bigint {
  if (!/^[1-9]\d*$/.test(value)) throw new Error('amountAtomic must be a positive integer string.');
  const amount = BigInt(value);
  const configuredMaximum = process.env.CAPITAL_STRATEGY_MAX_USDC_ATOMIC;
  const maximum = configuredMaximum && /^[1-9]\d*$/.test(configuredMaximum)
    ? BigInt(configuredMaximum)
    : DEFAULT_MAX_USDC_ATOMIC;
  if (amount > maximum) throw new Error(`amountAtomic exceeds the configured transaction cap of ${maximum}.`);
  return amount;
}

function getCapitalRpcUrl(): string {
  const url = process.env.CAPITAL_STRATEGY_RPC_URL ?? process.env.SOLANA_RPC_URL;
  if (!url) throw new Error('CAPITAL_STRATEGY_RPC_URL or SOLANA_RPC_URL must be configured.');
  return url;
}

export function validateJupiterEarnInstructions(
  instructions: TransactionInstruction[],
  wallet: PublicKey,
): string[] {
  if (instructions.length === 0) throw new Error('Jupiter returned no transaction instructions.');

  let hasJupiterInstruction = false;
  let walletMustSign = false;
  const programIds = new Set<string>();

  for (const instruction of instructions) {
    const programId = instruction.programId.toBase58();
    if (!ALLOWED_PROGRAM_IDS.has(programId)) {
      throw new Error(`Jupiter instruction uses an unapproved program: ${programId}.`);
    }
    programIds.add(programId);
    hasJupiterInstruction ||= programId === JUPITER_LEND_PROGRAM_ID.toBase58();

    for (const key of instruction.keys) {
      if (key.isSigner && !key.pubkey.equals(wallet)) {
        throw new Error(`Jupiter instruction requests an unexpected signer: ${key.pubkey.toBase58()}.`);
      }
      walletMustSign ||= key.isSigner && key.pubkey.equals(wallet);
    }
  }

  if (!hasJupiterInstruction) throw new Error('Transaction does not contain a Jupiter Lend instruction.');
  if (!walletMustSign) throw new Error('Transaction does not require the requested wallet signature.');
  return [...programIds];
}

async function getActionInstructions(
  action: JupiterEarnAction,
  amount: bigint,
  wallet: PublicKey,
  connection: Connection,
): Promise<TransactionInstruction[]> {
  const params = {
    amount: new BN(amount.toString()),
    asset: MAINNET_USDC_MINT,
    signer: wallet,
    connection,
    market: 'main' as const,
  };

  if (action === 'deposit') return (await getDepositIxs(params)).ixs;
  if (action === 'withdraw') return (await getWithdrawIxs(params)).ixs;
  return (await getRedeemIxs({
    shares: params.amount,
    asset: params.asset,
    signer: params.signer,
    connection: params.connection,
    market: params.market,
  })).ixs;
}

export async function prepareJupiterEarnTransaction(
  input: PrepareJupiterEarnInput,
): Promise<PreparedCapitalTransaction> {
  const amount = parsePositiveAtomicAmount(input.amountAtomic);
  const wallet = new PublicKey(input.wallet);
  const connection = input.connection ?? new Connection(getCapitalRpcUrl(), 'confirmed');
  const instructions = await getActionInstructions(input.action, amount, wallet, connection);
  const programIds = validateJupiterEarnInstructions(instructions, wallet);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const message = new TransactionMessage({
    payerKey: wallet,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();
  const transaction = new VersionedTransaction(message);

  return {
    provider: 'jupiter_earn',
    action: input.action,
    asset: 'USDC',
    amountAtomic: amount.toString(),
    wallet: wallet.toBase58(),
    transaction: Buffer.from(transaction.serialize()).toString('base64'),
    encoding: 'base64',
    messageVersion: 'v0',
    recentBlockhash: blockhash,
    lastValidBlockHeight,
    programIds,
    requiresWalletSignature: true,
    serverSigned: false,
    serverSubmits: false,
  };
}

function bpsRateToPercent(rate: BN): number {
  const value = Number(rate.toString());
  if (!Number.isSafeInteger(value)) throw new Error('Jupiter returned an unsafe rate value.');
  return value / 100;
}

export async function getJupiterEarnPosition(
  walletAddress: string,
  connection = new Connection(getCapitalRpcUrl(), 'confirmed'),
): Promise<JupiterEarnPosition> {
  const wallet = new PublicKey(walletAddress);
  const lendingToken = lendingPda.getLendingToken(MAINNET_USDC_MINT, 'main');
  const [position, details] = await Promise.all([
    getUserLendingPositionByAsset({
      user: wallet,
      asset: MAINNET_USDC_MINT,
      connection,
      market: 'main',
    }),
    getLendingTokenDetails({ lendingToken, connection, market: 'main' }),
  ]);

  if (!details.asset.equals(MAINNET_USDC_MINT)) {
    throw new Error('Jupiter lending-token metadata does not resolve to mainnet USDC.');
  }

  return {
    provider: 'jupiter_earn',
    asset: 'USDC',
    wallet: wallet.toBase58(),
    lendingToken: lendingToken.toBase58(),
    sharesAtomic: position.lendingTokenShares.toString(),
    underlyingAssetsAtomic: position.underlyingAssets.toString(),
    walletUnderlyingBalanceAtomic: position.underlyingBalance.toString(),
    supplyApyPct: bpsRateToPercent(details.supplyRate),
    rewardsApyPct: bpsRateToPercent(details.rewardsRate),
    asOf: new Date().toISOString(),
  };
}
