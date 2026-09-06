import { getAddress } from 'ethers';
import { z } from 'zod';

const ethereumAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const numeric = z.number().finite();
const CURRENT_POSITION_MARKET_BATCH_SIZE = 90;
const MAX_GAMMA_MARKET_ENRICHMENTS = 500;
const POSITION_FETCH_CONCURRENCY = 4;
const MAX_FULL_HISTORY_MARKETS = 25_000;
const BOUNDED_POSITION_RECORDS = 5_000;

const profileSchema = z.object({
  createdAt: z.string().nullable().optional(),
  proxyWallet: ethereumAddress.nullable().optional(),
  displayUsernamePublic: z.boolean().nullable().optional(),
  pseudonym: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  verifiedBadge: z.boolean().nullable().optional(),
}).passthrough();

const tradeSchema = z.object({
  proxyWallet: ethereumAddress,
  side: z.enum(['BUY', 'SELL']),
  asset: z.string().min(1),
  conditionId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  size: numeric.nonnegative(),
  price: numeric.min(0).max(1),
  timestamp: z.number().int().nonnegative(),
  title: z.string(),
  slug: z.string(),
  eventSlug: z.string(),
  outcome: z.string(),
  outcomeIndex: z.number().int().nonnegative(),
  transactionHash: z.string().min(1),
}).passthrough();

const positionSchema = z.object({
  proxyWallet: ethereumAddress,
  asset: z.string().min(1),
  conditionId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  avgPrice: numeric.min(0).max(1),
  totalBought: numeric.nonnegative(),
  realizedPnl: numeric.optional().default(0),
  curPrice: numeric.min(0).max(1),
  title: z.string(),
  slug: z.string(),
  eventSlug: z.string(),
  outcome: z.string(),
  outcomeIndex: z.number().int().nonnegative(),
  oppositeOutcome: z.string(),
  oppositeAsset: z.string(),
  endDate: z.string(),
  timestamp: z.number().int().nonnegative().optional(),
  size: numeric.nonnegative().optional(),
  redeemable: z.boolean().optional(),
}).passthrough();

const marketSchema = z.object({
  id: z.string(),
  question: z.string().nullable().optional(),
  conditionId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  slug: z.string().nullable().optional(),
  resolutionSource: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  outcomes: z.string().nullable().optional(),
  outcomePrices: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  closed: z.boolean().optional(),
  closedTime: z.string().nullable().optional(),
  umaEndDate: z.string().nullable().optional(),
  umaResolutionStatus: z.string().nullable().optional(),
}).passthrough();

export type PolymarketProfile = z.infer<typeof profileSchema>;
export type PolymarketTrade = z.infer<typeof tradeSchema>;
export type PolymarketPosition = z.infer<typeof positionSchema>;
export type PolymarketMarket = z.infer<typeof marketSchema>;

export interface PolymarketHistory {
  address: string;
  profile: PolymarketProfile | null;
  trades: PolymarketTrade[];
  closedPositions: PolymarketPosition[];
  currentPositions: PolymarketPosition[];
  markets: PolymarketMarket[];
  reportedMarketCount: number | null;
  importMode?: 'complete' | 'bounded';
  fetchedAt: string;
}

interface PolymarketClientOptions {
  fetchImplementation?: typeof fetch;
  dataApiUrl?: string;
  gammaApiUrl?: string;
  retryCount?: number;
  tradePageSize?: number;
  tradeMaximumOffset?: number;
  now?: () => Date;
}

export class PolymarketProviderError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = 'PolymarketProviderError';
  }
}

export class PolymarketClient {
  private readonly fetchImplementation: typeof fetch;
  private readonly dataApiUrl: string;
  private readonly gammaApiUrl: string;
  private readonly retryCount: number;
  private readonly tradePageSize: number;
  private readonly tradeMaximumOffset: number;
  private readonly now: () => Date;

  constructor(options: PolymarketClientOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.dataApiUrl = options.dataApiUrl ?? 'https://data-api.polymarket.com';
    this.gammaApiUrl = options.gammaApiUrl ?? 'https://gamma-api.polymarket.com';
    this.retryCount = options.retryCount ?? 7;
    this.tradePageSize = options.tradePageSize ?? 1_000;
    this.tradeMaximumOffset = options.tradeMaximumOffset ?? 10_000;
    this.now = options.now ?? (() => new Date());
  }

  normalizeAddress(address: string): string {
    try {
      return getAddress(address).toLowerCase();
    } catch {
      throw new PolymarketProviderError('A valid 0x-prefixed Polymarket address is required', false);
    }
  }

