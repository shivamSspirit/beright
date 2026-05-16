/**
 * Web Search - Free alternatives to Tavily
 *
 * Providers (in order of preference):
 * 1. Serper.dev - 2,500 free Google searches/month (best quality)
 * 2. DuckDuckGo - Completely free, no API key (fallback)
 *
 * This replaces expensive Tavily Research API with:
 * - Free web search
 * - Groq LLM synthesis (also free)
 */

import { llmChat } from './llm';

// ============================================
// TYPES
// ============================================

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  date?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  answer?: string; // AI-synthesized answer
  provider: 'serper' | 'duckduckgo' | 'none';
}

// ============================================
// DUCKDUCKGO (FREE, NO API KEY)
// ============================================

/**
 * Search using DuckDuckGo Instant Answer API
 * Completely free, no API key required
 */
async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  try {
    // DuckDuckGo Instant Answer API
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!response.ok) return [];

    const data = await response.json();
    const results: SearchResult[] = [];

    // Abstract (main answer)
    if (data.Abstract) {
      results.push({
        title: data.Heading || 'DuckDuckGo Answer',
        url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        snippet: data.Abstract,
      });
    }

    // Related topics
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 8)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 50),
            url: topic.FirstURL,
            snippet: topic.Text,
          });
        }
      }
    }

    // Infobox data
    if (data.Infobox?.content) {
      for (const item of data.Infobox.content.slice(0, 3)) {
        if (item.value) {
          results.push({
            title: item.label || 'Info',
            url: data.AbstractURL || '',
            snippet: `${item.label}: ${item.value}`,
          });
        }
      }
    }

    return results;
  } catch (error) {
    console.warn('[DuckDuckGo] Search failed:', error);
    return [];
  }
}

// ============================================
// SERPER.DEV (2,500 FREE/MONTH)
// ============================================

/**
 * Search using Serper.dev (Google Search API)
 * 2,500 free searches per month
 * Get API key at: https://serper.dev
 */
async function searchSerper(query: string, options: { num?: number; type?: 'search' | 'news' } = {}): Promise<SearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  try {
    const url = options.type === 'news'
      ? 'https://google.serper.dev/news'
      : 'https://google.serper.dev/search';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: options.num || 10,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn('[Serper] Search failed:', response.status);
      return [];
    }

    const data = await response.json();
    const results: SearchResult[] = [];

    // Knowledge graph
    if (data.knowledgeGraph) {
      const kg = data.knowledgeGraph;
      results.push({
        title: kg.title || 'Knowledge Graph',
        url: kg.website || kg.descriptionLink || '',
        snippet: kg.description || '',
      });
    }

    // Answer box
    if (data.answerBox) {
      results.push({
        title: data.answerBox.title || 'Answer',
        url: data.answerBox.link || '',
        snippet: data.answerBox.answer || data.answerBox.snippet || '',
      });
    }

    // Organic results
    if (data.organic) {
      for (const item of data.organic) {
        results.push({
          title: item.title || '',
          url: item.link || '',
          snippet: item.snippet || '',
          date: item.date,
        });
      }
    }

    // News results
    if (data.news) {
      for (const item of data.news) {
        results.push({
          title: item.title || '',
          url: item.link || '',
          snippet: item.snippet || '',
          date: item.date,
        });
      }
    }

    return results;
  } catch (error) {
    console.warn('[Serper] Search failed:', error);
    return [];
  }
}

// ============================================
// UNIFIED SEARCH INTERFACE
// ============================================

/**
 * Search the web using best available provider
 * Falls back gracefully if APIs unavailable
 */
export async function webSearch(
  query: string,
  options: {
    maxResults?: number;
    type?: 'general' | 'news';
    synthesize?: boolean; // Use LLM to generate answer
  } = {}
): Promise<SearchResponse> {
  const maxResults = options.maxResults || 10;
  let results: SearchResult[] = [];
  let provider: 'serper' | 'duckduckgo' | 'none' = 'none';

  // Try Serper first (best quality)
  if (process.env.SERPER_API_KEY) {
    results = await searchSerper(query, {
      num: maxResults,
      type: options.type === 'news' ? 'news' : 'search',
    });
    if (results.length > 0) {
      provider = 'serper';
    }
  }

  // Fallback to DuckDuckGo (free)
  if (results.length === 0) {
    results = await searchDuckDuckGo(query);
    if (results.length > 0) {
      provider = 'duckduckgo';
    }
  }

  // Synthesize answer using Groq LLM if requested
  let answer: string | undefined;
  if (options.synthesize && results.length > 0) {
    answer = await synthesizeAnswer(query, results);
  }

  return {
    query,
    results: results.slice(0, maxResults),
    answer,
    provider,
  };
}

/**
 * Search for news specifically
 */
export async function newsSearch(query: string, maxResults = 10): Promise<SearchResponse> {
  return webSearch(query, { maxResults, type: 'news', synthesize: true });
}

// ============================================
// LLM SYNTHESIS (REPLACES TAVILY RESEARCH)
// ============================================

const SYNTHESIS_PROMPT = `You are a research analyst. Given search results about a topic, provide a concise, factual summary.

RULES:
1. Only use information from the provided search results
2. Be factual and objective
3. If results are insufficient, say so
4. Include relevant numbers, dates, and specifics
5. Keep response under 300 words

Respond with a clear, well-structured summary.`;

/**
 * Synthesize an answer from search results using Groq LLM
 */
