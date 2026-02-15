/**
 * Production-Grade Market Matching Pipeline
 *
 * Multi-stage validation system to ensure we only identify
 * TRUE arbitrage opportunities between EQUIVALENT markets.
 *
 * Pipeline stages:
 * 1. Hard filters (category, outcome type, date range)
 * 2. Entity extraction and comparison
 * 3. Structured metadata alignment
 * 4. Semantic similarity with HIGH threshold
 * 5. Resolution criteria validation
 * 6. Final equivalence scoring
 */

import { Market, Platform } from '../../types/index';
import {
  MarketMetadata,
  MarketCategory,
  ExtractedEntities,
  ExtractedDate,
  ExtractedAmount,
  EquivalenceScore,
  EquivalenceValidations,
  ValidatedMarketPair,
  OutcomeMapping,
  ArbitrageConfig,
  DEFAULT_ARBITRAGE_CONFIG,
} from './types';
import { SYNONYM_GROUPS, areSynonyms, extractEntities as extractEntitySet } from '../../config/synonyms';

// ============================================
// STAGE 1: METADATA EXTRACTION
// ============================================

/**
 * Extract structured metadata from a market
 */
export function extractMetadata(market: Market): MarketMetadata {
  const title = market.title || market.question || '';

  return {
    platform: market.platform,
    marketId: market.marketId || '',
    title,
    eventDate: extractEventDate(title),
    resolutionDate: market.endDate,
    resolutionSource: extractResolutionSource(title),
    outcomeType: inferOutcomeType(market),
    outcomes: inferOutcomes(market),
    category: categorizeMarket(title),
    subcategory: extractSubcategory(title),
    entities: extractEntities(title),
  };
}

/**
 * Extract event date from market title
 */
function extractEventDate(title: string): Date | null {
  const lower = title.toLowerCase();

  // Year patterns
  const yearMatch = lower.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);

    // Check for month
    const months: Record<string, number> = {
      january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2,
      april: 3, apr: 3, may: 4, june: 5, jun: 5, july: 6, jul: 6,
      august: 7, aug: 7, september: 8, sep: 8, sept: 8,
      october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
    };

    for (const [monthName, monthNum] of Object.entries(months)) {
      if (lower.includes(monthName)) {
        // Check for day
        const dayMatch = lower.match(new RegExp(`${monthName}\\s+(\\d{1,2})`));
        const day = dayMatch ? parseInt(dayMatch[1]) : 1;
        return new Date(year, monthNum, day);
      }
    }

    // Check for quarter
    if (lower.includes('q1') || lower.includes('first quarter')) {
      return new Date(year, 2, 31); // End of Q1
    }
    if (lower.includes('q2') || lower.includes('second quarter')) {
      return new Date(year, 5, 30); // End of Q2
    }
    if (lower.includes('q3') || lower.includes('third quarter')) {
      return new Date(year, 8, 30); // End of Q3
    }
    if (lower.includes('q4') || lower.includes('fourth quarter') ||
        lower.includes('end of year') || lower.includes('eoy')) {
      return new Date(year, 11, 31); // End of Q4
    }

    // Just the year - assume end of year
    return new Date(year, 11, 31);
  }

  return null;
}

/**
 * Extract resolution source from title if mentioned
 */
function extractResolutionSource(title: string): string | null {
  const lower = title.toLowerCase();

  const sources = [
    { pattern: /associated press|ap\b/i, source: 'AP' },
    { pattern: /official results?/i, source: 'Official' },
    { pattern: /government data/i, source: 'Government' },
    { pattern: /fed\b|federal reserve/i, source: 'Federal Reserve' },
    { pattern: /bls\b|bureau of labor/i, source: 'BLS' },
    { pattern: /sec\b|securities.*exchange/i, source: 'SEC' },
    { pattern: /cdc\b|centers.*disease/i, source: 'CDC' },
  ];

  for (const { pattern, source } of sources) {
    if (pattern.test(lower)) {
      return source;
    }
  }

  return null;
}

/**
 * Infer outcome type from market
 */
function inferOutcomeType(market: Market): 'binary' | 'multi' | 'scalar' {
  // Most prediction markets are binary Yes/No
  // Multi-outcome and scalar would need platform-specific parsing
  return 'binary';
}

