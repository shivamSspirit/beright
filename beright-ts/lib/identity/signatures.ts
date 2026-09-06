import { getAddress, verifyMessage } from 'ethers';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';

export function verifyEthereumOwnershipSignature(input: {
  message: string;
  signature: string;
  expectedAddress: string;
}): boolean {
  try {
    const recoveredAddress = verifyMessage(input.message, input.signature);
    return getAddress(recoveredAddress) === getAddress(input.expectedAddress);
  } catch {
    return false;
  }
}

export function verifySolanaOwnershipSignature(input: {
  message: string;
  signature: string;
  expectedAddress: string;
}): boolean {
  try {
    const signatureBytes = bs58.decode(input.signature);
    if (signatureBytes.length !== nacl.sign.signatureLength) return false;
    const publicKeyBytes = new PublicKey(input.expectedAddress).toBytes();
    return nacl.sign.detached.verify(new TextEncoder().encode(input.message), signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}
