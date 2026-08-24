/**
 * Secrets Manager for BeRight Protocol
 *
 * Centralized, validated, secure access to all secrets.
 * - Validates secrets exist before use
 * - Provides clear error messages
 * - Never logs secret values
 * - Supports graceful degradation
 * - STRICT validation in production
 *
 * PRODUCTION REQUIREMENTS:
 * - Use environment variables (Vercel, Railway, etc.)
 * - Never commit .env to git
 * - Rotate keys regularly
 * - Use secrets manager in production (AWS Secrets Manager, Vault, etc.)
 */

// Auto-load .env file
import 'dotenv/config';

import { isProduction, requireStrictSecrets, getEnvironment } from './config/env';

export interface SecretsConfig {
  // Solana
  solanaPrivateKey?: number[];
  heliusApiKey?: string;
  heliusRpcMainnet?: string;

  // Kalshi
  kalshiApiKey?: string;
  kalshiApiSecret?: string;

  // Supabase
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;

  // Anthropic
  anthropicApiKey?: string;

  // Mistral (primary LLM)
  mistralApiKey?: string;

  // Groq (backup LLM - free)
  groqApiKey?: string;

  // Gemini (backup LLM - Google)
  geminiApiKey?: string;

  // OpenAI (GPT-4)
  openaiApiKey?: string;

  // xAI (Grok)
  xaiApiKey?: string;

  // Tavily (social search)
  tavilyApiKey?: string;

  // Upstash Redis
  upstashRedisUrl?: string;
  upstashRedisToken?: string;

  // Jito
  jitoAuthKeypair?: string;

}

class SecretsManager {
  private static instance: SecretsManager;
  private config: SecretsConfig = {};
  private initialized = false;
  private validationErrors: string[] = [];

  private constructor() { }

  static getInstance(): SecretsManager {
    if (!SecretsManager.instance) {
      SecretsManager.instance = new SecretsManager();
    }
    return SecretsManager.instance;
  }

  /**
   * Initialize secrets from environment
   * Call this once at application startup
   */
  initialize(): { valid: boolean; errors: string[] } {
    if (this.initialized) {
      return { valid: this.validationErrors.length === 0, errors: this.validationErrors };
    }

    this.validationErrors = [];

    // Parse Solana private key (JSON array format)
    const solanaKeyRaw = process.env.SOLANA_PRIVATE_KEY;
    if (solanaKeyRaw) {
      try {
        const parsed = JSON.parse(solanaKeyRaw);
        if (Array.isArray(parsed) && parsed.length === 64) {
          this.config.solanaPrivateKey = parsed;
        } else {
          this.validationErrors.push('SOLANA_PRIVATE_KEY must be a 64-byte array');
        }
      } catch {
        this.validationErrors.push('SOLANA_PRIVATE_KEY is not valid JSON');
      }
    }

    // Helius
    this.config.heliusApiKey = process.env.HELIUS_API_KEY;
    this.config.heliusRpcMainnet = process.env.HELIUS_RPC_MAINNET || process.env.SOLANA_RPC_URL;

    // Kalshi
    this.config.kalshiApiKey = process.env.KALSHI_API_KEY;
    this.config.kalshiApiSecret = process.env.KALSHI_API_SECRET;

    // Supabase
    this.config.supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    this.config.supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    this.config.supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Anthropic
    this.config.anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    // Mistral (primary)
    this.config.mistralApiKey = process.env.MISTRAL_API_KEY;

    // Groq (backup)
    this.config.groqApiKey = process.env.GROQ_API_KEY;

    // Gemini (backup)
    this.config.geminiApiKey = process.env.GEMINI_API_KEY;

    // OpenAI (GPT-4)
    this.config.openaiApiKey = process.env.OPENAI_API_KEY;

    // xAI (Grok)
    this.config.xaiApiKey = process.env.XAI_API_KEY;

    // Tavily
    this.config.tavilyApiKey = process.env.TAVILY_API_KEY;

    // Upstash Redis
    this.config.upstashRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
    this.config.upstashRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    // Jito
    this.config.jitoAuthKeypair = process.env.JITO_AUTH_KEYPAIR;

    this.initialized = true;

    return { valid: this.validationErrors.length === 0, errors: this.validationErrors };
  }

  /**
   * Check if a specific secret is configured
   */
  has(key: keyof SecretsConfig): boolean {
    this.ensureInitialized();
    const value = this.config[key];
    return value !== undefined && value !== null && value !== '';
  }

