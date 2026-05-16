/**
 * Smart Intent Classifier for BeRight Agent
 *
 * Understands user intent from natural language, not just keywords.
 * Routes messages to the right agent based on semantic meaning.
 *
 * Goals:
 * - Detect user intent from freeform text
 * - Route to appropriate agent (Scout, Analyst, Trader, etc.)
 * - Avoid spam/dumb responses
 * - Be context-aware
 */

// ============================================
// INTENT TYPES
// ============================================

export type IntentType =
  | 'MARKET_SEARCH'      // Looking for specific markets
  | 'HOT_TRENDING'       // What's hot/trending
  | 'ARBITRAGE'          // Looking for arb opportunities
  | 'RESEARCH'           // Deep analysis on a topic
  | 'ODDS_COMPARE'       // Compare prices across platforms
  | 'WHALE_TRACKING'     // Track whale/smart money
  | 'TRADE_QUOTE'        // Get a trade quote
  | 'PORTFOLIO'          // View positions/portfolio
  | 'ALERTS'             // Set/view alerts
  | 'PREDICTION'         // Make a prediction
  | 'CALIBRATION'        // View calibration/accuracy
  | 'NEWS_INTEL'         // Get news/social sentiment
  | 'EDUCATIONAL'        // Learn about concepts
  | 'GREETING'           // Hello/hi
  | 'HELP'               // How to use
  | 'CONVERSATION'       // Meta questions about the bot (who are you, what did you do, etc.)
  | 'UNKNOWN';           // Can't determine

export interface IntentResult {
  intent: IntentType;
  confidence: number;        // 0-1
  agent: 'scout' | 'analyst' | 'trader' | 'commander' | 'none';
  extractedQuery?: string;   // The actual query/topic extracted
  reasoning?: string;        // Why this intent was detected
}

// ============================================
// INTENT PATTERNS
// ============================================

interface IntentPattern {
  intent: IntentType;
  agent: IntentResult['agent'];
  patterns: RegExp[];
  keywords: string[];
  priority: number;  // Higher = check first
}

