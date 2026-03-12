/**
 * LLM Client for BeRight Protocol
 *
 * ARCHITECTURE: Fallback Chain
 * 1. Mistral (PRIMARY - fast, high quality, generous API limits)
 * 2. Gemini (backup - 1M tokens/min, 1500 req/day, 1M context)
 * 3. Groq (backup - 14,400 req/day, fast)
 * 4. Anthropic (paid, high quality)
 * 5. None (graceful degradation)
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
  provider: 'mistral' | 'gemini' | 'groq' | 'anthropic' | 'none';
  model: string;
}

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
  fast: 'claude-3-haiku-20240307',    // Fast, cheap
  smart: 'claude-3-5-sonnet-20241022', // High quality
};

// ============================================================================
// STARTUP VALIDATION
// ============================================================================

let _startupValidated = false;
let _availableProviders: Array<'mistral' | 'gemini' | 'groq' | 'anthropic'> = [];

/**
 * Validate LLM configuration at startup
 * Call this once when the app starts
 */
export function validateLLMConfig(): { valid: boolean; providers: string[]; errors: string[] } {
  const errors: string[] = [];
  _availableProviders = [];

  const mistralKey = secrets.getMistralApiKey();
  const geminiKey = secrets.getGeminiApiKey();
  const groqKey = secrets.getGroqApiKey();
  const anthropicKey = secrets.getAnthropicApiKey();

  // Mistral is PRIMARY (fast, high quality, generous limits)
  if (mistralKey) {
    _availableProviders.push('mistral');
    console.log('[LLM] ✓ Mistral API key configured (PRIMARY - mistral-large-latest)');
  } else {
    errors.push('MISTRAL_API_KEY not set');
  }

  // Gemini as backup (1M tokens/min, 1500 req/day, 1M context window)
  if (geminiKey) {
    _availableProviders.push('gemini');
    console.log('[LLM] ✓ Gemini API key configured (backup)');
  }

  // Groq as backup (14,400 req/day free)
  if (groqKey) {
    _availableProviders.push('groq');
    console.log('[LLM] ✓ Groq API key configured (backup)');
  }

  if (anthropicKey) {
    _availableProviders.push('anthropic');
    console.log('[LLM] ✓ Anthropic API key configured (backup)');
  }

  if (_availableProviders.length === 0) {
    console.error('[LLM] ✗ NO LLM PROVIDERS CONFIGURED - Bot will return fallback responses');
    console.error('[LLM] Set MISTRAL_API_KEY in .env (get from: https://console.mistral.ai/)');
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
      console.error('[LLM] Anthropic also exhausted');
    }
  }

  // All providers failed - return honest failure
  // IMPORTANT: Callers must handle this gracefully, NOT use regex fallback
  console.error('[LLM] ALL PROVIDERS FAILED. Check API keys and rate limits.');
  return { text: '', tokensUsed: 0, provider: 'none', model: 'none' };
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
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the currently active LLM provider(s)
 * Returns the primary provider based on configuration priority
 */
export function getActiveLLMProvider(): 'mistral' | 'gemini' | 'groq' | 'anthropic' | 'none' {
  // Mistral is primary (fast, high quality)
  if (secrets.getMistralApiKey()) return 'mistral';
  if (secrets.getGeminiApiKey()) return 'gemini';
  if (secrets.getGroqApiKey()) return 'groq';
  if (secrets.getAnthropicApiKey()) return 'anthropic';
  return 'none';
}

/**
 * Get all available providers
 */
export function getAvailableProviders(): Array<'mistral' | 'gemini' | 'groq' | 'anthropic'> {
  if (!_startupValidated) validateLLMConfig();
  return _availableProviders;
}

/**
 * Check if any LLM is available
 */
export function isLLMAvailable(): boolean {
  return getActiveLLMProvider() !== 'none';
}
