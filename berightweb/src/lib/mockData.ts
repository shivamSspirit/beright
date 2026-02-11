import { Prediction, LeaderboardEntry } from './types';

export const mockPredictions: Prediction[] = [
  {
    id: '1',
    question: 'Will Bitcoin hit $150K by end of 2026?',
    category: 'crypto',
    marketOdds: 42,
    platform: 'Polymarket',
    volume: '$2.1M',
    resolvesAt: 'Dec 31, 2026',
    aiPrediction: 38,
    aiReasoning: "Bitcoin has shown strong momentum post-halving, but macro headwinds and regulatory uncertainty create significant downside risk. Historical data shows BTC reaches new ATHs in 75% of post-halving cycles, but $150K represents a 2.5x from current levels.",
    aiEvidence: {
      for: [
        'Post-halving supply shock historically bullish',
        'ETF inflows continue at record pace',
        'Institutional adoption accelerating'
      ],
      against: [
        'Already 2x from cycle low',
        'Fed policy uncertainty',
        'Regulatory crackdowns in EU'
      ]
    }
  },
  {
    id: '2',
    question: 'Will Trump win 2028 election?',
    category: 'politics',
    marketOdds: 31,
    platform: 'Kalshi',
    volume: '$890K',
    resolvesAt: 'Nov 5, 2028',
    aiPrediction: 24,
    aiReasoning: "Constitutional constraints aside, the base rate for any single candidate winning is ~25%. Age will be a significant factor (82 by election). However, political polarization and base loyalty remain strong factors.",
    aiEvidence: {
      for: [
        'Strong base loyalty',
        'Name recognition advantage',
        'Fundraising capability'
      ],
      against: [
        'Age concerns (82 by 2028)',
        'Legal challenges ongoing',
        'Party may seek fresh candidates'
      ]
    }
  },
  {
    id: '3',
    question: 'Will Fed cut rates in March 2026?',
    category: 'economics',
    marketOdds: 45,
    platform: 'Kalshi',
    volume: '$1.4M',
    resolvesAt: 'Mar 15, 2026',
    aiPrediction: 32,
    aiReasoning: "Inflation remains sticky at 3.2%, above the 2% target. The Fed has signaled patience. Historical base rate for March cuts in similar conditions is 23%. Current market pricing may be overly optimistic.",
    aiEvidence: {
      for: [
        'Labor market showing signs of cooling',
        'Consumer spending declining',
        'Global economic slowdown'
      ],
      against: [
        'Inflation still at 3.2%',
        'Fed guidance hawkish',
        'Strong GDP growth'
      ]
    }
  },
  {
    id: '4',
    question: 'Will SpaceX land humans on Mars by 2030?',
    category: 'tech',
    marketOdds: 28,
    platform: 'Polymarket',
    volume: '$560K',
    resolvesAt: 'Dec 31, 2030',
    aiPrediction: 15,
    aiReasoning: "While SpaceX has made remarkable progress, a crewed Mars mission by 2030 faces immense technical challenges. Starship is still in testing. Life support, radiation shielding, and return capabilities need years of development. Musk's timelines historically slip 2-3x.",
    aiEvidence: {
      for: [
        'Starship rapid iteration',
        'Strong funding and talent',
        "Musk's determination"
      ],
      against: [
        'Life support tech unproven',
        'Radiation shielding challenges',
        'Historical timeline slippage'
      ]
    }
  },
  {
    id: '5',
    question: 'Will there be a US recession in 2026?',
    category: 'economics',
    marketOdds: 38,
    platform: 'Manifold',
    volume: '$320K',
    resolvesAt: 'Dec 31, 2026',
    aiPrediction: 45,
    aiReasoning: "Leading indicators are mixed. Yield curve has been inverted for extended periods. Consumer debt at record highs. However, labor market remains resilient and corporate earnings strong. Base rate for recession in any given year is ~15%, but current conditions elevate risk.",
    aiEvidence: {
      for: [
        'Yield curve inversion',
        'Consumer debt levels',
        'Commercial real estate stress'
      ],
      against: [
        'Strong labor market',
        'Corporate earnings solid',
        'Fed has room to cut'
      ]
    }
  },
  {
    id: '6',
    question: 'Will AI pass the Turing Test definitively by 2027?',
    category: 'tech',
    marketOdds: 52,
    platform: 'Manifold',
    volume: '$180K',
    resolvesAt: 'Dec 31, 2027',
    aiPrediction: 68,
    aiReasoning: "Current LLMs already pass many informal Turing tests. The main question is what constitutes 'definitive'. If standard benchmarks are used, this is likely. GPT-5 and Claude 4 generations will significantly narrow the gap.",
    aiEvidence: {
      for: [
        'Rapid LLM advancement',
        'Current models near-passing',
        'Major lab competition'
      ],
      against: [
        'Definitional ambiguity',
        'Reasoning gaps persist',
        'Embodiment may be required'
      ]
    }
  },
  {
    id: '7',
    question: 'Will Lakers win 2026 NBA Championship?',
    category: 'sports',
    marketOdds: 12,
    platform: 'Kalshi',
    volume: '$450K',
    resolvesAt: 'Jun 30, 2026',
    aiPrediction: 8,
    aiReasoning: "Lakers have aging stars and lack depth. While LeBron remains competitive, the Western Conference is stacked. Base rate for any team is ~3%. Lakers premium is name recognition, not roster strength.",
    aiEvidence: {
      for: [
        'LeBron factor',
        'Big market advantages',
        'Playoff experience'
      ],
      against: [
        'Aging core',
        'Stacked Western Conference',
        'Depth concerns'
      ]
    }
  }
];

