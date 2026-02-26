/**
 * LLM Client for BeRight Protocol
 *
 * ARCHITECTURE: Fallback Chain
 * 1. Groq (free, fast, 14,400 req/day)
 * 2. Anthropic (paid, high quality)
 * 3. None (graceful degradation)
 *
 * Uses native fetch — no extra packages required.
 */

import { secrets } from './secrets';

export interface LLMRequest {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  /** Hint: 'fast' uses smaller model, 'smart' uses largest available */
  quality?: 'fast' | 'smart';
}

export interface LLMResponse {
  text: string;
  tokensUsed: number;
  provider: 'groq' | 'anthropic' | 'none';
  model: string;
}

// Model mappings per provider
const GROQ_MODELS = {
  fast: 'llama-3.1-8b-instant',       // ~600 tok/sec, lightweight
  smart: 'llama-3.3-70b-versatile',   // ~300 tok/sec, GPT-4 quality
};

const ANTHROPIC_MODELS = {
  fast: 'claude-3-haiku-20240307',    // Fast, cheap
  smart: 'claude-3-5-sonnet-20241022', // High quality
};

// ============================================================================
// STARTUP VALIDATION
// ============================================================================

let _startupValidated = false;
let _availableProviders: Array<'groq' | 'anthropic'> = [];

/**
 * Validate LLM configuration at startup
 * Call this once when the app starts
 */
export function validateLLMConfig(): { valid: boolean; providers: string[]; errors: string[] } {
  const errors: string[] = [];
  _availableProviders = [];

  const groqKey = secrets.getGroqApiKey();
  const anthropicKey = secrets.getAnthropicApiKey();

  if (groqKey) {
    _availableProviders.push('groq');
    console.log('[LLM] ✓ Groq API key configured');
  } else {
    errors.push('GROQ_API_KEY not set');
  }

  if (anthropicKey) {
    _availableProviders.push('anthropic');
    console.log('[LLM] ✓ Anthropic API key configured');
  } else {
    errors.push('ANTHROPIC_API_KEY not set');
  }

  if (_availableProviders.length === 0) {
    console.error('[LLM] ✗ NO LLM PROVIDERS CONFIGURED - Bot will return fallback responses');
    console.error('[LLM] Set GROQ_API_KEY or ANTHROPIC_API_KEY in .env');
  } else {
    console.log(`[LLM] Provider chain: ${_availableProviders.join(' → ')}`);
  }

  _startupValidated = true;
  return {
    valid: _availableProviders.length > 0,
    providers: _availableProviders,
    errors,
  };
}

// ============================================================================
// MAIN LLM FUNCTION WITH FALLBACK CHAIN
// ============================================================================

/**
 * Call LLM with automatic fallback chain
 * Tries: Groq → Anthropic → returns empty
 */
export async function llmChat(req: LLMRequest): Promise<LLMResponse> {
  const { system, user, maxTokens = 1024, temperature = 0.3, quality = 'smart' } = req;

  // Validate on first call if not done at startup
  if (!_startupValidated) {
    validateLLMConfig();
  }

  // Try Groq first (free, fast)
  const groqKey = secrets.getGroqApiKey();
  if (groqKey) {
    try {
      return await callGroq({ system, user, maxTokens, temperature, quality, apiKey: groqKey });
    } catch (err) {
      console.warn('[LLM] Groq failed, trying fallback:', err instanceof Error ? err.message : err);
    }
  }

  // Fallback to Anthropic
  const anthropicKey = secrets.getAnthropicApiKey();
  if (anthropicKey) {
    try {
      return await callAnthropic({ system, user, maxTokens, temperature, quality, apiKey: anthropicKey });
    } catch (err) {
      console.warn('[LLM] Anthropic failed:', err instanceof Error ? err.message : err);
    }
  }

  // All providers failed
  console.error('[LLM] All providers failed. Set GROQ_API_KEY or ANTHROPIC_API_KEY.');
  return { text: '', tokensUsed: 0, provider: 'none', model: 'none' };
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
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the currently active LLM provider(s)
 */
export function getActiveLLMProvider(): 'groq' | 'anthropic' | 'none' {
  if (secrets.getGroqApiKey()) return 'groq';
  if (secrets.getAnthropicApiKey()) return 'anthropic';
  return 'none';
}

/**
 * Get all available providers
 */
export function getAvailableProviders(): Array<'groq' | 'anthropic'> {
  if (!_startupValidated) validateLLMConfig();
  return _availableProviders;
}

/**
 * Check if any LLM is available
 */
export function isLLMAvailable(): boolean {
  return getActiveLLMProvider() !== 'none';
}