  async fetchHistory(inputAddress: string): Promise<PolymarketHistory> {
    const address = this.normalizeAddress(inputAddress);
    const [profile, reportedMarketCount] = await Promise.all([
      this.fetchProfile(address),
      this.fetchReportedMarketCount(address),
    ]);
    if (reportedMarketCount !== null && reportedMarketCount > MAX_FULL_HISTORY_MARKETS) {
      return this.fetchBoundedHistory(address, profile, reportedMarketCount);
    }
    const [trades, closedPositions] = await Promise.all([
      this.fetchTradeHistory(address),
      this.fetchClosedPositions(address),
    ]);
    let currentPositions: PolymarketPosition[];
    try {
      currentPositions = await this.fetchPages('/positions', address, 500, 10_000, positionSchema, {
        sizeThreshold: '0',
        includeArchived: 'true',
      });
    } catch (error) {
      const hitOffsetLimit = error instanceof PolymarketProviderError
        && !error.retryable
        && error.message.startsWith('/positions exceeded Polymarket');
      if (!hitOffsetLimit) throw error;
      const tradedConditionIds = [...new Set([...trades, ...closedPositions]
        .map((record) => record.conditionId.toLowerCase()))];
      currentPositions = await this.fetchCurrentPositionsByMarket(address, tradedConditionIds);
    }
    const enrichmentIds = [...new Set([...currentPositions, ...closedPositions.slice().reverse()]
      .map((record) => record.conditionId.toLowerCase()))]
      .slice(0, MAX_GAMMA_MARKET_ENRICHMENTS);
    const markets = await this.fetchMarkets(enrichmentIds);
    return { address, profile, trades, closedPositions, currentPositions, markets, reportedMarketCount, importMode: 'complete', fetchedAt: new Date().toISOString() };
  }

  private async fetchBoundedHistory(
    address: string,
    profile: PolymarketProfile | null,
    reportedMarketCount: number,
  ): Promise<PolymarketHistory> {
    const [closedPositions, currentPositions] = await Promise.all([
      this.fetchBoundedPositionPages('/closed-positions', address, 50, BOUNDED_POSITION_RECORDS, {
        sortBy: 'TIMESTAMP',
        sortDirection: 'DESC',
      }),
      this.fetchBoundedPositionPages('/positions', address, 500, BOUNDED_POSITION_RECORDS, {
        sizeThreshold: '0',
        includeArchived: 'true',
        sortBy: 'CURRENT',
        sortDirection: 'DESC',
      }),
    ]);
    const enrichmentIds = [...new Set([...currentPositions, ...closedPositions]
      .map((record) => record.conditionId.toLowerCase()))]
      .slice(0, MAX_GAMMA_MARKET_ENRICHMENTS);
    const markets = await this.fetchMarkets(enrichmentIds);
    return {
      address,
      profile,
      trades: [],
      closedPositions,
      currentPositions,
      markets,
      reportedMarketCount,
      importMode: 'bounded',
      fetchedAt: new Date().toISOString(),
    };
  }

  private async fetchBoundedPositionPages(
    path: '/closed-positions' | '/positions',
    address: string,
    limit: number,
    maximumRecords: number,
    extra: Record<string, string>,
  ): Promise<PolymarketPosition[]> {
    const records: PolymarketPosition[] = [];
    const stride = limit * POSITION_FETCH_CONCURRENCY;
    for (let baseOffset = 0; baseOffset < maximumRecords; baseOffset += stride) {
      const offsets = Array.from(
        { length: POSITION_FETCH_CONCURRENCY },
        (_, index) => baseOffset + index * limit,
      ).filter((offset) => offset < maximumRecords);
      const pages = await Promise.all(offsets.map(async (offset) => {
        const url = new URL(path, this.dataApiUrl);
        url.searchParams.set('user', address);
        url.searchParams.set('limit', String(limit));
        url.searchParams.set('offset', String(offset));
        for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
        return z.array(positionSchema).parse(await this.request(url));
      }));
      const finalPageIndex = pages.findIndex((page) => page.length < limit);
      const completePages = finalPageIndex === -1 ? pages : pages.slice(0, finalPageIndex + 1);
      records.push(...completePages.flat());
      if (finalPageIndex !== -1) return records;
    }
    return records;
  }