/**
 * Infer outcome names
 */
function inferOutcomes(market: Market): string[] {
  // Default to Yes/No for binary markets
  return ['Yes', 'No'];
}

/**
 * Categorize market by topic
 */
function categorizeMarket(title: string): MarketCategory {
  const lower = title.toLowerCase();

  // Politics & Geopolitics patterns
  const politicsPatterns = [
    // US Politics
    /trump|biden|election|president|congress|senate|house|vote|poll/i,
    /democrat|republican|gop|dnc|rnc|governor|mayor|primary/i,
    /impeach|indict|convicted|resign|cabinet|secretary/i,
    // Geopolitics - regime, government, international relations
    /regime\s*(change|fall|collapse)|government\s*(fall|collapse|overthrow)/i,
    /revolution|coup|civil\s*war|uprising|protest|sanction/i,
    /iran|russia|china|ukraine|taiwan|israel|gaza|north\s*korea/i,
    /nato|un\b|united\s*nations|eu\b|european\s*union/i,
    /war\b|invasion|conflict|treaty|diplomatic|foreign\s*policy/i,
    /ayatollah|khamenei|supreme\s*leader|dictator|authoritarian/i,
  ];
  if (politicsPatterns.some(p => p.test(lower))) return 'politics';

  // Economics patterns
  const economicsPatterns = [
    /fed\b|federal reserve|rate\s*(cut|hike)|interest rate/i,
    /inflation|cpi|gdp|recession|unemployment|jobs?\s*report/i,
    /stock|s&p|dow|nasdaq|market\s*crash|earnings/i,
  ];
  if (economicsPatterns.some(p => p.test(lower))) return 'economics';

  // Crypto patterns
  const cryptoPatterns = [
    /bitcoin|btc|ethereum|eth|crypto|blockchain|token/i,
    /defi|nft|solana|binance|coinbase|halving/i,
  ];
  if (cryptoPatterns.some(p => p.test(lower))) return 'crypto';

  // Sports patterns - comprehensive detection including European football
  const sportsPatterns = [
    // American sports
    /super\s*bowl|nfl|nba|mlb|nhl|world\s*series|playoffs/i,
    /championship|finals|tournament|olympics|world\s*cup/i,
    // European football leagues
    /laliga|la\s*liga|serie\s*a|bundesliga|ligue\s*1|premier\s*league|eredivisie/i,
    /champions\s*league|europa\s*league|conference\s*league|uefa/i,
    // Spanish football teams
    /real\s*madrid|barcelona|atletico|sevilla|valencia|villarreal|athletic\s*bilbao/i,
    /rayo\s*vallecano|real\s*sociedad|real\s*betis|getafe|osasuna|celta|mallorca/i,
    /girona|alaves|las\s*palmas|cadiz|almeria|granada|leganes|espanyol/i,
    // English football teams
    /manchester\s*(united|city)|liverpool|chelsea|arsenal|tottenham|spurs/i,
    /newcastle|west\s*ham|aston\s*villa|brighton|crystal\s*palace|everton|fulham/i,
    // Other major European clubs
    /bayern\s*munich|borussia\s*dortmund|psg|paris\s*saint|juventus|inter\s*milan/i,
    /ac\s*milan|napoli|roma|lazio|ajax|porto|benfica/i,
    // General football/soccer terms
    /football|soccer|goal|striker|midfielder|goalkeeper|premier|league\s*match/i,
    /win\s+on\s+\d{4}-\d{2}-\d{2}|match\s+\d{4}/i, // "win on 2026-02-07" pattern
  ];
  if (sportsPatterns.some(p => p.test(lower))) return 'sports';

  // Tech patterns
  const techPatterns = [
    /ai\b|artificial\s*intelligence|gpt|llm|openai|anthropic/i,
    /tesla|spacex|apple|google|microsoft|meta|nvidia/i,
    /launch|release|product|iphone|android/i,
  ];
  if (techPatterns.some(p => p.test(lower))) return 'tech';

  // Entertainment patterns
  const entertainmentPatterns = [
    /oscar|emmy|grammy|golden\s*globe|movie|film|album/i,
    /box\s*office|streaming|netflix|disney|taylor\s*swift/i,
  ];
  if (entertainmentPatterns.some(p => p.test(lower))) return 'entertainment';

  // Science patterns
  const sciencePatterns = [
    /vaccine|virus|covid|pandemic|fda|clinical|drug/i,
    /nasa|space|mars|moon|rocket|satellite/i,
    /climate|carbon|renewable|fusion|discovery/i,
  ];
  if (sciencePatterns.some(p => p.test(lower))) return 'science';

  return 'other';
}

