/**
 * LLM Client for BeRight Protocol
 *
 * ARCHITECTURE: Agent-Specific Routing (Cost-Optimized)
 *
 * Each agent routes to its optimal LLM:
 * - Orchestrator → Groq (FREE, <100ms routing)
 * - Scout       → Gemini Flash (FREE, fast synthesis)
 * - Analyst     → Claude Opus (PAID, deep reasoning)
 * - Trader      → Mistral Large (PAID, precise calculations)
 * - xDegen      → Claude Sonnet (PAID, creative content)
 *
 * Fallback chain for each agent if primary fails.
 * Saves ~47% on LLM costs vs using Claude for everything.
 *
 * Uses native fetch — no extra packages required.
 */

import { secrets } from './secrets';

// ============================================================================
// TYPES
// ============================================================================

export type AgentType = 'orchestrator' | 'scout' | 'analyst' | 'trader' | 'xdegen' | 'decision' | 'signal' | 'synthesis';
export type LLMProvider = 'anthropic' | 'openai' | 'xai' | 'mistral' | 'gemini' | 'groq' | 'none';

export interface LLMRequest {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  /** Hint: 'fast' uses smaller model, 'smart' uses largest available */
  quality?: 'fast' | 'smart';
}

export interface LLMRouteRequest extends LLMRequest {
  /** Agent type for optimized routing */
  agent: AgentType;
}

export interface LLMResponse {
  text: string;
  tokensUsed: number;
  provider: LLMProvider;
  model: string;
  /** Cost in USD (estimated) */
  estimatedCost?: number;
}

// ============================================================================
// AGENT-SPECIFIC LLM ROUTING CONFIG
// ============================================================================

/**
 * Optimal LLM configuration per agent
 *
 * Routing Strategy:
 * - FREE tiers for high-volume, low-complexity tasks
 * - PAID tiers for quality-critical tasks
 */
/**
 * Production LLM Routing Configuration
 *
 * STRATEGY: Paid LLMs for accuracy, free as fallback
 *
 * Primary LLMs (Production Quality):
 * - Claude Opus: Deep reasoning, probability, research
 * - Claude Sonnet: Fast reasoning, synthesis, creative
 * - Mistral Large: Math, risk calculation, precise
 * - Gemini Pro: General purpose, good context
 *
 * Fallback (when primary fails):
 * - Gemini Flash: Fast, free
 * - Groq: Very fast, free
 */
export const AGENT_LLM_CONFIG: Record<AgentType, {
  primary: LLMProvider;
  fallback: LLMProvider[];
  quality: 'fast' | 'smart';
  maxTokens: number;
  temperature: number;
  costPerCall: number; // USD estimate
  description: string;
}> = {
  // Orchestrator: Fast routing, but accurate intent detection
  orchestrator: {
    primary: 'mistral',           // Mistral Small - fast + accurate
    fallback: ['gemini', 'groq'],
    quality: 'fast',
    maxTokens: 512,
    temperature: 0.2,
    costPerCall: 0.001,
    description: 'Intent routing - Mistral Small (PAID, fast)',
  },

  // Scout: Data synthesis needs good reasoning
  scout: {
    primary: 'anthropic',         // Claude Sonnet - best synthesis
    fallback: ['mistral', 'gemini'],
    quality: 'fast',
    maxTokens: 2048,
    temperature: 0.3,
    costPerCall: 0.015,
    description: 'Market scanning - Claude Sonnet (PAID)',
  },

  // Analyst: Deep reasoning - use best model
  analyst: {
    primary: 'anthropic',         // Claude Opus - best reasoning
    fallback: ['mistral', 'gemini'],
    quality: 'smart',
    maxTokens: 4096,
    temperature: 0.4,
    costPerCall: 0.30,
    description: 'Deep research - Claude Opus (PAID)',
  },

  // Trader: Precision critical - use smart model
  trader: {
    primary: 'anthropic',         // Claude Sonnet - precise + fast
    fallback: ['mistral', 'gemini'],
    quality: 'fast',
    maxTokens: 2048,
    temperature: 0.1,
    costPerCall: 0.015,
    description: 'Risk calculation - Claude Sonnet (PAID)',
  },

  // xDegen: Creative content - Claude is best
  xdegen: {
    primary: 'anthropic',         // Claude Sonnet - creative + voice
    fallback: ['mistral', 'gemini'],
    quality: 'fast',
    maxTokens: 1024,
    temperature: 0.7,
    costPerCall: 0.015,
    description: 'Social content - Claude Sonnet (PAID)',
  },

  // Decision Engine: Scoring accuracy matters
  decision: {
    primary: 'anthropic',         // Claude Sonnet - accurate scoring
    fallback: ['mistral', 'gemini'],
    quality: 'fast',
    maxTokens: 2048,
    temperature: 0.3,
    costPerCall: 0.015,
    description: 'Opportunity scoring - Claude Sonnet (PAID)',
  },

  // Signal Evaluation: Quick but accurate
  signal: {
    primary: 'mistral',           // Mistral Small - fast + accurate
    fallback: ['gemini', 'groq'],
    quality: 'fast',
    maxTokens: 1024,
    temperature: 0.2,
    costPerCall: 0.001,
    description: 'Signal classification - Mistral Small (PAID)',
  },

  // Synthesis: Deep reports need best model
  synthesis: {
    primary: 'anthropic',         // Claude Opus - best synthesis
    fallback: ['mistral', 'gemini'],
    quality: 'smart',
    maxTokens: 4096,
    temperature: 0.5,
    costPerCall: 0.30,
    description: 'Report synthesis - Claude Opus (PAID)',
  },
};

