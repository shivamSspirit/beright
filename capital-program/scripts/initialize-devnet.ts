import { BN, BorshInstructionCoder, type Idl } from '@coral-xyz/anchor';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import capitalIdlJson from '../target/idl/berightcapital.json';

const PROGRAM_ID = new PublicKey('F2WkXzns4p5pe8NAuK6V5NhZ4bdpXxAE9h5kLAMtxqCT');
const BPF_LOADER_UPGRADEABLE_PROGRAM_ID = new PublicKey(
  'BPFLoaderUpgradeab1e11111111111111111111111',
);
const DEVNET_USDC_MINT = new PublicKey(
  process.env.CAPITAL_DEVNET_USDC_MINT ?? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // pragma: allowlist secret
);
const CONFIG_SEED = Buffer.from('capital-config');

async function main(): Promise<void> {
  requireDevnetRpc();
  const rpcUrl = process.env.CAPITAL_DEVNET_RPC_URL ?? 'https://api.devnet.solana.com';
  const keypairPath = resolve(
    process.cwd(),
    process.env.CAPITAL_DEPLOYER_KEYPAIR ?? 'devnet-deployer.keypair.json',
  );
  const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(keypairPath, 'utf8'))));
  const connection = new Connection(rpcUrl, 'confirmed');
  const [config] = PublicKey.findProgramAddressSync([CONFIG_SEED], PROGRAM_ID);
  const existing = await connection.getAccountInfo(config, 'confirmed');
  if (existing) {
    if (!existing.owner.equals(PROGRAM_ID)) throw new Error('The config PDA is owned by an unexpected program.');
    console.log(`Capital protocol already initialized: ${config.toBase58()}`);
    return;
  }
  const [programData] = PublicKey.findProgramAddressSync(
    [PROGRAM_ID.toBuffer()],
    BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
  );
  const coder = new BorshInstructionCoder(capitalIdlJson as unknown as Idl);
  const data = coder.encode('initialize_protocol', {
    params: {
      emergency_authority: payer.publicKey,
      strategy_authority: payer.publicKey,
      oracle_authority: payer.publicKey,
      strategy_delay_seconds: new BN(86_400),
    },
  });
  const transaction = new Transaction().add({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: programData, isSigner: false, isWritable: false },
      { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: DEVNET_USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
  const signature = await sendAndConfirmTransaction(connection, transaction, [payer], {
    commitment: 'confirmed',
  });
  console.log(`Capital protocol initialized: ${config.toBase58()}`);
  console.log(`Transaction: ${signature}`);
}

function requireDevnetRpc(): void {
  const rpcUrl = process.env.CAPITAL_DEVNET_RPC_URL ?? 'https://api.devnet.solana.com';
  if (!rpcUrl.toLowerCase().includes('devnet')) {
    throw new Error('Refusing to initialize Capital against a non-devnet RPC URL.');
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