async function synthesizeAnswer(query: string, results: SearchResult[]): Promise<string | undefined> {
  if (results.length === 0) return undefined;

  try {
    const context = results
      .slice(0, 8)
      .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}`)
      .join('\n\n');

    const response = await llmChat({
      system: SYNTHESIS_PROMPT,
      user: `QUERY: ${query}\n\nSEARCH RESULTS:\n${context}\n\nProvide a concise summary answering the query.`,
      maxTokens: 500,
      temperature: 0.3,
      quality: 'fast', // Use fast model for synthesis
    });

    if (response.provider === 'none') return undefined;
    return response.text;
  } catch (error) {
    console.warn('[Synthesis] Failed:', error);
    return undefined;
  }
}

/**
 * Deep research using web search + LLM synthesis
 * This replaces expensive Tavily Research API
 */
export async function deepResearch(topic: string): Promise<{
  topic: string;
  summary: string;
  facts: string[];
  sources: Array<{ title: string; url: string }>;
  provider: string;
}> {
  console.log(`[DeepResearch] Researching: ${topic}`);

  // Do multiple searches for better coverage
  const [generalSearch, newsSearch] = await Promise.all([
    webSearch(topic, { maxResults: 10, type: 'general' }),
    webSearch(`${topic} latest news`, { maxResults: 5, type: 'news' }),
  ]);

  // Combine results
  const allResults = [...generalSearch.results, ...newsSearch.results];
  const uniqueResults = allResults.filter((r, i, arr) =>
    arr.findIndex(x => x.url === r.url) === i
  );

  // Extract facts from snippets
  const facts: string[] = [];
  for (const result of uniqueResults.slice(0, 10)) {
    if (result.snippet && result.snippet.length > 30) {
      // Clean up snippet
      const fact = result.snippet
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200);
      if (fact && !facts.some(f => f.toLowerCase().includes(fact.toLowerCase().slice(0, 50)))) {
        facts.push(fact);
      }
    }
  }

  // Generate comprehensive summary using LLM
  const summary = await synthesizeResearchReport(topic, uniqueResults) || 'No summary available.';

  return {
    topic,
    summary,
    facts: facts.slice(0, 10),
    sources: uniqueResults.slice(0, 8).map(r => ({
      title: r.title,
      url: r.url,
    })),
    provider: generalSearch.provider,
  };
}

const RESEARCH_PROMPT = `You are a Superforecaster Research Analyst for BeRight Protocol, a prediction market intelligence system.

Given search results about a topic, provide a comprehensive research report following this structure:

1. **Overview** - What is this topic about?
2. **Key Facts** - Most important verified facts
3. **Current Status** - What's happening now?
4. **Factors to Consider** - What could influence outcomes?
5. **Uncertainty** - What we don't know

RULES:
- Only use information from the provided search results
- Be factual and objective
- Note conflicting information if present
- Keep total response under 400 words`;

async function synthesizeResearchReport(topic: string, results: SearchResult[]): Promise<string | undefined> {
  if (results.length === 0) return undefined;

  try {
    const context = results
      .slice(0, 12)
      .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`)
      .join('\n\n');

    const response = await llmChat({
      system: RESEARCH_PROMPT,
      user: `RESEARCH TOPIC: ${topic}\n\nSEARCH RESULTS:\n${context}\n\nProvide a comprehensive research report.`,
      maxTokens: 800,
      temperature: 0.3,
      quality: 'smart', // Use better model for research
    });

    if (response.provider === 'none') return undefined;
    return response.text;
  } catch (error) {
    console.warn('[ResearchSynthesis] Failed:', error);
    return undefined;
  }
}

// ============================================
// CHECK CONFIGURATION
// ============================================

export function isWebSearchConfigured(): boolean {
  // DuckDuckGo always works (no API key)
  // Serper is optional but better
  return true;
}

export function getSearchProvider(): string {
  if (process.env.SERPER_API_KEY) return 'serper';
  return 'duckduckgo';
}

// ============================================
// CLI
// ============================================

if (process.argv[1]?.endsWith('webSearch.ts')) {
  const args = process.argv.slice(2);
  const command = args[0];
  const query = args.slice(1).join(' ');

  (async () => {
    if (command === 'search' && query) {
      console.log('\n=== WEB SEARCH ===\n');
      const result = await webSearch(query, { synthesize: true });
      console.log('Provider:', result.provider);
      console.log('Query:', result.query);
      if (result.answer) {
        console.log('\nAnswer:', result.answer);
      }
      console.log('\nResults:');
      for (const r of result.results.slice(0, 5)) {
        console.log(`\n• ${r.title}`);
        console.log(`  ${r.url}`);
        console.log(`  ${r.snippet?.slice(0, 150)}...`);
      }
    } else if (command === 'research' && query) {
      console.log('\n=== DEEP RESEARCH ===\n');
      console.log('Topic:', query);
      console.log('Researching...\n');
      const result = await deepResearch(query);
      console.log('Provider:', result.provider);
      console.log('\n--- SUMMARY ---\n');
      console.log(result.summary);
      console.log('\n--- FACTS ---');
      for (const fact of result.facts) {
        console.log(`• ${fact}`);
      }
      console.log('\n--- SOURCES ---');
      for (const s of result.sources) {
        console.log(`• ${s.title}`);
        console.log(`  ${s.url}`);
      }
    } else {
      console.log('Web Search CLI - Free research for BeRight\n');
      console.log('Usage:');
      console.log('  npx ts-node lib/webSearch.ts search <query>');
      console.log('  npx ts-node lib/webSearch.ts research <topic>');
      console.log('\nProviders:');
      console.log('  Serper.dev (SERPER_API_KEY) - 2,500 free/month');
      console.log('  DuckDuckGo - Always free (fallback)');
    }
  })();
}

export default {
  search: webSearch,
  newsSearch,
  deepResearch,
  isConfigured: isWebSearchConfigured,
  getProvider: getSearchProvider,
};