  /**
   * Get Solana private key bytes
   * @throws if not configured
   */
  getSolanaPrivateKey(): Uint8Array {
    this.ensureInitialized();
    if (!this.config.solanaPrivateKey) {
      throw new SecretNotConfiguredError('SOLANA_PRIVATE_KEY');
    }
    return Uint8Array.from(this.config.solanaPrivateKey);
  }

  /**
   * Get Helius API key
   */
  getHeliusApiKey(): string | undefined {
    this.ensureInitialized();
    return this.config.heliusApiKey;
  }

  /**
   * Get Helius RPC URL
   */
  getHeliusRpcUrl(): string {
    this.ensureInitialized();
    return this.config.heliusRpcMainnet || 'https://api.mainnet-beta.solana.com';
  }

  /**
   * Get Kalshi credentials
   */
  getKalshiCredentials(): { apiKey: string; apiSecret: string } | null {
    this.ensureInitialized();
    if (!this.config.kalshiApiKey || !this.config.kalshiApiSecret) {
      return null;
    }
    return {
      apiKey: this.config.kalshiApiKey,
      apiSecret: this.config.kalshiApiSecret,
    };
  }

  /**
   * Get Supabase credentials
   */
  getSupabaseCredentials(): { url: string; anonKey: string; serviceRoleKey?: string } | null {
    this.ensureInitialized();
    if (!this.config.supabaseUrl || !this.config.supabaseAnonKey) {
      return null;
    }
    return {
      url: this.config.supabaseUrl,
      anonKey: this.config.supabaseAnonKey,
      serviceRoleKey: this.config.supabaseServiceRoleKey,
    };
  }

  /**
   * Get Anthropic API key
   */
  getAnthropicApiKey(): string | undefined {
    this.ensureInitialized();
    return this.config.anthropicApiKey;
  }

  /**
   * Get Mistral API key
   */
  getMistralApiKey(): string | undefined {
    this.ensureInitialized();
    return this.config.mistralApiKey;
  }

  /**
   * Get Groq API key
   */
  getGroqApiKey(): string | undefined {
    this.ensureInitialized();
    return this.config.groqApiKey;
  }

  /**
   * Get Gemini API key
   */
  getGeminiApiKey(): string | undefined {
    this.ensureInitialized();
    return this.config.geminiApiKey;
  }

  /**
   * Get OpenAI API key
   */
  getOpenAIApiKey(): string | undefined {
    this.ensureInitialized();
    return this.config.openaiApiKey;
  }

  /**
   * Get xAI (Grok) API key
   */
  getXAIApiKey(): string | undefined {
    this.ensureInitialized();
    return this.config.xaiApiKey;
  }

  /**
   * Get Tavily API key
   */
  getTavilyApiKey(): string | undefined {
    this.ensureInitialized();
    return this.config.tavilyApiKey;
  }

  /**
   * Get Upstash Redis credentials
   */
  getUpstashCredentials(): { url: string; token: string } | null {
    this.ensureInitialized();
    if (!this.config.upstashRedisUrl || !this.config.upstashRedisToken) {
      return null;
    }
    return {
      url: this.config.upstashRedisUrl,
      token: this.config.upstashRedisToken,
    };
  }

  /**
   * Validate required secrets for a specific feature
   */
  validateForFeature(feature: 'onchain' | 'kalshi' | 'supabase' | 'agents'): {
    valid: boolean;
    missing: string[];
  } {
    this.ensureInitialized();
    const missing: string[] = [];

    switch (feature) {
      case 'onchain':
        if (!this.config.solanaPrivateKey) missing.push('SOLANA_PRIVATE_KEY');
        if (!this.config.heliusRpcMainnet) missing.push('HELIUS_RPC_MAINNET or SOLANA_RPC_URL');
        break;
      case 'kalshi':
        if (!this.config.kalshiApiKey) missing.push('KALSHI_API_KEY');
        if (!this.config.kalshiApiSecret) missing.push('KALSHI_API_SECRET');
        break;
      case 'supabase':
        if (!this.config.supabaseUrl) missing.push('SUPABASE_URL');
        if (!this.config.supabaseAnonKey) missing.push('SUPABASE_ANON_KEY');
        break;
      case 'agents':
        if (!this.config.anthropicApiKey) missing.push('ANTHROPIC_API_KEY');
        break;
    }

    return { valid: missing.length === 0, missing };
  }

