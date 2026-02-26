/**
 * Tavily Client for BeRight Protocol
 *
 * Provides web search, content extraction, crawling, and deep research
 * capabilities for accurate, real-time information gathering.
 *
 * ARCHITECTURE: Graceful Degradation
 * 1. Tavily API (primary - high quality)
 * 2. DuckDuckGo Instant Answer (fallback - free, no API key)
 * 3. Empty results (graceful failure)
 *
 * Error Handling:
 * - Rate limits: Fallback to DuckDuckGo
 * - Quota exceeded: Fallback to DuckDuckGo
 * - Network errors: Return empty with warning
 *
 * API Docs: https://docs.tavily.com
 */

import { tavily, TavilyClient } from '@tavily/core';

// ============================================
// CONFIGURATION & VALIDATION
// ============================================

let _startupValidated = false;
let _tavilyAvailable = false;
let _tavilyError: string | null = null;

/**
 * Validate Tavily configuration at startup
 * Call this once when the app starts
 */
export function validateTavilyConfig(): { valid: boolean; error?: string } {
  const apiKey = process.env.TAVILY_API_KEY;

  if (apiKey) {
    _tavilyAvailable = true;
    console.log('[Tavily] ✓ API key configured');
    _startupValidated = true;
    return { valid: true };
  } else {
    _tavilyAvailable = false;
    _tavilyError = 'TAVILY_API_KEY not set';
    console.warn('[Tavily] ✗ API key not configured - will use fallback search');
    _startupValidated = true;
    return { valid: false, error: _tavilyError };
  }
}

/**
 * Check if Tavily had a recent error (for circuit breaker pattern)
 */
let _lastTavilyError: { time: number; message: string } | null = null;
const CIRCUIT_BREAKER_MS = 60000; // 1 minute cooldown after errors

function shouldSkipTavily(): boolean {
  if (!_tavilyAvailable) return true;
  if (_lastTavilyError && Date.now() - _lastTavilyError.time < CIRCUIT_BREAKER_MS) {
    console.log(`[Tavily] Circuit breaker active - skipping (${_lastTavilyError.message})`);
    return true;
  }
  return false;
}

function recordTavilyError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  _lastTavilyError = { time: Date.now(), message };

  // Detect quota/rate limit errors for longer cooldown
  if (message.includes('usage limit') || message.includes('rate limit') || message.includes('quota')) {
    console.warn(`[Tavily] Quota/rate limit hit - circuit breaker engaged for ${CIRCUIT_BREAKER_MS / 1000}s`);
  }
}

// ============================================
// FALLBACK SEARCH (DuckDuckGo)
// ============================================

interface FallbackSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

/**
 * Fallback search using DuckDuckGo Instant Answer API
 * Free, no API key required, but limited capabilities
 */
async function fallbackSearch(query: string): Promise<{
  results: FallbackSearchResult[];
  answer?: string;
  provider: 'duckduckgo' | 'none';
}> {
  try {
    // DuckDuckGo Instant Answer API (free, no key needed)
    const encoded = encodeURIComponent(query);
    const url = `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'BeRight/1.0' },
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo ${response.status}`);
    }

    const data = await response.json() as {
      Abstract?: string;
      AbstractText?: string;
      AbstractURL?: string;
      AbstractSource?: string;
      RelatedTopics?: Array<{
        Text?: string;
        FirstURL?: string;
      }>;
      Results?: Array<{
        Text?: string;
        FirstURL?: string;
      }>;
    };

    const results: FallbackSearchResult[] = [];

    // Extract from abstract
    if (data.AbstractText && data.AbstractURL) {
      results.push({
        title: data.AbstractSource || 'Summary',
        url: data.AbstractURL,
        content: data.AbstractText,
        score: 1.0,
      });
    }

    // Extract from results
    for (const r of (data.Results || [])) {
      if (r.Text && r.FirstURL) {
        results.push({
          title: r.Text.slice(0, 100),
          url: r.FirstURL,
          content: r.Text,
          score: 0.8,
        });
      }
    }

    // Extract from related topics
    for (const topic of (data.RelatedTopics || []).slice(0, 5)) {
      if (topic.Text && topic.FirstURL) {
        results.push({
          title: topic.Text.slice(0, 100),
          url: topic.FirstURL,
          content: topic.Text,
          score: 0.6,
        });
      }
    }

    console.log(`[Tavily Fallback] DuckDuckGo returned ${results.length} results`);

    return {
      results,
      answer: data.AbstractText || undefined,
      provider: 'duckduckgo',
    };
  } catch (error) {
    console.warn('[Tavily Fallback] DuckDuckGo failed:', error instanceof Error ? error.message : error);
    return { results: [], provider: 'none' };
  }
}