/**
 * Extract subcategory for finer matching
 */
function extractSubcategory(title: string): string | null {
  const lower = title.toLowerCase();

  // Specific subcategories
  if (/super\s*bowl/i.test(lower)) return 'super_bowl';
  if (/presidential|president/i.test(lower)) return 'presidential';
  if (/fed\b|federal\s*reserve/i.test(lower)) return 'fed_policy';
  if (/bitcoin|btc/i.test(lower)) return 'bitcoin';
  if (/ethereum|eth/i.test(lower)) return 'ethereum';

  return null;
}

/**
 * Extract named entities from text
 */
function extractEntities(title: string): ExtractedEntities {
  const lower = title.toLowerCase();

  const entities: ExtractedEntities = {
    people: [],
    organizations: [],
    locations: [],
    dates: [],
    amounts: [],
    events: [],
  };

  // People - common names in prediction markets
  const peoplePatterns: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /trump|donald\s+trump/i, name: 'Trump' },
    { pattern: /biden|joe\s+biden/i, name: 'Biden' },
    { pattern: /harris|kamala/i, name: 'Harris' },
    { pattern: /desantis/i, name: 'DeSantis' },
    { pattern: /newsom/i, name: 'Newsom' },
    { pattern: /elon\s*musk|musk\b/i, name: 'Musk' },
    { pattern: /powell|jerome\s+powell/i, name: 'Powell' },
    { pattern: /yellen/i, name: 'Yellen' },
    { pattern: /xi\s+jinping|xi\b/i, name: 'Xi' },
    { pattern: /putin/i, name: 'Putin' },
    { pattern: /zelensky/i, name: 'Zelensky' },
  ];

  for (const { pattern, name } of peoplePatterns) {
    if (pattern.test(lower) && !entities.people.includes(name)) {
      entities.people.push(name);
    }
  }

  // Organizations
  const orgPatterns: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /\bfed\b|federal\s+reserve|fomc/i, name: 'Fed' },
    { pattern: /\bsec\b/i, name: 'SEC' },
    { pattern: /\bfda\b/i, name: 'FDA' },
    { pattern: /\bcdc\b/i, name: 'CDC' },
    { pattern: /\bnasa\b/i, name: 'NASA' },
    { pattern: /\bun\b|united\s+nations/i, name: 'UN' },
    { pattern: /\bnato\b/i, name: 'NATO' },
    { pattern: /tesla/i, name: 'Tesla' },
    { pattern: /spacex/i, name: 'SpaceX' },
    { pattern: /openai/i, name: 'OpenAI' },
    { pattern: /apple\b/i, name: 'Apple' },
    { pattern: /google|alphabet/i, name: 'Google' },
    { pattern: /microsoft/i, name: 'Microsoft' },
    { pattern: /nvidia/i, name: 'NVIDIA' },
    { pattern: /meta\b|facebook/i, name: 'Meta' },
  ];

  for (const { pattern, name } of orgPatterns) {
    if (pattern.test(lower) && !entities.organizations.includes(name)) {
      entities.organizations.push(name);
    }
  }

  // Locations
  const locationPatterns: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /\bus\b|united\s+states|america/i, name: 'US' },
    { pattern: /\bchina\b|chinese|beijing/i, name: 'China' },
    { pattern: /\brussia\b|russian|moscow|kremlin/i, name: 'Russia' },
    { pattern: /\bukraine\b|ukrainian|kyiv/i, name: 'Ukraine' },
    { pattern: /\btaiwan\b|taiwanese|taipei/i, name: 'Taiwan' },
    { pattern: /\bisrael\b|israeli|tel\s+aviv/i, name: 'Israel' },
    { pattern: /\bgaza\b|palestinian/i, name: 'Gaza' },
    { pattern: /\biran\b|iranian|tehran/i, name: 'Iran' },
    { pattern: /\beu\b|european\s+union|brussels/i, name: 'EU' },
    { pattern: /\buk\b|britain|british|london/i, name: 'UK' },
  ];

  for (const { pattern, name } of locationPatterns) {
    if (pattern.test(lower) && !entities.locations.includes(name)) {
      entities.locations.push(name);
    }
  }

  // Events
  const eventPatterns: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /super\s*bowl/i, name: 'Super Bowl' },
    { pattern: /world\s*series/i, name: 'World Series' },
    { pattern: /nba\s*finals/i, name: 'NBA Finals' },
    { pattern: /stanley\s*cup/i, name: 'Stanley Cup' },
    { pattern: /world\s*cup/i, name: 'World Cup' },
    { pattern: /olympics/i, name: 'Olympics' },
    { pattern: /presidential\s+election/i, name: 'Presidential Election' },
    { pattern: /midterm/i, name: 'Midterm Elections' },
    { pattern: /fomc\s+meeting/i, name: 'FOMC Meeting' },
    { pattern: /oscars?|academy\s+awards?/i, name: 'Oscars' },
  ];

  for (const { pattern, name } of eventPatterns) {
    if (pattern.test(lower) && !entities.events.includes(name)) {
      entities.events.push(name);
    }
  }

  // Dates
  const datePatterns = [
    { pattern: /by\s+(end\s+of\s+)?(20\d{2})/i, type: 'deadline' as const },
    { pattern: /before\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})/i, type: 'deadline' as const },
    { pattern: /in\s+(q[1-4])\s+(20\d{2})/i, type: 'range' as const },
  ];

  for (const { pattern, type } of datePatterns) {
    const match = lower.match(pattern);
    if (match) {
      entities.dates.push({
        raw: match[0],
        normalized: extractEventDate(match[0]),
        type,
      });
    }
  }

  // Amounts
  const amountPatterns = [
    { pattern: /\$(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(k|m|b|thousand|million|billion)?/gi },
    { pattern: /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*%/gi },
    { pattern: /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(btc|eth|bitcoin|ethereum)/gi },
  ];

  for (const { pattern } of amountPatterns) {
    const matches = lower.matchAll(pattern);
    for (const match of matches) {
      let value = parseFloat(match[1].replace(/,/g, ''));
      const suffix = match[2]?.toLowerCase();

      if (suffix === 'k' || suffix === 'thousand') value *= 1000;
      if (suffix === 'm' || suffix === 'million') value *= 1000000;
      if (suffix === 'b' || suffix === 'billion') value *= 1000000000;

      entities.amounts.push({
        raw: match[0],
        value,
        unit: suffix || 'USD',
      });
    }
  }

  return entities;
}