const INTENT_PATTERNS: IntentPattern[] = [
  // GREETINGS (highest priority - short circuit)
  {
    intent: 'GREETING',
    agent: 'commander',
    patterns: [
      // Match single or repeated greetings: "gm", "gm gm", "hey hey", "hello!", etc.
      /^(hi|hey|hello|gm|gn|yo|sup|hola|greetings|good\s*(morning|afternoon|evening|day))(\s+(hi|hey|hello|gm|gn|yo|sup))*[\s!.,]*$/i,
    ],
    keywords: [],
    priority: 100,
  },

  // HELP
  {
    intent: 'HELP',
    agent: 'commander',
    patterns: [
      /^(help|how\s+do\s+i|what\s+can\s+you|commands|menu)[\s?]*$/i,
      /^what\s+(do\s+you\s+do|are\s+you|is\s+this)/i,
      // "what you do", "what do you do", "what can you do"
      /^what\s+(can\s+)?(you|u)\s+do/i,
      // Catch questions about commands: "what is X command", "what is X command for", "what does X do"
      /\b(what\s+is|what\s+does|how\s+does|explain)\b.*(command|\/\w+)\b/i,
      /\b(command|\/\w+)\b.*(for|do|does|mean|used\s+for)/i,
      // "what is /intel for", "what does /hot do"
      /^what\s+(is|does)\s+\/?\w+\s+(for|do)/i,
    ],
    keywords: ['help', 'how to', 'what can you', 'command for', 'commands', 'what you do'],
    priority: 99,
  },

  // CONVERSATION (meta questions about the bot itself - NOT market queries)
  {
    intent: 'CONVERSATION',
    agent: 'commander',
    patterns: [
      // Questions about the bot's actions/history
      /\b(who|what)\s+(talk(ed)?|spoke|chat(ted)?|messaged|contacted)\s+(with\s+)?(you|to\s+you|the\s+bot)/i,
      /\b(who|what)\s+(did\s+you|have\s+you)\s+(talk|speak|chat|message|do|see)/i,
      /\bwho\s+(are\s+)?you(r)?\s*(users?|friends?|contacts?)?\b/i,
      // "who talked to you", "who messaged you today", "what did you do today"
      /\b(what|who)\s+did\s+(you|the\s+bot)\s+(do|see|process|handle)/i,
      /\bwhat\s+(have\s+)?you\s+(been\s+)?(doing|up\s+to)/i,
      // "who talked to you today", "who messaged you yesterday"
      /\bwho\s+\w+\s+(to\s+)?you\s+(today|yesterday|this\s+week|recently)/i,
      // Personal questions about the bot
      /\b(how\s+are\s+you|how'?s\s+it\s+going|what'?s\s+up|wassup)\b/i,
      /\b(tell\s+me\s+about\s+yourself|who\s+made\s+you|who\s+created\s+you)\b/i,
      // "are you a bot", "are you AI", "are you real"
      /\bare\s+you\s+(a\s+)?(bot|ai|robot|human|real|alive)/i,
      // Conversational follow-ups that aren't market queries
      /^(yes|no|ok|okay|thanks|thank\s+you|cool|nice|great|awesome|got\s+it|understood)[\s!.]*$/i,
      // Random conversational noise
      /^(lol|lmao|haha|hehe|wow|omg|wtf)[\s!.]*$/i,
    ],
    keywords: [],  // No keywords - rely on patterns only
    priority: 98,
  },

  // EDUCATIONAL (before research to catch concept queries)
  {
    intent: 'EDUCATIONAL',
    agent: 'analyst',
    patterns: [
      /^(what\s+is|what\s+are|how\s+does|how\s+do|explain|define|tell\s+me\s+about|learn\s+about)/i,
      /^(basics\s+of|introduction\s+to|guide\s+to|overview\s+of)/i,
      // "how many X are there", "how many platforms", "list of X"
      /^how\s+many\s+.*(are\s+there|exist|platforms?|providers?|markets?)/i,
      /^(list|name|which)\s+(of\s+|the\s+)?(all\s+)?(prediction\s+)?(market\s+)?(platforms?|providers?|exchanges?)/i,
      // General knowledge questions about prediction markets
      /\b(prediction\s+market|polymarket|kalshi|manifold|metaculus)\s+(is|are|platform|work)/i,
      /\bwhat\s+(platforms?|sites?|exchanges?)\s+(do\s+you|can\s+i|are\s+there)/i,
      // "tell me about", "explain how"
      /^(can\s+you\s+)?(tell|explain|describe|teach)\s+(me\s+)?(about|how)/i,
      // "what is the difference", "compare X and Y"
      /\bwhat('s|\s+is)\s+the\s+difference\s+between/i,
    ],
    keywords: [
      'what is', 'what are', 'how does', 'how do', 'explain',
      'meaning of', 'definition', 'understand', 'learn about',
      'how many', 'list of', 'which platforms', 'prediction market platforms',
      'tell me about', 'teach me',
    ],
    priority: 85,
  },

  // ARBITRAGE
  {
    intent: 'ARBITRAGE',
    agent: 'scout',
    patterns: [
      /\b(arb|arbitrage|spread|mispriced|price\s+difference|discrepancy)\b/i,
      /\b(free\s+money|risk\s*free|guaranteed\s+profit)\b/i,
    ],
    keywords: [
      'arb', 'arbitrage', 'spread', 'mispriced', 'mispricing',
      'price difference', 'discrepancy', 'inefficiency',
    ],
    priority: 80,
  },

  // HOT/TRENDING
  {
    intent: 'HOT_TRENDING',
    agent: 'scout',
    patterns: [
      /\b(hot|trending|popular|buzz|hype|volume|moving|momentum)\b/i,
      /\b(what'?s\s+(hot|trending|moving|popular))\b/i,
      /\b(top\s+markets?|biggest\s+movers?)\b/i,
    ],
    keywords: [
      'hot', 'trending', 'popular', 'buzz', 'hype', 'volume',
      'moving', 'momentum', 'top markets', 'biggest', 'movers',
      "what's hot", "what's trending", "what's moving",
    ],
    priority: 75,
  },

  // WHALE/SMART MONEY
  {
    intent: 'WHALE_TRACKING',
    agent: 'scout',
    patterns: [
      /\b(whale|whales|smart\s+money|big\s+players?|large\s+positions?)\b/i,
      /\b(who'?s\s+buying|institutional|big\s+bets?)\b/i,
    ],
    keywords: [
      'whale', 'whales', 'smart money', 'big players', 'institutional',
      'large positions', "who's buying", 'big bets',
    ],
    priority: 70,
  },

  // NEWS/INTEL
  {
    intent: 'NEWS_INTEL',
    agent: 'scout',
    patterns: [
      /\b(news|headlines?|twitter|reddit|social|sentiment)\b/i,
      /\b(what'?s\s+happening|latest\s+on|updates?\s+on)\b/i,
    ],
    keywords: [
      'news', 'headlines', 'twitter', 'reddit', 'social',
      'sentiment', "what's happening", 'latest', 'updates',
    ],
    priority: 65,
  },

  // ODDS COMPARISON
  {
    intent: 'ODDS_COMPARE',
    agent: 'analyst',
    patterns: [
      /\b(odds|compare|comparison|prices?\s+across|which\s+platform)\b/i,
      /\b(best\s+price|cheapest|where\s+to\s+buy)\b/i,
    ],
    keywords: [
      'odds', 'compare', 'comparison', 'prices across',
      'best price', 'cheapest', 'where to buy', 'which platform',
    ],
    priority: 60,
  },

  // RESEARCH/ANALYSIS - Enhanced for natural market conversations
  {
    intent: 'RESEARCH',
    agent: 'analyst',
    patterns: [
      /\b(research|analyze|analysis|deep\s+dive|investigate|study)\b/i,
      /\b(what\s+do\s+you\s+think|your\s+take|opinion\s+on)\b/i,
      /\b(probability|likelihood|chances?|forecast)\b/i,
      // Natural market questions
      /\bwill\s+.+\s+(happen|win|pass|reach|hit|go|be)\b/i,
      /\bwhat('s|\s+is)\s+(the\s+)?(chance|probability|likelihood)\b/i,
      /\bdo\s+you\s+think\s+.+\s+will\b/i,
      /\bhow\s+likely\s+is\b/i,
      /\bshould\s+i\s+(bet|buy|invest|trade)\b/i,
      // Prediction market specific
      /\b(polymarket|kalshi|manifold|metaculus)\s+.*(says?|shows?|pricing|at)\b/i,
      /\bwhat('s|\s+is)\s+.*(pricing|priced|odds)\b/i,
      // "Is X going to Y" patterns
      /\bis\s+.+\s+(going\s+to|gonna|likely\s+to)\b/i,
      // Opinion seeking
      /\b(agree|disagree|think|believe)\s+(that|the|market|it)\b/i,
      /\bchange\s+my\s+mind\b/i,
      /\bwhy\s+is\s+.*(market|polymarket|kalshi).*\s+(pricing|priced|at)\b/i,
    ],
    keywords: [
      'research', 'analyze', 'analysis', 'deep dive', 'investigate',
      'what do you think', 'your take', 'probability', 'likelihood',
      'chances', 'forecast', 'will it happen', 'going to happen',
      'should i bet', 'is it likely', 'market pricing', 'change my mind',
      'what are the odds', 'do you agree', 'do you think',
    ],
    priority: 55,
  },

  // PREDICTION
  {
    intent: 'PREDICTION',
    agent: 'commander',
    patterns: [
      /\b(predict|prediction|i\s+think|my\s+bet|betting|wager)\b/i,
      /\b(\d+%?\s*(yes|no)|yes\s+\d+%?|no\s+\d+%?)\b/i,
    ],
    keywords: [
      'predict', 'prediction', 'i think', 'my bet', 'betting',
      'wager', 'i believe',
    ],
    priority: 50,
  },

  // TRADE/QUOTE
  {
    intent: 'TRADE_QUOTE',
    agent: 'trader',
    patterns: [
      /\b(buy|sell|trade|swap|quote|price\s+check)\b/i,
      /\b(how\s+much\s+(for|to|is)|cost\s+of)\b/i,
      /\b(\d+\s*(usdc?|sol|usd|\$))/i,
    ],
    keywords: [
      'buy', 'sell', 'trade', 'swap', 'quote', 'price check',
      'how much', 'cost', 'usdc', 'execute',
    ],
    priority: 45,
  },

  // PORTFOLIO
  {
    intent: 'PORTFOLIO',
    agent: 'commander',
    patterns: [
      /\b(portfolio|positions?|holdings?|my\s+bets?|pnl|profit|loss)\b/i,
      /\b(what\s+do\s+i\s+(have|own|hold))\b/i,
    ],
    keywords: [
      'portfolio', 'positions', 'holdings', 'my bets', 'pnl',
      'profit', 'loss', 'what do i have',
    ],
    priority: 40,
  },

  // ALERTS
  {
    intent: 'ALERTS',
    agent: 'commander',
    patterns: [
      /\b(alert|notify|tell\s+me\s+when|watch|monitor)\b/i,
      /\b(above|below|reaches?|hits?)\s+\d+/i,
    ],
    keywords: [
      'alert', 'notify', 'tell me when', 'watch', 'monitor',
      'set alert', 'price alert',
    ],
    priority: 35,
  },

  // CALIBRATION
  {
    intent: 'CALIBRATION',
    agent: 'analyst',
    patterns: [
      /\b(calibration|accuracy|brier|score|performance|track\s+record)\b/i,
      /\b(how\s+(good|accurate|calibrated)\s+am\s+i)\b/i,
    ],
    keywords: [
      'calibration', 'accuracy', 'brier', 'score', 'performance',
      'track record', 'how good am i',
    ],
    priority: 30,
  },

  // MARKET SEARCH (lowest priority - catch-all for market queries)
  {
    intent: 'MARKET_SEARCH',
    agent: 'scout',
    patterns: [
      /\b(market|markets|find|search|show\s+me|looking\s+for)\b/i,
    ],
    keywords: [
      'market', 'markets', 'find', 'search', 'show me', 'looking for',
    ],
    priority: 10,
  },
];

// ============================================
// EDUCATIONAL TOPIC DETECTION
// ============================================

const EDUCATIONAL_TOPICS = [
  'prediction market', 'prediction markets',
  'forecasting', 'superforecaster', 'superforecasting',
  'arbitrage', 'market making', 'odds', 'probability',
  'calibration', 'brier score', 'base rate', 'base rates',
  'bayesian', 'trading strategy', 'wisdom of crowds',
  'polymarket', 'kalshi', 'manifold', 'metaculus',
];

function isEducationalTopic(text: string): boolean {
  const lower = text.toLowerCase();
  return EDUCATIONAL_TOPICS.some(topic =>
    lower === topic || lower.includes(topic)
  );
}

// ============================================
// QUERY EXTRACTION
// ============================================

/**
 * Extract the actual query/topic from user text
 * Removes intent indicators to get the core question
 */
function extractQuery(text: string): string {
  let query = text;

  // Remove common prefixes
  const prefixes = [
    /^(can\s+you|please|could\s+you|i\s+want\s+to|i\s+need\s+to|show\s+me|tell\s+me|find\s+me|get\s+me)\s+/i,
    /^(research|analyze|search\s+for|look\s+up|check)\s+/i,
    /^(what\s+is|what\s+are|how\s+does|how\s+do)\s+/i,
    /^(the\s+)?/i,
  ];

  for (const prefix of prefixes) {
    query = query.replace(prefix, '');
  }

  // Remove trailing punctuation
  query = query.replace(/[?!.]+$/, '').trim();

  return query || text;
}

// ============================================
// MAIN CLASSIFIER
// ============================================

/**
 * Classify user intent from natural language
 *
 * @param text - User's message
 * @param context - Optional context (previous messages, user data)
 * @returns Intent classification with confidence
 */
export function classifyIntent(
  text: string,
  context?: { previousIntent?: IntentType; userSpecialization?: string }
): IntentResult {
  const normalizedText = text.trim().toLowerCase();

  // Short-circuit for very short messages
  if (normalizedText.length < 2) {
    return {
      intent: 'UNKNOWN',
      confidence: 0,
      agent: 'none',
      reasoning: 'Message too short',
    };
  }

  // Check for explicit commands first (highest confidence)
  if (text.startsWith('/')) {
    return classifyCommand(text);
  }

  // Check for educational topics EARLY (before keyword matching can catch them)
  // This prevents "prediction markets" from being caught by PREDICTION keyword "prediction"
  if (isEducationalTopic(normalizedText) && !hasMarketIndicators(normalizedText)) {
    return {
      intent: 'EDUCATIONAL',
      confidence: 0.85,
      agent: 'analyst',
      extractedQuery: extractQuery(text),
      reasoning: 'Educational topic detected (early check)',
    };
  }

  // Sort patterns by priority (highest first)
  const sortedPatterns = [...INTENT_PATTERNS].sort((a, b) => b.priority - a.priority);

  // Check each pattern
  for (const pattern of sortedPatterns) {
    // Check regex patterns
    for (const regex of pattern.patterns) {
      if (regex.test(text)) {
        // Special case: EDUCATIONAL intent needs topic validation
        if (pattern.intent === 'EDUCATIONAL' && !isEducationalTopic(normalizedText)) {
          // Could be a market research question, not educational
          if (hasMarketIndicators(normalizedText)) {
            continue; // Skip to research intent
          }
        }

        return {
          intent: pattern.intent,
          confidence: 0.85,
          agent: pattern.agent,
          extractedQuery: extractQuery(text),
          reasoning: `Matched pattern: ${regex.toString().slice(0, 50)}`,
        };
      }
    }

    // Check keywords
    for (const keyword of pattern.keywords) {
      if (normalizedText.includes(keyword)) {
        return {
          intent: pattern.intent,
          confidence: 0.75,
          agent: pattern.agent,
          extractedQuery: extractQuery(text),
          reasoning: `Matched keyword: "${keyword}"`,
        };
      }
    }
  }

  // Educational topic detection (standalone)
  if (isEducationalTopic(normalizedText)) {
    return {
      intent: 'EDUCATIONAL',
      confidence: 0.8,
      agent: 'analyst',
      extractedQuery: extractQuery(text),
      reasoning: 'Educational topic detected',
    };
  }

  // Check if it looks like a market query (fallback)
  if (looksLikeMarketQuery(normalizedText)) {
    return {
      intent: 'MARKET_SEARCH',
      confidence: 0.6,
      agent: 'scout',
      extractedQuery: extractQuery(text),
      reasoning: 'Appears to be a market query',
    };
  }

  // Unknown intent
  return {
    intent: 'UNKNOWN',
    confidence: 0.3,
    agent: 'commander',
    extractedQuery: text,
    reasoning: 'No matching intent patterns',
  };
}

/**
 * Classify explicit /commands
 */
function classifyCommand(text: string): IntentResult {
  const cmd = text.split(' ')[0].toLowerCase();

  const commandMap: Record<string, { intent: IntentType; agent: IntentResult['agent'] }> = {
    '/hot': { intent: 'HOT_TRENDING', agent: 'scout' },
    '/arb': { intent: 'ARBITRAGE', agent: 'scout' },
    '/research': { intent: 'RESEARCH', agent: 'analyst' },
    '/odds': { intent: 'ODDS_COMPARE', agent: 'analyst' },
    '/whale': { intent: 'WHALE_TRACKING', agent: 'scout' },
    '/news': { intent: 'NEWS_INTEL', agent: 'scout' },
    '/intel': { intent: 'NEWS_INTEL', agent: 'scout' },
    '/buy': { intent: 'TRADE_QUOTE', agent: 'trader' },
    '/trade': { intent: 'TRADE_QUOTE', agent: 'trader' },
    '/swap': { intent: 'TRADE_QUOTE', agent: 'trader' },
    '/portfolio': { intent: 'PORTFOLIO', agent: 'commander' },
    '/positions': { intent: 'PORTFOLIO', agent: 'commander' },
    '/pnl': { intent: 'PORTFOLIO', agent: 'commander' },
    '/alert': { intent: 'ALERTS', agent: 'commander' },
    '/predict': { intent: 'PREDICTION', agent: 'commander' },
    '/calibration': { intent: 'CALIBRATION', agent: 'analyst' },
    '/brief': { intent: 'HOT_TRENDING', agent: 'scout' },
    '/help': { intent: 'HELP', agent: 'commander' },
    '/start': { intent: 'GREETING', agent: 'commander' },
  };

  const mapped = commandMap[cmd];
  if (mapped) {
    return {
      intent: mapped.intent,
      confidence: 1.0,
      agent: mapped.agent,
      extractedQuery: text.slice(cmd.length).trim(),
      reasoning: `Explicit command: ${cmd}`,
    };
  }

  return {
    intent: 'UNKNOWN',
    confidence: 0.5,
    agent: 'commander',
    extractedQuery: text,
    reasoning: `Unknown command: ${cmd}`,
  };
}

/**
 * Check if text has market-specific indicators
 */
function hasMarketIndicators(text: string): boolean {
  const marketIndicators = [
    /\b(202\d|next|this\s+(year|month|week))\b/i,
    /\b(will|won't|would|could)\b/i,
    /\b(bitcoin|btc|eth|trump|biden|fed|election|price)\b/i,
    /\$\d+/,
    /\d+%/,
  ];

  return marketIndicators.some(pattern => pattern.test(text));
}

/**
 * Check if text looks like a conversational/meta question (NOT a market query)
 */
function isConversationalQuery(text: string): boolean {
  const conversationalPatterns = [
    // Questions about the bot/its actions
    /\b(who|what)\s+(talk|spoke|chat|messaged|contacted)\s+(with|to)\s+(you|me|the\s+bot)/i,
    /\b(who|what)\s+(did\s+you|have\s+you)\s+(talk|speak|chat|do|see)/i,
    /\bwho\s+(are\s+)?you/i,
    /\b(how\s+are\s+you|how'?s\s+it\s+going|what'?s\s+up)/i,
    /\bare\s+you\s+(a\s+)?(bot|ai|robot|human|real)/i,
    /\b(tell\s+me\s+about\s+yourself|who\s+made\s+you)/i,
    /\bwhat\s+(have\s+)?you\s+(been\s+)?(doing|up\s+to)/i,
    // Generic conversational phrases
    /^(yes|no|ok|okay|thanks|thank\s+you|cool|nice|great|awesome|got\s+it)[\s!.]*$/i,
    /^(lol|lmao|haha|hehe|wow|omg|wtf)[\s!.]*$/i,
    // Sentences with "you" as the subject that aren't market-related
    /\b(do\s+you|can\s+you|will\s+you|are\s+you|were\s+you)\s+(remember|know|think|like|want|have|see)/i,
    // Questions about past interactions
    /\b(today|yesterday|last\s+(week|month|time))\b.*\b(you|with\s+you)\b/i,
  ];

  return conversationalPatterns.some(pattern => pattern.test(text));
}

/**
 * Check if text looks like a market query
 */
function looksLikeMarketQuery(text: string): boolean {
  // Reject conversational queries first
  if (isConversationalQuery(text)) return false;

  // Must have some substance (not just stopwords)
  const words = text.split(/\s+/).filter(w => w.length > 2);
  if (words.length < 1) return false;

  // Has market indicators
  if (hasMarketIndicators(text)) return true;

  // Contains capitalized words (likely proper nouns / topics)
  if (/[A-Z][a-z]+/.test(text)) return true;

  // Multiple words that could be a topic - but NOT just any multi-word phrase
  // Require at least one word that looks like a topic (noun-like, not just pronouns/verbs)
  const topicWords = words.filter(w =>
    !['who', 'what', 'when', 'where', 'why', 'how', 'you', 'your', 'the', 'this', 'that', 'with', 'today', 'talk', 'spoke'].includes(w.toLowerCase())
  );
  if (topicWords.length >= 2) return true;

  return false;
}

// ============================================
// SMART RESPONSE SUGGESTIONS
// ============================================

/**
 * Get smart suggestions based on intent
 */
export function getIntentSuggestions(intent: IntentType): string[] {
  const suggestions: Record<IntentType, string[]> = {
    MARKET_SEARCH: ['/hot', '/research <topic>', '/odds <topic>'],
    HOT_TRENDING: ['/brief', '/arb', '/whale'],
    ARBITRAGE: ['/arb-subscribe', '/research <market>'],
    RESEARCH: ['/odds <topic>', '/intelligence <question>'],
    ODDS_COMPARE: ['/research <topic>', '/arb'],
    WHALE_TRACKING: ['/follow <user>', '/signals'],
    TRADE_QUOTE: ['/portfolio', '/positions'],
    PORTFOLIO: ['/pnl', '/expiring'],
    ALERTS: ['/alerts', '/subscribe'],
    PREDICTION: ['/calibration', '/leaderboard'],
    CALIBRATION: ['/feedback', '/me'],
    NEWS_INTEL: ['/research <topic>', '/hot'],
    EDUCATIONAL: ['/hot', '/arb', '/brief'],
    GREETING: ['/help', '/brief', '/hot'],
    HELP: ['/brief', '/hot', '/arb'],
    CONVERSATION: ['/help', '/brief', '/hot'],
    UNKNOWN: ['/help', '/hot', '/brief'],
  };

  return suggestions[intent] || suggestions.UNKNOWN;
}

// ============================================
// EXPORTS FOR TESTING
// ============================================

export {
  extractQuery,
  looksLikeMarketQuery,
  hasMarketIndicators,
  isEducationalTopic,
  isConversationalQuery,
  INTENT_PATTERNS,
};
