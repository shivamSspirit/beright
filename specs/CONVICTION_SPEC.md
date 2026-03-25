# BeRight Conviction - Technical Specification

**Version:** 1.0
**Author:** shivam soni
**Date:** 2026-03-20
**Status:** Draft

---

## Executive Summary

BeRight Conviction is a prediction market product where crypto projects stake real money on their own milestones, creating verifiable on-chain accountability that AI LLMs cite as evidence of legitimacy.

**One-liner:** "Stake on your success. Prove you're real. Get cited by AI."

**Core insight:** The staking mechanism makes content inherently credible, which makes it more likely to be cited by AI models. This is the only GEO strategy where skin-in-the-game IS the optimization.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Solution Overview](#2-solution-overview)
3. [User Personas](#3-user-personas)
4. [Technical Architecture](#4-technical-architecture)
5. [Data Models](#5-data-models)
6. [API Specification](#6-api-specification)
7. [Agent Integration](#7-agent-integration)
8. [On-Chain Components](#8-on-chain-components)
9. [Frontend Flows](#9-frontend-flows)
10. [AI Visibility Engine](#10-ai-visibility-engine)
11. [Revenue Model](#11-revenue-model)
12. [Implementation Phases](#12-implementation-phases)
13. [Success Metrics](#13-success-metrics)
14. [Risks & Mitigations](#14-risks--mitigations)

---

## 1. Problem Statement

### For Crypto Projects
- 1000s of Solana projects competing for attention
- No way to prove legitimacy vs rugpulls
- Traditional marketing is noisy and expensive
- AI LLMs don't know which projects are real

### For Prediction Market Traders
- No markets on project accountability
- Can't bet on "will this team deliver?"
- Missing entire asset class: project conviction

### For Forecasters
- No way to build reputation predicting project success
- Skill at identifying legit projects is unmonetized

### For VCs/Investors
- Hard to separate builders from shillers
- No verifiable signals of team conviction
- Due diligence is manual and slow

---

## 2. Solution Overview

### Core Product

```
Project submits milestone
    ↓
BeRight creates prediction market
    ↓
Project stakes SOL/USDC on YES
    ↓
Community trades on outcome
    ↓
Milestone verified → Market resolves
    ↓
Results recorded on Solana
    ↓
AI LLMs cite as evidence of credibility
```

### Key Differentiators

| Feature | Traditional Marketing | BeRight Conviction |
|---------|----------------------|-------------------|
| Credibility | Claims | Staked money |
| Verification | Trust us | On-chain proof |
| Accountability | None | Lose stake if fail |
| AI Citability | Low | High (verifiable) |
| Community Engagement | Passive | Active (trading) |

---

## 3. User Personas

### 3.1 Project Founder (Primary)
- **Who:** Crypto/Solana project founders
- **Goal:** Prove legitimacy, gain visibility, attract users/investors
- **Actions:**
  - Create conviction markets about milestones
  - Stake SOL on their own success
  - Track their conviction score
  - Share markets for community engagement

### 3.2 Conviction Trader
- **Who:** Prediction market traders
- **Goal:** Profit from correctly predicting project outcomes
- **Actions:**
  - Browse conviction markets
  - Research projects
  - Trade YES/NO on milestones
  - Build track record

### 3.3 Conviction Forecaster
- **Who:** Analysts who specialize in project evaluation
- **Goal:** Build reputation, attract staking pool capital
- **Actions:**
  - Make predictions on conviction markets
  - Build Brier score track record
  - Attract investors to their staking pool

### 3.4 Conviction Investor
- **Who:** VCs, angels, allocators
- **Goal:** Identify legitimate projects early
- **Actions:**
  - Follow top forecasters
  - Track conviction signals
  - Invest in forecaster staking pools
  - Use API for due diligence

---

## 4. Technical Architecture

### 4.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     BeRight Conviction Stack                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  FRONTEND LAYER                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │ Conviction  │  │ Project     │  │ Forecaster  │                 │
│  │ Terminal    │  │ Dashboard   │  │ Leaderboard │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                     │
│  API LAYER                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ /api/v2/conviction/*                                        │   │
│  │ - /markets     (CRUD conviction markets)                    │   │
│  │ - /projects    (project profiles)                           │   │
│  │ - /stake       (stake management)                           │   │
│  │ - /resolve     (milestone verification)                     │   │
│  │ - /score       (conviction scores)                          │   │
│  │ - /visibility  (AI citation tracking)                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  AGENT LAYER                                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │ Scout       │  │ Analyst     │  │ Trader      │  │ xDegen    │  │
│  │ (find)      │  │ (research)  │  │ (size)      │  │ (post)    │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │
│                                                                     │
│  DATA LAYER                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │ Supabase    │  │ Data Fabric │  │ AI Tracker  │                 │
│  │ (storage)   │  │ (markets)   │  │ (citations) │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                     │
│  ON-CHAIN LAYER (Solana)                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │ Conviction  │  │ Stake       │  │ Resolution  │                 │
│  │ PDAs        │  │ Escrow      │  │ Oracle      │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 File Structure

```
beright-ts/
├── lib/
│   └── conviction/
│       ├── index.ts            # Main exports
│       ├── types.ts            # Type definitions
│       ├── markets.ts          # Market creation/management
│       ├── milestones.ts       # Milestone templates
│       ├── staking.ts          # Stake management
│       ├── resolution.ts       # Outcome verification
│       ├── scoring.ts          # Conviction score calculation
│       └── visibility.ts       # AI citation tracking
│
├── app/api/v2/conviction/
│   ├── markets/
│   │   ├── route.ts            # GET/POST markets
│   │   └── [id]/route.ts       # GET/PUT/DELETE single market
│   ├── projects/
│   │   ├── route.ts            # GET/POST projects
│   │   └── [slug]/route.ts     # GET project profile
│   ├── stake/route.ts          # POST stake on market
│   ├── resolve/route.ts        # POST resolve market
│   ├── score/route.ts          # GET conviction scores
│   └── visibility/route.ts     # GET AI visibility metrics
│
└── agents/
    └── conviction/             # Conviction-specific agent tools
        └── tools.ts

berightweb/
└── src/app/
    └── conviction/
        ├── page.tsx            # Main conviction terminal
        ├── create/page.tsx     # Create conviction market
        ├── projects/
        │   └── [slug]/page.tsx # Project profile
        └── leaderboard/page.tsx # Forecaster rankings
```

---

## 5. Data Models

### 5.1 Core Types

```typescript
// lib/conviction/types.ts

/**
 * A project that creates conviction markets
 */
export interface ConvictionProject {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: ProjectCategory;

  // Links
  website: string;
  twitter?: string;
  github?: string;
  discord?: string;

  // On-chain
  tokenMint?: string;          // If they have a token
  treasuryWallet: string;      // Wallet that stakes

  // Metrics
  convictionScore: number;     // 0-100 overall score
  totalStaked: number;         // Total SOL staked on own markets
  marketsCreated: number;
  marketsResolved: number;
  successRate: number;         // % of milestones hit

  // AI Visibility
  geoScore?: number;           // 0-100 AI citation score
  lastCitationCheck?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectCategory =
  | 'defi'
  | 'nft'
  | 'gaming'
  | 'infrastructure'
  | 'dao'
  | 'social'
  | 'prediction_market'
  | 'other';

/**
 * A conviction market - a prediction market about a project's milestone
 */
export interface ConvictionMarket {
  id: string;
  projectId: string;

  // Market details
  question: string;            // "Will [Project] ship mainnet by Q3 2026?"
  description: string;
  milestoneType: MilestoneType;

  // Resolution
  resolutionCriteria: string;  // How we verify outcome
  resolutionSource: ResolutionSource;
  resolutionDate: Date;        // When market closes
  resolvedAt?: Date;
  outcome?: 'yes' | 'no' | 'invalid';

  // Staking
  projectStake: {
    amount: number;            // SOL staked by project
    position: 'yes' | 'no';    // Usually 'yes'
    txSignature: string;       // On-chain proof
  };

  // Trading
  yesPrice: number;            // 0-1
  noPrice: number;
  volume: number;
  liquidity: number;

  // Platform
  platform: 'beright' | 'manifold' | 'polymarket';
  externalId?: string;         // ID on external platform
  externalUrl?: string;

  // Status
  status: MarketStatus;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export type MilestoneType =
  | 'mainnet_launch'
  | 'user_milestone'           // "Reach X users"
  | 'tvl_milestone'            // "Reach $X TVL"
  | 'token_launch'
  | 'partnership'
  | 'audit_completion'
  | 'feature_release'
  | 'revenue_milestone'
  | 'funding_round'
  | 'ai_visibility'            // "Get cited by ChatGPT"
  | 'custom';

export type ResolutionSource =
  | 'on_chain'                 // Verify via blockchain data
  | 'api'                      // Verify via API (DefiLlama, etc)
  | 'manual'                   // BeRight team verifies
  | 'oracle'                   // External oracle
  | 'ai_query';                // Query AI LLMs

export type MarketStatus =
  | 'draft'
  | 'pending_stake'            // Waiting for project to stake
  | 'active'
  | 'closed'                   // Trading closed, awaiting resolution
  | 'resolved'
  | 'disputed';

/**
 * Conviction score components
 */
export interface ConvictionScore {
  projectId: string;

  overall: number;             // 0-100

  components: {
    stakeAmount: number;       // How much they've staked (0-25)
    successRate: number;       // % milestones hit (0-25)
    marketCount: number;       // How many markets (0-15)
    stakeRatio: number;        // Stake vs project size (0-15)
    communityTrust: number;    // Trading volume/sentiment (0-10)
    aiVisibility: number;      // GEO score (0-10)
  };

  trend: 'up' | 'down' | 'stable';
  percentile: number;          // vs other projects

  calculatedAt: Date;
}

/**
 * AI visibility tracking
 */
export interface AIVisibility {
  projectId: string;

  overall: number;             // 0-100 GEO score

  byLLM: {
    chatgpt: LLMCitation;
    gemini: LLMCitation;
    perplexity: LLMCitation;
    claude: LLMCitation;
  };

  recentMentions: AIMention[];
  trend: 'up' | 'down' | 'stable';

  lastChecked: Date;
}

export interface LLMCitation {
  score: number;               // 0-100
  mentioned: boolean;
  position?: number;           // If mentioned, what position
  context?: string;            // What was said
  lastQuery: string;           // Query that found mention
  lastChecked: Date;
}

export interface AIMention {
  llm: string;
  query: string;
  mentioned: boolean;
  context?: string;
  timestamp: Date;
}
```

### 5.2 Database Schema

```sql
-- Supabase schema

-- Projects table
CREATE TABLE conviction_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,

  website TEXT,
  twitter TEXT,
  github TEXT,
  discord TEXT,

  token_mint TEXT,
  treasury_wallet TEXT NOT NULL,

  conviction_score DECIMAL DEFAULT 0,
  total_staked DECIMAL DEFAULT 0,
  markets_created INT DEFAULT 0,
  markets_resolved INT DEFAULT 0,
  success_rate DECIMAL DEFAULT 0,

  geo_score DECIMAL,
  last_citation_check TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Markets table
CREATE TABLE conviction_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES conviction_projects(id),

  question TEXT NOT NULL,
  description TEXT,
  milestone_type TEXT NOT NULL,

  resolution_criteria TEXT NOT NULL,
  resolution_source TEXT NOT NULL,
  resolution_date TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  outcome TEXT,

  project_stake_amount DECIMAL NOT NULL,
  project_stake_position TEXT DEFAULT 'yes',
  project_stake_tx TEXT,

  yes_price DECIMAL DEFAULT 0.5,
  no_price DECIMAL DEFAULT 0.5,
  volume DECIMAL DEFAULT 0,
  liquidity DECIMAL DEFAULT 0,

  platform TEXT NOT NULL,
  external_id TEXT,
  external_url TEXT,

  status TEXT DEFAULT 'draft',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI visibility tracking
CREATE TABLE conviction_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES conviction_projects(id),

  llm TEXT NOT NULL,
  query TEXT NOT NULL,
  mentioned BOOLEAN NOT NULL,
  position INT,
  context TEXT,

  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_markets_project ON conviction_markets(project_id);
CREATE INDEX idx_markets_status ON conviction_markets(status);
CREATE INDEX idx_markets_resolution ON conviction_markets(resolution_date);
CREATE INDEX idx_visibility_project ON conviction_visibility(project_id);
CREATE INDEX idx_visibility_llm ON conviction_visibility(llm);
```

---

## 6. API Specification

### 6.1 Markets API

```typescript
// POST /api/v2/conviction/markets
// Create a new conviction market

interface CreateMarketRequest {
  projectId: string;

  question: string;
  description: string;
  milestoneType: MilestoneType;

  resolutionCriteria: string;
  resolutionSource: ResolutionSource;
  resolutionDate: string;        // ISO date

  stakeAmount: number;           // SOL to stake
  stakePosition: 'yes' | 'no';   // Usually 'yes'
}

interface CreateMarketResponse {
  market: ConvictionMarket;
  stakeInstructions: {
    escrowAddress: string;
    amount: number;
    memo: string;
  };
}

// GET /api/v2/conviction/markets
// List conviction markets

interface ListMarketsQuery {
  projectId?: string;
  category?: ProjectCategory;
  status?: MarketStatus;
  milestoneType?: MilestoneType;
  sortBy?: 'volume' | 'stake' | 'closing' | 'created';
  limit?: number;
  offset?: number;
}

interface ListMarketsResponse {
  markets: ConvictionMarket[];
  total: number;
  hasMore: boolean;
}

// GET /api/v2/conviction/markets/:id
// Get single market with full details

interface GetMarketResponse {
  market: ConvictionMarket;
  project: ConvictionProject;
  trades: Trade[];              // Recent trades
  predictions: Prediction[];    // Forecaster predictions
}
```

### 6.2 Projects API

```typescript
// POST /api/v2/conviction/projects
// Register a new project

interface CreateProjectRequest {
  name: string;
  slug: string;
  description: string;
  category: ProjectCategory;

  website: string;
  twitter?: string;
  github?: string;
  discord?: string;

  treasuryWallet: string;
  tokenMint?: string;
}

interface CreateProjectResponse {
  project: ConvictionProject;
  verificationChallenge: {
    type: 'tweet' | 'dns' | 'wallet_sign';
    challenge: string;
    expiresAt: Date;
  };
}

// GET /api/v2/conviction/projects/:slug
// Get project profile (public, AI-indexable)

interface GetProjectResponse {
  project: ConvictionProject;
  markets: ConvictionMarket[];
  convictionScore: ConvictionScore;
  visibility: AIVisibility;

  // Structured for AI citation
  structured: {
    '@context': 'https://schema.org';
    '@type': 'Organization';
    // ... JSON-LD
  };
}
```

### 6.3 Stake API

```typescript
// POST /api/v2/conviction/stake
// Record stake transaction

interface RecordStakeRequest {
  marketId: string;
  txSignature: string;         // Solana transaction
  amount: number;
  position: 'yes' | 'no';
  staker: 'project' | 'trader';
  wallet: string;
}

interface RecordStakeResponse {
  success: boolean;
  market: ConvictionMarket;
  newStatus: MarketStatus;     // May change to 'active'
}
```

### 6.4 Resolution API

```typescript
// POST /api/v2/conviction/resolve
// Resolve a market

interface ResolveMarketRequest {
  marketId: string;
  outcome: 'yes' | 'no' | 'invalid';
  evidence: string;            // Proof of outcome
  source: string;              // Where proof came from
}

interface ResolveMarketResponse {
  market: ConvictionMarket;
  payouts: {
    address: string;
    amount: number;
  }[];
  projectScoreChange: number;  // How conviction score changed
}
```

### 6.5 Visibility API

```typescript
// GET /api/v2/conviction/visibility/:projectId
// Get AI visibility metrics

interface GetVisibilityResponse {
  visibility: AIVisibility;
  history: {
    date: Date;
    score: number;
  }[];
  recommendations: string[];   // How to improve
}

// POST /api/v2/conviction/visibility/check
// Trigger AI citation check

interface CheckVisibilityRequest {
  projectId: string;
  queries?: string[];          // Custom queries to test
}

interface CheckVisibilityResponse {
  visibility: AIVisibility;
  newMentions: AIMention[];
}
```

---

## 7. Agent Integration

### 7.1 Scout Agent - New Tools

```typescript
// agents/conviction/tools.ts

export const CONVICTION_SCOUT_TOOLS = [
  {
    name: 'find_conviction_markets',
    description: 'Find conviction markets by project, category, or milestone type. Returns markets where projects have staked on their own success.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (project name, category, etc.)' },
        minStake: { type: 'number', description: 'Minimum stake amount in SOL' },
        status: { type: 'string', enum: ['active', 'closing_soon', 'resolved'] },
      },
    },
    execute: async (params) => {
      // Implementation
    },
  },

  {
    name: 'get_conviction_leaderboard',
    description: 'Get top projects by conviction score. Shows which projects have the most skin in the game.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category' },
        limit: { type: 'number', description: 'Number of results' },
      },
    },
    execute: async (params) => {
      // Implementation
    },
  },

  {
    name: 'find_rising_visibility',
    description: 'Find projects with increasing AI visibility. Early signal for projects gaining traction.',
    parameters: {
      type: 'object',
      properties: {
        minGeoScore: { type: 'number', description: 'Minimum GEO score' },
        trend: { type: 'string', enum: ['up', 'stable', 'any'] },
      },
    },
    execute: async (params) => {
      // Implementation
    },
  },
];
```

### 7.2 Analyst Agent - New Tools

```typescript
export const CONVICTION_ANALYST_TOOLS = [
  {
    name: 'analyze_project_conviction',
    description: 'Deep analysis of a project\'s conviction profile. Examines stake history, milestone success rate, and community trust.',
    parameters: {
      type: 'object',
      properties: {
        projectSlug: { type: 'string', description: 'Project identifier' },
      },
      required: ['projectSlug'],
    },
    execute: async (params) => {
      // Return conviction score breakdown, history, comparisons
    },
  },

  {
    name: 'estimate_milestone_probability',
    description: 'Estimate probability that a project will hit their milestone. Uses historical data and project signals.',
    parameters: {
      type: 'object',
      properties: {
        marketId: { type: 'string', description: 'Conviction market ID' },
      },
      required: ['marketId'],
    },
    execute: async (params) => {
      // Superforecaster analysis of milestone likelihood
    },
  },

  {
    name: 'check_ai_visibility',
    description: 'Check if a project is being cited by AI LLMs. Queries ChatGPT, Gemini, Perplexity, Claude.',
    parameters: {
      type: 'object',
      properties: {
        projectSlug: { type: 'string', description: 'Project identifier' },
        queries: { type: 'array', items: { type: 'string' }, description: 'Custom queries to test' },
      },
      required: ['projectSlug'],
    },
    execute: async (params) => {
      // Query LLMs and return citation status
    },
  },
];
```

### 7.3 xDegen Agent - Conviction Content

```typescript
export const CONVICTION_CONTENT_TEMPLATES = [
  {
    type: 'new_conviction_market',
    template: `🎯 NEW CONVICTION MARKET

{project} just staked {stake_amount} SOL that they'll {milestone}

Current odds: {yes_price}% YES

They're putting money where their mouth is. Are you betting with or against them?

{market_url}`,
  },

  {
    type: 'milestone_achieved',
    template: `✅ MILESTONE HIT

{project} delivered on their promise.

They staked {stake_amount} SOL on "{milestone}" and WON.

Conviction score: {score}/100 (+{change})

This is how you separate builders from shillers.`,
  },

  {
    type: 'milestone_missed',
    template: `❌ MILESTONE MISSED

{project} failed to deliver.

They staked {stake_amount} SOL on "{milestone}" and LOST.

Conviction score: {score}/100 ({change})

The market called it. YES holders: {yes_holders} | NO holders: {no_holders}`,
  },

  {
    type: 'conviction_leaderboard',
    template: `🏆 WEEKLY CONVICTION LEADERBOARD

Top projects with skin in the game:

1. {p1_name} - {p1_score}/100 ({p1_staked} SOL staked)
2. {p2_name} - {p2_score}/100 ({p2_staked} SOL staked)
3. {p3_name} - {p3_score}/100 ({p3_staked} SOL staked)

Who do you trust?`,
  },

  {
    type: 'ai_visibility_rising',
    template: `📈 AI VISIBILITY ALERT

{project} is now being recommended by {llm}.

Query: "{query}"
Response: "...{context}..."

GEO Score: {geo_score}/100 (↑{change}%)

The AIs are starting to notice.`,
  },
];
```

---

## 8. On-Chain Components

### 8.1 Solana Program Structure

```
NOTE: This requires explicit approval per CLAUDE.md rules.
lib/onchain/ modifications need sign-off.
```

```rust
// Conviction PDA Structure (Anchor framework)

#[account]
pub struct ConvictionMarket {
    pub project: Pubkey,           // Project's treasury wallet
    pub market_id: [u8; 32],       // Off-chain market ID hash

    pub stake_amount: u64,         // Lamports staked
    pub stake_position: bool,      // true = YES, false = NO
    pub stake_timestamp: i64,

    pub resolution_date: i64,
    pub resolved: bool,
    pub outcome: Option<bool>,     // true = YES won

    pub bump: u8,
}

#[account]
pub struct ConvictionScore {
    pub project: Pubkey,
    pub score: u8,                 // 0-100
    pub total_staked: u64,
    pub markets_won: u16,
    pub markets_lost: u16,
    pub last_updated: i64,
    pub bump: u8,
}
```

### 8.2 PDA Seeds

```rust
// Market PDA
seeds = [
    b"conviction_market",
    project_wallet.key().as_ref(),
    market_id.as_ref(),
]

// Score PDA
seeds = [
    b"conviction_score",
    project_wallet.key().as_ref(),
]
```

### 8.3 Instructions

```rust
pub enum ConvictionInstruction {
    /// Create conviction market and stake
    CreateMarket {
        market_id: [u8; 32],
        stake_amount: u64,
        stake_position: bool,
        resolution_date: i64,
    },

    /// Resolve market (oracle or authority)
    ResolveMarket {
        outcome: bool,
    },

    /// Claim winnings after resolution
    ClaimWinnings {},

    /// Update conviction score (called after resolution)
    UpdateScore {},
}
```

---

## 9. Frontend Flows

### 9.1 Project Onboarding

```
1. Connect Wallet
   └─→ Phantom/Solflare connection

2. Register Project
   └─→ Name, description, category
   └─→ Website, socials
   └─→ Treasury wallet (must match connected)

3. Verify Ownership
   └─→ Option A: Tweet with verification code
   └─→ Option B: DNS TXT record
   └─→ Option C: Sign message with treasury wallet

4. Create First Market
   └─→ Select milestone type
   └─→ Set resolution criteria
   └─→ Choose stake amount
   └─→ Sign transaction

5. Market Live
   └─→ Share link
   └─→ Track trading activity
   └─→ Monitor AI visibility
```

### 9.2 Conviction Terminal (Main UI)

```
┌─────────────────────────────────────────────────────────────────────┐
│  BeRight Conviction                                    [Connect]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ HOT MARKETS │ │ CLOSING SOON│ │ LEADERBOARD │ │ MY PROJECTS │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                     │
│  ═══════════════════════════════════════════════════════════════   │
│  ACTIVE CONVICTION MARKETS                                          │
│  ═══════════════════════════════════════════════════════════════   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 🎯 Jupiter                                      DEFI         │   │
│  │ "Will Jupiter launch perpetuals by Q2 2026?"                │   │
│  │                                                              │   │
│  │ PROJECT STAKED: 500 SOL on YES                              │   │
│  │                                                              │   │
│  │ YES: 72%  │██████████████░░░░░░│  NO: 28%                   │   │
│  │                                                              │   │
│  │ Volume: $45,230    Closes: Apr 15    Score: 87/100          │   │
│  │                                                              │   │
│  │ [Trade YES]  [Trade NO]  [View Project]                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 🎯 Tensor                                       NFT          │   │
│  │ "Will Tensor reach 50% NFT market share by Q3?"             │   │
│  │                                                              │   │
│  │ PROJECT STAKED: 200 SOL on YES                              │   │
│  │                                                              │   │
│  │ YES: 58%  │███████████░░░░░░░░░│  NO: 42%                   │   │
│  │                                                              │   │
│  │ Volume: $23,100    Closes: Jul 1     Score: 72/100          │   │
│  │                                                              │   │
│  │ [Trade YES]  [Trade NO]  [View Project]                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.3 Project Profile Page (AI-Indexable)

```
┌─────────────────────────────────────────────────────────────────────┐
│  beright.ai/conviction/projects/jupiter                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  JUPITER                                           [DEFI] [SOLANA]  │
│  ════════════════════════════════════════════════════════════════  │
│                                                                     │
│  Jupiter is the leading DEX aggregator on Solana, processing       │
│  over $100B in cumulative volume. Founded in 2021.                 │
│                                                                     │
│  CONVICTION SCORE: 87/100                                          │
│  [██████████████████░░░░░░]                                        │
│                                                                     │
│  Score Breakdown:                                                   │
│  • Total Staked: 2,340 SOL ($234,000)                              │
│  • Markets Created: 12                                              │
│  • Success Rate: 91.7% (11/12 milestones hit)                      │
│  • Community Trust: High (avg volume $50k/market)                  │
│  • AI Visibility: 73/100 (cited by ChatGPT, Perplexity)            │
│                                                                     │
│  ACTIVE MARKETS                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│  • "Will Jupiter launch perpetuals by Q2 2026?" - 72% YES          │
│  • "Will Jupiter reach $500B cumulative volume?" - 65% YES         │
│                                                                     │
│  RESOLVED MARKETS (Track Record)                                    │
│  ─────────────────────────────────────────────────────────────────  │
│  ✅ "Launch limit orders by Q4 2025" - HIT                         │
│  ✅ "Integrate with Firedancer" - HIT                              │
│  ✅ "Reach $100B volume" - HIT                                     │
│  ❌ "Launch mobile app by Q1 2026" - MISSED                        │
│                                                                     │
│  AI VISIBILITY                                                      │
│  ─────────────────────────────────────────────────────────────────  │
│  ChatGPT: ✅ Cited | Gemini: ✅ Cited | Perplexity: ✅ Cited        │
│  Claude: ⚠️ Sometimes | DeepSeek: ❌ Not cited                      │
│                                                                     │
│  Recent mention: "Jupiter is the leading DEX aggregator on         │
│  Solana with the best routing..." - ChatGPT, Mar 2026              │
│                                                                     │
│  [Twitter] [Website] [Discord] [GitHub]                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 10. AI Visibility Engine

### 10.1 Citation Checker

```typescript
// lib/conviction/visibility.ts

import { llmChat } from '../llm';

const LLM_ENDPOINTS = {
  // Note: These would need actual API access
  chatgpt: 'openai',
  gemini: 'gemini',
  perplexity: 'perplexity',
  claude: 'anthropic',
};

/**
 * Check if a project is cited by major LLMs
 */
export async function checkAIVisibility(
  project: ConvictionProject
): Promise<AIVisibility> {
  const queries = generateTestQueries(project);
  const results: AIVisibility = {
    projectId: project.id,
    overall: 0,
    byLLM: {} as any,
    recentMentions: [],
    trend: 'stable',
    lastChecked: new Date(),
  };

  // Query each LLM
  for (const [llm, provider] of Object.entries(LLM_ENDPOINTS)) {
    const citations: LLMCitation = {
      score: 0,
      mentioned: false,
      lastChecked: new Date(),
      lastQuery: '',
    };

    for (const query of queries) {
      const response = await queryLLM(provider, query);
      const mentioned = checkMention(response, project.name);

      if (mentioned) {
        citations.mentioned = true;
        citations.context = extractContext(response, project.name);
        citations.position = findPosition(response, project.name);
        citations.score += 20; // Each mention adds score

        results.recentMentions.push({
          llm,
          query,
          mentioned: true,
          context: citations.context,
          timestamp: new Date(),
        });
      }

      citations.lastQuery = query;
    }

    citations.score = Math.min(100, citations.score);
    results.byLLM[llm] = citations;
  }

  // Calculate overall score
  const scores = Object.values(results.byLLM).map(c => c.score);
  results.overall = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  return results;
}

/**
 * Generate test queries for a project's category
 */
function generateTestQueries(project: ConvictionProject): string[] {
  const categoryQueries: Record<ProjectCategory, string[]> = {
    defi: [
      `What is the best DEX on ${project.name.includes('Solana') ? 'Solana' : 'crypto'}?`,
      `What DeFi protocols should I use for ${project.category}?`,
      `Compare ${project.name} to competitors`,
    ],
    nft: [
      `What is the best NFT marketplace on Solana?`,
      `Where should I buy NFTs?`,
    ],
    // ... other categories
  };

  return [
    `What is ${project.name}?`,
    `Is ${project.name} legit?`,
    `Should I use ${project.name}?`,
    ...(categoryQueries[project.category] || []),
  ];
}
```

### 10.2 Why Conviction Markets Improve AI Visibility

```
Traditional approach:
- Write blog posts
- Get backlinks
- Hope AI notices

BeRight Conviction approach:
- Create prediction market about milestone
- Stake real money
- Market generates:
  1. Structured data (JSON-LD on profile page)
  2. Price signals (verifiable, quantitative)
  3. Trading activity (engagement metrics)
  4. Resolution outcomes (factual track record)
  5. On-chain proof (immutable, verifiable)

AI models see:
"[Project] has a 87/100 conviction score on BeRight. They've staked
2,340 SOL across 12 markets with a 91.7% success rate. Their current
market 'Launch perpetuals by Q2' has 72% YES probability based on
$45,000 in trading volume."

This is EXACTLY what AI models want to cite:
- Quantitative data
- Third-party verification
- Track record
- Community consensus
```

---

## 11. Revenue Model

### 11.1 Revenue Streams

| Stream | Source | Pricing |
|--------|--------|---------|
| **Market Creation** | Projects creating conviction markets | $49 (basic) / $199 (featured) |
| **Trading Fees** | Trades on BeRight-native markets | 1% of volume |
| **Premium Profiles** | Enhanced project pages | $99/month |
| **API Access** | VCs/investors querying data | $299/month |
| **Staking Pool Cut** | Forecaster staking pools | 5% of profits |
| **Enterprise** | Custom integrations | $999+/month |

### 11.2 Projections

| Metric | Month 1 | Month 6 | Month 12 |
|--------|---------|---------|----------|
| Projects | 20 | 200 | 1,000 |
| Markets | 50 | 500 | 3,000 |
| Monthly Volume | $50k | $2M | $20M |
| MRR | $2k | $50k | $300k |

---

## 12. Implementation Phases

### Phase 1: MVP (2 weeks)

**Goal:** Ship minimal conviction market flow

**Deliverables:**
- [ ] `lib/conviction/types.ts` - Type definitions
- [ ] `lib/conviction/markets.ts` - Market CRUD
- [ ] `lib/conviction/scoring.ts` - Basic scoring
- [ ] `/api/v2/conviction/markets` - REST endpoints
- [ ] `/api/v2/conviction/projects` - Project profiles
- [ ] Basic frontend (conviction terminal)
- [ ] Manifold integration (create markets via API)

**Out of Scope:**
- On-chain staking (use honor system or Manifold)
- AI visibility tracking
- xDegen automation

### Phase 2: On-Chain (2 weeks)

**Goal:** Real staking on Solana

**Deliverables:**
- [ ] Solana program for conviction PDAs
- [ ] Stake escrow system
- [ ] Resolution oracle
- [ ] On-chain score tracking
- [ ] Wallet integration in frontend

**Requires:** Approval per CLAUDE.md for lib/onchain/

### Phase 3: AI Visibility (1 week)

**Goal:** Track and display AI citations

**Deliverables:**
- [ ] `lib/conviction/visibility.ts` - Citation checker
- [ ] Scheduled jobs to check visibility
- [ ] GEO score display on profiles
- [ ] Visibility trends and alerts

### Phase 4: Distribution (1 week)

**Goal:** Viral growth mechanics

**Deliverables:**
- [ ] xDegen conviction templates
- [ ] Auto-posting for new markets
- [ ] Leaderboard content
- [ ] Embeddable market widgets

### Phase 5: Scale (Ongoing)

**Goal:** Enterprise features

**Deliverables:**
- [ ] API for VCs/investors
- [ ] Forecaster staking pools
- [ ] White-label for other platforms
- [ ] Advanced analytics

---

## 13. Success Metrics

### Product Metrics

| Metric | Target (M1) | Target (M6) |
|--------|-------------|-------------|
| Projects registered | 20 | 200 |
| Markets created | 50 | 500 |
| Total staked (SOL) | 500 | 10,000 |
| Average stake/market | 10 SOL | 20 SOL |
| Market resolution rate | 80% | 90% |
| Project success rate | 60% | 70% |

### Engagement Metrics

| Metric | Target (M1) | Target (M6) |
|--------|-------------|-------------|
| Daily active traders | 100 | 2,000 |
| Trades per market | 20 | 100 |
| Average volume/market | $1,000 | $5,000 |
| Social shares | 500 | 10,000 |

### AI Visibility Metrics

| Metric | Target (M6) | Target (M12) |
|--------|-------------|--------------|
| Projects with GEO > 50 | 20% | 50% |
| BeRight cited by ChatGPT | Yes | Yes |
| BeRight cited by Perplexity | Yes | Yes |
| Average GEO score increase | +10 | +20 |

---

## 14. Risks & Mitigations

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Manifold API changes | Market creation breaks | Build backup (native markets) |
| LLM API rate limits | Visibility tracking limited | Caching, batch queries |
| Solana congestion | Staking fails | Jito bundles, retry logic |
| Resolution disputes | Trust issues | Clear criteria, appeal process |

### Business Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Projects don't stake enough | Low credibility | Minimum stake requirements |
| Gaming the system | Fake projects | Verification, reputation decay |
| Regulatory | Legal issues | Focus on play money first |
| Competition | Market share | First mover, Solana native |

### Market Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Crypto winter | Low activity | Low burn, focus on core users |
| AI SEO becomes saturated | Less differentiation | Prediction market layer is unique |
| Platforms copy feature | Competition | Build network effects early |

---

## Appendix A: Milestone Templates

```typescript
export const MILESTONE_TEMPLATES: Record<MilestoneType, {
  questionTemplate: string;
  resolutionCriteria: string;
  suggestedStake: number;
}> = {
  mainnet_launch: {
    questionTemplate: 'Will {project} launch mainnet by {date}?',
    resolutionCriteria: 'Mainnet must be publicly accessible and announced',
    suggestedStake: 100,
  },
  user_milestone: {
    questionTemplate: 'Will {project} reach {target} users by {date}?',
    resolutionCriteria: 'Verified via public dashboard or API',
    suggestedStake: 50,
  },
  tvl_milestone: {
    questionTemplate: 'Will {project} reach ${target} TVL by {date}?',
    resolutionCriteria: 'DefiLlama TVL on resolution date',
    suggestedStake: 100,
  },
  token_launch: {
    questionTemplate: 'Will {project} launch token by {date}?',
    resolutionCriteria: 'Token trading on major DEX/CEX',
    suggestedStake: 200,
  },
  partnership: {
    questionTemplate: 'Will {project} announce partnership with {partner} by {date}?',
    resolutionCriteria: 'Official announcement from both parties',
    suggestedStake: 50,
  },
  ai_visibility: {
    questionTemplate: 'Will {project} be recommended by ChatGPT for {category} by {date}?',
    resolutionCriteria: 'BeRight queries ChatGPT 10 times, majority mention = YES',
    suggestedStake: 30,
  },
};
```

---

## Appendix B: API Rate Limits

| Endpoint | Rate Limit | Burst |
|----------|------------|-------|
| GET /markets | 100/min | 20 |
| POST /markets | 10/min | 2 |
| GET /projects | 100/min | 20 |
| POST /stake | 20/min | 5 |
| GET /visibility | 10/min | 2 |

---

## Appendix C: Error Codes

| Code | Meaning |
|------|---------|
| `CONV_001` | Project not found |
| `CONV_002` | Market not found |
| `CONV_003` | Insufficient stake |
| `CONV_004` | Market already resolved |
| `CONV_005` | Verification failed |
| `CONV_006` | Rate limited |
| `CONV_007` | Invalid milestone type |
| `CONV_008` | Resolution date in past |

---

*End of Specification*