// ============================================
// STAGE 2: HARD FILTERS (EARLY REJECTION)
// ============================================

/**
 * Quick rejection filters - these must pass before expensive comparisons
 * STRICT MATCHING: Categories must match or be truly related (not just "other")
 */
export function passesHardFilters(
  metaA: MarketMetadata,
  metaB: MarketMetadata,
  config: ArbitrageConfig = DEFAULT_ARBITRAGE_CONFIG
): { passes: boolean; reason?: string } {
  // STRICT category matching - only truly related topics can cross-match
  // Sports and politics are NEVER related and should NEVER match
  const relatedCategories: Record<MarketCategory, MarketCategory[]> = {
    politics: ['economics'], // Politics and economics often overlap (Fed policy, trade)
    economics: ['politics', 'crypto'], // Crypto is economics-adjacent
    crypto: ['economics', 'tech'], // Crypto overlaps with both
    tech: ['crypto', 'science'], // Tech overlaps with science
    sports: [], // Sports should ONLY match sports - no cross-category
    entertainment: [], // Entertainment should ONLY match entertainment
    science: ['tech'], // Science overlaps with tech
    other: [], // "Other" should NOT be a wildcard - require same category
  };

  // Categories must either match exactly OR be in the related list
  if (metaA.category !== metaB.category) {
    const relatedA = relatedCategories[metaA.category] || [];
    const relatedB = relatedCategories[metaB.category] || [];

    // Neither direction allows this cross-category match
    if (!relatedA.includes(metaB.category) && !relatedB.includes(metaA.category)) {
      return { passes: false, reason: `Category mismatch: ${metaA.category} vs ${metaB.category} (not related)` };
    }
  }

  // Extra strict: if one is "other" and the other is a specific category, reject
  // This prevents random uncategorized markets from matching with specific ones
  if ((metaA.category === 'other' && metaB.category !== 'other') ||
      (metaA.category !== 'other' && metaB.category === 'other')) {
    return { passes: false, reason: `Category mismatch: ${metaA.category} vs ${metaB.category} (one is uncategorized)` };
  }

  // Must be same outcome type
  if (metaA.outcomeType !== metaB.outcomeType) {
    return { passes: false, reason: `Outcome type mismatch: ${metaA.outcomeType} vs ${metaB.outcomeType}` };
  }

  // If both have dates, they must be within tolerance (but be lenient - 30 days)
  if (metaA.eventDate && metaB.eventDate) {
    const daysDiff = Math.abs(metaA.eventDate.getTime() - metaB.eventDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 30) { // 30 days tolerance
      return { passes: false, reason: `Date mismatch: ${daysDiff.toFixed(0)} days apart` };
    }
  }

  // Don't check resolution dates strictly - they might not be set

  // If subcategories are specified and BOTH are set, they should match
  if (metaA.subcategory && metaB.subcategory && metaA.subcategory !== metaB.subcategory) {
    // Only block if they're clearly incompatible
    return { passes: false, reason: `Subcategory mismatch: ${metaA.subcategory} vs ${metaB.subcategory}` };
  }

  return { passes: true };
}

