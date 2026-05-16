/**
 * Serper.dev Client for BeRight Protocol
 *
 * Primary web search API providing Google search results for
 * fact-checking, news, and research in prediction markets.
 *
 * Features:
 * - Google SERP results (titles, snippets, links)
 * - News search with date filtering
 * - Fast response times (1-2 seconds)
 * - 2,500 free queries (no credit card required)
 *
 * API Docs: https://serper.dev/docs
 */

// ============================================
// CONFIGURATION & VALIDATION
// ============================================

const SERPER_API_URL = 'https://google.serper.dev';

let _startupValidated = false;
let _serperAvailable = false;
let _serperError: string | null = null;

/**
 * Validate Serper configuration at startup
 */
export function validateSerperConfig(): { valid: boolean; error?: string } {
  const apiKey = process.env.SERPER_API_KEY;

  if (apiKey) {
    _serperAvailable = true;
    console.log('[Serper] ✓ API key configured');
    _startupValidated = true;
    return { valid: true };
  } else {
    _serperAvailable = false;
    _serperError = 'SERPER_API_KEY not set';
    console.warn('[Serper] ✗ API key not configured - search will not work');
    _startupValidated = true;
    return { valid: false, error: _serperError };
  }
}

/**
 * Check if Serper is configured
 */
export function isSerperConfigured(): boolean {
  return !!process.env.SERPER_API_KEY;
}

/**
 * Circuit breaker for rate limiting
 */
let _lastSerperError: { time: number; message: string } | null = null;
const CIRCUIT_BREAKER_MS = 60000; // 1 minute cooldown

function shouldSkipSerper(): boolean {
  if (!_serperAvailable && _startupValidated) return true;
  if (_lastSerperError && Date.now() - _lastSerperError.time < CIRCUIT_BREAKER_MS) {
    console.log(`[Serper] Circuit breaker active - skipping (${_lastSerperError.message})`);
    return true;
  }
  return false;
}

function recordSerperError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  _lastSerperError = { time: Date.now(), message };

  if (message.includes('rate limit') || message.includes('quota') || message.includes('credit')) {
    console.warn(`[Serper] Rate limit hit - circuit breaker engaged for ${CIRCUIT_BREAKER_MS / 1000}s`);
  }
}

// ============================================
// TYPES
// ============================================

export interface SerperSearchResult {
  title: string;
  url: string;
  content: string;
  snippet: string;
  score: number;
  position: number;
  publishedDate?: string;
}

export interface SerperSearchResponse {
  query: string;
  results: SerperSearchResult[];
  answer?: string;
  responseTime: number;
  credits?: number;
  provider: 'serper' | 'none';
}

export interface SerperNewsResult {
  title: string;
  url: string;
  snippet: string;
  date: string;
  source: string;
  imageUrl?: string;
}

export interface SerperNewsResponse {
  query: string;
  results: SerperNewsResult[];
  responseTime: number;
  provider: 'serper' | 'none';
}

// Raw Serper API response types
interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
  date?: string;
}

interface SerperNewsItem {
  title: string;
  link: string;
  snippet: string;
  date: string;
  source: string;
  imageUrl?: string;
}

interface SerperApiResponse {
  searchParameters?: {
    q: string;
    type: string;
    num: number;
  };
  organic?: SerperOrganicResult[];
  news?: SerperNewsItem[];
  answerBox?: {
    answer?: string;
    snippet?: string;
    title?: string;
  };
  knowledgeGraph?: {
    title?: string;
    description?: string;
  };
  credits?: number;
}

// ============================================
// CORE API FUNCTIONS
// ============================================

/**
 * Make a request to Serper API
 */
