export type CapitalNumberContext = 'compact' | 'detailed';

const USDC_SCALE = 1_000_000;

export function atomicToUiAmount(value: string | null | undefined): number | null {
  if (value == null || !/^-?\d+$/.test(value)) return null;
  const amount = Number(value) / USDC_SCALE;
  return Number.isFinite(amount) ? amount : null;
}

export function formatCapitalUsd(
  value: number | null | undefined,
  context: CapitalNumberContext = 'compact',
  signed = false,
): string {
  if (value == null || !Number.isFinite(value)) return '--';
  const normalized = Object.is(value, -0) ? 0 : value;
  const absolute = Math.abs(normalized);
  if (normalized === 0) return '$0.00';
  const sign = normalized < 0 ? '-' : signed ? '+' : '';
  if (absolute < 0.01) return `${sign}<$0.01`;
  if (context === 'compact' && absolute >= 1_000) {
    const units = [
      { amount: 1_000_000_000_000, suffix: 'T' },
      { amount: 1_000_000_000, suffix: 'B' },
      { amount: 1_000_000, suffix: 'M' },
      { amount: 1_000, suffix: 'K' },
    ];
    const unit = units.find((candidate) => absolute >= candidate.amount);
    if (unit) {
      const abbreviated = (absolute / unit.amount).toFixed(1).replace(/\.0$/, '');
      return `${sign}$${abbreviated}${unit.suffix}`;
    }
  }
  return `${sign}$${absolute.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCapitalPercent(value: number | null | undefined, signed = false): string {
  if (value == null || !Number.isFinite(value)) return '--';
  const normalized = Object.is(value, -0) ? 0 : value;
  if (normalized === 0) return '0.00%';
  const absolute = Math.abs(normalized);
  const sign = normalized < 0 ? '-' : signed ? '+' : '';
  if (absolute < 0.01) return `${sign}<0.01%`;
  const decimals = absolute >= 1_000 ? 0 : absolute >= 100 ? 1 : 2;
  return `${sign}${absolute.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
}

export function formatCapitalShares(
  value: number | null | undefined,
  context: CapitalNumberContext = 'compact',
): string {
  if (value == null || !Number.isFinite(value)) return '--';
  const normalized = Object.is(value, -0) ? 0 : value;
  if (normalized === 0) return '0';
  const absolute = Math.abs(normalized);
  const sign = normalized < 0 ? '-' : '';
  if (context === 'compact' && absolute >= 1_000) {
    return `${sign}${formatCapitalUsd(absolute, 'compact').replace('$', '')}`;
  }
  const decimals = context === 'detailed' ? 6 : 4;
  return `${sign}${absolute.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })}`;
}

export function calculateSharePrice(totalAssetsAtomic: string, totalSharesAtomic: string): number | null {
  const assets = atomicToUiAmount(totalAssetsAtomic);
  const shares = atomicToUiAmount(totalSharesAtomic);
  if (assets == null || shares == null) return null;
  if (shares === 0) return 1;
  return assets / shares;
}