// ============================================
// STAGE 3: ENTITY COMPARISON
// ============================================

/**
 * Compare extracted entities between two markets
 */
function compareEntities(
  entitiesA: ExtractedEntities,
  entitiesB: ExtractedEntities
): { score: number; matching: string[]; conflicting: string[] } {
  const matching: string[] = [];
  const conflicting: string[] = [];

  // Compare people
  const peopleA = new Set(entitiesA.people.map(p => p.toLowerCase()));
  const peopleB = new Set(entitiesB.people.map(p => p.toLowerCase()));

  for (const person of peopleA) {
    if (peopleB.has(person)) {
      matching.push(`Person: ${person}`);
    }
  }

  // Check for conflicting people (e.g., different candidates in "who will win")
  if (peopleA.size > 0 && peopleB.size > 0) {
    const intersection = [...peopleA].filter(p => peopleB.has(p));
    if (intersection.length === 0) {
      // No overlap - potential conflict
      conflicting.push(`People: ${[...peopleA].join(',')} vs ${[...peopleB].join(',')}`);
    }
  }

  // Compare organizations
  const orgsA = new Set(entitiesA.organizations.map(o => o.toLowerCase()));
  const orgsB = new Set(entitiesB.organizations.map(o => o.toLowerCase()));

  for (const org of orgsA) {
    if (orgsB.has(org)) {
      matching.push(`Org: ${org}`);
    }
  }

  // Compare events
  const eventsA = new Set(entitiesA.events.map(e => e.toLowerCase()));
  const eventsB = new Set(entitiesB.events.map(e => e.toLowerCase()));

  for (const event of eventsA) {
    if (eventsB.has(event)) {
      matching.push(`Event: ${event}`);
    }
  }

  // Compare amounts (must be same value)
  for (const amountA of entitiesA.amounts) {
    for (const amountB of entitiesB.amounts) {
      if (Math.abs(amountA.value - amountB.value) < 0.01 * amountA.value) {
        matching.push(`Amount: ${amountA.raw}`);
      } else if (amountA.unit === amountB.unit) {
        conflicting.push(`Amount: ${amountA.raw} vs ${amountB.raw}`);
      }
    }
  }

  // Calculate score
  const totalA = entitiesA.people.length + entitiesA.organizations.length +
                 entitiesA.events.length + entitiesA.amounts.length;
  const totalB = entitiesB.people.length + entitiesB.organizations.length +
                 entitiesB.events.length + entitiesB.amounts.length;

  if (totalA === 0 && totalB === 0) {
    return { score: 0.5, matching, conflicting }; // No entities to compare
  }

  const matchScore = matching.length / Math.max(totalA, totalB, 1);
  const conflictPenalty = conflicting.length > 0 ? 0.3 : 0;

  return {
    score: Math.max(0, matchScore - conflictPenalty),
    matching,
    conflicting,
  };
}