// ============================================
// TYPES
// ============================================

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
}

export interface TavilySearchResponse {
  query: string;
  results: TavilySearchResult[];
  answer?: string;  // AI-generated answer when includeAnswer is true
  responseTime: number;
  images?: string[];
  provider: 'tavily' | 'duckduckgo' | 'none';  // Which provider returned results
}

export interface TavilyExtractResponse {
  results: Array<{
    url: string;
    rawContent: string;
    extractedContent?: string;
  }>;
  failedUrls?: string[];
}

export interface TavilyCrawlResponse {
  baseUrl: string;
  results: Array<{
    url: string;
    content: string;
    title?: string;
  }>;
  totalPages: number;
}

export interface TavilyMapResponse {
  baseUrl: string;
  urls: string[];
  totalUrls: number;
}

export interface TavilyResearchResponse {
  topic: string;
  report: string;
  sources: Array<{
    url: string;
    title: string;
  }>;
  responseTime: number;
  provider: 'tavily' | 'fallback' | 'none';  // Which provider returned results
}

// Search depth options
export type SearchDepth = 'basic' | 'advanced';

// Topic categories for optimized search
export type SearchTopic = 'general' | 'news' | 'finance';

// ============================================
// CLIENT INITIALIZATION
// ============================================

let client: TavilyClient | null = null;

/**
 * Get or initialize the Tavily client
 */
function getClient(): TavilyClient {
  if (!client) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      throw new Error('TAVILY_API_KEY environment variable is not set');
    }
    client = tavily({ apiKey });
  }
  return client;
}

/**
 * Check if Tavily is configured
 */
export function isTavilyConfigured(): boolean {
  return !!process.env.TAVILY_API_KEY;
}

// ============================================
// SEARCH API
// ============================================

/**
 * Search the web using Tavily's AI-powered search
 *
 * ARCHITECTURE: Graceful Degradation
 * 1. Try Tavily (primary)
 * 2. On error, try DuckDuckGo (fallback)
 * 3. Return empty results (graceful failure)
 *
 * @param query - Search query
 * @param options - Search configuration
 * @returns Search results with optional AI answer
 *
 * @example
 * const results = await tavilySearch("What is the Fed rate decision today?", {
 *   searchDepth: 'advanced',
 *   topic: 'finance',
 *   includeAnswer: true
 * });
 */
export async function tavilySearch(
  query: string,
  options: {
    searchDepth?: SearchDepth;
    topic?: SearchTopic;
    maxResults?: number;
    includeAnswer?: boolean;
    includeImages?: boolean;
    includeDomains?: string[];
    excludeDomains?: string[];
    days?: number;  // Filter results by recency (1-365 days)
  } = {}
): Promise<TavilySearchResponse> {
  // Validate on first call if not done at startup
  if (!_startupValidated) {
    validateTavilyConfig();
  }

  const startTime = Date.now();

  // Check circuit breaker - skip Tavily if recently failed
  if (!shouldSkipTavily()) {
    try {
      const tvly = getClient();

      const response = await tvly.search(query, {
        searchDepth: options.searchDepth || 'basic',
        topic: options.topic || 'general',
        maxResults: options.maxResults || 10,
        includeAnswer: options.includeAnswer ?? true,
        includeImages: options.includeImages ?? false,
        includeDomains: options.includeDomains,
        excludeDomains: options.excludeDomains,
        days: options.days,
      }) as any;

      return {
        query,
        results: (response.results || []).map((r: any) => ({
          title: r.title || '',
          url: r.url || '',
          content: r.content || '',
          score: r.score || 0,
          publishedDate: r.publishedDate,
        })),
        answer: response.answer,
        responseTime: Date.now() - startTime,
        images: response.images?.map((img: any) => typeof img === 'string' ? img : img.url) || [],
        provider: 'tavily',
      };
    } catch (error) {
      console.warn('[Tavily] Search failed, trying fallback:', error instanceof Error ? error.message : error);
      recordTavilyError(error);
    }
  }

  // Fallback to DuckDuckGo
  const fallback = await fallbackSearch(query);

  return {
    query,
    results: fallback.results.map(r => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
    })),
    answer: fallback.answer,
    responseTime: Date.now() - startTime,
    images: [],
    provider: fallback.provider === 'duckduckgo' ? 'duckduckgo' : 'none',
  };
}