// Model mappings per provider
// Mistral models: https://docs.mistral.ai/getting-started/models/
const MISTRAL_MODELS = {
  fast: 'mistral-small-latest',       // Fast, efficient, cost-effective
  smart: 'mistral-large-latest',      // Best quality, advanced reasoning
};

// Gemini models: https://ai.google.dev/gemini-api/docs/models/gemini
// Free tier: 15 RPM, 1M tokens/min, 1500 req/day
const GEMINI_MODELS = {
  fast: 'gemini-2.0-flash',           // Latest, best performance, fast
  smart: 'gemini-1.5-pro-latest',     // Best quality, 2M context, complex reasoning
};

const GROQ_MODELS = {
  fast: 'llama-3.1-8b-instant',       // ~600 tok/sec, lightweight
  smart: 'llama-3.3-70b-versatile',   // ~300 tok/sec, GPT-4 quality
};

const ANTHROPIC_MODELS = {
  fast: 'claude-3-5-sonnet-20241022',  // Fast + high quality (best balance)
  smart: 'claude-3-opus-20240229',     // Highest quality reasoning
};

// OpenAI models: https://platform.openai.com/docs/models
const OPENAI_MODELS = {
  fast: 'gpt-4o-mini',                 // Fast, cheap, good quality
  smart: 'gpt-4o',                     // Best OpenAI model, multimodal
};

// xAI (Grok) models: https://docs.x.ai/docs
const XAI_MODELS = {
  fast: 'grok-2-mini',                 // Fast, efficient
  smart: 'grok-2',                     // Full Grok-2, best quality
};

// ============================================================================
// STARTUP VALIDATION
// ============================================================================

let _startupValidated = false;
let _availableProviders: Array<Exclude<LLMProvider, 'none'>> = [];

/**
 * Validate LLM configuration at startup
 * Call this once when the app starts
 */