async function serperRequest(
  endpoint: string,
  body: Record<string, unknown>
): Promise<SerperApiResponse> {
  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey) {
    throw new Error('SERPER_API_KEY environment variable is not set');
  }

  const response = await fetch(`${SERPER_API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Serper API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

// ============================================
// SEARCH API
// ============================================

/**
 * Search the web using Serper (Google results)
 *
 * @param query - Search query
 * @param options - Search configuration
 * @returns Search results with snippets
 *
 * @example
 * const results = await serperSearch("Bitcoin price prediction 2025", {
 *   num: 10,
 *   gl: 'us'
 * });
 */
export async function serperSearch(
  query: string,
  options: {
    num?: number;         // Number of results (default: 10)
    gl?: string;          // Country code (default: 'us')
    hl?: string;          // Language (default: 'en')
    page?: number;        // Page number (default: 1)
    autocorrect?: boolean; // Auto-correct spelling (default: true)
  } = {}
): Promise<SerperSearchResponse> {
  if (!_startupValidated) {
    validateSerperConfig();
  }

  const startTime = Date.now();

  if (shouldSkipSerper()) {
    return {
      query,
      results: [],
      responseTime: Date.now() - startTime,
      provider: 'none',
    };
  }

  try {
    const response = await serperRequest('/search', {
      q: query,
      num: options.num || 10,
      gl: options.gl || 'us',
      hl: options.hl || 'en',
      page: options.page || 1,
      autocorrect: options.autocorrect ?? true,
    });

    const results: SerperSearchResult[] = (response.organic || []).map((r, index) => ({
      title: r.title || '',
      url: r.link || '',
      content: r.snippet || '',
      snippet: r.snippet || '',
      score: 1 - (index * 0.05), // Higher score for top results
      position: r.position || index + 1,
      publishedDate: r.date,
    }));

    // Extract answer from answerBox or knowledgeGraph
    const answer = response.answerBox?.answer ||
                   response.answerBox?.snippet ||
                   response.knowledgeGraph?.description;

    return {
      query,
      results,
      answer,
      responseTime: Date.now() - startTime,
      credits: response.credits,
      provider: 'serper',
    };
  } catch (error) {
    console.error('[Serper] Search failed:', error instanceof Error ? error.message : error);
    recordSerperError(error);

    return {
      query,
      results: [],
      responseTime: Date.now() - startTime,
      provider: 'none',
    };
  }
}

/**
 * Search news using Serper
 *
 * @param query - News search query
 * @param options - Search configuration
 * @returns News results with dates and sources
 */
export async function serperNewsSearch(
  query: string,
  options: {
    num?: number;
    gl?: string;
    hl?: string;
    tbs?: string; // Time filter: qdr:h (hour), qdr:d (day), qdr:w (week), qdr:m (month)
  } = {}
): Promise<SerperNewsResponse> {
  if (!_startupValidated) {
    validateSerperConfig();
  }

  const startTime = Date.now();

  if (shouldSkipSerper()) {
    return {
      query,
      results: [],
      responseTime: Date.now() - startTime,
      provider: 'none',
    };
  }

  try {
    const response = await serperRequest('/news', {
      q: query,
      num: options.num || 10,
      gl: options.gl || 'us',
      hl: options.hl || 'en',
      tbs: options.tbs || 'qdr:w', // Default to past week
    });

    const results: SerperNewsResult[] = (response.news || []).map(r => ({
      title: r.title || '',
      url: r.link || '',
      snippet: r.snippet || '',
      date: r.date || '',
      source: r.source || '',
      imageUrl: r.imageUrl,
    }));

    return {
      query,
      results,
      responseTime: Date.now() - startTime,
      provider: 'serper',
    };
  } catch (error) {
    console.error('[Serper] News search failed:', error instanceof Error ? error.message : error);
    recordSerperError(error);

    return {
      query,
      results: [],
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
  const response = await serperSearch(question, { num: 10 });

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
  const response = await serperNewsSearch(topic, {
    num: 15,
    tbs: 'qdr:d', // Past day for very recent news
  });

  // Analyze sentiment from headlines
  const bullishWords = ['surge', 'jump', 'gain', 'rise', 'rally', 'up', 'high', 'win', 'success', 'approve', 'pass'];
  const bearishWords = ['drop', 'fall', 'crash', 'plunge', 'down', 'low', 'fail', 'reject', 'lose', 'decline'];

  let bullishScore = 0;
  let bearishScore = 0;

  for (const result of response.results) {
    const text = (result.title + ' ' + result.snippet).toLowerCase();
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
      date: r.date,
    })),
    summary: undefined, // Serper doesn't provide AI summaries
    sentiment,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Verify a claim using Serper search
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
  const response = await serperSearch(`fact check: ${claim}`, { num: 10 });

  // Extract evidence from results
  const evidence: string[] = [];
  for (const result of response.results.slice(0, 5)) {
    if (result.content) {
      evidence.push(result.content.slice(0, 200));
    }
  }

  // Check for fact-checking sites and analyze content
  const factCheckSites = ['snopes.com', 'politifact.com', 'factcheck.org', 'reuters.com/fact-check'];
  const hasFactCheckSource = response.results.some(r =>
    factCheckSites.some(site => r.url.includes(site))
  );

  // Crude verification based on content analysis
  const allContent = response.results.map(r => r.content).join(' ').toLowerCase();
  const falseIndicators = ['false', 'incorrect', 'not true', 'misleading', 'debunked', 'hoax', 'fake'];
  const hasFalseIndicators = falseIndicators.some(indicator => allContent.includes(indicator));

  // Determine verification status
  const verified = !hasFalseIndicators;

  return {
    verified,
    evidence,
    sources: response.results.slice(0, 5).map(r => ({
      title: r.title,
      url: r.url,
    })),
    confidence: hasFactCheckSource ? 85 : response.results.length >= 5 ? 70 : 50,
  };
}

/**
 * Conduct research on a topic using multiple searches
 *
 * @param topic - Topic to research
 * @returns Research report with sources
 */
export async function serperResearch(
  topic: string
): Promise<{
  topic: string;
  report: string;
  sources: Array<{ url: string; title: string }>;
  responseTime: number;
  provider: 'serper' | 'none';
}> {
  const startTime = Date.now();

  try {
    // Run multiple searches to gather comprehensive information
    const [generalSearch, newsSearch, analysisSearch] = await Promise.all([
      serperSearch(`${topic}`, { num: 5 }),
      serperNewsSearch(`${topic} latest`, { num: 5 }),
      serperSearch(`${topic} analysis`, { num: 5 }),
    ]);

    // Combine all results
    const allSources = new Map<string, { url: string; title: string }>();

    for (const r of [...generalSearch.results, ...analysisSearch.results]) {
      if (!allSources.has(r.url)) {
        allSources.set(r.url, { url: r.url, title: r.title });
      }
    }

    for (const r of newsSearch.results) {
      if (!allSources.has(r.url)) {
        allSources.set(r.url, { url: r.url, title: r.title });
      }
    }

    // Build report from gathered content
    const contentParts: string[] = [];

    if (generalSearch.answer) {
      contentParts.push(`Overview: ${generalSearch.answer}`);
    }

    // Add key findings
    contentParts.push('\nKey Findings:');
    for (const r of generalSearch.results.slice(0, 3)) {
      if (r.content) {
        contentParts.push(`- ${r.content}`);
      }
    }

    // Add recent news
    if (newsSearch.results.length > 0) {
      contentParts.push('\nRecent News:');
      for (const r of newsSearch.results.slice(0, 3)) {
        contentParts.push(`- [${r.date}] ${r.title}`);
      }
    }

    const report = contentParts.length > 1
      ? `Research summary for "${topic}":\n\n${contentParts.join('\n')}`
      : `Limited information found for "${topic}". Try a more specific query.`;

    return {
      topic,
      report,
      sources: Array.from(allSources.values()).slice(0, 10),
      responseTime: Date.now() - startTime,
      provider: 'serper',
    };
  } catch (error) {
    console.error('[Serper] Research failed:', error instanceof Error ? error.message : error);

    return {
      topic,
      report: `Research unavailable for "${topic}". Search service error.`,
      sources: [],
      responseTime: Date.now() - startTime,
      provider: 'none',
    };
  }
}

/**
 * Search with specific focus on financial information
 */
export async function serperFinanceSearch(
  query: string,
  options: { num?: number } = {}
): Promise<SerperSearchResponse> {
  return serperSearch(`${query} finance market stock`, {
    num: options.num || 10,
  });
}

/**
 * Search for prediction market-related information
 */
export async function serperPredictionSearch(
  query: string,
  options: { num?: number } = {}
): Promise<SerperSearchResponse> {
  return serperSearch(`${query} prediction market odds probability`, {
    num: options.num || 10,
  });
}

// ============================================
// CLI
// ============================================

if (process.argv[1]?.endsWith('serper.ts')) {
  // Load environment variables for CLI
  require('dotenv').config();

  const args = process.argv.slice(2);
  const command = args[0];
  const query = args.slice(1).join(' ');

  (async () => {
    try {
      if (command === 'search' && query) {
        const result = await serperSearch(query);
        console.log('\n=== SERPER SEARCH ===\n');
        console.log('Query:', result.query);
        console.log('Response time:', result.responseTime, 'ms');
        console.log('Provider:', result.provider);
        if (result.answer) {
          console.log('\nAnswer:', result.answer);
        }
        console.log('\nResults:');
        for (const r of result.results.slice(0, 5)) {
          console.log(`\n[${r.position}] ${r.title}`);
          console.log(`    ${r.url}`);
          console.log(`    ${r.snippet.slice(0, 150)}...`);
        }
      } else if (command === 'news' && query) {
        const result = await serperNewsSearch(query);
        console.log('\n=== SERPER NEWS ===\n');
        console.log('Query:', result.query);
        console.log('Provider:', result.provider);
        console.log('\nHeadlines:');
        for (const r of result.results.slice(0, 10)) {
          console.log(`• [${r.date}] ${r.title}`);
          console.log(`  Source: ${r.source}`);
          console.log(`  ${r.url}`);
        }
      } else if (command === 'research' && query) {
        console.log('\n=== SERPER RESEARCH ===');
        console.log('Researching:', query);
        console.log('This may take a moment...\n');
        const result = await serperResearch(query);
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
          console.log('\nAnswer:', result.answer);
        }
        console.log('\nFacts:');
        for (const fact of result.facts) {
          console.log(`• ${fact}`);
        }
        console.log('\nSources:');
        for (const s of result.sources) {
          console.log(`• ${s.title} - ${s.url}`);
        }
      } else {
        console.log('Serper CLI - Web Search for BeRight Protocol\n');
        console.log('Usage:');
        console.log('  npx ts-node lib/serper.ts search <query>');
        console.log('  npx ts-node lib/serper.ts news <topic>');
        console.log('  npx ts-node lib/serper.ts research <topic>');
        console.log('  npx ts-node lib/serper.ts facts <prediction question>');
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
    }
  })();
}

// ============================================
// BACKWARD COMPATIBILITY (Tavily API aliases)
// ============================================

/**
 * Simple web search wrapper for fact-checking
 * Matches the old Tavily searchWeb interface
 */
export async function searchWeb(
  query: string,
  options: { maxResults?: number } = {}
): Promise<SerperSearchResponse> {
  return serperSearch(query, {
    num: options.maxResults || 5,
  });
}

/**
 * Extract content from URLs (compatibility wrapper)
 * Note: Serper doesn't support direct URL extraction like Tavily.
 * This returns search results about the URL instead.
 */
export async function tavilyExtract(
  urls: string[]
): Promise<{
  results: Array<{
    url: string;
    rawContent: string;
    extractedContent?: string;
  }>;
  failedUrls?: string[];
}> {
  const results: Array<{ url: string; rawContent: string; extractedContent?: string }> = [];
  const failedUrls: string[] = [];

  for (const url of urls) {
    try {
      // Search for content about the URL
      const searchResult = await serperSearch(`site:${new URL(url).hostname} ${url}`, { num: 1 });

      if (searchResult.results.length > 0) {
        results.push({
          url,
          rawContent: searchResult.results[0].content || searchResult.results[0].snippet,
          extractedContent: searchResult.results[0].content,
        });
      } else {
        failedUrls.push(url);
      }
    } catch {
      failedUrls.push(url);
    }
  }

  return { results, failedUrls };
}

// Aliases for backward compatibility with Tavily imports
export const validateTavilyConfig = validateSerperConfig;
export const isTavilyConfigured = isSerperConfigured;
export const tavilySearch = serperSearch;
export const tavilyNewsSearch = serperNewsSearch;
export const tavilyResearch = serperResearch;
export const tavilyFinanceSearch = serperFinanceSearch;

// ============================================
// EXPORTS
// ============================================

export default {
  search: serperSearch,
  newsSearch: serperNewsSearch,
  financeSearch: serperFinanceSearch,
  predictionSearch: serperPredictionSearch,
  research: serperResearch,
  getFactsForPrediction,
  getNewsContext,
  verifyClaim,
  isSerperConfigured,
  validateSerperConfig,
  // Backward compatibility
  searchWeb,
  validateTavilyConfig,
  isTavilyConfigured,
  tavilyExtract,
  tavilySearch,
  tavilyNewsSearch,
  tavilyResearch,
  tavilyFinanceSearch,
};