/**
 * Search with specific focus on news/current events
 */
export async function tavilyNewsSearch(
  query: string,
  options: {
    maxResults?: number;
    days?: number;
  } = {}
): Promise<TavilySearchResponse> {
  return tavilySearch(query, {
    searchDepth: 'advanced',
    topic: 'news',
    maxResults: options.maxResults || 15,
    includeAnswer: true,
    days: options.days || 7,  // Default to last 7 days for news
  });
}

/**
 * Search with specific focus on financial information
 */
export async function tavilyFinanceSearch(
  query: string,
  options: {
    maxResults?: number;
    includeDomains?: string[];
  } = {}
): Promise<TavilySearchResponse> {
  // Financial sources for higher accuracy
  const financeDomains = [
    'bloomberg.com',
    'reuters.com',
    'wsj.com',
    'ft.com',
    'cnbc.com',
    'federalreserve.gov',
    'sec.gov',
    'treasury.gov',
    'bls.gov',
    'cmegroup.com',
    ...(options.includeDomains || []),
  ];

  return tavilySearch(query, {
    searchDepth: 'advanced',
    topic: 'finance',
    maxResults: options.maxResults || 15,
    includeAnswer: true,
    includeDomains: financeDomains,
  });
}

/**
 * Search for prediction market-related information
 */
export async function tavilyPredictionSearch(
  query: string,
  options: {
    maxResults?: number;
  } = {}
): Promise<TavilySearchResponse> {
  // Include prediction market platforms and forecasting sources
  const predictionDomains = [
    'polymarket.com',
    'kalshi.com',
    'manifold.markets',
    'metaculus.com',
    'predictit.org',
    'fivethirtyeight.com',
    'electionbettingodds.com',
  ];

  return tavilySearch(query, {
    searchDepth: 'advanced',
    topic: 'news',
    maxResults: options.maxResults || 10,
    includeAnswer: true,
    includeDomains: predictionDomains,
  });
}

// ============================================
// EXTRACT API
// ============================================

/**
 * Extract content from URLs
 *
 * @param urls - URLs to extract content from
 * @returns Extracted content from each URL
 *
 * @example
 * const content = await tavilyExtract([
 *   "https://federalreserve.gov/newsevents/pressreleases/monetary20240918a.htm"
 * ]);
 */
export async function tavilyExtract(
  urls: string[]
): Promise<TavilyExtractResponse> {
  const tvly = getClient();

  const response = await tvly.extract(urls) as any;

  return {
    results: (response.results || []).map((r: any) => ({
      url: r.url || '',
      rawContent: r.rawContent || r.content || '',
      extractedContent: r.extractedContent,
    })),
    failedUrls: response.failedUrls || response.failed_urls || [],
  };
}

// ============================================
// CRAWL API
// ============================================

/**
 * Crawl a website and extract content from multiple pages
 *
 * @param url - Base URL to crawl
 * @param options - Crawl configuration
 * @returns Content from crawled pages
 *
 * @example
 * const pages = await tavilyCrawl("https://docs.tavily.com", {
 *   instructions: "Find all pages about the Search API"
 * });
 */