  /**
   * Get a summary of configured secrets (for logging, never includes values)
   */
  getConfigSummary(): Record<string, boolean> {
    this.ensureInitialized();
    return {
      solana: !!this.config.solanaPrivateKey,
      helius: !!this.config.heliusApiKey,
      kalshi: !!(this.config.kalshiApiKey && this.config.kalshiApiSecret),
      supabase: !!(this.config.supabaseUrl && this.config.supabaseAnonKey),
      supabaseServiceRole: !!this.config.supabaseServiceRoleKey,
      anthropic: !!this.config.anthropicApiKey,
      mistral: !!this.config.mistralApiKey,
      groq: !!this.config.groqApiKey,
      gemini: !!this.config.geminiApiKey,
      tavily: !!this.config.tavilyApiKey,
      upstash: !!(this.config.upstashRedisUrl && this.config.upstashRedisToken),
    };
  }

  /**
   * STRICT validation for production environments
   * Throws if any required production secrets are missing
   */
  validateForProduction(): { valid: boolean; missing: string[] } {
    this.ensureInitialized();

    const requiredSecrets = [
      { key: 'supabaseUrl', env: 'SUPABASE_URL' },
      { key: 'supabaseAnonKey', env: 'SUPABASE_ANON_KEY' },
      { key: 'supabaseServiceRoleKey', env: 'SUPABASE_SERVICE_ROLE_KEY' },
      { key: 'anthropicApiKey', env: 'ANTHROPIC_API_KEY' },
      { key: 'upstashRedisUrl', env: 'UPSTASH_REDIS_REST_URL' },
      { key: 'upstashRedisToken', env: 'UPSTASH_REDIS_REST_TOKEN' },
    ] as const;

    const missing: string[] = [];

    for (const { key, env } of requiredSecrets) {
      const value = this.config[key as keyof SecretsConfig];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        missing.push(env);
      }
    }

    // In strict mode (production), fail fast
    if (requireStrictSecrets() && missing.length > 0) {
      console.error('[SECURITY] Missing required production secrets:', missing);
      throw new Error(
        `Production deployment blocked: Missing required secrets: ${missing.join(', ')}. ` +
        `Set these in Railway/Vercel environment variables.`
      );
    }

    return { valid: missing.length === 0, missing };
  }

  /**
   * Check if all secrets are properly configured for production
   */
  isProductionReady(): boolean {
    try {
      const { valid } = this.validateForProduction();
      return valid;
    } catch {
      return false;
    }
  }

  /**
   * Get environment info (safe to log)
   */
  getEnvironmentInfo(): { environment: string; isProduction: boolean; strictMode: boolean } {
    return {
      environment: getEnvironment(),
      isProduction: isProduction(),
      strictMode: requireStrictSecrets(),
    };
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize();
    }
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Mask a secret for safe logging
 * Shows first 4 and last 4 characters only
 */
export function maskSecret(secret: string | undefined): string {
  if (!secret) return '[not set]';
  if (secret.length <= 12) return '****';

  const first = secret.slice(0, 4);
  const last = secret.slice(-4);
  return `${first}...${last}`;
}

/**
 * Check if a string looks like a secret (for detection)
 */
export function looksLikeSecret(value: string): boolean {
  const patterns = [
    /^sk-ant-/,           // Anthropic
    /^sk_(?:live|test)_/, // Stripe
    /^gsk_/,              // Groq
    /^eyJ[a-zA-Z0-9]/,    // JWT
    /^whsec_/,            // Webhook secret
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i, // UUID
  ];

  return patterns.some(p => p.test(value));
}

/**
 * Error thrown when a required secret is not configured
 */
export class SecretNotConfiguredError extends Error {
  constructor(secretName: string) {
    super(`Required secret not configured: ${secretName}. Check your .env file.`);
    this.name = 'SecretNotConfiguredError';
  }
}

// Export singleton
export const secrets = SecretsManager.getInstance();

// Export a function to validate all secrets at startup
export function validateSecrets(): {
  valid: boolean;
  errors: string[];
  summary: Record<string, boolean>;
  productionReady: boolean;
  environment: { environment: string; isProduction: boolean; strictMode: boolean };
} {
  const { valid, errors } = secrets.initialize();
  const summary = secrets.getConfigSummary();
  const productionReady = secrets.isProductionReady();
  const environment = secrets.getEnvironmentInfo();

  // Log environment info at startup
  console.log(`[Secrets] Environment: ${environment.environment}`);
  console.log(`[Secrets] Strict mode: ${environment.strictMode}`);
  console.log(`[Secrets] Production ready: ${productionReady}`);

  return { valid, errors, summary, productionReady, environment };
}

/**
 * Initialize and validate secrets for production deployment
 * Call this at application startup - will throw in production if secrets missing
 */
export function initializeSecretsForProduction(): void {
  const { valid, errors } = secrets.initialize();

  if (!valid) {
    console.error('[Secrets] Validation errors:', errors);
  }

  // This will throw in production if required secrets are missing
  secrets.validateForProduction();
}
