/**
 * LLM Client for BeRight Protocol
 *
 * Provider: Groq (free, 14,400 req/day, 300+ tokens/sec)
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
  provider: 'groq' | 'none';
  model: string;
}

// Groq model mapping
const GROQ_MODELS = {
  fast: 'llama-3.1-8b-instant',       // ~600 tok/sec, lightweight
  smart: 'llama-3.3-70b-versatile',   // ~300 tok/sec, GPT-4 quality
};

/**
 * Call Groq LLM.
 * Returns empty text if not configured.
 */
export async function llmChat(req: LLMRequest): Promise<LLMResponse> {
  const { system, user, maxTokens = 1024, temperature = 0.3, quality = 'smart' } = req;

  const groqKey = secrets.getGroqApiKey();
  if (groqKey) {
    try {
      return await callGroq({ system, user, maxTokens, temperature, quality, apiKey: groqKey });
    } catch (err) {
      console.warn('[LLM] Groq failed:', err instanceof Error ? err.message : err);
    }
  }

  console.warn('[LLM] No provider configured. Set GROQ_API_KEY.');
  return { text: '', tokensUsed: 0, provider: 'none', model: 'none' };
}

// ──────────────────────────────────────────────
// Groq  (OpenAI-compatible, native fetch)
// ──────────────────────────────────────────────

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

/**
 * Quick check — is Groq configured?
 */
export function getActiveLLMProvider(): 'groq' | 'none' {
  if (secrets.getGroqApiKey()) return 'groq';
  return 'none';
}
