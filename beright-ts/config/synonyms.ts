/**
 * Synonym Mappings for Cross-Platform Market Matching
 *
 * Different platforms use different terminology for the same events.
 * This helps match "Super Bowl" with "Pro Football Championship", etc.
 */

// Bidirectional synonym groups - any term matches any other in the group
export const SYNONYM_GROUPS: string[][] = [
  // Sports Championships
  ['super bowl', 'pro football championship', 'nfl championship', 'big game'],
  ['world series', 'mlb championship', 'baseball championship'],
  ['nba finals', 'nba championship', 'basketball championship'],
  ['stanley cup', 'nhl championship', 'hockey championship'],
  ['march madness', 'ncaa tournament', 'college basketball tournament'],

  // Politics - US
  ['president', 'potus', 'white house', 'oval office'],
  ['trump', 'donald trump', 'trump administration'],
  ['biden', 'joe biden', 'biden administration'],
  ['fed', 'federal reserve', 'fomc', 'fed chair', 'jerome powell', 'powell'],
  ['congress', 'house of representatives', 'senate', 'capitol hill'],
  ['midterms', 'midterm elections', 'congressional elections'],

  // Economics
  ['rate cut', 'interest rate cut', 'fed cut', 'rate reduction'],
  ['rate hike', 'interest rate hike', 'fed hike', 'rate increase'],
  ['inflation', 'cpi', 'consumer price index', 'price inflation'],
  ['gdp', 'gross domestic product', 'economic growth'],
  ['recession', 'economic downturn', 'negative gdp'],
  ['unemployment', 'jobless', 'jobs report', 'labor market'],

  // Crypto (avoid short terms that cause false positives)
  ['bitcoin', 'bitcoin price'],
  ['ethereum', 'ethereum price'],
  ['crypto', 'cryptocurrency', 'digital assets'],
  ['etf', 'exchange traded fund', 'spot etf'],

  // Tech
  ['ai', 'artificial intelligence', 'machine learning', 'gpt', 'llm'],
  ['agi', 'artificial general intelligence'],
  ['openai', 'open ai', 'chatgpt', 'chat gpt'],
  ['elon', 'elon musk', 'musk'],

  // Geopolitics
  ['ukraine', 'russia ukraine', 'ukraine war', 'ukraine conflict'],
  ['china', 'prc', 'beijing'],
  ['taiwan', 'roc', 'taiwan strait'],
  ['middle east', 'israel', 'gaza', 'hamas'],

  // Time expressions
  ['by end of year', 'by december', 'by dec 31', 'eoy'],
  ['q1', 'first quarter', 'jan-mar'],
  ['q2', 'second quarter', 'apr-jun'],
  ['q3', 'third quarter', 'jul-sep'],
  ['q4', 'fourth quarter', 'oct-dec'],
];

// Build lookup map for O(1) synonym finding
const synonymMap = new Map<string, Set<string>>();

for (const group of SYNONYM_GROUPS) {
  const groupSet = new Set(group.map(s => s.toLowerCase()));
  for (const term of group) {
    const existing = synonymMap.get(term.toLowerCase());
    if (existing) {
      // Merge groups
      for (const s of groupSet) existing.add(s);
      for (const s of existing) groupSet.add(s);
    } else {
      synonymMap.set(term.toLowerCase(), groupSet);
    }
  }
}

/**
 * Get all synonyms for a term
 */
export function getSynonyms(term: string): string[] {
  const lower = term.toLowerCase();
  const synonyms = synonymMap.get(lower);
  return synonyms ? Array.from(synonyms) : [lower];
}

/**
 * Check if two terms are synonyms
 */
export function areSynonyms(termA: string, termB: string): boolean {
  const lowerA = termA.toLowerCase();
  const lowerB = termB.toLowerCase();

  if (lowerA === lowerB) return true;

  const synonymsA = synonymMap.get(lowerA);
  if (synonymsA && synonymsA.has(lowerB)) return true;

  return false;
}

/**
 * Expand text with synonyms for better matching
 * Returns original text + all synonym variations
 */
export function expandWithSynonyms(text: string): string[] {
  const lower = text.toLowerCase();
  const results = [lower];

  // Check each synonym group
  for (const group of SYNONYM_GROUPS) {
    for (const term of group) {
      if (lower.includes(term.toLowerCase())) {
        // Add variations with other synonyms from the group
        for (const synonym of group) {
          if (synonym.toLowerCase() !== term.toLowerCase()) {
            const variation = lower.replace(term.toLowerCase(), synonym.toLowerCase());
            if (!results.includes(variation)) {
              results.push(variation);
            }
          }
        }
      }
    }
  }

  return results;
}

/**
 * Extract key entities from text for matching
 */
export function extractEntities(text: string): Set<string> {
  const lower = text.toLowerCase();
  const entities = new Set<string>();

  // Check which synonym groups are mentioned
  for (const group of SYNONYM_GROUPS) {
    for (const term of group) {
      if (lower.includes(term.toLowerCase())) {
        // Add a canonical form (first in group) as the entity
        entities.add(group[0].toLowerCase());
        break;
      }
    }
  }

  return entities;
}

/**
 * Calculate entity overlap between two texts
 * Returns 0-1 score based on shared entities
 */
export function entityOverlap(textA: string, textB: string): number {
  const entitiesA = extractEntities(textA);
  const entitiesB = extractEntities(textB);

  if (entitiesA.size === 0 || entitiesB.size === 0) return 0;

  const intersection = new Set([...entitiesA].filter(e => entitiesB.has(e)));
  const union = new Set([...entitiesA, ...entitiesB]);

  return intersection.size / union.size;
}
