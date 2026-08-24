import { USDC_MINT } from '../dflow';
import type { CapitalYieldRate } from './types';

interface JupiterTokenSearchResult {
  id?: string;
  address?: string;
  apy?: {
    jupEarn?: number;
  };
}

const JUPITER_TOKEN_SEARCH_URL = 'https://api.jup.ag/tokens/v2/search';

function unavailable(message: string, now: Date): CapitalYieldRate {
  return {
    apyPct: null,
    source: 'unavailable',
    asset: 'USDC',
    asOf: now.toISOString(),
    isEstimate: true,
    message,
  };
}

export async function getUsdcYieldRate(options: {
  demoMode?: boolean;
  now?: Date;
  fetchImpl?: typeof fetch;
} = {}): Promise<CapitalYieldRate> {
  const now = options.now ?? new Date();
  if (options.demoMode) {
    return {
      apyPct: 6.2,
      source: 'demo_model',
      asset: 'USDC',
      asOf: now.toISOString(),
      isEstimate: true,
      message: 'Modeled rate for product demonstration only.',
    };
  }

  const apiKey = process.env.JUPITER_PREDICTION_API_KEY || process.env.JUPITER_API_KEY;
  if (!apiKey) {
    return unavailable('Jupiter API key is not configured.', now);
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const query = new URLSearchParams({ query: USDC_MINT });
    const response = await fetchImpl(`${JUPITER_TOKEN_SEARCH_URL}?${query.toString()}`, {
      headers: { 'x-api-key': apiKey },
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 60 },
    });
    if (!response.ok) {
      return unavailable(`Jupiter rate request failed with HTTP ${response.status}.`, now);
    }

    const payload = await response.json() as JupiterTokenSearchResult[];
    const usdc = payload.find((token) => token.id === USDC_MINT || token.address === USDC_MINT);
    const apyPct = usdc?.apy?.jupEarn;
    if (typeof apyPct !== 'number' || !Number.isFinite(apyPct) || apyPct < 0 || apyPct > 100) {
      return unavailable('Jupiter did not return a valid USDC Earn rate.', now);
    }

    return {
      apyPct,
      source: 'jupiter_earn',
      asset: 'USDC',
      asOf: now.toISOString(),
      isEstimate: true,
      message: 'Variable rate reported by Jupiter Earn; future returns are not guaranteed.',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown rate provider error.';
    return unavailable(`Jupiter rate unavailable: ${message}`, now);
  }
}