export function validateLLMConfig(): { valid: boolean; providers: string[]; errors: string[] } {
  const errors: string[] = [];
  _availableProviders = [];

  // Check all providers
  const anthropicKey = secrets.getAnthropicApiKey();
  const openaiKey = secrets.getOpenAIApiKey();
  const xaiKey = secrets.getXAIApiKey();
  const mistralKey = secrets.getMistralApiKey();
  const geminiKey = secrets.getGeminiApiKey();
  const groqKey = secrets.getGroqApiKey();

  // Anthropic (Claude) - Best reasoning
  if (anthropicKey) {
    _availableProviders.push('anthropic');
    console.log('[LLM] ✓ Anthropic (Claude) configured - claude-3.5-sonnet, claude-3-opus');
  }

  // OpenAI (GPT-4) - Best general purpose
  if (openaiKey) {
    _availableProviders.push('openai');
    console.log('[LLM] ✓ OpenAI (GPT-4) configured - gpt-4o, gpt-4o-mini');
  }

  // xAI (Grok) - Fast, good reasoning
  if (xaiKey) {
    _availableProviders.push('xai');
    console.log('[LLM] ✓ xAI (Grok) configured - grok-2, grok-2-mini');
  }

  // Mistral - Fast, cost-effective
  if (mistralKey) {
    _availableProviders.push('mistral');
    console.log('[LLM] ✓ Mistral configured - mistral-large, mistral-small');
  }

  // Gemini - Good context, free tier
  if (geminiKey) {
    _availableProviders.push('gemini');
    console.log('[LLM] ✓ Gemini configured - gemini-1.5-pro, gemini-2.0-flash');
  }

  // Groq - Very fast, free tier
  if (groqKey) {
    _availableProviders.push('groq');
    console.log('[LLM] ✓ Groq configured - llama-3.3-70b, llama-3.1-8b');
  }

  if (_availableProviders.length === 0) {
    console.error('[LLM] ✗ NO LLM PROVIDERS CONFIGURED');
    console.error('[LLM] Set at least one: ANTHROPIC_API_KEY, OPENAI_API_KEY, XAI_API_KEY, MISTRAL_API_KEY, GEMINI_API_KEY, GROQ_API_KEY');
    errors.push('No LLM providers configured');
  } else {
    console.log(`[LLM] Available providers: ${_availableProviders.join(', ')}`);
  }

  _startupValidated = true;
  return {
    valid: _availableProviders.length > 0,
    providers: _availableProviders,
    errors,
  };
}

// ============================================================================
// RETRY LOGIC WITH EXPONENTIAL BACKOFF
// ============================================================================

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  retries = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on auth errors (wrong API key)
      if (lastError.message.includes('401') || lastError.message.includes('403')) {
        console.error(`[LLM] ${label} auth error (not retrying): ${lastError.message}`);
        throw lastError;
      }

      // Don't retry if we're out of attempts
      if (attempt === retries) {
        console.error(`[LLM] ${label} failed after ${retries} attempts: ${lastError.message}`);
        throw lastError;
      }

      // Exponential backoff: 500ms, 1000ms, 2000ms
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(`[LLM] ${label} attempt ${attempt} failed, retrying in ${delay}ms: ${lastError.message}`);
      await sleep(delay);
    }
  }

  throw lastError;
}

// ============================================================================
// MAIN LLM FUNCTION WITH RETRY + FALLBACK CHAIN
// ============================================================================

/**
 * Call LLM with automatic retry and fallback chain
 * Architecture: Mistral (with retry) → Gemini (with retry) → Groq (with retry) → Anthropic (with retry) → failure
 *
 * Mistral is primary because:
 * - Fast response times
 * - High quality responses
 * - Generous API limits
 * - Good at reasoning and context understanding
 *
 * IMPORTANT: If LLM fails, we return provider='none'.
 * Callers should NOT use regex fallback - they should tell user honestly.
 */