export async function tavilyCrawl(
  url: string,
  options: {
    instructions?: string;
    maxPages?: number;
  } = {}
): Promise<TavilyCrawlResponse> {
  const tvly = getClient();

  const response = await tvly.crawl(url, {
    instructions: options.instructions,
    maxPages: options.maxPages || 10,
  }) as any;

  return {
    baseUrl: url,
    results: (response.results || []).map((r: any) => ({
      url: r.url || '',
      content: r.content || r.rawContent || '',
      title: r.title,
    })),
    totalPages: response.results?.length || 0,
  };
}

// ============================================
// MAP API
// ============================================

/**
 * Map a website's structure and get all URLs
 *
 * @param url - Base URL to map
 * @returns List of all URLs found on the site
 *
 * @example
 * const sitemap = await tavilyMap("https://docs.tavily.com");
 * console.log(sitemap.urls);
 */
export async function tavilyMap(
  url: string
): Promise<TavilyMapResponse> {
  const tvly = getClient();

  const response = await tvly.map(url) as any;

  return {
    baseUrl: url,
    urls: response.urls || response.results?.map((r: any) => r.url) || [],
    totalUrls: response.urls?.length || response.results?.length || 0,
  };
}

// ============================================
// RESEARCH API (Deep Research)
// ============================================

/**
 * Conduct deep research on a topic
 *
 * This uses Tavily's research endpoint which performs multi-step
 * research including search, extraction, and synthesis.
 *
 * ARCHITECTURE: Graceful Degradation
 * 1. Try Tavily Research API (primary - premium)
 * 2. Fall back to multiple search queries (Tavily or DuckDuckGo)
 * 3. Return empty results (graceful failure)
 *
 * @param topic - Topic to research
 * @returns Comprehensive research report
 *
 * @example
 * const report = await tavilyResearch("Fed rate decision impact on prediction markets");
 */
export async function tavilyResearch(
  topic: string
): Promise<TavilyResearchResponse> {
  // Validate on first call if not done at startup
  if (!_startupValidated) {
    validateTavilyConfig();
  }

  const startTime = Date.now();

  // Check circuit breaker - skip Tavily if recently failed
  if (!shouldSkipTavily()) {
    try {
      const tvly = getClient();
      const response = await tvly.research(topic) as any;

      return {
        topic,
        report: response.report || response.answer || response.content || '',
        sources: (response.sources || response.results || []).map((s: any) => ({
          url: s.url || '',
          title: s.title || '',
        })),
        responseTime: Date.now() - startTime,
        provider: 'tavily',
      };
    } catch (error) {
      console.warn('[Tavily] Research API failed, trying fallback:', error instanceof Error ? error.message : error);
      recordTavilyError(error);
    }
  }

  // Fallback: Use multiple search queries to build a research-like response
  console.log('[Tavily] Using fallback research (multiple searches)');

  try {
    // Run multiple searches to gather information
    const searches = await Promise.all([
      tavilySearch(`${topic} latest news`, { maxResults: 5 }),
      tavilySearch(`${topic} analysis`, { maxResults: 5 }),
      tavilySearch(`${topic} facts`, { maxResults: 5 }),
    ]);

    // Combine results
    const allResults = searches.flatMap(s => s.results);
    const uniqueSources = new Map<string, { url: string; title: string }>();

    for (const r of allResults) {
      if (!uniqueSources.has(r.url)) {
        uniqueSources.set(r.url, { url: r.url, title: r.title });
      }
    }

    // Build a simple report from the results
    const contentParts = allResults
      .filter(r => r.content)
      .slice(0, 10)
      .map(r => r.content);

    const report = contentParts.length > 0
      ? `Research summary for "${topic}":\n\n${contentParts.join('\n\n')}`
      : `Unable to gather detailed research for "${topic}". Try a more specific query.`;

    return {
      topic,
      report,
      sources: Array.from(uniqueSources.values()).slice(0, 10),
      responseTime: Date.now() - startTime,
      provider: 'fallback',
    };
  } catch (error) {
    console.error('[Tavily] Fallback research also failed:', error instanceof Error ? error.message : error);

    return {
      topic,
      report: `Research unavailable for "${topic}". The search service is temporarily unavailable. Try again later or use a different query.`,
      sources: [],
      responseTime: Date.now() - startTime,
      provider: 'none',
    };
  }
}

