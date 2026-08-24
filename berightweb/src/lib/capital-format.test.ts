import {
  atomicToUiAmount,
  formatCapitalPercent,
  formatCapitalShares,
  formatCapitalUsd,
} from './capital-format';

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
}

assertEqual(formatCapitalUsd(0), '$0.00', 'Fiat zero');
assertEqual(formatCapitalUsd(-0), '$0.00', 'Signed zero');
assertEqual(formatCapitalUsd(0.004), '<$0.01', 'Tiny fiat');
assertEqual(formatCapitalUsd(1_234.5), '$1.2K', 'Compact fiat');
assertEqual(formatCapitalUsd(1_234.5, 'detailed'), '$1,234.50', 'Detailed fiat');
assertEqual(formatCapitalPercent(0.004), '<0.01%', 'Tiny percent');
assertEqual(formatCapitalShares(1_234.5), '1.2K', 'Compact shares');
assertEqual(atomicToUiAmount('1000000000'), 1_000, 'USDC atomic conversion');
assertEqual(formatCapitalUsd(Number.NaN), '--', 'Invalid number placeholder');

console.log('✓ Capital number formatting');