export const mockLeaderboard: LeaderboardEntry[] = [
  {
    rank: 1,
    username: 'SuperForecaster_1',
    avatar: '🎯',
    accuracy: 78.5,
    brierScore: 0.12,
    totalPredictions: 342,
    vsAiWinRate: 62,
    streak: 12
  },
  {
    rank: 2,
    username: 'OddsOracle',
    avatar: '🔮',
    accuracy: 75.2,
    brierScore: 0.15,
    totalPredictions: 289,
    vsAiWinRate: 58,
    streak: 8
  },
  {
    rank: 3,
    username: 'BayesianBeast',
    avatar: '📊',
    accuracy: 73.8,
    brierScore: 0.17,
    totalPredictions: 456,
    vsAiWinRate: 55,
    streak: 5
  },
  {
    rank: 4,
    username: 'ProbabilityPro',
    avatar: '🎲',
    accuracy: 71.4,
    brierScore: 0.18,
    totalPredictions: 198,
    vsAiWinRate: 51,
    streak: 3
  },
  {
    rank: 5,
    username: 'MarketMaven',
    avatar: '📈',
    accuracy: 69.9,
    brierScore: 0.19,
    totalPredictions: 567,
    vsAiWinRate: 48,
    streak: 7
  },
  {
    rank: 6,
    username: 'ForecastFanatic',
    avatar: '⚡',
    accuracy: 68.2,
    brierScore: 0.20,
    totalPredictions: 234,
    vsAiWinRate: 45,
    streak: 2
  },
  {
    rank: 7,
    username: 'CalibrationKing',
    avatar: '👑',
    accuracy: 66.7,
    brierScore: 0.21,
    totalPredictions: 412,
    vsAiWinRate: 42,
    streak: 4
  },
  {
    rank: 8,
    username: 'You',
    avatar: '🧠',
    accuracy: 64.3,
    brierScore: 0.23,
    totalPredictions: 47,
    vsAiWinRate: 38,
    streak: 2
  }
];

export const mockUserStats = {
  totalPredictions: 47,
  resolvedPredictions: 32,
  accuracy: 64.3,
  brierScore: 0.21,
  winStreak: 2,
  vsAiWins: 12,
  vsAiLosses: 20
};