// ============================================
// SPECIALIZED HELPERS FOR BERIGHT
// ============================================

/**
 * Get fact-checked information for a prediction market question
 *
 * @param question - Prediction market question
 * @returns Verified facts and sources
 */
export async function getFactsForPrediction(
  question: string
): Promise<{
  facts: string[];
  sources: Array<{ title: string; url: string }>;
  answer?: string;
  confidence: 'high' | 'medium' | 'low';
}> {
  const response = await tavilySearch(question, {
    searchDepth: 'advanced',
    includeAnswer: true,
    maxResults: 10,
    days: 30, // Recent facts only
  });

  // Extract key facts from results
  const facts: string[] = [];
  const seenFacts = new Set<string>();

  for (const result of response.results) {
    // Extract sentences that look like facts
    const sentences = result.content.split(/[.!?]/).filter(s =>
      s.trim().length > 20 &&
      s.trim().length < 300 &&
      !seenFacts.has(s.trim().toLowerCase())
    );

    for (const sentence of sentences.slice(0, 2)) {
      const fact = sentence.trim();
      if (fact && !seenFacts.has(fact.toLowerCase())) {
        facts.push(fact);
        seenFacts.add(fact.toLowerCase());
      }
    }

    if (facts.length >= 10) break;
  }

  // Determine confidence based on source quality and agreement
  const confidence: 'high' | 'medium' | 'low' =
    response.results.length >= 5 && response.answer ? 'high' :
    response.results.length >= 3 ? 'medium' : 'low';

  return {
    facts: facts.slice(0, 10),
    sources: response.results.slice(0, 5).map(r => ({
      title: r.title,
      url: r.url,
    })),
    answer: response.answer,
    confidence,
  };
}

/**
 * Get current news context for a topic
 *
 * @param topic - Topic to get news for
 * @returns Recent news with analysis
 */