  private async fetchCurrentPositionsByMarket(
    address: string,
    conditionIds: string[],
  ): Promise<PolymarketPosition[]> {
    const positions = new Map<string, PolymarketPosition>();
    const stride = CURRENT_POSITION_MARKET_BATCH_SIZE * POSITION_FETCH_CONCURRENCY;
    for (let index = 0; index < conditionIds.length; index += stride) {
      const requests = Array.from({ length: POSITION_FETCH_CONCURRENCY }, (_, requestIndex) => {
        const start = index + requestIndex * CURRENT_POSITION_MARKET_BATCH_SIZE;
        const marketBatch = conditionIds.slice(start, start + CURRENT_POSITION_MARKET_BATCH_SIZE);
        if (!marketBatch.length) return null;
        return this.fetchPages('/positions', address, 500, 500, positionSchema, {
          sizeThreshold: '0',
          includeArchived: 'true',
          market: marketBatch.join(','),
        });
      }).filter((request): request is Promise<PolymarketPosition[]> => request !== null);
      for (const batch of await Promise.all(requests)) {
        for (const position of batch) {
          positions.set(`${position.conditionId.toLowerCase()}/${position.asset}`, position);
        }
      }
    }
    return [...positions.values()];
  }

  private async fetchClosedPositions(address: string): Promise<PolymarketPosition[]> {
    const limit = 50;
    const maximumOffset = 100_000;
    const records: PolymarketPosition[] = [];
    const stride = limit * POSITION_FETCH_CONCURRENCY;
    for (let baseOffset = 0; baseOffset <= maximumOffset; baseOffset += stride) {
      const offsets = Array.from(
        { length: POSITION_FETCH_CONCURRENCY },
        (_, index) => baseOffset + index * limit,
      ).filter((offset) => offset <= maximumOffset);
      const pages = await Promise.all(offsets.map(async (offset) => {
        const url = new URL('/closed-positions', this.dataApiUrl);
        url.searchParams.set('user', address);
        url.searchParams.set('limit', String(limit));
        url.searchParams.set('offset', String(offset));
        url.searchParams.set('sortBy', 'TIMESTAMP');
        url.searchParams.set('sortDirection', 'ASC');
        return z.array(positionSchema).parse(await this.request(url));
      }));
      const finalPageIndex = pages.findIndex((page) => page.length < limit);
      const completePages = finalPageIndex === -1 ? pages : pages.slice(0, finalPageIndex + 1);
      records.push(...completePages.flat());
      if (finalPageIndex !== -1) return records;
    }
    throw new PolymarketProviderError(
      `/closed-positions exceeded Polymarket's pagination limit; refusing to publish an incomplete Passport`,
      false,
    );
  }

  private async fetchProfile(address: string): Promise<PolymarketProfile | null> {
    const url = new URL('/public-profile', this.gammaApiUrl);
    url.searchParams.set('address', address);
    const response = await this.request(url, true);
    if (response === null) return null;
    return profileSchema.parse(response);
  }

  private async fetchReportedMarketCount(address: string): Promise<number | null> {
    const url = new URL('/traded', this.dataApiUrl);
    url.searchParams.set('user', address);
    const response = await this.request(url, true);
    if (response === null) return null;
    const parsed = z.object({ traded: z.number().int().nonnegative() }).safeParse(response);
    return parsed.success ? parsed.data.traded : null;
  }

  private tradeIdentity(trade: PolymarketTrade): string {
    return [
      trade.transactionHash.toLowerCase(), trade.conditionId.toLowerCase(), trade.asset,
      trade.side, trade.size, trade.price, trade.timestamp, trade.outcomeIndex,
    ].join('/');
  }

  private async fetchTradeHistory(address: string): Promise<PolymarketTrade[]> {
    const end = Math.max(1, Math.floor(this.now().getTime() / 1_000) + 1);
    const records = await this.fetchTradeWindow(address, 1, end);
    const unique = new Map(records.map((trade) => [this.tradeIdentity(trade), trade]));
    return [...unique.values()].sort((left, right) =>
      left.timestamp - right.timestamp || this.tradeIdentity(left).localeCompare(this.tradeIdentity(right)));
  }

