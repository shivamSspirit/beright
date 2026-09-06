import { hashCanonicalJson, sha256Hex } from '../protocol/v1/canonical';
import type { ForecastReceiptV1 } from '../protocol/v1/schemas';

export interface MerkleProofStep { position: 'left' | 'right'; hash: string }

export interface EvidenceMerkleTree {
  root: string;
  leafHashes: string[];
  receiptIds: string[];
  proofs: Record<string, MerkleProofStep[]>;
}

export function hashReceiptLeaf(receipt: ForecastReceiptV1): string {
  return hashCanonicalJson({ leafVersion: 'evidence-leaf/v1', receipt });
}

function hashPair(left: string, right: string): string {
  return sha256Hex(Buffer.concat([Buffer.from(left, 'hex'), Buffer.from(right, 'hex')]));
}

export function buildEvidenceMerkleTree(receipts: ForecastReceiptV1[]): EvidenceMerkleTree {
  const ordered = [...receipts].sort((left, right) => left.receiptId.localeCompare(right.receiptId));
  if (ordered.length === 0) {
    return { root: sha256Hex('evidence-tree/v1:empty'), leafHashes: [], receiptIds: [], proofs: {} };
  }
  const leafHashes = ordered.map(hashReceiptLeaf);
  const proofsByIndex: MerkleProofStep[][] = leafHashes.map(() => []);
  let level = leafHashes.map((hash, index) => ({ hash, indexes: [index] }));
  while (level.length > 1) {
    const next: typeof level = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] ?? left;
      for (const leafIndex of left.indexes) proofsByIndex[leafIndex].push({ position: 'right', hash: right.hash });
      if (right !== left) for (const leafIndex of right.indexes) proofsByIndex[leafIndex].push({ position: 'left', hash: left.hash });
      next.push({ hash: hashPair(left.hash, right.hash), indexes: right === left ? [...left.indexes] : [...left.indexes, ...right.indexes] });
    }
    level = next;
  }
  return {
    root: level[0].hash,
    leafHashes,
    receiptIds: ordered.map((receipt) => receipt.receiptId),
    proofs: Object.fromEntries(ordered.map((receipt, index) => [receipt.receiptId, proofsByIndex[index]])),
  };
}

export function verifyReceiptInclusion(receipt: ForecastReceiptV1, proof: MerkleProofStep[], root: string): boolean {
  let hash = hashReceiptLeaf(receipt);
  for (const step of proof) hash = step.position === 'left' ? hashPair(step.hash, hash) : hashPair(hash, step.hash);
  return hash === root;
}