// ============================================
// STAGE 4: SEMANTIC SIMILARITY
// ============================================

/**
 * Calculate semantic similarity with enhanced algorithm
 */
function calculateSemanticSimilarity(titleA: string, titleB: string): number {
  const normA = normalizeTitle(titleA);
  const normB = normalizeTitle(titleB);

  // 1. Character-level similarity (Levenshtein-like)
  const charSim = characterSimilarity(normA, normB);

  // 2. Word-level Jaccard
  const wordsA = new Set(normA.split(' ').filter(w => w.length > 2));
  const wordsB = new Set(normB.split(' ').filter(w => w.length > 2));

  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  const jaccard = union.size > 0 ? intersection.size / union.size : 0;

  // 3. Synonym-aware matching
  let synonymMatches = 0;
  for (const wordA of wordsA) {
    for (const wordB of wordsB) {
      if (wordA !== wordB && areSynonyms(wordA, wordB)) {
        synonymMatches++;
        break;
      }
    }
  }
  const synonymBonus = Math.min(0.2, synonymMatches * 0.05);

  // 4. Key phrase matching
  let phraseBonus = 0;
  const keyPhrases = [
    'will win', 'by end of', 'before', 'after', 'reach', 'exceed',
    'drop below', 'rise above', 'be confirmed', 'be nominated',
  ];

  for (const phrase of keyPhrases) {
    if (normA.includes(phrase) && normB.includes(phrase)) {
      phraseBonus += 0.05;
    }
  }
  phraseBonus = Math.min(0.15, phraseBonus);

  // Weighted combination
  return Math.min(1, 0.3 * charSim + 0.4 * jaccard + synonymBonus + phraseBonus);
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function characterSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // Longest common subsequence ratio
  let matches = 0;
  let j = 0;
  for (let i = 0; i < a.length && j < b.length; i++) {
    if (a[i] === b[j]) {
      matches++;
      j++;
    }
  }

  return (2 * matches) / (a.length + b.length);
}

// ============================================
// STAGE 5: FULL EQUIVALENCE SCORING
// ============================================

/**
 * Calculate comprehensive equivalence score between two markets
 */