export async function llmChat(req: LLMRequest): Promise<LLMResponse> {
  const { system, user, maxTokens = 1024, temperature = 0.3, quality = 'smart' } = req;

  // Validate on first call if not done at startup
  if (!_startupValidated) {
    validateLLMConfig();
  }

  // Try Mistral first (PRIMARY - fast, high quality)
  const mistralKey = secrets.getMistralApiKey();
  if (mistralKey) {
    try {
      return await withRetry(
        () => callMistral({ system, user, maxTokens, temperature, quality, apiKey: mistralKey }),
        'Mistral'
      );
    } catch (err) {
      console.warn('[LLM] Mistral exhausted, trying Gemini fallback');
    }
  }

  // Fallback to Gemini (Google, 1M context, high quality)
  const geminiKey = secrets.getGeminiApiKey();
  if (geminiKey) {
    try {
      return await withRetry(
        () => callGemini({ system, user, maxTokens, temperature, quality, apiKey: geminiKey }),
        'Gemini'
      );
    } catch (err) {
      console.warn('[LLM] Gemini exhausted, trying Groq fallback');
    }
  }

  // Fallback to Groq (fast, generous free tier)
  const groqKey = secrets.getGroqApiKey();
  if (groqKey) {
    try {
      return await withRetry(
        () => callGroq({ system, user, maxTokens, temperature, quality, apiKey: groqKey }),
        'Groq'
      );
    } catch (err) {
      console.warn('[LLM] Groq exhausted, trying Anthropic fallback');
    }
  }

  // Fallback to Anthropic with retry
  const anthropicKey = secrets.getAnthropicApiKey();
  if (anthropicKey) {
    try {
      return await withRetry(
        () => callAnthropic({ system, user, maxTokens, temperature, quality, apiKey: anthropicKey }),
        'Anthropic'
      );
    } catch (err) {
      console.warn('[LLM] Anthropic exhausted, trying OpenAI fallback');
    }
  }

  // Fallback to OpenAI (GPT-4)
  const openaiKey = secrets.getOpenAIApiKey();
  if (openaiKey) {
    try {
      return await withRetry(
        () => callOpenAI({ system, user, maxTokens, temperature, quality, apiKey: openaiKey }),
        'OpenAI'
      );
    } catch (err) {
      console.warn('[LLM] OpenAI exhausted, trying xAI fallback');
    }
  }

  // Fallback to xAI (Grok)
  const xaiKey = secrets.getXAIApiKey();
  if (xaiKey) {
    try {
      return await withRetry(
        () => callXAI({ system, user, maxTokens, temperature, quality, apiKey: xaiKey }),
        'xAI'
      );
    } catch (err) {
      console.error('[LLM] xAI also exhausted');
    }
  }

  // All providers failed - return honest failure
  // IMPORTANT: Callers must handle this gracefully, NOT use regex fallback
  console.error('[LLM] ALL PROVIDERS FAILED. Check API keys and rate limits.');
  return { text: '', tokensUsed: 0, provider: 'none', model: 'none' };
}

// ============================================================================
// AGENT-SPECIFIC ROUTING (COST-OPTIMIZED)
// ============================================================================

/**
 * Route LLM call to optimal provider based on agent type
 *
 * This is the PRIMARY function agents should use.
 * It automatically selects the best LLM for each agent's needs.
 *
 * Cost savings: ~47% vs using Claude for everything
 *
 * @param req - Request with agent type for routing
 * @returns LLM response with provider info and cost estimate
 */
export async function llmRoute(req: LLMRouteRequest): Promise<LLMResponse> {
  const config = AGENT_LLM_CONFIG[req.agent];

  if (!config) {
    console.warn(`[LLM] Unknown agent type: ${req.agent}, falling back to default chain`);
    return llmChat(req);
  }

  const {
    system,
    user,
    maxTokens = config.maxTokens,
    temperature = config.temperature,
  } = req;

  // Validate on first call
  if (!_startupValidated) {
    validateLLMConfig();
  }

  console.log(`[LLM] Routing ${req.agent} → ${config.description}`);

  // Build provider chain: primary + fallbacks
  const providerChain: LLMProvider[] = [config.primary, ...config.fallback];

  // Try each provider in order
  for (const provider of providerChain) {
    const result = await tryProvider(provider, {
      system,
      user,
      maxTokens,
      temperature,
      quality: config.quality,
    });

    if (result) {
      // Add cost estimate
      result.estimatedCost = config.costPerCall;
      return result;
    }
  }

  // All providers failed
  console.error(`[LLM] All providers failed for ${req.agent}`);
  return { text: '', tokensUsed: 0, provider: 'none', model: 'none', estimatedCost: 0 };
}

/**
 * Try a specific provider with retry logic
 */