  private async fetchTradeWindow(address: string, start: number, end: number): Promise<PolymarketTrade[]> {
    const records: PolymarketTrade[] = [];
    // Split as soon as the pages below the provider's maximum offset are
    // saturated. Polymarket may return HTTP 500 at the exact offset boundary,
    // and that boundary request is unnecessary to prove the window needs
    // partitioning.
    for (let offset = 0; offset < this.tradeMaximumOffset; offset += this.tradePageSize) {
      const url = new URL('/trades', this.dataApiUrl);
      url.searchParams.set('user', address);
      url.searchParams.set('limit', String(this.tradePageSize));
      url.searchParams.set('offset', String(offset));
      url.searchParams.set('takerOnly', 'false');
      url.searchParams.set('start', String(start));
      url.searchParams.set('end', String(end));
      const page = z.array(tradeSchema).parse(await this.request(url));
      records.push(...page);
      if (page.length < this.tradePageSize) return records;
    }

    if (start >= end) {
      throw new PolymarketProviderError(
        `/trades contains more than ${records.length} records at timestamp ${start}; the public API cannot enumerate that second completely`,
        false,
      );
    }
    const midpoint = start + Math.floor((end - start) / 2);
    // Keep recursive backfills sequential so very large accounts cannot create an
    // exponential burst of requests when several adjacent windows are saturated.
    const older = await this.fetchTradeWindow(address, start, midpoint);
    const newer = await this.fetchTradeWindow(address, midpoint + 1, end);
    return [...older, ...newer];
  }

  private async fetchPages<T>(
    path: string,
    address: string,
    limit: number,
    maximumOffset: number,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    extra: Record<string, string>,
  ): Promise<T[]> {
    const records: T[] = [];
    for (let offset = 0; offset <= maximumOffset; offset += limit) {
      const url = new URL(path, this.dataApiUrl);
      url.searchParams.set('user', address);
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('offset', String(offset));
      for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
      const page = z.array(schema).parse(await this.request(url));
      records.push(...page);
      if (page.length < limit) return records;
      if (offset + limit > maximumOffset) {
        throw new PolymarketProviderError(`${path} exceeded Polymarket's pagination limit; refusing to publish an incomplete Passport`, false);
      }
    }
    return records;
  }

  private async fetchMarkets(conditionIds: string[]): Promise<PolymarketMarket[]> {
    const markets = new Map<string, PolymarketMarket>();
    for (let index = 0; index < conditionIds.length; index += 20) {
      const batch = conditionIds.slice(index, index + 20);
      for (const closed of ['false', 'true']) {
        const url = new URL('/markets', this.gammaApiUrl);
        for (const conditionId of batch) url.searchParams.append('condition_ids', conditionId);
        url.searchParams.set('closed', closed);
        url.searchParams.set('limit', String(batch.length));
        const response = z.array(marketSchema).parse(await this.request(url));
        for (const market of response) markets.set(market.conditionId.toLowerCase(), market);
      }
    }
    return [...markets.values()];
  }

  private async request(url: URL, allowNotFound = false): Promise<unknown | null> {
    const requestWindow = ['offset', 'start', 'end']
      .flatMap((name) => url.searchParams.get(name) ? [`${name}=${url.searchParams.get(name)}`] : [])
      .join(', ');
    const requestLabel = requestWindow ? `${url.pathname} (${requestWindow})` : url.pathname;
    let lastError: unknown;
    for (let attempt = 0; attempt < this.retryCount; attempt += 1) {
      try {
        const response = await this.fetchImplementation(url, {
          headers: { Accept: 'application/json', 'User-Agent': 'BeRight-Polymarket-Passport/1.0' },
          signal: AbortSignal.timeout(30_000),
        });
        if (allowNotFound && response.status === 404) return null;
        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;
          if (!retryable) throw new PolymarketProviderError(`Polymarket returned HTTP ${response.status} for ${requestLabel}`, false);
          throw new PolymarketProviderError(`Polymarket temporarily returned HTTP ${response.status} for ${requestLabel}`, true);
        }
        const responseBody = await response.text();
        if (!responseBody.trim()) {
          throw new PolymarketProviderError(
            `Polymarket returned an empty response for ${requestLabel} (HTTP ${response.status})`,
            true,
          );
        }
        try {
          return JSON.parse(responseBody) as unknown;
        } catch {
          throw new PolymarketProviderError(
            `Polymarket returned invalid JSON for ${requestLabel} (HTTP ${response.status})`,
            true,
          );
        }
      } catch (error) {
        lastError = error;
        if (error instanceof PolymarketProviderError && !error.retryable) throw error;
        if (attempt + 1 < this.retryCount) {
          await new Promise((resolve) => setTimeout(resolve, Math.min(8_000, 500 * 2 ** attempt)));
        }
      }
    }
    if (lastError instanceof PolymarketProviderError) throw lastError;
    const detail = lastError instanceof Error ? `: ${lastError.message}` : '';
    throw new PolymarketProviderError(
      `Polymarket request failed after ${this.retryCount} attempts for ${requestLabel}${detail}`,
      true,
    );
  }
}