export function calculateEquivalence(
  metaA: MarketMetadata,
  metaB: MarketMetadata,
  config: ArbitrageConfig = DEFAULT_ARBITRAGE_CONFIG
): EquivalenceScore {
  const warnings: string[] = [];
  const disqualifiers: string[] = [];

  // Check hard filters first
  const hardFilterResult = passesHardFilters(metaA, metaB, config);
  if (!hardFilterResult.passes) {
    disqualifiers.push(hardFilterResult.reason!);
    return {
      overallScore: 0,
      titleSimilarity: 0,
      entityOverlap: 0,
      dateAlignment: 0,
      categoryMatch: 0,
      outcomeAlignment: 0,
      validations: {
        sameCoreEvent: false,
        sameTimeframe: false,
        sameOutcomeStructure: false,
        noResolutionConflict: false,
        entitiesMatch: false,
      },
      warnings,
      disqualifiers,
    };
  }

  // Calculate component scores
  const titleSimilarity = calculateSemanticSimilarity(metaA.title, metaB.title);

  const entityComparison = compareEntities(metaA.entities, metaB.entities);
  const entityOverlap = entityComparison.score;

  if (entityComparison.conflicting.length > 0) {
    warnings.push(`Conflicting entities: ${entityComparison.conflicting.join(', ')}`);
  }

  // Date alignment
  let dateAlignment = 0.5; // Default if no dates
  if (metaA.eventDate && metaB.eventDate) {
    const daysDiff = Math.abs(metaA.eventDate.getTime() - metaB.eventDate.getTime()) / (1000 * 60 * 60 * 24);
    dateAlignment = Math.max(0, 1 - daysDiff / 30); // 30 days = 0 alignment
  } else if ((metaA.eventDate && !metaB.eventDate) || (!metaA.eventDate && metaB.eventDate)) {
    dateAlignment = 0.3; // One has date, one doesn't
    warnings.push('Only one market has event date');
  }

  // Category match (binary)
  const categoryMatch = metaA.category === metaB.category ? 1 : 0;

  // Outcome alignment
  const outcomeAlignment = metaA.outcomeType === metaB.outcomeType ? 1 : 0;

  // Build validations
  const validations: EquivalenceValidations = {
    sameCoreEvent: entityOverlap > 0.3 && titleSimilarity > 0.5,
    sameTimeframe: dateAlignment > 0.7,
    sameOutcomeStructure: outcomeAlignment === 1,
    noResolutionConflict: entityComparison.conflicting.length === 0,
    entitiesMatch: entityComparison.matching.length > 0 && entityComparison.conflicting.length === 0,
  };

  // Check for critical failures
  if (entityComparison.conflicting.length > 0 && entityComparison.matching.length === 0) {
    disqualifiers.push('No matching entities and conflicting entities detected');
  }

  // STRICT: Require at least SOME entity overlap OR very high title similarity
  // This prevents matching completely unrelated markets with similar wording
  const hasEntityOverlap = entityComparison.matching.length > 0;
  const hasHighTitleSimilarity = titleSimilarity >= 0.75;

  if (!hasEntityOverlap && !hasHighTitleSimilarity) {
    // No matching entities and low title similarity = likely different markets
    disqualifiers.push('No entity overlap and insufficient title similarity');
  }

  // Additional: If title similarity is very low, always reject
  if (titleSimilarity < 0.30) {
    disqualifiers.push(`Title similarity too low: ${(titleSimilarity * 100).toFixed(0)}%`);
  }

  // Calculate overall score
  // Heavy penalty if validations fail
  const validationPenalty = Object.values(validations).filter(v => !v).length * 0.1;

  const overallScore = Math.max(0,
    0.35 * titleSimilarity +
    0.30 * entityOverlap +
    0.15 * dateAlignment +
    0.10 * categoryMatch +
    0.10 * outcomeAlignment -
    validationPenalty
  );

  // Additional checks for low scores
  if (titleSimilarity < config.minTitleSimilarity) {
    warnings.push(`Title similarity ${(titleSimilarity * 100).toFixed(0)}% below threshold`);
  }

  if (entityOverlap < 0.3) {
    warnings.push('Low entity overlap - markets may not be equivalent');
  }

  return {
    overallScore,
    titleSimilarity,
    entityOverlap,
    dateAlignment,
    categoryMatch,
    outcomeAlignment,
    validations,
    warnings,
    disqualifiers,
  };
}

// ============================================
// STAGE 6: OUTCOME MAPPING
// ============================================

/**
 * Determine how outcomes map between platforms
 * Some platforms might invert Yes/No or use different terminology
 */
function determineOutcomeMapping(
  metaA: MarketMetadata,
  metaB: MarketMetadata
): OutcomeMapping {
  // For binary markets, check if outcomes are inverted
  // e.g., "Will X happen?" vs "X will NOT happen"

  const titleA = metaA.title.toLowerCase();
  const titleB = metaB.title.toLowerCase();

  // Check for negation patterns
  const negationPatterns = [
    /\bnot\b/i,
    /\bwon't\b/i,
    /\bwill\s+not\b/i,
    /\bfail\s+to\b/i,
    /\brefuse\s+to\b/i,
  ];

  const aHasNegation = negationPatterns.some(p => p.test(titleA));
  const bHasNegation = negationPatterns.some(p => p.test(titleB));

  // If one has negation and other doesn't, outcomes are inverted
  const isInverted = aHasNegation !== bHasNegation;

  if (isInverted) {
    return {
      aToB: { 0: 1, 1: 0 }, // Yes on A = No on B
      bToA: { 0: 1, 1: 0 },
      isInverted: true,
    };
  }

  return {
    aToB: { 0: 0, 1: 1 }, // Yes on A = Yes on B
    bToA: { 0: 0, 1: 1 },
    isInverted: false,
  };
}

// ============================================
// MAIN MATCHING FUNCTION
// ============================================

/**
 * Match markets across platforms with full validation
 * Returns only validated pairs that pass all checks
 */