async function tryProvider(
  provider: LLMProvider,
  opts: {
    system: string;
    user: string;
    maxTokens: number;
    temperature: number;
    quality: 'fast' | 'smart';
  }
): Promise<LLMResponse | null> {
  switch (provider) {
    case 'groq': {
      const apiKey = secrets.getGroqApiKey();
      if (!apiKey) return null;
      try {
        return await withRetry(
          () => callGroq({ ...opts, apiKey }),
          'Groq'
        );
      } catch (err) {
        console.warn(`[LLM] Groq failed: ${err instanceof Error ? err.message : err}`);
        return null;
      }
    }

    case 'gemini': {
      const apiKey = secrets.getGeminiApiKey();
      if (!apiKey) return null;
      try {
        return await withRetry(
          () => callGemini({ ...opts, apiKey }),
          'Gemini'
        );
      } catch (err) {
        console.warn(`[LLM] Gemini failed: ${err instanceof Error ? err.message : err}`);
        return null;
      }
    }

    case 'mistral': {
      const apiKey = secrets.getMistralApiKey();
      if (!apiKey) return null;
      try {
        return await withRetry(
          () => callMistral({ ...opts, apiKey }),
          'Mistral'
        );
      } catch (err) {
        console.warn(`[LLM] Mistral failed: ${err instanceof Error ? err.message : err}`);
        return null;
      }
    }

    case 'anthropic': {
      const apiKey = secrets.getAnthropicApiKey();
      if (!apiKey) return null;
      try {
        return await withRetry(
          () => callAnthropic({ ...opts, apiKey }),
          'Anthropic'
        );
      } catch (err) {
        console.warn(`[LLM] Anthropic failed: ${err instanceof Error ? err.message : err}`);
        return null;
      }
    }

    case 'openai': {
      const apiKey = secrets.getOpenAIApiKey();
      if (!apiKey) return null;
      try {
        return await withRetry(
          () => callOpenAI({ ...opts, apiKey }),
          'OpenAI'
        );
      } catch (err) {
        console.warn(`[LLM] OpenAI failed: ${err instanceof Error ? err.message : err}`);
        return null;
      }
    }

    case 'xai': {
      const apiKey = secrets.getXAIApiKey();
      if (!apiKey) return null;
      try {
        return await withRetry(
          () => callXAI({ ...opts, apiKey }),
          'xAI'
        );
      } catch (err) {
        console.warn(`[LLM] xAI failed: ${err instanceof Error ? err.message : err}`);
        return null;
      }
    }

    default:
      return null;
  }
}

/**
 * Get routing info for an agent (for debugging/monitoring)
 */
export function getAgentRoutingInfo(agent: AgentType): {
  primary: string;
  fallback: string[];
  costPerCall: number;
  description: string;
} | null {
  const config = AGENT_LLM_CONFIG[agent];
  if (!config) return null;

  return {
    primary: config.primary,
    fallback: config.fallback,
    costPerCall: config.costPerCall,
    description: config.description,
  };
}

/**
 * Get all agent routing configs (for dashboard/monitoring)
 */
export function getAllAgentRouting(): Record<AgentType, {
  primary: string;
  fallback: string[];
  costPerCall: number;
  description: string;
}> {
  const result: Record<string, any> = {};

  for (const [agent, config] of Object.entries(AGENT_LLM_CONFIG)) {
    result[agent] = {
      primary: config.primary,
      fallback: config.fallback,
      costPerCall: config.costPerCall,
      description: config.description,
    };
  }

  return result as Record<AgentType, any>;
}

// ============================================================================
// MISTRAL PROVIDER
// ============================================================================

async function callMistral(opts: {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  quality: 'fast' | 'smart';
  apiKey: string;
}): Promise<LLMResponse> {
  const model = MISTRAL_MODELS[opts.quality];

  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mistral ${res.status}: ${body}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    usage: { total_tokens: number };
    model: string;
  };

  return {
    text: data.choices[0]?.message?.content ?? '',
    tokensUsed: data.usage?.total_tokens ?? 0,
    provider: 'mistral',
    model: data.model ?? model,
  };
}

// ============================================================================
// GEMINI PROVIDER (Google AI)
// ============================================================================