// Mock API Markets for Markets page
export const mockApiMarkets = [
  {
    id: 'pm-btc-150k',
    platform: 'polymarket' as const,
    title: 'Will Bitcoin hit $150K by end of 2025?',
    question: 'Will Bitcoin hit $150K by end of 2025?',
    yesPrice: 0.42,
    noPrice: 0.58,
    yesPct: 42,
    noPct: 58,
    volume: 2100000,
    liquidity: 450000,
    endDate: '2025-12-31',
    status: 'active' as const,
    url: 'https://polymarket.com',
  },
  {
    id: 'kalshi-fed-march',
    platform: 'kalshi' as const,
    title: 'Will Fed cut rates in March 2025?',
    question: 'Will Fed cut rates in March 2025?',
    yesPrice: 0.45,
    noPrice: 0.55,
    yesPct: 45,
    noPct: 55,
    volume: 1400000,
    liquidity: 320000,
    endDate: '2025-03-15',
    status: 'active' as const,
    url: 'https://kalshi.com',
  },
  {
    id: 'pm-trump-2028',
    platform: 'polymarket' as const,
    title: 'Will Trump win 2028 election?',
    question: 'Will Trump win 2028 election?',
    yesPrice: 0.31,
    noPrice: 0.69,
    yesPct: 31,
    noPct: 69,
    volume: 890000,
    liquidity: 200000,
    endDate: '2028-11-05',
    status: 'active' as const,
    url: 'https://polymarket.com',
  },
  {
    id: 'manifold-ai-turing',
    platform: 'manifold' as const,
    title: 'Will AI pass Turing Test by 2027?',
    question: 'Will AI pass Turing Test by 2027?',
    yesPrice: 0.52,
    noPrice: 0.48,
    yesPct: 52,
    noPct: 48,
    volume: 180000,
    liquidity: 45000,
    endDate: '2027-12-31',
    status: 'active' as const,
    url: 'https://manifold.markets',
  },
  {
    id: 'kalshi-recession-2025',
    platform: 'kalshi' as const,
    title: 'Will US enter recession in 2025?',
    question: 'Will US enter recession in 2025?',
    yesPrice: 0.38,
    noPrice: 0.62,
    yesPct: 38,
    noPct: 62,
    volume: 520000,
    liquidity: 150000,
    endDate: '2025-12-31',
    status: 'active' as const,
    url: 'https://kalshi.com',
  },
  {
    id: 'pm-spacex-mars',
    platform: 'polymarket' as const,
    title: 'Will SpaceX land humans on Mars by 2030?',
    question: 'Will SpaceX land humans on Mars by 2030?',
    yesPrice: 0.28,
    noPrice: 0.72,
    yesPct: 28,
    noPct: 72,
    volume: 560000,
    liquidity: 130000,
    endDate: '2030-12-31',
    status: 'active' as const,
    url: 'https://polymarket.com',
  },
  {
    id: 'manifold-eth-10k',
    platform: 'manifold' as const,
    title: 'Will Ethereum reach $10K in 2025?',
    question: 'Will Ethereum reach $10K in 2025?',
    yesPrice: 0.23,
    noPrice: 0.77,
    yesPct: 23,
    noPct: 77,
    volume: 340000,
    liquidity: 80000,
    endDate: '2025-12-31',
    status: 'active' as const,
    url: 'https://manifold.markets',
  },
  {
    id: 'kalshi-lakers-nba',
    platform: 'kalshi' as const,
    title: 'Will Lakers win 2025 NBA Championship?',
    question: 'Will Lakers win 2025 NBA Championship?',
    yesPrice: 0.12,
    noPrice: 0.88,
    yesPct: 12,
    noPct: 88,
    volume: 450000,
    liquidity: 100000,
    endDate: '2025-06-30',
    status: 'active' as const,
    url: 'https://kalshi.com',
  },
  {
    id: 'pm-gpt5-2025',
    platform: 'polymarket' as const,
    title: 'Will OpenAI release GPT-5 in 2025?',
    question: 'Will OpenAI release GPT-5 in 2025?',
    yesPrice: 0.67,
    noPrice: 0.33,
    yesPct: 67,
    noPct: 33,
    volume: 780000,
    liquidity: 190000,
    endDate: '2025-12-31',
    status: 'active' as const,
    url: 'https://polymarket.com',
  },
  {
    id: 'limitless-sol-500',
    platform: 'limitless' as const,
    title: 'Will Solana reach $500 by end of 2025?',
    question: 'Will Solana reach $500 by end of 2025?',
    yesPrice: 0.35,
    noPrice: 0.65,
    yesPct: 35,
    noPct: 65,
    volume: 290000,
    liquidity: 70000,
    endDate: '2025-12-31',
    status: 'active' as const,
    url: 'https://limitless.exchange',
  },
  {
    id: 'metaculus-agi-2030',
    platform: 'metaculus' as const,
    title: 'Will AGI be achieved by 2030?',
    question: 'Will AGI be achieved by 2030?',
    yesPrice: 0.18,
    noPrice: 0.82,
    yesPct: 18,
    noPct: 82,
    volume: 120000,
    liquidity: 30000,
    endDate: '2030-12-31',
    status: 'active' as const,
    url: 'https://metaculus.com',
  },
  {
    id: 'kalshi-tariffs-china',
    platform: 'kalshi' as const,
    title: 'Will US impose 50%+ tariffs on China in 2025?',
    question: 'Will US impose 50%+ tariffs on China in 2025?',
    yesPrice: 0.58,
    noPrice: 0.42,
    yesPct: 58,
    noPct: 42,
    volume: 670000,
    liquidity: 160000,
    endDate: '2025-12-31',
    status: 'active' as const,
    url: 'https://kalshi.com',
  },
];