export function matchMarkets(
  marketsA: Market[],
  marketsB: Market[],
  config: ArbitrageConfig = DEFAULT_ARBITRAGE_CONFIG
): ValidatedMarketPair[] {
  const validatedPairs: ValidatedMarketPair[] = [];
  let debugCount = 0;

  // Extract metadata for all markets
  const metadataA = marketsA.map(m => ({ market: m, meta: extractMetadata(m) }));
  const metadataB = marketsB.map(m => ({ market: m, meta: extractMetadata(m) }));

  for (const { market: marketA, meta: metaA } of metadataA) {
    let bestMatch: { market: Market; meta: MarketMetadata; equivalence: EquivalenceScore } | null = null;

    for (const { market: marketB, meta: metaB } of metadataB) {
      // Skip same platform (shouldn't happen but safety check)
      if (marketA.platform === marketB.platform) continue;

      // Calculate equivalence
      const equivalence = calculateEquivalence(metaA, metaB, config);

      // Debug: show top potential matches
      if (debugCount < 5 && equivalence.overallScore > 0.35) {
        console.log(`  [Match Debug] "${metaA.title.slice(0, 40)}" vs "${metaB.title.slice(0, 40)}"`);
        console.log(`    Score: ${(equivalence.overallScore * 100).toFixed(1)}% | Title: ${(equivalence.titleSimilarity * 100).toFixed(1)}% | Entity: ${(equivalence.entityOverlap * 100).toFixed(1)}%`);
        console.log(`    Category: ${metaA.category} vs ${metaB.category}`);
        if (equivalence.disqualifiers.length > 0) {
          console.log(`    Disqualified: ${equivalence.disqualifiers.join(', ')}`);
        }
        if (equivalence.warnings.length > 0) {
          console.log(`    Warnings: ${equivalence.warnings.join(', ')}`);
        }
        debugCount++;
      }

      // Skip if below threshold or has disqualifiers
      if (equivalence.disqualifiers.length > 0) continue;
      if (equivalence.overallScore < config.minEquivalenceScore) continue;

      // Track best match
      if (!bestMatch || equivalence.overallScore > bestMatch.equivalence.overallScore) {
        bestMatch = { market: marketB, meta: metaB, equivalence };
      }
    }

    // Add validated pair if we found a good match
    if (bestMatch) {
      console.log(`  [MATCH] ${marketA.platform}: "${marketA.title.slice(0, 35)}" ↔ ${bestMatch.market.platform}: "${bestMatch.market.title.slice(0, 35)}" (${(bestMatch.equivalence.overallScore * 100).toFixed(0)}%)`);

      const outcomeMapping = determineOutcomeMapping(metaA, bestMatch.meta);

      validatedPairs.push({
        marketA,
        marketB: bestMatch.market,
        metadataA: metaA,
        metadataB: bestMatch.meta,
        equivalence: bestMatch.equivalence,
        outcomeMapping,
      });
    }
  }

  // Sort by equivalence score (highest first)
  return validatedPairs.sort((a, b) => b.equivalence.overallScore - a.equivalence.overallScore);
}

/**
 * Quick stats for debugging
 */
export function getMatchingStats(pairs: ValidatedMarketPair[]): {
  total: number;
  avgEquivalence: number;
  avgTitleSimilarity: number;
  avgEntityOverlap: number;
  invertedCount: number;
} {
  if (pairs.length === 0) {
    return {
      total: 0,
      avgEquivalence: 0,
      avgTitleSimilarity: 0,
      avgEntityOverlap: 0,
      invertedCount: 0,
    };
  }

  const sum = pairs.reduce((acc, p) => ({
    equivalence: acc.equivalence + p.equivalence.overallScore,
    titleSim: acc.titleSim + p.equivalence.titleSimilarity,
    entityOverlap: acc.entityOverlap + p.equivalence.entityOverlap,
    inverted: acc.inverted + (p.outcomeMapping.isInverted ? 1 : 0),
  }), { equivalence: 0, titleSim: 0, entityOverlap: 0, inverted: 0 });

  return {
    total: pairs.length,
    avgEquivalence: sum.equivalence / pairs.length,
    avgTitleSimilarity: sum.titleSim / pairs.length,
    avgEntityOverlap: sum.entityOverlap / pairs.length,
    invertedCount: sum.inverted,
  };
}