async function callGemini(opts: {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  quality: 'fast' | 'smart';
  apiKey: string;
}): Promise<LLMResponse> {
  const model = GEMINI_MODELS[opts.quality];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${opts.apiKey}`;

  // Gemini uses a different format - combine system + user into contents
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: `${opts.system}\n\nUser: ${opts.user}` }
          ]
        }
      ],
      generationConfig: {
        maxOutputTokens: opts.maxTokens,
        temperature: opts.temperature,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body}`);
  }

  const data = await res.json() as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const tokensUsed = data.usageMetadata?.totalTokenCount ?? 0;

  // Debug: log if response is empty or suspiciously short
  if (!text || text.length < 10) {
    console.warn(`[LLM] Gemini returned empty/short response. Candidates: ${JSON.stringify(data.candidates?.length)}, Model: ${model}`);
  }

  return {
    text,
    tokensUsed,
    provider: 'gemini',
    model,
  };
}

// ============================================================================
// GROQ PROVIDER (OpenAI-compatible)
// ============================================================================

async function callGroq(opts: {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  quality: 'fast' | 'smart';
  apiKey: string;
}): Promise<LLMResponse> {
  const model = GROQ_MODELS[opts.quality];

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq ${res.status}: ${body}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    usage: { total_tokens: number };
    model: string;
  };

  return {
    text: data.choices[0]?.message?.content ?? '',
    tokensUsed: data.usage?.total_tokens ?? 0,
    provider: 'groq',
    model: data.model ?? model,
  };
}

// ============================================================================
// ANTHROPIC PROVIDER
// ============================================================================

async function callAnthropic(opts: {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  quality: 'fast' | 'smart';
  apiKey: string;
}): Promise<LLMResponse> {
  const model = ANTHROPIC_MODELS[opts.quality];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: [
        { role: 'user', content: opts.user },
      ],
      temperature: opts.temperature,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body}`);
  }

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>;
    usage: { input_tokens: number; output_tokens: number };
    model: string;
  };

  const text = data.content
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('');

  return {
    text,
    tokensUsed: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
    provider: 'anthropic',
    model: data.model ?? model,
  };
}

// ============================================================================
// OPENAI PROVIDER (GPT-4)
// ============================================================================

async function callOpenAI(opts: {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  quality: 'fast' | 'smart';
  apiKey: string;
}): Promise<LLMResponse> {
  const model = OPENAI_MODELS[opts.quality];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI ${res.status}: ${body}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    usage: { total_tokens: number };
    model: string;
  };

  return {
    text: data.choices[0]?.message?.content ?? '',
    tokensUsed: data.usage?.total_tokens ?? 0,
    provider: 'openai',
    model: data.model ?? model,
  };
}

// ============================================================================
// XAI PROVIDER (Grok)
// ============================================================================

async function callXAI(opts: {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  quality: 'fast' | 'smart';
  apiKey: string;
}): Promise<LLMResponse> {
  const model = XAI_MODELS[opts.quality];

  // xAI uses OpenAI-compatible API
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`xAI ${res.status}: ${body}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    usage: { total_tokens: number };
    model: string;
  };

  return {
    text: data.choices[0]?.message?.content ?? '',
    tokensUsed: data.usage?.total_tokens ?? 0,
    provider: 'xai',
    model: data.model ?? model,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the currently active LLM provider(s)
 * Returns the primary provider based on configuration priority
 */
export function getActiveLLMProvider(): Exclude<LLMProvider, 'none'> | 'none' {
  // Priority order: Anthropic (best quality) → OpenAI → xAI → Mistral → Gemini → Groq
  if (secrets.getAnthropicApiKey()) return 'anthropic';
  if (secrets.getOpenAIApiKey()) return 'openai';
  if (secrets.getXAIApiKey()) return 'xai';
  if (secrets.getMistralApiKey()) return 'mistral';
  if (secrets.getGeminiApiKey()) return 'gemini';
  if (secrets.getGroqApiKey()) return 'groq';
  return 'none';
}

/**
 * Get all available providers
 */
export function getAvailableProviders(): Array<Exclude<LLMProvider, 'none'>> {
  if (!_startupValidated) validateLLMConfig();
  return _availableProviders;
}

/**
 * Check if any LLM is available
 */
export function isLLMAvailable(): boolean {
  return getActiveLLMProvider() !== 'none';
}
