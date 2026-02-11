/**
 * Solana Signer Utilities
 *
 * Provides secure wallet signing functionality using secrets manager
 */

import { Connection, Keypair } from '@solana/web3.js';
import { secrets } from './secrets';

/**
 * Solana signer interface
 */
export interface SolanaSigner {
  getConnection(): Connection;
  getKeypair(): Keypair;
  getPublicKey(): string;
}

/**
 * Default signer implementation using secrets manager
 */
class DefaultSolanaSigner implements SolanaSigner {
  private connection: Connection | null = null;
  private keypair: Keypair | null = null;

  getConnection(): Connection {
    if (!this.connection) {
      const rpcUrl = secrets.getHeliusRpcUrl();
      this.connection = new Connection(rpcUrl, 'confirmed');
    }
    return this.connection;
  }

  getKeypair(): Keypair {
    if (!this.keypair) {
      const privateKey = secrets.getSolanaPrivateKey();
      this.keypair = Keypair.fromSecretKey(privateKey);
    }
    return this.keypair;
  }

  getPublicKey(): string {
    return this.getKeypair().publicKey.toBase58();
  }
}

// Singleton instance
let signerInstance: SolanaSigner | null = null;

/**
 * Get the current signer instance
 */
export function getSigner(): SolanaSigner {
  if (!signerInstance) {
    secrets.initialize();
    signerInstance = new DefaultSolanaSigner();
  }
  return signerInstance;
}

/**
 * Set a custom signer (for testing)
 */
export function setSigner(signer: SolanaSigner): void {
  signerInstance = signer;
}

/**
 * Reset signer to default
 */
export function resetSigner(): void {
  signerInstance = null;
}