export async function getNewsContext(
  topic: string
): Promise<{
  headlines: Array<{ title: string; url: string; date?: string }>;
  summary?: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  lastUpdated: string;
}> {
  const response = await tavilyNewsSearch(topic, {
    maxResults: 15,
    days: 3, // Very recent news
  });

  // Analyze sentiment from headlines
  const bullishWords = ['surge', 'jump', 'gain', 'rise', 'rally', 'up', 'high', 'win', 'success', 'approve', 'pass'];
  const bearishWords = ['drop', 'fall', 'crash', 'plunge', 'down', 'low', 'fail', 'reject', 'lose', 'decline'];

  let bullishScore = 0;
  let bearishScore = 0;

  for (const result of response.results) {
    const text = (result.title + ' ' + result.content).toLowerCase();
    for (const word of bullishWords) {
      if (text.includes(word)) bullishScore++;
    }
    for (const word of bearishWords) {
      if (text.includes(word)) bearishScore++;
    }
  }

  const sentiment: 'bullish' | 'bearish' | 'neutral' =
    bullishScore > bearishScore + 2 ? 'bullish' :
    bearishScore > bullishScore + 2 ? 'bearish' : 'neutral';

  return {
    headlines: response.results.slice(0, 10).map(r => ({
      title: r.title,
      url: r.url,
      date: r.publishedDate,
    })),
    summary: response.answer,
    sentiment,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Verify a claim using Tavily search
 *
 * @param claim - Claim to verify
 * @returns Verification result
 */
export async function verifyClaim(
  claim: string
): Promise<{
  verified: boolean;
  evidence: string[];
  sources: Array<{ title: string; url: string }>;
  confidence: number;
}> {
  const response = await tavilySearch(`fact check: ${claim}`, {
    searchDepth: 'advanced',
    includeAnswer: true,
    maxResults: 10,
  });

  // Extract evidence from results
  const evidence: string[] = [];
  for (const result of response.results.slice(0, 5)) {
    if (result.content) {
      evidence.push(result.content.slice(0, 200));
    }
  }

  // Crude verification based on answer
  const answer = response.answer?.toLowerCase() || '';
  const verified = !answer.includes('false') &&
                   !answer.includes('incorrect') &&
                   !answer.includes('not true') &&
                   !answer.includes('misleading');

  return {
    verified,
    evidence,
    sources: response.results.slice(0, 5).map(r => ({
      title: r.title,
      url: r.url,
    })),
    confidence: response.results.length >= 5 ? 85 : response.results.length >= 3 ? 70 : 50,
  };
}

// ============================================
// CLI
// ============================================

if (process.argv[1]?.endsWith('tavily.ts')) {
  const args = process.argv.slice(2);
  const command = args[0];
  const query = args.slice(1).join(' ');

  (async () => {
    try {
      if (command === 'search' && query) {
        const result = await tavilySearch(query);
        console.log('\n=== TAVILY SEARCH ===\n');
        console.log('Query:', result.query);
        console.log('Response time:', result.responseTime, 'ms');
        if (result.answer) {
          console.log('\nAnswer:', result.answer);
        }
        console.log('\nResults:');
        for (const r of result.results.slice(0, 5)) {
          console.log(`\n[${r.score.toFixed(2)}] ${r.title}`);
          console.log(`    ${r.url}`);
          console.log(`    ${r.content.slice(0, 150)}...`);
        }
      } else if (command === 'news' && query) {
        const result = await tavilyNewsSearch(query);
        console.log('\n=== TAVILY NEWS ===\n');
        console.log('Query:', result.query);
        if (result.answer) {
          console.log('\nSummary:', result.answer);
        }
        console.log('\nHeadlines:');
        for (const r of result.results.slice(0, 10)) {
          console.log(`• ${r.title}`);
          console.log(`  ${r.url}`);
        }
      } else if (command === 'research' && query) {
        console.log('\n=== TAVILY RESEARCH ===');
        console.log('Researching:', query);
        console.log('This may take a moment...\n');
        const result = await tavilyResearch(query);
        console.log('Report:');
        console.log(result.report);
        console.log('\nSources:');
        for (const s of result.sources) {
          console.log(`• ${s.title}`);
          console.log(`  ${s.url}`);
        }
      } else if (command === 'facts' && query) {
        const result = await getFactsForPrediction(query);
        console.log('\n=== FACTS FOR PREDICTION ===\n');
        console.log('Question:', query);
        console.log('Confidence:', result.confidence);
        if (result.answer) {
          console.log('\nAI Answer:', result.answer);
        }
        console.log('\nFacts:');
        for (const fact of result.facts) {
          console.log(`• ${fact}`);
        }
      } else if (command === 'extract' && query) {
        const result = await tavilyExtract([query]);
        console.log('\n=== TAVILY EXTRACT ===\n');
        for (const r of result.results) {
          console.log('URL:', r.url);
          console.log('Content:', r.rawContent.slice(0, 1000));
        }
      } else {
        console.log('Tavily CLI - Web Search & Research for BeRight Protocol\n');
        console.log('Usage:');
        console.log('  npx ts-node lib/tavily.ts search <query>');
        console.log('  npx ts-node lib/tavily.ts news <topic>');
        console.log('  npx ts-node lib/tavily.ts research <topic>');
        console.log('  npx ts-node lib/tavily.ts facts <prediction question>');
        console.log('  npx ts-node lib/tavily.ts extract <url>');
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
    }
  })();
}

export default {
  search: tavilySearch,
  newsSearch: tavilyNewsSearch,
  financeSearch: tavilyFinanceSearch,
  predictionSearch: tavilyPredictionSearch,
  extract: tavilyExtract,
  crawl: tavilyCrawl,
  map: tavilyMap,
  research: tavilyResearch,
  getFactsForPrediction,
  getNewsContext,
  verifyClaim,
  isTavilyConfigured,
  validateTavilyConfig,
};
